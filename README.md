# Edman Backend

Volunteer coordination API for the **Egyptian Anti-Drug Fund** volunteer mobile app. Built with NestJS and TypeScript.

## Overview

The system manages volunteers who participate in anti-drug awareness tasks at designated places. Three user roles interact with the platform:

| Role | Client | Description |
|------|--------|-------------|
| **VOLUNTEER** | Mobile App | Applies, enrolls in tasks, attends sessions, submits photos/feedback |
| **ADMIN** | Web Panel | Full control — manages volunteers, tasks, places, centers, rules, feed |
| **SUB_ADMIN** | Web Panel | Group-scoped admin — can post announcements to their assigned volunteer group only |

Arabic is the primary language — all user-facing enum values are Arabic strings.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | NestJS 11 (TypeScript, strict mode) |
| Database | PostgreSQL 16 via TypeORM |
| Cache | Redis 7 via `@nestjs/cache-manager` |
| WebSocket | Socket.IO via `@nestjs/websockets` |
| Auth | JWT (access 15 min + refresh 7 days) + OTP (4-digit, bcrypt hashed) |
| File Storage | AWS S3 presigned PUT URLs |
| AI Chatbot | Google Gemini API (`@google/generative-ai`) |
| API Docs | Swagger at `/api/docs` |
| Validation | `class-validator` + `class-transformer` (whitelist, forbidNonWhitelisted, transform) |
| Scheduling | `@nestjs/schedule` (session auto-complete cron) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose (for PostgreSQL + Redis)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start infrastructure (Postgres + Redis)
docker compose up -d

# 3. Configure environment
# Copy .env.example to .env and fill in values (see Environment section)

# 4. Start dev server (hot-reload)
npm run start:dev
```

### Commands

```bash
npm run start:dev          # Development with hot-reload
npm run build              # Compile TypeScript
npm run start:prod         # Production (runs compiled JS)
npm run lint               # ESLint
npm run test               # Unit tests
npm run test:e2e           # End-to-end tests
```

### Infrastructure (docker-compose.yml)

| Service | Image | Port |
|---------|-------|------|
| PostgreSQL | `postgres:16-alpine` | 5432 |
| Redis | `redis:7-alpine` | 6379 |

---

## Project Structure

```
src/
├── main.ts                          # Bootstrap — global prefix /api, CORS, Swagger, pipes
├── app.module.ts                    # Root module
├── config/
│   ├── configuration.ts             # Typed ConfigModule factory (all env vars)
│   └── database.config.ts           # TypeORM config via ConfigService
├── common/
│   ├── constants/
│   │   └── enums.ts                 # All domain enums (Arabic string values)
│   ├── decorators/
│   │   └── index.ts                 # @Auth, @AuthGroup, @CurrentUser, @CurrentVolunteer, @OTP
│   ├── guards/
│   │   ├── auth.guard.ts            # JWT extraction + blacklist check
│   │   ├── roles.guard.ts           # Role-based access (ADMIN, VOLUNTEER, SUB_ADMIN)
│   │   ├── groups.guard.ts          # Volunteer group scoping
│   │   └── otp.guard.ts            # OTP verification guard
│   ├── filters/
│   │   └── http-exception.filter.ts # Standardized error responses
│   ├── interceptors/
│   │   └── unified-response.interceptor.ts  # Wraps all responses in { statusCode, message, data }
│   ├── middleware/
│   │   └── request-logger.middleware.ts     # HTTP request logging
│   ├── pipes/
│   │   └── normalize-phone.pipe.ts  # Phone number normalization
│   ├── services/
│   │   └── token.service.ts         # JWT sign/verify, token blacklisting
│   ├── types/
│   │   └── auth.types.ts            # Auth type definitions
│   ├── utils/
│   │   ├── common.utils.ts          # Shared utilities
│   │   ├── location.utils.ts        # isWithinProximity() — Haversine distance calculation
│   │   ├── normalize-phone.util.ts  # Egyptian phone normalization
│   │   └── encryption/
│   │       └── hash.utils.ts        # bcrypt hash/compare
│   └── global.module.ts             # Global providers
└── modules/
    ├── auth/                        # Authentication (login, OTP, tokens)
    ├── otp/                         # OTP generation and verification
    ├── user/                        # Base user entity and service
    ├── volunteers/                  # Volunteer profiles, applications, management
    ├── admins/                      # Admin and sub-admin management
    ├── centers/                     # Anti-drug centers (group-scoped)
    ├── places/                      # Task locations with GPS coordinates
    ├── tasks/                       # Volunteer tasks with scheduling
    ├── sessions/                    # Session lifecycle, GPS audit, photos, feedback
    ├── uploads/                     # S3 presigned URL generation
    ├── location/                    # WebSocket gateway — real-time GPS tracking
    ├── map/                         # Admin live map context
    ├── performance/                 # Analytics, leaderboards, group stats
    ├── rules/                       # Versioned volunteer rules
    ├── feed/                        # Admin announcements
    ├── notifications/               # In-app notifications + WebSocket broadcast
    └── chat/                        # AI chatbot (Gemini-powered, Arabic)
