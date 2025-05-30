import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import mysql from "mysql2/promise";
import { getAvailableDatabases, createNoDatabaseResponse, performQuery } from "../helpers/util.js";

// Import ssh2 with require to avoid TypeScript errors
const { Client } = require('ssh2');
const fs = require('fs');

// Store connection pools by database name
let connectionPools = new Map<string, any>();

// Store SSH clients by host
let sshClients = new Map<string, any>();

// Store local ports used by SSH tunnels
let nextLocalPort = 33306;

// Helper function to get available databases through SSH tunnel
async function getAvailableDatabasesViaSsh(config: any, sshHost: string): Promise<string[]> {
  try {
    // Create a connection to information_schema
    const pool = await createSshTunnelConnection(config, sshHost, 'information_schema');
    return await getAvailableDatabases(pool);
  } catch (error) {
    console.error('Error connecting to information_schema:', error);
    return [];
  }
}

// Helper function to create a MySQL connection through SSH tunnel using ssh2 package
async function createSshTunnelConnection(config: any, sshHost: string, database: string): Promise<any> {
  // Create a unique connection key
  const connectionKey = `${sshHost}:${database}`;
  
  // Check if we already have a connection pool for this database
  if (connectionPools.has(connectionKey)) {
    console.log(`Reusing existing connection pool for ${connectionKey}`);
    return connectionPools.get(connectionKey);
  }

  return new Promise((resolve, reject) => {
    console.log(`Setting up SSH tunnel to ${sshHost}`);
    
    // Create a new SSH client
    const sshClient = new Client();
    
    // Parse the SSH host string to extract username if present
    let username = 'root';
    let hostname = sshHost;
    
    if (sshHost.includes('@')) {
      const parts = sshHost.split('@');
      username = parts[0];
      hostname = parts[1];
    }
    
    // Get SSH key path from environment variable or use default
    const sshKeyPath = process.env.ODI_SSH_KEY || '/root/.ssh/id_rsa';
    
    console.log(`SSH connection details: ${username}@${hostname} using key ${sshKeyPath}`);
    
    // Set up event handlers
    sshClient.on('ready', () => {
      console.log('SSH connection established');
      
      // Create a unique local port for this connection
      const localPort = nextLocalPort++;
      
      // Forward a connection from localhost:localPort to remote 127.0.0.1:3306
      sshClient.forwardOut(
        '127.0.0.1',  // Local bind address
        localPort,    // Local bind port
        '127.0.0.1',  // Remote MySQL host
        3306,         // Remote MySQL port
        (err: any, stream: any) => {
          if (err) {
            console.error('Port forwarding error:', err);
            sshClient.end();
            reject(err);
            return;
          }
          
          console.log(`Port forwarding established from localhost:${localPort} to remote 127.0.0.1:3306`);
          
          try {
            // Create a connection pool using the forwarded port
            const mysqlConfig = {
              host: '127.0.0.1',
              port: localPort,
              user: process.env.ODI_USER || 'web',
              password: process.env.ODI_PASSWORD || '',
              database: database
            };
            
            console.log('Creating MySQL connection with config:', {
              host: mysqlConfig.host,
              port: mysqlConfig.port,
              user: mysqlConfig.user,
              database: mysqlConfig.database
            });
            
            const pool = mysql.createPool(mysqlConfig);
            
            // Store both the SSH client and the connection pool for later use
            sshClients.set(sshHost, sshClient);
            connectionPools.set(connectionKey, pool);
            
            console.log(`MySQL connection pool created through SSH tunnel`);
            resolve(pool);
          } catch (error) {
            console.error('Error creating MySQL connection pool:', error);
            sshClient.end();
            reject(error);
          }
        }
      );
    });
    
    sshClient.on('error', (err: any) => {
      console.error('SSH connection error:', err);
      reject(err);
    });
    
    // Connect to the SSH server
    try {
      const sshConfig: any = {
        host: hostname,
        port: parseInt(process.env.ODI_SSH_PORT || '22'),
        username: username
      };
      
      // Check if SSH key file exists
      if (fs.existsSync(sshKeyPath)) {
        console.log(`Using SSH key file: ${sshKeyPath}`);
        sshConfig.privateKey = fs.readFileSync(sshKeyPath);
      } else {
        console.warn(`SSH key file ${sshKeyPath} not found, trying password authentication`);
        // If no key file, try password from environment variable
        if (process.env.ODI_SSH_PASSWORD) {
          sshConfig.password = process.env.ODI_SSH_PASSWORD;
        } else {
          // If no password either, try agent authentication
          console.warn('No SSH password found, trying agent authentication');
          sshConfig.agent = process.env.SSH_AUTH_SOCK;
        }
      }
      
      console.log('Connecting to SSH with config:', {
        host: sshConfig.host,
        port: sshConfig.port,
        username: sshConfig.username,
        authMethod: sshConfig.privateKey ? 'privateKey' : 
                   sshConfig.password ? 'password' : 
                   sshConfig.agent ? 'agent' : 'none'
      });
      
      sshClient.connect(sshConfig);
    } catch (error) {
      console.error('Error connecting to SSH:', error);
      reject(error);
    }
  });
}

