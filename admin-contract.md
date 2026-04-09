# Admin Dashboard API Contract

Base URL: `/api`

All admin endpoints require `Authorization: Bearer <accessToken>` header (except login).
All responses are wrapped in `{ statusCode, message, data }` by the `UnifiedResponseInterceptor`.

---

## Enums (used across all endpoints)

```
VolunteerGroup:    "الهرم" | "فيصل"
ApplicationStatus: "pending" | "approved" | "rejected" | "banned"
CampaignStatus:    "open" | "full" | "in_progress" | "completed" | "cancelled"
SessionStatus:     "waiting_arrival" | "active" | "completed" | "left_early" | "abandoned"
EducationalLevel:  "ثانوي" | "بكالوريوس" | "لا يوجد"
Governorate:       "القاهرة" | "الجيزة" | "الإسكندرية"
Area:              "الهرم" | "فيصل" | "الدقي" | "المهندسين" | "العجوزة"
```

---

## 1. Authentication

### `POST /admins/login`
**Auth:** None (public)
**Purpose:** Admin logs in with email + password, receives JWT tokens.

**Request:**
```json
{
  "email": "admin@edman.org",
  "password": "your_strong_password"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG...",
  "admin": {
    "id": "uuid",
    "email": "admin@edman.org",
    "name": "مدير النظام"
  }
}
```

**Errors:**
- `401` — البريد الإلكتروني أو كلمة المرور غير صحيحة

**Flow:** Store `accessToken` in memory/state, `refreshToken` in httpOnly cookie or secure storage. Send `Authorization: Bearer <accessToken>` on all subsequent requests. Access token expires in 15 minutes, refresh in 7 days.

---

### `POST /admins/register`
**Auth:** Admin token required
**Purpose:** An existing admin creates a new admin account.

**Request:**
```json
{
  "email": "new-admin@edman.org",
  "password": "min8chars",
  "name": "أحمد محمد"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "new-admin@edman.org",
  "name": "أحمد محمد"
}
```

**Errors:**
- `409` — البريد الإلكتروني مستخدم بالفعل

**Note:** The first admin is auto-seeded on server startup from `ADMIN_DEFAULT_EMAIL` and `ADMIN_DEFAULT_PASSWORD` in `.env`. Use that account to create additional admins.

---

## 2. Volunteer Management

