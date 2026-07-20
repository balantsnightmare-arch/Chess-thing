# Use Node.js 20 slim as base
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy the rest of the source files
COPY . .

# Build the Vite frontend and bundle the Express server
RUN npm run build

# Expose the port the server runs on
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Start the production server
CMD ["npm", "start"]
