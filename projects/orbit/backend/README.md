# Orbit Backend

REST API for **Orbit** — a social platform where users publish posts, interact through likes, comments, follows, reposts, and saves, and receive in-app notifications.

Built with **Node.js**, **Express 5**, **TypeScript**, **MongoDB**, and **Redis** (Upstash).

---

## Features

- **Authentication** — JWT in httpOnly cookie (signup, login, logout)
- **Posts** — CRUD with images (Cloudinary), slugs, feed pagination, views & shares
- **Comments** — Threaded replies, edit/delete with cascade cleanup
- **Social** — Like (posts & comments), follow, repost, save
- **Notifications** — like, comment, follow, repost, save (with cleanup on undo/delete)
- **Search** — Users and posts (text index)
- **Password recovery** — Email OTP flow
- **Security** — Helmet, CORS, rate limits, env validation, 100kb JSON limit

---

## Tech stack

| Tool                | Purpose                         |
| ------------------- | ------------------------------- |
| Express 5           | HTTP API                        |
| Mongoose            | MongoDB ODM                     |
| Zod                 | Request validation              |
| JWT + cookie-parser | Session auth                    |
| Cloudinary + Multer | Image uploads                   |
| Nodemailer          | Transactional email             |
| Upstash Redis       | Response caching                |
| express-rate-limit  | Abuse protection                |
| Helmet + CORS       | Security headers & cross-origin |

---

## Prerequisites

- **Node.js** 18+
- **MongoDB** (Atlas or local)
- **Upstash Redis** account
- **Cloudinary** account
- **SMTP** credentials (for emails)

---

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

| Variable                   | Required | Description                                                       |
| -------------------------- | -------- | ----------------------------------------------------------------- |
| `MONGO_URI`                | Yes      | MongoDB connection string                                         |
| `JWT_SECRET`               | Yes      | Secret for signing JWTs                                           |
| `UPSTASH_REDIS_REST_URL`   | Yes      | Upstash Redis REST URL                                            |
| `UPSTASH_REDIS_REST_TOKEN` | Yes      | Upstash Redis token                                               |
| `CLOUDINARY_NAME`          | Yes      | Cloudinary cloud name                                             |
| `CLOUDINARY_API_KEY`       | Yes      | Cloudinary API key                                                |
| `CLOUDINARY_API_SECRET`    | Yes      | Cloudinary API secret                                             |
| `SMTP_HOST`                | Yes      | SMTP server host                                                  |
| `SMTP_USER`                | Yes      | SMTP username                                                     |
| `SMTP_PASS`                | Yes      | SMTP password                                                     |
| `CLIENT_URL`               | Yes      | Frontend origin for CORS (full URL, e.g. `http://localhost:5173`) |
| `PORT`                     | No       | Server port (default `5000`)                                      |
| `NODE_ENV`                 | No       | `development` / `production` / `test`                             |

The server validates all required variables at startup and exits with a clear error if anything is missing or invalid.

### 3. Run

**Development** (watch mode):

```bash
npm run dev
```

**Production build:**

```bash
npm run build
npm start
```

Server listens on `http://localhost:5000` by default (or your `PORT`).

---

## Frontend integration

- Set `CLIENT_URL` in `.env` to match your frontend URL exactly (protocol + host + port).
- All API routes are under `/api`.
- Send cookies on every request:

```js
fetch("http://localhost:5000/api/posts", {
  credentials: "include",
});
```

Auth cookie name: `jwt` (httpOnly, 7-day expiry).

---

## API overview

Base URL: `http://localhost:5000/api`

| Prefix           | Description                                                          |
| ---------------- | -------------------------------------------------------------------- |
| `/auth`          | Signup, login, logout                                                |
| `/password`      | Forgot password (OTP), update password                               |
| `/users`         | User list, profile update, delete account, share/view profile        |
| `/posts`         | Feed, CRUD, share, view                                              |
| `/comments`      | List (post / replies / global), add, edit, delete (threaded replies) |
| `/likes`         | Toggle like on post or comment                                       |
| `/follows`       | Toggle follow, followers/following lists                             |
| `/saves`         | Toggle save, list saved posts                                        |
| `/reposts`       | Toggle repost                                                        |
| `/search`        | Search users and posts (auth required)                               |
| `/notifications` | List, unread count, mark one or all read                             |

### Quick examples

**Login** (JSON):

```http
POST /api/auth/login
Content-Type: application/json

{ "email": "user@example.com", "password": "YourPass1!" }
```

**Signup** (multipart — `profilePic` required, `bannerImage` optional):

```http
POST /api/auth/signup
Content-Type: multipart/form-data

profilePic: <file>
bannerImage: <file>   (optional)
username, fullName, gender, email, password
```

**Create post** (auth + optional image):

```http
POST /api/posts
Content-Type: multipart/form-data

title, content, image (optional)
```

**Comments** (public):

```http
GET /api/comments/:postId?limit=10&cursor=
GET /api/comments/replies/:commentId?limit=10&cursor=
GET /api/comments/?limit=10&cursor=
```

**Notifications** (auth):

```http
GET /api/notifications/unread-count
GET /api/notifications?limit=10&cursor={timestamp}_{notificationId}
PUT /api/notifications/mark-as-read
PUT /api/notifications/mark-as-read/:notificationId
```

Full route reference: see [`../PROJECT.md`](../PROJECT.md) in the repo root.

---

## Project structure

```
src/
├── server.ts           # Entry point
├── configs/            # env, redis, cloudinary, cache, email, cookies
├── db/                 # MongoDB connection
├── middlewares/        # auth, rate limits, uploads, optional view auth
├── models/             # Mongoose schemas
├── schemas/            # Zod validation
├── routes/             # Express routers
├── controllers/        # Route handlers
└── utilities/          # Shared helpers (notifications)
```

---

## Auth & security

- Passwords hashed with **bcrypt**
- JWT stored in **httpOnly** cookie (`secure` in production, `sameSite: strict`)
- **CORS** allows only `CLIENT_URL` with credentials
- **Rate limits:** auth (5/15min), OTP (3/10min), comments (20/min), interactions (100/min), notifications (60/min)
- Post/comment delete only by owner; post delete cascades related data

---

## Response format

| Status       | Shape                                   |
| ------------ | --------------------------------------- |
| Success      | `{ success: true, message, ...data }`   |
| Client error | `{ success: false, message, error? }`   |
| Server error | `{ message: "Internal server error!" }` |

List endpoints use cursor pagination: `nextCursor`, `hasMore`, and `limit` query param.

---

## Scripts

| Command         | Description                                      |
| --------------- | ------------------------------------------------ |
| `npm run dev`   | Start dev server with hot reload (`tsx --watch`) |
| `npm run build` | Compile TypeScript to `dist/`                    |
| `npm start`     | Run compiled production server                   |

---

## Related documentation

| File                                                   | Contents                                     |
| ------------------------------------------------------ | -------------------------------------------- |
| [`../README.md`](../README.md)                         | Repo overview & doc index                    |
| [`../PROJECT.md`](../PROJECT.md)                       | Full API reference, models, middleware       |
| [`../FEATURES.md`](../FEATURES.md)                     | Feature behavior explained in plain language |
| [`../FRONTEND_AI_PROMPT.md`](../FRONTEND_AI_PROMPT.md) | Prompt to generate a matching frontend       |

---

## License

ISC
