# Phase 0: check Base44 before committing to a schedule

Do this in the Base44 app (admin login). Tick each line and write the result next to it. Any "No" changes the plan; tell Claude.

## 1. Export coverage
Run Admin > Export (the JSON bundle) and note the record count of each table. The generated schema has 33 tables (`supabase/migrations/0001_schema.sql`).
- [ ] Every table in the bundle has the same count as its screen / list view
- [ ] Record ids in the bundle are the real Base44 ids (the same id appears in links like `/tasks/<id>`)
- [ ] `created_date` and `updated_date` are present on every record
- [ ] `TaskHistory`, `RecordAudit` and `ImportBatch.report` come out in full (no truncation notice)
- [ ] Largest table (likely `Task` or `TaskHistory`): exported in one go, or in pages? How long did it take?

## 2. Photos and drawings
Photos are private storage references (`DailyUpdate.photo_uris`, drawings in `Drawing`); the app reads them through signed links.
- [ ] Can Base44 give a bulk download of all uploaded files, or only one signed link per file?
- [ ] Do signed links expire? How long?
- [ ] Total number and size of photos and drawings (needed to plan the copy to Supabase Storage)

## 3. Users
- [ ] Can Base44 export user accounts (name, email, role)? Passwords cannot be moved: assume each person gets an invitation / password reset
- [ ] List the 6 active users and the roles on `ProjectMembership` so the same access can be recreated

## 4. Secrets and integrations
- [ ] `OPENAI_API_KEY` is held as an app secret; copy it from the source you created it from (it cannot be read back)
- [ ] Any other Base44 integrations in use besides file upload, signed URLs and InvokeLLM

## 5. Limits
- [ ] Ask Base44 for the current rate limits (message drafted in `docs/PLATFORM_MOVE.md`)

## What is already prepared
- Schema for all 33 entities, generated from the entity files: `node scripts/gen-supabase-schema.mjs`. Ids are text (kept as is), enums become CHECK constraints, row-level security is on with no policies yet.
- To port (21 server functions, all in `base44/functions`): aiAction, attentionAction, baselineAction, constraintWrite, dailyUpdate, dashboardData, dataExport, getMyAccess, importUndo, inspectionWrite, migrate, nextTaskRef, ownerAccess, ownerSignoff, saveRecord, siteDiary, snagWrite, taskWrite, villaScopeCopy, villaWorkCreate, workImport. Their business rules are in `base44/shared` and carry over; the SDK calls (`createClientFromRequest`, `asServiceRole`, `integrations.Core.*`) are what get replaced.
