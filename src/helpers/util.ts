import mysql from "mysql2/promise";

// Helper function to detect data-modifying SQL operations
export function isDataModifyingOperation(sql: string): boolean {
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

/**
 * Get available databases from MySQL server
 * 
 * @param pool MySQL connection pool
 * @returns Array of database names
 */
export async function getAvailableDatabases(pool: mysql.Pool): Promise<string[]> {
  try {
    const [rows] = await pool.execute('SELECT SCHEMA_NAME FROM SCHEMATA WHERE SCHEMA_NAME NOT IN ("information_schema", "mysql", "performance_schema", "sys")') as [any[], any];
    return rows.map((row: any) => row.SCHEMA_NAME);
  } catch (error) {
    console.error('Error getting available databases:', error);
    return [];
  }
}

/**
 * Create a response message for when no database is specified
 * 
 * @param databases List of available databases
 * @returns Response object with formatted message
 */
export function createNoDatabaseResponse(databases: string[]) {
  const instructions = "To use a database, include the 'database' parameter in your query.";
  return {
    content: [
      {
        type: "text" as const,
        text: "⚠️ No database specified. Please specify one of the following databases:\n\n" +
              databases.map(db => `- ${db}`).join('\n') + "\n\n" +
              instructions
      },
    ],
  };
}