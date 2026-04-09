# Volunteers Analysis Dashboard Data schema

Based on the database schema and actual TypeORM entity files in the codebase, here is a complete extraction of everything you need to build the volunteers analysis section of the dashboard. 

*(Note: While some earlier documentation refers to "Tasks," the actual codebase implements them as "Campaigns".)*

## 1. Core Volunteer Profile (`volunteers` & `users` tables)
These tables hold the demographic and status information needed for filtering, segmentations, and basic demographic charts.

### Table: `volunteers`
- `id` (UUID) - Primary Key.
- `fullName` - Searchable volunteer name.
- `nationalId` - For identity verification.
- `governorate` & `area` - Enums for geographic distribution (e.g., Cairo, Giza, Haram, Faisal).
- `educationalLevel` - (High School, Bachelor, None) useful for demographic breakdowns.
- `volunteerGroup` - Which group/team they belong to (e.g., Haram, Faisal).
- `applicationStatus` - Crucial for funnel analysis (`pending`, `approved`, `rejected`, `banned`).
- `appliedAt` & `reviewedAt` - For tracking approval conversion speeds.
- `totalVolunteeringHours` - Pre-calculated aggregate for leaderboards and overall impact.

### Table: `users` (Linked 1:1 to Volunteer)
- `phone` - Contact info.
- `isPhoneVerified` - Verification metric.
- `role` - Ensures they are a `volunteer` role.

---

## 2. Activity & Scheduling (`campaigns` & `campaign_enrollments` tables)
These tables allow you to analyze what events volunteers are interested in, drop-off rates, and overall capacity.

### Table: `campaigns` *(Referred to as `tasks` in some docs)*
- `id` (UUID) - Primary Key.
- `title`, `place` (Relation to `places` table) - What and where the campaign is.
- `volunteerGroup` - Target group for the campaign.
- `scheduledDate`, `startTime`, `endTime` - Chronological analysis (e.g., busy days, peak hours).
- `maxVolunteers` - Total capacity available.
- `status` - (`open`, `full`, `in_progress`, `completed`, `cancelled`).

### Table: `campaign_enrollments`
- `campaignId` & `volunteerId` - Relations linking the volunteer to the campaign.
- `enrolledAt` - When they signed up.
- `leaveReason` & `leftAt` - Key metrics for analyzing **turnover or cancellation rates** prior to the event.

---

## 3. Execution & Compliance (`sessions` & `gps_audit_logs`)
These tables provide the raw data for real-time tracking, compliance analysis, and post-event feedback.

### Table: `sessions`
- `campaignId` & `volunteerId` - Linking the execution block.
- `status` - Live tracking (`waiting_arrival`, `active`, `completed`, `left_early`, `abandoned`).
- `startedAt` & `endedAt` - Real timestamps vs scheduled time (late arrivals, early departures).
- `durationSeconds` - Exact time spent active.
- `endReason` - Why standard completion didn't occur (if applicable).
- `feedback` & `feedbackAt` - Qualitative data from the volunteer after the session.
- `lastLatitude` & `lastLongitude` - Last known location.

### Table: `gps_audit_logs`
- `sessionId` & `volunteerId` - Link back to the specific execution block.
- `latitude` & `longitude` - Point-in-time coordinates.
- `isWithinRange` (Boolean) - Critical metric! Used to calculate "Time spent inside the designated zone vs. wandering off".
- `isFirstArrival` - Tracks exactly when they breached the geofence perimeter.
- `createdAt` - Timestamp of the ping.

---

## Key Dashboard Analysis Metrics You Can Build With This:

1. **Growth & Acquisition:** Trendline of `appliedAt` vs `reviewedAt` over time using the `volunteers` table.
2. **Attendance Rates:** Comparing entries in `campaign_enrollments` versus completed `sessions`. 
3. **Dropout/Flaking Analysis:** Analyzing `leaveReason` in enrollments and status `abandoned` or `left_early` in sessions.
4. **Geographic Distribution:** Pie charts or map clusters using `governorate` and `area` from `volunteers`.
5. **Real-time Compliance Score:** Aggregating the `isWithinRange` true/false counts in `gps_audit_logs` for a session to show if a volunteer was actually at their post.
6. **Leaderboards:** Sorting the `volunteers` table by `totalVolunteeringHours` descending.
