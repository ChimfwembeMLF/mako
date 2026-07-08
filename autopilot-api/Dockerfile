FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
# Copy client package.json if needed to resolve workspaces correctly
COPY resources/client/package.json ./resources/client/
RUN yarn install --frozen-lockfile

# Build Backend
COPY . .
RUN npx nest build

# Production Image
FROM node:20-alpine

WORKDIR /app

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/yarn.lock ./
COPY --from=builder /app/resources/client/package.json ./resources/client/

# Install production dependencies only
RUN yarn install --production --frozen-lockfile

# Set environment
ENV NODE_ENV=production
ENV PORT=4000
ENV SERVE_CLIENT=false
ENV CORS_DISABLED=false

EXPOSE 4000

CMD ["node", "dist/main"]
