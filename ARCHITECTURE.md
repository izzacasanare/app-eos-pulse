# EOS Pulse — Architecture

## Layer Model

```
Types → Domain → Handlers → Router → UI
```

Each layer may only import from the layer directly below it. Skipping layers is forbidden.

| Layer | Location | Allowed imports | Forbidden imports |
|---|---|---|---|
| **Types** | `service/schema.ts`, `@mspbots/type` | None (declaration only) | Everything |
| **Domain** | `service/domain/*.domain.ts` | Types, `db.ts`, other domain files | `handlers/`, HTTP context, raw `fetch()` |
| **Handlers** | `service/handlers/*.handler.ts` | Domain layer, Types | Other handlers, `db.ts` directly, `schema.ts` directly |
| **Router** | `service/server.ts` | `handlers/` only | Domain, schema, db directly |
| **UI** | `pages/**` | `@mspbots/fetch`, `@mspbots/ui`, `lucide-react` | Raw `fetch()`, raw HTML elements |

## Domain Table

| Domain | Domain file | Handler file | Responsibility |
|---|---|---|---|
| meetings | `meetings.domain.ts` | `meetings.handler.ts` | Create/open/close L10 and Leadership sessions, agenda segments |
| issues | `issues.domain.ts` | `issues.handler.ts` | IDS lifecycle — log, discuss, resolve, enforce resolution rules |
| rocks | `rocks.domain.ts` | `rocks.handler.ts` | Quarterly rocks CRUD, status transitions, append-only history |
| todos | `todos.domain.ts` | `todos.handler.ts` | Meeting to-dos, ownership, completion tracking |
| nudges | `nudges.domain.ts` | *(no HTTP handler — cron-driven)* | Schedule and dispatch Teams accountability nudges |

## Dependency Rules

1. `server.ts` imports **only** from `handlers/`
2. Handlers import **only** from `domain/` (never `db.ts` or `schema.ts` directly)
3. Domain files import from `db.ts`, `schema.ts`, and other domain files — never from `handlers/`
4. `schema.ts` has zero runtime imports — Drizzle column helpers only
5. `db.ts` is a singleton — exported once, never re-instantiated
6. `pages/` never calls `fetch()` — always uses `$fetch` / `$sse` / `$ws` from `@mspbots/fetch`
7. No raw HTML elements in `pages/` — `@mspbots/ui` components only
8. No circular dependencies at any layer

## File Naming Conventions

| Pattern | Example |
|---|---|
| Domain logic | `<noun>.domain.ts` → `meetings.domain.ts` |
| HTTP handler | `<noun>.handler.ts` → `meetings.handler.ts` |
| DB singleton | `db.ts` |
| Drizzle schema | `schema.ts` |
| Router entrypoint | `server.ts` |

## Directory Structure

```
service/
  server.ts          ← thin router only; registers handlers
  db.ts              ← Drizzle client singleton
  schema.ts          ← Drizzle table definitions
  domain/
    meetings.domain.ts
    issues.domain.ts
    rocks.domain.ts
    todos.domain.ts
    nudges.domain.ts
  handlers/
    meetings.handler.ts
    issues.handler.ts
    rocks.handler.ts
    todos.handler.ts

pages/
  (React UI — imports @mspbots/ui, @mspbots/fetch, lucide-react)

scripts/
  lint-arch.ts       ← mechanical enforcement of these rules

docs/
  ARCHITECTURE.md    ← this file
  data-model.md
  PRODUCT_SENSE.md
  DESIGN.md
  QUALITY_SCORE.md
  SECURITY.md
  ENTROPY_CHECK.md
  api-contracts/
  integrations/
```

## Violation Examples (never do these)

```typescript
// ❌ Handler importing db directly
import { db } from '../db.ts'                     // in handlers/meetings.handler.ts

// ❌ server.ts importing domain
import { getMeeting } from './domain/meetings.domain.ts'  // in server.ts

// ❌ Domain importing handler
import { meetingsHandler } from '../handlers/meetings.handler.ts'  // in domain/

// ❌ Handler importing another handler
import { issuesHandler } from './issues.handler.ts'  // in meetings.handler.ts

// ❌ UI using raw fetch
const res = await fetch('/api/meetings')           // in pages/

// ❌ UI using raw HTML
<button onClick={...}>Open</button>               // use Button from @mspbots/ui
```
