# Phase 3 — Sessions & Real-Time

> **Status:** COMPLETE
> **Prerequisite:** Phase 2 must be complete and building successfully.

---

## Scope

```
Step 12:  src/modules/sessions/        — full session lifecycle (service, controller, cron, entities)
Step 13:  src/modules/map/             — admin live map context endpoint
Step 14:  src/modules/performance/     — volunteer performance metrics + leaderboard
Step 15:  src/modules/location/        — WebSocket gateway for GPS pings + session confirmation
```

---

## Phase 2 Deferred Items to Resolve

### D1 — `volunteers/me/history` full implementation
Update `VolunteersService.getMyHistory()` to query Session + TaskEnrollment data instead of returning empty placeholders.

### D2 — `places/mine` active session check on delete
Update `PlacesService.remove()` to check for active sessions before allowing deletion.

### D3 — `tasks/:id` active session check on delete
Update `TasksService.remove()` to check for active sessions before allowing task deletion.

### D4 — `updateHours()` recalculation from actual session data
Update `VolunteersService.updateHours()` to recalculate from Session data instead of accepting a parameter.

---

## Step 12 — Sessions Module

### 12.1 New Entity: `src/modules/sessions/entities/gps-audit-log.entity.ts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `session` | ManyToOne → Session | required |
| `volunteer` | ManyToOne → Volunteer | required |
| `latitude` | decimal(10,7) | required |
| `longitude` | decimal(10,7) | required |
| `isWithinRange` | boolean | required |
| `isFirstArrival` | boolean | default false — true for the ping that triggered WAITING_ARRIVAL → ACTIVE |
| `createdAt` | timestamp | CreateDateColumn |

### 12.2 New Entity: `src/modules/sessions/entities/session-photo.entity.ts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `session` | ManyToOne → Session | required |
| `photoKey` | varchar(500) | required — S3 key |
| `takenAt` | timestamp | CreateDateColumn |
| `sequenceNo` | int | required — auto-incremented per session |

### 12.3 DTOs: `src/modules/sessions/dto/`

**`gps-ping.dto.ts`**
- `lat`: number, `@IsNumber()`, `@IsNotEmpty()`
- `lng`: number, `@IsNumber()`, `@IsNotEmpty()`

**`leave-session.dto.ts`**
- `reason`: string, `@IsNotEmpty()`, `@IsString()`

**`session-photo.dto.ts`**
- `photoKey`: string, `@IsNotEmpty()`, `@IsString()`

**`session-feedback.dto.ts`**
- `text`: string, `@IsNotEmpty()`, `@IsString()`

**`query-sessions.dto.ts`** (admin)
- `volunteerId`: string, `@IsOptional()`, `@IsUUID()`
- `taskId`: string, `@IsOptional()`, `@IsUUID()`
- `status`: SessionStatus, `@IsOptional()`, `@IsEnum(SessionStatus)`
- `group`: VolunteerGroup, `@IsOptional()`, `@IsEnum(VolunteerGroup)`
- `page`: number, `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, default 1
- `limit`: number, `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, `@Max(100)`, default 20

### 12.4 Service: `src/modules/sessions/sessions.service.ts`

**`findActive(userId: string): Promise<Session | null>`**
1. Load volunteer by user ID
2. Find session where `volunteer.id` matches AND status is ACTIVE or WAITING_ARRIVAL
3. Load task relation (with place)
4. Return session or null

**`findHistory(userId: string, page, limit): Promise<{ data: Session[], total: number }>`**
1. Load volunteer by user ID
2. Query sessions where `volunteer.id` matches AND status is COMPLETED, LEFT_EARLY, or ABANDONED
3. Include task + place relations
4. Paginate, order by `createdAt DESC`

**`gpsPing(sessionId: string, userId: string, lat: number, lng: number): Promise<GpsAuditLog>`**
- REST fallback for GPS audit (WebSocket is primary)
1. Load session, verify belongs to this volunteer, verify ACTIVE status
2. Load task → place
3. Check proximity: `isWithinProximity(lat, lng, place.latitude, place.longitude, place.proximityThresholdMeters)`
4. Create GpsAuditLog entry: `{ isFirstArrival: false, isWithinRange }`
5. Update session: `lastLatitude`, `lastLongitude`, increment `gpsCheckCount`
6. Return log entry

