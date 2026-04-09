# Admin Rules APIs

Extracted from the current rules module implementation.

- Global prefix: `/api`
- Success envelope:
  - `statusCode`
  - `message`
  - `data`

## 1. Admin-only Rules API

### POST /api/rules

- Purpose: Create new rules if none exist, or update existing rules content and increment version.
- Auth: `@AdminAuth()` (admin token required)
- Controller: `RulesController.createOrUpdate`

Request body:

```json
{
  "content": "string"
}
```

Validation:
- `content`: required, string

Behavior from service:
- If no rules exist:
  - creates record with `version = 1`
  - sets `updatedBy` to current admin user id
- If rules exist:
  - updates `content`
  - increments `version` by 1
  - sets `updatedBy` to current admin user id

Typical response data:

```json
{
  "id": "uuid",
  "content": "...",
  "version": 2,
  "updatedBy": {
    "id": "admin-user-id"
  },
  "createdAt": "...",
  "updatedAt": "..."
}
```

## 2. Admin-accessible (shared) Rules API

### GET /api/rules

- Purpose: Fetch latest rules.
- Auth: `@AnyAuth()` (admin or volunteer)
- Controller: `RulesController.getLatest`

Request body: none

Response data:
- Latest rules record or `null` if none exists.

## Notes

- The volunteer confirmation endpoint `POST /api/rules/confirm` is not an admin API.
- If you want strictly admin-only rules APIs, then only `POST /api/rules` qualifies.

## Source

- `src/modules/rules/rules.controller.ts`
- `src/modules/rules/rules.service.ts`
- `src/modules/rules/dto/create-rules.dto.ts`
- `src/common/decorators/index.ts`
