# HTDE

**How to Do Everything** is a mobile-first, offline-capable editor and runner for interactive guides. The app separates safe **Run / On Site** use from **Edit**, validates imported JSON, and stores the local library in the browser until backend storage is added.

## Architecture

- React + TypeScript + Vite; guide content is versioned JSON outside components.
- `src/runbook.schema.json` is the strict JSON Schema 2020-12 contract. Ajv checks shape; `validation.ts` adds graph integrity and reachability checks.
- `localStorage` is isolated behind `src/lib/storage.ts`, ready to replace with a sync repository later.
- The service worker caches the shell and fetched images. Video deliberately bypasses caching.
- The editor uses immutable snapshots for Undo/Redo and stores node positions in `node.ui`.

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

Use `src/runbook.schema.json`. IDs are lowercase kebab-case and unique. Every `nextNode` references a node in the same file. Unknown properties are rejected, producing field-level import errors. Valid imports show a preview; matching IDs are explicitly replaced. Export emits the edited version.

Folders are stored as paths in `folder`, for example `Servidores/Docker/Deployments`, so existing import/export remains portable. Node positions stay in `node.ui`. Any node can include multimedia items: `image`, `video`, `youtube`, or `link`, with URL, alt text, captions, titles, and descriptions.

## Docker and Caddy

Docker/Caddy files are present for later deployment work, but this UX pass does not change production, domains, DNS, ports, or Caddy configuration.