```

---

## Unified Response Format

All successful responses:
```json
{
  "statusCode": 200,
  "message": "success",
  "data": { ... }
}
```

All error responses:
```json
{
  "statusCode": 400,
  "message": "Error description",
  "timestamp": "2026-03-26T12:00:00.000Z",
  "path": "/api/volunteers/apply"
}
```

---

## Domain Enums

| Enum | Values |
|------|--------|
| **UserRole** | `volunteer`, `admin`, `sub_admin` |
| **ApplicationStatus** | `pending`, `approved`, `rejected`, `banned` |
| **VolunteerGroup** | `الهرم` (Haram), `فيصل` (Faisal) |
| **SessionStatus** | `waiting_arrival`, `active`, `completed`, `left_early`, `abandoned` |
| **TaskStatus** | `open`, `full`, `in_progress`, `completed`, `cancelled` |
| **EducationalLevel** | `ثانوي` (High School), `بكالوريوس` (Bachelor), `لا يوجد` (None) |
| **Governorate** | `القاهرة` (Cairo), `الجيزة` (Giza), `الإسكندرية` (Alexandria) |
| **Area** | `الهرم`, `فيصل`, `الدقي`, `المهندسين`, `العجوزة` |
| **MessageRole** | `user`, `assistant` |

---

## Authentication & Authorization

### Auth Flow (Phone + OTP — no passwords)

1. `POST /api/auth/login` with phone number
2. Server sends 4-digit OTP (via FCM in production, console.log in dev)
3. `POST /api/auth/verify-otp` with OTP code — returns JWT access token (15 min) + refresh token (7 days)
4. If the phone doesn't exist, a new user is auto-created
5. Response includes `applicationStatus` so the mobile app knows the volunteer's state

### Guard Stack

```
AuthGuard → RolesGuard → GroupsGuard
```

| Guard | Purpose |
|-------|---------|
| **AuthGuard** | Validates JWT from `Authorization: Bearer <token>`, checks blacklist |
| **RolesGuard** | Checks user role against `@Roles(ADMIN, VOLUNTEER, ...)` |
| **GroupsGuard** | Ensures volunteer belongs to the correct group, attaches volunteer to request |

### Composite Decorators

| Decorator | Equivalent |
|-----------|-----------|
| `@Auth(ADMIN)` | AuthGuard + RolesGuard(ADMIN) |
| `@Auth(VOLUNTEER, ADMIN)` | AuthGuard + RolesGuard(VOLUNTEER or ADMIN) |
| `@AuthGroup()` | AuthGuard + RolesGuard(VOLUNTEER) + GroupsGuard |

---

## Data Model

### Entity Relationship Overview

```
User (auth identity)
 ├── 1:1 → Volunteer (domain profile, application state)
 ├── 1:1 → Admin
 └── 1:1 → SubAdmin (with assignedGroup)

Volunteer
 ├── 1:N → TaskEnrollment
 ├── 1:N → Session
 └── 1:N → GpsAuditLog

Place (GPS location, per group)
 └── 1:N → Task

Task (scheduled, capacity-limited)
 ├── N:1 → Place
 ├── 1:N → TaskEnrollment
 └── 1:N → Session

Session (volunteer work tracking)
 ├── N:1 → Volunteer
 ├── N:1 → Task
 ├── 1:N → GpsAuditLog
 └── 1:N → SessionPhoto

Announcement (admin feed posts)
 └── N:1 → User (author)

Notification (per-user alerts)
 └── N:1 → User (recipient)

ChatMessage (AI chatbot history)
 └── N:1 → User

