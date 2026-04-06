# Edman Backend — Agent Context

> This file is the single source of truth for the NestJS backend.
> Read every section before writing any code. Do not invent anything not listed here.
> Source project: ticket-master (tm) at E:\Work\ticket-master — copy listed files, do not rewrite them.

---

## What This Backend Serves

Volunteer coordination API for the Egyptian Anti-Drug Fund volunteer mobile app.
Three roles: VOLUNTEER (mobile app), ADMIN (web panel), SUB_ADMIN (web panel, group-scoped).
Arabic is the primary language — all user-facing enum values are Arabic strings.

---

## Technology Stack

| Layer | Choice |
|---|---|
| Framework | NestJS (TypeScript, strict mode) |
| Database | PostgreSQL via TypeORM |
| Cache | Redis via @nestjs/cache-manager |
| WebSocket | Socket.IO via @nestjs/websockets + @nestjs/platform-socket.io |
| Auth | JWT (access 15m + refresh 7d) + OTP (6-digit, 5min TTL, bcrypt hashed) |
| File Storage | AWS S3 — presigned PUT URLs via @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner |
| Push Notifications | Firebase Admin SDK (firebase-admin) |
| AI Chatbot | OpenAI API (openai SDK) |
| API Docs | @nestjs/swagger at /api/docs |
| Validation | class-validator + class-transformer, global ValidationPipe (whitelist: true, forbidNonWhitelisted: true, transform: true) |
| Scheduling | @nestjs/schedule (session auto-complete job) |

---

## Files to COPY from Source Project (tm)

Copy these exactly — do not rewrite:

| tm source | edman destination |
|---|---|
| `src/modules/auth/` (entire dir) | `src/modules/auth/` — then modify (see Auth section) |
| `src/modules/otp/` (entire dir) | `src/modules/otp/` — copy as-is |
| `src/modules/user/user.service.ts` | `src/modules/user/user.service.ts` — then modify |
| `src/shared/guards/auth.guard.ts` | `src/common/guards/auth.guard.ts` — copy as-is |
| `src/shared/guards/roles.guard.ts` | `src/common/guards/roles.guard.ts` — copy as-is |
| `src/shared/guards/otp.guard.ts` | `src/common/guards/otp.guard.ts` — copy as-is |
| `src/shared/decorators/auth-user.decorator.ts` | `src/common/decorators/index.ts` — then modify |
| `src/shared/services/token.service.ts` | `src/common/services/token.service.ts` — copy as-is |
| `src/shared/interceptors/unified-response.interceptor.ts` | `src/common/interceptors/unified-response.interceptor.ts` — copy as-is |
| `src/shared/utils/encryption/hash.utils.ts` | `src/common/utils/encryption/hash.utils.ts` — copy as-is |
| `src/shared/utils/common.utils.ts` | `src/common/utils/common.utils.ts` — copy as-is |
| `src/shared/config/database.config.ts` | `src/config/database.config.ts` — then modify (use ConfigService) |

---

## Complete File Tree

```
src/
├── main.ts
├── app.module.ts
├── config/
│   ├── configuration.ts
│   └── database.config.ts
├── common/
│   ├── constants/
│   │   └── enums.ts
│   ├── decorators/
│   │   └── index.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   ├── guards/
│   │   ├── auth.guard.ts           ← copy from tm
│   │   ├── roles.guard.ts          ← copy from tm
│   │   ├── groups.guard.ts         ← create new
│   │   └── otp.guard.ts            ← copy from tm
│   ├── interceptors/
│   │   └── unified-response.interceptor.ts   ← copy from tm
│   ├── services/
│   │   └── token.service.ts        ← copy from tm
│   └── utils/
│       ├── encryption/
│       │   └── hash.utils.ts       ← copy from tm
│       ├── common.utils.ts         ← copy from tm
│       ├── normalize-phone.util.ts ← create new
│       └── location.utils.ts       ← create new
└── modules/
    ├── otp/                        ← copy from tm as-is
    ├── auth/                       ← copy from tm, then modify
    ├── user/
    ├── volunteers/
    ├── admins/
    ├── centers/
    ├── places/
    ├── tasks/
    ├── uploads/
    ├── sessions/
    ├── map/
    ├── performance/
    ├── location/
    ├── rules/
    ├── feed/
    ├── notifications/
    └── chatbot/
```

---

## Build Order — Do Not Skip Steps

```
PHASE 1 — FOUNDATION
  1.  config/           configuration.ts + database.config.ts
  2.  common/           enums, utils, filters, guards, decorators, interceptors, services
  3.  otp/              copy from tm as-is
  4.  user/             create new (phone-only, no email)
  5.  auth/             copy from tm, then apply modifications below

PHASE 2 — CORE DOMAIN
  6.  volunteers/
  7.  admins/
  8.  centers/
  8.5 rules/            ← new module, goes here
  9.  places/
  10. tasks/
  11. uploads/

PHASE 3 — SESSIONS & REAL-TIME
  12. sessions/         ← most complex
  13. map/
  14. performance/
  15. location/         ← WebSocket gateway

PHASE 4 — CONTENT & COMMUNICATION
  16. feed/
  17. notifications/
  18. chatbot/

ASSEMBLY
  19. app.module.ts
```

