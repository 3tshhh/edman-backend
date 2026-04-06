# Phase 2 — Core Domain

> **Status:** COMPLETE
> **Prerequisite:** Phase 1 must be complete and building successfully.

---

## Scope

```
Step 6:   src/modules/volunteers/    — volunteer application, profile, admin management
Step 7:   src/modules/admins/        — admin + sub-admin entity, seeding
Step 8:   src/modules/centers/       — anti-drug fund centers CRUD
Step 8.5: src/modules/rules/         — rules & policies, version tracking, volunteer confirmation
Step 9:   src/modules/places/        — volunteering places CRUD
Step 10:  src/modules/tasks/         — task CRUD, enrollment with session creation
Step 11:  src/modules/uploads/       — S3 presigned URL generation
```

---

## Phase 1 Deferred Items to Resolve

Before building new modules, complete these Phase 1 TODOs:

### D1 — Complete GroupsGuard

`src/common/guards/groups.guard.ts` is currently a pass-through skeleton. It needs to:

1. Inject `VolunteersService` (or the Volunteer repository directly) to look up the volunteer record
2. Extract the user from `request.loggedInUser.user`
3. Load the Volunteer entity by `user.id`
4. If no volunteer record exists OR `volunteer.volunteerGroup` is null → throw `ForbiddenException('غير مصرح لك بالوصول')`
5. Attach `volunteer` to the request object (e.g. `request.volunteer = volunteer`) so controllers/services downstream can read it without re-querying
6. Return `true` to allow access

**Important:** GroupsGuard does NOT check if the volunteer's group matches specific groups — it just ensures the volunteer HAS a group. The actual group-scoped filtering happens in the service layer (e.g. `WHERE volunteerGroup = :group`).

### D2 — Wire applicationStatus into LoginOtpStrategy

`src/modules/auth/strategies/login-otp.strategy.ts` currently returns `applicationStatus: null`. Update it to:

1. Inject `VolunteersService` (or the Volunteer repository)
2. After finding the user by phone, look up the Volunteer record by `volunteer.user.id === user.id`
3. Return `volunteer?.applicationStatus ?? null` in the response
4. This requires adding VolunteersModule to AuthModule's imports (or making the repository available globally)

---

## Step 6 — Volunteers Module

### 6.1 Entity: `src/modules/volunteers/volunteer.entity.ts`

Create the Volunteer entity with these columns:

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `user` | OneToOne → User | JoinColumn, cascade: ['insert', 'update'], eager: true |
| `fullName` | varchar(200) | required |
| `nationalId` | varchar(14) | unique, indexed |
| `nationalIdPhotoKey` | varchar(500) | required — S3 key |
| `governorate` | enum Governorate | required |
| `area` | enum Area | required |
| `educationalLevel` | enum EducationalLevel | required |
| `hasCar` | boolean | default false |
| `profilePhoto` | varchar(500) | nullable — S3 key |
| `volunteerGroup` | enum VolunteerGroup | nullable — set by admin on approval |
| `applicationStatus` | enum ApplicationStatus | default PENDING |
| `rejectionReason` | text | nullable |
| `appliedAt` | timestamp | set on creation (CreateDateColumn or manual) |
| `reviewedAt` | timestamp | nullable — set when admin approves/rejects |
| `reviewedBy` | ManyToOne → User | nullable — the admin who reviewed |
| `rulesConfirmedVersion` | int | default 0 |
| `totalVolunteeringHours` | decimal(10,2) | default 0 |

**Relations note:** The OneToOne with User means one User can have at most one Volunteer profile. Use `@JoinColumn()` on the Volunteer side. Set `eager: true` so that querying a Volunteer always loads the User.

### 6.2 DTOs: `src/modules/volunteers/dto/`

Create separate DTO files:

**`apply-volunteer.dto.ts`**
- `fullName`: string, `@IsNotEmpty()`, `@IsString()`, `@MaxLength(200)`
- `nationalId`: string, `@IsNotEmpty()`, `@IsString()`, `@Length(14, 14)` — exactly 14 digits
- `nationalIdPhotoKey`: string, `@IsNotEmpty()`, `@IsString()` — S3 key from presign
- `governorate`: Governorate enum, `@IsEnum(Governorate)`
- `area`: Area enum, `@IsEnum(Area)`
- `educationalLevel`: EducationalLevel enum, `@IsEnum(EducationalLevel)`
- `hasCar`: boolean, `@IsBoolean()`, `@IsOptional()` — defaults to false

**`approve-volunteer.dto.ts`**
- `volunteerGroup`: VolunteerGroup enum, `@IsEnum(VolunteerGroup)`, `@IsNotEmpty()`

**`reject-volunteer.dto.ts`**
- `reason`: string, `@IsNotEmpty()`, `@IsString()`

**`change-group.dto.ts`**
- `volunteerGroup`: VolunteerGroup enum, `@IsEnum(VolunteerGroup)`, `@IsNotEmpty()`

**`update-fcm-token.dto.ts`**
- `fcmToken`: string, `@IsNotEmpty()`, `@IsString()`