Rules (versioned, single latest)
 └── N:1 → User (updatedBy)

Center (anti-drug centers, per group)
```

### Entity Details

#### User
Auth identity — phone, role, FCM token.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, auto-generated |
| phone | VARCHAR(20) | Unique, indexed |
| role | ENUM(UserRole) | Nullable |
| isPhoneVerified | BOOLEAN | Default: false |
| fcmToken | VARCHAR(255) | Nullable |
| createdAt | TIMESTAMP | Auto |
| updatedAt | TIMESTAMP | Auto |

#### Volunteer
Domain profile with application state. OneToOne with User.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user | User | OneToOne, eager, cascade |
| fullName | VARCHAR(200) | Required |
| nationalId | VARCHAR(14) | Unique, indexed |
| nationalIdPhotoKey | VARCHAR(500) | S3 key |
| governorate | ENUM(Governorate) | Required |
| area | ENUM(Area) | Required |
| educationalLevel | ENUM(EducationalLevel) | Required |
| hasCar | BOOLEAN | Default: false |
| profilePhoto | VARCHAR(500) | Nullable |
| volunteerGroup | ENUM(VolunteerGroup) | Set on approval |
| applicationStatus | ENUM(ApplicationStatus) | Default: PENDING |
| rejectionReason | TEXT | Nullable |
| appliedAt | TIMESTAMP | Auto |
| reviewedAt | TIMESTAMP | Nullable |
| reviewedBy | User | ManyToOne |
| rulesConfirmedVersion | INT | Default: 0 |
| totalVolunteeringHours | DECIMAL(10,2) | Default: 0 |

#### Admin / SubAdmin
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user | User | OneToOne, eager |
| assignedGroup | ENUM(VolunteerGroup) | SubAdmin only |

#### Center
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | VARCHAR(200) | Unique |
| description | TEXT | Nullable |
| latitude | DECIMAL(10,7) | Required |
| longitude | DECIMAL(10,7) | Required |
| volunteerGroup | ENUM(VolunteerGroup) | Required |
| address | VARCHAR(500) | Nullable |
| createdAt | TIMESTAMP | Auto |

#### Place
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | VARCHAR(200) | Unique |
| description | TEXT | Nullable |
| latitude / longitude | DECIMAL(10,7) | Required |
| volunteerGroup | ENUM(VolunteerGroup) | Required |
| placeType | VARCHAR(100) | e.g., park, school |
| photoKey | VARCHAR(500) | S3 key |
| proximityThresholdMeters | INT | Default: 300 |
| address | VARCHAR(500) | Nullable |
| createdAt | TIMESTAMP | Auto |

#### Task
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| title | VARCHAR(300) | Required |
| description | TEXT | Nullable |
| place | Place | ManyToOne, eager |
| volunteerGroup | ENUM(VolunteerGroup) | Auto from place |
| scheduledDate | DATE | Required |
| startTime | TIME | HH:mm format |
| endTime | TIME | HH:mm format |
| maxVolunteers | INT | Default: 10 |
| status | ENUM(TaskStatus) | Default: OPEN |
| createdBy | User | ManyToOne |
| enrollments | TaskEnrollment[] | OneToMany |
| createdAt / updatedAt | TIMESTAMP | Auto |

#### TaskEnrollment
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| volunteer | Volunteer | ManyToOne |
| task | Task | ManyToOne |
| enrolledAt | TIMESTAMP | Auto |

#### Session
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| volunteer | Volunteer | ManyToOne |
| task | Task | ManyToOne |
| status | ENUM(SessionStatus) | Default: WAITING_ARRIVAL |
| startedAt | TIMESTAMP | Set on arrival confirmation |
| endedAt | TIMESTAMP | Set on completion/leave |
| durationSeconds | INT | Computed |
| endReason | TEXT | For LEFT_EARLY / ABANDONED |
| feedback | TEXT | Post-session feedback |
| feedbackAt | TIMESTAMP | Nullable |
| lastLatitude / lastLongitude | DECIMAL(10,7) | Latest GPS |
| gpsCheckCount | INT | Default: 0 |
| createdAt | TIMESTAMP | Auto |

#### GpsAuditLog
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| session | Session | ManyToOne |
| volunteer | Volunteer | ManyToOne |
| latitude / longitude | DECIMAL(10,7) | Required |
| isWithinRange | BOOLEAN | Proximity check result |
| isFirstArrival | BOOLEAN | Default: false |
| createdAt | TIMESTAMP | Auto |

#### SessionPhoto
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| session | Session | ManyToOne |
| photoKey | VARCHAR(500) | S3 key |
| takenAt | TIMESTAMP | Auto |
| sequenceNo | INT | Auto-increment per session |

#### Announcement
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| author | User | ManyToOne, eager |
| targetGroup | ENUM(VolunteerGroup) | Null = all groups |
| title | VARCHAR(300) | Required |
| body | TEXT | Required |
| attachments | SIMPLE-ARRAY | File keys |
| priority | VARCHAR(50) | Nullable |
| createdAt / updatedAt | TIMESTAMP | Auto |

#### Notification
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user | User | ManyToOne |
| title | VARCHAR(300) | Required |
| body | TEXT | Required |
| type | VARCHAR(100) | e.g., task_enrollment, announcement |
| isRead | BOOLEAN | Default: false |
| metadata | JSONB | Extra context |
| createdAt | TIMESTAMP | Auto |

#### ChatMessage
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| user | User | ManyToOne |
| sessionId | VARCHAR(100) | Conversation thread |
| role | ENUM(MessageRole) | user / assistant |
| content | TEXT | Message text |
| createdAt | TIMESTAMP | Auto |

#### Rules
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| content | TEXT | Full rules text |
| version | INT | Auto-incremented |
| updatedAt | TIMESTAMP | Auto |
| updatedBy | User | ManyToOne |

---

## API Reference

All routes are prefixed with `/api`.

**Role abbreviations:** V = VOLUNTEER, A = ADMIN, SA = SUB_ADMIN

---

### Auth Module

`modules/auth/` — Authentication via phone + OTP. No passwords. Login auto-creates users.

| Method | Endpoint | Auth | Roles | Description |
|--------|----------|------|-------|-------------|
| POST | `/auth/login` | None | All | Send OTP to phone number |
| POST | `/auth/verify-otp` | OTP Guard | All | Verify OTP, receive JWT tokens |
| POST | `/auth/logout` | JWT | All | Blacklist current token |
| POST | `/auth/refresh-token` | Refresh Token | All | Get new access token |
| POST | `/auth/resend-otp` | OTP Guard | All | Resend OTP code |
| GET | `/auth/check-token` | JWT | All | Validate token, return user info |

**Login Request:**
```json
{ "phone": "01012345678" }
```

**Verify OTP Request:**
```json
{ "code": "1234" }
```

**Verify OTP Response includes:** `accessToken`, `refreshToken`, `applicationStatus`

---

### Volunteers Module

`modules/volunteers/` — Volunteer profiles, applications, and admin review workflow.

#### Volunteer Endpoints (Mobile App)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/volunteers/apply` | JWT | Submit volunteer application |
| GET | `/volunteers/me` | JWT | Get own volunteer profile |
| GET | `/volunteers/me/history` | JWT (V, A) | Get session history with pagination |
| PATCH | `/volunteers/me/fcm-token` | JWT (V, A) | Update Firebase push notification token |

