# Database Tables — Dashboard Reference

## Enums

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

---

## Tables

### `users`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| phone | VARCHAR(20) | UNIQUE, INDEXED |
| role | ENUM(UserRole) | NULLABLE |
| isPhoneVerified | BOOLEAN | DEFAULT `false` |
| fcmToken | VARCHAR(255) | NULLABLE |
| createdAt | TIMESTAMP | AUTO |
| updatedAt | TIMESTAMP | AUTO |

---

### `volunteers`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → `users.id`, UNIQUE (OneToOne) |
| fullName | VARCHAR(200) | NOT NULL |
| nationalId | VARCHAR(14) | UNIQUE, INDEXED |
| nationalIdPhotoKey | VARCHAR(500) | NULLABLE |
| governorate | ENUM(Governorate) | NOT NULL |
| area | ENUM(Area) | NOT NULL |
| educationalLevel | ENUM(EducationalLevel) | NOT NULL |
| hasCar | BOOLEAN | DEFAULT `false` |
| profilePhoto | VARCHAR(500) | NULLABLE |
| volunteerGroup | ENUM(VolunteerGroup) | NULLABLE |
| applicationStatus | ENUM(ApplicationStatus) | DEFAULT `pending` |
| rejectionReason | TEXT | NULLABLE |
| appliedAt | TIMESTAMP | AUTO |
| reviewedAt | TIMESTAMP | NULLABLE |
| reviewedById | UUID | FK → `users.id`, NULLABLE |
| rulesConfirmedVersion | INT | DEFAULT `0` |
| totalVolunteeringHours | DECIMAL(10,2) | DEFAULT `0` |

---

### `admins`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → `users.id`, UNIQUE (OneToOne) |

---

### `sub_admins`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| userId | UUID | FK → `users.id`, UNIQUE (OneToOne) |
| assignedGroup | ENUM(VolunteerGroup) | NOT NULL |

---

### `centers`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(200) | UNIQUE |
| description | TEXT | NULLABLE |
| latitude | DECIMAL(10,7) | NOT NULL |
| longitude | DECIMAL(10,7) | NOT NULL |
| volunteerGroup | ENUM(VolunteerGroup) | NOT NULL |
| address | VARCHAR(500) | NULLABLE |
| createdAt | TIMESTAMP | AUTO |

---

### `places`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| name | VARCHAR(200) | UNIQUE |
| description | TEXT | NULLABLE |
| latitude | DECIMAL(10,7) | NOT NULL |
| longitude | DECIMAL(10,7) | NOT NULL |
| volunteerGroup | ENUM(VolunteerGroup) | NOT NULL |
| placeType | VARCHAR(100) | NULLABLE |
| photoKey | VARCHAR(500) | NULLABLE |
| proximityThresholdMeters | INT | DEFAULT `300` |
| address | VARCHAR(500) | NULLABLE |
| createdAt | TIMESTAMP | AUTO |

---

### `rules`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| content | TEXT | NOT NULL |
| version | INT | NOT NULL |
| updatedAt | TIMESTAMP | AUTO |
| updatedById | UUID | FK → `users.id` |

---

### `tasks`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| title | VARCHAR(300) | NOT NULL |
| description | TEXT | NULLABLE |
| placeId | UUID | FK → `places.id` |
| volunteerGroup | ENUM(VolunteerGroup) | NOT NULL |
| scheduledDate | DATE | NOT NULL |
| startTime | TIME | NOT NULL |
| endTime | TIME | NOT NULL |
| maxVolunteers | INT | DEFAULT `10` |
| status | ENUM(TaskStatus) | DEFAULT `open` |
| createdById | UUID | FK → `users.id` |
| createdAt | TIMESTAMP | AUTO |
| updatedAt | TIMESTAMP | AUTO |

---

### `task_enrollments`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| volunteerId | UUID | FK → `volunteers.id` |
| taskId | UUID | FK → `tasks.id` |
| enrolledAt | TIMESTAMP | AUTO |
| leaveReason | TEXT | NULLABLE |
| leftAt | TIMESTAMP | NULLABLE |

---

### `sessions`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| volunteerId | UUID | FK → `volunteers.id` |
| taskId | UUID | FK → `tasks.id` |
| status | ENUM(SessionStatus) | DEFAULT `waiting_arrival` |
| startedAt | TIMESTAMP | NULLABLE |
| endedAt | TIMESTAMP | NULLABLE |
| durationSeconds | INT | NULLABLE |
| endReason | TEXT | NULLABLE |
| feedback | TEXT | NULLABLE |
| feedbackAt | TIMESTAMP | NULLABLE |
| lastLatitude | DECIMAL(10,7) | NULLABLE |
| lastLongitude | DECIMAL(10,7) | NULLABLE |
| gpsCheckCount | INT | DEFAULT `0` |
| createdAt | TIMESTAMP | AUTO |

---

### `gps_audit_logs`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| sessionId | UUID | FK → `sessions.id` |
| volunteerId | UUID | FK → `volunteers.id` |
| latitude | DECIMAL(10,7) | NOT NULL |
| longitude | DECIMAL(10,7) | NOT NULL |
| isWithinRange | BOOLEAN | NOT NULL |
| isFirstArrival | BOOLEAN | DEFAULT `false` |
| createdAt | TIMESTAMP | AUTO |

---

### `session_photos`

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| sessionId | UUID | FK → `sessions.id` |
| photoKey | VARCHAR(500) | NOT NULL |
| takenAt | TIMESTAMP | AUTO |
| sequenceNo | INT | NOT NULL |

---

## Relationships Diagram

```
users ─────────┬──── 1:1 ──── admins
               ├──── 1:1 ──── sub_admins
               ├──── 1:1 ──── volunteers
               ├──── 1:N ──── rules (updatedBy)
               └──── 1:N ──── tasks (createdBy)

volunteers ────┬──── 1:N ──── task_enrollments
               ├──── 1:N ──── sessions
               └──── 1:N ──── gps_audit_logs

places ────────┴──── 1:N ──── tasks

tasks ─────────┬──── 1:N ──── task_enrollments
               └──── 1:N ──── sessions

sessions ──────┬──── 1:N ──── gps_audit_logs
               └──── 1:N ──── session_photos
```