**`query-volunteers.dto.ts`** (for admin list endpoints)
- `group`: VolunteerGroup, `@IsOptional()`, `@IsEnum(VolunteerGroup)`
- `status`: ApplicationStatus, `@IsOptional()`, `@IsEnum(ApplicationStatus)`
- `page`: number, `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, default 1
- `limit`: number, `@IsOptional()`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, `@Max(100)`, default 20

### 6.3 Service: `src/modules/volunteers/volunteers.service.ts`

Implement the following methods:

**`apply(userId: string, dto: ApplyVolunteerDto): Promise<Volunteer>`**
1. Check if a Volunteer record already exists for this user → throw `ConflictException('لقد قمت بتقديم طلب بالفعل')` if so
2. Check if `nationalId` is already used by another volunteer → throw `ConflictException('رقم الهوية مستخدم بالفعل')`
3. Create Volunteer record with `applicationStatus = PENDING`, link to User via `user: { id: userId }`
4. Return the saved volunteer

**`getMyProfile(userId: string): Promise<object>`**
1. Load volunteer by user relation (with user eager loaded)
2. If not found → throw `NotFoundException('لم يتم العثور على ملف المتطوع')`
3. Compute stats:
   - `totalVolunteeringHours`: from `volunteer.totalVolunteeringHours`
   - `totalCompletedTasks`: COUNT of sessions with status COMPLETED for this volunteer (query sessions table, or use enrollment count — sessions table is Phase 3, so for now return `volunteer.totalVolunteeringHours` and defer computed stats)
   - **Note:** Full stats computation requires Session entity (Phase 3). For now, return the stored `totalVolunteeringHours` and placeholder 0 for task/place counts. Add a TODO comment.
4. Return volunteer with stats

**`getMyHistory(userId: string, page, limit): Promise<object>`**
- This endpoint requires Session and TaskEnrollment entities. Create the method signature with a TODO comment — actual implementation deferred to Phase 3 when sessions exist. For now, return an empty result structure: `{ tasks: [], completedTasks: [], visitedPlaces: [], totalCompletedTasks: 0, totalVisitedPlaces: 0, totalVolunteeringHours: 0 }`

**`updateFcmToken(userId: string, fcmToken: string): Promise<void>`**
1. Call `UserService.updateFcmToken(userId, fcmToken)`

**`findAll(query: QueryVolunteersDto): Promise<{ data: Volunteer[], total: number }>`**
1. Build a TypeORM query on Volunteer with pagination
2. If `query.group` is set → filter by `volunteerGroup = :group`
3. Return paginated results with total count

**`findApplications(query: QueryVolunteersDto): Promise<{ data: Volunteer[], total: number }>`**
1. Same as findAll but specifically for applications list
2. Filter by `applicationStatus` if provided in query
3. Filter by `volunteerGroup` if provided
4. Order by `appliedAt DESC`

**`approve(volunteerId: string, dto: ApproveVolunteerDto, adminUserId: string): Promise<Volunteer>`**
1. Load volunteer by ID — throw `NotFoundException` if not found
2. Check current `applicationStatus` is `PENDING` → throw `BadRequestException('لا يمكن الموافقة على هذا الطلب')` if not
3. Set `applicationStatus = APPROVED`
4. Set `volunteerGroup = dto.volunteerGroup`
5. Set `reviewedAt = now`, `reviewedBy = adminUser`
6. Call `UserService.setRole(volunteer.user.id, UserRole.VOLUNTEER)` to assign the VOLUNTEER role
7. Save and return
8. **TODO (Phase 4):** After approval, call `NotificationsService.sendApplicationResult(volunteer.user.fcmToken, 'approved')` to send FCM push notification

**`reject(volunteerId: string, dto: RejectVolunteerDto, adminUserId: string): Promise<Volunteer>`**
1. Load volunteer — throw `NotFoundException` if not found
2. Check `applicationStatus` is `PENDING`
3. Set `applicationStatus = REJECTED`, `rejectionReason = dto.reason`
4. Set `reviewedAt = now`, `reviewedBy = adminUser`
5. Save and return
6. **TODO (Phase 4):** Send FCM notification for rejection

**`changeGroup(volunteerId: string, dto: ChangeGroupDto): Promise<Volunteer>`**
1. Load volunteer — throw `NotFoundException` if not found
2. Check volunteer is `APPROVED` status → throw `BadRequestException` if not
3. Set `volunteerGroup = dto.volunteerGroup`
4. Save and return

**`ban(volunteerId: string): Promise<Volunteer>`**
1. Load volunteer — throw `NotFoundException` if not found
2. Set `applicationStatus = BANNED`
3. Save and return

**`updateHours(volunteerId: string): Promise<void>`**
- Recalculate `totalVolunteeringHours` by summing `durationSeconds` from all COMPLETED sessions for this volunteer, divide by 3600
- **Note:** Requires Session entity. Create method with TODO — will be implemented in Phase 3. For now, accept hours as parameter: `updateHours(volunteerId: string, hours: number)`

**`confirmRules(volunteerId: string, currentVersion: number): Promise<void>`**
1. Load volunteer — throw `NotFoundException` if not found
2. Set `volunteer.rulesConfirmedVersion = currentVersion`
3. Save

**`findByUserId(userId: string): Promise<Volunteer | null>`**
- Helper: find volunteer where `user.id = userId`, used by GroupsGuard and LoginOtpStrategy

### 6.4 Controller: `src/modules/volunteers/volunteers.controller.ts`

| Method | Route | Guard | Body/Query | Service Call |
|---|---|---|---|---|
| `POST` | `/volunteers/apply` | `@Auth()` | `ApplyVolunteerDto` | `apply(user.id, dto)` |
| `GET` | `/volunteers/me` | `@Auth()` | — | `getMyProfile(user.id)` |
| `GET` | `/volunteers/me/history` | `@Auth(VOLUNTEER)` | `page?, limit?` | `getMyHistory(user.id, page, limit)` |
| `PATCH` | `/volunteers/me/fcm-token` | `@Auth(VOLUNTEER)` | `UpdateFcmTokenDto` | `updateFcmToken(user.id, dto.fcmToken)` |
| `GET` | `/volunteers` | `@Auth(ADMIN)` | `QueryVolunteersDto` | `findAll(query)` |
| `GET` | `/volunteers/applications` | `@Auth(ADMIN)` | `QueryVolunteersDto` | `findApplications(query)` |
| `PATCH` | `/volunteers/:id/approve` | `@Auth(ADMIN)` | `ApproveVolunteerDto` | `approve(id, dto, user.id)` |
| `PATCH` | `/volunteers/:id/reject` | `@Auth(ADMIN)` | `RejectVolunteerDto` | `reject(id, dto, user.id)` |
| `PATCH` | `/volunteers/:id/group` | `@Auth(ADMIN)` | `ChangeGroupDto` | `changeGroup(id, dto)` |
| `PATCH` | `/volunteers/:id/ban` | `@Auth(ADMIN)` | — | `ban(id)` |

**Notes:**
- Use `@CurrentUser()` decorator to get the User entity from the request
- Use `@Auth()` (no roles) for endpoints any authenticated user can access
- Use `@Auth(UserRole.ADMIN)` for admin-only endpoints
- Use `@Auth(UserRole.VOLUNTEER)` for volunteer-only endpoints
- Add `@ApiTags('volunteers')` for Swagger grouping

### 6.5 Module: `src/modules/volunteers/volunteers.module.ts`

- Import `TypeOrmModule.forFeature([Volunteer])`
- Import `UserModule` (for UserService access in approve flow)
- Provide `VolunteersService`
- Export `VolunteersService` (needed by GroupsGuard, LoginOtpStrategy, RulesModule, and later TasksModule)
- Controller: `VolunteersController`

---

## Step 7 — Admins Module

### 7.1 Entity: `src/modules/admins/entities/admin.entity.ts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `user` | OneToOne → User | JoinColumn, eager: true |

