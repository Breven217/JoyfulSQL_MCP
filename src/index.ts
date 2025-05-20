import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import queryTools from "./tools/query.js";
import odiQueryTools from "./tools/odiQuery.js";

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