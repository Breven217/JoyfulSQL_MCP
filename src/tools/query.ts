import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import mysql from "mysql2/promise";
import { isDataModifyingOperation, getAvailableDatabases, createNoDatabaseResponse } from "../helpers/util.js";

// Create a connection pool to improve performance
let pool: mysql.Pool | null = null;

export default (server: McpServer, config: any) => {
	// Only create pool if database is specified in config
	if (config.database) {
		pool = mysql.createPool(config);
	}

	server.tool(
		"local_mysql_query",
		"Execute a SQL query on the local MySQL database",
		{
			sql: z.string().describe("SQL query to execute"),
			database: z.string().optional().describe("Database to query (if not specified, will show available databases)"),
			params: z.array(z.string()).optional().describe("Parameters for the SQL query (optional)"),
		},
	async ({ sql, database, params }) => {
		// If database is specified in the tool call, use it instead of config.database
		const dbToUse = database || config.database;
		
		// If no database was specified in config or tool call, query information_schema to get available databases
		if (!dbToUse) {
			// Create a temporary connection to information_schema
			const tempPool = mysql.createPool({
				...config,
				database: 'information_schema'
			});
			
			try {
				const databases = await getAvailableDatabases(tempPool);
				return createNoDatabaseResponse(databases);
			} catch (error) {
				console.error('Error getting available databases:', error);
				return createNoDatabaseResponse([]);
			} finally {
				await tempPool.end();
			}
		}
		
		// Create or update pool with the specified database
		if (pool) {
			await pool.end();
		}
		
		// Create a new pool with the specified database
		pool = mysql.createPool({
			...config,
			database: dbToUse
		});
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