---

## Environment Variables

```env
# Database
DB_URL=postgresql://postgres:postgres@localhost:5432/edman_db

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_PREFIX=Bearer
JWT_ACCESS_SECRET=change_me_access
JWT_REFRESH_SECRET=change_me_refresh
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# OTP
OTP_SESSION_SECRET=change_me_otp
OTP_EXPIRES_IN=5m
SALT_ROUNDS=10

# GPS / Location
GPS_PROXIMITY_THRESHOLD_DEFAULT_METERS=300   ← fallback only; real value is per-place on Place entity
GPS_CHECK_INTERVAL_SECONDS=900               ← 15 minutes; documents expected client ping interval

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=me-south-1
AWS_S3_BUCKET=edman-uploads

# Firebase FCM
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

# OpenAI
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o
```

---

## Enums — src/common/constants/enums.ts

```typescript
export enum UserRole {
  VOLUNTEER = 'volunteer',
  ADMIN     = 'admin',
  SUB_ADMIN = 'sub_admin',
}

export enum ApplicationStatus {
  PENDING  = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  BANNED   = 'banned',      // ← added; set by admin ban endpoint
}

export enum VolunteerGroup {
  HARAM  = 'الهرم',
  FAISAL = 'فيصل',
  // extensible — admin panel adds more
}

export enum SessionStatus {
  WAITING_ARRIVAL = 'waiting_arrival',
  ACTIVE          = 'active',
  COMPLETED       = 'completed',
  LEFT_EARLY      = 'left_early',
  ABANDONED       = 'abandoned',
}

export enum TaskStatus {
  OPEN        = 'open',
  FULL        = 'full',
  IN_PROGRESS = 'in_progress',
  COMPLETED   = 'completed',
  CANCELLED   = 'cancelled',
}

export enum MessageRole {
  USER      = 'user',
  ASSISTANT = 'assistant',
}

export enum EducationalLevel {
  HIGH_SCHOOL = 'ثانوي',
  BACHELOR    = 'بكالوريوس',
  NONE        = 'لا يوجد',
}

// Egyptian governorates — 27 values, use Arabic strings
export enum Governorate { CAIRO = 'القاهرة', GIZA = 'الجيزة', /* ... all 27 */ }

// Areas — major districts
export enum Area { HARAM = 'الهرم', FAISAL = 'فيصل', DOKKI = 'الدقي', /* ... */ }
```

---

## All 14 Entities

### user.entity.ts
```typescript
id              uuid PK
phone           varchar(20), unique, indexed
role            enum UserRole, nullable       // null = registered, no role yet — single enum, one role per user
isPhoneVerified boolean, default false
fcmToken        varchar(255), nullable
createdAt       timestamp
updatedAt       timestamp
```

### volunteer.entity.ts
```typescript
id                   uuid PK
user                 OneToOne → User (cascade: insert/update)
fullName             varchar(200)
nationalId           varchar(14), unique, indexed
nationalIdPhotoKey   varchar(500)              // S3 key, required
governorate          enum Governorate
area                 enum Area
educationalLevel     enum EducationalLevel
hasCar               boolean, default false
profilePhoto         varchar(500), nullable    // S3 key
volunteerGroup       enum VolunteerGroup, nullable  // set by admin on approval
applicationStatus    enum ApplicationStatus, default PENDING
rejectionReason      text, nullable
appliedAt            timestamp
reviewedAt           timestamp, nullable
reviewedBy           ManyToOne → User, nullable
rulesConfirmedVersion int, default 0           // ← tracks which rules version volunteer confirmed
totalVolunteeringHours decimal(10,2), default 0  // updated on session completion
```

### admin.entity.ts
```typescript
id    uuid PK
user  OneToOne → User
// marker entity — allows future admin-specific fields
```

### sub-admin.entity.ts
```typescript
id             uuid PK
user           OneToOne → User
assignedGroup  enum VolunteerGroup
```

### center.entity.ts
```typescript
id             uuid PK
name           varchar(200), unique
description    text, nullable
latitude       decimal(10,7)
longitude      decimal(10,7)
volunteerGroup enum VolunteerGroup
address        varchar(500), nullable
createdAt      timestamp
```

