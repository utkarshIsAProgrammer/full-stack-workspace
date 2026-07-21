# Orbit Backend

A full-featured social media backend API built with **Express 5 + TypeScript + MongoDB + Redis**.

This backend powers a modern social platform with features including posts, comments, likes, follows, real-time chat, stories (glimpses), audio rooms, communities, notifications, and more.

---

## Quick Start

```bash
# Install dependencies
cd projects/orbit/server
npm install

# Set up environment
cp .env.example .env
# Edit .env with your MongoDB URI, Redis URL, Cloudinary keys, SMTP config

# Run development server
npm run dev

# Build for production
npm run build
npm start
```

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key for JWT tokens |
| `CLIENT_URL` | Frontend URL (for CORS) |
| `CLOUDINARY_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `SMTP_HOST` | SMTP server host |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload (tsx --watch) |
| `npm run build` | Compile TypeScript to dist/ |
| `npm start` | Start production server (node dist/server.js) |
| `npm test` | Run test suite |
| `npm run typecheck` | TypeScript type checking |
| `npm run seed:test-user` | Seed a test user |

## Deployment

### Render (Node, not Docker)

1. Push to GitHub
2. Connect repo in Render dashboard → "New +" → "Blueprint"
3. Set environment variables (MONGO_URI, JWT_SECRET, etc.)
4. Deploy

**Build command**: `npm install && npm run build`
**Start command**: `node dist/server.js`

### Manual

```bash
npm run build
NODE_ENV=production node dist/server.js
```

Cluster mode activates automatically in production (2 workers by default).

---

## Project Structure

```
src/
├── server.ts              # Entry point + HTTP server setup
├── configs/               # App configuration
│   ├── env.ts             # Environment validation (Zod)
│   ├── cache.ts           # Redis caching layer
│   ├── redis.ts           # Redis client (Upstash HTTP + ioredis)
│   ├── socket.ts          # Socket.IO initialization
│   ├── cookie.ts          # Cookie configuration
│   ├── cloudinary.ts      # Image hosting
│   ├── imagekit.ts        # ImageKit SDK
│   ├── sentry.ts          # Error monitoring
│   ├── swagger.ts         # API docs
│   └── scheduler.ts       # Cron jobs (affinity, notification pruner)
├── controllers/           # Route handlers (44 files)
├── routes/                # Express routers
├── models/                # Mongoose schemas
├── services/              # Business logic
│   ├── feedService.ts     # Ranked feed algorithm
│   ├── affinityService.ts # User affinity scoring
│   ├── xpService.ts       # XP/gamification
│   └── pushService.ts     # Push notifications
├── middlewares/           # Express middleware
│   ├── auth.middleware.ts # JWT authentication
│   ├── ratelimit.middleware.ts
│   └── csrf.middleware.ts
├── schemas/               # Zod validation schemas
├── utilities/             # Helpers
│   ├── errors.ts          # Error classes
│   ├── logger.ts          # Winston logger
│   ├── notification.ts    # Notification creation
│   └── postStatus.ts      # Post enrichment
├── types/                 # TypeScript types
└── __tests__/             # Jest test suites
```
