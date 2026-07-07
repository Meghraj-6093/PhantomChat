# PhantomChat — Deployment Guide

## 1. Architecture

```
                    ┌─────────────────────────────┐
  Browser / PWA ───▶│  Nginx (web container, :80) │
                    │  • serves built React app   │
                    │  • /api → server:4000       │
                    │  • /socket.io → server:4000 │
                    └────────────┬────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Express + Socket.io    │
                    │  (server container)     │
                    └───┬────────────────┬────┘
                        │                │
              ┌─────────▼──────┐  ┌──────▼───────┐
              │ PostgreSQL 16  │  │   Redis 7    │
              │ (Prisma ORM)   │  │ presence,    │
              └────────────────┘  │ rate/slow    │
                                  │ mode, oauth  │
                                  └──────────────┘
         Media uploads → Cloudinary (external)
```

## 2. Environment variables

Copy `server/.env.example` → `server/.env` and set:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✔ | Compose injects the internal URL automatically |
| `REDIS_URL` | ✔ | Compose injects `redis://redis:6379` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ✔ | 48+ random bytes each, **different values** |
| `CLIENT_URL` | ✔ | Public origin, e.g. `https://chat.example.com` (CORS + OAuth redirects) |
| `COOKIE_SECURE` | prod | `true` behind HTTPS |
| `CLOUDINARY_*` | for uploads | free tier is fine |
| `GOOGLE_*` / `GITHUB_*` | for OAuth | redirect URIs: `{CLIENT_URL}/auth/callback/{provider}` |
| `POSTGRES_PASSWORD` | ✔ | set in the shell/CI when running compose |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Single-VM deployment (Docker Compose)

```bash
git clone <repo> && cd PhantomChat
cp server/.env.example server/.env   # edit values
export POSTGRES_PASSWORD=$(openssl rand -hex 24)
docker compose up -d --build
docker compose exec server npx tsx prisma/seed.ts   # optional demo data
```

- The server container runs `prisma migrate deploy` on boot — migrations are automatic.
- App is on port 80. Postgres/Redis ports are exposed for debugging; remove the
  `ports:` entries in `docker-compose.yml` to lock them down.

### TLS (recommended: Caddy or certbot)

Simplest path — put Caddy in front and let it manage certificates:

```
# Caddyfile
chat.example.com {
    reverse_proxy web:80
}
```

Or use nginx + certbot on the host and proxy to `127.0.0.1:80`.
Set `COOKIE_SECURE=true` and `CLIENT_URL=https://chat.example.com` after enabling TLS.
**PWA install and getUserMedia (calls, voice notes) require HTTPS.**

## 4. Managed-platform deployment

| Piece | Options |
|---|---|
| Postgres | Neon, Supabase, RDS, Railway |
| Redis | Upstash, Elasticache, Railway |
| API | Fly.io / Railway / Render — deploy `server/Dockerfile` |
| Web | The `client/Dockerfile`, or any static host + CDN (build with `VITE_API_URL=https://api.example.com/api`, `VITE_SOCKET_URL=https://api.example.com`) |

Notes:
- Socket.io needs sticky sessions if you scale the API horizontally; add the
  `@socket.io/redis-adapter` (Redis is already in the stack) for multi-instance fan-out.
- If web and API are on different origins, keep `CLIENT_URL` accurate (CORS + cookies:
  the refresh cookie is `SameSite=Lax`, so prefer serving both under one apex domain).

## 5. CI/CD

`.github/workflows/ci.yml` runs on every push/PR:
1. Server: `npm ci` → `prisma generate` → typecheck → build
2. Client: `npm ci` → typecheck+build → uploads `dist` artifact
3. On `main`: builds both Docker images (add a registry login + `push: true` to publish)

To auto-deploy, append a job that SSHes to your VM and runs
`docker compose pull && docker compose up -d`, or use your platform's deploy hook.

## 6. Operations

- **Backups**: `docker compose exec postgres pg_dump -U phantom phantomchat > backup.sql`
- **Migrations**: edit `schema.prisma` → `npx prisma migrate dev --name change` locally →
  commit the migration folder → production applies it on next boot.
- **Logs**: `docker compose logs -f server` (pino JSON; pipe to Loki/Datadog if desired)
- **Health**: `GET /api/health` returns uptime — point your uptime monitor at it.
- **Admin**: promote a user in the DB once
  (`UPDATE "User" SET role='ADMIN' WHERE username='you';`) then manage everything from
  the in-app admin dashboard.