### place.entity.ts
```typescript
id                       uuid PK
name                     varchar(200), unique   // UNIQUE constraint
description              text, nullable
latitude                 decimal(10,7)
longitude                decimal(10,7)
volunteerGroup           enum VolunteerGroup
placeType                varchar(100), nullable  // e.g. "مدرسة", "نادي"
photoKey                 varchar(500), nullable  // S3 key for place thumbnail
proximityThresholdMeters int, default 300        // PER-PLACE threshold — admin sets this
address                  varchar(500), nullable
createdAt                timestamp
```

### task.entity.ts
```typescript
id              uuid PK
title           varchar(300)
description     text, nullable
place           ManyToOne → Place
volunteerGroup  enum VolunteerGroup           // mirrors place.volunteerGroup
scheduledDate   date
startTime       time
endTime         time
maxVolunteers   int, default 10
status          enum TaskStatus, default OPEN
createdBy       ManyToOne → User
createdAt       timestamp
updatedAt       timestamp
// Relations: OneToMany → TaskEnrollment
```

### task-enrollment.entity.ts
```typescript
id           uuid PK
volunteer    ManyToOne → Volunteer
task         ManyToOne → Task
enrolledAt   timestamp
leaveReason  text, nullable
leftAt       timestamp, nullable
```

### session.entity.ts
```typescript
id               uuid PK
volunteer        ManyToOne → Volunteer
task             ManyToOne → Task (eager: false, join includes place)
status           enum SessionStatus, default WAITING_ARRIVAL
startedAt        timestamp, nullable    // set on first GPS confirmation
endedAt          timestamp, nullable
durationSeconds  int, nullable          // (endedAt - startedAt) in seconds
endReason        text, nullable         // populated on LEFT_EARLY or ABANDONED
feedback         text, nullable         // ← volunteer's post-session feedback
feedbackAt       timestamp, nullable    // ← when feedback was submitted
lastLatitude     decimal(10,7), nullable
lastLongitude    decimal(10,7), nullable
gpsCheckCount    int, default 0
createdAt        timestamp
// Relations: OneToMany → GpsAuditLog, OneToMany → SessionPhoto
```

### gps-audit-log.entity.ts
```typescript
id             uuid PK
session        ManyToOne → Session
volunteer      ManyToOne → Volunteer
latitude       decimal(10,7)
longitude      decimal(10,7)
isWithinRange  boolean
isFirstArrival boolean     // true for the ping that triggered WAITING_ARRIVAL → ACTIVE
createdAt      timestamp
```


### session-photo.entity.ts  ← NEW (required for 30-min periodic photos)
```typescript
id         uuid PK
session    ManyToOne → Session
photoKey   varchar(500)   // S3 key
takenAt    timestamp
sequenceNo int             // 1st photo, 2nd photo, etc.
```

### rules.entity.ts  ← NEW (required for rules & policies page)
```typescript
id        uuid PK
content   text              // full Arabic rules text
version   int               // incremented on every update
updatedAt timestamp
updatedBy ManyToOne → User
```

### announcement.entity.ts
```typescript
id           uuid PK
author       ManyToOne → User
targetGroup  enum VolunteerGroup, nullable   // null = global broadcast
title        varchar(300)
body         text
attachments  simple-array, nullable          // S3 keys
createdAt    timestamp
updatedAt    timestamp
```

### chat-message.entity.ts
```typescript
id        uuid PK
user      ManyToOne → User, indexed
role      enum MessageRole
content   text
createdAt timestamp
```

---

## All REST Endpoints

### Auth — /api/auth

```
POST /auth/login
  body: { phone: string }
  Guard: none
  Logic: if phone not in DB → create User silently → generate OTP session
  Response: { otpSessionToken }

POST /auth/verify-otp
  header: otp-session-token: Bearer <token>
  Guard: OtpGuard
  body: { code: string }
  Response: { accessToken, refreshToken, applicationStatus: ApplicationStatus | null }

POST /auth/logout
  Guard: AuthGuard
  Logic: blacklist current JTI in Redis

POST /auth/refresh-token
  header: authorization-refresh: Bearer <refreshToken>
  Response: { accessToken }

POST /auth/resend-otp
  header: otp-session-token: Bearer <token>
  Guard: OtpGuard
  Logic: generate new OTP, send via FCM
```

### Volunteers — /api/volunteers

