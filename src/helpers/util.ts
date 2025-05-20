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