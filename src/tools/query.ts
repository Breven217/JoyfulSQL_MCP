import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import mysql from "mysql2/promise";
import { getAvailableDatabases, createNoDatabaseResponse, performQuery } from "../helpers/util.js";

// Create a connection pool to improve performance
let pool: mysql.Pool | null = null;

export default (server: McpServer, config: any) => {
	// Only create pool if database is specified in config
	if (config.database) {
		pool = mysql.createPool(config);
	}

	server.tool(
		"local_mysql_query",
		{
			sql: z.string().describe("SQL query to execute"),
			database: z.string().optional().describe("Database to query (if not specified, will show available databases)"),
			params: z.array(z.string()).optional().describe("Parameters for the SQL query (optional)"),
		},
		{title: "Execute a SQL query on the local MySQL database"},
	async ({ sql, database, params }) => {
		// If database is specified in the tool call, use it instead of config.database
		const dbToUse = database || config.database;
		
		// If no database was specified in config or tool call, query information_schema to get available databases
		// and return early to wait for the user to specify a database
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
				return {
					content: [
						{
							type: "text",
							text: "⚠️ Error retrieving databases. Please specify a database name explicitly."
						}
					],
					requires_action: true
				};
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
		return await performQuery(pool, sql, params);
	},
	);
};