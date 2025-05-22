# MySQL MCP Server

A Model Context Protocol (MCP) server that allows AI assistants like Cascade to interact with both local and remote MySQL databases.

## Quick Start with Docker

### Pull Pre-built Image
```bash
docker pull ghcr.io/breven217/mysql_mcp_server:latest
```

## Features

- Connect to local MySQL databases
- Connect to remote MySQL databases via SSH tunneling (ODI)
- Execute read-only or read-write queries (configurable)
- Secure access through SSH tunneling for remote databases
- Automatic database detection and listing when no database is specified
- Interactive workflow that waits for user to select a database before proceeding

## Setup

### Prerequisites

- Node.js
- Local MySQL database (optional)
- SSH access to remote MySQL databases (optional)

### Installation

#### Option 1: Using Docker (Recommended)
See the [Quick Start with Docker](#quick-start-with-docker) section above.

#### Option 2: Manual Installation
Install dependencies and build:
```bash
make install
```

## Usage

### Using with Cascade

Cascade can automatically start and manage the server. Configure Cascade by adding this to your MCP configuration:

#### Option 1: Using Docker (Recommended)
```json
{
  "mcpServers": {
      "mysql": {
          "command": "docker",
          "args": [
            "run",
            "--rm",
            "-i",
            "--env-file",
            "/path/to/your/env",
            "ghcr.io/breven217/mysql_mcp_server:latest"
          ]
      }
  }
}
```

#### Option 2: Using Local Installation

```json
{
  "mcpServers": {
       "mysql": {
          "command": "node",
          "args": [
            "/path/to/your/server/build/index.js",
            "--env-file",
            "/path/to/your/env"
          ]
      },
  }
}
```

### ENV

```
LOCAL_HOST=[host]
LOCAL_USER=[user]
LOCAL_PASSWORD=[password]
LOCAL_PORT=[port]

ODI_SSH_KEY=[path/to/ssh/key]
ODI_USER=[user]
ODI_PASSWORD=[password]
ODI_HOST=[host]
ODI_PORT=[port]
ODI_SSH_PORT=[ssh_tunnel_port]

WRITE_ACCESS=[bool]
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

## Examples

### Interactive Database Selection

When no database is specified, the server will:
1. List all available databases on the target MySQL server
2. Halt execution and wait for the user to specify a database
3. Require the user to run the tool again with the `database` parameter explicitly set

This interactive workflow prevents executing queries without a properly selected database and gives the user clear guidance on how to proceed.

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
