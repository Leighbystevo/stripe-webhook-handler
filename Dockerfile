FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy TypeScript configs
COPY tsconfig*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY src/lib/stripe/webhooks ./src/lib/stripe/webhooks
COPY src/lib/utils.ts ./src/lib/utils.ts
COPY src/types ./src/types

# Build the webhook handler
RUN npm run build:webhook && npm prune --production

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start server
CMD ["node", "dist/lib/stripe/webhooks/server.js"]