### `GET /volunteers`
**Auth:** Admin
**Purpose:** List all approved volunteers (paginated).

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| group | VolunteerGroup | — | Filter by group |
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "fullName": "محمد أحمد",
      "nationalId": "12345678901234",
      "governorate": "القاهرة",
      "area": "الهرم",
      "educationalLevel": "بكالوريوس",
      "hasCar": false,
      "volunteerGroup": "الهرم",
      "applicationStatus": "approved",
      "appliedAt": "2026-04-01T10:00:00.000Z",
      "totalVolunteeringHours": 12.5,
      "user": { "id": "uuid", "phone": "+201234567890" }
    }
  ],
  "total": 42
}
```

---

### `GET /volunteers/applications`
**Auth:** Admin
**Purpose:** List volunteer applications (pending, approved, rejected, banned).

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | ApplicationStatus | — | Filter by status (e.g. "pending") |
| group | VolunteerGroup | — | Filter by group |
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |

**Response:** Same shape as `GET /volunteers`.

**Flow:** Use `status=pending` to show the admin's "pending applications" queue.

---

### `GET /volunteers/:id`
**Auth:** Admin
**Purpose:** Get a single volunteer's full profile.

**Response:** Single volunteer object (same shape as list item, with `user` relation included).

---

### `PATCH /volunteers/:id/approve`
**Auth:** Admin
**Purpose:** Approve a pending volunteer application and assign them to a group.

**Request:**
```json
{
  "volunteerGroup": "الهرم"
}
```

**Response:** Updated volunteer object.

**Side effects:**
1. Sets `applicationStatus` → `approved`, `volunteerGroup` → value from body
2. Sets the user's role to `volunteer`
3. Sends FCM push notification to the volunteer: "تمت الموافقة على طلبك"
4. Creates in-app notification record
5. Subscribes the volunteer's FCM token to the group topic (`group_الهرم`) and `all_volunteers`

**Errors:**
- `404` — المتطوع غير موجود
- `400` — لا يمكن الموافقة على هذا الطلب (not pending)

---

### `PATCH /volunteers/:id/reject`
**Auth:** Admin
**Purpose:** Reject a pending volunteer application.

**Request:**
```json
{
  "reason": "البيانات غير مكتملة"
}
```

**Response:** Updated volunteer object.

**Side effects:**
1. Sets `applicationStatus` → `rejected`, stores `rejectionReason`
2. Sends FCM push notification: "تم رفض طلبك"
3. Creates in-app notification record

**Errors:**
- `404` — المتطوع غير موجود
- `400` — لا يمكن رفض هذا الطلب (not pending)

---

### `PATCH /volunteers/:id/group`
**Auth:** Admin
**Purpose:** Change an approved volunteer's group assignment.

**Request:**
```json
{
  "volunteerGroup": "فيصل"
}
```

**Response:** Updated volunteer object.

**Side effects:** Re-subscribes the volunteer's FCM token to the new group topic.

**Errors:**
- `404` — المتطوع غير موجود
- `400` — لا يمكن تغيير المجموعة إلا للمتطوعين المعتمدين (not approved)

---

### `PATCH /volunteers/:id/ban`
**Auth:** Admin
**Purpose:** Ban a volunteer.

**Response:** Updated volunteer object.

**Side effects:**
1. Sets `applicationStatus` → `banned`
2. Sends FCM push notification: "تم حظر حسابك"
3. Creates in-app notification record

---

## 3. Centers (Treatment Centers)

### `GET /centers`
**Auth:** Admin
**Purpose:** List all centers, optionally filtered by group.

**Query params:** `group` (VolunteerGroup, optional)

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "مركز الهرم",
    "description": "...",
    "addressLink": "https://maps.google.com/...",
    "latitude": 30.0131,
    "longitude": 31.2089,
    "address": "شارع الهرم",
    "volunteerGroup": "الهرم"
  }
]
```

---

### `GET /centers/:id`
**Auth:** Admin or Volunteer
**Purpose:** Get a single center.

---

### `POST /centers`
**Auth:** Admin
**Purpose:** Create a new center. Latitude/longitude are auto-extracted from the Google Maps link.

**Request:**
```json
{
  "name": "مركز الهرم",
  "description": "مركز علاج الإدمان",
  "addressLink": "https://maps.google.com/?q=30.0131,31.2089",
  "volunteerGroup": "الهرم",
  "address": "شارع الهرم، الجيزة"
}
```

**Response:** Created center object (includes auto-extracted `latitude` and `longitude`).

---

### `PATCH /centers/:id`
**Auth:** Admin
**Purpose:** Update a center. If `addressLink` is changed, lat/lng are re-extracted.

**Request:** Partial of CreateCenterDto (all fields optional).

---

### `DELETE /centers/:id`
**Auth:** Admin

---

## 4. Places (Volunteering Locations)

### `GET /places`
**Auth:** Admin
**Purpose:** List all places, optionally filtered by group.

**Query params:** `group` (VolunteerGroup, optional)

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "ميدان الجيزة",
    "description": "...",
    "addressLink": "https://maps.google.com/...",
    "latitude": 30.0131,
    "longitude": 31.2089,
    "address": "...",
    "volunteerGroup": "الهرم",
    "placeType": "ميدان",
    "photoKey": "places/photo.jpg",
    "proximityThresholdMeters": 300,
    "openCampaignCount": 2
  }
]
```

---

### `GET /places/:id`
**Auth:** Admin or Volunteer

---

### `POST /places`
**Auth:** Admin
**Purpose:** Create a new volunteering place. Lat/lng auto-extracted from Google Maps link.

**Request:**
```json
{
  "name": "ميدان الجيزة",
  "description": "نقطة تجمع",
  "addressLink": "https://maps.google.com/?q=30.0131,31.2089",
  "volunteerGroup": "الهرم",
  "placeType": "ميدان",
  "photoKey": "places/photo.jpg",
  "address": "ميدان الجيزة",
  "proximityThresholdMeters": 300
}
```

**Note:** `photoKey` is the S3 key obtained from `POST /uploads/presign` (see section 10).

---

### `PATCH /places/:id`
**Auth:** Admin

### `DELETE /places/:id`
**Auth:** Admin

---

## 5. Campaigns (Volunteering Tasks)

### `GET /campaigns`
**Auth:** Admin
**Purpose:** List all campaigns with filters.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| status | CampaignStatus | — | Filter by status |
| group | VolunteerGroup | — | Filter by group |
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "حملة توعية",
      "description": "...",
      "place": { "id": "uuid", "name": "ميدان الجيزة", "latitude": 30.01, "longitude": 31.20 },
      "volunteerGroup": "الهرم",
      "scheduledDate": "2026-04-10",
      "startTime": "09:00",
      "endTime": "14:00",
      "maxVolunteers": 10,
      "status": "open",
      "createdAt": "2026-04-01T10:00:00.000Z"
    }
  ],
  "total": 15
}
```

