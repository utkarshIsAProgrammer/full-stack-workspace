# Orbit Backend — Architecture

## System Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Express 5  │────▶│   MongoDB   │
│  (React/TS) │     │   API Server │     │   (Atlas)   │
└─────────────┘     │              │     └─────────────┘
       │            │   + Socket   │            │
       │            │     .IO      │     ┌─────────────┐
       │            └──────────────┘     │  Cloudinary  │
       │                    │            │  (Images)    │
       │            ┌──────────────┐     └─────────────┘
       │            │   Upstash    │
       └───────────▶│   Redis      │
                    │  (Cache +    │     ┌─────────────┐
                    │   Rate Lim)  │     │   Sentry    │
                    └──────────────┘     │ (Monitoring)│
                                         └─────────────┘
```

## Request Lifecycle

```
HTTP Request
    │
    ▼
Helmet (Security Headers)
    │
    ▼
Compression (Gzip > 1KB)
    │
    ▼
CORS (Origin validation)
    │
    ▼
Body Parser (JSON 10MB, URL-encoded 10MB)
    │
    ▼
Cookie Parser
    │
    ▼
Request ID (UUID assigned)
    │
    ▼
Request Logger (method, path, duration)
    │
    ▼
Health Check (/api/health) — skips auth/ratelimit
    │
    ▼
Rate Limiter (global + per-route)
    │
    ▼
CSRF Protection (double-submit cookie)
    │
    ▼
Auth Middleware (JWT cookie verification)
    │
    ▼
Route Handler (controller → model → service)
    │
    ▼
Cache (Redis read/write — errors logged, never thrown)
    │
    ▼
Error Handler (AppError → JSON, ZodError → validation)
    │
    ▼
JSON Response
```

## Key Design Decisions

### 1. Cursor-Based Pagination
Every listing endpoint uses cursor pagination (`_id: { $lt: cursor }`) instead of offset-based (`skip/limit`). This provides:
- **O(1) performance** regardless of page depth
- **Consistent results** even when new items are added
- **No skipping/duplication** during infinite scroll

### 2. Graceful Cache Degradation
All `getCache`/`setCache` calls are wrapped in try/catch. If Redis is unavailable:
- Reads fall through to MongoDB
- Writes are logged but don't crash the request
- The app continues serving stale data

### 3. Error Handling Hierarchy
```
AppError (base class)
├── BadRequestError (400)
├── UnauthorizedError (401)
├── ForbiddenError (403)
├── NotFoundError (404)
├── ConflictError (409)
└── ValidationError (422)
```
Controllers throw these errors, and the global error handler formats them as JSON. Zod validation errors are caught separately and return field-level error messages.

### 4. Cluster Mode
Only activates in production (`NODE_ENV=production`). In development, runs as a single process for tsx --watch compatibility. Workers share the same port via the OS. Default: 2 workers.

### 5. Real-Time Architecture
Socket.IO handles real-time events with Redis adapter for multi-instance support:
- Post created/updated/deleted
- Comment added
- Like toggled
- Follow/unfollow
- Chat messages (typing, read receipts)
- Notification delivery
- Audio room events
- Glimpse updates

## Data Flow: Creating a Post

```
1. Client sends POST /api/posts (multipart with image + JSON)
2. CSRF middleware validates token
3. Auth middleware decodes JWT, attaches user to req
4. Zod schema validates body (title, content, visibility)
5. Multer extracts uploaded files
6. Hashtags extracted from title + content via regex
7. Images uploaded to Cloudinary
8. Post saved to MongoDB (with image URLs + public_ids)
9. Mention notifications created for @mentioned users
10. Feed cache invalidated
11. Post populated with author data and user status
12. Socket.IO broadcasts post:created event
13. XP awarded and mission progress updated (fire-and-forget)
14. Response sent: { success: true, post }
```

## Authentication Flow

```
1. Signup: Validate with Zod → Hash password (bcrypt) → Create user → Generate JWT → Set cookie
2. Login: Find user by email/username → Compare password → Generate JWT → Set cookie
3. Auth Middleware: Read JWT from cookie → Verify signature → Attach user to req → Next()
4. Logout: Clear JWT cookie
```

JWT tokens use `jsonwebtoken` with HS256. Cookies are httpOnly, sameSite, and secure in production.

## Caching Strategy

| Data | Cache Key Pattern | TTL | Invalidation |
|------|-------------------|-----|-------------|
| Single post | `post:{id}` | 30 min | On update/delete |
| Post list | `posts:{author}:{cursor}:{limit}:{user}:sort{field}` | 15s | On create/delete |
| Comments | `comments:{postId}:{cursor}:{limit}` | 30s | On new comment |
| User profile | `user:{id}` | 60s | On profile update |
| User list | `users:all:{user}:{cursor}:{limit}` | 60s | On new user |
| Trending | `trending:hashtags`, `trending:users` | 5 min | Time-based |
| Search | `search:users:{q}:{cursor}:{limit}` | 60s | Time-based |
| Notifications | `notifications:{userId}:{cursor}:{limit}` | 30s | On new notification |
| Analytics | `analytics:overview:{userId}` | 5 min | Time-based |

## WebSocket Events

### Client → Server
- `chat:join` — Join a conversation room
- `chat:leave` — Leave a conversation room
- `chat:typing` — Typing indicator
- `chat:stop-typing` — Stopped typing
- `chat:message` — Send a new message

### Server → Client
- `post:created`, `post:updated`, `post:deleted`
- `comment:added`, `comment:deleted`
- `like:toggled`
- `follow:new`, `follow:removed`
- `notification:new`
- `message:new`, `message:edited`, `message:deleted`
- `chat:typing`, `chat:stop-typing`
- `user:online`, `user:offline`
- `glimpse:created`, `glimpse:expired`, `glimpse:viewed`, `glimpse:reacted`
- `room:created`, `room:user-joined`, `room:user-left`, `room:ended`
- `community:new-post`, `community:member-joined`
