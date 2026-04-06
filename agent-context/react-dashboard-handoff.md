# React Admin Dashboard — Full API & Data Handoff

> Give this entire file to a Claude Code agent building the React dashboard. It contains every API endpoint, entity shape, enum, WebSocket event, and architectural constraint needed.

---

## Project Context

**App:** Egyptian Anti-Drug Fund — volunteer coordination platform.
**This dashboard is for:** ADMIN and SUB_ADMIN roles (web panel).
**Primary language:** Arabic — all enum display values are Arabic strings. The dashboard UI should be **RTL** (right-to-left).
**Backend:** NestJS + PostgreSQL + Redis + Socket.IO

---

## Connection Details

| Item | Value |
|---|---|
| Base URL | `http://localhost:3000/api` |
| Global prefix | `/api` (all routes) |
| Auth header | `Authorization: Bearer <access_token>` |
| WebSocket namespace | `/location` (Socket.IO) |
| WS auth | `handshake.auth.token = <access_token>` |
| Swagger docs | `GET /api/docs` |

---

## Unified Response Wrapper

**Every** API response is wrapped:

```typescript
{
  statusCode: number;   // HTTP status (200, 201, etc.)
  message: string;      // 'success'
  data: T;              // Actual payload
}
```

Error responses:

```typescript
{
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
}
```

---

## Enums

```typescript
// Roles
type UserRole = 'volunteer' | 'admin' | 'sub_admin';

// Application review
type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'banned';

// Groups (Arabic values — use as-is for display AND API payloads)
type VolunteerGroup = 'الهرم' | 'فيصل';

// Session lifecycle
type SessionStatus = 'waiting_arrival' | 'active' | 'completed' | 'left_early' | 'abandoned';

// Task lifecycle
type TaskStatus = 'open' | 'full' | 'in_progress' | 'completed' | 'cancelled';

// Volunteer profile
type EducationalLevel = 'ثانوي' | 'بكالوريوس' | 'لا يوجد';
type Governorate = 'القاهرة' | 'الجيزة' | 'الإسكندرية';
type Area = 'الهرم' | 'فيصل' | 'الدقي' | 'المهندسين' | 'العجوزة';
```

**Display labels for English fallback (optional):**

| Enum | Arabic | English |
|---|---|---|
| VolunteerGroup.HARAM | الهرم | Haram |
| VolunteerGroup.FAISAL | فيصل | Faisal |
| Governorate.CAIRO | القاهرة | Cairo |
| Governorate.GIZA | الجيزة | Giza |
| Governorate.ALEXANDRIA | الإسكندرية | Alexandria |
| EducationalLevel.HIGH_SCHOOL | ثانوي | High School |
| EducationalLevel.BACHELOR | بكالوريوس | Bachelor |
| EducationalLevel.NONE | لا يوجد | None |
| Area.HARAM | الهرم | Haram |
| Area.FAISAL | فيصل | Faisal |
| Area.DOKKI | الدقي | Dokki |
| Area.MOHANDESSIN | المهندسين | Mohandessin |
| Area.AGOUZA | العجوزة | Agouza |

---

## Entity Shapes (what the API returns)

### User

```typescript
interface User {
  id: string;           // UUID
  phone: string;
  role: UserRole | null;
  isPhoneVerified: boolean;
  fcmToken: string | null;
  createdAt: string;    // ISO timestamp
  updatedAt: string;
}
```

### Volunteer

```typescript
interface Volunteer {
  id: string;
  user: User;                          // Eager loaded (nested)
  fullName: string;
  nationalId: string;                  // 14-char Egyptian national ID
  nationalIdPhotoKey: string | null;   // S3 key
  governorate: Governorate;
  area: Area;
  educationalLevel: EducationalLevel;
  hasCar: boolean;
  profilePhoto: string | null;         // S3 key
  volunteerGroup: VolunteerGroup | null; // null until approved
  applicationStatus: ApplicationStatus;
  rejectionReason: string | null;
  appliedAt: string;
  reviewedAt: string | null;
  reviewedBy: User | null;
  rulesConfirmedVersion: number;
  totalVolunteeringHours: number;      // decimal
}
```

