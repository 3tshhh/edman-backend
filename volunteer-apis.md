# Volunteer APIs

This document extracts all APIs that a volunteer mobile app can call.

- Global prefix: `/api`
- Success envelope (via interceptor):
  - `statusCode`
  - `message`
  - `data`

## Volunteer Profile Screen

This maps each UI section of the profile screen to its backend API.

### إنجازاتك (Achievements)

**API:** `GET /api/volunteers/me`
**Auth:** `Authorization: Bearer <accessToken>`

Returns the volunteer's profile including three computed counters:

| UI label | Response field | Source |
|---|---|---|
| ساعات تطوع | `totalVolunteeringHours` | Sum of `durationSeconds` across all `COMPLETED` sessions, recalculated automatically when a session ends |
| مهمة مكتملة | `totalCompletedCampaigns` | Count of unique campaigns from ended sessions (`COMPLETED`, `LEFT_EARLY`, `ABANDONED`) |
| أماكن زيارة | `totalVisitedPlaces` | Count of unique places derived from the same sessions |

**Sample response `data`:**
```json
{
  "id": "...",
  "fullName": "...",
  "totalVolunteeringHours": 48,
  "totalCompletedCampaigns": 12,
  "totalVisitedPlaces": 5,
  "applicationStatus": "approved",
  "volunteerGroup": "...",
  ...
}
```

---

### التطوعات الحالية (Current Volunteering)

**API:** `GET /api/sessions/active`
**Auth:** `Authorization: Bearer <accessToken>`

Returns the single active session (status `ACTIVE` or `WAITING_ARRIVAL`), or `null` if none.
The campaign name shown in the card (`حملة معهد الحصري`) comes from `data.campaign.title`.

**Sample response `data`:**
```json
{
  "id": "<sessionId>",
  "status": "WAITING_ARRIVAL",
  "startedAt": null,
  "campaign": {
    "id": "...",
    "title": "حملة معهد الحصري",
    "scheduledDate": "2026-04-10",
    "startTime": "09:00",
    "endTime": "13:00",
    "place": {
      "id": "...",
      "name": "..."
    }
  }
}
```

> Show this card only when `data` is not `null`. The status tells you whether the volunteer is still travelling (`WAITING_ARRIVAL`) or already on site (`ACTIVE`).

---

### الحملات المنتهية (Finished Campaigns)

**API:** `GET /api/sessions/history?page=1&limit=20`
**Auth:** `Authorization: Bearer <accessToken>`

Returns paginated ended sessions (statuses: `COMPLETED`, `LEFT_EARLY`, `ABANDONED`).

**Sample response `data`:**
```json
{
  "data": [
    {
      "id": "<sessionId>",
      "status": "COMPLETED",
      "startedAt": "2026-04-07T09:12:00Z",
      "endedAt": "2026-04-07T13:00:00Z",
      "durationSeconds": 13680,
      "campaign": {
        "title": "حملة معهد الحصري",
        "scheduledDate": "2026-04-07",
        "place": { "name": "..." }
      }
    }
  ],
  "total": 12
}
```

---

### Screen Load Summary

Make these calls in parallel on profile screen open:

```
GET /api/volunteers/me        → achievements counters + profile info
GET /api/sessions/active      → current volunteering card (null = hide card)
GET /api/sessions/history     → finished campaigns list
```

---

## Campaign & Session Flow

This section explains how campaigns (formerly "tasks") and sessions work together from the volunteer's perspective.

### Key Concepts

| Concept | What it is |
|---|---|
| **Campaign** | A scheduled volunteering event at a specific place, for a specific group, with a start/end time and a volunteer cap (`maxVolunteers`). |
| **Session** | A volunteer's participation record for a campaign. Created automatically on enrollment. Tracks status, GPS, photos, and duration. |
| **Enrollment** | The act of a volunteer joining a campaign. Creates a `CampaignEnrollment` row and a `Session` row simultaneously. |

### Full Lifecycle