This is a marker entity — it exists to identify admin users and allow future admin-specific fields.

### 7.2 Entity: `src/modules/admins/entities/sub-admin.entity.ts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `user` | OneToOne → User | JoinColumn, eager: true |
| `assignedGroup` | enum VolunteerGroup | required |

### 7.3 Service: `src/modules/admins/admins.service.ts`

**`findAdminByUserId(userId: string): Promise<Admin | null>`**
- Simple lookup

**`findSubAdminByUserId(userId: string): Promise<SubAdmin | null>`**
- Simple lookup — used by FeedService (Phase 4) to enforce group isolation

**`seedAdmin(phone: string): Promise<void>`**
- Check if user with this phone exists, create if not
- Set `user.role = ADMIN`, `user.isPhoneVerified = true`
- Create Admin record
- This is for dev/setup — call from a CLI command or onModuleInit

**`createSubAdmin(phone: string, assignedGroup: VolunteerGroup): Promise<SubAdmin>`**
- Find or create user by phone
- Set `user.role = SUB_ADMIN`
- Create SubAdmin record with `assignedGroup`
- Used by admin to create sub-admins

### 7.4 Controller: `src/modules/admins/admins.controller.ts`

| Method | Route | Guard | Body | Service Call |
|---|---|---|---|---|
| `POST` | `/admins/sub-admins` | `@Auth(ADMIN)` | `{ phone, assignedGroup }` | `createSubAdmin(phone, group)` |
| `GET` | `/admins/sub-admins` | `@Auth(ADMIN)` | — | list all sub-admins |
| `DELETE` | `/admins/sub-admins/:id` | `@Auth(ADMIN)` | — | remove sub-admin |

**Note:** These endpoints are not explicitly listed in `backend_context.md` but are implied by the SUB_ADMIN role. Keep it minimal — only build what's needed for core functionality.

### 7.5 Module: `src/modules/admins/admins.module.ts`

- Import `TypeOrmModule.forFeature([Admin, SubAdmin])`
- Import `UserModule`
- Provide and export `AdminsService`

### 7.6 Admin Seeding

Add a method or use NestJS `onModuleInit` to seed the first admin user. During development:
- Read admin phone from env var `ADMIN_PHONE` (add to `.env`)
- On app startup, if no admin exists, create one
- This allows the admin to log in via the normal OTP flow and have `role = ADMIN`

---

## Step 8 — Centers Module

### 8.1 Entity: `src/modules/centers/center.entity.ts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `name` | varchar(200) | unique |
| `description` | text | nullable |
| `latitude` | decimal(10,7) | required |
| `longitude` | decimal(10,7) | required |
| `volunteerGroup` | enum VolunteerGroup | required |
| `address` | varchar(500) | nullable |
| `createdAt` | timestamp | CreateDateColumn |