### SubAdmin

```typescript
interface SubAdmin {
  id: string;
  user: User;
  assignedGroup: VolunteerGroup;
}
```

### Center

```typescript
interface Center {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  volunteerGroup: VolunteerGroup;
  address: string | null;
  createdAt: string;
}
```

### Place

```typescript
interface Place {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  volunteerGroup: VolunteerGroup;
  placeType: string | null;
  photoKey: string | null;
  proximityThresholdMeters: number;  // 50-5000, default 300
  address: string | null;
  createdAt: string;
}
```

### Task

```typescript
interface Task {
  id: string;
  title: string;
  description: string | null;
  place: Place;                      // Eager loaded (nested)
  volunteerGroup: VolunteerGroup;
  scheduledDate: string;             // YYYY-MM-DD
  startTime: string;                 // HH:mm:ss
  endTime: string;                   // HH:mm:ss
  maxVolunteers: number;
  status: TaskStatus;
  createdBy: User;
  enrollments: TaskEnrollment[];
  createdAt: string;
  updatedAt: string;
}
```

### TaskEnrollment

```typescript
interface TaskEnrollment {
  id: string;
  volunteer: Volunteer;
  task: Task;
  enrolledAt: string;
  leaveReason: string | null;
  leftAt: string | null;
}
```

### Session

```typescript
interface Session {
  id: string;
  volunteer: Volunteer;
  task: Task;
  status: SessionStatus;
  startedAt: string | null;          // Set when GPS confirms arrival
  endedAt: string | null;
  durationSeconds: number | null;
  endReason: string | null;
  feedback: string | null;
  feedbackAt: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  gpsCheckCount: number;
  createdAt: string;
}
```

### Rules

```typescript
interface Rules {
  id: string;
  content: string;                   // Full rules text
  version: number;                   // Auto-incrementing
  updatedAt: string;
  updatedBy: User;
}
```

---

## API Endpoints

### 1. Authentication

| Method | Endpoint | Access | Body / Query | Notes |
|---|---|---|---|---|
| POST | `/api/auth/login` | Public | `{ phone: string }` | Sends OTP to phone |
| POST | `/api/auth/verify-otp` | OTP context | `{ code: string }` (4 chars) | Returns tokens + `applicationStatus` |
| POST | `/api/auth/resend-otp` | OTP context | — | Resend OTP |
| POST | `/api/auth/refresh-token` | Refresh token | — | Returns new access token |
| POST | `/api/auth/logout` | Authenticated | — | Blacklists token |
| GET | `/api/auth/check-token` | Authenticated | — | Returns user identity |

**Auth flow:** Phone → OTP → JWT tokens (access 15min, refresh 7 days). No password, no email.

**`verify-otp` response includes:** `{ accessToken, refreshToken, user, applicationStatus }`

---

### 2. Sub-Admin Management (ADMIN only)

| Method | Endpoint | Body / Params |
|---|---|---|
| POST | `/api/admins/sub-admins` | `{ phone: string, assignedGroup: VolunteerGroup }` |
| GET | `/api/admins/sub-admins` | — |
| DELETE | `/api/admins/sub-admins/:id` | `id: uuid` |

---

### 3. Volunteer Moderation (ADMIN only)

| Method | Endpoint | Body / Query |
|---|---|---|
| GET | `/api/volunteers` | `?group=&status=&page=&limit=` |
| GET | `/api/volunteers/applications` | Same query params |
| PATCH | `/api/volunteers/:id/approve` | `{ volunteerGroup: VolunteerGroup }` |
| PATCH | `/api/volunteers/:id/reject` | `{ reason: string }` |
| PATCH | `/api/volunteers/:id/group` | `{ volunteerGroup: VolunteerGroup }` |
| PATCH | `/api/volunteers/:id/ban` | — |

**Query params (QueryVolunteersDto):**
- `group?: VolunteerGroup` — filter by group
- `status?: ApplicationStatus` — filter by application status
- `page?: number` — min 1, default 1
- `limit?: number` — 1-100, default 20

