# ai-cv-builder-front

Web app for AI CV Builder: sign up, upload a CV (PDF or pasted text) with a target role, watch
Claude draft a focused CV, answer its questions about missing details, edit everything by hand
and download an A4 PDF. Works on phones.

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, TanStack Query 5,
react-hook-form + zod, motion. The API lives in
[ai-cv-builder-api](https://github.com/artemsoftdev/ai-cv-builder-api); the REST contract is
[docs/API.md](docs/API.md) (a copy of the API repo's).

## Run

**Everything with Docker** (the usual way): the API repo's `docker-compose.yml` builds this repo
from `../ai-cv-builder-front`.

```bash
cd ../ai-cv-builder-api
cp .env.example .env          # set ANTHROPIC_API_KEY, the only secret (the web app has none)
docker compose up --build     # http://localhost:3000
```

**Frontend only, against a running API** (Node 24):

```bash
npm ci
API_INTERNAL_URL=http://localhost:4000 npm run dev   # http://localhost:3000
```

`API_INTERNAL_URL` is where the Next server finds the API (default `http://localhost:4000`). It
is baked into the build, so the Docker image takes it as a build argument (`http://api:4000` in
compose). See [.env.example](.env.example).

| Script                    | What it does                                                |
| ------------------------- | ----------------------------------------------------------- |
| `npm run dev`             | dev server (Turbopack)                                      |
| `npm run build` / `start` | production build (`output: "standalone"`) / serve it        |
| `npm run typecheck`       | `next typegen && tsc --noEmit` (route types are generated)  |
| `npm run lint`            | ESLint (Next, TypeScript, React Hooks/Compiler, Query)      |
| `npm test`                | Vitest + Testing Library (jsdom)                            |

## Layout

```
src/
  app/                  routes: (auth)/login|signup, (app)/cvs, cvs/new, cvs/[id]; error/not-found
  proxy.ts              route guard (Next 16 "proxy", formerly middleware)
  components/
    ui/                 small accessible UI kit (Button, Field, Popover, ConfirmDialog, ...)
    cvs/                CV list
    cv/new/             new CV form (PDF dropzone or pasted text, target role)
    cv/generation/      progress stepper and failed state
    cv/workspace/       the editor page: autosave status, PDF download, phone tabs
    cv/editor/          section editors (contact, summary, experience, education, skills)
    cv/review/          "Check" flags, source quotes, removed claims
    cv/questions/       Claude's questions and answers
    cv/preview/         live A4 preview (mirror of the API's PDF template)
  lib/
    api/                typed client, DTOs (mirror of docs/API.md), error model and messages
    query/              TanStack Query hooks, keys, polling rules, 401 handling
    cv/                 content schema, SaveQueue + useCvAutosave, conflict merge, printable CV
    auth/, forms/, hooks/, utils/, validation/
```

Tests sit next to the code (`*.test.ts(x)`); `src/test/http.ts` has fetch mocks.

## Design decisions

- **One origin.** The browser only calls `/api/*` on the Next server, which rewrites to the
  API. The session cookie stays first-party (`HttpOnly`, `SameSite=Lax`), no CORS is needed,
  and every write carries `X-Requested-With` (the API's CSRF check). The proxy only checks
  that the cookie exists; the API decides whether it is valid, and any `401` clears a stale
  cookie (`DELETE /auth/session`, a Next route handler) and goes to `/login?next=...`.
- **Polling, not SSE or WebSockets.** Generation and answers run as server-side jobs, and the
  UI polls `GET /api/cvs/:id` every 1.5 s only while the CV is `generating` or `busy` (the list
  every 4 s while anything is in progress). All progress lives in Postgres, so a reload, a
  dropped connection or another device simply resumes. One request per 1.5 s for a job that
  takes about a minute costs nothing, works through any proxy and needs no extra
  infrastructure. Polling pauses in background tabs and refetches when the tab is back.
- **Autosave with optimistic locking.** Edits are validated with the same limits as the API
  and sent about 1 s after typing stops, one PATCH at a time, each with the version returned
  by the previous one (`SaveQueue`, unit-tested with fake timers). Failures keep the edit and
  retry with backoff. On `VERSION_CONFLICT` (the CV changed on another device) the latest
  version is loaded and local edits are re-applied per contact field or section where they
  don't overlap (a three-way merge); overlapping parts go to the server copy and a toast says
  which. Leaving the page with unsaved edits asks first.
- **Read-only while the AI works.** Answering a question queues a job that rewrites part of
  the CV; until it finishes the API answers `409 CV_BUSY` to edits, and the editor is disabled
  (pending edits are saved before the answer is sent). This removes the race between manual
  edits and AI rewrites instead of trying to merge them.
- **Untrusted content.** Everything from the API (including Claude's output) is rendered as
  React text, never as HTML, and CV links are never turned into anchors in the app (the PDF
  makes them clickable; the API only accepts http, https and mailto). Error bodies are
  validated with zod before use.
- **Preview = PDF.** The live preview reuses the API's rules for what is printed and its
  react-pdf styles converted from points to pixels, so the download looks like the preview.
- **Phones.** Below 1024 px the CV page uses Edit / Preview / Questions tabs (kept in
  `?tab=`) and a bottom bar with save status and download; inputs are 16 px to avoid iOS zoom.
