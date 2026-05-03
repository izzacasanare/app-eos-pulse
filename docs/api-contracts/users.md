# EOS Pulse — Users & Teams API Contract

> Handler: `service/handlers/users.handler.ts`
> Domains: `service/domain/users.domain.ts`, `service/domain/teams.domain.ts`

---

## Authentication

All routes rely on the MSPBots platform auth layer.
Role enforcement is noted per route; `super_admin` routes return `403` if the caller lacks the role.

---

## Teams

### `GET /api/teams`

List all teams ordered by name.

**Auth:** Any authenticated user.

**Response `200`**
```json
{
  "teams": [
    {
      "id":        "uuid",
      "name":      "Leadership",
      "type":      "both",
      "createdAt": "2026-04-29T00:00:00.000Z"
    }
  ]
}
```

`type` values: `"l10"` | `"quarterly"` | `"both"`

---

### `GET /api/teams/:id/members`

Get a team and its members.

**Auth:** Any authenticated user.

**Path params**

| Param | Type   |
|-------|--------|
| id    | uuid   |

**Response `200`**
```json
{
  "team": {
    "id":        "uuid",
    "name":      "Dev",
    "type":      "l10",
    "createdAt": "2026-04-29T00:00:00.000Z"
  },
  "members": [
    {
      "id":        "uuid",
      "name":      "Izza Casanare",
      "email":     "izza@mspbots.ai",
      "role":      "team_lead",
      "teamId":    "uuid",
      "createdAt": "2026-04-29T00:00:00.000Z"
    }
  ]
}
```

**Response `200` (team not found)**
```json
{ "error": "NOT_FOUND", "message": "Team not found" }
```

---

## Users

### `GET /api/users`

List all users ordered by name.

**Auth:** `super_admin` only.

**Response `200`**
```json
{
  "users": [
    {
      "id":        "uuid",
      "name":      "Izza Casanare",
      "email":     "izza@mspbots.ai",
      "role":      "super_admin",
      "teamId":    "uuid",
      "createdAt": "2026-04-29T00:00:00.000Z"
    }
  ]
}
```

`role` values: `"super_admin"` | `"leadership"` | `"team_lead"` | `"host"` | `"member"`

---

### `GET /api/users/:id`

Get a single user by ID.

**Auth:** Any authenticated user.

**Path params**

| Param | Type |
|-------|------|
| id    | uuid |

**Response `200`**
```json
{
  "user": {
    "id":        "uuid",
    "name":      "Izza Casanare",
    "email":     "izza@mspbots.ai",
    "role":      "member",
    "teamId":    "uuid",
    "createdAt": "2026-04-29T00:00:00.000Z"
  }
}
```

**Response `200` (not found)**
```json
{ "error": "NOT_FOUND", "message": "User not found" }
```

---

### `POST /api/users`

Create a new user.

**Auth:** `super_admin` only.

**Request body**
```json
{
  "name":   "Izza Casanare",
  "email":  "izza@mspbots.ai",
  "role":   "member",
  "teamId": "uuid"
}
```

| Field   | Type   | Required | Notes                        |
|---------|--------|----------|------------------------------|
| name    | string | yes      |                              |
| email   | string | yes      | Must be unique               |
| role    | string | yes      | One of the 5 role values     |
| teamId  | uuid   | no       | Primary team assignment      |

**Response `200`**
```json
{ "user": { /* User object */ } }
```

**Response `200` (validation error)**
```json
{ "error": "VALIDATION_ERROR", "message": "name, email, and role are required" }
```

**Response `200` (duplicate email)**
```json
{ "error": "CONFLICT", "message": "A user with email 'izza@mspbots.ai' already exists." }
```

---

### `PUT /api/users/:id`

Update a user's name, role, or team assignment.

**Auth:** `super_admin` only.

**Path params**

| Param | Type |
|-------|------|
| id    | uuid |

**Request body** (all fields optional)
```json
{
  "name":   "Izza Casanare",
  "role":   "team_lead",
  "teamId": "uuid"
}
```

Pass `"teamId": null` to remove team assignment.

**Response `200`**
```json
{ "user": { /* updated User object */ } }
```

**Response `200` (not found)**
```json
{ "error": "NOT_FOUND", "message": "User 'uuid' not found." }
```

---

## Seed (dev only)

### `GET /api/seed`

Creates the 6 canonical MSPBots teams if they don't already exist.
**Remove before v1 publish.**

**Auth:** No auth check (dev endpoint).

**Response `200`**
```json
{
  "ok":      true,
  "created": ["Leadership", "Revenue", "CSM"],
  "skipped": ["Operations", "Product", "Dev"]
}
```

`created` — teams inserted on this call.
`skipped` — teams that already existed.

---

## Domain Errors

| Error class            | HTTP meaning   | When thrown                          |
|------------------------|----------------|--------------------------------------|
| `UserNotFoundError`    | 404 equivalent | `updateUser` called with unknown id  |
| `UserEmailConflictError` | 409 equivalent | `createUser` with duplicate email   |
| `TeamNotFoundError`    | 404 equivalent | `getTeamById` returns null           |
