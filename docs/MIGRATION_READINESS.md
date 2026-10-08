# DVG Project Control — migration readiness

Living document for the planned move off Base44 to an independent DVG platform
(GitHub + Codex, Supabase PostgreSQL, Supabase Auth and Storage).

Nothing here changes how the app runs. It records what exists, what is
platform-specific, and how the data maps across.

## A. Entity inventory

| Base44 entity | Purpose | Scope |
| --- | --- | --- |
| Project | A development (Imagine, Birdie) | Company |
| Phase | A phase inside a project (A, B) | Project |
| Location | A villa or common location; `villa_code` is the permanent id, `plot_numbers` the original plot reference | Project |
| Contractor | Execution teams, internal and external | Company |
| ContractorDefault | Default contractor per project / phase / discipline | Project |
| WorkPackage | Standard work packages per discipline | Project |
| Discipline | Company discipline list (CIVIL, ELEC, …) | Company |
| ProjectMembership | Who holds which role on which project | Project |
| Task | Every work item; permanent `task_ref` | Project |
| TaskDependency | Structure only, logic is a later step | Project |
| TaskHistory | Append-only change trail | Project |
| BaselineVersion | Frozen baseline snapshots per phase | Project |
| User | Built-in profile (id, email, full_name, role) | Platform |

Field-by-field export order: `src/lib/exportSchema.js`. Live export: **Administration → Export**.

## B. Stable ids and relationships

- Every record keeps its internal `id`; the app references relations by id only.
  Display names are never used as keys.
- Task references (`IMG-A-0001`) are allocated by the server and never reused
  (`base44/shared/taskRef.ts`).
- Villa work: a container task (`is_villa_work_parent = true`) plus one child per
  villa (`parent_task_id`). Children carry the work; the container is excluded
  from the register and its totals so nothing is double counted.
- Combined plots and split villas are explicit: `Location.villa_code` holds the
  physical id (`B-05-06`, `B-14A`) while `plot_numbers` keeps the original plot
  reference (`Plots 5 & 6`, `Plot 14 — Villa A`).
- Full relation list: `RELATIONSHIPS` in `src/lib/exportSchema.js`.

## C. Exports

Administration → Export (application administrators only):

- **JSON bundle** — every entity in one file with `_meta`: export time, row
  counts, relationship list, and what is deliberately excluded. Nested data
  (`BaselineVersion.snapshot`, `.changes`) travels in full.
- **CSV per entity** — fixed column order from `exportSchema.js`, arrays joined
  as JSON text.

The export function pages through records (500 at a time) so it keeps working as
the register grows. Excluded: passwords, tokens, sessions, verification codes.
Photos and attachments are not exported yet — no upload exists; only
`Task.attachment_ref`. Daily updates, inspections and manpower records are not
built yet.

## D. Base44-specific dependencies

| Dependency | Where | Replacement |
| --- | --- | --- |
| `@/api/base44Client` SDK (entities, functions, auth) | every page | Supabase JS client + REST |
| RLS via `rls` blocks in `base44/entities/*.jsonc` | all project data | Postgres RLS policies (see E) |
| Backend functions `taskWrite`, `saveRecord`, `villaWorkCreate`, `baselineAction`, `nextTaskRef`, `getMyAccess`, `dataExport` | `base44/functions/` | Supabase Edge Functions |
| Shared server modules `access.ts`, `history.ts`, `taskRef.ts`, `records.ts` | `base44/shared/` | plain TypeScript modules, portable as-is |
| Built-in User entity | Auth | `auth.users` + `profiles` |
| `created_by_id`, `created_date`, `updated_date`, `member_ids` system fields | every record | explicit columns; `member_ids` becomes a join table |
| Platform auth pages (login, register, reset) | `src/pages/` | Supabase Auth UI |
| `member_ids` mirror on records | all project entities | remove after migration (the join replaces it) |

Business rules live in single places, not in components:
`base44/shared/access.ts` (roles and ranks), `history.ts` (what is audited and
how values are compared), `taskRef.ts` (reference allocation),
`base44/functions/taskWrite` (task validation, approval separation, baseline
lock), `baselineAction` (baseline lifecycle), `src/lib/accessRules.js` and
`src/lib/constants.js` (shared labels, statuses, capability ranks).

## E. Authentication and permissions

Today: sessions and password/OTP flows belong to the platform; the app stores
only `ProjectMembership` (role per project) and reads its own access through
`getMyAccess`. Every write re-derives the role on the server — no client claim
is trusted.

Role ranks: Viewer 0, Supervisor 1, Site Engineer 1, Project Manager 2,
Project Admin 3, application administrator 4.