// Function to clean up all connections and SSH tunnels
async function cleanupConnections() {
  // Close all connection pools
  for (const [key, pool] of connectionPools.entries()) {
    try {
      await pool.end();
      console.log(`Closed connection pool for ${key}`);
    } catch (error) {
      console.error(`Error closing connection pool for ${key}:`, error);
    }
  }
  connectionPools.clear();
  
  // Close all SSH clients
  for (const [key, client] of sshClients.entries()) {
    try {
      client.end();
      console.log(`Closed SSH client for ${key}`);
    } catch (error) {
      console.error(`Error closing SSH client for ${key}:`, error);
    }
  }
  sshClients.clear();
  
  // Reset the local port counter
  nextLocalPort = 33306;
}

// Global error handler to prevent crashes
const process = require('process');
process.on('uncaughtException', (error: any) => {
  console.error('Uncaught Exception:', error);
});
// Register cleanup handler for process exit
process.on('exit', () => {
  cleanupConnections();
});

export default (server: any, config: any) => {
  // Log configuration for debugging
  console.log('ODI MySQL Query Tool Configuration:', {
    host: config.host,
    port: config.port,
    user: config.user,
    sshKeyPath: config.sshKeyPath,
    writeAccess: config.writeAccess
  });

  server.tool(
    "odi_mysql_query",
    {
      sql: z.string().describe("SQL query to execute"),
      database: z.string().optional().describe("Database to query (if not specified, will show available databases)"),
      sshHost: z.string().describe("SSH host to connect through (required)"),
      params: z.array(z.string()).optional().describe("Parameters for the SQL query (optional)"),
    },
    {title: "Execute a SQL query on the ODI MySQL database through SSH tunnel"},
    async ({ sql, params, database, sshHost }: { sql: string, params?: string[], database?: string, sshHost: string }) => {
      // If no database was specified, query information_schema to get available databases
      // and return early to wait for the user to specify a database
      if (!database) {
        try {
          const databases = await getAvailableDatabasesViaSsh(config, sshHost);
          // Return the list of available databases and require user action before proceeding
          return createNoDatabaseResponse(databases);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: "⚠️ Error retrieving databases. Please specify a database name explicitly."
              }
            ],
            requires_action: true
          };
        }
      }
      try {
        // Create or reuse SSH tunnel and get the connection pool
        const tunnelPool = await createSshTunnelConnection(config, sshHost, database);
        return await performQuery(tunnelPool, sql, params);
      } catch (error: unknown) {
        // Handle errors from SSH connection or setup
        let errorMessage = "Failed to establish SSH connection";
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: errorMessage }, null, 2),
            },
          ],
        };
      }
    },
  );
}
