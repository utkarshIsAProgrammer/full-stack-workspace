# 🚀 Orbit App — Comprehensive Audit Report

> **Generated**: July 30, 2026
> **Scope**: Full-stack orbit social app (React + Vite frontend, Express + MongoDB backend)

---

## Table of Contents
1. [Code Health](#1-code-health)
2. [Performance](#2-performance)
3. [Security](#3-security)
4. [Accessibility](#4-accessibility)
5. [Recommended Tools & Services](#5-recommended-tools--services)
6. [Feature Roadmap](#6-feature-roadmap)
7. [Quick Wins](#7-quick-wins)

---

## 1. 🩺 Code Health

### Frontend (Client) — ✅ CLEAN
- **TypeScript errors**: 0
- **Build**: Vite with excellent code splitting (vendor, icons, socket, gsap, cropper + page-level chunks)
- **Testing**: Vitest + @testing-library/react (some tests exist in `src/components/__tests__/`)
- **Linting**: TypeScript `--noEmit` as lint step
- **Bundle analysis**: rollup-plugin-visualizer available (run with `ANALYZE=true`)
- **Error monitoring**: Sentry integrated (both @sentry/react + @sentry/vite-plugin)

### Backend (Server) — ❌ 100+ TypeScript Errors
**All errors are the same issue:**
```
Property '_id' does not exist on type 'User'
```

**Affected files:**
- `auth.controllers.ts`
- `chat.controllers.ts`
- `comment.controllers.ts`
- `admin.controllers.ts`
- `analytics.controller.ts`
- `apiKey.controller.ts`
- `audioRoom.controllers.ts`
- `bulkOperations.controller.ts`
- `collection.controllers.ts`
- `follow.controllers.ts`
- `glimpse.controllers.ts`
- `like.controllers.ts`
- `notification.controllers.ts`
- `post.controllers.ts`
- `reaction.controllers.ts`
- `repost.controllers.ts`
- `saves.controllers.ts`
- `search.controllers.ts`
- `user.controllers.ts`

**Root cause**: Express `req.user` type doesn't include `_id` (Mongoose document property).
**Fix**: Create a type declaration file (`@types/express.d.ts`) extending the Express.User interface.

```typescript
// src/@types/express.d.ts
import { User as UserDocument } from "../models/user.model";

declare global {
  namespace Express {
    interface User extends UserDocument {}
  }
}
```

---

## 2. ⚡ Performance

### ✅ What's Already Good
| Area | Status |
|---|---|
| Code splitting (manualChunks) | ✅ Excellent — vendor, icons, socket, gsap, cropper, Chat, Feed, Profile, Landing, LeftSidebar |
| API caching | ✅ useApiCache with stale-while-revalidate pattern |
| PWA manifest | ✅ manifest.json with icons, theme colors |
| Bundle analysis | ✅ rollup-plugin-visualizer available |
| Error monitoring | ✅ Sentry on both frontend + backend |
| Lazy loading | ✅ Suspense used for heavy screens |
| Image optimization | ✅ Cloudinary/ImageKit in dependencies |
| Redis caching | ✅ ioredis + Upstash in dependencies |

### 🔧 What's Missing
| Issue | Impact | Fix |
|---|---|---|
| No `loading="lazy"` on `<img>` tags | Medium | Add `loading="lazy"` to all feed images, avatars, post images |
| Basic service worker | Medium | Upgrade to `vite-plugin-pwa` with full caching strategy (stale-while-revalidate for API, cache-first for static assets) |
| No virtual scrolling | High on large message lists | Add `@tanstack/react-virtual` to Chat.tsx for messages, Community member lists |
| No Web Vitals measurement | Low | Add `web-vitals` library + send to Sentry |
| No font-display swap | Medium | Ensure `@font-face` declarations include `font-display: swap` |
| No MongoDB query analysis | Medium | Use `.explain("executionStats")` on slow queries, add indexes |
| Mongoose `.lean()` not used everywhere | Medium | Add `.lean()` to all read-only Mongoose queries |

---

## 3. 🔒 Security

### ✅ What's Already Good
| Area | Package/Tool |
|---|---|
| HTTP headers | ✅ helmet |
| CORS | ✅ cors (configured) |
| CSRF protection | ✅ Double-submit cookie pattern |
| Rate limiting | ✅ express-rate-limit + Upstash Redis |
| Input validation | ✅ Zod schemas |
| Input sanitization | ✅ sanitize-html |
| Password hashing | ✅ bcryptjs |
| JWT auth | ✅ jsonwebtoken |
| OAuth | ✅ passport (Google + GitHub) |
| File uploads | ✅ multer |
| Error monitoring | ✅ Sentry (frontend + backend) |
| Profiling | ✅ @sentry/profiling-node |

### 🔧 What's Missing
| Issue | Priority | Fix |
|---|---|---|
| Content Security Policy (CSP) | 🔥 High | Add CSP headers via Helmet to prevent XSS |
| Subresource Integrity (SRI) | Medium | Add `integrity` attributes to CDN resources |
| NoSQL injection protection | Medium | Sanitize query params in search/filter endpoints |
| File upload MIME validation | Medium | Verify server-side MIME type beyond multer defaults |
| API key rotation | Low | Implement expiry + rotation for apiKey.controller |
| Audit logging | Medium | Add request/response logging for sensitive endpoints |
| npm audit | Medium | Run `npm audit` regularly — many packages on major version upgrades |

---

## 4. ♿ Accessibility (A11y)

### ✅ What's Already Good
- `aria-label` on some interactive elements
- `tabIndex={0}` on custom interactive elements
- `role="button"` on div-based buttons
- Focus states on inputs (`focus:outline-none`, `focus:ring`, `focus:border`)

### 🔧 What's Missing
| Issue | WCAG Criterion | Fix |
|---|---|---|
| No keyboard Escape/close on modals | 2.1.1 | Add Escape key handler to PostModal, community modals, dialogs |
| No focus trapping in modals | 2.4.3 | Implement focus trap for all modals (Tab cycles within modal) |
| No `aria-live` regions | 4.1.3 | Add `aria-live="polite"` on toast notifications, message list updates |
| Icon-only buttons lack labels | 4.1.2 | Add `aria-label="Delete message"`, `aria-label="Edit"`, etc. on all icon buttons |
| Color contrast may fail WCAG AA | 1.4.3 | Check zinc-600 on zinc-900 backgrounds (ratio ~3.5:1, needs 4.5:1 for AA) |
| No `prefers-reduced-motion` support | 2.3.3 | Add `@media (prefers-reduced-motion: reduce)` to disable animations |
| No skip-to-content link | 2.4.1 | Add hidden skip navigation link as first focusable element |
| Form errors not associated with inputs | 3.3.2 | Use `aria-describedby` on inputs pointing to error message IDs |
| Low contrast focus indicators | 2.4.7 | Use 3px bright ring (e.g., `ring-3 ring-blue-500`) instead of thin zinc-700 |
| No heading hierarchy | 1.3.1 | Ensure h1 → h2 → h3 hierarchy on every page/route |

---

## 5. 🛠️ Recommended Tools & Services

### Frontend Libraries to Add
| Library | Purpose | Priority |
|---|---|---|
| `vite-plugin-pwa` | Full PWA with service worker, offline caching, background sync | 🔥 High |
| `@tanstack/react-virtual` | Virtual scrolling for chat messages, feeds, member lists | 🔥 High |
| `react-aria-components` | Accessible UI primitives (buttons, dialogs, comboboxes) | Medium |
| `react-hot-toast` or `sonner` | Accessible toast notifications (replace custom events) | Low |
| `@sentry/feedback` | In-app user feedback widget | Low |
| `i18next` | Internationalization (when expanding beyond English) | Future |

### Backend/Infrastructure
| Service | Purpose | Why |
|---|---|---|
| **BullMQ + Redis** | Background job queue | Email delivery, image processing, notifications — Redis is already available |
| **Algolia / Meilisearch** | Full-text search | Better than MongoDB text search for users, posts, communities |
| **LiveKit / Daily.co** | Group video calls | You already have WebRTC for 1-on-1, add SFU for groups |
| **Logtail / Axiom** | Cloud log management | Winston is local — cloud logs help debugging production |
| **Sentry Performance** | APM / tracing | Already have `@sentry/profiling-node` — just enable it |

### Already Installed — Not Yet Fully Utilized
| Package | What It Can Do |
|---|---|
| `web-push` | Push notifications! Already in deps, needs integration |
| `swagger-jsdoc` + `swagger-ui-express` | API documentation — needs route annotations |
| `cloudinary` + `imagekit` | Automatic image optimization (`w_auto,q_auto`) |
| `upstash/redis` + `ioredis` | Session store, rate limiting, pub/sub, message queue |
| `node-cron` | Scheduled tasks (daily missions reset, cleanup) |
| `winston-daily-rotate-file` | Log rotation — needs to be wired into all controllers |
| `@socket.io/redis-adapter` | Horizontal scaling for Socket.IO across multiple instances |

---

## 6. 🚀 Feature Roadmap

### Quick Wins (1-2 days)
| Feature | Effort | Impact |
|---|---|---|
| Push notifications (web-push is installed!) | 🟢 Low | 🔥 High — re-engage users |
| Keyboard shortcuts (`g+h` home, `g+e` explore, `?` help) | 🟢 Low | Medium — power users |
| Emoji autocomplete (`:` trigger) in chat | 🟢 Low | Medium |
| Image lazy loading (`loading="lazy"`) | 🟢 Low | Medium |
| `prefers-reduced-motion` support | 🟢 Low | Medium — a11y |
| Fix 100+ server TypeScript errors | 🟢 Low | 🔥 High — dev experience |

### Medium (1 week)
| Feature | Effort | Impact |
|---|---|---|
| In-app notifications panel with filters | 🟡 Medium | 🔥 High |
| Message search across chat history | 🟡 Medium | 🔥 High |
| Dark/Light theme toggle | 🟡 Medium | Medium |
| Per-message read receipt timestamps | 🟡 Medium | Medium |
| File drag-and-drop in chat/community | 🟡 Medium | Medium |
| Upgrade service worker (vite-plugin-pwa) | 🟡 Medium | 🔥 High — offline support |

### Big Bets (2+ weeks)
| Feature | Effort | Impact |
|---|---|---|
| End-to-end encryption for DMs | 🔴 High | 🔥🔥🔥 Very High |
| Group video calls (LiveKit/mediasoup) | 🔴 High | 🔥🔥 High |
| Offline-first architecture (IndexedDB + sync) | 🔴 High | 🔥🔥🔥 Very High |
| Communities 2.0 (channels, roles, permissions) | 🔴 High | 🔥🔥 High |
| AI-powered features (smart replies, content moderation) | 🔴 High | 🔥🔥 High |

---

## 7. 📋 Quick Wins — In Order of Priority

### 🔥 P0 — This Week
1. **[Fix server TS errors](./server/src/@types/express.d.ts)** — Add Express User type extension (unblocks clean builds)
2. **Push notifications** — `web-push` is already installed, wire it up with service worker
3. **`loading="lazy"` on images** — One regex sweep across all components

### 🟡 P1 — Next Week
4. **Upgrade PWA** — Add `vite-plugin-pwa` with caching strategy
5. **Virtual scrolling** — Add `@tanstack/react-virtual` to Chat.tsx message list
6. **Add CSP headers** — Configure Helmet with strict Content Security Policy
7. **Keyboard a11y** — Escape-to-close modals, focus trapping

### 🟢 P2 — This Month
8. **`prefers-reduced-motion`** — Respect user motion preferences
9. **`aria-label` sweep** — Add labels to all icon-only buttons
10. **BullMQ for background jobs** — Move email, notification, image processing off the main thread
11. **Swagger API docs** — Annotate routes for automatic docs
12. **Mongoose `.lean()` sweep** — Optimize read-only queries
