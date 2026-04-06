---
name: create-phase
description: Read backend_context.md and all existing phase files, then generate the next phase plan document with detailed implementation instructions (no code). Use when you need to plan the next implementation phase.
disable-model-invocation: true
argument-hint: [phase-number]
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# Create Phase Plan

You are a senior backend architect creating a detailed, implementation-ready phase plan for a NestJS API. You produce instructions only — **never write code blocks that are meant to be copy-pasted into source files**. Code is only acceptable inside the plan when illustrating a type signature, a column definition table, or a short inline reference (e.g., `@IsNotEmpty()`). The plan must be detailed enough that a developer (or an AI executing it) can implement every file without ambiguity.

## Target Phase: $ARGUMENTS

---

## Step 1 — Load All Context

Read these files in order. Do not skip any.

1. **`agent-context/backend_context.md`** — the single source of truth for entities, endpoints, service logic, WebSocket events, and architectural rules.
2. **All existing phase files** — use Glob for `agent-context/phase*.md` and read every match. Understand what has been built, what was deferred, and what TODOs were left for future phases.
3. **`CLAUDE.md`** — project-level instructions and architectural rules.
4. **Current source tree** — run `ls src/modules/` to see which modules exist. Read key files if needed to understand the actual implementation state (not just what the plan says).

After reading, you should have a complete picture of:
- What the backend_context.md specifies for the target phase
- What prior phases built and what they deferred
- What TODOs/placeholders exist in the codebase that this phase should resolve

---

## Step 2 — Determine Phase Scope

From `backend_context.md` § "Build Order", identify which modules belong to Phase $ARGUMENTS. Cross-reference with:

- The "Deferred to Phase N" sections of all prior phase files
- TODO comments noted in prior phases
- Any phase-1/2/etc deferred items that should now be resolved

List the **exact scope**: which modules to create, which existing files to modify, which Phase N-1 TODOs to close.

---

## Step 3 — Write the Phase Plan

Create `agent-context/phase{N}.md` with the following structure. Every section must be exhaustive — do not leave anything for the implementer to figure out.

### Plan Structure

```
# Phase {N} — {Title}

> **Status:** NOT STARTED
> **Prerequisite:** Phase {N-1} must be complete and building successfully.

---

## Scope
- List every module/step with a one-line description

## Prior Phase Deferred Items to Resolve
- For each TODO left by previous phases that this phase addresses:
  - Which file, what the TODO says, what the fix is

## Step {X} — {Module Name}

### {X}.1 Entity: `src/modules/{name}/{name}.entity.ts`
- Table of every column: name, TypeORM type, constraints (nullable, default, unique, indexed)
- Table of every relation: type (ManyToOne/OneToMany/etc), target entity, JoinColumn side, cascade, eager, onDelete
- Notes on any non-obvious design decisions

### {X}.2 DTOs: `src/modules/{name}/dto/`
- For each DTO file:
  - Every field with its class-validator decorators listed
  - Which fields are optional vs required
  - Any transform decorators needed
  - Note if using PartialType/OmitType/PickType

### {X}.3 Service: `src/modules/{name}/{name}.service.ts`
- For each method:
  - Full signature (name, params with types, return type)
  - Step-by-step logic description (numbered)
  - Error cases: which condition → which exception with which Arabic message
  - Transaction boundaries if multiple writes
  - Which other services are injected and why
  - Any TODO items if this method depends on a future phase

### {X}.4 Controller: `src/modules/{name}/{name}.controller.ts`
- Table: HTTP method, route, guard decorator, body/query DTO, service method called
- Notes on route ordering (e.g., `/mine` before `/:id`)
- Which param decorators to use (@CurrentUser, @CurrentVolunteer, @Param, @Query, @Body)

### {X}.5 Module: `src/modules/{name}/{name}.module.ts`
- imports (with reason)
- providers
- exports (with reason — who needs this service?)
- controllers

## Cross-Module Dependencies
- Diagram or table showing which module imports which

## app.module.ts Update
- Exact list of modules to add to imports array

## Endpoints Available After Phase {N}
- Full list of all endpoints (including prior phases)

## Deferred to Phase {N+1}
- Anything that cannot be completed in this phase

## Build Order Within Phase {N}
- Numbered list respecting dependency order
- Explain why each item must come before the next

## Verification Checklist
- Numbered list of manual tests to confirm everything works
```

---

## Step 4 — Present Questions

If anything in `backend_context.md` is ambiguous or conflicts with prior phase decisions, list your questions. Do not guess. Wait for answers before finalizing the plan.

---

## Step 5 — Summarize

After writing the phase file, give the user a brief summary:
- How many modules/steps
- Key complexity points
- What Phase N-1 TODOs get resolved
- What gets deferred to Phase N+1

---

## Rules

- **No implementation code in the plan.** Tables, decorator names, type signatures, and inline references are fine. Do not write full TypeScript class/function bodies.
- **Every field, every method, every route must be specified.** The plan is a contract — if it's not in the plan, it won't be built.
- **Arabic error messages must be included** for every exception the service throws.
- **Respect `backend_context.md` exactly.** If the plan contradicts it, the plan is wrong.
- **Column types matter.** Specify `varchar(N)` lengths, `decimal(precision, scale)`, `int` vs `smallint`, etc.
- **Think about queries.** If a service method needs to filter by a column, that column should be indexed. Note any indexes needed beyond primary keys and unique constraints.
- **Think about cascade behavior.** If a parent is deleted, what happens to children? Specify `onDelete` for every relation.
- **Think about ordering.** Default sort orders for list endpoints.
- **Cross-reference with the Flutter app flow** (`agent-context/flutter_app_flow.md` if it exists) to ensure endpoints match what the mobile app expects.
