import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import mysql from "mysql2/promise";
import { spawn } from 'child_process';
import { isDataModifyingOperation, getAvailableDatabases, createNoDatabaseResponse } from "../helpers/util.js";

// Store connection pools by database name
let connectionPools: Map<string, mysql.Pool> = new Map();

// Store SSH clients by host
let sshClients: Map<string, any> = new Map();

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

// Helper function to create a MySQL connection through SSH tunnel using native SSH command
async function createSshTunnelConnection(config: any, sshHost: string, database: string): Promise<mysql.Pool> {
  // Create a unique connection key
  const connectionKey = `${sshHost}:${database}`;
  
  // Check if we already have a connection pool for this database
  if (connectionPools.has(connectionKey)) {
    console.log(`Reusing existing connection pool for ${connectionKey}`);
    return connectionPools.get(connectionKey)!;
  }
  
  // Check if we already have an SSH tunnel for this host
  const sshKey = sshHost;
  let localPort: number;
  let sshProcess: any;
  
  if (sshClients.has(sshKey)) {
    console.log(`Reusing existing SSH tunnel for ${sshKey}`);
    sshProcess = sshClients.get(sshKey);
    // Extract the local port from the existing SSH process
    // This is a simplification - in a real implementation, you'd need to store the port with the process
    localPort = nextLocalPort - 1;
  } else {
    // Create a new SSH tunnel
    localPort = nextLocalPort++;
  }

  return new Promise<mysql.Pool>((resolve, reject) => {
    console.log(`Setting up SSH tunnel to ${sshHost}`);
    
    // Use the native ssh command that's already working in your environment
    // This will create a tunnel from localhost:localPort to remote 127.0.0.1:3306
    sshProcess = spawn('ssh', [
      '-v', // Verbose output for debugging
      '-L', `${localPort}:127.0.0.1:3306`, // Port forwarding
      '-N', // Don't execute a remote command
      sshHost
    ]);
    
    // Store the process for later use
    sshClients.set(sshKey, sshProcess);
    
    let errorOutput = '';
    let stdoutOutput = '';
    
    sshProcess.stdout.on('data', (data: Buffer) => {
      stdoutOutput += data.toString();
      console.log(`SSH Output: ${data}`);
    });
    
    sshProcess.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
      console.error(`SSH Error: ${data}`);
    });
    
    sshProcess.on('error', (error: Error) => {
      console.error('Failed to start SSH process:', error);
      reject(error);
    });
    
    sshProcess.on('exit', (code: number | null, signal: string | null) => {
      if (code !== 0 && signal !== 'SIGTERM') {
        console.error(`SSH process exited with code ${code} and signal ${signal}`);
        console.error(`Error output: ${errorOutput}`);
        reject(new Error(`SSH tunnel failed with code ${code}`));
        return;
      }
    });
    
    // Wait a bit for the tunnel to establish
    setTimeout(() => {
      try {
        // Create a connection pool that connects through the SSH tunnel
        const newPool = mysql.createPool({
          host: '127.0.0.1', // Connect to local forwarded port
          port: localPort,
          user: process.env.ODI_USER || 'web',
          password: process.env.ODI_PASSWORD,
          database: database
        });
        
        // Store the connection pool for reuse
        connectionPools.set(connectionKey, newPool);
        
        console.log(`MySQL connection pool created through SSH tunnel on port ${localPort}`);
        resolve(newPool);
      } catch (error) {
        console.error('Error creating MySQL connection pool:', error);
        reject(error);
      }
    }, 5000); // Wait 5 seconds for the tunnel to establish
  });
}

// Global error handler to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

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
  
  // Kill all SSH processes
  for (const [key, process] of sshClients.entries()) {
    try {
      process.kill();
      console.log(`Killed SSH process for ${key}`);
    } catch (error) {
      console.error(`Error killing SSH process for ${key}:`, error);
    }
  }
  sshClients.clear();
}

// Register cleanup handler for process exit
process.on('exit', () => {
  cleanupConnections();
});

export default (server: McpServer, config: any) => {
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
    "Execute a SQL query on the ODI MySQL database through SSH tunnel",
    {
      sql: z.string().describe("SQL query to execute"),
      database: z.string().optional().describe("Database to query (if not specified, will show available databases)"),
      sshHost: z.string().describe("SSH host to connect through (required)"),
      params: z.array(z.string()).optional().describe("Parameters for the SQL query (optional)"),
    },
    async ({ sql, params, database, sshHost }) => {
      // If no database was specified, query information_schema to get available databases
      if (!database) {
        try {
          const databases = await getAvailableDatabasesViaSsh(config, sshHost);
          return createNoDatabaseResponse(databases);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Failed to retrieve available databases. Please specify a database name explicitly." }, null, 2),
              },
            ],
          };
        }
      }
      try {
        // Create or reuse SSH tunnel and get the connection pool
        const tunnelPool = await createSshTunnelConnection(config, sshHost, database);
        
        // Check if the operation modifies data
        const isDataModifying = isDataModifyingOperation(sql);

        // AI agents cannot run data-modifying operations
        if (isDataModifying && !config.writeAccess) {
          return {
            content: [
              {
                type: "text",
                text: "⚠️ This SQL operation modifies data and cannot be run. \n\n" +
                      "SQL: " + sql
              },
            ],
          };
        }

        try {
          const [rows] = await tunnelPool.execute(sql, params || []);
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(rows, null, 2),
              },
            ],
          };
        } catch (error: unknown) {            
          let errorResponse: { error: string; code?: string; sqlState?: string } = {
            error: "Unknown database error"
          };
          
          if (error instanceof Error) {
            errorResponse.error = error.message;
            
            if ('code' in error) {
              errorResponse.code = (error as any).code;
            }
            if ('sqlState' in error) {
              errorResponse.sqlState = (error as any).sqlState;
            }
          } else {
            errorResponse.error = String(error);
          }
          
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(errorResponse, null, 2),
              },
            ],
          };
        }
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