### 8.2 DTOs: `src/modules/centers/dto/`

**`create-center.dto.ts`**
- `name`: string, `@IsNotEmpty()`, `@IsString()`, `@MaxLength(200)`
- `description`: string, `@IsOptional()`, `@IsString()`
- `latitude`: number, `@IsNumber()`, `@IsNotEmpty()`
- `longitude`: number, `@IsNumber()`, `@IsNotEmpty()`
- `volunteerGroup`: VolunteerGroup, `@IsEnum(VolunteerGroup)`, `@IsNotEmpty()`
- `address`: string, `@IsOptional()`, `@IsString()`, `@MaxLength(500)`

**`update-center.dto.ts`**
- Use `PartialType(CreateCenterDto)` from `@nestjs/swagger`

### 8.3 Service: `src/modules/centers/centers.service.ts`

**`findByGroup(volunteerGroup: VolunteerGroup): Promise<Center[]>`**
- Return all centers where `volunteerGroup` matches
- Used by `GET /centers` with GroupsGuard (volunteer sees only their group's centers)

**`findById(id: string): Promise<Center>`**
- Return center or throw `NotFoundException`

**`create(dto: CreateCenterDto): Promise<Center>`**
- Check name uniqueness → throw `ConflictException('يوجد مركز بنفس الاسم')` if duplicate
- Create and save

**`update(id: string, dto: UpdateCenterDto): Promise<Center>`**
- Load center, apply changes, save
- If name is being changed, check uniqueness

**`remove(id: string): Promise<void>`**
- Load center, delete

### 8.4 Controller: `src/modules/centers/centers.controller.ts`

| Method | Route | Guard | Body/Query | Notes |
|---|---|---|---|---|
| `GET` | `/centers` | `@AuthGroup()` | — | Load volunteer from request, filter by `volunteer.volunteerGroup` |
| `GET` | `/centers/:id` | `@Auth(VOLUNTEER)` | — | Single center lookup |
| `POST` | `/centers` | `@Auth(ADMIN)` | `CreateCenterDto` | Admin creates center |
| `PATCH` | `/centers/:id` | `@Auth(ADMIN)` | `UpdateCenterDto` | Admin updates center |
| `DELETE` | `/centers/:id` | `@Auth(ADMIN)` | — | Admin deletes center |

**Important for `GET /centers`:** The `@AuthGroup()` decorator applies GroupsGuard which loads the volunteer and attaches it to the request. The controller should read `request.volunteer.volunteerGroup` and pass it to the service's `findByGroup()`. You can create a `@CurrentVolunteer()` param decorator that reads `req.volunteer` (set by GroupsGuard).

### 8.5 Module: `src/modules/centers/centers.module.ts`

- Import `TypeOrmModule.forFeature([Center])`
- Import `VolunteersModule` (GroupsGuard needs VolunteersService to load volunteer)
- Provide `CentersService`
- Controller: `CentersController`

---

## Step 8.5 — Rules Module

### 8.5.1 Entity: `src/modules/rules/rules.entity.ts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `content` | text | required — full Arabic rules text |
| `version` | int | required — incremented on every update |
| `updatedAt` | timestamp | UpdateDateColumn |
| `updatedBy` | ManyToOne → User | required — the admin who last updated |

**Important:** This is a single-document pattern. There is only ever one Rules record in the database. If it doesn't exist yet, the first `POST /rules` creates it. Subsequent calls update the existing record and increment version.

### 8.5.2 DTOs: `src/modules/rules/dto/`

**`create-rules.dto.ts`**
- `content`: string, `@IsNotEmpty()`, `@IsString()`

### 8.5.3 Service: `src/modules/rules/rules.service.ts`

**`getLatest(): Promise<Rules | null>`**
- Return the single rules record (use `findOne` with order by version DESC, or just load the only record)
- Return null if no record exists yet

**`createOrUpdate(adminUserId: string, content: string): Promise<Rules>`**
1. Load existing rules record
2. If exists: set `content`, increment `version` by 1, set `updatedBy` to admin user
3. If not: create new record with `version = 1`, `content`, `updatedBy`
4. Save and return

**`confirmRules(userId: string): Promise<{ rulesConfirmedVersion: number }>`**
1. Load latest rules → throw `NotFoundException('لا توجد قوانين حالياً')` if null
2. Load volunteer by user ID (via VolunteersService)
3. Call `VolunteersService.confirmRules(volunteer.id, rules.version)`
4. Return `{ rulesConfirmedVersion: rules.version }`

### 8.5.4 Controller: `src/modules/rules/rules.controller.ts`

| Method | Route | Guard | Body | Service Call |
|---|---|---|---|---|
| `GET` | `/rules` | `@Auth(VOLUNTEER)` | — | `getLatest()` |
| `POST` | `/rules/confirm` | `@Auth(VOLUNTEER)` | — | `confirmRules(user.id)` |
| `POST` | `/rules` | `@Auth(ADMIN)` | `CreateRulesDto` | `createOrUpdate(user.id, dto.content)` |

### 8.5.5 Module: `src/modules/rules/rules.module.ts`

- Import `TypeOrmModule.forFeature([Rules])`
- Import `VolunteersModule` (for confirmRules)
- Import `UserModule` (for updatedBy relation)
- Provide `RulesService`
- Export `RulesService` (needed by TasksModule for enrollment rules check)

---

## Step 9 — Places Module

### 9.1 Entity: `src/modules/places/place.entity.ts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `name` | varchar(200) | unique |
| `description` | text | nullable |
| `latitude` | decimal(10,7) | required |
| `longitude` | decimal(10,7) | required |
| `volunteerGroup` | enum VolunteerGroup | required |
| `placeType` | varchar(100) | nullable — e.g. "مدرسة", "نادي" |
| `photoKey` | varchar(500) | nullable — S3 key for thumbnail |
| `proximityThresholdMeters` | int | default 300 — **per-place, admin-configurable** |
| `address` | varchar(500) | nullable |
| `createdAt` | timestamp | CreateDateColumn |

**Critical:** `proximityThresholdMeters` is the distance threshold used to confirm volunteer arrival. It is set per-place by the admin. The env var `GPS_PROXIMITY_THRESHOLD_DEFAULT_METERS` is only used as a fallback default value for the column.

### 9.2 DTOs: `src/modules/places/dto/`

**`create-place.dto.ts`**
- `name`: string, `@IsNotEmpty()`, `@IsString()`, `@MaxLength(200)`
- `description`: string, `@IsOptional()`, `@IsString()`
- `latitude`: number, `@IsNumber()`, `@IsNotEmpty()`
- `longitude`: number, `@IsNumber()`, `@IsNotEmpty()`
- `volunteerGroup`: VolunteerGroup, `@IsEnum(VolunteerGroup)`, `@IsNotEmpty()`
- `placeType`: string, `@IsOptional()`, `@IsString()`, `@MaxLength(100)`
- `photoKey`: string, `@IsOptional()`, `@IsString()`
- `address`: string, `@IsOptional()`, `@IsString()`, `@MaxLength(500)`
- `proximityThresholdMeters`: number, `@IsOptional()`, `@IsInt()`, `@Min(50)`, `@Max(5000)` — sensible range

**`update-place.dto.ts`**
- Use `PartialType(CreatePlaceDto)`

### 9.3 Service: `src/modules/places/places.service.ts`

**`findByGroup(volunteerGroup: VolunteerGroup): Promise<object[]>`**
1. Load all places where `volunteerGroup` matches
2. For each place, count open tasks (tasks with `status = OPEN` and `place.id = place.id`)
3. Return places with `openTaskCount` attached
4. **Note:** Task entity doesn't exist until Step 10. Two approaches:
   - Option A: Build Places first without the count, add it after Tasks are built
   - Option B: Build Tasks first, then come back
   - **Recommended:** Build Places service without the open task count first. After Tasks module is built, add a method or modify the query to include the count. Leave a TODO comment.

**`findById(id: string): Promise<Place>`**
- Return place or throw `NotFoundException`

**`findByIdWithTasks(id: string): Promise<object>`**
- Load place with its current open tasks
- **TODO:** Requires Task entity — defer the tasks part to after Step 10

**`create(dto: CreatePlaceDto): Promise<Place>`**
- Check name uniqueness → throw `ConflictException('يوجد مكان بنفس الاسم')`
- Create and save

**`update(id: string, dto: UpdatePlaceDto): Promise<Place>`**
- Load place, apply changes, save
- Check name uniqueness if name is being changed

**`remove(id: string): Promise<void>`**
- Load place, check no active tasks exist for this place (once tasks exist), delete
- **TODO:** Add task check after Step 10

### 9.4 Controller: `src/modules/places/places.controller.ts`

| Method | Route | Guard | Body/Query | Notes |
|---|---|---|---|---|
| `GET` | `/places/mine` | `@AuthGroup()` | — | Filter by volunteer's group |
| `GET` | `/places/:id` | `@Auth(VOLUNTEER)` | — | Single place with open tasks |
| `POST` | `/places` | `@Auth(ADMIN)` | `CreatePlaceDto` | |
| `PATCH` | `/places/:id` | `@Auth(ADMIN)` | `UpdatePlaceDto` | |
| `DELETE` | `/places/:id` | `@Auth(ADMIN)` | — | |

### 9.5 Module: `src/modules/places/places.module.ts`

- Import `TypeOrmModule.forFeature([Place])`
- Import `VolunteersModule` (for GroupsGuard)
- Provide `PlacesService`
- Export `PlacesService` (needed by TasksModule)

---

## Step 10 — Tasks Module

### 10.1 Entity: `src/modules/tasks/entities/task.entity.ts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `title` | varchar(300) | required |
| `description` | text | nullable |
| `place` | ManyToOne → Place | required, eager: true |
| `volunteerGroup` | enum VolunteerGroup | required — mirrors `place.volunteerGroup` |
| `scheduledDate` | date | required |
| `startTime` | time | required |
| `endTime` | time | required |
| `maxVolunteers` | int | default 10 |
| `status` | enum TaskStatus | default OPEN |
| `createdBy` | ManyToOne → User | required |
| `createdAt` | timestamp | CreateDateColumn |
| `updatedAt` | timestamp | UpdateDateColumn |

**Relations:**
- OneToMany → TaskEnrollment (mapped by `enrollment.task`)
- ManyToOne → Place (eager load so every task query includes the place)

### 10.2 Entity: `src/modules/tasks/entities/task-enrollment.entity.ts`

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `volunteer` | ManyToOne → Volunteer | required |
| `task` | ManyToOne → Task | required |
| `enrolledAt` | timestamp | CreateDateColumn |
| `leaveReason` | text | nullable — set on early leave |
| `leftAt` | timestamp | nullable — set on early leave |

### 10.3 DTOs: `src/modules/tasks/dto/`

**`create-task.dto.ts`**
- `title`: string, `@IsNotEmpty()`, `@IsString()`, `@MaxLength(300)`
- `description`: string, `@IsOptional()`, `@IsString()`
- `placeId`: string (uuid), `@IsNotEmpty()`, `@IsUUID()`
- `scheduledDate`: string (date format), `@IsNotEmpty()`, `@IsDateString()`
- `startTime`: string (HH:mm format), `@IsNotEmpty()`, `@IsString()`, validate with regex `@Matches(/^([01]\d|2[0-3]):([0-5]\d)$/)`
- `endTime`: string (HH:mm format), same validation as startTime
- `maxVolunteers`: number, `@IsOptional()`, `@IsInt()`, `@Min(1)`, default 10

**`update-task.dto.ts`**
- Use `PartialType(CreateTaskDto)`

**`query-tasks.dto.ts`** (for admin list)
- `status`: TaskStatus, `@IsOptional()`, `@IsEnum(TaskStatus)`
- `group`: VolunteerGroup, `@IsOptional()`, `@IsEnum(VolunteerGroup)`
- `page`, `limit` — same pattern as volunteers

### 10.4 Service: `src/modules/tasks/tasks.service.ts`

**`findMine(volunteerGroup: VolunteerGroup): Promise<Task[]>`**
1. Find all tasks where `volunteerGroup` matches
2. Include place relation (eager)
3. Order by `scheduledDate ASC, startTime ASC`
4. Client filters by date — return all matching tasks

**`findById(id: string): Promise<Task>`**
- Load task with place relation (includes `place.proximityThresholdMeters`)
- Throw `NotFoundException` if not found

**`enroll(taskId: string, userId: string): Promise<{ enrollmentId: string, sessionId: string }>`**
This is the most complex method in Phase 2. It must:

1. **Rules check:** Load latest Rules record via `RulesService.getLatest()`
2. Load volunteer by user ID via `VolunteersService.findByUserId(userId)`
3. If `rules` exists AND `volunteer.rulesConfirmedVersion < rules.version` → throw `ForbiddenException('يجب قراءة القوانين وتأكيدها أولاً')`
4. Load task → verify status is `OPEN` → throw `BadRequestException('هذه المهمة غير متاحة للتسجيل')` if not
5. Check volunteer not already enrolled in this task → throw `ConflictException('أنت مسجل بالفعل في هذه المهمة')`
6. Check volunteer has no other active session (ACTIVE or WAITING_ARRIVAL) → throw `ConflictException('لديك جلسة نشطة بالفعل')` — **one active session per volunteer rule**
7. **Use a database transaction** to atomically:
   a. Create `TaskEnrollment` record
   b. Create `Session` record with `status = WAITING_ARRIVAL`, linked to task and volunteer
   c. Count enrollments for this task — if `count >= task.maxVolunteers`, set `task.status = FULL`
8. Return `{ enrollmentId, sessionId }`

**Note on Session entity:** The Session entity is defined in Phase 3. However, enrollment MUST create a session atomically. Two approaches:
- **Option A (recommended):** Define the Session entity in Phase 2 (just the entity file, not the full sessions module). TasksService creates the Session record directly via repository. The full SessionsModule (service, controller, cron job) is built in Phase 3.
- **Option B:** Create a minimal session creation method and import it.

**Go with Option A.** Create `src/modules/sessions/entities/session.entity.ts` in Phase 2. The SessionsModule service/controller will be built in Phase 3.

**`create(dto: CreateTaskDto, adminUserId: string): Promise<Task>`**
1. Load place by `dto.placeId` → throw `NotFoundException('المكان غير موجود')` if not found
2. Validate `endTime > startTime` → throw `BadRequestException('وقت النهاية يجب أن يكون بعد وقت البداية')`
3. Create task with `volunteerGroup = place.volunteerGroup` (auto-mirrored from place)
4. Set `createdBy` to admin user
5. Save and return

**`update(id: string, dto: UpdateTaskDto): Promise<Task>`**
1. Load task
2. If `placeId` is changing → load new place, update `volunteerGroup` to match
3. Apply changes, save

**`remove(id: string): Promise<void>`**
1. Load task
2. Check status — cannot delete if task has ACTIVE sessions
3. **TODO:** Check active sessions once Session entity is queryable
4. Delete task (cascade will handle enrollments)

### 10.5 Controller: `src/modules/tasks/tasks.controller.ts`

| Method | Route | Guard | Body/Query | Notes |
|---|---|---|---|---|
| `GET` | `/tasks/mine` | `@AuthGroup()` | — | Filter by volunteer's group |
| `GET` | `/tasks/:id` | `@Auth(VOLUNTEER)` | — | Task with place |
| `POST` | `/tasks/:id/enroll` | `@Auth(VOLUNTEER)` | — | Enroll + create session |
| `POST` | `/tasks` | `@Auth(ADMIN)` | `CreateTaskDto` | |
| `PATCH` | `/tasks/:id` | `@Auth(ADMIN)` | `UpdateTaskDto` | |
| `DELETE` | `/tasks/:id` | `@Auth(ADMIN)` | — | |

**Route ordering matters:** NestJS matches routes top-to-bottom. Define `/tasks/mine` BEFORE `/tasks/:id` in the controller, otherwise `mine` gets matched as an `:id` param.

### 10.6 Session Entity (created early for enrollment)

Create `src/modules/sessions/entities/session.entity.ts` with the full schema from backend_context.md:

| Column | Type | Constraints |
|---|---|---|
| `id` | uuid PK | auto-generated |
| `volunteer` | ManyToOne → Volunteer | required |
| `task` | ManyToOne → Task | eager: false |
| `status` | enum SessionStatus | default WAITING_ARRIVAL |
| `startedAt` | timestamp | nullable |
| `endedAt` | timestamp | nullable |
| `durationSeconds` | int | nullable |
| `endReason` | text | nullable |
| `feedback` | text | nullable |
| `feedbackAt` | timestamp | nullable |
| `lastLatitude` | decimal(10,7) | nullable |
| `lastLongitude` | decimal(10,7) | nullable |
| `gpsCheckCount` | int | default 0 |
| `createdAt` | timestamp | CreateDateColumn |

**Do NOT create the SessionsModule service/controller yet.** Only the entity file is needed for the enrollment transaction.

### 10.7 Module: `src/modules/tasks/tasks.module.ts`

- Import `TypeOrmModule.forFeature([Task, TaskEnrollment, Session, Volunteer])`
  - Session and Volunteer are needed for the enrollment transaction
- Import `PlacesModule` (for place validation in create)
- Import `VolunteersModule` (for rules check and volunteer lookup in enroll)
- Import `RulesModule` (for rules version check in enroll)
- Provide `TasksService`
- Export `TasksService`
- Controller: `TasksController`

---

## Step 11 — Uploads Module

### 11.1 Install AWS SDK

```bash
npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

### 11.2 DTO: `src/modules/uploads/dto/presign.dto.ts`

**`PresignDto`**
- `filename`: string, `@IsNotEmpty()`, `@IsString()`
- `contentType`: string, `@IsNotEmpty()`, `@IsString()` — e.g. `image/jpeg`, `image/png`, `application/pdf`

### 11.3 Service: `src/modules/uploads/uploads.service.ts`

**`generatePresignedUrl(filename: string, contentType: string): Promise<{ uploadUrl: string, key: string }>`**
1. Inject `ConfigService` to read `aws.*` config
2. Create an S3 client: `new S3Client({ region, credentials: { accessKeyId, secretAccessKey } })`
3. Generate S3 key: `uploads/${uuid()}/${filename}` — uuid prevents collisions
4. Create a `PutObjectCommand` with bucket, key, and contentType
5. Generate presigned URL with 15-minute TTL using `getSignedUrl(s3Client, command, { expiresIn: 900 })`
6. Return `{ uploadUrl, key }`

**Important:** The server never touches file data. The client receives the presigned PUT URL and uploads directly to S3. The `key` is what gets stored in entity fields like `nationalIdPhotoKey`, `profilePhoto`, `photoKey`.

### 11.4 Controller: `src/modules/uploads/uploads.controller.ts`

| Method | Route | Guard | Body | Service Call |
|---|---|---|---|---|
| `POST` | `/uploads/presign` | `@Auth()` | `PresignDto` | `generatePresignedUrl(dto.filename, dto.contentType)` |

Any authenticated user can request a presigned URL (needed for volunteer application photos, session photos, place photos, etc.).

### 11.5 Module: `src/modules/uploads/uploads.module.ts`

- No TypeORM imports needed
- Provide `UploadsService`
- Controller: `UploadsController`

---

## Phase 2 Wiring — app.module.ts Update

After all modules are built, update `src/app.module.ts` to import the new modules:

```
imports: [
  ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
  databaseModule,
  redisCacheModule,
  GlobalModule,
  AuthModule,
  VolunteersModule,   // ← new
  AdminsModule,       // ← new
  CentersModule,      // ← new
  RulesModule,        // ← new
  PlacesModule,       // ← new
  TasksModule,        // ← new
  UploadsModule,      // ← new
]
```

---

## CurrentVolunteer Decorator

Create a new param decorator `@CurrentVolunteer()` in `src/common/decorators/index.ts`:

This decorator reads `req.volunteer` which is set by GroupsGuard. Use it in controllers that use `@AuthGroup()`:

```
Extract: req.volunteer → returns the Volunteer entity
```

This avoids re-querying the database in the controller when GroupsGuard has already loaded the volunteer.

---

## Cross-Module Dependencies

```
VolunteersModule
  ← imports: UserModule
  → exports: VolunteersService

AdminsModule
  ← imports: UserModule
  → exports: AdminsService

CentersModule
  ← imports: VolunteersModule (GroupsGuard)

RulesModule
  ← imports: VolunteersModule, UserModule
  → exports: RulesService

PlacesModule
  ← imports: VolunteersModule (GroupsGuard)
  → exports: PlacesService

TasksModule
  ← imports: PlacesModule, VolunteersModule, RulesModule
  → exports: TasksService

UploadsModule
  (no external deps)

AuthModule (updated)
  ← imports: OtpModule, UserModule, VolunteersModule (for applicationStatus)
```

**Circular dependency warning:** AuthModule needs VolunteersModule for applicationStatus lookup, and VolunteersModule needs UserModule. This is fine — no circular deps. However, if VolunteersModule ever needed to import AuthModule, use `forwardRef()`.

---

## Endpoints Available After Phase 2

```
── Auth (Phase 1, updated) ──
POST /api/auth/login
POST /api/auth/verify-otp          → now includes applicationStatus
POST /api/auth/logout
POST /api/auth/refresh-token
POST /api/auth/resend-otp

── Volunteers ──
POST   /api/volunteers/apply
GET    /api/volunteers/me
GET    /api/volunteers/me/history   (placeholder — full impl in Phase 3)
PATCH  /api/volunteers/me/fcm-token
GET    /api/volunteers              (admin)
GET    /api/volunteers/applications (admin)
PATCH  /api/volunteers/:id/approve  (admin)
PATCH  /api/volunteers/:id/reject   (admin)
PATCH  /api/volunteers/:id/group    (admin)
PATCH  /api/volunteers/:id/ban      (admin)

── Admins ──
POST   /api/admins/sub-admins       (admin)
GET    /api/admins/sub-admins        (admin)
DELETE /api/admins/sub-admins/:id    (admin)

── Centers ──
GET    /api/centers                  (volunteer, group-scoped)
GET    /api/centers/:id              (volunteer)
POST   /api/centers                  (admin)
PATCH  /api/centers/:id              (admin)
DELETE /api/centers/:id              (admin)

── Rules ──
GET    /api/rules                    (volunteer)
POST   /api/rules/confirm            (volunteer)
POST   /api/rules                    (admin)

── Places ──
GET    /api/places/mine              (volunteer, group-scoped)
GET    /api/places/:id               (volunteer)
POST   /api/places                   (admin)
PATCH  /api/places/:id               (admin)
DELETE /api/places/:id               (admin)

── Tasks ──
GET    /api/tasks/mine               (volunteer, group-scoped)
GET    /api/tasks/:id                (volunteer)
POST   /api/tasks/:id/enroll         (volunteer)
POST   /api/tasks                    (admin)
PATCH  /api/tasks/:id                (admin)
DELETE /api/tasks/:id                (admin)

── Uploads ──
POST   /api/uploads/presign          (any authenticated user)

── Docs ──
GET    /api/docs                     (Swagger UI)
```

---

## Deferred to Phase 3

- SessionsModule full implementation (service, controller, cron job, GPS ping, leave early, photos, feedback)
- `volunteers/me/history` full implementation (needs Session queries)
- `places/mine` open task count enrichment (can be added after tasks exist, or deferred)
- Active session validation in task deletion
- `updateHours()` recalculation from actual session data

---

## Build Order Within Phase 2

Modules must be built in this specific order due to dependencies:

1. **Volunteers** — no Phase 2 dependencies, needed by everything else
2. **Admins** — needs UserModule only
3. **Centers** — needs VolunteersModule for GroupsGuard
4. **Rules** — needs VolunteersModule for confirmRules
5. **Places** — needs VolunteersModule for GroupsGuard
6. **Session entity only** — just the entity file, needed by Tasks enrollment
7. **Tasks** — needs Places, Volunteers, Rules, Session entity
8. **Uploads** — independent, can be built at any point
9. **Wire Phase 1 deferred items** (GroupsGuard completion, applicationStatus in LoginOtpStrategy)
10. **Update app.module.ts** — add all new modules

---

## Verification Checklist

After Phase 2 is complete, verify:

1. `npm run build` compiles without errors
2. `npm run start:dev` starts and all entities sync to PostgreSQL
3. Admin seeding creates an admin user on startup
4. `POST /api/auth/login` + `verify-otp` works and returns `applicationStatus: null` for non-volunteers
5. `POST /api/uploads/presign` returns a presigned URL and key
6. `POST /api/volunteers/apply` creates a volunteer record with PENDING status
7. `POST /api/auth/verify-otp` now returns `applicationStatus: 'pending'` for the applied volunteer
8. `PATCH /api/volunteers/:id/approve` sets status to APPROVED, assigns group, sets user role to VOLUNTEER
9. `POST /api/rules` creates rules with version 1, second call increments to version 2
10. `POST /api/rules/confirm` updates volunteer's `rulesConfirmedVersion`
11. `POST /api/centers` creates a center, `GET /api/centers` (as volunteer) returns only group-scoped centers
12. `POST /api/places` creates a place with custom `proximityThresholdMeters`
13. `POST /api/tasks` creates a task linked to a place, auto-mirrors `volunteerGroup`
14. `POST /api/tasks/:id/enroll` creates enrollment + session atomically, checks rules version
15. Enrolling without confirming rules returns 403 with Arabic message
16. Enrolling when already enrolled returns 409
17. Swagger UI shows all new endpoints at `/api/docs`
