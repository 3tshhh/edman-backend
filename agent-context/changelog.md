# Phase Changelog

## Phase 1 — Foundation
**Date:** 2026-03-20
**Status:** COMPLETE

### What was built
- Typed config module (`configuration.ts` + `database.config.ts`)
- Common layer: enums, guards (auth, roles, groups skeleton, otp), decorators, interceptors, filters, pipes, token service, utils
- OTP module (generate, verify, invalidate, session tokens)
- User entity (phone, role, fcmToken, isPhoneVerified)
- Auth module (phone-only OTP login, no password, auto-create user)

### Endpoints added
- `POST /api/auth/login` — send OTP to phone
- `POST /api/auth/verify-otp` — verify OTP, return tokens + role + isNewUser
- `POST /api/auth/logout` — blacklist access token
- `POST /api/auth/refresh-token` — rotate token pair
- `POST /api/auth/resend-otp` — invalidate old OTP, issue new one

### Key decisions
- Single enum `role` column (not array) — one role per user
- `verify-otp` returns `role` and `isNewUser` so Flutter can route without needing Volunteer entity
- `applicationStatus` returns `null` until Phase 2 wires up Volunteer lookup
- GroupsGuard is a pass-through skeleton until Phase 2

### TODOs for later phases
- ~~Phase 2: Look up Volunteer record in login strategy for `applicationStatus`~~ DONE
- ~~Phase 2: Complete GroupsGuard with actual group checking logic~~ DONE

---

## Phase 2 — Core Domain
**Date:** 2026-03-20
**Status:** COMPLETE

### What was built
- Volunteer entity with full application flow (apply, approve, reject, ban, change group)
- Admin + SubAdmin entities with admin seeding on startup
- Center entity with group-scoped CRUD
- Rules entity with version tracking and volunteer confirmation
- Place entity with per-place proximity threshold and open task count
- Task entity with enrollment + atomic session creation
- TaskEnrollment entity linking volunteers to tasks
- Session entity (entity only — full module in Phase 3)
- Uploads module with S3 presigned PUT URL generation
- Completed GroupsGuard with volunteer lookup and `@CurrentVolunteer()` decorator
- Wired `applicationStatus` into login OTP strategy
- Made UserModule global for cross-module guard access

### Endpoints added
- `POST /api/volunteers/apply` — submit volunteer application
- `GET /api/volunteers/me` — volunteer profile with stats
- `GET /api/volunteers/me/history` — placeholder (Phase 3)
- `PATCH /api/volunteers/me/fcm-token` — update push notification token
- `GET /api/volunteers` — admin: list all volunteers
- `GET /api/volunteers/applications` — admin: list applications
- `PATCH /api/volunteers/:id/approve` — admin: approve + assign group + set role
- `PATCH /api/volunteers/:id/reject` — admin: reject with reason
- `PATCH /api/volunteers/:id/group` — admin: change volunteer group
- `PATCH /api/volunteers/:id/ban` — admin: ban volunteer
- `POST /api/admins/sub-admins` — admin: create sub-admin
- `GET /api/admins/sub-admins` — admin: list sub-admins
- `DELETE /api/admins/sub-admins/:id` — admin: remove sub-admin
- `GET /api/centers` — volunteer: group-scoped centers
- `GET /api/centers/:id` — volunteer: single center
- `POST /api/centers` — admin: create center
- `PATCH /api/centers/:id` — admin: update center
- `DELETE /api/centers/:id` — admin: delete center
- `GET /api/rules` — volunteer: get latest rules
- `POST /api/rules/confirm` — volunteer: confirm rules version
- `POST /api/rules` — admin: create/update rules
- `GET /api/places/mine` — volunteer: group-scoped places with open task count
- `GET /api/places/:id` — volunteer: single place
- `POST /api/places` — admin: create place
- `PATCH /api/places/:id` — admin: update place
- `DELETE /api/places/:id` — admin: delete place
- `GET /api/tasks/mine` — volunteer: group-scoped tasks
- `GET /api/tasks/:id` — volunteer: single task with place
- `POST /api/tasks/:id/enroll` — volunteer: enroll + create session atomically
- `POST /api/tasks` — admin: create task
- `PATCH /api/tasks/:id` — admin: update task
- `DELETE /api/tasks/:id` — admin: delete task
- `POST /api/uploads/presign` — any auth user: get S3 presigned PUT URL

