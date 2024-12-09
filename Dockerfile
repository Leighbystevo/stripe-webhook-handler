FROM node:20-slim

# Install dependencies only
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# Copy source code and build files
COPY tsconfig*.json ./
COPY src/lib/stripe/webhooks ./src/lib/stripe/webhooks
COPY src/lib/utils.ts ./src/lib/utils.ts
COPY src/types ./src/types

# Build the webhook handler
RUN npm run build:webhook

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port and start server
EXPOSE 8080
CMD ["node", "dist/lib/stripe/webhooks/server.js"]