---

### 4. Centers CRUD (ADMIN only)

| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/centers` | `{ name, description?, latitude, longitude, volunteerGroup, address? }` |
| PATCH | `/api/centers/:id` | Partial of above |
| DELETE | `/api/centers/:id` | — |

**Note:** There's no GET list endpoint documented — centers may be returned via map context. Check `/api/centers` as a potential list endpoint.

---

### 5. Places CRUD (ADMIN only)

| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/places` | `{ name, description?, latitude, longitude, volunteerGroup, placeType?, photoKey?, address?, proximityThresholdMeters? }` |
| PATCH | `/api/places/:id` | Partial of above |
| DELETE | `/api/places/:id` | — |

`proximityThresholdMeters`: 50-5000, default 300. This is the GPS radius for session activation.

---

### 6. Tasks CRUD (ADMIN only)

| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/tasks` | `{ title, description?, placeId, scheduledDate, startTime, endTime, maxVolunteers? }` |
| PATCH | `/api/tasks/:id` | Partial of above |
| DELETE | `/api/tasks/:id` | — |

`scheduledDate`: ISO date string (YYYY-MM-DD). `startTime`/`endTime`: HH:mm format.

---

### 7. Sessions Monitoring (ADMIN only)

| Method | Endpoint | Query / Body |
|---|---|---|
| GET | `/api/sessions` | `?volunteerId=&taskId=&status=&group=&page=&limit=` |
| POST | `/api/sessions/:id/abandon` | `{ reason: string }` |

**Query params (QuerySessionsDto):**
- `volunteerId?: uuid`
- `taskId?: uuid`
- `status?: SessionStatus`
- `group?: VolunteerGroup`
- `page?: number` (min 1)
- `limit?: number` (1-100)

---

### 8. Performance & Analytics (ADMIN only)

#### GET `/api/performance/leaderboard`

Query: `?sortBy=&order=&group=&page=&limit=`

- `sortBy?: 'hours' | 'tasks' | 'places' | 'consistency' | 'achievement'`
- `order?: 'asc' | 'desc'`
- `group?: VolunteerGroup`
- `page?: number`, `limit?: number`

**Response data:**

```typescript
{
  data: VolunteerPerformance[];
  total: number;
}
```

```typescript
interface VolunteerPerformance {
  volunteerId: string;
  fullName: string;
  volunteerGroup: VolunteerGroup | null;
  totalVolunteeringHours: number;
  totalCompletedTasks: number;
  totalVisitedPlaces: number;
  consistencyScore: number | null;   // 0-100%
  achievementScore: number | null;   // 0-100%
  breakdown: {
    totalSessions: number;
    totalGpsPings: number;
    totalWithinRange: number;
    totalOutOfRange: number;
    gpsConfirmedTimePct: number;
  };
}
```

#### GET `/api/performance/groups`

No query params. Returns array of group stats:

```typescript
interface GroupStats {
  group: VolunteerGroup;
  volunteerCount: number;
  avgHours: number;
  avgConsistency: number | null;
  avgAchievement: number | null;
  topPerformers: Array<{
    volunteerId: string;
    fullName: string;
    totalVolunteeringHours: number;
  }>;
}
```

#### GET `/api/performance/volunteers/:id`

Returns single `VolunteerPerformance` for a specific volunteer.

---

### 9. Live Map (ADMIN only)

#### GET `/api/map/context`

Returns current snapshot:

```typescript
interface MapContext {
  activeVolunteers: Array<{
    volunteerId: string;
    fullName: string;
    volunteerGroup: VolunteerGroup | null;
    lat: number | null;
    lng: number | null;
    timestamp: string | null;
    sessionStatus: SessionStatus;    // 'active' or 'waiting_arrival'
    taskTitle: string | null;
    placeName: string | null;
  }>;
  summary: {
    total: number;
    byGroup: Record<string, number>;
    byStatus: {
      active: number;
      waitingArrival: number;
    };
  };
}
```

---

### 10. Rules Management (ADMIN only)

| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/rules` | `{ content: string }` |

