FROM node:20-alpine

# Install SSH client and required dependencies
RUN apk add --no-cache openssh-client ca-certificates

# Set up SSH configuration for non-interactive use
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh && \
    echo "StrictHostKeyChecking no" > /root/.ssh/config && \
    chmod 600 /root/.ssh/config

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build the application
RUN npm run build

# Expose the MCP server port
EXPOSE 4000

# Set environment variables with defaults (can be overridden at runtime)
ENV WRITE_ACCESS="false"
ENV LOCAL_HOST="localhost"
ENV LOCAL_USER=""
ENV LOCAL_PASSWORD=""
ENV LOCAL_PORT="3306"
ENV ODI_SSH_KEY="/root/.ssh/id_rsa"
ENV ODI_USER=""
ENV ODI_PASSWORD=""
ENV ODI_HOST="127.0.0.1"
ENV ODI_PORT="3306"
ENV ODI_SSH_PORT="22"

# Create .ssh directory and set proper permissions
RUN mkdir -p /root/.ssh && \
    chmod 700 /root/.ssh

# Run the MCP server
CMD ["node", "build/index.js"]