**Apply Request:**
```json
{
  "fullName": "محمد أحمد",
  "nationalId": "29901011234567",
  "nationalIdPhotoKey": "uploads/national-id/abc.jpg",
  "governorate": "الجيزة",
  "area": "الهرم",
  "educationalLevel": "بكالوريوس",
  "hasCar": false
}
```

#### Admin Endpoints (Web Panel)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/volunteers` | JWT (A) | List all volunteers (filterable by group/status, paginated) |
| GET | `/volunteers/:id` | JWT (A) | Get volunteer details by ID |
| GET | `/volunteers/applications` | JWT (A) | List pending applications |
| PATCH | `/volunteers/:id/approve` | JWT (A) | Approve and assign to group |
| PATCH | `/volunteers/:id/reject` | JWT (A) | Reject with reason |
| PATCH | `/volunteers/:id/group` | JWT (A) | Change volunteer's group |
| PATCH | `/volunteers/:id/ban` | JWT (A) | Ban a volunteer |

**Approve Request:**
```json
{ "volunteerGroup": "الهرم" }
```

**Reject Request:**
```json
{ "reason": "بيانات غير مكتملة" }
```

**Query Parameters** (list endpoints): `group`, `status`, `page` (default: 1), `limit` (default: 20, max: 100)

---