---

### `GET /campaigns/:id`
**Auth:** Admin or Volunteer
**Purpose:** Get a single campaign with place and enrollments.

---

### `POST /campaigns`
**Auth:** Admin
**Purpose:** Create a new campaign.

**Request:**
```json
{
  "title": "حملة توعية بالهرم",
  "description": "حملة توعية ضد الإدمان",
  "placeId": "uuid-of-place",
  "scheduledDate": "2026-04-10",
  "startTime": "09:00",
  "endTime": "14:00",
  "maxVolunteers": 10
}
```

**Note:** The `placeId` determines the `volunteerGroup` (inherited from the place). The campaign's group is set to match the place's group.

---

### `PATCH /campaigns/:id`
**Auth:** Admin
**Request:** Partial of CreateCampaignDto (all fields optional).

### `DELETE /campaigns/:id`
**Auth:** Admin

---

## 6. Sessions (Volunteer Attendance)

### `GET /sessions`
**Auth:** Admin
**Purpose:** List all sessions across all volunteers.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| volunteerId | uuid | — | Filter by volunteer |
| campaignId | uuid | — | Filter by campaign |
| status | SessionStatus | — | Filter by status |
| group | VolunteerGroup | — | Filter by group |
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "status": "active",
      "startedAt": "2026-04-10T09:05:00.000Z",
      "completedAt": null,
      "campaign": { "id": "uuid", "title": "حملة توعية", "place": {...} },
      "volunteer": { "id": "uuid", "fullName": "محمد أحمد" }
    }
  ],
  "total": 100
}
```

---

### `POST /sessions/:id/abandon`
**Auth:** Admin
**Purpose:** Force-abandon a volunteer's session (e.g. if they left without reporting).

**Request:**
```json
{
  "reason": "لم يحضر المتطوع"
}
```

**Response:** Updated session object with `status: "abandoned"`.

---

## 7. Feed (Announcements)

### `GET /feed`
**Auth:** Admin
**Purpose:** List all announcements, optionally filtered by group.

**Query params:**
| Param | Type | Default |
|-------|------|---------|
| group | VolunteerGroup | — |

**Response:** Array of announcement objects.

---

### `POST /feed`
**Auth:** Admin
**Purpose:** Create a new announcement. Sends FCM push to the target group (or all volunteers if no group).

**Request:**
```json
{
  "title": "إعلان هام",
  "body": "محتوى الإعلان...",
  "targetGroup": "الهرم",
  "attachments": ["uploads/image.jpg"],
  "priority": "high"
}
```

- `targetGroup`: optional — if null, goes to all volunteers
- `attachments`: optional — array of S3 keys (from presigned upload)
- `priority`: optional — freeform string

**Response:** Created announcement object.

**Side effects:** Sends FCM push notification to topic `group_الهرم` (or `all_volunteers` if no targetGroup).

---

### `DELETE /feed/:id`
**Auth:** Admin

---

## 8. Rules

### `GET /rules`
**Auth:** Admin or Volunteer
**Purpose:** Get the latest rules document.

**Response:**
```json
{
  "id": "uuid",
  "content": "القواعد والشروط...",
  "version": 3,
  "updatedAt": "2026-04-01T10:00:00.000Z"
}
```

---

### `POST /rules`
**Auth:** Admin
**Purpose:** Create or update the rules document. Increments the version automatically.

**Request:**
```json
{
  "content": "القواعد والشروط المحدثة..."
}
```

**Response:** Updated rules object with new version number.

**Note:** Volunteers must confirm the latest rules version before enrolling in campaigns. Updating rules forces all volunteers to re-confirm.

---

## 9. Performance & Leaderboard

### `GET /performance/leaderboard`
**Auth:** Admin
**Purpose:** Ranked list of volunteers by performance metrics.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| sortBy | "hours" \| "campaigns" \| "places" \| "consistency" \| "achievement" | — | Sort metric |
| order | "asc" \| "desc" | — | Sort direction |
| group | VolunteerGroup | — | Filter by group |
| page | number | 1 | — |
| limit | number | 20 | max 100 |

---

### `GET /performance/groups`
**Auth:** Admin
**Purpose:** Aggregate performance stats per volunteer group.

---

### `GET /performance/volunteers/:id`
**Auth:** Admin
**Purpose:** Detailed performance for a specific volunteer.

---

## 10. Map (Live Tracking)

### `GET /map/context`
**Auth:** Admin
**Purpose:** Get all active session data for the admin live map view (currently online volunteers, their locations, active campaigns).

### WebSocket: `/location`
**Auth:** Admin token in `handshake.auth.token`
**Purpose:** Real-time volunteer GPS positions on the admin dashboard.

**Events received by admin:**
- `admin:volunteer-location` — `{ volunteerId, fullName, lat, lng, timestamp, volunteerGroup }`
- `admin:volunteer-offline` — `{ volunteerId }`
- `admin:session-activated` — `{ volunteerId, sessionId, campaignTitle, lat, lng }`

**Flow:** Connect to WebSocket with admin JWT → auto-joined to `admin-live-map` room → receive real-time location updates from all active volunteers.

---

## 11. File Uploads (S3 Presigned URLs)

### `POST /uploads/presign`
**Auth:** Any authenticated user (admin or volunteer)
**Purpose:** Get a presigned PUT URL to upload a file directly to S3.

**Request:**
```json
{
  "filename": "photo.jpg",
  "contentType": "image/jpeg"
}
```

**Response:**
```json
{
  "url": "https://edman.s3.eu-north-1.amazonaws.com/uploads/uuid-photo.jpg?X-Amz-...",
  "key": "uploads/uuid-photo.jpg"
}
```

**Flow:**
1. Call `POST /uploads/presign` to get the presigned URL and key
2. `PUT` the file binary directly to the returned `url` with the correct `Content-Type` header
3. Use the returned `key` in subsequent API calls (e.g. `photoKey` in places, `attachments` in announcements)

---

## Authentication Flow Summary

```
1. Admin opens dashboard → POST /admins/login { email, password }
2. Receives { accessToken, refreshToken, admin }
3. Stores accessToken in memory, refreshToken securely
4. All requests include: Authorization: Bearer <accessToken>
5. When accessToken expires (15m):
   - POST /auth/refresh-token with Authorization-Refresh: Bearer <refreshToken>
   - Receives new { accessToken, refreshToken }
6. Logout: POST /auth/logout with Authorization: Bearer <accessToken>
```

## Common Admin Workflows

### Reviewing Applications
```
1. GET /volunteers/applications?status=pending     → list pending apps
2. GET /volunteers/:id                             → view full profile
3. PATCH /volunteers/:id/approve { volunteerGroup } → approve + assign group
   OR
   PATCH /volunteers/:id/reject { reason }         → reject with reason
```

### Creating a Campaign
```
1. POST /places          → create a place (if needed)
2. POST /campaigns       → create campaign linked to placeId
3. GET /campaigns        → verify it appears in the list
```

### Publishing an Announcement
```
1. (optional) POST /uploads/presign → upload attachment to S3
2. POST /feed { title, body, targetGroup?, attachments? }
   → sends FCM push to group or all volunteers
```

### Monitoring Live Activity
```
1. Connect WebSocket to /location with admin JWT
2. Listen for admin:volunteer-location events
3. GET /map/context for initial state
4. GET /sessions?status=active for active session list
```
