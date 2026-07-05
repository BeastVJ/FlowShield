FROM node:20-alpine AS base
WORKDIR /app

# Install ALL dependencies (including dev for prisma CLI)
FROM base AS deps
COPY packages/backend/package.json ./
RUN npm install

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./
COPY --from=deps /app/package-lock.json ./
COPY packages/backend/tsconfig.json ./
COPY packages/backend/prisma ./prisma
COPY packages/backend/src ./src
RUN npx prisma generate
RUN npm run build

# Production image
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install OpenSSL for Prisma compatibility on Alpine Linux
RUN apk add --no-cache openssl

# Install only production deps in a clean stage
COPY packages/backend/package.json ./
COPY --from=builder /app/package-lock.json ./
RUN npm install --production

# Copy prisma CLI and client from builder for migrations at runtime
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create .bin symlink so npx prisma works reliably
RUN mkdir -p node_modules/.bin && ln -sf ../prisma/build/index.js node_modules/.bin/prisma

RUN addgroup --system nodejs && adduser --system --ingroup nodejs flowshield

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Copy startup script
COPY packages/backend/start.sh ./
RUN chmod +x start.sh && chown flowshield:nodejs start.sh

# Fix permissions so flowshield user can run prisma migrations
RUN mkdir -p /app/logs && chown -R flowshield:nodejs /app/node_modules /app/logs

USER flowshield
EXPOSE 10000

CMD ["./start.sh"]
