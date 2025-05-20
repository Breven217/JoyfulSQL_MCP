import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import mysql from "mysql2/promise";
import { spawn } from 'child_process';
import { isDataModifyingOperation } from "../helpers/util.js";

// Create a connection pool to improve performance
let pool: mysql.Pool | null = null;

// Store SSH client for cleanup
let sshClient: any | null = null;

// Helper function to create a MySQL connection through SSH tunnel using native SSH command
async function createSshTunnelConnection(config: any, sshHost: string, database: string): Promise<mysql.Pool> {
  // Close existing connections if needed
  if (pool) {
    await pool.end();
    pool = null;
  }
  
  // Kill any existing SSH tunnel process
  if (sshClient) {
    try {
      sshClient.kill();
      console.log('Killed existing SSH tunnel process');
    } catch (error) {
      console.error('Error killing SSH process:', error);
    }
    sshClient = null;
  }
  
  // Find an available local port
  const localPort = 33306; // Use a specific port for the local tunnel

  return new Promise<mysql.Pool>((resolve, reject) => {
    console.log(`Setting up SSH tunnel to ${sshHost}`);
    
    // Use the native ssh command that's already working in your environment
    // This will create a tunnel from localhost:localPort to remote 127.0.0.1:3306
    const sshProcess = spawn('ssh', [
      '-v', // Verbose output for debugging
      '-L', `${localPort}:127.0.0.1:3306`, // Port forwarding
      '-N', // Don't execute a remote command
      sshHost
    ]);
    
    // Store the process for later cleanup
    sshClient = sshProcess;
    
    let errorOutput = '';
    let stdoutOutput = '';
    
    sshProcess.stdout.on('data', (data) => {
      stdoutOutput += data.toString();
      console.log(`SSH Output: ${data}`);
    });
    
    sshProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error(`SSH Error: ${data}`);
    });
    
    sshProcess.on('error', (error) => {
      console.error('Failed to start SSH process:', error);
      reject(error);
    });
    
    sshProcess.on('exit', (code, signal) => {
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
        pool = mysql.createPool({
          host: '127.0.0.1', // Connect to local forwarded port
          port: localPort,
          user: process.env.ODI_USER || 'web',
          password: process.env.ODI_PASSWORD,
          database: database
        });
        
        console.log(`MySQL connection pool created through SSH tunnel on port ${localPort}`);
        resolve(pool);
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
      database: z.string().describe("Database to query"),
      sshHost: z.string().describe("SSH host to connect through (required)"),
      params: z.array(z.string()).optional().describe("Parameters for the SQL query (optional)"),
    },
    async ({ sql, params, database, sshHost }) => {
      try {
        // Create SSH tunnel and get the connection pool
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
