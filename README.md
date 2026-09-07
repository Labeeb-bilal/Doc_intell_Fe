# Document Intelligence — Frontend

Frontend for the document intelligence system: upload documents, chat with
citation-grounded answers, and review contradictions detected across your
corpus. Talks to the [Doc_intell_Be](../Doc_intell_Be) FastAPI backend.

## Stack

React 18 · TypeScript · Vite · Tailwind CSS v3 · shadcn/ui (components
copied in, not installed as a package) · TanStack Query v5 · React Router v6
· react-dropzone · lucide-react.

## Getting started

```bash
npm install
cp .env.example .env.local   # VITE_API_URL, defaults to http://localhost:8000
npm run dev
```

The backend (Postgres + Qdrant via `docker compose`, then `uvicorn`) must
already be running — see `Doc_intell_Be/README.md`.

## Scripts

```bash
npm run dev       # start the dev server
npm run build     # type-check (tsc -b) then production build
npm run preview   # preview the production build locally
```

## Regenerating types

`src/types.ts` is generated from the backend's live OpenAPI schema — never
hand-edit it:

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o src/types.ts
```

Re-run this whenever the backend's Pydantic schemas change.

## Project layout

```
src/
├── api/
│   ├── client.ts     # fetch wrapper, ApiError, X-Request-ID header
│   └── hooks.ts       # every TanStack Query hook
├── components/         # shared components (ui/ holds shadcn primitives)
├── pages/               # one file per route
├── lib/utils.ts         # cn(), formatDate(), formatBytes(), ...
└── types.ts              # generated — do not edit by hand
```

## Known API-shape adaptations

A couple of places in the UI adapt to what the live backend actually
returns rather than what a first guess at the API might assume:

- **Contradiction counts are pairwise-row counts, not group counts.**
  `GET /api/contradictions` groups pairwise records for display
  (`ContradictionGroupOut`), but its `counts` summary is computed over the
  underlying flat rows. A group with `evidence_count: 4` contributes 4 to
  `counts.open`, not 1 — shown as-is on the dashboard's summary chips.
- **Chat-turn contradictions don't survive a reload.** `MessageOut` (what
  `GET /conversations/{id}/messages` returns) has no `contradictions` field
  — only the live `ChatResponse` from `POST /chat` carries it. The amber
  contradiction alert in chat only ever appears on a turn from the current
  session; reloading a conversation shows its citations and trace but not
  the alert. Worth a backend field addition if this matters going forward.
- **Trace candidate snippets are best-effort.** `CandidateChunk` (the
  Retrieved tab's rows) carries no chunk text, so the Snippet column
  backfills from the message's own `citations` array where a candidate was
  also cited, and shows `—` otherwise.
