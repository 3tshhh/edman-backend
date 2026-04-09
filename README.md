# EFADA Backend API (`edman-backend`)

<div align="right" dir="rtl">

# إفادة — واجهة برمجية للتطبيق

</div>

> **EN:** This is the backend REST API and WebSocket server for **EFADA (إفادة)**, an Egyptian government volunteer program for spreading drug-addiction awareness in schools, universities, workplaces, and public places. It is the single source of truth for volunteer data, campaigns, GPS-verified sessions, and push notifications across all system clients.
>
> <div dir="rtl">
>
> **AR:** هذا هو الخادم الخلفي لبرنامج **إفادة** الحكومي التطوعي، المسؤول عن إدارة بيانات المتطوعين والحملات والجلسات الميدانية وإشعارات الدفع عبر جميع عملاء النظام.
>
> </div>

---

## Table of Contents

1. [Project Overview & Scope](#1-project-overview--scope-الرؤية-والنطاق)
2. [Technical Documentation](#2-technical-documentation-الوثائق-التقنية)
3. [Setup & Deployment](#3-setup--deployment-الإعداد-والنشر)
4. [User & Testing Documentation](#4-user--testing-documentation-دليل-التشغيل-والاختبار)

---

## 1. Project Overview & Scope (الرؤية والنطاق)

### 1.1 Project Goals — أهداف المشروع

<div dir="rtl">

يهدف برنامج **إفادة** إلى تمكين المواطنين من التطوع في حملات توعوية ضد إدمان المخدرات في المدارس والجامعات وأماكن العمل والأماكن العامة. يتولى هذا الخادم الخلفي المهام التالية:

</div>

The backend API is responsible for:

- **Single source of truth** — persisting all volunteer profiles, applications, campaign schedules, enrollment records, and session logs in a single PostgreSQL database.
- **GPS-verified attendance** — tracking volunteer presence at campaign places in real time via WebSocket. Session activation (WAITING_ARRIVAL → ACTIVE) is triggered server-side the moment a volunteer's GPS ping falls within the place's configured proximity threshold; the client cannot spoof this.
- **Certificate-eligible hour tracking** — `totalVolunteeringHours` on the `Volunteer` entity is recomputed from `durationSeconds` on every completed session. This value is the canonical number for certificate issuance.
- **Real-time coordination** — the `/location` WebSocket namespace streams volunteer GPS positions to admin dashboards and confirms session arrival back to volunteers.
- **Push notifications** — Firebase Cloud Messaging (FCM) delivers application results (approved / rejected / banned) and feed announcements directly to volunteer devices, both while online (WebSocket) and offline (FCM topic push).
- **AI chatbot** — a Google Gemini-backed assistant answers volunteer questions about the program in Arabic, with conversation context held in Redis (1-hour TTL) and full history persisted in PostgreSQL.

### 1.2 Target Consumers — العملاء المستهدفون

This API has exactly two clients. They share the same base URL and authentication infrastructure but use different auth flows and see different data scopes.

| Client | Auth method | Primary concerns |
|---|---|---|
| **Admin dashboard** (`edman-admins` — React/Vite) | Email + password → JWT access/refresh | Volunteer application review, campaign scheduling, live map, announcements, leaderboard, session management |
| **Volunteer mobile app** (separate repo — already shipped) | Phone + OTP → JWT access/refresh | Apply, view campaigns, GPS check-in, session history, feed, AI chatbot |

### 1.3 Scope Statement — النطاق

#### In Scope (داخل النطاق)

- Volunteer registration and application lifecycle (apply → pending → approved/rejected/banned).
- Group assignment by admins (`VolunteerGroup` enum — admin-assigned, never volunteer-chosen).
- Centers and Places CRUD with Google Maps link → lat/lng extraction.
- Campaign planning (schedule, capacity, status machine: open → full → in_progress → completed/cancelled).
- Campaign enrollment with rules-version gate.
- Volunteer session lifecycle: WAITING_ARRIVAL → ACTIVE (GPS) → COMPLETED (cron auto-complete or manual feedback).
- GPS audit logging (pure append-only log, no penalties).
- Session photos (sequential, uploaded to S3 via presigned PUT).
- Feed announcements with FCM broadcast to group topics or `all_volunteers`.
- Rules management with version gate — volunteers must confirm before next enrollment.
- Performance metrics and leaderboard (hours, campaigns, places, GPS consistency).
- Live map context endpoint + WebSocket streaming.
- S3 presigned PUT URL generation (client uploads binary directly to S3).
- AI chatbot powered by Google Gemini (`/chat/sessions/:id/messages`).
- In-app notification inbox (unread count, mark-as-read).
- Admin account management (root admin seeded from env; additional admins created by existing admins).

#### Out of Scope (خارج النطاق)

- The volunteer mobile app UI and the admin dashboard UI — separate repos.
- Payment processing — EFADA is a government program; volunteers are not compensated.
- Donor or sponsor management.
- Certificate PDF generation — the backend tracks eligible hours; PDF rendering is handled externally.
- Rate limiting — deferred (not implemented).
- Multi-language support — Arabic is the only user-facing language.
- Email delivery — phone + FCM only.
- Volunteer-to-volunteer messaging — the chatbot is AI-only.
- SMS delivery — Twilio variables exist in `.env` as placeholders; no integration is implemented.

### 1.4 Features List — قائمة المزايا

| Bounded context | Feature | Status |
|---|---|---|
| **Auth (volunteer)** | Phone → OTP → JWT access + refresh tokens | Complete |
| **Auth (volunteer)** | Token refresh, logout (blacklist via Redis) | Complete |
| **Auth (admin)** | Email + password → JWT | Complete |
| **Volunteers** | Apply with profile data + national ID photo key | Complete |
| **Volunteers** | Admin review: approve / reject / ban | Complete |
| **Volunteers** | Group assignment and re-assignment | Complete |
| **Volunteers** | FCM token registration | Complete |
| **Centers** | CRUD — treatment centers, lat/lng from Maps link | Complete |
| **Places** | CRUD — campaign venues, proximity threshold per place | Complete |
| **Places** | Photo upload via S3 presigned URL | Complete |
| **Campaigns** | CRUD with status machine | Complete |
| **Campaigns** | Enrollment with rules-version gate | Complete |
| **Sessions** | Auto-creation on enrollment | Complete |
| **Sessions** | GPS-triggered activation (server-side proximity check) | Complete |
| **Sessions** | Early leave (volunteer) + force abandon (admin) | Complete |
| **Sessions** | Cron auto-complete at campaign end time | Complete |
| **Sessions** | Periodic photo logging | Complete |
| **Sessions** | Post-session feedback | Complete |
| **Sessions** | GPS audit log (Redis buffer → PG flush on session end) | Complete |
| **Feed** | Announcements CRUD, group targeting | Complete |
| **Feed** | FCM push to group or all-volunteers topic | Complete |
| **Rules** | Versioned rules document, volunteer confirmation gate | Complete |
| **Performance** | Volunteer leaderboard (hours, campaigns, places, GPS score) | Complete |
| **Performance** | Group aggregate stats | Complete |
| **Live Map** | `GET /map/context` — initial state snapshot | Complete |
| **Live Map** | WebSocket `/location` — real-time GPS streaming to admins | Complete |
| **Uploads** | S3 presigned PUT URL generation (15-min expiry) | Complete |
| **Notifications** | In-app notification inbox (unread, mark-read) | Complete |
| **Notifications** | FCM push for application results + announcements | Complete |
| **Notifications** | WebSocket `/notifications` namespace (rooms wired, no events emitted yet — see §2.6) | Scaffolded |
| **Chatbot** | Google Gemini chat with Redis context + PG history | Complete |

---

## 2. Technical Documentation (الوثائق التقنية)

<div dir="rtl">

### ٢. الوثائق التقنية

</div>

### 2.1 Tech Stack — التقنيات المستخدمة

| Category | Technology | Version | Notes |
|---|---|---|---|
| Language | TypeScript | ~5.7 | `strict: true`, `target: ES2023`, `module: nodenext` |
| Framework | NestJS | ^11.0 | Entry point: [src/main.ts](src/main.ts) |
| ORM | TypeORM | ^0.3 | `synchronize: true` — no migrations (see §3.3) |
| Database | PostgreSQL | 16 (Docker) | UTF-8, enum columns for Arabic string values |
| Cache / session store | Redis | 7 (Docker) | `@keyv/redis` + `@nestjs/cache-manager` |
| Object storage | AWS S3 | `@aws-sdk/client-s3` ^3 | Presigned PUT only; client uploads directly |
| Push notifications | Firebase Cloud Messaging | `firebase-admin` ^13 | Topic-based for announcements; token-based for results |
| Realtime | Socket.IO | ^4.8 | `/location` (live GPS), `/notifications` (scaffolded) |
| Scheduling | `@nestjs/schedule` | ^6.1 | One cron job — see §2.7 |
| AI chatbot | Google Gemini | `@google/generative-ai` ^0.24 | Default model: `gemini-2.0-flash` |
| Auth | `@nestjs/jwt` | ^11 | Custom guards — no Passport |
| Validation | `class-validator` + `class-transformer` | ^0.14 / ^0.5 | Global `ValidationPipe` (whitelist, forbidNonWhitelisted, transform) |
| Password hashing | `bcrypt` | ^6.0 | Admin passwords + OTP hashes |
| API docs | `@nestjs/swagger` | ^11 | Available at `/api/docs` — see §2.5 |
| Logging | NestJS `Logger` + `RequestLoggerMiddleware` | built-in | All inbound requests logged via [src/common/middleware/request-logger.middleware.ts](src/common/middleware/request-logger.middleware.ts) |
| Testing | Jest + `@nestjs/testing` + Supertest | ^30 / ^7 | No unit tests yet — see §4.2 |
| Linting | ESLint + typescript-eslint + Prettier | ^9 / ^8 / ^3 | Config: [eslint.config.mjs](eslint.config.mjs), [.prettierrc](.prettierrc) |

### 2.2 Architecture Diagram — مخطط البنية

```mermaid
flowchart LR
    subgraph Clients["Clients"]
        Admin["Admin Dashboard\n(edman-admins, React/Vite)"]
        Mobile["Volunteer Mobile App\n(separate repo)"]
    end

    subgraph API["Backend — edman-backend (NestJS)"]
        REST["REST API\n/api/*"]
        WS_LOC["WebSocket /location\n(GPS + live map)"]
        WS_NOTIF["WebSocket /notifications\n(scaffolded)"]
        CRON["Cron Worker\n*/1 * * * *\nauto-complete sessions"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL\nvolunteers_db")]
        RD[("Redis\nlocation cache\nOTP blacklist\nsession context\nchat context")]
        S3[("AWS S3\nuploads/")]
    end

    subgraph External["External Services"]
        FCM["Firebase Cloud\nMessaging (FCM)"]
        GEMINI["Google Gemini API\nchatbot"]
    end

    Admin -->|HTTPS REST + JWT| REST
    Admin -->|WebSocket + JWT| WS_LOC
    Admin -->|PUT presigned| S3

    Mobile -->|HTTPS REST + JWT| REST
    Mobile -->|WebSocket + JWT| WS_LOC
    Mobile -->|PUT presigned| S3

    REST --> PG
    REST --> RD
    REST -->|presign| S3
    REST -->|send push| FCM
    REST <-->|chat| GEMINI

    WS_LOC --> RD
    WS_LOC --> PG

    CRON --> PG

    FCM -->|push| Mobile

    classDef client fill:#D4A989,stroke:#6B2D1B,color:#1a1a1a
    classDef api fill:#E8DDD4,stroke:#8B4533,color:#1a1a1a
    classDef data fill:#f0ebe5,stroke:#8B4533,color:#1a1a1a
    classDef ext fill:#f4f4f4,stroke:#888,color:#333

    class Admin,Mobile client
    class REST,WS_LOC,WS_NOTIF,CRON api
    class PG,RD,S3 data
    class FCM,GEMINI ext
```

### 2.3 Database Schema (ERD) — مخطط قاعدة البيانات

Generated from the entity files in [src/modules/](src/modules/). TypeORM `synchronize: true` creates/alters tables on startup.

```mermaid
erDiagram
    USER ||--o| VOLUNTEER : "OneToOne (userId FK)"
    USER ||--o{ NOTIFICATION : "ManyToOne (userId FK)"
    USER ||--o{ CHAT_MESSAGE : "ManyToOne (userId FK)"

    VOLUNTEER }o--o| ADMIN : "ManyToOne reviewedBy (nullable)"
    ADMIN ||--o{ CAMPAIGN : "ManyToOne createdBy"
    ADMIN ||--o{ ANNOUNCEMENT : "ManyToOne author"
    ADMIN ||--o{ RULES : "ManyToOne updatedBy"

    PLACE ||--o{ CAMPAIGN : "ManyToOne place"
    CAMPAIGN ||--o{ CAMPAIGN_ENROLLMENT : "OneToMany (CASCADE delete)"
    VOLUNTEER ||--o{ CAMPAIGN_ENROLLMENT : "ManyToOne volunteer"

    CAMPAIGN ||--o{ SESSION : "ManyToOne campaign (CASCADE delete)"
    VOLUNTEER ||--o{ SESSION : "ManyToOne volunteer"
    SESSION ||--o{ GPS_AUDIT_LOG : "ManyToOne session (CASCADE delete)"
    VOLUNTEER ||--o{ GPS_AUDIT_LOG : "ManyToOne volunteer"
    SESSION ||--o{ SESSION_PHOTO : "ManyToOne session (CASCADE delete)"

    USER {
        uuid id PK
        varchar phone UK "unique, indexed"
        enum role "volunteer | null"
        boolean isPhoneVerified "default false"
        varchar fcmToken "nullable"
        timestamp createdAt
        timestamp updatedAt
    }

    VOLUNTEER {
        uuid id PK
        uuid userId FK "OneToOne → users"
        varchar fullName
        varchar nationalId UK "14-char, indexed"
        varchar nationalIdPhotoKey "S3 key, nullable"
        enum governorate "الجيزة"
        enum area "الهرم | فيصل"
        enum educationalLevel "ثانوي | بكالوريوس | لا يوجد"
        boolean hasCar "default false"
        varchar profilePhoto "S3 key, nullable"
        enum volunteerGroup "الهرم | فيصل | null"
        enum applicationStatus "pending | approved | rejected | banned"
        text rejectionReason "nullable"
        timestamp appliedAt
        timestamp reviewedAt "nullable"
        uuid reviewedById FK "→ admins, nullable"
        int rulesConfirmedVersion "default 0"
        decimal totalVolunteeringHours "precision 10.2, default 0"
    }

    ADMIN {
        uuid id PK
        varchar email UK "indexed"
        varchar password "bcrypt hash"
        varchar name
        varchar nationalId UK "nullable, indexed"
        timestamp createdAt
    }

    CENTER {
        uuid id PK
        varchar name UK
        text description "nullable"
        decimal latitude "precision 10.7"
        decimal longitude "precision 10.7"
        enum volunteerGroup "الهرم | فيصل"
        varchar address "nullable"
        varchar addressLink
        timestamp createdAt
    }

    PLACE {
        uuid id PK
        varchar name UK
        text description "nullable"
        decimal latitude "precision 10.7"
        decimal longitude "precision 10.7"
        enum volunteerGroup "الهرم | فيصل"
        varchar placeType "nullable"
        varchar photoKey "S3 key, nullable"
        int proximityThresholdMeters "default 300"
        varchar address "nullable"
        varchar addressLink
        timestamp createdAt
    }

    CAMPAIGN {
        uuid id PK
        varchar title
        text description "nullable"
        uuid placeId FK "→ places"
        enum volunteerGroup "الهرم | فيصل"
        date scheduledDate
        time startTime
        time endTime
        int maxVolunteers "default 10"
        enum status "open | full | in_progress | completed | cancelled"
        uuid createdById FK "→ admins"
        timestamp createdAt
        timestamp updatedAt
    }

    CAMPAIGN_ENROLLMENT {
        uuid id PK
        uuid volunteerId FK "→ volunteers"
        uuid campaignId FK "→ campaigns (CASCADE delete)"
        timestamp enrolledAt
        text leaveReason "nullable"
        timestamp leftAt "nullable"
    }

    SESSION {
        uuid id PK
        uuid volunteerId FK "→ volunteers"
        uuid campaignId FK "→ campaigns (CASCADE delete)"
        enum status "waiting_arrival | active | completed | left_early | abandoned"
        timestamp startedAt "nullable — set on GPS arrival"
        timestamp endedAt "nullable"
        int durationSeconds "nullable"
        text endReason "nullable"
        text feedback "nullable"
        timestamp feedbackAt "nullable"
        decimal lastLatitude "precision 10.7, nullable"
        decimal lastLongitude "precision 10.7, nullable"
        int gpsCheckCount "default 0"
        timestamp createdAt
    }

    GPS_AUDIT_LOG {
        uuid id PK
        uuid sessionId FK "→ sessions (CASCADE delete)"
        uuid volunteerId FK "→ volunteers"
        decimal latitude "precision 10.7"
        decimal longitude "precision 10.7"
        boolean isWithinRange
        boolean isFirstArrival "default false"
        timestamp createdAt
    }

    SESSION_PHOTO {
        uuid id PK
        uuid sessionId FK "→ sessions (CASCADE delete)"
        varchar photoKey "S3 key"
        timestamp takenAt
        int sequenceNo "auto-incrementing per session"
    }

    RULES {
        uuid id PK
        text content
        int version
        timestamp updatedAt
        uuid updatedById FK "→ admins"
    }

    ANNOUNCEMENT {
        uuid id PK
        uuid authorId FK "→ admins"
        enum targetGroup "الهرم | فيصل | null (= all)"
        varchar title
        text body
        simple_array attachments "S3 keys, nullable"
        varchar priority "nullable, freeform"
        timestamp createdAt
        timestamp updatedAt
    }

    NOTIFICATION {
        uuid id PK
        uuid userId FK "→ users"
        varchar title
        text body
        varchar type "nullable"
        boolean isRead "default false"
        jsonb metadata "nullable"
        timestamp createdAt
    }

    CHAT_MESSAGE {
        uuid id PK
        uuid userId FK "→ users, indexed"
        varchar sessionId "chat session UUID, nullable"
        enum role "user | assistant"
        text content
        timestamp createdAt
    }
```

### 2.4 Module Map — خريطة الوحدات

All modules live under [src/modules/](src/modules/). Infrastructure modules ([src/config/](src/config/), [src/common/](src/common/)) are described separately below.

| Module | Path | Purpose |
|---|---|---|
| `AuthModule` | [src/modules/auth/](src/modules/auth/) | Volunteer phone + OTP flow, JWT issuance, logout, token refresh |
| `OtpModule` | [src/modules/otp/](src/modules/otp/) | OTP generation, bcrypt verification, Redis-backed invalidation |
| `UserModule` | [src/modules/user/](src/modules/user/) | `users` table access — auth identity (phone, role, FCM token) |
| `AdminsModule` | [src/modules/admins/](src/modules/admins/) | Admin email/password auth, admin registration, root admin seeding |
| `VolunteersModule` | [src/modules/volunteers/](src/modules/volunteers/) | Volunteer profiles, application lifecycle, group assignment, ban |
| `CentersModule` | [src/modules/centers/](src/modules/centers/) | Treatment center CRUD, Google Maps link → lat/lng extraction |
| `PlacesModule` | [src/modules/places/](src/modules/places/) | Volunteering venue CRUD, proximity threshold, open campaign count |
| `CampaignsModule` | [src/modules/campaigns/](src/modules/campaigns/) | Campaign CRUD, enrollment with rules gate, status transitions |
| `SessionsModule` | [src/modules/sessions/](src/modules/sessions/) | Session lifecycle, GPS ping REST fallback, photos, feedback, abandon, cron auto-complete |
| `UploadsModule` | [src/modules/uploads/](src/modules/uploads/) | AWS S3 presigned PUT URL generation (15-min expiry) |
| `RulesModule` | [src/modules/rules/](src/modules/rules/) | Versioned rules document, volunteer confirmation endpoint |
| `FeedModule` | [src/modules/feed/](src/modules/feed/) | Announcement CRUD, group targeting, FCM broadcast on create |
| `NotificationsModule` | [src/modules/notifications/](src/modules/notifications/) | FCM push (tokens + topics), in-app notification inbox, `/notifications` WebSocket namespace |
| `MapModule` | [src/modules/map/](src/modules/map/) | `GET /map/context` — snapshot of all active sessions + volunteers from Redis + PG |
| `PerformanceModule` | [src/modules/performance/](src/modules/performance/) | Hours, campaign count, place count, GPS consistency score, leaderboard, group stats |
| `LocationModule` | [src/modules/location/](src/modules/location/) | `/location` WebSocket gateway — GPS ingestion, session confirmation, admin live map |
| `ChatModule` | [src/modules/chat/](src/modules/chat/) | Gemini-backed AI chatbot, Redis context (1h TTL), PG message history |

**Infrastructure:**

| Path | Purpose |
|---|---|
| [src/config/configuration.ts](src/config/configuration.ts) | Typed `ConfigModule` factory — reads all env vars |
| [src/config/database.config.ts](src/config/database.config.ts) | TypeORM + Redis cache module factories |
| [src/common/guards/](src/common/guards/) | `AuthGuard`, `AdminAuthGuard`, `AnyAuthGuard`, `RolesGuard`, `GroupsGuard`, `OTPGuard` |
| [src/common/decorators/index.ts](src/common/decorators/index.ts) | Composite decorators: `@Auth()`, `@AdminAuth()`, `@AnyAuth()`, `@AuthGroup()` |
| [src/common/interceptors/unified-response.interceptor.ts](src/common/interceptors/unified-response.interceptor.ts) | Wraps every response in `{ statusCode, message, data }` |
| [src/common/filters/http-exception.filter.ts](src/common/filters/http-exception.filter.ts) | Maps exceptions to `{ statusCode, message, timestamp, path }` |
| [src/common/services/token.service.ts](src/common/services/token.service.ts) | JWT sign/verify, refresh token rotation, Redis blacklist |
| [src/common/utils/location.utils.ts](src/common/utils/location.utils.ts) | Haversine-based `isWithinProximity()` — proximity gate for session activation |
| [src/common/utils/google-maps.util.ts](src/common/utils/google-maps.util.ts) | Extracts lat/lng from Google Maps share links |
| [src/scripts/seed.ts](src/scripts/seed.ts) | Standalone seed script — creates root admin from env |

### 2.5 API Documentation — توثيق نقاط النهاية

**Swagger UI:** available at `http://localhost:3000/api/docs` when the server is running ([main.ts:31](src/main.ts#L31)). Bearer token auth is pre-configured in the UI.

**To regenerate the OpenAPI JSON spec:**
```bash
# Start the server, then:
curl http://localhost:3000/api/docs-json > openapi.json
```

**Canonical API contract:** [admin-contract.md](admin-contract.md) in this repo contains the full request/response shapes, query params, side effects, and error codes for every admin-facing endpoint.

**Response envelope** — every REST response is wrapped by `UnifiedResponseInterceptor`:
```json
{ "statusCode": 200, "message": "success", "data": { ... } }
```

**Endpoint index by module** (all routes are prefixed with `/api`):

| Module | Method | Path | Auth | Consumer |
|---|---|---|---|---|
| **Auth** | POST | `/auth/send-otp` | Public | Mobile |
| | POST | `/auth/login` | Public | Mobile |
| | POST | `/auth/verify-otp` | OTP token | Mobile |
| | POST | `/auth/resend-otp` | OTP token | Mobile |
| | POST | `/auth/logout` | JWT | Both |
| | POST | `/auth/refresh-token` | Refresh JWT | Both |
| | GET | `/auth/check-token` | JWT | Both |
| **Admins** | POST | `/admins/login` | Public | Dashboard |
| | POST | `/admins/register` | Admin JWT | Dashboard |
| **Volunteers** | POST | `/volunteers/apply` | JWT | Mobile |
| | GET | `/volunteers/me` | JWT (volunteer) | Mobile |
| | GET | `/volunteers/me/history` | JWT (volunteer) | Mobile |
| | PATCH | `/volunteers/me/fcm-token` | JWT (volunteer) | Mobile |
| | GET | `/volunteers` | Admin JWT | Dashboard |
| | GET | `/volunteers/applications` | Admin JWT | Dashboard |
| | GET | `/volunteers/:id` | Admin JWT | Dashboard |
| | PATCH | `/volunteers/:id/approve` | Admin JWT | Dashboard |
| | PATCH | `/volunteers/:id/reject` | Admin JWT | Dashboard |
| | PATCH | `/volunteers/:id/group` | Admin JWT | Dashboard |
| | PATCH | `/volunteers/:id/ban` | Admin JWT | Dashboard |
| **Centers** | GET | `/centers/mine` | JWT (approved volunteer) | Mobile |
| | GET | `/centers` | Admin JWT | Dashboard |
| | GET | `/centers/:id` | JWT (any) | Both |
| | POST | `/centers` | Admin JWT | Dashboard |
| | PATCH | `/centers/:id` | Admin JWT | Dashboard |
| | DELETE | `/centers/:id` | Admin JWT | Dashboard |
| **Places** | GET | `/places/mine` | JWT (approved volunteer) | Mobile |
| | GET | `/places` | Admin JWT | Dashboard |
| | GET | `/places/:id` | JWT (any) | Both |
| | POST | `/places` | Admin JWT | Dashboard |
| | PATCH | `/places/:id` | Admin JWT | Dashboard |
| | DELETE | `/places/:id` | Admin JWT | Dashboard |
| **Campaigns** | GET | `/campaigns/mine` | JWT (approved volunteer) | Mobile |
| | GET | `/campaigns` | Admin JWT | Dashboard |
| | GET | `/campaigns/:id` | JWT (any) | Both |
| | POST | `/campaigns/:id/enroll` | JWT (volunteer) | Mobile |
| | POST | `/campaigns` | Admin JWT | Dashboard |
| | PATCH | `/campaigns/:id` | Admin JWT | Dashboard |
| | DELETE | `/campaigns/:id` | Admin JWT | Dashboard |
| **Sessions** | GET | `/sessions/active` | JWT (volunteer) | Mobile |
| | GET | `/sessions/history` | JWT (volunteer) | Mobile |
| | POST | `/sessions/:id/gps-ping` | JWT (volunteer) | Mobile (REST fallback) |
| | POST | `/sessions/:id/leave` | JWT (volunteer) | Mobile |
| | POST | `/sessions/:id/photos` | JWT (volunteer) | Mobile |
| | POST | `/sessions/:id/feedback` | JWT (volunteer) | Mobile |
| | GET | `/sessions` | Admin JWT | Dashboard |
| | POST | `/sessions/:id/abandon` | Admin JWT | Dashboard |
| **Uploads** | POST | `/uploads/presign` | JWT (any) | Both |
| **Rules** | GET | `/rules` | JWT (any) | Both |
| | POST | `/rules/confirm` | JWT (volunteer) | Mobile |
| | POST | `/rules` | Admin JWT | Dashboard |
| **Feed** | GET | `/feed` | JWT (any) | Both |
| | POST | `/feed` | Admin JWT | Dashboard |
| | DELETE | `/feed` | Admin JWT | Dashboard |
| | DELETE | `/feed/:id` | Admin JWT | Dashboard |
| **Notifications** | GET | `/notifications/unread` | JWT | Mobile |
| | POST | `/notifications/:id/read` | JWT | Mobile |
| **Map** | GET | `/map/context` | Admin JWT | Dashboard |
| **Performance** | GET | `/performance/me` | JWT (volunteer) | Mobile |
| | GET | `/performance/leaderboard` | Admin JWT | Dashboard |
| | GET | `/performance/groups` | Admin JWT | Dashboard |
| | GET | `/performance/volunteers/:id` | Admin JWT | Dashboard |
| **Chat** | POST | `/chat/sessions/:sessionId/messages` | JWT | Mobile |

### 2.6 WebSocket Events — أحداث WebSocket

#### Namespace `/location` — [src/modules/location/location.gateway.ts](src/modules/location/location.gateway.ts)

**Authentication:** token in `handshake.auth.token` or `handshake.headers.authorization`. The gateway verifies it with `TokenService.verifyToken()` and checks the Redis blacklist. Unauthenticated connections are immediately disconnected.

**Rooms:**
- `admin-live-map` — all admin clients join this room automatically on connect.
- `volunteer:<volunteerId>` — each volunteer joins their own room on connect.

**Events received by server (client → server):**

| Event | Sent by | Payload | Handler |
|---|---|---|---|
| `volunteer:location` | Mobile app | `{ lat: number, lng: number }` | Caches to Redis (`location:<volunteerId>`, 20min TTL), broadcasts to `admin-live-map`, checks session status and triggers arrival confirmation or GPS audit |

**Events emitted by server (server → client):**

| Event | Sent to | Payload | Trigger |
|---|---|---|---|
| `session:confirmed` | Volunteer's own socket | `{ sessionId, startedAt, campaignTitle, placeName, message }` | First GPS ping within `place.proximityThresholdMeters` while session is `waiting_arrival` |
| `admin:volunteer-location` | `admin-live-map` room | `{ volunteerId, fullName, lat, lng, timestamp, volunteerGroup }` | Every `volunteer:location` event |
| `admin:volunteer-offline` | `admin-live-map` room | `{ volunteerId }` | Volunteer socket disconnect |
| `admin:session-activated` | `admin-live-map` room | `{ volunteerId, sessionId, campaignTitle, lat, lng, fullName, volunteerGroup }` | Same trigger as `session:confirmed` |

**Session activation flow:**

```
Volunteer sends volunteer:location
  └─ if session.status == waiting_arrival
       └─ isWithinProximity(lat, lng, place.lat, place.lng, place.proximityThresholdMeters)
            └─ true → sessionsService.confirmArrival()
                 ├─ emit session:confirmed → volunteer
                 └─ emit admin:session-activated → admin-live-map
```

#### Namespace `/notifications` — [src/modules/notifications/notifications.gateway.ts](src/modules/notifications/notifications.gateway.ts)

> **Note:** This gateway is scaffolded but not yet wired. On connect it joins authenticated volunteers to `group:<volunteerGroup>` and `all-volunteers` rooms. The `emitToGroup()` and `emitToAll()` methods exist on the gateway class but **nothing in the current codebase calls them**. Feed announcements reach online volunteers via FCM (topic push), not via this WebSocket. This namespace is ready to be extended in a future phase.

**Authentication:** identical to `/location` — `handshake.auth.token` or `handshake.headers.authorization`.

**Rooms assigned on connect:**
- `group:<volunteerGroup>` (e.g. `group:الهرم`)
- `all-volunteers`

**Events emitted by server:** none currently.

### 2.7 Background Jobs — المهام المجدولة

| Job | Cadence | Location | Purpose |
|---|---|---|---|
| `checkAutoComplete` | `*/1 * * * *` (every minute) | [src/modules/sessions/sessions.service.ts:423](src/modules/sessions/sessions.service.ts#L423) | Finds all `ACTIVE` sessions whose campaign's `endTime <= now` and marks them `COMPLETED`. Flushes GPS log from Redis to PostgreSQL, recalculates volunteer hours, checks if the campaign itself can be marked `COMPLETED`. |

No queue (BullMQ / Bull) is in use. The cron is handled by `@nestjs/schedule` registered in [src/app.module.ts:9](src/app.module.ts#L9).

**Redis caching strategy (active sessions):**

| Key pattern | Value | TTL | Flushed to PG when |
|---|---|---|---|
| `location:<volunteerId>` | `{ lat, lng, timestamp }` | 20 min (reset on each ping) | `volunteer-offline` or session end |
| `session:ctx:<sessionId>` | `{ volunteerId, placeLat, placeLng, proximityThresholdMeters }` | 24 h | Session ends (completed / left_early / abandoned) |
| `session:gpslog:<sessionId>` | Array of GPS entries | 24 h | Session ends (bulk insert to `gps_audit_logs`) |
| `session:count:<sessionId>` | Integer ping count | 24 h | Session ends (written to `session.gpsCheckCount`) |
| `chatbot:<userId>:<chatSessionId>` | Last 20 messages | 1 h (reset on each message) | Not flushed — DB has full history |
| `used_otp:<jti>` | `1` | Remaining exp time | Expires automatically |
| `blacklist:<jti>` | `1` | Remaining exp time | Expires automatically |

### 2.8 Environment Variables — متغيرات البيئة

Sourced from `process.env` via [src/config/configuration.ts](src/config/configuration.ts). Copy `.env` to `.env.local` (or keep `.env`) before running.

| Variable | Required | Default | Secret | Description |
|---|---|---|---|---|
| `PORT` | No | `3000` | | HTTP port |
| `NODE_ENV` | No | — | | `development` / `production` |
| **Database** |
| `DATABASE_URL` | **Yes** | — | | Full Postgres connection URL: `postgres://user:pass@host:5432/db` |
| `ADMIN_DEFAULT_EMAIL` | **Yes** | — | | Email of the root admin seeded on startup |
| `ADMIN_DEFAULT_PASSWORD` | **Yes** | | Secret | Password of the root admin seeded on startup |
| **Redis** |
| `REDIS_HOST` | **Yes** | `localhost` | | Redis hostname |
| `REDIS_PORT` | No | `6379` | | Redis port |
| **JWT** |
| `JWT_SECRET` | **Yes** | — | Secret | Signs access tokens (and OTP session tokens) |
| `JWT_EXPIRES_IN` | No | `15m` | | Access token lifetime |
| `JWT_REFRESH_SECRET` | **Yes** | — | Secret | Signs refresh tokens (must differ from `JWT_SECRET`) |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | | Refresh token lifetime |
| `SALT_ROUNDS` | No | `10` | | bcrypt cost factor for admin passwords |
| **OTP** |
| `OTP_TTL_SECONDS` | No | `300` | | OTP session token lifetime in seconds |
| `OTP_DEV_CODE` | No | — | | Fixed OTP code for development (bypasses real code) |
| `OTP_MAX_ATTEMPTS` | No | `5` | | Max verify attempts per OTP session |
| `OTP_ATTEMPTS_WINDOW_SECONDS` | No | `3600` | | Attempt rate-limit window |
| **Location** |
| `PROXIMITY_THRESHOLD_METERS` | No | `300` | | **Fallback default only.** Actual threshold is `place.proximityThresholdMeters` — never use this env var as the gate. |
| `SESSION_LOCATION_INTERVAL_SECONDS` | No | `30` | | Suggested GPS ping interval communicated to mobile clients |
| **AWS S3** |
| `AWS_ACCESS_KEY_ID` | **Yes** | — | Secret | IAM key with `s3:PutObject` on the bucket |
| `AWS_SECRET_ACCESS_KEY` | **Yes** | — | Secret | Corresponding IAM secret |
| `AWS_REGION` | **Yes** | — | | S3 bucket region (e.g. `eu-north-1`) |
| `AWS_BUCKET` | **Yes** | — | | S3 bucket name |
| **Firebase FCM** |
| `FIREBASE_PROJECT_ID` | **Yes** | — | | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | **Yes** | — | | Service account email |
| `FIREBASE_PRIVATE_KEY` | **Yes** | — | Secret | Service account private key (PEM, `\n`-escaped in env) |
| **Google Gemini (chatbot)** |
| `GEMINI_API_KEY` | **Yes** | — | Secret | Google AI Studio API key |
| `GEMINI_MODEL` | No | `gemini-2.0-flash` | | Model ID |
| **Twilio (not implemented)** |
| `TWILIO_ACCOUNT_SID` | No | — | | Placeholder — SMS not implemented |
| `TWILIO_AUTH_TOKEN` | No | — | Secret | Placeholder |
| `TWILIO_FROM_NUMBER` | No | — | | Placeholder |
| **Misc** |
| `ADMIN_PHONE` | No | — | | Present in `.env`; not read by `configuration.ts` — usage TBD |

---

## 3. Setup & Deployment (الإعداد والنشر)

<div dir="rtl">

### ٣. الإعداد والنشر

</div>

### 3.1 Prerequisites — المتطلبات

| Requirement | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 LTS | Check: `node -v` |
| npm | ≥ 10 | Bundled with Node 20 |
| Docker + Docker Compose | any recent | Only needed for local Postgres + Redis |
| AWS credentials | — | IAM user with `s3:PutObject` + `s3:GetObject` on the uploads bucket |
| Firebase service account | — | Downloaded from Firebase Console → Project settings → Service accounts |
| Google AI Studio key | — | `GEMINI_API_KEY` from [aistudio.google.com](https://aistudio.google.com) |

### 3.2 Installation Guide — دليل التنصيب

```bash
# 1. Clone
git clone <repo-url> edman-backend
cd edman-backend

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env .env.local            # edit .env.local with your values
# Required at minimum: DATABASE_URL, REDIS_HOST, JWT_SECRET, JWT_REFRESH_SECRET,
#                      AWS_*, FIREBASE_*, GEMINI_API_KEY,
#                      ADMIN_DEFAULT_EMAIL, ADMIN_DEFAULT_PASSWORD

# 4. Start infrastructure (Postgres 16 + Redis 7)
docker compose up -d          # see docker-compose.yml

# 5. Start dev server (hot-reload)
npm run start:dev
# → http://localhost:3000/api
# → http://localhost:3000/api/docs   (Swagger UI)

# 6. Verify
curl http://localhost:3000/api/admins/login \
  -X POST -H 'Content-Type: application/json' \
  -d '{"email":"admin@edman.org","password":"<ADMIN_DEFAULT_PASSWORD>"}'
# Expected: { statusCode: 201, message: "success", data: { accessToken, refreshToken, admin } }
```

**Available npm scripts:**

| Script | What it does |
|---|---|
| `npm run start:dev` | NestJS with hot-reload (`--watch`) |
| `npm run start` | NestJS without hot-reload |
| `npm run start:debug` | Hot-reload + Node inspector on default port |
| `npm run start:prod` | `node dist/main` — runs the compiled output |
| `npm run build` | `nest build` → TypeScript compilation to `dist/` |
| `npm run lint` | ESLint across `src/` and `test/` |
| `npm run format` | Prettier write |
| `npm run test` | Jest unit tests (none exist yet — see §4.2) |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:cov` | Jest with coverage report |
| `npm run test:e2e` | Jest e2e with `test/jest-e2e.json` config |
| `npm run seed` | Run [src/scripts/seed.ts](src/scripts/seed.ts) to create root admin |

### 3.3 Database Migrations & Seeding — الترحيل والبيانات الأولية

> **Important:** TypeORM is configured with `synchronize: true` in [src/config/database.config.ts](src/config/database.config.ts#L9). This means the schema is automatically created and altered on every server start to match the entity definitions. **This is safe for development but must be replaced with explicit migrations before deploying to production**, as `synchronize: true` can cause data loss on destructive schema changes (column renames, type changes, drops).

**There is no `migrations/` folder in this repo.** To move to a migration workflow before deploying:

```bash
# Generate migrations from entity diff (after disabling synchronize:true)
npx typeorm migration:generate -d src/config/database.config.ts src/migrations/InitialSchema

# Run pending migrations
npx typeorm migration:run -d src/config/database.config.ts

# Revert the last migration
npx typeorm migration:revert -d src/config/database.config.ts
```

**Root admin seeding:**

The `AdminsService.onModuleInit()` hook ([src/modules/admins/admins.service.ts:28](src/modules/admins/admins.service.ts#L28)) automatically seeds the root admin on every server start — it is a no-op if the email already exists.

To seed manually (e.g. from a CI pipeline):
```bash
npm run seed
```

This runs [src/scripts/seed.ts](src/scripts/seed.ts) with `ADMIN_DEFAULT_EMAIL` and `ADMIN_DEFAULT_PASSWORD` from the environment.

**Additional admins** are created through the API:
```bash
curl http://localhost:3000/api/admins/register \
  -X POST \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"ops@efada.example.com","password":"StrongPass123","name":"مدير العمليات","nationalId":"12345678901234"}'
```

### 3.4 Deployment Process — النشر

Target: **AWS**. Specific compute target (ECS / EKS / EC2 / Elastic Beanstalk), domain, and IaC templates are ⚠️ **TBD** — to be determined by the infrastructure team before production go-live.

The diagram below shows the intended shape of the CI/CD pipeline. Replace every `TBD` placeholder with real values once infrastructure is provisioned.

```mermaid
flowchart LR
    Dev["Developer\ngit push main"] --> GH["GitHub\nrepository"]
    GH --> CI["CI/CD\nGitHub Actions\n(TBD)"]

    subgraph Build["Build Stage"]
        CI -->|npm ci| Install["npm install"]
        Install -->|npm run lint| Lint["ESLint"]
        Lint -->|npm run build| Compile["TypeScript → dist/"]
    end

    subgraph Deploy["Deploy Stage (TBD)"]
        Compile -->|docker build| Image["Container Image\n(TBD — ECR or DockerHub)"]
        Image -->|deploy| Compute["API Compute\n⚠️ TBD\n(ECS Fargate / EC2 / EB)"]
    end

    subgraph Infra["AWS Managed Services (TBD)"]
        Compute --> RDS["RDS PostgreSQL\n⚠️ TBD"]
        Compute --> ELC["ElastiCache Redis\n⚠️ TBD"]
        Compute --> S3["S3 Bucket\n(uploads)"]
        Compute --> SM["Secrets Manager\n⚠️ TBD"]
        ALB["ALB / API Gateway\n⚠️ TBD"] --> Compute
        R53["Route 53\n⚠️ TBD"] --> ALB
        ACM["ACM Certificate\n⚠️ TBD"] --> ALB
    end

    Compute -->|push| FCM["Firebase FCM"]
    Compute <-->|chat| GeminiAPI["Google Gemini API"]
```

**Before deploying:**

1. Set `synchronize: false` in [src/config/database.config.ts](src/config/database.config.ts) and generate/run migrations (§3.3).
2. Inject all secrets via AWS Secrets Manager or the compute platform's secrets mechanism — do not ship a `.env` file to production.
3. Confirm `app.enableCors()` in [src/main.ts:11](src/main.ts#L11) is scoped to allowed origins (currently unrestricted).
4. Add a health-check endpoint or use the existing `/api/auth/check-token` behind a test token for ALB health checks.

### 3.5 Infrastructure as Code — البنية التحتية ككود

> ⚠️ **Not yet implemented.** There is no `terraform/`, `cdk/`, or `infra/` folder in this repo. When the AWS infrastructure is codified, place it here (or in a dedicated `infra/` sibling repo) and link from this section.

Minimum expected IaC coverage for a production deployment:

- RDS PostgreSQL (Multi-AZ, encrypted at rest)
- ElastiCache Redis (cluster mode or single-node with replication)
- Compute — ECS Fargate service with auto-scaling, or EC2 with an ASG
- S3 bucket for uploads (private, presigned access only, lifecycle policy for old objects)
- AWS Secrets Manager for all secret env vars
- Application Load Balancer with HTTPS listener
- ACM certificate for the API domain
- Route 53 record pointing the API domain to the ALB
- IAM role for the API task/instance with least-privilege S3 + Secrets Manager access

---

## 4. User & Testing Documentation (دليل التشغيل والاختبار)

<div dir="rtl">

### ٤. دليل التشغيل والاختبار

</div>

### 4.1 Operator Guide — دليل المشغل

This section is for DevOps engineers and developers running the service. EFADA has no end-user-facing web portal; all user interaction is through the mobile app and admin dashboard.

#### Checking logs

NestJS logs to stdout via its built-in `Logger`. Every inbound HTTP request is logged by `RequestLoggerMiddleware`. WebSocket gateway events are logged with `Logger.log()` and `Logger.error()`.

```bash
# Docker / local
npm run start:dev           # stdout includes [NestJS] prefixed lines

# Production (TBD — depends on compute platform)
# ECS: CloudWatch Logs via awslogs driver
# EC2: journalctl -u edman-backend -f
```

Key log patterns to watch:
- `[LocationGateway] Client connected` / `Client disconnected` — WebSocket connection events.
- `[SessionsService] Auto-completed session` — cron job activity.
- `[NotificationsService] FCM sent to token` / `FCM send failed` — push delivery.
- `[ChatService] Gemini error` — AI chatbot failures.

#### Rotating JWT secrets

JWT secrets are read at startup from `JWT_SECRET` and `JWT_REFRESH_SECRET`. Changing them **immediately invalidates all existing tokens** (access and refresh), logging out every session.

1. Generate two new random secrets (≥ 64 characters each, different from each other).
2. Update the secrets in your secrets store (AWS Secrets Manager / `.env`).
3. Restart the API. All users will need to re-authenticate.
4. There is no rolling rotation mechanism — the cutover is instant.

#### Recovering from admin lockout

If no admin can log in (e.g. all passwords lost):

```bash
# Option A — re-seed with new credentials (only works if ADMIN_DEFAULT_EMAIL admin still exists)
ADMIN_DEFAULT_PASSWORD=NewStrongPass123 npm run seed

# Option B — direct DB update (requires DB access)
psql $DATABASE_URL -c "
  UPDATE admins
  SET password = '<bcrypt-hash-of-new-password>'
  WHERE email = 'admin@edman.org';
"
# Generate the bcrypt hash: node -e "const b=require('bcrypt');b.hash('NewPass',10).then(console.log)"
```

#### Re-syncing FCM topic subscriptions

When a volunteer is approved or their group changes, `NotificationsService.subscribeToGroupTopic()` ([src/modules/notifications/notifications.service.ts:199](src/modules/notifications/notifications.service.ts#L199)) subscribes their FCM token to `group_<volunteerGroup>` and `all_volunteers`. If a device gets a new FCM token (app reinstall, token rotation) and updates it via `PATCH /volunteers/me/fcm-token`, the subscription to the topic is **not automatically re-applied**.

To re-sync a volunteer's FCM topic subscriptions:
1. Find the volunteer's current `fcmToken` in the `users` table.
2. Call `subscribeToGroupTopic(fcmToken, group)` — this can be done from a one-off script using `NestFactory.createApplicationContext`.
3. Or implement a re-subscribe call on the next volunteer approval/group-change action.

#### Rotating AWS S3 credentials

1. Create a new IAM access key for the uploads IAM user.
2. Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in your secrets store.
3. Restart the API — `UploadsService` reads credentials at module init via `ConfigService`.
4. Deactivate and delete the old IAM key from the AWS Console.

Presigned URLs issued before the key rotation will remain valid until their 15-minute expiry, then fail.

#### Monitoring the live map context

The `GET /map/context` endpoint ([src/modules/map/map.controller.ts](src/modules/map/map.controller.ts)) returns a snapshot of all active volunteers, their last known GPS coordinates (from Redis), active campaigns, and all places. Use this to verify the live map is receiving real data:

```bash
curl http://localhost:3000/api/map/context \
  -H "Authorization: Bearer <adminAccessToken>" | jq .data.summary
```

### 4.2 Testing Strategy — استراتيجية الاختبار

**Current status: no automated tests.** The only test file is the NestJS scaffold `test/app.e2e-spec.ts`, which expects `GET /` to return `Hello World` — this route does not exist in this application and the test will fail if run.

There are zero `.spec.ts` files under `src/`.

Planned aspirational testing layers:

| Layer | Tool | Target | Priority |
|---|---|---|---|
| Unit | Jest + `@nestjs/testing` | `SessionsService` (lifecycle logic, GPS flush, hour recalculation), `OtpService` (generate/verify), `UploadsService` (presign), `isWithinProximity()` utility | High |
| Integration | Jest + `@nestjs/testing` + real Postgres | Auth flow (send-otp → verify-otp → access token), campaign enrollment with rules gate, session activation, auto-complete cron | High |
| E2E | Jest + Supertest | Login → apply → approve → enroll → session lifecycle; admin create campaign → volunteer GPS → confirm | Medium |
| WebSocket | Socket.IO test client | `volunteer:location` event → `session:confirmed` + `admin:session-activated` emissions | Medium |
| Contract | OpenAPI diff against `admin-contract.md` | Catch drift between documented and live response shapes | Low |

### 4.3 Troubleshooting & FAQs — حل المشكلات

**Database connection refused**

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
- Is Postgres running? `docker compose ps`
- Does `DATABASE_URL` match the running container? Check host/port/user/password/dbname.
- If connecting to a remote host, check security groups / firewall rules.

**Redis unavailable**

```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
- `docker compose ps` — is the Redis container healthy?
- `REDIS_HOST` and `REDIS_PORT` in your env must match.
- Redis failure degrades the following features: OTP sessions (cannot issue), JWT blacklist (tokens cannot be revoked), GPS location cache, session context, chatbot context.

**JWT mismatch — `401 Unauthorized` on valid-looking tokens**

- Access tokens are signed with `JWT_SECRET`; refresh tokens with `JWT_REFRESH_SECRET`. Sending a refresh token to a non-refresh endpoint (or vice versa) will fail verification.
- If secrets were rotated, all previously issued tokens are invalid.
- The OTP session token also uses `JWT_SECRET` — do not confuse it with access tokens.

**S3 presigned URL returns `403 Forbidden`**

The most common cause is a `Content-Type` mismatch. The presigned URL is bound to the exact content type sent in `POST /uploads/presign`. You must `PUT` to the URL with that **identical** `Content-Type` header.

```bash
# Correct flow
PRESIGN=$(curl -s -X POST http://localhost:3000/api/uploads/presign \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"filename":"photo.jpg","contentType":"image/jpeg"}')

URL=$(echo $PRESIGN | jq -r .data.uploadUrl)

curl -X PUT "$URL" \
  -H "Content-Type: image/jpeg" \   # MUST match what was sent to /presign
  --data-binary @photo.jpg
```

Other causes: expired presigned URL (15-min TTL), rotated AWS credentials, or the IAM key lacking `s3:PutObject` on the bucket.

**FCM push notifications not delivered**

- Check startup logs: `Firebase Admin SDK initialized` must appear. If not, check `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- `FIREBASE_PRIVATE_KEY` in `.env` must have literal `\n` replaced with actual newlines, or use the `\n`-escaped form — see [src/config/configuration.ts:41](src/config/configuration.ts#L41) for the transform applied.
- FCM token on the user record may be stale. The volunteer app must call `PATCH /volunteers/me/fcm-token` whenever it receives a new token from the FCM SDK.
- Delivery to FCM topics (`group_الهرم`, `all_volunteers`) requires the device to be subscribed. Subscription happens in `subscribeToGroupTopic()` called during volunteer approval and group changes.

**CORS errors from the dashboard or mobile app**

`app.enableCors()` in [src/main.ts:11](src/main.ts#L11) is called with no arguments, which allows all origins. This is intentional for development. In production you must scope it:

```typescript
app.enableCors({ origin: ['https://admin.efada.example.com', 'https://app.efada.example.com'] });
```

**Socket.IO connection rejected**

- The WebSocket gateway reads `handshake.auth.token` or falls back to `handshake.headers.authorization`. Ensure the client sends one of these, not a cookie.
- An expired or blacklisted access token will cause immediate disconnect. Use a fresh access token.
- Admin clients connecting to `/location` are automatically joined to `admin-live-map`. Volunteer clients are joined to `volunteer:<volunteerId>`.
- If `NODE_ENV=production`, ensure the Socket.IO server and client agree on transport (polling fallback vs websockets-only) and that ALB/nginx is configured for WebSocket upgrades (`Upgrade: websocket` header passthrough).

**Chatbot returns "خدمة المحادثة غير متاحة"**

`GEMINI_API_KEY` is missing or invalid. Check the key at `https://aistudio.google.com` and verify `GEMINI_MODEL` is a valid model ID.

**`synchronize: true` errors on startup**

If TypeORM's auto-sync fails (e.g. a new enum value was added to an existing column), the server will crash on boot. Fix options:
1. Manually apply the schema change with raw SQL.
2. Drop and recreate the database (development only).
3. Migrate to explicit migrations before this becomes a production issue.

### 4.4 Known Limitations — القيود المعروفة

- **`synchronize: true`** — TypeORM auto-creates and alters the schema on every startup. This is unsafe for production and must be replaced with an explicit migration workflow before deploying. See §3.3.
- **Hard-coded enum values** — `Governorate` has one value (`الجيزة`), `Area` has two (`الهرم | فيصل`), `VolunteerGroup` has two (`الهرم | فيصل`). Adding values requires a code change in [src/common/constants/enums.ts](src/common/constants/enums.ts) and a schema migration. The admin-contract.md references a broader set of governorates/areas — these are not yet in the code.
- **No admin role hierarchy** — every admin account has identical permissions. Any admin can create another admin (`POST /admins/register`). There is no concept of super-admin vs. sub-admin distinct from approval scope.
- **`/notifications` WebSocket is scaffolded** — the gateway joins volunteers to rooms on connect but nothing emits to those rooms. Real-time feed delivery is FCM-only at this stage.
- **No rate limiting** — deferred. All endpoints are unthrottled.
- **No Dockerfile** — the repo has no `Dockerfile` or `.dockerignore`. Container packaging for production is TBD.
- **CORS is unrestricted** — `app.enableCors()` with no options allows all origins. Scope it before production.
- **`algoliasearch` in `package.json`** — the package is installed as a dependency but is not imported anywhere in `src/`. It is unused and can be removed.
- **Twilio placeholders** — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` exist in `.env` but there is no Twilio integration in the codebase.
- **Single-region deployment** — AWS region, S3 bucket, and Firebase project are single-region. No multi-region failover is planned.
- **Rules update forces mass re-confirmation** — every `POST /rules` increments the version. All volunteers must confirm before their next campaign enrollment. Use sparingly.
- **No certificate PDF generation** — `totalVolunteeringHours` on the `Volunteer` entity is the canonical input for certificate issuance, but PDF generation is out of scope for this service.

---

## Related Repositories — المستودعات المرتبطة

| Repo | Tech | Description |
|---|---|---|
| `edman-admins` | React 19 + Vite + TypeScript | Admin dashboard — volunteer coordinators. See its `README.md` and [admin-contract.md](admin-contract.md) for the canonical API contract. |
| Volunteer mobile app | *(separate repo)* | Already shipped. Consumes the same REST API and `/location` WebSocket. |
| Infrastructure | *(TBD)* | AWS IaC — to be created. |

---

## License & Contact — الترخيص والتواصل

> Government program — licensing terms and contact information to be provided by the EFADA program office.