```
[Admin creates Campaign]
        │
        ▼
[Volunteer sees campaign in GET /api/campaigns/mine]
        │
        ▼
[Volunteer confirms rules  →  POST /api/rules/confirm]   ← required before enrolling
        │
        ▼
[Volunteer enrolls  →  POST /api/campaigns/:id/enroll]
  ┌─────────────────────────────────────────────────────┐
  │  Server creates Session with status WAITING_ARRIVAL  │
  │  (no separate "start" endpoint exists)               │
  └─────────────────────────────────────────────────────┘
        │
        ▼
[Volunteer travels to the campaign place]
        │
        ▼
[Volunteer's app sends GPS via WebSocket  →  /location]
  ┌──────────────────────────────────────────────────────────┐
  │  location.gateway checks distance against               │
  │  campaign.place.proximityThresholdMeters (per-place)     │
  │  If within range → calls confirmArrival()               │
  │    • Session status: WAITING_ARRIVAL → ACTIVE           │
  │    • Session.startedAt = now  (server-set, not client)  │
  │    • First GPS ping logged as isFirstArrival = true     │
  └──────────────────────────────────────────────────────────┘
        │
        ▼
[Session is ACTIVE — volunteer is on site]
  ┌──────────────────────────────────────────────────┐
  │  Periodic GPS pings via WebSocket /location       │
  │    • Logged to GpsAuditLog (audit only, no        │
  │      penalties or challenges)                     │
  │    • session.lastLatitude/Longitude updated       │
  │    • session.gpsCheckCount incremented            │
  │                                                   │
  │  Periodic photos via POST /api/sessions/:id/photos│
  │    • Stored as SessionPhoto with auto-incrementing│
  │      sequenceNo                                   │
  └──────────────────────────────────────────────────┘
        │
        ▼
        ├─── Volunteer leaves early
        │      POST /api/sessions/:id/leave  { reason }
        │        • Session status → LEFT_EARLY
        │        • endedAt = now, durationSeconds calculated
        │        • CampaignEnrollment updated with leaveReason
        │        • volunteer.totalVolunteeringHours recalculated
        │
        ├─── Admin force-abandons (admin API)
        │        • Session status → ABANDONED
        │
        └─── Campaign endTime passes  (cron runs every minute)
               • Cron finds all ACTIVE sessions where
                 campaign.endTime <= now
               • Session status → COMPLETED
               • endedAt = now, durationSeconds calculated
               • volunteer.totalVolunteeringHours recalculated
        │
        ▼
[Session is COMPLETED or LEFT_EARLY]
        │
        ▼
[Volunteer submits feedback  →  POST /api/sessions/:id/feedback]
  (only allowed after session has ended)
```

### Session Status Reference

| Status | Meaning | How entered |
|---|---|---|
| `WAITING_ARRIVAL` | Enrolled, not yet on site | Auto on enrollment |
| `ACTIVE` | On site, clock running | First GPS ping within range (via WebSocket) |
| `COMPLETED` | Finished normally | Auto by cron when campaign `endTime` passes |
| `LEFT_EARLY` | Volunteer left before end | `POST /api/sessions/:id/leave` |
| `ABANDONED` | Force-ended by admin | Admin API |

### Enrollment Guards

Before a volunteer can enroll in a campaign, the server enforces:

1. **Rules confirmed** — `volunteer.rulesConfirmedVersion >= rules.version`, else 403.
2. **No duplicate enrollment** — one active session per volunteer at a time.
3. **Campaign is OPEN** — campaigns with status `FULL` or `CLOSED` reject enrollment.
4. **Volunteer cap** — enrollment count must be below `campaign.maxVolunteers`.

### GPS & Proximity

- Proximity threshold is stored **per place** (`place.proximityThresholdMeters`), not a global env var.
- The **server** performs the proximity check — the client cannot spoof session activation.
- GPS pings during an ACTIVE session are pure audit logs. Being out of range logs a `isWithinRange: false` entry but does **not** penalise the volunteer or end the session.

---

## Auth APIs (Volunteer App)

| Method | Endpoint | Auth | Request Body | Notes |
|---|---|---|---|---|
| POST | `/api/auth/login` | Public | `{ phone: string }` | Starts OTP flow. |
| POST | `/api/auth/verify-otp` | `OTPGuard` (OTP context required) | `{ code: string }` (4 chars) | Verifies OTP and returns tokens. |
| POST | `/api/auth/resend-otp` | `OTPGuard` (OTP context required) | None | Resends OTP for current login context. |
| POST | `/api/auth/logout` | `AuthGuard` | None | Revokes current token `jti`. |
| POST | `/api/auth/refresh-token` | `RefreshTokenGuard` | None | Refreshes access/refresh tokens. |
| GET | `/api/auth/check-token` | `AuthGuard` | None | Validates token and returns user basics. |

## Volunteer Profile/Application APIs