**`confirmArrival(sessionId: string, volunteerId: string, coords: { lat: number, lng: number }): Promise<Session>`**
- Called by location gateway when WAITING_ARRIVAL volunteer is within proximity
1. Load session (must be WAITING_ARRIVAL, must belong to this volunteer)
2. Load task → place
3. Check proximity against `task.place.proximityThresholdMeters`
4. Set `status = ACTIVE`, `startedAt = now`
5. Create GpsAuditLog `{ isFirstArrival: true, isWithinRange: true }`
6. Update `lastLatitude`, `lastLongitude`, increment `gpsCheckCount`
7. Return updated session

**`logGpsPing(sessionId: string, volunteerId: string, coords: { lat: number, lng: number }): Promise<void>`**
- Called by location gateway on every ACTIVE ping
1. Load session (must be ACTIVE)
2. Load task → place
3. Create GpsAuditLog `{ isFirstArrival: false, isWithinRange: boolean }`
4. Update `lastLatitude`, `lastLongitude`, increment `gpsCheckCount`
- No penalties, no warnings — pure audit

**`leaveEarly(sessionId: string, userId: string, reason: string): Promise<Session>`**
1. Load session, verify belongs to this volunteer
2. Verify status is ACTIVE or WAITING_ARRIVAL
3. Set `status = LEFT_EARLY`, `endReason = reason`, `endedAt = now`
4. Calculate `durationSeconds`: if was ACTIVE → `(endedAt - startedAt)` in seconds; if WAITING_ARRIVAL → 0
5. Mirror `leaveReason` + `leftAt` to TaskEnrollment record
6. Call `recalculateHours(volunteerId)`
7. Return updated session

**`addPhoto(sessionId: string, userId: string, photoKey: string): Promise<SessionPhoto>`**
1. Load session, verify belongs to this volunteer, verify ACTIVE status
2. Get max `sequenceNo` for this session + 1
3. Create SessionPhoto `{ photoKey, sequenceNo }`
4. Return photo record

**`submitFeedback(sessionId: string, userId: string, text: string): Promise<Session>`**
1. Load session, verify belongs to this volunteer
2. Verify status is COMPLETED or LEFT_EARLY
3. Set `session.feedback = text`, `session.feedbackAt = now`
4. Return updated session

**`abandon(sessionId: string, reason: string): Promise<Session>`** (admin)
1. Load session, verify status is ACTIVE or WAITING_ARRIVAL
2. Set `status = ABANDONED`, `endReason = reason`, `endedAt = now`
3. Calculate `durationSeconds`
4. Return updated session

**`autoComplete(sessionId: string): Promise<void>`**
- Called by cron scheduler at task.endTime
1. Load session (must be ACTIVE)
2. Set `status = COMPLETED`, `endedAt = now`
3. Calculate `durationSeconds = (endedAt - startedAt)` in seconds
4. Call `recalculateHours(session.volunteer.id)`

**`findAll(query: QuerySessionsDto): Promise<{ data: Session[], total: number }>`** (admin)
1. Build TypeORM query on Session with joins on volunteer + task
2. Apply filters from query DTO
3. Return paginated results

**`checkAutoComplete(): void`** (cron job)
- `@Cron('*/1 * * * *')` — every minute
1. Find all ACTIVE sessions where task.scheduledDate + task.endTime <= now
2. For each: call `autoComplete(sessionId)`

**Private helper: `recalculateHours(volunteerId: string): Promise<void>`**
- SUM all `durationSeconds` from COMPLETED sessions for this volunteer
- Divide by 3600
- Update volunteer's `totalVolunteeringHours`

### 12.5 Controller: `src/modules/sessions/sessions.controller.ts`