Creates a new rules version (auto-increments `version`).

---

### 11. File Upload (any authenticated role)

| Method | Endpoint | Body |
|---|---|---|
| POST | `/api/uploads/presign` | `{ filename: string, contentType: string }` |

Returns a presigned S3 PUT URL. Client uploads binary directly to S3. Use the returned S3 key for `photoKey`, `profilePhoto`, `nationalIdPhotoKey` fields.

---

## WebSocket — Live Map (Socket.IO)

**Namespace:** `/location`
**Auth:** `{ auth: { token: '<access_token>' } }` in Socket.IO handshake
**Admin room:** Admins auto-join `admin-live-map`

### Events the dashboard RECEIVES:

| Event | Payload | Description |
|---|---|---|
| `admin:volunteer-location` | `{ volunteerId, fullName, lat, lng, timestamp, volunteerGroup }` | Real-time GPS update from a volunteer |
| `admin:volunteer-offline` | `{ volunteerId }` | Volunteer disconnected |
| `admin:session-activated` | `{ volunteerId, sessionId, taskTitle, lat, lng }` | Session transitioned to ACTIVE (GPS confirmed arrival) |

---

## Dashboard Pages / Features Needed

### 1. Login Page
- Phone input → OTP verification
- Only allow `admin` / `sub_admin` roles
- Token refresh logic (15min access, 7day refresh)

### 2. Dashboard Home
- Summary cards: total volunteers, pending applications, active sessions, today's tasks
- Group stats from `/api/performance/groups`

### 3. Volunteer Management
- Table with filters (group, application status) + pagination
- Application review: approve (assign group), reject (with reason), ban
- Volunteer detail view: profile info, performance stats, session history
- Change volunteer's group

### 4. Sub-Admin Management (ADMIN only, not SUB_ADMIN)
- List sub-admins
- Create sub-admin (phone + assigned group)
- Delete sub-admin

### 5. Centers Management
- CRUD table with map pin placement
- Filter by group

### 6. Places Management
- CRUD table with map pin placement
- Configure proximity threshold per place (50-5000m)
- Photo upload via presigned URL
- Filter by group

### 7. Tasks Management
- CRUD table
- Associate task with a place (dropdown)
- Set schedule (date, start time, end time)
- Set max volunteers
- View enrollments per task
- Task status display

### 8. Sessions Monitor
- Table with filters (volunteer, task, status, group) + pagination
- Admin can abandon a session (with reason)
- Session detail: timeline, GPS audit, photos

### 9. Live Map
- Real-time volunteer positions via WebSocket
- Initial load from `GET /api/map/context`
- Update markers on `admin:volunteer-location`
- Remove markers on `admin:volunteer-offline`
- Flash/highlight on `admin:session-activated`
- Summary panel (total active, by group, by status)
- Show places and centers as static markers

### 10. Performance / Leaderboard
- Sortable table (hours, tasks, places, consistency, achievement)
- Filter by group
- Individual volunteer drill-down
- Group comparison view

### 11. Rules Editor
- Text editor for rules content
- Publish creates new version (version number auto-increments)

---

## SUB_ADMIN Restrictions

SUB_ADMINs have the same UI but are **group-scoped**:
- They only see volunteers/sessions/tasks for their `assignedGroup`
- They cannot manage other sub-admins
- The backend enforces group isolation — the frontend should also hide/disable the group filter and sub-admin management sections

---

## Technical Notes

1. **All timestamps** are ISO 8601 strings
2. **Decimal fields** (lat/lng, hours): use `number` in TypeScript, display with appropriate precision
3. **Pagination** responses likely include `{ data: T[], total: number }` alongside the wrapper
4. **Arabic enum values** are sent as-is in request bodies (e.g., `volunteerGroup: 'الهرم'`)
5. **S3 photo display**: The backend returns S3 keys, not full URLs. You'll need to construct the full S3 URL or use a CloudFront distribution URL prefix
6. **Feed, Notifications, Chatbot** modules are Phase 4 (not yet built) — skip for now