| Method | Endpoint | Auth | Request Body / Query | Notes |
|---|---|---|---|---|
| POST | `/api/volunteers/apply` | `@Auth()` (logged-in user) | `{ fullName, nationalId, nationalIdPhotoKey?, governorate, area, educationalLevel, hasCar? }` | Submit volunteer application. |
| GET | `/api/volunteers/me` | `@Auth(UserRole.VOLUNTEER)` | None | Gets volunteer profile and computed totals. |
| GET | `/api/volunteers/me/history` | `@Auth(UserRole.VOLUNTEER)` | Query: `page?`, `limit?` | Volunteer session history and hours. |
| PATCH | `/api/volunteers/me/fcm-token` | `@Auth(UserRole.VOLUNTEER)` | `{ fcmToken: string }` | Update push token. |

## Campaign APIs (Volunteer-accessible)

| Method | Endpoint | Auth | Request Body / Query | Notes |
|---|---|---|---|---|
| GET | `/api/campaigns/mine` | `@AuthGroup()` | None | Campaigns for volunteer's assigned group. |
| GET | `/api/campaigns/:id` | `@AnyAuth()` | None | Campaign details view. |
| POST | `/api/campaigns/:id/enroll` | `@Auth(UserRole.VOLUNTEER)` | None | Enroll volunteer in campaign. |

## Session APIs (Volunteer)

| Method | Endpoint | Auth | Request Body / Query | Notes |
|---|---|---|---|---|
| GET | `/api/sessions/active` | `@Auth(UserRole.VOLUNTEER)` | None | Get active session. |
| GET | `/api/sessions/history` | `@Auth(UserRole.VOLUNTEER)` | Query: `page?`, `limit?` | Historical sessions. |
| POST | `/api/sessions/:id/gps-ping` | `@Auth(UserRole.VOLUNTEER)` | `{ lat: number, lng: number }` | Sends location ping. |
| POST | `/api/sessions/:id/leave` | `@Auth(UserRole.VOLUNTEER)` | `{ reason: string }` | Leave session early. |
| POST | `/api/sessions/:id/photos` | `@Auth(UserRole.VOLUNTEER)` | `{ photoKey: string }` | Upload/attach periodic photo key. |
| POST | `/api/sessions/:id/feedback` | `@Auth(UserRole.VOLUNTEER)` | `{ text: string }` | Submit session feedback. |

## Rules APIs (Volunteer-accessible)

| Method | Endpoint | Auth | Request Body | Notes |
|---|---|---|---|---|
| GET | `/api/rules` | `@AnyAuth()` | None | Fetch latest rules text/version. |
| POST | `/api/rules/confirm` | `@Auth(UserRole.VOLUNTEER)` | None | Confirm latest rules for volunteer. |

## Performance APIs (Volunteer)

| Method | Endpoint | Auth | Request Body | Notes |
|---|---|---|---|---|
| GET | `/api/performance/me` | `@Auth(UserRole.VOLUNTEER)` | None | Volunteer own performance stats. |

## Places/Centers APIs (Volunteer-accessible)

| Method | Endpoint | Auth | Request Body / Query | Notes |
|---|---|---|---|---|
| GET | `/api/places/mine` | `@AuthGroup()` | None | Places for volunteer group. |
| GET | `/api/places/:id` | `@AnyAuth()` | None | Place details. |
| GET | `/api/centers/mine` | `@AuthGroup()` | None | Centers for volunteer group. |
| GET | `/api/centers/:id` | `@AnyAuth()` | None | Center details. |

## Notification/Chat/Upload APIs (Volunteer-accessible)

| Method | Endpoint | Auth | Request Body | Notes |
|---|---|---|---|---|
| GET | `/api/notifications/unread` | `@Auth()` | None | Fetch unread notifications for current user. |
| POST | `/api/notifications/:id/read` | `@Auth()` | None | Mark notification as read. |
| POST | `/api/chat/sessions/:sessionId/messages` | `@Auth()` | `{ content: string }` | Send chat message in session context. |
| POST | `/api/uploads/presign` | `@Auth()` | `{ filename: string, contentType: string }` | Get S3 presigned upload URL. |

## Token Header Notes

- Access token header:
  - `Authorization: Bearer <accessToken>`
- Refresh token header:
  - `Authorization-Refresh: Bearer <refreshToken>`

## Source Controllers

- `src/modules/auth/auth.controller.ts`
- `src/modules/volunteers/volunteers.controller.ts`
- `src/modules/campaigns/campaigns.controller.ts`
- `src/modules/sessions/sessions.controller.ts`
- `src/modules/rules/rules.controller.ts`
- `src/modules/performance/performance.controller.ts`
- `src/modules/places/places.controller.ts`
- `src/modules/centers/centers.controller.ts`
- `src/modules/notifications/notifications.controller.ts`
- `src/modules/chat/chat.controller.ts`
- `src/modules/uploads/uploads.controller.ts`
