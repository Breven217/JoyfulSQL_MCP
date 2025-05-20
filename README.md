# MySQL MCP Server

A Model Context Protocol (MCP) server that allows AI assistants like Cascade to interact with both local and remote MySQL databases.

## Features

- Connect to local MySQL databases
- Connect to remote MySQL databases via SSH tunneling (ODI)
- Execute read-only or read-write queries (configurable)
- Secure access through SSH tunneling for remote databases
- Automatic database detection and listing when no database is specified

## Setup

### Prerequisites

- Node.js
- Local MySQL database (optional)
- SSH access to remote MySQL databases (optional)

### Installation

Install dependencies and build:
```
make install
```

## Usage

### Using with Cascade

Cascade can automatically start and manage the server. Configure Cascade by adding this to your MCP configuration:

```json
{
  "mcpServers": {
      "mysql": {
          "command": "node",
          "args": [
            "/Users/[user]/repos/MySQL_MCP_Server/build/index.js" // Path to the server
          ],
          "env": {
            "WRITE_ACCESS": "true", // Set to "false" for read-only access
            
            // Local MySQL Configuration
            "LOCAL_HOST": "localhost",
            "LOCAL_USER": "[user]",
            "LOCAL_PASSWORD": "[password]",
            "LOCAL_PORT": "3306",
            
            // ODI MySQL Configuration (for remote access via SSH)
            "ODI_SSH_KEY": "/path/to/.ssh/id_rsa",
            "ODI_USER": "[user]",
            "ODI_PASSWORD": "[password]",
            "ODI_HOST": "127.0.0.1",
            "ODI_PORT": "3306",
            "ODI_SSH_PORT": "22"
          }
      }
  }
}
```

### Available Tools

This MCP server provides two main tools:

1. **local_mysql_query** - Execute queries on your local MySQL database
   ```
   Parameters:
   - sql: SQL query to execute
   - database: (optional) Database to query - if not specified, will show available databases
   - params: (optional) Parameters for the SQL query
   ```

2. **odi_mysql_query** - Execute queries on remote MySQL databases via SSH tunnel
   ```
   Parameters:
   - sql: SQL query to execute
   - database: (optional) Database to query - if not specified, will show available databases
   - sshHost: SSH host to connect through (e.g., "171831.bjoyner.pandasandbox.com")
   - params: (optional) Parameters for the SQL query
   ```

### Using Manually

1. Start the server:
   ```
   make up
   ```

2. Stop the server:
   ```
   make down
   ```

3. Check server status:
   ```
   make status
   ```

4. Run a custom SQL query:
   ```
   make query SQL="SELECT * FROM your_table"
   ```

## Examples

### List all available databases
```
// Using the local_mysql_query tool without specifying a database
sql: "SHOW TABLES;"

// Using the odi_mysql_query tool without specifying a database
sql: "SHOW TABLES;"
sshHost: "your-odi-host.example.com"
```

### List all databases on an ODI server
```
// Using the odi_mysql_query tool
sql: "SELECT SCHEMA_NAME FROM SCHEMATA;"
database: "information_schema"
sshHost: "your-odi-host.example.com"
```

### Query a specific database on ODI
```
// Using the odi_mysql_query tool
sql: "SELECT * FROM your_table LIMIT 10;"
database: "your_database_name"
sshHost: "your-odi-host.example.com"
```

### Query a specific database locally
```
// Using the local_mysql_query tool
sql: "SELECT * FROM your_table LIMIT 10;"
database: "your_database_name"
```

## Security

This server is intended for local development only. Do not expose it to the internet without proper security measures. The SSH tunneling provides an additional layer of security for remote database access.