| Method | Route | Guard | Body/Query | Service Call |
|---|---|---|---|---|
| `GET` | `/sessions/active` | `@Auth(VOLUNTEER)` | — | `findActive(user.id)` |
| `GET` | `/sessions/history` | `@Auth(VOLUNTEER)` | `page?, limit?` | `findHistory(user.id, page, limit)` |
| `POST` | `/sessions/:id/gps-ping` | `@Auth(VOLUNTEER)` | `GpsPingDto` | `gpsPing(id, user.id, lat, lng)` |
| `POST` | `/sessions/:id/leave` | `@Auth(VOLUNTEER)` | `LeaveSessionDto` | `leaveEarly(id, user.id, reason)` |
| `POST` | `/sessions/:id/photos` | `@Auth(VOLUNTEER)` | `SessionPhotoDto` | `addPhoto(id, user.id, photoKey)` |
| `POST` | `/sessions/:id/feedback` | `@Auth(VOLUNTEER)` | `SessionFeedbackDto` | `submitFeedback(id, user.id, text)` |
| `GET` | `/sessions` | `@Auth(ADMIN)` | `QuerySessionsDto` | `findAll(query)` |
| `POST` | `/sessions/:id/abandon` | `@Auth(ADMIN)` | `LeaveSessionDto` | `abandon(id, reason)` |

**Route ordering:** `/sessions/active` and `/sessions/history` BEFORE `/sessions/:id`.

### 12.6 Module: `src/modules/sessions/sessions.module.ts`

- Import `TypeOrmModule.forFeature([Session, GpsAuditLog, SessionPhoto, TaskEnrollment])`
- Import `VolunteersModule` (for volunteer lookup + hours recalculation)
- Import `ScheduleModule.forRoot()` in AppModule (not here)
- Provide `SessionsService`
- Export `SessionsService` (needed by LocationGateway, MapService, PerformanceService)
- Controller: `SessionsController`

---

## Step 13 — Map Module

### 13.1 Service: `src/modules/map/map.service.ts`

**`getContext(): Promise<{ activeVolunteers: object[], summary: object }>`**
1. Scan Redis for all `location:*` keys (use CACHE_MANAGER or direct Redis scan)
2. Load all active sessions (ACTIVE or WAITING_ARRIVAL) with volunteer + task + place
3. Merge Redis location data with session data
4. Return:
```typescript
{
  activeVolunteers: [
    { volunteerId, fullName, volunteerGroup, lat, lng, timestamp, sessionStatus, taskTitle, placeName }
  ],
  summary: {
    total: number,
    byGroup: Record<VolunteerGroup, number>,
    byStatus: { active: number, waitingArrival: number }
  }
}
```

### 13.2 Controller: `src/modules/map/map.controller.ts`

| Method | Route | Guard | Service Call |
|---|---|---|---|
| `GET` | `/map/context` | `@Auth(ADMIN)` | `getContext()` |

### 13.3 Module: `src/modules/map/map.module.ts`

- Import `SessionsModule` (for session queries)
- Import `VolunteersModule` (for volunteer data)
- Provide `MapService`
- Controller: `MapController`

---

## Step 14 — Performance Module

### 14.1 Service: `src/modules/performance/performance.service.ts`

**Scoring formulas:**
```
consistencyScore (0-100) = SUM(isWithinRange=true pings) / SUM(total pings) * 100
achievementScore (0-100) = SUM(isWithinRange pings * 900) / SUM(durationSeconds) * 100, capped at 100
```