### Admins Module

`modules/admins/` — Sub-admin account management.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/admins/sub-admins` | JWT (A) | Create a new sub-admin |
| GET | `/admins/sub-admins` | JWT (A) | List all sub-admins |
| DELETE | `/admins/sub-admins/:id` | JWT (A) | Remove a sub-admin |

**Create Sub-Admin Request:**
```json
{
  "phone": "01098765432",
  "assignedGroup": "فيصل",
  "name": "أحمد محمود",
  "nationalId": "29901011234567"
}
```

---

### Centers Module

`modules/centers/` — Anti-drug awareness centers, scoped by volunteer group.

#### Volunteer Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/centers` | JWT + GroupsGuard | Get centers for volunteer's own group |
| GET | `/centers/:id` | JWT (V, A) | Get center details |

#### Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/centers` | JWT (A) | Create a center |
| PATCH | `/centers/:id` | JWT (A) | Update a center |
| DELETE | `/centers/:id` | JWT (A) | Delete a center |

**Create Center Request:**
```json
{
  "name": "مركز الهرم",
  "description": "مركز التوعية ضد المخدرات",
  "latitude": 29.9765,
  "longitude": 31.1313,
  "volunteerGroup": "الهرم",
  "address": "شارع الهرم، الجيزة"
}
```

---

### Places Module

`modules/places/` — Locations where volunteer tasks take place. Each place has GPS coordinates and a `proximityThresholdMeters` (default: 300m) used for session activation.

#### Volunteer Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/places/mine` | JWT + GroupsGuard | Get places for volunteer's group |
| GET | `/places/:id` | JWT (V, A, SA) | Get place details |

#### Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/places` | JWT (A) | List all places (optional group filter) |
| POST | `/places` | JWT (A) | Create a place |
| PATCH | `/places/:id` | JWT (A) | Update a place |
| DELETE | `/places/:id` | JWT (A) | Delete a place |

**Create Place Request:**
```json
{
  "name": "حديقة الأورمان",
  "description": "حديقة عامة",
  "latitude": 30.0262,
  "longitude": 31.2126,
  "volunteerGroup": "الهرم",
  "placeType": "حديقة",
  "photoKey": "uploads/places/orman.jpg",
  "address": "الدقي، الجيزة",
  "proximityThresholdMeters": 300
}
```

---

### Tasks Module

`modules/tasks/` — Scheduled volunteer tasks at specific places with capacity limits.

#### Volunteer Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tasks/mine` | JWT + GroupsGuard | Get tasks for volunteer's group |
| GET | `/tasks/:id` | JWT (V, A, SA) | Get task details with enrollments |
| POST | `/tasks/:id/enroll` | JWT (V, A) | Enroll in a task (creates session) |

**Enrollment rules:**
- Volunteer must have confirmed the latest rules version
- Task must be in `OPEN` status
- No duplicate enrollment allowed
- No other active session allowed
- Enrollment atomically creates `TaskEnrollment` + `Session` (WAITING_ARRIVAL)
- Task status changes to `FULL` when `maxVolunteers` reached

#### Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/tasks` | JWT (A) | List all tasks (filterable by status, group) |
| POST | `/tasks` | JWT (A) | Create a task |
| PATCH | `/tasks/:id` | JWT (A) | Update a task |
| DELETE | `/tasks/:id` | JWT (A) | Delete a task |

**Create Task Request:**
```json
{
  "title": "توعية بحديقة الأورمان",
  "description": "حملة توعية ضد المخدرات",
  "placeId": "uuid-of-place",
  "scheduledDate": "2026-04-01",
  "startTime": "09:00",
  "endTime": "13:00",
  "maxVolunteers": 15
}
```

**Query Parameters:** `status`, `group`, `page`, `limit`

---

### Sessions Module

`modules/sessions/` — Tracks volunteer participation from enrollment to completion.

#### Session Lifecycle

```
Enroll → WAITING_ARRIVAL → (GPS within range) → ACTIVE → (task end time) → COMPLETED
                                                       → (volunteer) → LEFT_EARLY
                                                       → (admin) → ABANDONED
```

