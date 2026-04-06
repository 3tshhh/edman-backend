---
name: update-postman
description: Update the Postman collection to reflect newly implemented endpoints after completing a phase.
disable-model-invocation: true
---

# Update Postman Collection

Update the `edman-api.postman_collection.json` file to reflect the latest implemented phase.

## Instructions

1. **Read the current state:**
   - Read `agent-context/backend_context.md` to get the full API specification (endpoints, request bodies, response shapes, query params, path params).
   - Read the current `edman-api.postman_collection.json` to understand what already exists.
   - Identify which modules/endpoints were added or changed in the most recently completed phase.

2. **For each new or updated endpoint, ensure:**
   - The request method, URL (`{{baseUrl}}/api/...`), headers, and body match `backend_context.md` exactly.
   - Every required field from the DTO is present in the request body with realistic placeholder values.
   - Path params (`:id`, `:taskId`, etc.) use collection variables where appropriate (e.g. `{{volunteerId}}`, `{{taskId}}`).
   - Auth headers use `Bearer {{accessToken}}` (or `{{adminAccessToken}}` for admin-only routes).
   - Query params (pagination, filters) are included with sensible defaults.

3. **Auto-variable test scripts:**
   - Every response that returns an ID, token, or reusable value must have a `Tests` script that extracts it into a collection variable.
   - Pattern: `pm.collectionVariables.set("varName", jsonData.data.field)`.
   - Key variables to capture: `accessToken`, `refreshToken`, `otpSessionToken`, `volunteerId`, `taskId`, `sessionId`, `placeId`, `centerId`, `announcementId`, `uploadKey`, `uploadUrl`, `adminAccessToken`, `adminRefreshToken`, `ruleId`, and any new IDs introduced by the phase.
   - For list endpoints, extract the first item's ID as a convenience variable.

4. **Collection structure:**
   - Group requests into folders by module (Auth, Volunteers, Rules, Places, Centers, Tasks, Sessions, Uploads, Feed, Performance, Map, Chatbot).
   - Create new folders for any new modules added in the phase.
   - Order requests within folders by logical flow (create → list → get → update → delete).

5. **Collection variables:**
   - Add any new collection variables with empty default values.
   - Keep `baseUrl` set to `http://localhost:3000`.
   - Do not remove existing variables.

6. **Present the changes:**
   - List all new/updated requests and new collection variables.
   - Wait for user approval before writing the updated file.

## Do NOT

- Remove or modify existing working requests unless the endpoint signature changed.
- Guess endpoint shapes — only use what is defined in `backend_context.md` and the actual implemented code.
- Execute the update without showing the user what will change and getting explicit approval.