```
POST   /volunteers/apply              @Auth()
  body: { fullName, nationalId, nationalIdPhotoKey, governorate, area, educationalLevel, hasCar }
  Creates Volunteer record with applicationStatus = PENDING

GET    /volunteers/me                 @Auth()
  Returns: Volunteer + user relation + computed stats { totalVolunteeringHours, totalCompletedTasks, totalVisitedPlaces }

GET    /volunteers/me/history         @Auth(VOLUNTEER)
  Returns: { tasks[], completedTasks[], visitedPlaces[], totalCompletedTasks, totalVisitedPlaces, totalVolunteeringHours }

PATCH  /volunteers/me/fcm-token       @Auth(VOLUNTEER)
  body: { fcmToken: string }

GET    /volunteers                    @Auth(ADMIN)
  query: { group?, page?, limit? }

GET    /volunteers/applications       @Auth(ADMIN)
  query: { status?, group?, page?, limit? }

PATCH  /volunteers/:id/approve        @Auth(ADMIN)
  body: { volunteerGroup: VolunteerGroup }
  Logic: set status=APPROVED, set volunteerGroup, set user.role=VOLUNTEER, send FCM

PATCH  /volunteers/:id/reject         @Auth(ADMIN)
  body: { reason: string }
  Logic: set status=REJECTED, set rejectionReason, send FCM

PATCH  /volunteers/:id/group          @Auth(ADMIN)
  body: { volunteerGroup: VolunteerGroup }

PATCH  /volunteers/:id/ban            @Auth(ADMIN)
  Logic: set applicationStatus=BANNED
```

### Tasks — /api/tasks

```
GET    /tasks/mine                    @Auth(VOLUNTEER) + GroupsGuard
  Returns: tasks with place, scoped to volunteer.volunteerGroup
  Client filters by scheduledDate

GET    /tasks/:id                     @Auth(VOLUNTEER)
  Returns: task with place (including place.proximityThresholdMeters)

POST   /tasks/:id/enroll              @Auth(VOLUNTEER)
  Pre-condition: check volunteer.rulesConfirmedVersion >= latest rules.version
    If not: throw ForbiddenException('يجب قراءة القوانين وتأكيدها أولاً')
  Logic: create TaskEnrollment + create Session(WAITING_ARRIVAL) atomically
  Returns: { enrollmentId, sessionId }

POST   /tasks                         @Auth(ADMIN)
  body: { title, description?, placeId, scheduledDate, startTime, endTime, maxVolunteers? }

PATCH  /tasks/:id                     @Auth(ADMIN)
DELETE /tasks/:id                     @Auth(ADMIN)
```

### Sessions — /api/sessions

```
GET    /sessions/active               @Auth(VOLUNTEER)
  Returns: current ACTIVE or WAITING_ARRIVAL session | null

GET    /sessions/history              @Auth(VOLUNTEER)
  query: { page?, limit? }
  Returns: COMPLETED + LEFT_EARLY + ABANDONED sessions (paginated)
  Each entry includes: task, place, durationSeconds, GPS stats, photos

POST   /sessions/:id/gps-ping        @Auth(VOLUNTEER)
  body: { lat: number, lng: number }
  REST fallback for GPS audit — WebSocket is primary path
  Creates GpsAuditLog entry only (no state transitions via REST)

POST   /sessions/:id/leave            @Auth(VOLUNTEER)
  body: { reason: string }    ← required, cannot be empty
  Pre-condition: session must be ACTIVE or WAITING_ARRIVAL
  Sets status=LEFT_EARLY, endReason=reason, endedAt=now, calculates durationSeconds
  Mirrors leaveReason + leftAt to TaskEnrollment record

POST   /sessions/:id/photos           @Auth(VOLUNTEER)  ← NEW
  body: { photoKey: string }
  Pre-condition: session must be ACTIVE
  Creates SessionPhoto record with sequenceNo auto-incremented

POST   /sessions/:id/feedback         @Auth(VOLUNTEER)  ← NEW
  body: { text: string }    ← required, cannot be empty
  Pre-condition: session status must be COMPLETED or LEFT_EARLY
  Sets session.feedback = text, session.feedbackAt = now

GET    /sessions                      @Auth(ADMIN)
  query: { volunteerId?, taskId?, status?, group?, page?, limit? }

POST   /sessions/:id/abandon          @Auth(ADMIN)
  body: { reason: string }
  Sets status=ABANDONED
```

### Places — /api/places

```
GET    /places/mine                   @Auth(VOLUNTEER) + GroupsGuard
  Returns: all places in volunteer's group with open task count

GET    /places/:id                    @Auth(VOLUNTEER)
  Returns: place with current open tasks

POST   /places                        @Auth(ADMIN)
  body: { name, description?, latitude, longitude, volunteerGroup, placeType?, photoKey?, address?, proximityThresholdMeters? }

PATCH  /places/:id                    @Auth(ADMIN)
DELETE /places/:id                    @Auth(ADMIN)
```

### Centers — /api/centers

```
GET    /centers                       @Auth(VOLUNTEER) + GroupsGuard
  Returns: centers in volunteer's group (used as green pins on map)

GET    /centers/:id                   @Auth(VOLUNTEER)

POST   /centers                       @Auth(ADMIN)
PATCH  /centers/:id                   @Auth(ADMIN)
DELETE /centers/:id                   @Auth(ADMIN)
```

### Uploads — /api/uploads

