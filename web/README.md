# web

Next.js 16 app: the site, the dashboard (`/app`), the docs (`/docs`), the API and the hourly settlement job.

```bash
npm install
cp .env.example .env.local
npm run dev      # http://localhost:3000
npm test         # vitest
npm run build
```

| Path | |
|---|---|
| `app/page.tsx` | home |
| `app/app/` | dashboard: command bar, seven tabs (`views.tsx`) |
| `app/docs/` | field manual |
| `app/api/` | `stats`, `network`, `me`, `history`, `proof`, `agent`, `node/{init,link,beat}`, `epoch/run`, `rpc` |
| `app/iso.tsx` | isometric SVG figures (rig frame, filter, pool tanks, hour blocks) |
| `app/gpu3d.tsx` | the 3D VGA turntable (three.js) |
| `lib/epoch.ts` | hourly job: measure, allocate, publish |
| `lib/mining.ts` | lowest balance, effective VGA, allocation |
| `lib/node.ts` | terminal node keys, heartbeats, pairing codes |
| `lib/kv.ts` | Upstash Redis, or `data/kv.json` locally |
| `public/rig.mjs` | served copy of [`../rig/rig.mjs`](../rig/rig.mjs); edit the source and run `npm run rig:sync` from the root |
| `scripts/` | anvil-fork end-to-end (`e2e-fork.mjs`) and seed (`seed-fork.mjs`) |

Env vars and deployment: [`../docs/DEPLOY.md`](../docs/DEPLOY.md). Architecture: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
