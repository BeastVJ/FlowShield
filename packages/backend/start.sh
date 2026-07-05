#!/bin/sh
set -e

echo "┌─────────────────────────────────────┐"
echo "│   FlowShield Startup Script         │"
echo "└─────────────────────────────────────┘"

# ── Verify DATABASE_URL ──────────────────────────────────────────
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set."
  echo "   Prisma cannot connect to the database without it."
  echo ""
  echo "   Make sure your Render Blueprint has created the database and"
  echo "   injected the connection string as DATABASE_URL."
  echo ""
  echo "   Check: render.yaml → databases → flowshield-db"
  echo "         render.yaml → services → flowshield-api → envVars → DATABASE_URL"
  echo ""
  echo "   If the database exists, trigger a new deploy from the Render dashboard."
  exit 1
fi
echo "✅ DATABASE_URL is set"

# ── Wait for database & run migrations ───────────────────────────
# Retry loop: the free-tier PostgreSQL on Render can take time to provision
echo "⏳ Running database migrations..."
max_retries=30
counter=0
while [ $counter -lt $max_retries ]; do
  if npx prisma migrate deploy 2>/dev/null; then
    break
  fi
  counter=$((counter + 1))
  echo "   Waiting for database... attempt $counter/$max_retries"
  sleep 2
done

if [ $counter -eq $max_retries ]; then
  echo "⚠️  Database not ready after $max_retries attempts. Retrying one final time..."
  npx prisma migrate deploy
fi

echo "✅ Migrations complete"

# ── Start the application ────────────────────────────────────────
echo "🚀 Starting FlowShield API server..."
exec node dist/server.js
