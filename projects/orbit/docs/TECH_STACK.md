# Orbit Backend — Technology Stack

## Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 20+ (LTS) | JavaScript runtime |
| **TypeScript** | 5.3+ | Type safety |
| **tsx** | 4.21+ | Dev server with hot reload |

## Framework & HTTP

| Package | Purpose |
|---------|---------|
| **Express 5** | HTTP framework, routing, middleware |
| **http** | Native Node HTTP server |
| **compression** | Gzip/Brotli response compression |
| **cookie-parser** | Cookie parsing for JWT auth |
| **cors** | Cross-origin resource sharing |
| **helmet** | Security headers (CSP, HSTS, XSS) |

## Database

| Package | Purpose |
|---------|---------|
| **Mongoose 9** | MongoDB ODM with schema validation |
| **MongoDB Atlas** | Cloud MongoDB (primary database) |

## Caching & Rate Limiting

| Package | Purpose |
|---------|---------|
| **@upstash/redis** | HTTP-based Redis client (caching) |
| **ioredis** | TCP Redis client (Socket.IO adapter) |
| **@upstash/ratelimit** | Serverless rate limiting |
| **@socket.io/redis-adapter** | Multi-instance Socket.IO support |

## Authentication & Security

| Package | Purpose |
|---------|---------|
| **jsonwebtoken** | JWT token generation & verification |
| **bcryptjs** | Password hashing |
| **sanitize-html** | XSS prevention |
| **zod** | Request validation schemas |
| **csurf/csrf** | CSRF double-submit cookie protection |

## Real-Time

| Package | Purpose |
|---------|---------|
| **Socket.IO 4** | WebSocket + fallback transport |
| **socket.io-client** | Client-side Socket.IO (for tests) |

## Media

| Package | Purpose |
|---------|---------|
| **cloudinary** | Image/video upload, storage, transformations |
| **@imagekit/nodejs** | Image optimization CDN |
| **multer** | Multipart file upload parsing |

## Communication

| Package | Purpose |
|---------|---------|
| **nodemailer** | Email sending (SMTP) |
| **web-push** | Browser push notifications (VAPID) |

## Monitoring & Error Tracking

| Package | Purpose |
|---------|---------|
| **@sentry/node** | Error tracking & performance monitoring |
| **@sentry/profiling-node** | CPU profiling |
| **winston** | Structured logging |
| **winston-daily-rotate-file** | Log rotation |

## Documentation

| Package | Purpose |
|---------|---------|
| **swagger-jsdoc** | OpenAPI spec generation |
| **swagger-ui-express** | Swagger UI endpoint |

## Scheduling

| Package | Purpose |
|---------|---------|
| **node-cron** | Cron jobs (affinity scheduler, notification pruner) |

## Testing

| Package | Purpose |
|---------|---------|
| **Jest 30** | Test runner |
| **ts-jest** | TypeScript compilation for tests |
| **supertest** | HTTP integration testing |
| **mongodb-memory-server** | In-memory MongoDB for tests |

## Development Tools

| Tool | Purpose |
|------|---------|
| **tsx** | TypeScript execution with watch mode |
| **tsc** | TypeScript compiler |
| **nodemon** | (Not used — tsx --watch handles this) |

## DevOps / Deployment

| Tool | Purpose |
|------|---------|
| **Render** | Cloud deployment (Node environment) |
| **npm** | Package manager |
| **GitHub** | Source control |

## Architecture Pattern

```
Layer          │ Technology                │ Responsibility
───────────────┼───────────────────────────┼─────────────────────
Routes         │ Express Router           │ URL → Controller mapping
Controllers    │ Express Request Handler   │ Request parsing, response formatting
Services       │ Pure TypeScript classes   │ Business logic, complex queries
Models         │ Mongoose Schema/Model     │ Database interaction, indexes
Middlewares    │ Express middleware         │ Auth, rate limiting, CSRF
Configs        │ Singleton modules         │ Redis, MongoDB, Socket.IO, env
Utilities      │ Helper functions           │ Notifications, errors, logging
Schemas        │ Zod objects               │ Request validation
Types          │ TypeScript types          │ Type declarations, interfaces

Dependency flow: Routes → Controllers → Services → Models
                              ↓
                         Middlewares (auth, etc.)
```

## Environment Variables

```
NODE_ENV          = development | production | test
PORT              = 5006
MONGO_URI         = mongodb+srv://...
JWT_SECRET        = your-256-bit-secret
CLIENT_URL        = http://localhost:5173

# Redis (Upstash)
UPSTASH_REDIS_REST_URL   = https://...upstash.io
UPSTASH_REDIS_REST_TOKEN = your-token

# Cloudinary
CLOUDINARY_NAME     = your-cloud
CLOUDINARY_API_KEY  = your-key
CLOUDINARY_API_SECRET = your-secret

# SMTP
SMTP_HOST = smtp.gmail.com
SMTP_USER = your@email.com
SMTP_PASS = your-app-password

# Optional
SENTRY_DSN           = https://...@sentry.io
VAPID_PUBLIC_KEY     = your-vapid-public-key
VAPID_PRIVATE_KEY    = your-vapid-private-key
IMAGEKIT_PUBLIC_KEY  = your-imagekit-key
IMAGEKIT_PRIVATE_KEY = your-imagekit-secret
```
