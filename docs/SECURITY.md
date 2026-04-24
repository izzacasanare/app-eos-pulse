# EOS Pulse — Security

## Secrets Management

All secrets and credentials are stored in environment variables. No secrets are committed to the repository.

### Required Environment Variables

```env
# Database
DATABASE_URL=postgres://user:password@host:5432/eos_pulse

# Microsoft Teams Integration
TEAMS_WEBHOOK_URL=https://outlook.office.com/webhook/...
TEAMS_BOT_TOKEN=...

# MSPBots Platform Auth
MSPBOTS_APP_SECRET=...

# Optional: ClickUp Sync
CLICKUP_API_TOKEN=...
CLICKUP_WORKSPACE_ID=...
```

### Local Development Setup

1. Copy `.env.example` to `.env`
2. Fill in values — never commit `.env`
3. `.env` is in `.gitignore`

---

## Database Credentials

Database access follows the `@tools/database` convention. The DB client is initialized in `service/db.ts`:

```typescript
// service/db.ts — correct pattern
const DATABASE_URL = Deno.env.get("DATABASE_URL");
if (!DATABASE_URL) throw new Error("DATABASE_URL is required — check your .env file");

// export singleton — never log DATABASE_URL
export const db = drizzle(DATABASE_URL);
```

**Rules:**
- Never hardcode connection strings
- Never log the `DATABASE_URL` value (even partially)
- Never expose DB errors raw to the HTTP response — catch and return structured error shape

---

## Access Control

### Authentication

EOS Pulse is internal only — all routes require a valid MSPBots platform session.

The platform auth middleware injects the current user into `params.user` (from `@mspbots/type`). Handlers trust this value; they do not accept user-supplied session tokens.

### Authorization

| Role | Permitted actions |
|---|---|
| `admin` | Full CRUD on all resources; close meetings; delete records; manage users/teams |
| `leader` | Run and close meetings for their team; manage team rocks; edit VTO (read) |
| `member` | Submit check-ins; update own rocks/to-dos; log issues; attend meetings |

### Route-Level Checks

```typescript
// Domain layer pattern — never trust client-supplied owner_id
export async function closeIssue(issueId: string, resolutionNotes: string, params: HandlerParams) {
  const userId = params.user?.id;
  if (!userId) throw new UnauthorizedError();

  // validate ownership or admin role before mutating
  const issue = await getIssueById(issueId);
  if (issue.owner_id !== userId && params.user?.role !== 'admin') {
    throw new ForbiddenError();
  }
  // ...
}
```

---

## Data Sensitivity

| Data | Sensitivity | Access |
|---|---|---|
| VTO content | **High** — strategic company data | `leader` + `admin` only |
| Meeting notes | **Medium** — internal | Team members + admin |
| Issue resolution notes | **Medium** — internal | Team members + admin |
| Rock status + history | **Low** | All authenticated staff |
| Nudge message content | **Low** — names + task titles only | System-generated; not user-editable |
| User email / Teams ID | **Medium** — PII | Admin only via user management |

---

## What NOT To Do

```typescript
// ❌ Never log tokens or credentials
console.log("DATABASE_URL:", DATABASE_URL)
console.log("User token:", params.user?.token)

// ❌ Never expose raw DB errors
return c.json({ error: err.message })          // may leak schema details

// ❌ Never trust client-supplied owner fields
const ownerId = c.req.json().owner_id          // client could supply any ID

// ❌ Never accept arbitrary SQL via query params
db.execute(`SELECT * FROM issues WHERE ${c.req.query('filter')}`)

// ❌ Never disable CORS in production
cors: true   // only acceptable in local dev (mspbot.config.ts server.cors)
```

---

## CORS Policy

- **Development:** `cors: true` (configured in `mspbot.config.ts`) — allows any origin for local testing
- **Production:** Restrict to MSPBots internal domain only — configure allowed origins explicitly

---

## Dependency Security

- Keep `@mspbots/*` packages up to date via `mspbots update`
- Review Deno dependency updates in `service/deno.json` before upgrading
- Never add npm packages to the frontend that handle auth, crypto, or DB connections
