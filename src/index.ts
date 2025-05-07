import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import queryTools from "./tools/query.js";

// Get configuration from environment variables
const config = {
  host: process.env.MYSQL_HOST,
  port: parseInt(process.env.MYSQL_PORT || ''),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

// Create server instance
const server = new McpServer({
  name: "mysql",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {
      mysql_query: {
        description: "Execute a SQL query on the MySQL database",
        parameters: {
          sql: {
            type: "string",
            description: "SQL query to execute",
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
queryTools(server, config);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MySQL MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});