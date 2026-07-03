FROM node:20-alpine AS base
WORKDIR /app

# Install ALL dependencies (including dev for prisma CLI)
FROM base AS deps
COPY packages/backend/package.json ./
RUN npm install

# Build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY packages/backend/tsconfig.json ./
COPY packages/backend/prisma ./prisma
COPY packages/backend/src ./src
RUN npx prisma generate
RUN npm run build

# Production image
FROM node:20-alpine AS runner
ENV NODE_ENV=production

# Install only production deps in a clean stage
COPY packages/backend/package.json ./
RUN npm install --production

# Copy prisma CLI and client from builder for migrations at runtime
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

RUN addgroup --system nodejs && adduser --system --ingroup nodejs flowshield

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

USER flowshield
EXPOSE 10000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