- **WAITING_ARRIVAL → ACTIVE**: Automatic when first GPS ping is within `place.proximityThresholdMeters` (via WebSocket)
- **ACTIVE → COMPLETED**: Automatic via cron job when `task.endTime` is reached
- **LEFT_EARLY**: Volunteer leaves with mandatory reason
- **ABANDONED**: Admin force-ends the session

#### Volunteer Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/sessions/active` | JWT (V, A) | Get current active session |
| GET | `/sessions/history` | JWT (V, A) | Get completed sessions (paginated) |
| POST | `/sessions/:id/gps-ping` | JWT (V, A) | Log GPS coordinates |
| POST | `/sessions/:id/leave` | JWT (V, A) | Leave session early with reason |
| POST | `/sessions/:id/photos` | JWT (V, A) | Upload periodic session photo |
| POST | `/sessions/:id/feedback` | JWT (V, A) | Submit post-session feedback |

**GPS Ping:** `{ "lat": 30.0262, "lng": 31.2126 }`

**Leave Session:** `{ "reason": "ظرف طارئ" }`

**Session Photo:** `{ "photoKey": "uploads/sessions/photo-abc.jpg" }`

**Session Feedback:** `{ "text": "تجربة ممتازة" }`

#### Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/sessions` | JWT (A) | List all sessions (filterable) |
| POST | `/sessions/:id/abandon` | JWT (A) | Force-end a session with reason |

**Query Parameters:** `volunteerId`, `taskId`, `status`, `group`, `page`, `limit`

---

### Uploads Module

`modules/uploads/` — S3 presigned URL generation for direct client-to-S3 uploads.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/uploads/presign` | JWT | Get a presigned PUT URL for S3 |

**Request:**
```json
{ "filename": "national-id.jpg", "contentType": "image/jpeg" }
```

**Upload flow:**
1. Client calls `/uploads/presign` — receives presigned URL + S3 key
2. Client uploads file directly to S3 using the presigned PUT URL
3. Client sends the `key` to other endpoints (e.g., `nationalIdPhotoKey`, `photoKey`)

---

### Rules Module

`modules/rules/` — Versioned volunteer rules. Must be confirmed before task enrollment.

#### Volunteer Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/rules` | JWT (V, A) | Get latest rules content and version |
| POST | `/rules/confirm` | JWT (V, A) | Confirm acceptance of current rules |

#### Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/rules` | JWT (A) | Create/update rules (auto-increments version) |

**Create Rules:** `{ "content": "القواعد والشروط الخاصة بالمتطوعين..." }`

---

### Performance Module

`modules/performance/` — Analytics and leaderboards based on session data.

#### Volunteer Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/performance/me` | JWT (V, A) | Get own performance metrics |

#### Admin Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/performance/leaderboard` | JWT (A) | Ranked volunteer leaderboard |
| GET | `/performance/groups` | JWT (A) | Group-level aggregate statistics |
| GET | `/performance/volunteers/:id` | JWT (A) | Individual volunteer performance |

**Performance Metrics:**

| Metric | Description |
|--------|-------------|
| totalVolunteeringHours | Sum of completed session durations |
| totalCompletedTasks | Unique tasks from completed sessions |
| totalVisitedPlaces | Unique places from completed sessions |
| consistencyScore | (GPS pings within range / total pings) x 100 |
| achievementScore | min(confirmed time / total duration x 100, 100%) |

**Leaderboard Query:** `sortBy` (hours/tasks/places/consistency/achievement), `order` (asc/desc), `group`, `page`, `limit`

---

### Map Module

`modules/map/` — Admin live map context with all active volunteer locations.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/map/context` | JWT (A) | Active volunteers with GPS + summary stats |

**Response includes:**
- `activeVolunteers[]` — latest lat/lng (from Redis cache or DB), session status, task, place
- `summary` — totals by group and status

---

### Feed Module

`modules/feed/` — Admin announcements broadcast to volunteers.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/feed` | JWT | Get announcements (scoped by role/group) |
| POST | `/feed` | JWT (A, SA) | Create announcement |
| DELETE | `/feed/:id` | JWT (A) | Delete announcement |

**SUB_ADMIN constraint:** `targetGroup` is forced to their `assignedGroup` regardless of request body.

**Create Announcement:**
```json
{
  "title": "إعلان هام",
  "body": "تفاصيل الإعلان...",
  "targetGroup": "الهرم",
  "attachments": ["uploads/feed/image1.jpg"],
  "priority": "high"
}
```

