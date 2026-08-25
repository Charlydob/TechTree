# HTDE

**How to Do Everything** is a mobile-first, offline-capable editor and runner for interactive guides. The app separates safe **Run / On Site** use from **Edit**, validates imported JSON, and synchronizes runbooks/folders through a Node.js API backed by PostgreSQL. Browser storage remains as offline cache and pending-change fallback.

## Architecture

- React + TypeScript + Vite; guide content is versioned JSON outside components.
- `src/runbook.schema.json` is the strict JSON Schema 2020-12 contract. Ajv checks shape; `validation.ts` adds graph integrity and reachability checks.
- `src/lib/repository.ts` keeps the server as the primary source and uses `localStorage` only for cache, offline fallback, migration and pending sync.
- `backend/` exposes the authenticated REST API and validates runbooks with the same JSON Schema used by the frontend.
- The service worker is generated per build with a cache version such as `2026.08.25-<hash>`.
- The editor uses immutable snapshots for Undo/Redo and stores node positions in `node.ui`.

## API and environment

The API lives under `/api` and requires a cookie session for all runbook/folder/sync routes. Configure the backend with:

```env
DATABASE_URL=
APP_PASSWORD=
SESSION_SECRET=
PORT=3003
NODE_ENV=production
```

Do not put real secrets in Git. Use `.env.example` as a template.

Endpoints:

```text
GET    /api/health
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/runbooks
GET    /api/runbooks/:id
POST   /api/runbooks
PUT    /api/runbooks/:id
DELETE /api/runbooks/:id
POST   /api/runbooks/:id/duplicate
GET    /api/folders
PUT    /api/folders
GET    /api/sync
POST   /api/sync/push
```

## Development and checks

```sh
npm ci
npm run dev
npm run dev:api
npm run lint
npm run typecheck
npm test
npm run build
```

## JSON contract

Use `src/runbook.schema.json`. IDs are lowercase kebab-case and unique. Every `nextNode` references a node in the same file. Unknown properties are rejected, producing field-level import errors. Valid imports show a preview; matching IDs are explicitly replaced. Export emits the edited version.

Folders are stored as paths in `folder`, for example `Servidores/Docker/Deployments`, so existing import/export remains portable. Node positions stay in `node.ui`. Any node can include multimedia items: `image`, `video`, `youtube`, or `link`, with URL, alt text, captions, titles, and descriptions.

## Database

Run the SQL migration in `backend/migrations/001_initial.sql` against the PostgreSQL database referenced by `DATABASE_URL`. It creates `runbooks` and `folders`, with JSONB storage for the validated runbook document plus indexes for category, folder, updated time and JSONB search.

## Docker and Caddy

Build and run the frontend/backend containers without creating a PostgreSQL container:

```sh
cp .env.example .env
# edit .env with real DATABASE_URL, APP_PASSWORD and SESSION_SECRET
docker compose up -d --build
```

The compose file binds services to localhost:

```text
frontend: 127.0.0.1:8080 -> container 80
backend:  127.0.0.1:3003 -> container 3003
```

Caddy should keep the public URL the same and split routes:

```caddyfile
techtree.example.com {
  encode zstd gzip

  handle /api/* {
    reverse_proxy 127.0.0.1:3003
  }

  handle {
    reverse_proxy 127.0.0.1:8080
  }
}
```

The same block is saved in `deploy/Caddyfile.example`.

## Updating an existing installation

1. Back up the existing PostgreSQL database if it already exists.
2. Deploy the new containers with `docker compose up -d --build`.
3. Open the app and sign in with `APP_PASSWORD`.
4. If the browser has old local-only runbooks, accept the migration prompt: "Hay procedimientos guardados unicamente en este dispositivo. Quieres subirlos al servidor?"
5. Confirm `/api/health` returns `{"ok":true,"postgres":true}`.
6. Check Ajustes for the current `Version: YYYY.MM.DD-<hash>`.

Local runbooks are not deleted after migration. They remain as cache/fallback until server sync confirms writes.

## Backups

Create a backup:

```sh
pg_dump "$DATABASE_URL" --format=custom --file=techtree-$(date +%Y%m%d).dump
```

Restore into an empty database:

```sh
pg_restore --dbname "$DATABASE_URL" --clean --if-exists techtree-YYYYMMDD.dump
```