### Key decisions
- UserModule made `@Global()` so AuthGuard can resolve UserService across all modules
- Session entity created in Phase 2 (registered in TasksModule) to support atomic enrollment
- PlacesService queries Task table directly (via injected repository) to avoid circular dependency for open task count
- GroupsGuard attaches `volunteer` to request for downstream `@CurrentVolunteer()` access
- Admin seeding via `onModuleInit` using `ADMIN_PHONE` env var

### TODOs for later phases
- ~~Phase 3: Full SessionsModule (service, controller, cron job, GPS, leave, photos, feedback)~~ DONE
- ~~Phase 3: `volunteers/me/history` full implementation~~ DONE
- ~~Phase 3: Active session check before task deletion~~ DONE
- ~~Phase 3: `updateHours()` recalculation from session data~~ DONE
- Phase 4: FCM notifications on approve/reject

---

## Phase 3 — Sessions & Real-Time
**Date:** 2026-03-21
**Status:** COMPLETE

### What was built
- GpsAuditLog entity (GPS audit trail per session ping)
- SessionPhoto entity (periodic photos with auto-incremented sequenceNo)
- Full SessionsModule: service, controller, DTOs, cron job for auto-complete
- MapModule: admin live map context endpoint combining Redis + DB data
- PerformanceModule: volunteer performance metrics, leaderboard, group stats
- LocationModule: WebSocket gateway at `/location` for GPS pings + session confirmation
- Resolved all Phase 2 deferred items (history, delete checks, hours recalculation)

### Endpoints added
- `GET /api/sessions/active` — volunteer: current active/waiting session
- `GET /api/sessions/history` — volunteer: completed sessions paginated
- `POST /api/sessions/:id/gps-ping` — volunteer: REST fallback for GPS audit
- `POST /api/sessions/:id/leave` — volunteer: leave early with reason
- `POST /api/sessions/:id/photos` — volunteer: add periodic photo
- `POST /api/sessions/:id/feedback` — volunteer: post-session feedback
- `GET /api/sessions` — admin: list all sessions with filters
- `POST /api/sessions/:id/abandon` — admin: force-abandon session
- `GET /api/map/context` — admin: live map data with active volunteers
- `GET /api/performance/me` — volunteer: personal performance metrics
- `GET /api/performance/leaderboard` — admin: volunteer leaderboard
- `GET /api/performance/volunteers/:id` — admin: single volunteer performance
- `GET /api/performance/groups` — admin: per-group aggregate stats

### WebSocket events (namespace: /location)
- `volunteer:location` (client → server) — GPS ping with session handling
- `session:confirmed` (server → client) — WAITING_ARRIVAL → ACTIVE transition
- `admin:volunteer-location` (server → admin room) — live volunteer location
- `admin:session-activated` (server → admin room) — session activated alert
- `admin:volunteer-offline` (server → admin room) — volunteer disconnected

### Key decisions
- SessionsService wired into VolunteersService/TasksService/PlacesService via `setSessionsService()` in AppModule.onModuleInit to avoid circular dependencies
- Cron job runs every minute to auto-complete ACTIVE sessions past task.endTime
- Performance scores use GPS_CHECK_INTERVAL_SECONDS = 900 (15min) for achievement calculation
- Hours recalculation happens in SessionsService.recalculateHours() from COMPLETED session durations
- ScheduleModule.forRoot() added to app.module.ts for cron support

### TODOs for later phases
- Phase 4: FeedModule, NotificationsModule (WebSocket + FCM), ChatbotModule
- Phase 4: FCM notifications on approve/reject