**Interface `VolunteerPerformance`:**
```typescript
{
  volunteerId: string
  fullName: string
  volunteerGroup: VolunteerGroup
  totalVolunteeringHours: number
  totalCompletedTasks: number
  totalVisitedPlaces: number
  consistencyScore: number | null
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

**`getMyPerformance(userId: string): Promise<VolunteerPerformance>`**
1. Load volunteer by user ID
2. Query completed sessions count + unique place count
3. Query GPS audit logs for completed sessions: total pings, within-range count
4. Compute consistency + achievement scores
5. Return VolunteerPerformance

**`getLeaderboard(query): Promise<{ data: VolunteerPerformance[], total: number }>`**
1. Load volunteers matching group filter
2. Compute performance for each
3. Sort by requested field (`hours`, `tasks`, `places`, `consistency`, `achievement`)
4. Paginate and return

**`getVolunteerPerformance(volunteerId: string): Promise<VolunteerPerformance>`** (admin)
1. Load volunteer by ID
2. Same computation as getMyPerformance

**`getGroupStats(): Promise<object[]>`** (admin)
1. Group volunteers by `volunteerGroup`
2. Per group: `volunteerCount`, `avgHours`, `avgConsistency`, `avgAchievement`, top 3 performers

### 14.2 Controller: `src/modules/performance/performance.controller.ts`

| Method | Route | Guard | Query | Service Call |
|---|---|---|---|---|
| `GET` | `/performance/me` | `@Auth(VOLUNTEER)` | — | `getMyPerformance(user.id)` |
| `GET` | `/performance/leaderboard` | `@Auth(ADMIN)` | `sortBy, order, group?, page?, limit?` | `getLeaderboard(query)` |
| `GET` | `/performance/volunteers/:id` | `@Auth(ADMIN)` | — | `getVolunteerPerformance(id)` |
| `GET` | `/performance/groups` | `@Auth(ADMIN)` | — | `getGroupStats()` |

### 14.3 DTOs: `src/modules/performance/dto/`

**`query-leaderboard.dto.ts`**
- `sortBy`: string, `@IsOptional()`, `@IsIn(['hours', 'tasks', 'places', 'consistency', 'achievement'])`, default `'hours'`
- `order`: string, `@IsOptional()`, `@IsIn(['asc', 'desc'])`, default `'desc'`
- `group`: VolunteerGroup, `@IsOptional()`, `@IsEnum(VolunteerGroup)`
- `page`, `limit` — same pattern

### 14.4 Module: `src/modules/performance/performance.module.ts`

- Import `TypeOrmModule.forFeature([Session, GpsAuditLog, Volunteer])`
- Import `VolunteersModule`
- Provide `PerformanceService`
- Controller: `PerformanceController`

---

## Step 15 — Location Module (WebSocket Gateway)

### 15.1 Gateway: `src/modules/location/location.gateway.ts`

```typescript
@WebSocketGateway({ cors: true, namespace: '/location' })
```

**Connection (`handleConnection`):**
1. Extract JWT from `socket.handshake.auth.token`
2. Verify via `TokenService.verifyToken()`
3. Load user via `UserService.findById()`
4. If invalid → disconnect
5. If ADMIN → join `admin-live-map` room
6. If VOLUNTEER → load volunteer, join `volunteer:${volunteerId}` room
7. Store socket → volunteer mapping

**Event: `volunteer:location` (client → server)**
payload: `{ lat: number, lng: number }`

1. Validate sender role = VOLUNTEER
2. Load volunteer (get volunteerGroup, volunteerId, fullName)
3. Cache to Redis: `location:${volunteerId}` → `{ lat, lng, timestamp: now }`, TTL 20min
4. Broadcast to `admin-live-map`: `admin:volunteer-location` `{ volunteerId, fullName, lat, lng, timestamp, volunteerGroup }`
5. Load volunteer's current session (ACTIVE or WAITING_ARRIVAL) with task → place
6. If WAITING_ARRIVAL:
   - Check proximity: `isWithinProximity(lat, lng, place.latitude, place.longitude, place.proximityThresholdMeters)`
   - If in range: call `SessionsService.confirmArrival(sessionId, volunteerId, { lat, lng })`
   - Emit to volunteer socket: `session:confirmed` `{ sessionId, startedAt, taskTitle, placeName, message: 'تم تأكيد موقعك — بدأت جلسة التطوع' }`
   - Emit to `admin-live-map`: `admin:session-activated` `{ volunteerId, sessionId, taskTitle, lat, lng }`
7. If ACTIVE:
   - Call `SessionsService.logGpsPing(sessionId, volunteerId, { lat, lng })`
   - No events to volunteer (pure audit)

**Disconnect (`handleDisconnect`):**
1. Delete `location:${volunteerId}` from Redis
2. Emit to `admin-live-map`: `admin:volunteer-offline` `{ volunteerId }`

### 15.2 Module: `src/modules/location/location.module.ts`

- Import `SessionsModule`
- Import `VolunteersModule`
- Import `UserModule`
- Provide `LocationGateway`

**Note:** The gateway needs TokenService (provided globally via GlobalModule) and CACHE_MANAGER (global).

---

## Phase 2 Deferred Fixes

### Fix D1 — VolunteersService.getMyHistory()
Update to query sessions with COMPLETED + LEFT_EARLY statuses for this volunteer, include task + place.

### Fix D2 — PlacesService.remove()
Add check: count sessions with ACTIVE or WAITING_ARRIVAL status for any task at this place.

### Fix D3 — TasksService.remove()
Add check: count sessions with ACTIVE or WAITING_ARRIVAL status for this task.

### Fix D4 — VolunteersService.updateHours()
Change signature to `updateHours(volunteerId: string): Promise<void>`. Recalculate from SUM of `durationSeconds` from COMPLETED sessions.

---

## Phase 3 Wiring — app.module.ts Update

```typescript
imports: [
  // ... existing Phase 1 + 2 modules ...
  ScheduleModule.forRoot(),  // ← for cron jobs
  SessionsModule,            // ← new
  MapModule,                 // ← new
  PerformanceModule,         // ← new
  LocationModule,            // ← new
]
```

---

## Endpoints Available After Phase 3

```
── Sessions ──
GET    /api/sessions/active            (volunteer)
GET    /api/sessions/history           (volunteer)
POST   /api/sessions/:id/gps-ping     (volunteer, REST fallback)
POST   /api/sessions/:id/leave        (volunteer)
POST   /api/sessions/:id/photos       (volunteer)
POST   /api/sessions/:id/feedback     (volunteer)
GET    /api/sessions                   (admin)
POST   /api/sessions/:id/abandon      (admin)

