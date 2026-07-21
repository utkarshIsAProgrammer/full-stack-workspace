# Orbit Backend — Deployment Checklist

## Render (Node.js) Deployment

### 1. Pre-Deploy Checklist

```bash
# Final checks
cd projects/orbit/server

# ✅ TypeScript compiles clean
npm run typecheck

# ✅ Tests pass (auth at minimum)
npm test -- auth.test

# ✅ Build succeeds
npm run build

# ✅ No secrets committed
git status  # check .env not tracked
```

### 2. Environment Variables

Required — set these in Render dashboard → Environment:

| Variable | How to Get |
|----------|-----------|
| `MONGO_URI` | MongoDB Atlas → Connect → Drivers → Copy connection string |
| `JWT_SECRET` | Run: `openssl rand -hex 32` |
| `CLIENT_URL` | Your frontend URL (e.g. `https://orbit.app`) |
| `CLOUDINARY_NAME` | Cloudinary dashboard → Account Details |
| `CLOUDINARY_API_KEY` | Cloudinary dashboard |
| `CLOUDINARY_API_SECRET` | Cloudinary dashboard |
| `SMTP_HOST` | Your email provider (e.g. `smtp.gmail.com`) |
| `SMTP_USER` | Your SMTP email |
| `SMTP_PASS` | SMTP app password |

Optional:

| Variable | Default | Purpose |
|----------|---------|---------|
| `UPSTASH_REDIS_REST_URL` | (disabled) | Redis caching + rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | (disabled) | Upstash Redis token |
| `SENTRY_DSN` | (disabled) | Error monitoring |
| `VAPID_PUBLIC_KEY` | (disabled) | Web push notifications |
| `VAPID_PRIVATE_KEY` | (disabled) | Web push notifications |
| `IMAGEKIT_PUBLIC_KEY` | (disabled) | ImageKit CDN |
| `IMAGEKIT_PRIVATE_KEY` | (disabled) | ImageKit CDN |

### 3. Render Dashboard Setup

1. **Go to** [dashboard.render.com](https://dashboard.render.com)
2. **Click** "New +" → "Web Service"
3. **Connect** your GitHub repo
4. **Configure:**

```
Name: orbit-backend
Region: Oregon (or closest to your MongoDB)
Branch: main
Runtime: Node
Build Command: cd projects/orbit/server && npm install && npm run build
Start Command: cd projects/orbit/server && node dist/server.js
Plan: Starter ($7/mo)
```

5. **Add** all env vars from step 2
6. **Click** "Create Web Service"
7. **Wait** ~3 minutes for first deploy
8. **Verify:** `https://your-app.onrender.com/api/health`

### 4. Post-Deploy Verification

```bash
# Health check
curl https://your-app.onrender.com/api/health

# Expected response:
# { "success": true, "message": "Server is healthy!", ... }

# Test signup
curl -X POST https://your-app.onrender.com/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Pass123!","confirmPassword":"Pass123!","fullName":"Test","gender":"male"}'

# Test login
curl -X POST https://your-app.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"usernameOrEmail":"test@test.com","password":"Pass123!"}'
```

### 5. Production Considerations

**Without Redis** (free tier):
- Caching is disabled — every request hits MongoDB
- Rate limiting falls back to in-memory
- Socket.IO runs single-instance (no multi-server scaling)
- The app works fine for small to medium traffic

**With Upstash Redis** (free tier available):
- Caching reduces MongoDB load by ~80%
- Rate limiting uses centralized counters
- Recommended for production

**Free Tier Limits on Render:**
- 0.5 CPU, 512MB RAM
- 1 worker (cluster disabled)
- Bandwidth: 100GB/month
- Sleeps after 15 min of inactivity (wakes on first request — ~30s delay)

### 6. Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Build fails | TypeScript error | Check `npm run typecheck` locally |
| `503 Service Unavailable` | MongoDB URI wrong | Verify MONGO_URI in Render env |
| `Not allowed by CORS` | CLIENT_URL wrong | Must match frontend URL exactly |
| `jwt malformed` | JWT_SECRET changed | Use same JWT_SECRET as before |
| Server crashes on first request | Cold start | Enable health check in Render |
| Socket.IO not connecting | CORS config | Ensure CLIENT_URL is correct |
| Push notifications not working | VAPID keys missing | Generate with `npx web-push generate-vapid-keys` |
