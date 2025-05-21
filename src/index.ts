import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import queryTools from "./tools/query.js";
import odiQueryTools from "./tools/odiQuery.js";
import fs from 'fs';
import path from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
let envFilePath = '';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--env-file' && i + 1 < args.length) {
    envFilePath = args[i + 1];
    break;
  }
}

// Load environment variables from file if specified
if (envFilePath) {
  try {
    const envFileContent = fs.readFileSync(envFilePath, 'utf8');
    const envVars = envFileContent.split('\n');
    
    for (const line of envVars) {
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;
      
      const [key, value] = line.split('=');
      if (key && value) {
        process.env[key.trim()] = value.trim();
      }
    }
    
    console.log(`Loaded environment variables from ${envFilePath}`);
  } catch (error) {
    console.error(`Error loading environment file: ${error}`);
  }
}

// Get configuration from environment variables
const localConfig = {
  host: process.env.LOCAL_HOST,
  port: parseInt(process.env.LOCAL_PORT || ''),
  user: process.env.LOCAL_USER,
  password: process.env.LOCAL_PASSWORD,
  database: process.env.LOCAL_DATABASE,
};
const odiConfig = {
  host: process.env.ODI_HOST,
  port: parseInt(process.env.ODI_PORT || ''),
  user: process.env.ODI_USER,
  sshPort: parseInt(process.env.ODI_SSH_PORT || ''),
  sshKeyPath: process.env.ODI_SSH_KEY,
};

// Create server instance
const server = new McpServer({
  name: "mysql",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {
      local_mysql_query: {
        description: "Execute a SQL query on the local MySQL database",
        parameters: {
          sql: {
            type: "string",
            description: "SQL query to execute",
          },
          database: {
            type: "string",
            description: "Database to query (if not specified, will show available databases)",
          },
          params: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Parameters for the SQL query (optional)",
          }
        },
      },
      odi_mysql_query: {
        description: "Execute a SQL query on the ODI MySQL database through SSH tunnel",
        parameters: {
          sql: {
            type: "string",
            description: "SQL query to execute",
          },
          database: {
            type: "string",
            description: "Database to query (if not specified, will show available databases)",
          },
          sshHost: {
            type: "string",
            description: "SSH host to connect through (required)",
          },
          params: {
            type: "array",
            items: {
              type: "string",
            },
            description: "Parameters for the SQL query (optional)",
          }
        },
      },
    },
  },
});

// Add query tools
queryTools(server, localConfig);
odiQueryTools(server, odiConfig);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MySQL MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});