```
POST   /uploads/presign               @Auth()
  body: { filename: string, contentType: string }
  Generates S3 key: uploads/{uuid}/{filename}
  Returns: { uploadUrl: string (presigned PUT, 15min TTL), key: string }
  Client uploads binary directly to S3 — server never touches the file
```

### Rules — /api/rules  ← NEW MODULE

```
GET    /rules                         @Auth(VOLUNTEER)
  Returns: { id, version, content, updatedAt }
  Returns latest rules document

POST   /rules/confirm                 @Auth(VOLUNTEER)
  Logic: set volunteer.rulesConfirmedVersion = current rules.version
  Returns: { rulesConfirmedVersion: number }

POST   /rules                         @Auth(ADMIN)
  body: { content: string }
  Logic: if rules record exists → update content, increment version
         if not → create first record with version=1
```

### Feed — /api/feed

```
GET    /feed                          @Auth(VOLUNTEER)
  query: { page?, limit? }
  Returns: announcements WHERE targetGroup = volunteer.volunteerGroup OR targetGroup IS NULL
  Ordered by createdAt DESC

POST   /feed                          @Auth(ADMIN, SUB_ADMIN)
  body: { title, body, targetGroup?: VolunteerGroup, attachments?: string[] }
  SUB_ADMIN: force targetGroup = subAdmin.assignedGroup regardless of input
  After save: emit WebSocket event to group room + send FCM to offline users

DELETE /feed/:id                      @Auth(ADMIN)
```

### Performance — /api/performance

```
GET    /performance/me                @Auth(VOLUNTEER)
  Returns: VolunteerPerformance for the requesting volunteer

GET    /performance/leaderboard       @Auth(ADMIN)
  query: { sortBy: 'hours'|'tasks'|'places'|'consistency'|'achievement', order: 'asc'|'desc', group?: VolunteerGroup, page?, limit? }

GET    /performance/volunteers/:id    @Auth(ADMIN)
  Returns: full VolunteerPerformance with GPS breakdown

GET    /performance/groups            @Auth(ADMIN)
  Returns: per-group aggregate { group, volunteerCount, avgHours, avgConsistency, avgAchievement, topPerformers[] }
```

### Map — /api/map

```
GET    /map/context                   @Auth(ADMIN)
  Scans Redis for all location:* keys → combines with active session DB data
  Returns: { activeVolunteers[], summary: { total, byGroup, byStatus } }
```

### Chatbot — /api/chatbot

```
POST   /chatbot/message               @Auth(VOLUNTEER)
  body: { message: string }
  Returns: { reply: string }

GET    /chatbot/history               @Auth(VOLUNTEER)
  query: { page?, limit? }
  Returns: paginated ChatMessage[] ordered by createdAt ASC
```

---

## WebSocket Gateways

### Gateway 1 — location.gateway.ts
```typescript
@WebSocketGateway({ cors: true, namespace: '/location' })
```

**Connection:**
- JWT from `socket.handshake.auth.token`
- Verify via TokenService.verifyToken()
- ADMIN → join `admin-live-map` room
- VOLUNTEER → join `volunteer:${volunteerId}` room

**Event: `volunteer:location` (client → server)**
payload: `{ lat: number, lng: number }`

1. Validate sender role = VOLUNTEER
2. Load volunteer (volunteerGroup, volunteerId)
3. Cache to Redis: `location:${volunteerId}` → `{ lat, lng, timestamp: now }`, TTL 20min (longer than 15min interval to tolerate one missed ping)
4. Broadcast to `admin-live-map`: `admin:volunteer-location` `{ volunteerId, fullName, lat, lng, timestamp, volunteerGroup }`
5. Load volunteer's current session (ACTIVE or WAITING_ARRIVAL) with task → place
6. If WAITING_ARRIVAL:
   - Check proximity: `isWithinProximity(lat, lng, place.latitude, place.longitude, place.proximityThresholdMeters)`
   - If in range: call `SessionsService.confirmArrival(sessionId, volunteerId, { lat, lng })`
   - Emit to volunteer socket: `session:confirmed` `{ sessionId, startedAt, taskTitle, placeName, message: 'تم تأكيد موقعك — بدأت جلسة التطوع' }`
   - Emit to admin room: `admin:session-activated` `{ volunteerId, sessionId, taskTitle, lat, lng }`
7. If ACTIVE:
   - Call `SessionsService.logGpsPing(sessionId, volunteerId, { lat, lng })`
   - No warnings, no events emitted to volunteer (pure audit)

**Disconnect:**
- Delete `location:${volunteerId}` from Redis
- Emit to admin room: `admin:volunteer-offline` `{ volunteerId }`

### Gateway 2 — notifications.gateway.ts
```typescript
@WebSocketGateway({ cors: true, namespace: '/notifications' })
```

**Connection:**
- Same JWT auth pattern
- VOLUNTEER → join `group:${volunteerGroup}` + `all-volunteers` rooms

