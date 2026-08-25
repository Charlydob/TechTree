# Tech Runbook

Mobile-first, offline-capable interactive decision trees for technical procedures. The app separates safe **RUN / ON SITE** use from **EDIT**, validates imported JSON, and stores its library locally.

## Architecture

- React + TypeScript + Vite; procedure content is versioned JSON outside components.
- `src/runbook.schema.json` is the strict JSON Schema 2020-12 contract. Ajv checks shape; `validation.ts` adds graph integrity and reachability checks.
- `localStorage` is isolated behind `src/lib/storage.ts`, ready to replace with a sync repository. It stores runbooks and per-run history.
- The service worker caches the shell and fetched images. Video deliberately bypasses caching.
- The editor uses immutable snapshots for Undo/Redo and persists on Save. Reset restores the saved version.

## Development and checks

```sh
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## JSON contract

Use `src/runbook.schema.json`. IDs are lowercase kebab-case and unique. Every `nextNode` references a node in the same file. Unknown properties are rejected, producing field-level import errors. Valid imports show a preview; matching IDs are explicitly replaced. Export emits the edited version. Images require alt text. Videos use metadata preload and are not automatically cached.

## Docker and Caddy deployment

Build and verify without changing existing services:

```sh
docker build -t tech-runbook:1.0.0 .
docker run --rm -p 127.0.0.1:8088:80 --name tech-runbook tech-runbook:1.0.0
curl --fail http://127.0.0.1:8088/healthz
```

Add only this site to the **existing** Caddy configuration, substituting the hostname:

```caddyfile
runbook.example.com {
  reverse_proxy 127.0.0.1:8088
}
```

Use the existing safe Caddy reload process. HTTPS is required for service workers and iPhone installation. In Safari choose **Share → Add to Home Screen**. Browser data is device-specific; export JSON backups before clearing it.