**Query Parameters:** `group` (admins only), `page`, `limit`

---

### Notifications Module

`modules/notifications/` — In-app notifications with WebSocket real-time delivery.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications/unread` | JWT | Get unread notifications (limit 50) |
| POST | `/notifications/:id/read` | JWT | Mark notification as read |

---

### Chat Module (AI Chatbot)

`modules/chat/` — AI-powered Arabic chatbot for addiction awareness, using Google Gemini.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/chat/sessions/:sessionId/messages` | JWT | Send message to AI chatbot |

**Request:** `{ "content": "ما هي أعراض الإدمان؟" }`

**Chatbot behavior:**
- Responds in Arabic only
- Covers addiction awareness, volunteering, Egyptian anti-drug programs
- Directs emergencies to hotline **19019**
- Conversation context cached in Redis (1-hour TTL)
- Last 20 messages loaded as history

---

## WebSocket Gateways

### Location Gateway — `/location`

`modules/location/location.gateway.ts` — Real-time GPS tracking for volunteers and admin live map.

**Connection:** JWT token required. Volunteers join `volunteer:{id}` room, admins join `admin-live-map` room.

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| Client → Server | `volunteer:location` | `{ lat, lng }` | Volunteer sends GPS coordinates |
| Server → Client | `admin:volunteer-location` | `{ volunteerId, lat, lng, ... }` | Broadcast to admin live map |
| Server → Client | `admin:volunteer-offline` | `{ volunteerId }` | Volunteer disconnected |
| Server → Client | `session:confirmed` | `{ sessionId, status }` | Session activated by proximity |

**Behaviors:**
- GPS cached in Redis (20-minute TTL)
- Auto-confirms arrival when within `place.proximityThresholdMeters`
- Every ping logged to `GpsAuditLog` with `isWithinRange` flag
- Proximity check is **server-side only**

### Notifications Gateway — `/notifications`

`modules/notifications/notifications.gateway.ts` — Broadcasts feed announcements in real-time.

| Room | Purpose |
|------|---------|
| `group:{volunteerGroup}` | Group-specific broadcasts |
| `all-volunteers` | Platform-wide broadcasts |

---

## Key Business Rules

### Volunteer Application Flow

```
Phone Login → Apply (PENDING) → Admin Approves (APPROVED + group assigned)
                               → Admin Rejects (REJECTED + reason)
                               → Admin Bans (BANNED)
```

- Volunteers apply **once only** — duplicates throw `ConflictException`
- `VolunteerGroup` is admin-assigned on approval — volunteers never choose
- Banned volunteers cannot access volunteer features

### Session Rules

- **One active session** per volunteer at a time
- Session timer starts **server-side** (`startedAt` set by `confirmArrival()`)
- GPS pings are pure audit log — no penalties, no challenges
- Photos logged with auto-incrementing `sequenceNo`
- Feedback allowed after session ends (COMPLETED or LEFT_EARLY)
- Auto-complete cron runs **every minute** for ACTIVE sessions past `task.endTime`

### Task Enrollment Rules

- Rules gate enforced server-side: `volunteer.rulesConfirmedVersion >= rules.version`
- Task must be `OPEN`, no duplicates, no other active session
- Enrollment creates session atomically in a DB transaction

### SUB_ADMIN Constraints

- Can only post announcements — `targetGroup` forced to `assignedGroup`
- Cannot manage volunteers, tasks, places, or other admin resources

---

## Redis Caching Strategy

| Data | TTL | Purpose |
|------|-----|---------|
| Volunteer GPS location | 20 min | Live map + proximity detection |
| Chat conversation context | 1 hour | AI chatbot multi-turn memory |
| Blacklisted JWT tokens | Token's remaining exp | Revoked token tracking |

---

## Environment Variables

Key variables required in `.env`:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL connection |
| `REDIS_HOST`, `REDIS_PORT` | Redis connection |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | JWT signing secrets |
| `JWT_EXPIRATION`, `JWT_REFRESH_EXPIRATION` | Token lifetimes (e.g., 15m, 7d) |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` | S3 file storage |
| `GEMINI_API_KEY` | Google Gemini API key for chatbot |
| `DEFAULT_PROXIMITY_THRESHOLD_METERS` | Fallback proximity (per-place value takes priority) |

---

## License

UNLICENSED — Private project for the Egyptian Anti-Drug Fund.
