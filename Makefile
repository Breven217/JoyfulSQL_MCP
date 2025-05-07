# Colors for terminal output
GREEN=\033[0;32m
YELLOW=\033[0;33m
RED=\033[0;31m
NC=\033[0m # No Color

.PHONY: help up down status query

help:
	@echo "MySQL MCP Server Management Commands"
	@echo "------------------------------------"
	@echo "${GREEN}make install${NC}    - Install dependencies"
	@echo "${GREEN}make up${NC}         - Start the MySQL MCP server locally"
	@echo "${GREEN}make down${NC}       - Stop the MySQL MCP server"
	@echo "${GREEN}make status${NC}     - Check MySQL MCP server status"
	@echo ""
	@echo "MySQL Query Commands"
	@echo "-------------------"
	@echo "${GREEN}make query SQL=\"...\"${NC}      - Run a custom SQL query"

# Install dependencies
install:
	@echo "${GREEN}Installing dependencies...${NC}"
	@npm install
	@echo "${GREEN}Building...${NC}"
	@npm run build

# Start the server locally
up:
	@echo "${GREEN}Starting MySQL MCP Server...${NC}"
	@node build/index.js &
	@sleep 1
	@echo "MySQL MCP Server is running at http://localhost:4000"

# Stop the server
down:
	@echo "${GREEN}Stopping MySQL MCP Server...${NC}"
	@PID=$$(lsof -ti :4000); \
	if [ -n "$$PID" ]; then \
		echo "Killing MySQL MCP Server..."; \
		kill -9 $$PID; \
		echo "MySQL MCP Server killed"; \
	else \
		echo "MySQL MCP server not running"; \
	fi

# Check status
status:
	@echo "${GREEN}MySQL MCP Server status:${NC}"
	@PID=$$(lsof -ti :4000); \
	if [ -n "$$PID" ]; then \
		echo "✅ MySQL MCP Server is running at http://localhost:4000"; \
		echo "MySQL MCP Server health check: "; \
		curl -s http://localhost:4000/health | jq; \
	else \
		echo "❌ MySQL MCP Server is not running"; \
		echo "Try: make up"; \
	fi

# Run query (Usage: make query SQL="SELECT * FROM your_table")
query:
	@echo "${YELLOW}Running MySQL query...${NC}"
	@if [ -z "$(SQL)" ]; then \
		echo "${RED}Error: SQL query is required${NC}"; \
	else \
		curl -s -X POST http://localhost:4000/mysql_query -H "Content-Type: application/json" -d "{\"sql\":\"$(SQL)\"}" | jq; \
	fi
