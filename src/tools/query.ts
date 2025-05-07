import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import mysql from "mysql2/promise";

// Create a connection pool to improve performance
let pool: mysql.Pool | null = null;

// Helper function to detect data-modifying SQL operations
function isDataModifyingOperation(sql: string): boolean {
  const sqlLower = sql.trim().toLowerCase();
  
  // Operations that modify data
  const dataModifyingPatterns = [
    /^\s*create\s/i,
    /^\s*update\s/i,
    /^\s*insert\s/i,
    /^\s*delete\s/i,
    /^\s*replace\s/i,
    /^\s*drop\s/i,
    /^\s*truncate\s/i,
    /^\s*alter\s/i,
    /^\s*grant\s/i,
    /^\s*revoke\s/i
  ];

  return dataModifyingPatterns.some(pattern => pattern.test(sqlLower));
}

export default (server: McpServer, config: any) => {
	pool = mysql.createPool(config);

	server.tool(
		"mysql_query",
		"Execute a SQL query on the MySQL database",
		{
			sql: z.string().describe("SQL query to execute"),
			params: z.array(z.string()).optional().describe("Parameters for the SQL query (optional)"),
		},
	async ({ sql, params }) => {
		// Check if the operation modifies data
		const isDataModifying = isDataModifyingOperation(sql);

		// AI agents cannot run data-modifying operations
		if (isDataModifying) {
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
			const [rows] = await pool!.execute(sql, params || []);
			
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
	},
	);
};