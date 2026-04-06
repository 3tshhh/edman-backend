# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Volunteer coordination API for the Egyptian Anti-Drug Fund volunteer mobile app. Three roles: VOLUNTEER (mobile app), ADMIN (web panel), SUB_ADMIN (web panel, group-scoped). Arabic is the primary language — all user-facing enum values are Arabic strings.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | NestJS (TypeScript, strict mode) |
| Database | PostgreSQL via TypeORM |
| Cache | Redis via @nestjs/cache-manager |
| WebSocket | Socket.IO via @nestjs/websockets + @nestjs/platform-socket.io |
| Auth | JWT (access 15m + refresh 7d) + OTP (6-digit, 5min TTL, bcrypt hashed) |
| File Storage | AWS S3 presigned PUT URLs via @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner |
| Push Notifications | Firebase Admin SDK (firebase-admin) |
| AI Chatbot | OpenAI API (openai SDK) |
| API Docs | @nestjs/swagger at /api/docs |
| Validation | class-validator + class-transformer, global ValidationPipe (whitelist, forbidNonWhitelisted, transform) |
| Scheduling | @nestjs/schedule (session auto-complete cron job) |

## Commands

```bash
# Infrastructure
docker compose up -d                    # Start Postgres + Redis

# Development
npm run start:dev                       # Start with hot-reload
npm run build                           # Compile TypeScript
npm run lint                            # ESLint
npm run test                            # Unit tests
npm run test -- --testPathPattern=<pattern>  # Run single test file
```

## Context Documents

**Read `agent-context/backend_context.md` before writing any code.** It is the single source of truth for entities, endpoints, service logic, WebSocket events, and architectural rules. Additional phase files (`PHASE-1-FOUNDATION.md` through `PHASE-5-GAPS.md`) and `flutter_app_flow.md` provide supplementary detail.

## Source Project

Auth, OTP, guards, token/blacklist services, interceptors, and utils are copied from `ticket-master` at `E:\Work\ticket-master`. The full copy mapping (which files copy as-is vs. which need modification) is in `backend_context.md` § "Files to COPY from Source Project".

## Architecture

### Module Layout (`src/`)

- `config/` — typed `ConfigModule` factory (`configuration.ts`) + `database.config.ts` (uses ConfigService, no raw `process.env`)
- `common/` — enums, guards (auth/roles/groups/otp), decorators, interceptors, filters, token+blacklist services, utils (location, phone normalization, hashing)
- `modules/` — feature modules: auth, otp, user, volunteers, admins, centers, places, tasks, uploads, sessions, map, performance, location, rules, feed, notifications, chatbot

### Key Patterns

- **Auth flow:** Phone + OTP only (no email, no password). Login auto-creates user if phone not in DB. Custom `AuthGuard` + `TokenService.verifyToken()` — no Passport. `verify-otp` response includes `applicationStatus`.
- **Guards stack:** `AuthGuard` → `RolesGuard` → `GroupsGuard`. GroupsGuard mirrors RolesGuard but for `VolunteerGroup`. Service layer does actual group-scoped filtering.
- **Composite decorators:** `@Auth(...roles)` = AuthGuard + RolesGuard. `@AuthGroup()` = AuthGuard + RolesGuard(VOLUNTEER) + GroupsGuard.
- **Response shape:** `UnifiedResponseInterceptor` → `{ statusCode, message, data }`. `HttpExceptionFilter` → `{ statusCode, message, timestamp, path }`.
- **Entity separation:** `User` = auth identity (phone, role, FCM token). `Volunteer` = domain profile + application state (OneToOne with User).
- **Global prefix:** All routes under `/api` (`app.setGlobalPrefix('api')`).

### Session Lifecycle

`Enroll → WAITING_ARRIVAL → (first GPS in range via WebSocket) → ACTIVE → (task end time via cron) → COMPLETED`

- Enrollment auto-creates Session (no separate start endpoint)
- WAITING_ARRIVAL → ACTIVE transition happens in `location.gateway.ts` when first GPS ping is within `place.proximityThresholdMeters`
- GPS pings are pure audit log (`GpsAuditLog`) — no penalties, no challenges, no warnings
- Volunteer can leave early with mandatory reason (`LEFT_EARLY`), admin can force-abandon (`ABANDONED`)
- Auto-complete cron runs every minute checking `task.endTime <= now` for ACTIVE sessions
- Feedback can be submitted after session ends (COMPLETED or LEFT_EARLY)
- Periodic photos are logged during ACTIVE sessions with auto-incrementing `sequenceNo`

### Build Progress

1. **Foundation:** config, common, otp, user, auth — **COMPLETE**
2. **Core Domain:** volunteers, admins, centers, rules, places, tasks, uploads — **COMPLETE**
3. **Sessions & Real-Time:** sessions, map, performance, location (WebSocket gateway) — **COMPLETE**
4. **Content & Communication:** feed, notifications, chatbot — NEXT

### WebSocket Gateways

Two separate gateways:
- **`/location`** — volunteer GPS pings, admin live map. Handles session confirmation (WAITING_ARRIVAL → ACTIVE) and GPS audit logging. Redis location cache TTL = 20min.
- **`/notifications`** — feed announcements to group rooms + all-volunteers room. FeedService calls both this gateway (online users) and FCM (offline users).

### Notifications — Two Separate Systems

- **FCM Push** (`notifications.service.ts`): OTP delivery + application result only. OTP uses `console.log` placeholder in dev.
- **WebSocket** (`notifications.gateway.ts`): Feed announcements + content alerts only. Called by FeedService alongside FCM.

## Architectural Rules

1. **proximityThresholdMeters is per-place** — read `task.place.proximityThresholdMeters`, never use global env var (it's a fallback default only)
2. **Proximity check is server-side** — client cannot spoof GPS-based session activation
3. **Session timer starts server-side** — `startedAt` set by `confirmArrival()`, not by client
4. **Rules gate enforced server-side** — `POST /tasks/:id/enroll` throws 403 if `volunteer.rulesConfirmedVersion < rules.version`
5. **SUB_ADMIN group isolation** — FeedService forces `targetGroup = subAdmin.assignedGroup` regardless of request body
6. **S3 uploads are direct** — server generates presigned PUT URL, client uploads binary directly to S3
7. **Redis TTL strategy** — location cache: 20min, chat context: 1hr (reset on each message), OTP blacklist: token's remaining exp time

## Domain Rules

- Enums use Arabic string values stored as UTF-8 VARCHAR in PostgreSQL
- `VolunteerGroup` is admin-assigned on approval — volunteers never choose their group
- Volunteers apply once only — `ConflictException` on duplicate
- One active session per volunteer at a time
- `ApplicationStatus` includes `BANNED` (set by admin ban endpoint)
- Task enrollment requires `volunteer.rulesConfirmedVersion >= latest rules.version`

## What NOT to Build

- No web frontend (admin panel is separate, out of scope)
- No rate limiting (deferred)
- No multi-language — Arabic only in all user-facing responses
- No email — phone + FCM only
- No volunteer-to-volunteer messaging — chatbot is AI only

## Environment

See `.env` for all required variables. Key services: PostgreSQL on 5432, Redis on 6379.
