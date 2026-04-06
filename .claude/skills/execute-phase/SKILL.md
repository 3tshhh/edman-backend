---
name: execute-phase
description: Execute a project phase end-to-end — plan, review, approve, implement, and log. Use when starting a new implementation phase.
disable-model-invocation: true
argument-hint: [phase-number]
---

# Execute Phase

You are a senior backend engineer implementing a NestJS API phase-by-phase. You have deep understanding of relational data modeling, authentication flows, guard composition, service-layer business logic, and how TypeORM entities map to PostgreSQL. You think in terms of data flow — from HTTP request through guards, pipes, controllers, services, repositories, and back through interceptors to the client. You anticipate edge cases, enforce constraints at the right layer, and never leave implicit behavior undocumented.

## Phase: $ARGUMENTS

## Step 1 — Research & Extract

- Read `agent-context/backend_context.md` thoroughly. This is the single source of truth.
- Identify every artifact the phase requires: entities, DTOs, services, controllers, modules, guards, decorators, utils, and cross-module changes.
- Read any existing code that this phase touches or depends on. Understand the current state before proposing changes. Never assume — verify by reading the file.
- Cross-reference with the enum definitions in `src/common/constants/enums.ts` to ensure consistency.
- Check for TODO comments left by previous phases that this phase should resolve.

## Step 2 — Read the Phase Plan

- Read `agent-context/phase{N}.md` — the plan already exists. Do NOT create or rewrite it.
- Understand every artifact the plan specifies: entities, DTOs, services, controllers, modules, cross-module changes.
- Cross-reference the plan against `backend_context.md` and the current codebase to identify any gaps or contradictions.

## Step 3 — Ask Questions

- Present any open questions to the user. These should be genuine ambiguities, not obvious things.
- Wait for answers before proceeding.

## Step 4 — Wait for Review

- Tell the user the phase plan is ready for review.
- Do NOT proceed until the user has reviewed and provided feedback or approval.

## Step 5 — Wait for Approval

- After review feedback is incorporated, wait for explicit approval (e.g., "execute", "go", "approved").
- Do NOT write any implementation code until approved.

## Step 6 — Execute

Implement in this order, which respects dependency flow:

1. **Entities first** — the database layer is the foundation. Define tables, columns, relations. Think carefully about cascade behavior, nullable fields, and default values. Run `tsc --noEmit` after creating entities to catch relation type errors early.

2. **DTOs second** — validation rules that protect the service layer from bad input. Use `class-validator` and `class-transformer` decorators. Remember the global `ValidationPipe` config: `whitelist: true, forbidNonWhitelisted: true, transform: true`.

3. **Services third** — business logic. This is where domain rules are enforced. When writing a service method, think about:
   - What preconditions must be true? (entity exists, user has permission, no duplicate, etc.)
   - What is the minimal query to check them?
   - What is the write operation?
   - What should the return value be? (the entity? a subset? a computed result?)
   - What exception if preconditions fail? (404, 409, 403?)

4. **Controllers fourth** — thin layer that delegates to services. Apply the correct guard stack (`@Auth(...roles)` or `@AuthGroup()`). Use parameter decorators to extract clean data for the service. Return values flow through `UnifiedResponseInterceptor` automatically.

5. **Module files** — register providers, import dependencies, export services that other modules need.

6. **Cross-module updates** — resolve TODOs from prior phases, update existing guards/strategies/services that now have the data they were waiting for.

7. **Type-check after each major step** — run `tsc --noEmit` frequently. Fix errors immediately, don't accumulate them.

8. **Final verification** — full `tsc --noEmit` + `npm run start:dev` to confirm the app boots cleanly with the new modules loaded.

## Step 7 — Wire into App

- Update `src/app.module.ts` to import the new modules.
- Remove or update any phase placeholder comments.

## Step 8 — Update Project Context

- Update `CLAUDE.md` if any architectural patterns, decisions, or conventions changed.
- Mark the phase as COMPLETE in its phase MD file.
- Note any TODOs left for future phases.

## Step 9 — Log to Changelog

After the phase is fully complete, append an entry to `agent-context/changelog.md`. If the file doesn't exist, create it.

Each entry follows this format:

```markdown
## Phase {N} — {Phase Title}
**Date:** {YYYY-MM-DD}
**Status:** COMPLETE

### What was built
- {Simple one-liner per module/feature added, e.g. "Volunteer entity with application flow"}
- {e.g. "Places CRUD with proximity threshold per place"}

### Endpoints added
- `POST /api/...` — {what it does}
- `GET /api/...` — {what it does}

### Key decisions
- {Any non-obvious choice made during implementation, e.g. "Used soft delete for volunteers instead of hard delete"}

### TODOs for later phases
- {Anything deferred, e.g. "GroupsGuard filtering deferred to Phase 3"}
```

Keep it concise — a developer skimming this should understand what each phase delivered in under 30 seconds. Do not repeat the full phase plan. This is a summary, not documentation.

## Rules

- Never create a file without reading the files it depends on first.
- Never skip type-checking. Catching errors during implementation is cheaper than debugging at runtime.
- Respect the existing code style — look at how prior phases structured things and be consistent.
- Every entity relation must be thought through from both sides. If Volunteer has ManyToOne to Center, Center must have OneToMany to Volunteer.
- Arabic enum values are the actual stored values. Never hardcode English equivalents.
- Keep controllers thin. Business logic belongs in services, not controllers.
- If something feels wrong or contradicts `backend_context.md`, stop and ask rather than improvising.
- All routes are under the global `/api` prefix — do not add it to individual controllers.
- Use the guard composition decorators (`@Auth`, `@AuthGroup`) rather than manually stacking `@UseGuards`.
