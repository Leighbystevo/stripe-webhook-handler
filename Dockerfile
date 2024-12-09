FROM node:20-slim

WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
RUN npm install

# Copy source code
COPY src ./src

# Build the webhook handler
RUN npm run build:webhook && npm prune --production

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/lib/stripe/webhooks/server.js"]