── Map ──
GET    /api/map/context                (admin)

── Performance ──
GET    /api/performance/me             (volunteer)
GET    /api/performance/leaderboard    (admin)
GET    /api/performance/volunteers/:id (admin)
GET    /api/performance/groups         (admin)

── WebSocket: /location ──
Event: volunteer:location              (client → server)
Event: session:confirmed               (server → client)
Event: admin:volunteer-location        (server → admin room)
Event: admin:session-activated         (server → admin room)
Event: admin:volunteer-offline         (server → admin room)
```

---

## Build Order Within Phase 3

1. **GpsAuditLog + SessionPhoto entities** — needed by everything else
2. **SessionsModule** (service, controller, DTOs, cron) — core lifecycle
3. **Phase 2 deferred fixes** — history, active session checks, updateHours
4. **MapModule** — depends on sessions + Redis
5. **PerformanceModule** — depends on sessions + GPS logs
6. **LocationModule** — WebSocket gateway, depends on sessions + volunteers
7. **Update app.module.ts** — add ScheduleModule + all new modules

---

## Verification Checklist

1. `npm run build` compiles without errors
2. `npm run start:dev` starts and new entities sync to PostgreSQL
3. `GET /api/sessions/active` returns null for volunteer with no active session
4. `POST /api/sessions/:id/leave` transitions session to LEFT_EARLY with reason
5. `POST /api/sessions/:id/photos` creates a photo record with auto-incremented sequenceNo
6. `POST /api/sessions/:id/feedback` only works for COMPLETED or LEFT_EARLY sessions
7. Cron job runs every minute and auto-completes expired ACTIVE sessions
8. `GET /api/map/context` returns combined Redis + DB data for admin
9. `GET /api/performance/me` returns computed scores
10. WebSocket at `/location` accepts JWT auth and processes GPS pings
11. Volunteer GPS ping within proximity triggers WAITING_ARRIVAL → ACTIVE
12. Admin live map room receives volunteer location broadcasts
13. Task deletion blocked if active sessions exist
14. `volunteers/me/history` returns real session data
