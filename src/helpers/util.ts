import mysql from "mysql2/promise";

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
  const instructions = "To use a database, include the 'database' parameter in your query and run the tool again.";
  return {
    content: [
      {
        type: "text" as const,
        text: "⚠️ No database specified. Please specify one of the following databases:\n\n" +
              databases.map(db => `- ${db}`).join('\n') + "\n\n" +
              instructions + "\n\n" +
              "Operation halted. You must specify a database to proceed."
      },
    ],
    requires_action: true
  };
}

export async function performQuery(pool: mysql.Pool, sql: string, params: string[] | undefined) {
  // Check if the operation modifies data
  const isDataModifying = isDataModifyingOperation(sql);

  // AI agents cannot run data-modifying operations unless WRITE_ACCESS is set to true
  if (isDataModifying && process.env.WRITE_ACCESS !== "true") {
    return {
      content: [
        {
          type: "text" as const,
          text: "⚠️ This SQL operation modifies data and cannot be run. \n\n" +
                "SQL: " + sql
        },
      ],
    };
  }

  try {
    const [rows] = await pool.execute(sql, params || []);
    
    return {
      content: [
        {
          type: "text" as const,
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
          type: "text" as const,
          text: JSON.stringify(errorResponse, null, 2),
        },
      ],
    };
  }
}