**Emitter methods (called by FeedService):**
```typescript
emitToGroup(group: VolunteerGroup, event: string, payload: object): void
emitToAll(event: string, payload: object): void
```

**Events server → client:**
- `feed:new-announcement` → `{ id, title, body, targetGroup, authorName, createdAt }`
- `feed:new-content` → `{ id, title, contentType, createdAt }`

---

## Service Logic — Critical Details

### SessionsService

```typescript
confirmArrival(sessionId, volunteerId, { lat, lng })
  // Called by location gateway when WAITING_ARRIVAL volunteer is within proximity
  1. Load session (must be WAITING_ARRIVAL, belong to this volunteer)
  2. Check proximity against task.place.proximityThresholdMeters
  3. Set status=ACTIVE, startedAt=now
  4. Create GpsAuditLog { isFirstArrival: true, isWithinRange: true }
  5. Return updated session

logGpsPing(sessionId, volunteerId, { lat, lng })
  // Called by location gateway on every ACTIVE ping
  1. Load session (must be ACTIVE)
  2. Create GpsAuditLog { isFirstArrival: false, isWithinRange: boolean }
  3. Update session.lastLatitude, lastLongitude, increment gpsCheckCount
  // NO penalties, NO warnings, pure audit

addPeriodicPhoto(sessionId, volunteerId, { photoKey })  // NEW
  // Validate session ACTIVE + belongs to volunteer
  // Get max sequenceNo for this session + 1
  // Create SessionPhoto { photoKey, takenAt: now, sequenceNo }

submitFeedback(sessionId, volunteerId, { text })  // NEW
  // Validate session status is COMPLETED or LEFT_EARLY
  // Validate session belongs to this volunteer
  // Set session.feedback = text, session.feedbackAt = now

leaveEarly(sessionId, volunteerId, reason)
  // Validate session ACTIVE or WAITING_ARRIVAL
  // Set status=LEFT_EARLY, endReason=reason, endedAt=now
  // Calculate durationSeconds (from startedAt if was ACTIVE, else 0)
  // Mirror leaveReason + leftAt to TaskEnrollment

autoComplete(sessionId)
  // Called by scheduler at task.endTime
  // Set status=COMPLETED, endedAt=now, calculate durationSeconds
  // Call VolunteersService.updateHours(volunteerId)
```

### VolunteersService

```typescript
updateHours(volunteerId)
  // Recalculate totalVolunteeringHours = SUM(durationSeconds) / 3600 from COMPLETED sessions
  // Update Volunteer record

confirmRules(volunteerId, currentVersion)  // NEW — called by RulesController
  // Set volunteer.rulesConfirmedVersion = currentVersion

// In apply(): check volunteer.rulesConfirmedVersion before creating enrollment
// Actually rules check is in TasksService.enroll()
```

### TasksService

```typescript
enroll(taskId, volunteerId)
  // 1. Load latest Rules record
  // 2. Load volunteer
  // 3. If volunteer.rulesConfirmedVersion < rules.version:
  //      throw ForbiddenException('يجب قراءة القوانين وتأكيدها أولاً')
  // 4. Check task is OPEN + volunteer not already enrolled
  // 5. Create TaskEnrollment + Session(WAITING_ARRIVAL) in one transaction
  // 6. If task.enrollmentCount >= task.maxVolunteers → set task.status = FULL
```

### PerformanceService

```typescript
// Scoring formulas:
// consistencyScore (0-100) = SUM(isWithinRange=true pings) / SUM(total pings) * 100
//   Source: GpsAuditLog for COMPLETED sessions
// achievementScore (0-100) = SUM(isWithinRange pings * 900) / SUM(durationSeconds) * 100, capped at 100
//   GPS_CHECK_INTERVAL_SECONDS = 900 (15 min)

interface VolunteerPerformance {
  volunteerId: string
  fullName: string
  volunteerGroup: VolunteerGroup
  totalVolunteeringHours: number
  totalCompletedTasks: number
  totalVisitedPlaces: number
  consistencyScore: number | null   // null if no completed sessions
  achievementScore: number | null
  breakdown: {
    totalSessions: number
    totalGpsPings: number
    totalWithinRange: number
    totalOutOfRange: number
    gpsConfirmedTimePct: number
  }
}
```

### ChatbotService

