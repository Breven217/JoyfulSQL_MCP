# MySQL MCP Server

A Model Context Protocol (MCP) server that allows AI assistants like Cascade to interact with your MySQL database in a read-only manner.

## Setup

### Prerequisites

- Node.js
- MySQL database

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
            "MYSQL_HOST": "[host]",
            "MYSQL_USER": "[user]",
            "MYSQL_PASSWORD": "[password]",
            "MYSQL_DATABASE": "[database]",
            "MYSQL_PORT": "[port]",
          }
      }
  }
}
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

## Security

This server is intended for local development only. Do not expose it to the internet without proper security measures.
