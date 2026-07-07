# 👻 PhantomChat

A premium, production-ready real-time chat platform — rebuilt from scratch with a modern
full-stack architecture. Think Discord × Telegram × WhatsApp Desktop, wrapped in a
glassmorphism UI and installable as a PWA.

![stack](https://img.shields.io/badge/React_19-Vite_·_TS_·_Tailwind-6366F1)
![stack](https://img.shields.io/badge/Node-Express_·_Prisma_·_Socket.io-8B5CF6)
![stack](https://img.shields.io/badge/Infra-Docker_·_Nginx_·_Redis_·_Postgres-22C55E)

---

## ✨ Features

**Messaging**
- Real-time messaging (Socket.io) with optimistic sends + REST fallback
- Typing indicators, presence (online/idle/DND/invisible), last seen
- Read receipts (✓ / ✓✓), delivered/pending/failed states
- Replies, thread replies, forwarding, pinning, editing, deleting
- Reactions, emoji picker, markdown (**bold**, `code`, ```blocks```, quotes, mentions)
- Voice messages (MediaRecorder), image/video/file uploads (Cloudinary)
- Scheduled messages, per-chat slow mode, message search, shared-media gallery

**Calls**
- 1:1 audio & video calls (WebRTC, P2P) with screen sharing and renegotiation

**Social**
- Friend requests (send / accept / decline / block), user search, profiles

**Groups & channels**
- Private groups, broadcast channels (staff-only posting), public discovery + join
- Member roles (owner / admin / moderator / member), kick, role management

**Platform**
- JWT access tokens + rotating refresh-token sessions (httpOnly cookie)
- Google & GitHub OAuth, email verification, password reset, TOTP 2FA
- Session management (list/revoke devices)
- Admin dashboard: live stats, message-volume chart, user management, ban/roles,
  reports queue, audit log
- Rate limiting, Helmet, CORS, Zod validation everywhere, spam heuristics

**PWA**
- Installable (manifest, icons, shortcuts, splash), offline app shell (Workbox)
- API network-first cache → chats readable offline; media cache-first
- Update prompt, offline banner, install prompt, push-ready notification model

**UX**
- Glassmorphism + aurora gradients, dark/light theme, chat wallpapers
- Framer Motion micro-interactions everywhere, skeleton loaders, empty states
- Command palette (Ctrl+K), keyboard shortcuts, confetti 🎉, 404 ghost
- Mobile-first: bottom nav, swipe-to-close drawer, safe-area insets

---

## 🗂 Monorepo layout

```
PhantomChat/
├── client/                  # React 19 + Vite + TS + Tailwind + PWA
│   ├── public/icons/        # PWA icons
│   ├── src/
│   │   ├── components/      # ui kit (Button, Modal, Avatar…) + system (ErrorBoundary, CommandPalette…)
│   │   ├── features/        # feature folders: auth, shell, chat, friends, discover, settings, admin, misc
│   │   ├── hooks/           # useChats, useMessages, useFriends, useNotifications
│   │   ├── lib/             # api client, socket client, query client, markdown, utils
│   │   ├── stores/          # zustand: auth, ui, chat
│   │   └── types/           # shared TS models
│   ├── vite.config.ts       # PWA manifest + Workbox runtime caching
│   └── nginx.conf           # production web server + reverse proxy
├── server/                  # Express + TS + Prisma + Socket.io + Redis
│   ├── prisma/schema.prisma # 15 models: users, sessions, friendships, chats, messages…
│   ├── prisma/seed.ts
│   └── src/
│       ├── config/ lib/ middleware/ utils/
│       ├── modules/         # auth, users, friends, chats, messages, uploads, notifications, admin
│       └── sockets/         # gateway, chat handlers, WebRTC signaling, presence
├── docker-compose.yml       # postgres + redis + api + nginx web
├── .github/workflows/ci.yml # typecheck, build, docker images
└── docs/DEPLOYMENT.md       # step-by-step deployment guide
```

---

## 🚀 Quick start (local dev)

Prereqs: Node 20+, Docker (for Postgres/Redis) — or your own instances.

```bash
# 1. infra
docker compose up -d postgres redis

# 2. backend
cd server
cp .env.example .env               # fill in JWT secrets (any long random strings)
npm install
npx prisma migrate dev --name init # creates tables
npm run seed                       # demo users + The Phantom Lounge
npm run dev                        # api on :4000

# 3. frontend (new terminal)
cd client
npm install
npm run dev                        # app on :5173 (proxies /api + /socket.io)
```

**Demo accounts** (after seeding): `phantom_admin` / `alice` / `bob` — password `Password123!`

### Optional integrations
| Feature | Env vars |
|---|---|
| Media uploads | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Google login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (redirect: `{CLIENT_URL}/auth/callback/google`) |
| GitHub login | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (redirect: `{CLIENT_URL}/auth/callback/github`) |

Email flows (verification / reset) log their tokens to the server console in dev —
wire `deliverToken()` in `auth.service.ts` to your SMTP/Resend/SES provider for production.

---

## 🐳 Production (Docker Compose)

```bash
cp server/.env.example server/.env   # set strong secrets, production CLIENT_URL
docker compose up -d --build
```

Nginx serves the PWA on port 80 and proxies `/api` + `/socket.io` to the API container.
Migrations run automatically on API boot. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for
TLS, scaling and platform guides.

---

## 🔌 API surface (summary)

- `POST /api/auth/{register,login,refresh,logout}` · `GET/DELETE /api/auth/sessions`
- `POST /api/auth/{forgot-password,reset-password,verify-email}` · `POST /api/auth/2fa/{init,enable,disable}`
- `GET /api/auth/oauth/:provider` → `POST /api/auth/oauth/:provider/callback`
- `GET/PATCH /api/users/me` · `GET /api/users/search` · `GET /api/users/:username`
- `GET /api/friends` · `/pending` · `/blocked` · `POST /api/friends/requests` · `…/respond` · `block/unblock`
- `GET/POST /api/chats` · `POST /api/chats/dm` · `GET /api/chats/discover` · `POST /api/chats/:id/join`
- `GET/POST /api/chats/:id/messages` · search · pins · media · `PATCH/DELETE /:messageId`
- reactions · pin/unpin · read · forward · `POST /api/uploads`
- `GET /api/notifications` · unread-count · read · clear
- `GET /api/admin/stats|users|reports|audit-logs` · ban · role · reports workflow

**Socket events**: `message:new|updated|deleted|read|pinned`, `typing:start|stop`,
`presence:update|heartbeat|set`, `chat:new|updated|removed|member_*`, `notification:new`,
`call:initiate|incoming|answer|ice|renegotiate|end|declined`, `auth:force_logout`.

---

## 🛡 Security

Helmet, strict CORS, express-rate-limit (per-scope), Zod validation on every route,
Prisma (parameterized SQL), bcrypt(12), rotating refresh tokens stored hashed,
httpOnly/secure cookies, control-character sanitization, spam heuristics, role checks
at chat and platform level, audit logging of moderation actions.

## 🧾 License

MIT — do whatever, just don't haunt us. 👻
