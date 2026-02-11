# Use official Node.js 20 image
FROM node:20-slim

# Install Python 3.11 and dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy Python requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
