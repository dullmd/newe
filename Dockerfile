FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create auth directory
RUN mkdir -p auth

# Expose port
EXPOSE 8000

# Start bot
CMD ["npm", "start"]