```typescript
chat(userId, userMessage)
  // 1. Save ChatMessage { role: 'user', content: userMessage } to DB
  // 2. Load Redis key chatbot:${userId} → array of last 20 { role, content }
  // 3. If key missing → load last 20 from DB (cold start)
  // 4. Call OpenAI API:
  //    model: config.openai.model
  //    max_tokens: 1024
  //    system: SYSTEM_PROMPT (Arabic, see below)
  //    messages: [...contextWindow, { role: 'user', content: userMessage }]
  // 5. Extract reply = response.content[0].text
  // 6. Save ChatMessage { role: 'assistant', content: reply } to DB
  // 7. Push both turns to Redis, slice to last 20, reset TTL 1hr
  // 8. Return { reply }

const SYSTEM_PROMPT = `
أنت مساعد ذكي تابع لمنصة "إدمان" لدعم الوعي بمكافحة الإدمان.
مهمتك: الإجابة على أسئلة المتطوعين حول الوعي بمخاطر الإدمان
والتطوع في المنطة وبرامج مكافحة الإدمان في مصر.
يجب أن تكون ردودك باللغة العربية الفصحى المبسطة.
لا تقدم نصائح طبية أو قانونية. وجّه الحالات الطارئة لخط نجدة الإدمان: 19019.
إذا لم تستطع الإجابة، اطلب من المتطوع الاتصال بالإدارة على الرقم 19019.
`
```

### RulesService  ← NEW

```typescript
getLatest()
  // Return latest Rules record (single document, always one record)
  // If no record exists: return null

createOrUpdate(adminId, content)
  // If record exists: content = content, version++, updatedAt = now, updatedBy = adminId
  // If not: create with version=1

confirmRules(volunteerId)
  // Load latest Rules
  // Set volunteer.rulesConfirmedVersion = rules.version
```

---

## Auth Module Modifications (from tm)

### What to change in copied auth module:

```
auth.dto.ts:
  - Remove RegisterDto, RegisterForm
  - Keep only LoginDto { phone: string }
  - No password field anywhere

auth.service.ts:
  - login(phone): if user not found → create User({ phone, isPhoneVerified: false }) → same OTP flow
  - verifyOtp(): ADD applicationStatus to response
    Look up Volunteer by userId → return volunteer?.applicationStatus ?? null

auth.controller.ts:
  - Remove /register endpoint
  - Replace normalize pipes with NormalizePhonePipe
  - Keep: /login, /verify-otp, /logout, /refresh-token, /resend-otp

strategies/login-otp.strategy.ts:
  - postVerification({ phone }):
    Fetch User by phone
    Mark user.isPhoneVerified = true
    Fetch Volunteer record (may be null)
    Return { accessToken, refreshToken, applicationStatus: volunteer?.applicationStatus ?? null }

strategies/register-otp.strategy.ts:
  - REMOVE — no separate register flow

strategies/otp-verification.strategy.ts:
  - Add applicationStatus: ApplicationStatus | null to OtpVerificationResult

strategies/otp-strategy.resolver.ts:
  - Remove 'register' case — only 'login' purpose remains
```

---

## Guards & Decorators

### groups.guard.ts (create new — mirrors roles.guard.ts)

```typescript
@Injectable()
export class GroupsGuard implements CanActivate {
  // Reads 'groups' metadata from Reflector
  // If no metadata → pass through (no-op)
  // Load volunteer record for logged-in user
  // If volunteer has no volunteerGroup → throw ForbiddenException
  // Service layer uses the volunteer's group for filtering
}
```

### Decorators in common/decorators/index.ts

```typescript
// Keep from tm:
OTP            // extracts req.otpPayload
Roles(...roles) // SetMetadata('roles', roles)
logoutJti      // extracts { jti, exp }
refreshToken   // extracts { jti, userId, role, exp }

// Rename:
AuthUser → CurrentUser  // returns req.loggedInUser.user (User entity only)

// Remove:
IsEmailOrPhone

// Add:
Groups(...groups)  // SetMetadata('groups', groups)
Auth(...roles)     // composite: UseGuards(AuthGuard, RolesGuard) + Roles(...roles)
AuthGroup()        // composite: UseGuards(AuthGuard, RolesGuard, GroupsGuard) + Roles(VOLUNTEER) + Groups()
```

---

## New Utils to Create

### normalize-phone.util.ts

```typescript
// Strips whitespace + formatting chars
// Validates Egyptian format (+20XXXXXXXXXX or 01XXXXXXXXX)
// Returns normalized string
// Throws BadRequestException('رقم الهاتف غير صحيح') on invalid
```

### location.utils.ts

```typescript
// Haversine formula — returns distance in meters
calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number

// Returns true if distance <= thresholdMeters
isWithinProximity(vLat: number, vLng: number, pLat: number, pLng: number, thresholdMeters: number): boolean
```

---

## configuration.ts

