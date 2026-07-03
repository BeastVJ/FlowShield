<div align="center">
  <h1>🛡️ FlowShield</h1>
  <p><strong>Production-Grade Distributed Rate Limiter as a Service</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Version-1.0.0-blue" alt="Version">
    <img src="https://img.shields.io/badge/TypeScript-5.4-3178c6" alt="TypeScript">
    <img src="https://img.shields.io/badge/Node.js-20-339933" alt="Node.js">
    <img src="https://img.shields.io/badge/React-18-61dafb" alt="React">
    <img src="https://img.shields.io/badge/Redis-7-DC382D" alt="Redis">
    <img src="https://img.shields.io/badge/PostgreSQL-16-4169E1" alt="PostgreSQL">
    <img src="https://img.shields.io/badge/License-MIT-green" alt="License">
    <img src="https://img.shields.io/badge/Performance-17.8k_RPS-brightgreen" alt="Performance">
  </p>
  <p>
    <strong>Enterprise rate limiting at your fingertips.</strong><br>
    Protect your APIs from abuse, traffic spikes, and DDoS attacks with battle-tested algorithms, real-time analytics, and a beautiful dashboard.
  </p>
</div>

---

## 📋 Table of Contents

- [📖 Overview](#-overview)
- [✨ Key Features](#-key-features)
- [🏗️ Architecture](#️-architecture)
- [🧮 Rate Limiting Algorithms](#-rate-limiting-algorithms)
- [📦 Project Structure](#-project-structure)
- [📊 Performance Benchmarks](#-performance-benchmarks)
- [🚀 Quick Start](#-quick-start)
- [🔌 SDK Usage](#-sdk-usage)
- [📖 API Reference](#-api-reference)
- [💻 Frontend Dashboard](#-frontend-dashboard)
- [🧪 Testing](#-testing)
- [🐳 Deployment](#-deployment)
- [📈 Monitoring & Observability](#-monitoring--observability)
- [🔒 Authentication & Security](#-authentication--security)
- [🛠️ Troubleshooting](#️-troubleshooting)
- [🗺️ Roadmap](#️-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 📖 Overview

**FlowShield** is a **cloud-native Rate Limiter as a Service (RLaaS)** that provides developers with a robust, scalable, and configurable solution to protect APIs from abuse, traffic spikes, and DDoS attacks.

### Who is this for?

| Role | What FlowShield offers |
|------|----------------------|
| **Backend Developer** | Drop-in SDK middleware for Express/Fastify/Koa. Set up rate limiting in 5 lines of code. |
| **API Product Manager** | Real-time analytics dashboard to monitor usage patterns, abuse attempts, and traffic trends. |
| **DevOps / SRE** | Prometheus + Grafana integration for production monitoring. Docker-native deployment. |
| **Platform Engineer** | Multi-tenant architecture with project-based isolation and RBAC. |
| **Startup Founder** | Usage-based billing model ready. Start free, scale as you grow. |

### What makes it different?

- **5 industry-standard algorithms** — not just a single approach. Pick the right tool for your use case.
- **Redis Lua scripting** — all rate limit checks are atomic. No race conditions, no inconsistent state.
- **Fail-open architecture** — if Redis goes down, requests pass through (configurable behavior).
- **Multi-tenant by design** — project isolation, API key management, per-key policy configuration.
- **Real-time WebSocket streaming** — live metrics pushed to the dashboard without polling.

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🧮 **5 Rate Limiting Algorithms** | Fixed Window, Sliding Window, Sliding Log, Token Bucket, Leaky Bucket |
| 📊 **Real-Time Dashboard** | Live metrics via WebSocket, historical charts with Recharts, usage analytics |
| 🔑 **API Key Management** | Generate, rotate, revoke keys. Per-key rate limit policy configuration |
| 🏢 **Multi-Tenant** | Project-based isolation with team member roles (Admin, Member, Viewer) |
| 🔐 **JWT Authentication** | Secure login with refresh tokens, bcrypt password hashing, RBAC |
| 📦 **Node.js SDK** | Drop-in middleware for Express, Fastify, Koa — local or cloud mode |
| 🐳 **Docker Ready** | Full docker-compose stack with Redis, PostgreSQL, Prometheus, Grafana |
| 📈 **Prometheus + Grafana** | Built-in metrics endpoint and pre-configured monitoring stack |
| ⚡ **Redis-Powered** | Sub-millisecond latency with atomic Lua scripts. Zero race conditions |
| 🔌 **WebSocket Live Metrics** | Socket.IO-based real-time streaming of rate limit events |
| 📝 **Audit Logging** | Full audit trail for all API key operations (create, rotate, revoke) |
| 💰 **Billing-Ready** | Usage-based plan architecture with tiered limits (Free, Starter, Pro, Enterprise) |
| 📚 **Swagger Documentation** | Auto-generated OpenAPI docs at `/api/docs` |

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                            │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐   │
│  │  Browser App  │   │  Mobile App  │   │  External API     │   │
│  │  (React)      │   │  (Any HTTP)  │   │  (via SDK)        │   │
│  └──────┬───────┘   └──────┬───────┘   └────────┬──────────┘   │
│         │                  │                     │              │
└─────────┼──────────────────┼─────────────────────┼──────────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REVERSE PROXY (Nginx)                      │
│              Rate limiting, SSL termination, caching             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                           │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                FlowShield API (Express + TS)               │  │
│  │                                                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │  │
│  │  │  Auth    │ │ Projects │ │ API Keys │ │ Rate Limit   │ │  │
│  │  │  Routes  │ │ Routes   │ │ Routes   │ │ Routes       │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────┬───────┘ │  │
│  │                                                  │        │  │
│  │  ┌───────────────────────────────────────────────▼──────┐ │  │
│  │  │         Rate Limiter Orchestrator                     │ │  │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │  │
│  │  │  │  Fixed   │ │ Sliding  │ │  Token   │ │ Leaky  │ │  │
│  │  │  │  Window  │ │ Window   │ │  Bucket  │ │ Bucket │ │  │
│  │  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │  │
│  │  │  ┌──────────────────────────────────────────┐       │  │
│  │  │  │          Sliding Log                      │       │  │
│  │  │  └──────────────────────────────────────────┘       │  │
│  │  └─────────────────────────────────────────────────────┘  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
┌──────────────────────┐     ┌──────────────────────┐
│    REDIS (Cache)     │     │  POSTGRESQL (Storage) │
│                      │     │                      │
│  • Rate limit        │     │  • Users             │
│    counters          │     │  • Projects          │
│  • Lua scripts       │     │  • API Keys          │
│  • Analytics data    │     │  • Policies          │
│  • WebSocket sessions│     │  • Audit Logs        │
│  • RPS tracking      │     │  • Request Logs      │
└──────────────────────┘     └──────────────────────┘
         │                           │
         └───────────┬───────────────┘
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING LAYER                              │
│                                                                 │
│  ┌─────────────┐          ┌─────────────┐                      │
│  │  Prometheus │◄────────►│   Grafana   │                      │
│  │  Metrics    │          │  Dashboards │                      │
│  └─────────────┘          └─────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow — Rate Limit Check

```
Client Request
      │
      ▼
1. Client sends API key + identifier to POST /api/rate-limit/check
      │
      ▼
2. Server looks up API key in PostgreSQL
   → Validates key exists, is ACTIVE, not expired
   → Loads associated Policy (algorithm, maxRequests, windowMs)
      │
      ▼
3. Server instantiates the correct algorithm via Orchestrator
      │
      ▼
4. Algorithm executes atomic Lua script against Redis
   → Reads current counter/token/queue state
   → Checks if request is within limit
   → If yes: increments counter / consumes token
   → If no: returns blocked status with retry-after
      │
      ▼
5. Response sent with rate limit headers:
   X-RateLimit-Limit: 5
   X-RateLimit-Remaining: 2
   X-RateLimit-Reset: 1706745600000
   X-RateLimit-Algorithm: SLIDING_WINDOW
      │
      ▼
6. Analytics logged asynchronously (fire-and-forget to Redis)
   WebSocket event broadcast to dashboard subscribers
```

### Fail-Open Behavior

If Redis is unreachable, the rate limiter **allows all requests** (fail-open) by default. This ensures your application stays up even if the rate limiting infrastructure has issues. Each failure is logged with full context for debugging.

---

## 🧮 Rate Limiting Algorithms

FlowShield implements 5 industry-standard rate limiting algorithms. Each has different trade-offs between accuracy, memory usage, and performance.

### 1. Fixed Window

**How it works:** Divides time into fixed intervals (e.g., per minute). Each interval has a counter that resets when the window expires.

```
Window 1 (0s - 60s)         Window 2 (60s - 120s)
┌────────────────────┐       ┌────────────────────┐
│  Req 1 ✓  Req 2 ✓  │       │  Req 1 ✓  Req 2 ✓  │
│  Req 3 ✓  Req 4 ✗  │       │  Req 3 ✓           │
│  (4 req total)     │       │  (3 req total)      │
└────────────────────┘       └────────────────────┘
      ↑                              ↑
  Limit: 3 req                  Counter resets
```

| Aspect | Rating |
|--------|--------|
| **Accuracy** | 🟡 Good — but allows 2x traffic at window boundaries |
| **Memory** | 🟢 1 counter per key |
| **Performance** | 🟢 Fastest (simple INCR + PEXPIRE) |
| **Use Case** | Simple rate limiting where boundary spikes are acceptable |

```json
// Example response
{
  "allowed": true,
  "remaining": 2,
  "total": 100,
  "resetAt": 1706745600000,
  "algorithm": "FIXED_WINDOW"
}
```

### 2. Sliding Window Counter

**How it works:** Hybrid approach combining current + previous window counters with weighted interpolation. Accuracy ≈ 99%.

```
Now
 ├─────────────────────────────────────┤
 ←── Previous Window ──→←─ Current ──→
                         ↑
                    elapsed time
weighted_count = prev_count × (1 - elapsed/window) + current_count
```

| Aspect | Rating |
|--------|--------|
| **Accuracy** | 🟢 ~99% accurate, slight approximation |
| **Memory** | 🟢 2 counters per key (current + previous) |
| **Performance** | 🟢 Very fast, 12.8k RPS |
| **Use Case** | Best balance of accuracy, memory, and speed |

**Note:** You may see 1 extra request pass through at window boundaries due to interpolation. This is expected behavior — if you need strict exact enforcement, use Sliding Log.

### 3. Sliding Log

**How it works:** Stores timestamps of every request in a sorted set. Counts exact number of requests in the last N milliseconds. Most accurate algorithm.

```
Timeline: 0s──────1s──────2s──────3s──────4s──────5s
Requests:   ✓       ✓                       ✓       ✓
                          ↑
                    Current window (last 5s) = 3 requests
```

| Aspect | Rating |
|--------|--------|
| **Accuracy** | 🟢 Perfect — exactly N requests per window |
| **Memory** | 🔴 Stores every request timestamp |
| **Performance** | 🟢 Fast, O(log N) per request |
| **Use Case** | When precision matters (billing, compliance) |

### 4. Token Bucket

**How it works:** Maintains a bucket of tokens that refill at a constant rate. Each request consumes 1 token. If no tokens remain, the request is blocked.

```
  ┌──────────────────────────┐
  │        BUCKET            │  ← Tokens refill at steady rate
  │  ●  ●  ●                │
  │  ●  ●  ●                │     (e.g., 5 tokens / 10s)
  │                          │
  └──────────────────────────┘
   ↑                      ↑
  Empty                 Capacity (5)

  Burst: All 5 tokens consumed instantly → 5 rapid requests allowed
  Steady: 1 token refills every 2 seconds → sustained rate of 30 req/min
```

| Aspect | Rating |
|--------|--------|
| **Burst Handling** | 🟢 Excellent — absorbs traffic spikes up to capacity |
| **Memory** | 🟢 2 hash fields per key |
| **Performance** | 🟢 Fastest! 17.8k RPS |
| **Use Case** | APIs with variable traffic (most common choice) |

Used by: **AWS, Stripe, GitHub** — the industry standard.

### 5. Leaky Bucket

**How it works:** Requests are queued and processed at a constant rate. If the queue is full, new requests are rejected. Smoothes traffic to a uniform output rate.

```
Incoming requests (bursty)
         │
         ▼
  ┌─────────────────┐
  │     QUEUE       │  ← Requests wait in line
  │ [R1] [R2] [R3]  │
  │   (capacity=3)  │
  └────────┬────────┘
           │
           ▼
  Outgoing (constant rate: 3 req / 10s)
```

| Aspect | Rating |
|--------|--------|
| **Burst Handling** | 🟢 Smoothes bursts, constant output rate |
| **Memory** | 🟢 2 hash fields per key |
| **Performance** | 🟢 Very fast, 16.3k RPS |
| **Use Case** | Database write paths, queue processing, video encoding |

### Algorithm Selection Guide

| If you need... | Choose... |
|----------------|-----------|
| Simplicity + speed | **Fixed Window** |
| Best balance | **Sliding Window Counter** |
| Exact precision | **Sliding Log** |
| Handle traffic bursts | **Token Bucket** |
| Constant processing rate | **Leaky Bucket** |

---

## 📦 Project Structure

```
flowshield/
├── packages/
│   ├── backend/                   # Express API server
│   │   ├── src/
│   │   │   ├── auth/              # JWT auth, middleware, validation
│   │   │   ├── config/            # App config, database, Redis, logger
│   │   │   ├── rate-limiter/      # Core rate limiting engine
│   │   │   │   ├── algorithms/    # 5 algorithm implementations
│   │   │   │   │   ├── fixed-window.ts
│   │   │   │   │   ├── sliding-window.ts
│   │   │   │   │   ├── sliding-log.ts
│   │   │   │   │   ├── token-bucket.ts
│   │   │   │   │   └── leaky-bucket.ts
│   │   │   │   ├── base.ts        # Abstract base class
│   │   │   │   ├── orchestrator.ts # Routes requests to correct algorithm
│   │   │   │   ├── keys.ts        # Redis key naming conventions
│   │   │   │   ├── scripts.ts     # Atomic Lua scripts
│   │   │   │   └── index.ts
│   │   │   ├── routes/            # API endpoints
│   │   │   ├── websocket/         # Socket.IO live metrics
│   │   │   ├── types/             # TypeScript types
│   │   │   └── __tests__/         # Unit & integration tests
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Database schema
│   │   │   └── seed.ts            # Sample data seeder
│   │   ├── docker-compose.yml
│   │   └── Dockerfile
│   │
│   ├── frontend/                  # React dashboard
│   │   ├── src/
│   │   │   ├── components/        # Reusable UI components
│   │   │   ├── contexts/          # React contexts (auth, etc.)
│   │   │   ├── lib/               # API client, WebSocket, types
│   │   │   └── pages/             # Route pages
│   │   └── ...
│   │
│   └── sdk/                       # Client SDK
│       ├── src/
│       │   ├── client.ts          # HTTP client
│       │   ├── middleware.ts       # Express middleware
│       │   ├── local.ts           # Local Redis mode
│       │   └── types.ts
│       └── ...
│
├── docker-compose.yml             # Full stack orchestration
├── Dockerfile                     # API Docker image
├── nginx.conf                     # Reverse proxy config
├── prometheus.yml                 # Metrics scraping config
└── README.md                      # You are here
```

---

## 📊 Performance Benchmarks

Results from load testing with **100 concurrent users × 15 requests each** (1,500 total requests per algorithm):

```
Algorithm         Total   Allowed   Blocked   Block%     RPS     Avg Lat   P95 Lat
──────────────────────────────────────────────────────────────────────────────────
Token Bucket      1500     500       1000      67%     17,857     5ms       13ms
Leaky Bucket      1500     500       1000      67%     16,304     6ms       17ms
Sliding Window    1500     500       1000      67%     12,821     8ms       21ms
Sliding Log       1500     500       1000      67%     11,719     8ms       23ms
Fixed Window      1500     500       1000      67%      4,011     23ms       68ms
```

**Key takeaways:**
- All algorithms correctly enforce rate limits (exactly 67% blocked = 5/15 ratio)
- **Token Bucket** is the fastest algorithm at **17,857 requests/second**
- Redis uses only **~2-3MB** during peak load — highly memory efficient
- Fixed Window is slower due to additional debug logging (easily optimized)

**Hardware used for benchmarks:** Local development machine, Docker Redis 7, Node.js 20.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ ([download](https://nodejs.org/))
- **Docker** & **Docker Compose** ([install](https://docs.docker.com/get-docker/))
- **npm** (comes with Node.js)
- **Git** ([download](https://git-scm.com/))

### Step 1: Clone & Install Dependencies

```bash
# Clone the repository
git clone https://github.com/yourusername/flowshield.git
cd flowshield

# Install ALL dependencies (root + backend + frontend + sdk)
npm install
cd packages/backend && npm install
cd ../frontend && npm install
cd ../sdk && npm install
cd ../..
```

### Step 2: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your settings (defaults work for local development)
```

Default `.env` values:

```
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://flowshield:flowshield_password@localhost:5432/flowshield
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-super-secret-key-change-in-production
CORS_ORIGIN=http://localhost:5173
```

### Step 3: Start Infrastructure with Docker

```bash
docker-compose up -d
```

This starts 5 services:

| Service | Container Name | Port | Purpose |
|---------|---------------|------|---------|
| **PostgreSQL 16** | flowshield-postgres | 5432 | User/project/key metadata |
| **Redis 7** | flowshield-redis | 6379 | In-memory rate limit counters |
| **Prometheus** | flowshield-prometheus | 9090 | Metrics collection |
| **Grafana** | flowshield-grafana | 3002 | Visualization dashboards |
| **Nginx** | flowshield-nginx | 80 | Reverse proxy |

Verify they're running:

```bash
docker ps
# You should see all 5 containers with "Up" status
```

### Step 4: Run Database Migrations

```bash
cd packages/backend
npx prisma migrate dev
npm run db:seed    # Creates sample data
```

The seed script creates:
- A demo admin user (admin@flowshield.dev / password123)
- A sample project with pre-configured API keys
- Example rate limit policies for each algorithm

### Step 5: Start Development Servers

```bash
# From the project root, start both backend and frontend:
cd packages/backend && npm run dev &
cd packages/frontend && npm run dev &

# Or use the root package script (if configured):
npm run dev
```

### Step 6: Verify Everything Works

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-07-03T16:00:00.000Z",
  "uptime": 12.34,
  "services": {
    "redis": "connected"
  }
}

# API documentation
open http://localhost:3000/api/docs   # Swagger UI
```

### Access All Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **API Server** | http://localhost:3000 | — |
| **Swagger Docs** | http://localhost:3000/api/docs | — |
| **Dashboard** | http://localhost:5173 | admin@flowshield.dev / password123 |
| **Grafana** | http://localhost:3002 | admin / admin |
| **Prometheus** | http://localhost:9090 | — |

---

## 🔌 SDK Usage

FlowShield provides a Node.js SDK that makes it easy to integrate rate limiting into your application.

### Installation

```bash
npm install @flowshield/sdk
```

### Cloud Mode (recommended)

Rate limit checks go through the FlowShield API. Requires an API key from the dashboard.

```typescript
import { FlowShield } from '@flowshield/sdk';
import express from 'express';

const app = express();
const shield = new FlowShield({
  apiKey: 'fs_your_api_key_here',     // From FlowShield dashboard
  endpoint: 'https://api.flowshield.dev', // Or http://localhost:3000 for self-hosted
  timeout: 500,                          // Optional: request timeout in ms
});

// Apply rate limiting to ALL routes
app.use(shield.middleware());

// Or apply to a specific route
app.get('/api/users',
  shield.middleware({ identifier: (req) => req.ip }),
  (req, res) => {
    res.json({ users: [...] });
  }
);

// Custom identifier (e.g., by user ID for authenticated routes)
app.get('/api/profile',
  shield.middleware({
    identifier: (req) => req.user?.id || req.ip,
    // Rate limit headers are set automatically (can disable)
    headers: true,
  }),
  (req, res) => {
    res.json({ profile: req.user });
  }
);

// Skip rate limiting for certain routes
app.get('/health',
  shield.middleware({ skip: () => true }),
  (req, res) => res.json({ status: 'ok' })
);
```

### Local Mode (direct Redis connection)

Rate limit checks go directly to Redis — no API dependency. Useful for self-hosted deployments.

```typescript
import { FlowShield } from '@flowshield/sdk';
import { algorithms } from '@flowshield/sdk';

const shield = new FlowShield({
  mode: 'local',
  redis: {
    host: 'localhost',
    port: 6379,
    password: 'optional',
  },
  // Choose your algorithm
  algorithm: algorithms.tokenBucket({
    capacity: 10,      // Max burst size
    refillRate: 2,     // Tokens per interval
  }),
  keyPrefix: 'flowshield',  // Optional: namespace your Redis keys
});

app.use(shield.middleware());
```

### Available Algorithm Configurations

```typescript
// Fixed Window
algorithms.fixedWindow({ maxRequests: 100, windowMs: 60000 })

// Sliding Window Counter
algorithms.slidingWindow({ maxRequests: 100, windowMs: 60000 })

// Sliding Log (exact)
algorithms.slidingLog({ maxRequests: 100, windowMs: 60000 })

// Token Bucket
algorithms.tokenBucket({ capacity: 10, refillRate: 2, intervalMs: 1000 })

// Leaky Bucket
algorithms.leakyBucket({ capacity: 10, leakRate: 2, intervalMs: 1000 })
```

### Response Headers

When a request is rate limited, the SDK sets these response headers:

```
X-RateLimit-Limit: 5          # Max requests allowed
X-RateLimit-Remaining: 0      # Requests remaining in window
X-RateLimit-Reset: 1706745600 # Timestamp when limit resets
X-RateLimit-Algorithm: TOKEN_BUCKET  # Algorithm used
Retry-After: 3                # Seconds to wait (when blocked, HTTP 429)
```

When the limit is exceeded, the SDK returns **HTTP 429 Too Many Requests**:

```json
{
  "error": "Rate limit exceeded",
  "retryAfter": 3
}
```

---

## 📖 API Reference

### Authentication Endpoints

#### Register a new user

```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response** `201 Created`:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "MEMBER"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

#### Login

```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response** `200 OK`:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci...",
    "user": {
      "id": "clx...",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "MEMBER"
    }
  }
}
```

**Note:** The `accessToken` expires in 7 days by default. Use the `refreshToken` to get a new one without re-authentication.

#### Refresh Token

```bash
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGci..."
}
```

#### Logout

```bash
POST /api/auth/logout
Content-Type: application/json
Authorization: Bearer <accessToken>

{
  "refreshToken": "eyJhbGci..."
}
```

### Project Endpoints

All project endpoints require authentication (Bearer token).

#### List Projects

```bash
GET /api/projects
Authorization: Bearer <accessToken>
```

#### Create Project

```bash
POST /api/projects
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "My Production API",
  "description": "Rate limiting for my main API"
}
```

**Response** `201 Created`:
```json
{
  "success": true,
  "data": {
    "id": "proj_abc123",
    "name": "My Production API",
    "description": "Rate limiting for my main API",
    "plan": "FREE",
    "ownerId": "clx...",
    "createdAt": "2026-07-03T16:00:00.000Z"
  }
}
```

**Note:** Each project can have up to 20 API keys (FREE plan limit).

#### Get Project

```bash
GET /api/projects/:projectId
Authorization: Bearer <accessToken>
```

### API Key Endpoints

These manage the API keys that external services use to check rate limits.

#### List API Keys

```bash
GET /api/projects/:projectId/keys
Authorization: Bearer <accessToken>
```

Keys are masked in responses for security: `fs_a8ZJ_x...rcnq`

#### Create API Key

```bash
POST /api/projects/:projectId/keys
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "name": "Production Key",
  "algorithm": "TOKEN_BUCKET",      # Algorithm to use
  "maxRequests": 100,                # Max requests per window
  "windowMs": 60000,                 # Window duration in ms
  "burstCapacity": 150,              # Token/Leaky bucket burst (optional)
  "refillRate": 100                  # Token/Leaky bucket refill rate (optional)
}
```

**Algorithm options:** `FIXED_WINDOW`, `SLIDING_WINDOW`, `SLIDING_LOG`, `TOKEN_BUCKET`, `LEAKY_BUCKET`

**Response** `201 Created` — The full key is only shown once:

```json
{
  "success": true,
  "data": {
    "id": "key_abc123",
    "key": "fs_a8ZJ_xgpae0VqdLsuNjyeY6EszBjrcnq",
    "name": "Production Key",
    "_warning": "Save this key now. It will not be shown again."
  }
}
```

#### Rotate API Key

Generates a new key value while preserving the same rate limit policy. The old key is immediately revoked.

```bash
POST /api/projects/:projectId/keys/:keyId/rotate
Authorization: Bearer <accessToken>
```

**Use when:** You suspect a key may have been compromised, or as part of regular credential rotation.

#### Revoke API Key

Permanently disables an API key. The key remains in the database for audit purposes but all requests using it will be rejected.

```bash
DELETE /api/projects/:projectId/keys/:keyId
Authorization: Bearer <accessToken>
```

**Use when:** A key is definitely compromised, a team member leaves, or a service is decommissioned.

#### Update Key Policy

Change the rate limit configuration for an existing key without generating a new one.

```bash
PATCH /api/projects/:projectId/keys/:keyId
Authorization: Bearer <accessToken>
Content-Type: application/json

{
  "algorithm": "SLIDING_LOG",
  "maxRequests": 50,
  "windowMs": 60000
}
```

### Rate Limit Check Endpoint

This is the **core endpoint** — called by your services to check if a request is allowed.

```bash
POST /api/rate-limit/check
Content-Type: application/json

{
  "key": "fs_your_api_key",
  "identifier": "user-id-or-ip-address"
}
```

**The `identifier` field is critical.** It determines who/what is being rate limited:
- Use **IP address** for unauthenticated endpoints
- Use **user ID** for authenticated endpoints
- Use **session ID** for anonymous sessions
- Each unique identifier gets its own counter

**Response** `200 OK` (allowed):
```json
{
  "success": true,
  "data": {
    "allowed": true,
    "remaining": 4,
    "total": 5,
    "resetAt": 1783073768000,
    "algorithm": "SLIDING_WINDOW"
  }
}
```

**Response** `429 Too Many Requests` (blocked):
```json
{
  "success": false,
  "data": {
    "allowed": false,
    "remaining": 0,
    "total": 5,
    "resetAt": 1783073768000,
    "retryAfter": 3,
    "algorithm": "SLIDING_WINDOW"
  }
}
```

**Response headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1783073768000
X-RateLimit-Algorithm: SLIDING_WINDOW
Retry-After: 3
```

### Analytics Endpoints

#### Get Project Analytics

```bash
GET /api/analytics/:projectId?from=2026-01-01&to=2026-07-03
Authorization: Bearer <accessToken>
```

#### Get Request Logs

```bash
GET /api/analytics/:projectId/logs?page=1&limit=50
Authorization: Bearer <accessToken>
```

#### Get Real-Time Metrics

```bash
GET /api/analytics/:projectId/realtime
Authorization: Bearer <accessToken>
```

### Audit Log Endpoints

```bash
# List audit events
GET /api/audit?page=1&limit=50
Authorization: Bearer <accessToken>
```

Tracks all security-relevant events: login, logout, API key creation, rotation, revocation, policy changes.

---

## 💻 Frontend Dashboard

The React dashboard provides a visual interface for managing your rate limiting infrastructure.

### Pages

| Page | Route | Description |
|------|-------|-------------|
| **Dashboard** | `/dashboard` | Overview: total requests, active keys, top algorithms, live RPS |
| **Projects** | `/projects` | List and manage your projects |
| **Project Detail** | `/projects/:id` | View & manage API keys, create/rotate/revoke keys |
| **Analytics** | `/analytics/:projectId` | Charts: request volume, block rate, latency trends |
| **Settings** | `/settings` | Account settings, profile management |
| **Login** | `/login` | JWT-based authentication |
| **Register** | `/register` | New user registration |

### Dashboard Features

- **Live metrics** via WebSocket — watch rate limit events in real time
- **Algorithm comparison** — see how each algorithm handles traffic
- **Key management** — create, rotate, and revoke with one click
- **Policy configuration** — choose algorithm and set limits per key
- **Audit trail** — see who did what and when

### WebSocket Events

The dashboard subscribes to real-time events from the backend:

```typescript
// Client connects to WebSocket
const socket = io('http://localhost:3000', { path: '/ws' });

// Subscribe to a project's metrics
socket.emit('subscribe', 'proj_abc123');

// Receive live metrics
socket.on('metrics', (data) => {
  console.log('Live metrics:', data);
  // {
  //   projectId: 'proj_abc123',
  //   timestamp: 1783073768000,
  //   totalRequests: 150,
  //   allowedRequests: 100,
  //   blockedRequests: 50,
  //   currentRPS: 25
  // }
});

// Receive individual rate limit events
socket.on('rate-limit', (event) => {
  console.log('Rate limit event:', event);
  // {
  //   projectId: 'proj_abc123',
  //   timestamp: 1783073768000,
  //   identifier: 'user-123',
  //   allowed: false,
  //   algorithm: 'TOKEN_BUCKET'
  // }
});
```

---

## 🧪 Testing

### Running Tests

```bash
# Unit tests (with coverage)
cd packages/backend
npm test

# Integration tests (requires Docker Redis running)
npm run test:integration

# Run all tests
npm test

# Watch mode (during development)
npx jest --watch
```

### Test Structure

```
src/__tests__/
├── auth.test.ts                   # Authentication & authorization tests
├── rate-limiter.test.ts           # Unit tests with mocked Redis
├── algorithms-integration.runner.ts  # Real Redis integration tests
└── load-test.runner.ts            # Concurrent load tests
```

### Integration Test Results (sample)

```
✅ PASS — Fixed Window     (3/3 allowed, 4th blocked)
✅ PASS — Sliding Window   (3/3 allowed, 4th blocked)
✅ PASS — Sliding Log      (3/3 allowed, 4th blocked — exact!)
✅ PASS — Token Bucket     (Burst 3/3, blocked at 4, refill works)
✅ PASS — Leaky Bucket     (Queue 3/3, blocked at 4, leak works)
```

### Testing with PowerShell (Windows)

```powershell
# Test a single rate limit check
$body = @{
    key = "fs_your_api_key"
    identifier = "test-user"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://localhost:3000/api/rate-limit/check `
  -Method Post -Body $body -ContentType "application/json"

# Test rate limiting (6 rapid requests)
$body = @{ key = "fs_your_api_key"; identifier = "stress-test-1" } | ConvertTo-Json
for ($i = 1; $i -le 6; $i++) {
    Write-Host "--- Request $i ---"
    try {
        $r = Invoke-RestMethod -Uri http://localhost:3000/api/rate-limit/check `
          -Method Post -Body $body -ContentType "application/json"
        Write-Host "Allowed | Remaining: $($r.data.remaining)/$($r.data.total)"
    } catch {
        Write-Host "RATE LIMITED (429)!" -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 300
}
```

### Testing with curl (Linux/Mac/WSL)

```bash
# Single check
curl -X POST http://localhost:3000/api/rate-limit/check \
  -H "Content-Type: application/json" \
  -d '{"key":"fs_your_api_key","identifier":"test-user-1"}'

# Rapid 6 requests
for i in {1..6}; do
  echo "--- Request $i ---"
  curl -s -X POST http://localhost:3000/api/rate-limit/check \
    -H "Content-Type: application/json" \
    -d '{"key":"fs_your_api_key","identifier":"stress-test-1"}'
  echo ""
  sleep 0.3
done
```

---

## 🐳 Deployment

### Docker Deployment (Production)

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Production Considerations

#### Environment Variables

```bash
# Critical: Change these secrets
JWT_SECRET=<random-64-char-string>
JWT_REFRESH_SECRET=<random-64-char-string>

# Database: Use managed PostgreSQL
DATABASE_URL=postgresql://user:password@your-rds-host:5432/flowshield

# Redis: Use managed Redis (Upstash, ElastiCache, Redis Cloud)
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# CORS: Your frontend domain
CORS_ORIGIN=https://dashboard.yourdomain.com
```

#### Recommended Architecture (AWS)

```
                    ┌─────────────────┐
                    │   CloudFront     │
                    │   (CDN)          │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │    ALB          │
                    │  (Load Balancer) │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
       │  ECS Fargate │ │  ECS     │ │  ECS        │
       │  (API v1)    │ │  (v2)    │ │  (v3)       │
       └──────┬──────┘ └────┬─────┘ └──────┬──────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
              ┌──────────────▼──────────────┐
              │      ElastiCache (Redis)     │
              │      Cluster Mode Enabled   │
              └─────────────────────────────┘
```

#### Scaling Tips

1. **Redis cluster** — Use ElastiCache or Redis Enterprise for sharding
2. **Horizontal scaling** — API servers are stateless; scale behind a load balancer
3. **Database** — Use RDS with read replicas for analytics queries
4. **Rate limit key design** — Keys are scoped `fs:{project}:{identifier}:{algo}`, so Redis is automatically sharded
5. **Fail-open timeout** — Configure Redis connection timeout to fail fast (default: 1s)

---

## 📈 Monitoring & Observability

### Prometheus Metrics

FlowShield exposes metrics at `/metrics` (when using `prom-client`):

| Metric | Type | Description |
|--------|------|-------------|
| `flowshield_requests_total` | Counter | Total requests by project, algorithm, status |
| `flowshield_requests_duration_ms` | Histogram | Request latency distribution |
| `flowshield_active_api_keys` | Gauge | Active keys per project |
| `flowshield_redis_latency_ms` | Gauge | Redis operation latency |

### Grafana Dashboards

Pre-configured Grafana is included in docker-compose. Access at http://localhost:3002 (admin/admin).

Default dashboards include:
- **Rate Limiting Overview** — RPS, block rate, active keys
- **Algorithm Performance** — Latency comparison across algorithms
- **Redis Health** — Memory, connections, command rate
- **System Resources** — CPU, memory, disk

### Health Check

```bash
GET /health
```

```json
{
  "status": "healthy",
  "timestamp": "2026-07-03T16:00:00.000Z",
  "uptime": 12345.67,
  "services": {
    "redis": "connected",
    "database": "connected"
  }
}
```

### Logging

Structured JSON logging via Winston with daily rotation:

```json
{
  "level": "info",
  "message": "Rate limit result",
  "service": "flowshield",
  "scopedKey": "proj_abc123:user-456",
  "result": {
    "allowed": true,
    "remaining": 4,
    "total": 5
  }
}
```

Logs are stored in `packages/backend/logs/` and rotated daily.

---

## 🔒 Authentication & Security

### Security Architecture

```
Password → bcrypt (12 rounds) → Hash stored in DB
                                │
Login → Validate password → Generate JWT (access + refresh)
                                │
                                ├── Access Token (7d expiry)
                                │    └── Sent as: Authorization: Bearer <token>
                                │
                                └── Refresh Token (30d expiry)
                                     └── Stored in DB, can be revoked
```

### JWT Token Format

```json
{
  "id": "clx...",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "MEMBER",
  "iat": 1706745600,
  "exp": 1707350400
}
```

### RBAC Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: create/manage projects, keys, team members, billing |
| **Member** | Can create/manage projects and keys within their owned projects |
| **Viewer** | Read-only access to dashboards and analytics |

### API Key Security

- Keys are prefixed with `fs_` for easy identification
- Full key is only shown **once** at creation time
- Listed keys are masked: `fs_a8ZJ_x...rcnq`
- Keys can be **rotated** (new value, same policy) or **revoked** (permanently disabled)
- All key operations are logged to the audit trail
- Maximum 20 keys per project (FREE plan)

---

## 🛠️ Troubleshooting

### "Cannot connect to Redis"

**Symptoms:**
```
Error: Redis connection refused at localhost:6379
Health check returns: { "status": "degraded", "services": { "redis": "disconnected" } }
```

**Solutions:**
1. Check Docker is running: `docker ps`
2. Start Redis container: `docker-compose up -d redis`
3. Verify Redis port: `docker port flowshield-redis 6379`
4. Check Redis logs: `docker logs flowshield-redis`

### "API key not found" or "Invalid API key"

**Causes:**
- The key doesn't exist in the database
- The key was revoked
- The key has expired

**Verify:**
1. Run the seed script: `cd packages/backend && npm run db:seed`
2. Check the API key status in the dashboard
3. Generate a new key via `POST /api/projects/:id/keys`

### "All requests are being allowed"

**Causes:**
- Redis is down (fail-open = allow all)
- The API key has no policy configured
- The limit is set very high

**Check:**
1. Verify Redis is running: `docker ps | grep redis`
2. Check server logs: `packages/backend/logs/*.log`
3. Verify the API key's policy in the database

### "Rate limiting is too strict"

**Solutions:**
1. Increase `maxRequests` or `windowMs` via `PATCH /api/projects/:id/keys/:keyId`
2. Switch to Token Bucket algorithm for burst-friendly behavior
3. Use a more granular identifier (user ID instead of IP for shared IPs)

### Windows-Specific Issues

**PowerShell curl doesn't work:**
- Use `curl.exe` instead of `curl` (PowerShell alias for Invoke-WebRequest)
- Or use `Invoke-RestMethod` with PowerShell syntax

**Path separator issues:**
- Use forward slashes `/` in npm scripts
- Use `cd /d D:\path` for directory changes in cmd

---

## 🗺️ Roadmap

### v1.1 — Geographic Rate Limiting
- [ ] GeoIP-based rate limiting rules
- [ ] Per-region rate limit configuration
- [ ] CDN-aware rate limiting headers

### v1.2 — ML-Based Adaptive Rate Limiting
- [ ] Anomaly detection using request patterns
- [ ] Automatic rate limit adjustment based on traffic profiles
- [ ] Behavioral analysis for DDoS mitigation

### v1.3 — Webhook Notifications
- [ ] Slack/Discord webhooks for rate limit events
- [ ] Email alerts for abuse detection
- [ ] Custom webhook endpoints

### v2.0 — Multi-Region Support
- [ ] Global rate limit synchronization across regions
- [ ] Active-passive Redis replication
- [ ] Cross-region analytics aggregation

### v2.1 — Custom Algorithm Support
- [ ] User-defined Lua scripts for custom algorithms
- [ ] Algorithm marketplace
- [ ] A/B testing for algorithm selection

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** and ensure tests pass
4. **Commit** your changes: `git commit -m 'Add amazing feature'`
5. **Push** to your branch: `git push origin feature/amazing-feature`
6. **Open a Pull Request**

### Development Guidelines

- **TypeScript** — All new code must be in TypeScript
- **Tests** — Add tests for new features (unit + integration)
- **Lua scripts** — Rate limiting Lua scripts must be atomic
- **Error handling** — Always handle Redis failures gracefully
- **Logging** — Use structured logging with appropriate levels
- **Documentation** — Update README and Swagger docs as needed

### Code Style

```bash
# Lint
cd packages/backend && npm run lint

# Format (Prettier)
npx prettier --write .

# Type checking
npx tsc --noEmit
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built with ❤️ by Vijay Bisht</strong><br>
  <em>A production-grade distributed system showcasing modern backend architecture.</em>
</p>

<p align="center">
  <a href="#-table-of-contents">Back to top ↑</a>
</p>