Mapping to Supabase:

1. `auth.users` holds credentials (never exported).
2. `profiles` = `User.id, email, full_name, role` (app role: admin / user).
3. `project_memberships` = `ProjectMembership` with `user_id` as the foreign key
   to `auth.users.id`, plus `role`.
4. RLS pattern per project table:
   `exists (select 1 from project_memberships m where m.project_id = tasks.project_id and m.user_id = auth.uid() and m.active)`.
5. Write rules: `edit_tasks` needs rank ≥ 1, approvals/baselines/membership/
   archiving need rank ≥ 2, project creation needs the application
   administrator — reimplement these as `security definer` functions returning
   the caller's rank, called from the policies, so the rule stays in one place.
6. `TaskHistory` and `BaselineVersion` must be read-only for everyone after
   migration: revoke insert/update/delete and let only the Edge Functions write.
7. Until a member signs in, their membership is matched by email; after
   migration, invite through Supabase Auth so `user_id` is known immediately.

## F. Suggested Supabase schema

| Base44 entity | Supabase table | Notes |
| --- | --- | --- |
| Project | `projects` | `id uuid pk`, `code text unique not null` |
| Phase | `phases` | `project_id` fk → projects, `unique (project_id, code)` |
| Location | `locations` | `project_id`, `phase_id` fk; `villa_code text` with `unique (project_id, villa_code)` |
| Contractor | `contractors` | company-wide, no project fk |
| Discipline | `disciplines` | `code text unique` |
| ContractorDefault | `contractor_defaults` | `discipline` references `disciplines.code` |
| WorkPackage | `work_packages` | `project_id`, `discipline` |
| ProjectMembership | `project_memberships` | `user_id` fk → `auth.users`, `unique (project_id, user_id)` |
| Task | `tasks` | all fields as columns; `task_ref text unique`; self fk `parent_task_id`; `dates date`; enums as `text` + check constraint |
| TaskDependency | `task_dependencies` | two fks to `tasks` |
| TaskHistory | `task_history` | `changed_at timestamptz`, `old_value/new_value text` |
| BaselineVersion | `baseline_versions` | `snapshot jsonb`, `changes jsonb`, `version_number int` |
| User | `profiles` | `id` = `auth.users.id` |
| `member_ids` (system field) | *(none)* | replaced by `project_memberships` |
| `created_by_id` | `created_by uuid` | → `auth.users.id` |

Portable conventions already in the data: ISO `YYYY-MM-DD` dates, ISO 8601
timestamps, status values as fixed strings from `src/lib/constants.js` (safe as
Postgres `text` + check, or as enums created in the same order). Quantities and
percentages are numbers, blank allowed — an unknown progress is `null`, never 0.
All date logic uses Asia/Kolkata.

## G. Migration risks and blockers

1. **`member_ids` mirror** — a denormalised convenience that must not survive as
   the source of truth. The join table is the truth; drop the mirror after RLS is
   proven equivalent.
2. **Server-side write path is the real control** — the rules live in Edge
   Functions today. If they are ported without their policies, the app still
   "works" but nothing is protected. Port RLS and functions together.
3. **Reference allocation** (`taskRef.ts`) must move to a Postgres sequence or a
   locked counter per project+phase, otherwise concurrent creation can duplicate
   `task_ref`.
4. **Audit trail integrity** — `TaskHistory` is written from trusted before/after
   values. Keep it append-only; never recompute history from the tasks table,
   because history records what was true at a point in time.
5. **Approval identity** — `execution_completed_by_id` and `approved_by_id` are
   set by the server from the session. Any reimplementation that accepts these
   from the client silently removes the separation of duties.
6. **Baseline freeze semantics** — an approved baseline is immutable and later
   changes are new versions. A naive "just update the task dates" port loses the
   audit of what moved.
7. **Files** — no photo or attachment upload exists yet. When it is added, store
   in Supabase Storage with a private bucket and a metadata row holding
   `task_id`, the storage path, timestamp and uploader; mirror `UploadPrivateFile`
   semantics, not public URLs.
8. **No one-click migration** — Base44 exports data and code, not an equivalent
   database. Expect a scripted import: entities in dependency order (projects →
   phases → locations → contractors → disciplines → work packages → contractor
   defaults → memberships → tasks → dependencies → baselines → history), then
   re-point membership `user_id`s by email after inviting users into Supabase Auth.
9. **Screens are not portable** — pages use shadcn/ui + Tailwind and are the
   cheapest part to keep; the SDK calls, RLS and the auth pages are what change.