```typescript
export default () => ({
  database:  { url: process.env.DB_URL },
  redis:     { url: process.env.REDIS_URL },
  jwt: {
    accessSecret:    process.env.JWT_ACCESS_SECRET,
    refreshSecret:   process.env.JWT_REFRESH_SECRET,
    prefix:          process.env.JWT_PREFIX || 'Bearer',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  otp: {
    sessionSecret: process.env.OTP_SESSION_SECRET,
    expiresIn:     process.env.OTP_EXPIRES_IN || '5m',
    saltRounds:    parseInt(process.env.SALT_ROUNDS || '10'),
  },
  location: {
    proximityDefaultMeters: parseInt(process.env.GPS_PROXIMITY_THRESHOLD_DEFAULT_METERS || '300'),
    checkIntervalSeconds:   parseInt(process.env.GPS_CHECK_INTERVAL_SECONDS || '900'),
  },
  aws: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region:          process.env.AWS_REGION,
    s3Bucket:        process.env.AWS_S3_BUCKET,
  },
  firebase: {
    projectId:   process.env.FIREBASE_PROJECT_ID,
    privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model:  process.env.OPENAI_MODEL || 'gpt-4o',
  },
});
```

---

## main.ts Setup

```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new UnifiedResponseInterceptor());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Edman API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3000);
}
```

---

## Response Shape

All responses go through UnifiedResponseInterceptor:
```json
{ "statusCode": 200, "message": "success", "data": { ... } }
```

All errors go through HttpExceptionFilter:
```json
{ "statusCode": 400, "message": "Bad Request", "timestamp": "...", "path": "/api/..." }
```

---

## Notification Systems — Two Separate Systems

### System 1: FCM Push (notifications.service.ts)
Only two use cases:
- OTP delivery: `sendOtpToPhone(phone, code)` — called from auth.service.login()
  Development: `console.log(code)` placeholder
  Production: Firebase Admin SDK messaging
- Application result: `sendApplicationResult(fcmToken, status, data?)` — called from volunteers.service after approve/reject

### System 2: WebSocket In-App (notifications.gateway.ts)
Only two use cases:
- New feed announcements: emit to group room or all-volunteers
- New content alerts: emit to all-volunteers

FeedService calls both systems when creating an announcement:
1. Save Announcement to DB
2. Call NotificationsGateway.emitToGroup()/emitToAll() → online users (real-time)
3. Call NotificationsService.sendToGroup(group, title, body) via FCM → offline users (push)

---

## Scheduled Job — Session Auto-Complete

```typescript
// In sessions.module.ts or a dedicated schedule.service.ts
@Cron('*/1 * * * *')  // every minute
async checkSessionAutoComplete() {
  // Find all ACTIVE sessions where task.endTime <= now
  // For each: call this.autoComplete(sessionId)
}

autoComplete(sessionId) {
  // Set status=COMPLETED, endedAt=now
  // Calculate durationSeconds = (endedAt - startedAt)
  // Call VolunteersService.updateHours(volunteerId)
}
```

---

## Key Architectural Rules

1. **Proximity check is server-side**: `isWithinProximity()` runs in location.gateway.ts and sessions.service.ts. Client cannot spoof GPS-based session activation.

2. **Session timer starts server-side**: `startedAt` is set by `confirmArrival()` on the server, not by the client. Client receives it in `session:confirmed` event.

3. **Rules gate is enforced server-side**: `POST /tasks/:id/enroll` throws 403 if `volunteer.rulesConfirmedVersion < rules.version`. Client-side gate is UX only.

4. **Feedback is per-session**: `POST /sessions/:id/feedback` only works when session.status is COMPLETED or LEFT_EARLY. Server validates this. No skipping.

5. **Periodic photos are server-logged**: `POST /sessions/:id/photos` only works when session is ACTIVE. Client can upload but server validates.

6. **No separate /sessions/start**: Enrollment auto-creates Session(WAITING_ARRIVAL). The WAITING_ARRIVAL → ACTIVE transition happens via WebSocket gateway when first GPS ping is within proximity.

7. **GPS is pure audit**: No penalties, no challenge photos, no warnings. GpsAuditLog is for performance scoring only.

8. **proximityThresholdMeters is per-place**: Read `task.place.proximityThresholdMeters` — never use a global value. The env var is a fallback default only.

9. **SUB_ADMIN group isolation**: FeedService forces `targetGroup = subAdmin.assignedGroup` regardless of what the sub-admin sends in the request body.

10. **Arabic enum values in PG**: Enum values are Arabic strings (e.g., `'الهرم'`, `'فيصل'`). PostgreSQL stores them as UTF-8 VARCHAR — no special configuration needed.

11. **Redis TTL strategy**: Location cache TTL = 20min (longer than 15min ping interval, tolerates one missed ping). Chat context TTL = 1hr (reset on each message). OTP blacklist TTL = token's remaining exp time.

12. **S3 uploads are direct**: Server generates presigned PUT URL, returns `{ uploadUrl, key }`. Client uploads binary directly to S3. Server never proxies file data.

---

## What NOT to Build

- No web frontend (admin panel is separate, out of scope)
- No rate limiting (deferred to later)
- No crash reporting
- No multi-language support — Arabic only in all user-facing responses
- No email functionality — phone + FCM only
- No payment processing
- No volunteer-to-volunteer messaging — chatbot is AI only
