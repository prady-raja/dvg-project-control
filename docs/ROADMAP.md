# Product roadmap — the villa works tracker

Date of record: 2026-10-09 (Asia/Kolkata). Line references are as of commit `5fcf330`.
Interactive version (filter by phase and area): https://claude.ai/artifact/GfnxL4MrHparELQPTmTqYG

101 recommendations: **27 MVP** (before the five staff go live and the full Imagine import), **64 Phase 2**, **10 Future**.

How this was built: four readers audited the code (data and backend, field workflows, management views, setup and navigation); three benchmark studies covered construction apps (Procore, Fieldwire, PlanRadar, Autodesk Build, Raken, SafetyCulture, Touchplan / Last Planner, Powerplay, Onsite), work-management apps (Linear, Asana, Monday, Notion, Airtable) and architecture practice; a synthesis was reviewed by a completeness critic and a feasibility critic; each Fix-now item was then checked against the code by an independent reviewer, and the whole list was aligned with the purpose below and with `docs/MIGRATION_READINESS.md`.

**Keeping it current:** when an item ships, change its Status in section 8 to `Done (commit-hash)`. Items are referenced by id (for example `X-01`) in commits and pull requests.

---

## 1. Purpose

DVG Project Control is Dream Valley Group's single tracker for finishing the pending works on Imagine Villas Phase A and B, down to floor and room. That covers 26 villas, including combined plots such as B-05-06, and 9 villas already handed over to owners, some of which still have open works. Birdie Residences follows once it leaves the planning stage. One admin and five staff use it, all five at the same Project Editor level (site, MEP, procurement, planning and management). They work mostly on phones and often from WhatsApp-style site messages. With it they load the real Excel work lists and drawings, record progress and blockers quickly, plan work around owners' access to occupied villas, and verify and close work and snags. Management uses it to decide what to push this week, which blockers and contractors to chase, which villas can be closed out or handed over, and what to tell each owner. Those decisions rest on honest figures that never invent a percentage and agree on every screen.

Core jobs, in order of importance:

1. Load the real Imagine work lists and drawings accurately to villa, floor and room, and take in revised lists without duplicates or lost history.
2. Know for each villa exactly what is still pending, who owns each item and when it will be done, in a form ready to share in an owner or handover conversation.
3. Capture site progress, photos and blockers from a phone in seconds, including from WhatsApp-style messages, with nothing written until a person confirms.
4. See and chase every blocker by owner and due date: contractor, materials, client selection, DVG approval or the villa owner's access.
5. Coordinate work in handed-over villas: book owner access, combine several trades into one visit, log defects that owners report and record owner sign-off.
6. Give management honest, consistent figures (overdue, at risk, blocked, awaiting verification, forecast completion per villa), with the list behind every number and the change since last week.
7. Verify completed work and close snags with evidence, keeping the person who did the work separate from the person who approves it.
8. Hold contractors to the dates they promised in meetings.
9. Keep data and rules portable, so the app can move to Supabase without changing behaviour and be reused for Birdie Residences.

## 2. Where this ends up

DVG Project Control is the one honest tracker for finishing Dream Valley Group's villas. It holds every pending work item on Imagine Villas Phase A and B, villa by villa and room by room, whether the villa is still with DVG or already handed over to its owner, and later the full build of Birdie Residences. A site engineer opens Today on a phone and logs progress with a photo in about four taps, or pastes a WhatsApp-style message and confirms the updates the assistant proposes. The engineer can also raise a blocker with an owner and a date: a contractor, a material, a client selection or the villa owner's access. A coordinator sees what is ready, what is blocked and by whom, books owner access visits for occupied villas and holds contractors to their meeting promises. Management sees a few honest headline numbers, each of which opens the list behind it. They also get a villa x discipline matrix with each villa's possession status and forecast completion, and a one-page pending-works statement per villa that can go straight into an owner or handover conversation by WhatsApp or PDF. No percentage is shown unless it is measured, and every board agrees. The app goes live on Base44 with the real Imagine work lists and drawings. Once daily use is stable it moves to an independent DVG platform: Supabase PostgreSQL, Auth and Storage, with the code in GitHub and built with Codex. Business rules live in portable shared modules behind one thin data adapter, so the move changes the plumbing, not the behaviour.

## 3. Platform decision — go live on Base44, then move to Supabase

Do not migrate before go-live. The Imagine pending works are happening now, and the trimmed MVP can deliver value in weeks on the app that already works. Migrating first would delay go-live by an estimated 4-6 weeks and users would see nothing new. Migrate right after go-live is stable, which means about 2-4 weeks of daily reports and zero critical Needs Attention items, and before Phase 2b/2c. The scheduler, reminders, weekly report, offline outbox, live updates and attachments are exactly the features that are built differently on each platform, so building them on Base44 first means building them twice (R-09 build, R-10 cutover). Phase 2a work that touches only React and pure shared logic can run alongside R-09: shared scope, URL filters, Villa Day Sheet, owner access visits, snag register and sharing. To keep everything portable: business rules stay in pure base44/shared/*.ts with no SDK imports (they already use Deno-style imports that run in Supabase Edge Functions); all data access goes through one thin adapter (R-08); backfills are written as pure functions; AI sits behind a provider interface with a plain-fetch provider; and no new Base44-only feature (aggregate, subscribe, analytics.track, scheduled automations, Core.SendEmail, RLS rewrites) is added unless it is wrapped and has a named Supabase equivalent. The data is small (2 projects, 28 locations, roughly 2,000 tasks after the import), so a rehearsed one-weekend cutover, checked figure by figure, is low risk.

## 4. Design principles

- One location, one truth: every record sits under Project > Phase > Location (villa or common area) > Floor > Room, and every screen shows that path.
- Possession and works are separate facts. A handed-over villa with pending works stays first in line, the villa owner's access is a constraint with a date and a contact, and handing over never closes work.
- Honest numbers only: every figure opens the list behind it, nothing is cut short without saying so, one exclusion filter applies everywhere, every board shows the same counts, and no percentage appears unless it is measured.
- Capture in under 30 seconds with one thumb: one Log update path filled in from the task, photos compressed on the phone, a draft that survives interruptions, and Undo or same-day correction. WhatsApp-style text is accepted, but nothing is written until a person confirms it.
- Show people their own work first and let them act where they see the problem: fix, assign, resolve, chase on WhatsApp or share from the same board. Context lives in the URL, so a link pasted into WhatsApp opens the exact view.
- Status is not schedule health: 4 status categories (icon, colour and text), with On track / At risk / Late as a separate badge measured in working days from the project calendar. Reasons are chosen from categories so they can be counted.
- Go live first: the MVP is only what the Imagine finishing works and the real import need. Everything else waits until the 5 staff are reporting daily.
- Portable by default: business rules live in pure shared TypeScript with no SDK imports, all data access goes through one thin adapter, and no Base44-only feature is added unless it is wrapped and has a named Supabase equivalent.
- Simple access that matches the target platform: Admin, Project Editor and Viewer, with membership-scoped reads that map one-to-one to the Supabase project_memberships policy. The aim is clarity, not security.
- Safe changes: every bug gets a regression test, every backfill is a dry-run migration that is safe to run twice, and every data move is checked figure by figure.

## 5. Home screen per role

| Role | Home screen | Navigation |
| --- | --- | --- |
| Site engineer (mobile) | Today: my villas, each marked reported or not reported today; today's plan (yesterday's plan_tomorrow); my tasks that are overdue, due within 7 working days, blocked or stale; commitments due or missed; snags waiting for my reinspection; AI proposals waiting for me. Each card has its own button (Update, Unblock, Reinspect). A large centre + in the bottom bar opens Log update, Snag and Tell DVG (Site diary joins in Phase 2), already scoped to the villa on screen. A 'pending sync' chip appears once offline mode exists. | Today · Villas · + (Log update · Snag · Tell DVG) · Snags · More: Tasks, Daily activity, Look-ahead, Drawings, Inbox, Help |
| Project manager / coordinator | Today with 'All villas' turned on: the 4 headline numbers (Overdue, At risk, Blocked, Awaiting verification); today's report coverage by villa, with the 14-day grid and team table in Phase 2; blockers grouped by owner with Resolve and Chase; the Needs Attention queue with Fix, Assign and Dismiss; commitments due or missed this week; the site diary status; and the 3-week look-ahead marked Ready or Waiting in Phase 2. | Today · Dashboard · Villas (incl. common areas) · Work: Tasks · Planning / Look-ahead · Daily activity & diary · Blockers · Snags · Needs Attention · Teams: Contractors · Meetings · Setup: Import & history · Help |
| Management / owner | Executive overview: a red/amber/green strip per phase; the 4 headline numbers with the change since last week (once 7 days of snapshots exist); the villa × discipline matrix with each villa's forecast handover date and slip; the top forecast slips by reason category; and a one-tap Share (WhatsApp text, print to PDF). Phase 2 adds the contractor ranking, the latest photo per villa and the weekly owner report. | Overview · Villa matrix · Reports & share · Contractors · Villas · Blockers |
| Admin | The executive overview plus a data-health panel: critical Needs Attention counts, recent imports with Undo, migration runs, the latest client errors and, in Phase 2, the last backup. A setup checklist shows until it is complete (Phase 2), and there is a My work tab. | Dashboard · Today · Villas · Work: Tasks · Planning · Daily & diary · Blockers · Snags · Needs Attention · Teams: Contractors · Meetings · Setup: Projects & settings · Catalogues · Users & access · Import & history · Data (migrations, backups, errors) · AI settings · Help |

## 6. Milestones

| Milestone | Items | Outcome |
| --- | --- | --- |
| Rule | | The 27 MVP items are the go-live must-haves for the Imagine finishing works and the real import. Everything else waits until the 5 staff report daily. The Fix-now items block inviting staff. |
| M0a Stop the damage (week 1) | X-01, X-02, X-03, X-08, R-08 | Staff can be invited and see every record. Edits and reports never overwrite newer data. AI runs behind a provider switch. New code goes through the data adapter from day one. |
| M0b Honest numbers and a safety net (week 2) | X-04, X-05, X-06, X-07, U-01, O-01 | Nothing is cut short silently, no screen hangs, counts agree across boards, statuses are defined once, and every bug has a regression test. |
| M1 People, calendar and a clean import (weeks 3-4) | S-01, T-01, L-01, L-08, P-01, I-01, I-02, and start the D-01 daily snapshot | The full Imagine A and B work lists and drawing set are loaded to villa, floor and room, work is assigned to real users, health is measured in working days, and any import can be undone. |
| M2 Field experience (weeks 4-6) | N-01, N-02, F-01, F-02 | Engineers start from Today, log an update in about 4 taps with compressed photos and Undo, and raise blockers with an owner (including the villa owner) and a due date. |
| M3 Management clarity and go-live (weeks 6-8) | D-01, D-02, D-03, D-08, O-02 | Management sees health, handed-over villas with open works and each villa's forecast completion on one screen. A pending-works statement per villa is ready for owner conversations. Go live after user testing with zero critical Needs Attention items. |
| M4 Phase 2a: daily-use polish while the Supabase build runs (weeks 8-12) | N-03, N-04, F-03, F-04, F-05, L-02, L-04, U-02, U-03, U-04, R-01, R-02, C-01, D-04, D-05, K-05, P-09, Q-08, I-03, R-09 | Shared scope and URL filters, Villa Day Sheet, site diary, owner access visits and owner sign-off, villa health list, sharing from every board. Base44-only features freeze from here. |
| M5 Supabase cutover (about week 12) | R-10 | Rehearsed one-weekend move, checked figure by figure. Base44 is left read-only. |
| M6 Phase 2b: planning and quality on Supabase (weeks 12-15) | R-03, R-04, P-02, P-03, P-04, P-07, T-02, T-03, T-04, Q-01, Q-02, Q-03, Q-04, L-03 | Conflict checks, one scheduler on Supabase Cron, look-ahead with readiness lanes and constraints, dependency editor, snag register and workflow, task inspection with rework, drawing issue log. |
| M7 Phase 2c: collaboration, offline and trends (weeks 15-20) | N-05, F-06, F-07, T-05, T-07, P-05, P-06, Q-05, Q-06, Q-07, L-05, L-06, C-02, C-03, C-04, D-06, D-07, K-01, K-02, K-03, K-04, A-01, S-04, S-05, U-05, U-06, R-07, O-03, O-04 | Inbox and reminders, comments, an offline-capable app, trend charts, weekly owner report, PPC, checklists and handover pack. |
| M8 Future | F-08, T-06, P-08, L-07, C-05, A-02, S-02, S-03, S-06, R-05 | For Birdie Residences and beyond: timeline and critical path, pins on plans, QR codes, two-way WhatsApp, templates, live updates. |

## 7. If you only do ten things

| # | Id | Item | Phase |
| --- | --- | --- | --- |
| 1 | X-02 | Invites fail and new members cannot see older records | MVP |
| 2 | I-01 | Import review: map columns, fix values in place, apply a fix to all rows | MVP |
| 3 | D-02 | Villa x discipline matrix with possession status and forecast completion | MVP |
| 4 | D-08 | Villa pending-works statement for owner and handover conversations | MVP |
| 5 | F-01 | One 'Log update' drawer replaces Quick update and Daily update | MVP |
| 6 | F-02 | Block and Unblock as one action, with an owner, a due date and Blocker-board actions | MVP |
| 7 | X-06 | Counts disagree between boards | MVP |
| 8 | L-01 | Floors, rooms and drawings usable from start to finish | MVP |
| 9 | P-09 | Owner access visits for handed-over villas | Phase 2 |
| 10 | N-02 | 'Today' home screen built around my work | MVP |

## 8. Register

Effort is a relative size (S, M, L), not an estimate in days. "Verified" means the problem was re-checked line by line against the code; "Partly" means claims that did not hold were removed.

### Fix now

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [X-01](#x-01) | Update dialogs and the task picker show the wrong task data (partly verified) | MVP | M | High | Done (d2cb2c5) |
| [X-02](#x-02) | Invites fail and new members cannot see older records (partly verified) | MVP | M | High | Done (d2cb2c5) |
| [X-03](#x-03) | Daily reports can move tasks backwards or wipe data (verified) | MVP | M | High | Done (d2cb2c5) |
| [X-04](#x-04) | Lists, boards and baselines are cut short without warning (partly verified) | MVP | L | High | Done (aa934a3) |
| [X-05](#x-05) | A failed load leaves the app spinning forever (verified) | MVP | M | High | Done (aa934a3) |
| [X-06](#x-06) | Counts disagree between boards (partly verified) | MVP | L | High | Done (aa934a3) |
| [X-07](#x-07) | Quality sweep: photos, drawings, snags, dates, copy and small UI defects (partly verified) | MVP | M | Medium | Done (fa95668) |
| [X-08](#x-08) | AI assistant cannot run and can leave proposals half applied (partly verified) | MVP | M | High | Done (d2cb2c5) |

### Navigation & home

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [N-01](#n-01) | Navigation by role in 5 sections, with a tab bar on phones | MVP | M | High | Done (7112616) |
| [N-02](#n-02) | 'Today' home screen built around my work | MVP | L | High | Done (7112616) |
| [N-03](#n-03) | Shared project/phase selection and a desktop top bar | Phase 2 | M | High | Done (bcc947a) |
| [N-04](#n-04) | Filters in the URL, preset views and Copy link | Phase 2 | M | High | Done (bcc947a) |
| [N-05](#n-05) | Command palette (Ctrl/Cmd+K) and keyboard shortcuts | Phase 2 | M | Medium | Open |

### Field capture

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [F-01](#f-01) | One 'Log update' drawer replaces Quick update and Daily update | MVP | L | High | Done (7112616) |
| [F-02](#f-02) | Block and Unblock as one action, with an owner, a due date and Blocker-board actions | MVP | M | High | Done (7112616, 699ca9d) |
| [F-03](#f-03) | Daily site diary: headcount per contractor, weather, deliveries and incidents | Phase 2 | M | High | Done (3b9fae9) |
| [F-04](#f-04) | 'Save & next' and a Villa Day Sheet | Phase 2 | L | High | Done (4eb5d06) |
| [F-05](#f-05) | Photo captions, lightbox and markup | Phase 2 | M | Medium | Done (a3c0906) |
| [F-06](#f-06) | 'My day' summary and share | Phase 2 | S | Medium | Open |
| [F-07](#f-07) | Installable app with an offline read cache and an outbox | Phase 2 | L | High | Open |
| [F-08](#f-08) | QR codes on villa and room doors | Future | S | Medium | Open |

### Tasks & register

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [T-01](#t-01) | Assign work to real user accounts | MVP | M | High | Done (276bbbf) |
| [T-02](#t-02) | Task form: essentials first, details in sections, warnings while typing | Phase 2 | M | Medium | Open |
| [T-03](#t-03) | Task page organised around the next action | Phase 2 | M | Medium | Open |
| [T-04](#t-04) | Dependency editor with a loop check and type-aware readiness | Phase 2 | M | High | Open |
| [T-05](#t-05) | Editable grid and bulk actions in the Task Register | Phase 2 | L | High | Open |
| [T-06](#t-06) | Standard task templates per villa type | Future | M | High | Open |
| [T-07](#t-07) | Four fixed automation rules | Phase 2 | M | Medium | Open |

### Planning & schedule

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [P-01](#p-01) | Schedule health, actual dates and categorised delay reasons | MVP | M | High | Done (2e2a8b8) |
| [P-02](#p-02) | Three-week look-ahead by start date, with readiness | Phase 2 | M | High | Open |
| [P-03](#p-03) | Board for client selections, owner access and materials | Phase 2 | M | High | Open |
| [P-04](#p-04) | Several constraints per task, hard or soft | Phase 2 | S | High | Open |
| [P-05](#p-05) | Weekly work plan and PPC per contractor | Phase 2 | M | High | Open |
| [P-06](#p-06) | Progress from steps, quantities and weights | Phase 2 | L | High | Open |
| [P-07](#p-07) | Villa milestone strip | Phase 2 | S | Medium | Open |
| [P-08](#p-08) | Villa timeline and critical path | Future | L | Medium | Open |
| [P-09](#p-09) | Owner access visits for handed-over villas | Phase 2 | M | High | Done (9c5d084) |

### Quality & snagging

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [Q-01](#q-01) | Snag register page | Phase 2 | M | High | Open |
| [Q-02](#q-02) | Snag workflow with rejection and photo evidence | Phase 2 | M | High | Open |
| [Q-03](#q-03) | Raise snags from anywhere, and a snag walk mode | Phase 2 | M | High | Open |
| [Q-04](#q-04) | Inspect a task: start inspection, approve, or reject for rework | Phase 2 | S | High | Open |
| [Q-05](#q-05) | Inspection checklists and hold points | Phase 2 | L | High | Open |
| [Q-06](#q-06) | Snag types: quality, safety, housekeeping and owner-reported | Phase 2 | S | High | Open |
| [Q-07](#q-07) | Handover readiness, handover checklist and pack | Phase 2 | M | Medium | Open |
| [Q-08](#q-08) | Owner sign-off for works closed after possession | Phase 2 | S | Medium | Done (f36c34c) |

### Drawings & locations

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [L-01](#l-01) | Floors, rooms and drawings usable from start to finish | MVP | M | High | Done (276bbbf) |
| [L-02](#l-02) | One page per location, with tabs and breadcrumbs | Phase 2 | M | High | Done (2ac874e) |
| [L-03](#l-03) | Drawing register: current revision, who received it, linked tasks | Phase 2 | M | High | Open |
| [L-04](#l-04) | Villa list with health at a glance and plot-ref search | Phase 2 | M | High | Done (e3264f7) |
| [L-05](#l-05) | Document register for permits, test certificates, warranties and manuals | Phase 2 | S | Medium | Open |
| [L-06](#l-06) | Villa photo timeline with before/after comparison | Phase 2 | M | Medium | Open |
| [L-07](#l-07) | Pins on plans | Future | L | Medium | Open |
| [L-08](#l-08) | Bulk drawing intake for the Imagine drawing set | MVP | M | High | Done (4ded95c) |

### Contractors & meetings

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [C-01](#c-01) | Commitments followed up everywhere | Phase 2 | S | High | Done (be655c9) |
| [C-02](#c-02) | Connected contractor pages | Phase 2 | S | Medium | Open |
| [C-03](#c-03) | Meeting record with fast entry of many commitments | Phase 2 | M | High | Open |
| [C-04](#c-04) | Contractor scorecard and headcount trend | Phase 2 | M | High | Open |
| [C-05](#c-05) | Commitments proposed from pasted meeting minutes | Future | M | Medium | Open |

### Dashboards & reporting

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [D-01](#d-01) | Owner dashboard: four headline numbers, a phase health strip and daily snapshots | MVP | M | High | Done (58ad626, d22417f) |
| [D-02](#d-02) | Villa x discipline matrix with possession status and forecast completion | MVP | M | High | Done (d22417f) |
| [D-03](#d-03) | Needs Attention you can act on | MVP | M | High | Done (9245eec) |
| [D-04](#d-04) | Share and export from every board | Phase 2 | M | High | Done (602d31c) |
| [D-05](#d-05) | Report coverage grid and team view | Phase 2 | S | High | Done (737c103) |
| [D-06](#d-06) | Trend charts: S-curve, burn-up, overdue and headcount trends | Phase 2 | M | High | Open |
| [D-07](#d-07) | Weekly owner report | Phase 2 | M | High | Open |
| [D-08](#d-08) | Villa pending-works statement for owner and handover conversations | MVP | S | High | Done (d22417f) |

### Notifications & collaboration

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [K-01](#k-01) | In-app inbox with notifications | Phase 2 | M | High | Open |
| [K-02](#k-02) | Reminders and digests on phones | Phase 2 | M | High | Open |
| [K-03](#k-03) | Comments with @mentions and 'Seen' | Phase 2 | M | High | Open |
| [K-04](#k-04) | One activity timeline, a full change trail and a project feed | Phase 2 | M | Medium | Open |
| [K-05](#k-05) | One-tap call or WhatsApp to any contractor, person or owner | Phase 2 | S | High | Done (602d31c) |

### AI assistant

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [A-01](#a-01) | One 'Tell DVG' box that understands photos and several tasks | Phase 2 | M | High | Open |
| [A-02](#a-02) | WhatsApp in both directions | Future | L | Medium | Open |

### Import & data

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [I-01](#i-01) | Import review: map columns, fix values in place, apply a fix to all rows | MVP | M | High | Done (0ed07ca) |
| [I-02](#i-02) | Import history and one-click undo | MVP | M | High | Done (0ed07ca) |
| [I-03](#i-03) | Excel round trip for bulk edits | Phase 2 | S | High | Done (e7098ac) |

### Setup & admin

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [S-01](#s-01) | Project settings: working week, holidays, thresholds and site location | MVP | S | High | Done (276bbbf) |
| [S-02](#s-02) | First-run setup checklist with the DVG standard lists | Future | M | Medium | Open |
| [S-03](#s-03) | Add many villas at once | Future | S | Medium | Open |
| [S-04](#s-04) | Easier catalogue management | Phase 2 | S | Medium | Open |
| [S-05](#s-05) | Archive projects instead of deleting them | Phase 2 | S | Low | Open |
| [S-06](#s-06) | Project templates: copy a whole setup | Future | M | Medium | Open |

### Design system & UX polish

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [U-01](#u-01) | One status language, defined once | MVP | S | High | Done (aa934a3) |
| [U-02](#u-02) | Forms built for phones, with a toast and Undo on every save | Phase 2 | M | High | Done (787d03e) |
| [U-03](#u-03) | Searchable selects and one confirmation dialog | Phase 2 | S | Medium | Done (787d03e) |
| [U-04](#u-04) | Empty states that suggest the next step | Phase 2 | S | Medium | Done (95178da) |
| [U-05](#u-05) | High-contrast site mode and dark mode | Phase 2 | S | Low | Open |
| [U-06](#u-06) | Show only the actions each person can take | Phase 2 | S | Low | Open |

### Architecture & performance

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [R-01](#r-01) | TanStack Query for every read and write, with one invokeFn | Phase 2 | M | High | Partly (93ec269) |
| [R-02](#r-02) | Load pages on demand and remove unused packages | Phase 2 | S | Medium | Done (910e56f) |
| [R-03](#r-03) | Conflict checks and retry keys on writes | Phase 2 | M | High | Open |
| [R-04](#r-04) | One scheduler function with named steps | Phase 2 | M | High | Open |
| [R-05](#r-05) | Live updates with subscribe() | Future | S | Medium | Open |
| [R-07](#r-07) | One Attachment entity for photos and files | Phase 2 | M | Medium | Open |
| [R-08](#r-08) | Portability seam: one data adapter, pure rules in shared modules | MVP | S | High | Done (d2cb2c5) |
| [R-09](#r-09) | Supabase build alongside the live app, after a post-go-live decision gate | Phase 2 | L | High | Open |
| [R-10](#r-10) | Rehearsed data move and one-weekend cutover | Phase 2 | M | High | Open |

### Testing & ops

| Id | Item | Phase | Effort | Impact | Status |
| --- | --- | --- | --- | --- | --- |
| [O-01](#o-01) | Safety net: Vitest, CI and a dry-run migration runner | MVP | M | High | Done (aa934a3) |
| [O-02](#o-02) | Go-live kit: practice project, user testing, in-app Help and a go-live gate | MVP | M | High | Done (9245eec) |
| [O-03](#o-03) | Staging app and end-to-end smoke tests | Phase 2 | M | Medium | Open |
| [O-04](#o-04) | Weekly automatic backup | Phase 2 | S | Medium | Open |

## 9. Item detail

### Fix now

<a id="x-01"></a>
#### X-01 — Update dialogs and the task picker show the wrong task data

**MVP** · Effort M · Impact High · Partly verified in code

- **Problem:** QuickUpdateDialog (:13-20) and ForecastRevisionDialog (:14-15) set their useState once, while task is null. They are mounted all the time with a null task in TaskRegister:194, LocationDetail:216 and Planning:214 (the row is passed at Planning:87). So they open as 'Not Started' with a blank forecast and blank progress and remarks, and edits left from one task carry over to the next. Saving sends every field (QuickUpdateDialog:39-48). The server accepts a move to 'Not Started' (taskWriteRules.ts:82-112), clears the completion and approval stamps (:312-339) and clears the blocker (:164-177). Blank progress, remarks and latest update become null. If the task has a forecast, the client asks for a reason first, and the save then wipes the forecast too. On TaskDetail:293 the first open is correct, but the form never re-syncs. After a Daily update (TaskDetail:304-313) or archive/restore (:80-84), or after a cancelled edit, the next open shows stale values and the old date_revision_reason (QuickUpdateDialog:17). Planning rows carry forecast_finish (dashboardCore.ts:248), but the dialog reads current_forecast_finish (:14). TaskPickerDialog (:33-43) lists closed tasks and, when it is unscoped or set to site-wide (location_id null), villa-work parents, newest 50 only. Its unescaped $regex (:39-40) has no catch (:43-46), so input like '(' leaves the skeleton up until the text changes. TaskRegister:70-72 also passes unescaped text to $regex.
- **Recommendation:** Reset each form on open with the DailyUpdateDialog.jsx:65-70 pattern, extended to a useEffect on [open, task?.id, task?.updated_date] so TaskDetail picks up saves from other dialogs. Send only the fields the user changed, offer only legal next statuses, clear the previous revision reason, and read current_forecast_finish ?? forecast_finish ?? baseline_finish. In the picker, exclude Approved/Closed and is_villa_work_parent tasks. Escape user search text before $regex in TaskPickerDialog.jsx:39-40 and TaskRegister.jsx:70-72. Add a frontend escapeRegex helper in src/lib, since src does not import base44/shared today, and keep it the same as base44/shared/taskRef.ts:32. Resolve typed villa codes to location_id, and add a try/catch that clears loading and shows an error, plus 'Show more'. Add a regression test: opening and saving with no edits changes nothing.
- **Inspired by:** React reset-on-open form pattern; Linear issue picker (open items first, forgiving search)
- **Files:** `src/components/tasks/QuickUpdateDialog.jsx`, `src/components/planning/ForecastRevisionDialog.jsx`, `src/pages/TaskDetail.jsx`, `src/pages/TaskRegister.jsx`, `src/pages/LocationDetail.jsx`, `src/pages/Planning.jsx`, `src/components/daily/TaskPickerDialog.jsx`, `base44/shared/taskRef.ts`

<a id="x-02"></a>
#### X-02 — Invites fail and new members cannot see older records

**MVP** · Effort M · Impact High · Partly verified in code

- **Problem:** saveRecord MEMBERSHIP_ROLES (base44/functions/saveRecord/entry.ts:58) lacks 'Project Editor', the default role in both InviteUserDialog (src/components/access/InviteUserDialog.jsx:17,27) and MembershipDialog (:10,20). Every membership with that default role is therefore refused at saveRecord:178. In the invite flow the refusal comes after base44.users.inviteUser has already run in the browser (InviteUserDialog.jsx:43), so invited users end up with no project. syncProjectMemberIds mirrors member_ids onto only 10 entities (base44/shared/access.ts:114-125). It leaves out 9 entities whose read RLS depends on member_ids: VillaFloor, VillaArea, Drawing, MeetingCommitment, Snag, ImportBatch, RecordAudit, RefAllocation and AiProposal. It also returns early when Project.member_ids is unchanged (access.ts:112), so sync_all cannot backfill them. The browser reads floors, rooms and drawings directly under RLS (VillaScopePanel.jsx:30-31, DrawingRegister.jsx:31-32, AiAssistantPanel.jsx:34-35). Records created before someone joined stay invisible to that person until each one is edited again (saveRecord:166 re-stamps member_ids on write).
- **Recommendation:** Day-1 hotfix: add 'Project Editor' to MEMBERSHIP_ROLES. Then create the membership before sending the invite, check the role on update as well, and take roles from one list (U-01), replacing the copies in constants.js:50, saveRecord:58, access.ts ROLE_RANK and accessRules.js. Keep membership-scoped reads. They match the planned Supabase policy (a project_memberships join and one RLS rule) and keep Birdie separate, so do not rewrite Base44 RLS now. Fix the mirror instead: add the 8 missing entities (VillaFloor, VillaArea, Drawing, AiProposal and the other 4) to syncProjectMemberIds, pass force:true on sync_all, loop until has_more is false, and backfill with the O-01 runner. member_ids is deleted at cutover (R-10). Migrate legacy roles to Project Editor or Viewer and cut the enum to Admin / Project Editor / Viewer. In Access.jsx, hide edit controls from non-admins, show a toast when setActive fails, display the real role and allow changing the role on an existing membership.
- **Inspired by:** Linear/Notion one-step invite with the role chosen inline; Supabase RLS
- **Portability:** Uses Base44 RLS with a member_ids mirror. Fix the mirror only; the Supabase project_memberships join plus one RLS policy replaces it at cutover (R-09/R-10).
- **Files:** `base44/functions/saveRecord/entry.ts`, `src/components/access/InviteUserDialog.jsx`, `src/pages/Access.jsx`, `src/components/access/MembershipList.jsx`, `base44/shared/access.ts`, `base44/entities/ProjectMembership.jsonc`, `src/lib/accessRules.js`, `base44/entities/VillaFloor.jsonc`, `base44/entities/VillaArea.jsonc`, `base44/entities/Drawing.jsonc`, `base44/entities/AiProposal.jsonc`

<a id="x-03"></a>
#### X-03 — Daily reports can move tasks backwards or wipe data

**MVP** · Effort M · Impact High · Verified in code

- **Problem:** dailyUpdate applies status, progress and forecast from every report whatever its update_date. update_date (entry.ts:68) is only stored on the report and the history row; it is never compared before the changes are built (:118-127). It accepts future dates (:40, :68; the dialog date input has no max, DailyUpdateDialog.jsx:143). It accepts reports on archived tasks and villa-work parents (:56-65 check only existence and role). It copies 'done today' over the planner's remarks (:122). It silently drops photos after the 10th (:115; the uploader has no overall cap, PhotoUploader.jsx:30). It writes the report before the task (:159, :212). A blocker logged while the status stays In Progress gets no blocked_since (taskWriteRules.ts:164-166), and on a previously Blocked task that blocker is wiped instead (:169-177). Ticking 'Clear the blocker' while the status stays Blocked, which is the form's default (DailyUpdateDialog.jsx:25), throws an error (taskWriteRules.ts:183).
- **Recommendation:** Reject future IST dates and dates older than backdate_limit_days (S-01, default 7). Store Task.latest_report_date and apply field changes only when update_date is on or after it; save older reports as history and tell the user. Refuse reports on archived and parent tasks, write 'done today' only to latest_update and the report, return an error above 10 photos, and write the task before the report. In blockedStateFor, a blocker category implies Blocked plus blocked_since, and leaving Blocked requires a next status and clears the blocker fields; remove the checkbox. Backfill latest_report_date with the O-01 runner.
- **Inspired by:** Procore/Raken Daily Log: a dated entry never overwrites newer state
- **Files:** `base44/functions/dailyUpdate/entry.ts`, `base44/entities/Task.jsonc`, `base44/shared/taskWriteRules.ts`, `src/components/daily/DailyUpdateDialog.jsx`

<a id="x-04"></a>
#### X-04 — Lists, boards and baselines are cut short without warning

**MVP** · Effort L · Impact High · Partly verified in code

- **Problem:** Server reads stop at fixed caps and say nothing when they do. Tasks follow the cursor but stop at 2000 (projectData.ts:15-17, 77-87). Daily reports are a single page of 600, sorted newest first with no date filter, shared across every in-scope project (projectData.ts:18, 91). That means the contractor board's reports_7d and manpower_7d (dashboardViews.ts:252-259) and staleness checks can be incomplete. Snags and commitments are capped at 500 each (projectData.ts:97, 100). The attention view caps rooms at 500 and floors at 300 (dashboardData/entry.ts:96-97). activeMembers caps at 200 (access.ts:81), and that list feeds the member_ids mirror (access.ts:107). The Handover board shows only the first 200 snags (dashboardBoards.ts:312).

The browser has the same problem. LocationDetail loads 200 tasks (LocationDetail.jsx:50) and labels them as the full count (:125). CatalogContext loads 1000 locations (CatalogContext.jsx:33), TaskHistoryPanel 200 rows (TaskHistoryPanel.jsx:46), ContractorDetail 100 tasks (ContractorDetail.jsx:34) and DailyActivity 200 updates per day (DailyActivity.jsx:56). ContractorDetail and DailyActivity do show the true count as a stat, but never say the list is partial. Drill-downs stop at 40 rows (dashboardData/entry.ts:55, 127); they do show 'first N of total' (TaskDrilldownDialog.jsx:51-53), but that total comes from the 2000-capped task set.

Baselines have the same limit. baselineAction snapshots at most 500 tasks (baselineAction/entry.ts:18). Approval then runs about 500 sequential getOne reads and about 500 sequential Task.update writes (:181-199). Its rollback (:201-215) runs only on a thrown error, so a platform timeout partway through leaves tasks partly re-baselined.
- **Recommendation:** Add readAll(entity, query, {max, fields, sort}) to shared/records.ts, generalising the cursor loop that already exists for tasks in projectData.ts:77-87. It follows next_cursor at 5,000 rows per page and returns {items, truncated}. Use it in projectData, baselineAction, access (activeMembers) and dashboardData. Filter reports by date window on the server, and return meta {truncated, total} using entity.count(). Turn the existing 'first N of total' notice in TaskDrilldownDialog into a shared TruncationBanner with 'Load all / Open in Task Register'. Use it on ContractorDetail, DailyActivity and LocationDetail, which today show counts or rows but never say the list is partial. Page the villa task list with TaskRegister's cursor pattern. Approve baselines with bulkUpdate in chunks instead of a per-task getOne + update loop, and record progress on BaselineVersion so a failed or timed-out approval can resume. Refuse approval when the task count differs from the snapshot.
- **Inspired by:** Stripe auto-pagination; P6 all-or-nothing baseline copy; Linear explicit counts
- **Portability:** readAll follows Base44 cursor pages. Put it in the R-08 adapter; on Postgres it becomes a plain ranged select with no caps.
- **Files:** `base44/shared/records.ts`, `base44/shared/projectData.ts`, `base44/shared/access.ts`, `base44/functions/baselineAction/entry.ts`, `base44/functions/dashboardData/entry.ts`, `base44/shared/dashboardBoards.ts`, `src/components/dashboard/TaskDrilldownDialog.jsx`, `src/components/common/TruncationBanner.jsx`, `src/pages/LocationDetail.jsx`, `src/lib/CatalogContext.jsx`, `src/components/tasks/TaskHistoryPanel.jsx`, `src/pages/ContractorDetail.jsx`

<a id="x-05"></a>
#### X-05 — A failed load leaves the app spinning forever

**MVP** · Effort M · Impact High · Verified in code

- **Problem:** CatalogContext.jsx:28-55 runs 7 entity queries in a Promise.all (:29-38) with no catch. If the first load fails, setLoading(false) at :54 never runs, and every page that gates on cat.loading stays on a skeleton for good. That is nearly every route, for example Dashboard.jsx:75, Planning.jsx:92 and TaskDetail.jsx:59, though the sidebar still renders. The following loads have no catch either, so their loading flag never clears on failure: TaskRegister (:80-101, and loadMore :103-114), Locations (:33-46), LocationDetail (:45-54), Access (:31-40), ContractorDetail (:29-40), DailyActivity (:49-72), TaskPickerDialog (:31-47) and DailyUpdateFeed (:29-37, and loadMore :43-56). There is no error boundary in App.jsx and no window.onerror or unhandledrejection handler. AccessContext sets failed:true (:28) but nothing reads it. A failed access load leaves rankFor at -1, so can() is false everywhere and edit controls disappear without explanation.
- **Recommendation:** Add a shared `<DataState loading error empty onRetry>` with skeleton rows and use it for each of these loads. Wrap routes in an ErrorBoundary that offers Reload and 'Report a problem', and write a ClientError row (message, stack, URL, project, user) from the boundary and from window.onerror. Show an 'Access could not be loaded, Retry' banner in AppLayout. Each server function logs one JSON line per call {fn, user, ms, error} to Base44 app logs.
- **Inspired by:** Linear/Notion error states with retry; in-app error capture instead of an outside vendor
- **Portability:** Uses Base44 app logs. Log one JSON line through a logger in the adapter so the same line lands in Supabase function logs; the ClientError table is portable.
- **Files:** `src/lib/CatalogContext.jsx`, `src/pages/TaskRegister.jsx`, `src/pages/Locations.jsx`, `src/pages/LocationDetail.jsx`, `src/pages/Access.jsx`, `src/pages/ContractorDetail.jsx`, `src/pages/DailyActivity.jsx`, `src/components/daily/TaskPickerDialog.jsx`, `src/components/daily/DailyUpdateFeed.jsx`, `src/lib/AccessContext.jsx`, `src/App.jsx`, `src/components/common/DataState.jsx`, `base44/entities/ClientError.jsonc`

<a id="x-06"></a>
#### X-06 — Counts disagree between boards

**MVP** · Effort L · Impact High · Partly verified in code

- **Problem:** The meaning of "blocked" differs between views. isBlocked/statusCounts count status 'Blocked' only (dashboardCore.ts:53, :132). lifecycleOf (attention.ts:36), the blockerBoardView rows (dashboardBoards.ts:72) and meetingReportView counts.blocked (dashboardBoards.ts:221) also count a recorded blocker_description. As a result, the Villa page's 'Blocked' tile (dashboardViews.ts:197) disagrees with its 'Open blockers' list (:201), and the Contractor board's 'Blocked' (dashboardViews.ts:279) disagrees with the Meeting report's blockers count. planningView (dashboardViews.ts:321) and contractorBoardView (:240) read options.locations, which dashboardData never sets (options at entry.ts:48-56; locations passed only in `common`, entry.ts:72). Planning therefore never leaves out on-hold villa work and always reports held_work_excluded 0, and the Contractor board's on_hold_tasks is always 0. attentionFor counts demo tasks (attention.ts:133-134). Planning drops outstanding tasks in Execution Complete, Under Inspection or Approved whose finish date has passed: they fall into no bucket (dashboardViews.ts:345-351). readinessOf treats an Approved predecessor as still open (attention.ts:80), though it treats an Approved task itself as done (:62). The Blocker board always shows 'Expected resolution: Not stated' (BlockerTable.jsx:55, :87) because needsFor() loads no reports for the blockers view (entry.ts:23-28), so latestReportFor is null (dashboardBoards.ts:75-77). The Meetings date picker is ignored: Meetings.jsx:53 sends meetingDate, but entry.ts reads only `date` (:40) and never copies meetingDate into options (:48-56). Needs Attention asks for 300 items (NeedsAttention.jsx:52) but gets at most 200 (entry.ts:55), sorted by severity and then code (attention.ts:260-264, :297). It filters by code in the browser (NeedsAttention.jsx:71), so issue codes late in that order show empty or partial lists.
- **Recommendation:** Define isBlocked and one exclusion filter (archived, villa-work parent, demo, on hold) once in dashboardCore and use them in every view, including attentionFor and meetingReportView. Pass locations correctly and add a 'Verification pending' bucket. Pass the raw task to isUnscheduled, show the baseline date when there is no forecast, give the dependency chain root its id and draw chains as a tree. Add 'blockers' and 'meeting' to needsFor.updates and take the expected date from the latest blocker report since blocked_since. Pass options.meetingDate and echo it in the scope. Filter and page Needs Attention by issue code on the server, sorted by severity then age, with counts.total in titles. Count Approved and Closed tasks as done for readiness and as 100% in measured completion, and show '% of tasks measured'. Rename the as-at picker 'Measure overdue against'. Add a test that bucket totals equal the open count on every board.
- **Inspired by:** One shared metric layer (dbt/Looker semantic layer)
- **Files:** `base44/shared/dashboardCore.ts`, `base44/shared/dashboardViews.ts`, `base44/shared/dashboardBoards.ts`, `base44/shared/attention.ts`, `base44/functions/dashboardData/entry.ts`, `src/pages/NeedsAttention.jsx`, `src/pages/Meetings.jsx`, `src/pages/Dashboard.jsx`, `src/components/dashboard/PriorityList.jsx`, `src/components/blockers/DependencyChain.jsx`

<a id="x-07"></a>
#### X-07 — Quality sweep: photos, drawings, snags, dates, copy and small UI defects

**MVP** · Effort M · Impact Medium · Partly verified in code

- **Problem:** PhotoStrip (src/components/daily/PhotoStrip.jsx:28) signs only the first 6 of up to 10 photos (dailyUpdate/entry.ts:33), while its button still shows the full count. Drawings likely fail to open on iPhone because openFile calls window.open after an await (DrawingRegister.jsx:70-71). On the Handover board, snags sort Closed above Open because status is sorted alphabetically (dashboardBoards.ts:311). SnagList shows 'Contractor assigned' instead of the name (SnagList.jsx:39). SnagDialog keeps the last draft after Cancel because it resets only on save (SnagDialog.jsx:51-52). Snags are read-only on the villa page (VillaExecution.jsx:227 passes no canEdit). 'Today' is computed in UTC in CommitmentList.jsx:17, DrawingDialog.jsx:50 and saveRecord/entry.ts:192 (the meeting_date default). ProjectDetail.jsx:215 ('Villa A-04 is on hold') and Locations.jsx:58 ('Imagine Villas · Birdie Residences') hard-code demo text. 'Project Manager' appears in the UI and in server errors (taskWriteRules.ts:214, 217). ContractorDetail.jsx:32/92 counts closed tasks as Active, and phone cards drop rowAction (ActivityRows.jsx:69). Login shows you@example.com (Login.jsx:90). For admins, the 404 page says the AI hasn't implemented the page (PageNotFound.jsx:52). The not-registered screen has no sign-out, and the favicon is Base44's (index.html:5).
- **Recommendation:** Sign every photo lazily with a running '6/10' counter. Disable the pickers at 10; PhotoUploader caps each pick at 6 but has no cap on the total. Open drawings through an `<a href>` with a pre-signed URL. Sort snags by status order then age, show contractor names and thumbnails, reset SnagDialog on open, and pass canEdit/onAdvance on the villa page. Use todayIst() everywhere: src/lib/format.js on the client, base44/shared/dashboardCore.ts on the server. Add a lint rule against new Date().toISOString().slice(0,10). Build on-hold notes from Location (add on_hold_reason and on_hold_since), say 'Project Editor', and filter status != Closed in ContractorDetail. Render rowAction on phone cards and sort the feed by update_date then reported_at. Brand the login screen, show the 404 inside the app layout without the Base44 admin note, add sign-out to the not-registered screen, turn off /register and use DVG icons. Optionally lower TOAST_REMOVE_DELAY so dismissed toasts leave memory sooner; this is housekeeping, not a visible fix.
- **Inspired by:** Linear-level polish and consistent timezone handling
- **Portability:** Photo and drawing links use CreateFileSignedUrl. Call the adapter's signedUrl; it maps to Supabase Storage signed URLs.
- **Files:** `src/components/daily/PhotoStrip.jsx`, `src/components/daily/PhotoUploader.jsx`, `src/components/drawings/DrawingRegister.jsx`, `base44/shared/dashboardBoards.ts`, `src/components/handover/SnagList.jsx`, `src/components/handover/SnagDialog.jsx`, `src/pages/VillaExecution.jsx`, `src/components/meetings/CommitmentList.jsx`, `src/components/drawings/DrawingDialog.jsx`, `base44/functions/saveRecord/entry.ts`, `base44/shared/taskWriteRules.ts`, `src/pages/ProjectDetail.jsx`, `src/pages/Locations.jsx`, `src/pages/ContractorDetail.jsx`, `src/components/common/ActivityRows.jsx`, `src/components/daily/DailyUpdateFeed.jsx`, `src/components/meetings/MeetingReportView.jsx`, `src/components/ui/use-toast.jsx`, `src/pages/Login.jsx`, `src/lib/PageNotFound.jsx`, `src/App.jsx`, `index.html`

<a id="x-08"></a>
#### X-08 — AI assistant cannot run and can leave proposals half applied

**MVP** · Effort M · Impact High · Partly verified in code

- **Problem:** The model provider is OpenAI only: base44/shared/ai.ts:90 calls api.openai.com, and that is used by aiAction/entry.ts:424, :558, :632 and shared/reconcileAi.ts:102. The account has no credits (docs/PHASE1_FINAL_REPORT.md:62-64, :25), so every model call gets a 429. ask, daily_brief and meeting_brief fail with that provider error (entry.ts:641-643). parse_update and assist quietly fall back to the rule-based reading (entry.ts:583-597, :448-451), and assist then stops calling the provider for 30 minutes (entry.ts:52-60). No model-backed answer is ever produced.

AiUpdatePanel.jsx:37-38 has three gaps. It sets task_id to '' even though the server returns the matched candidate's task_id (ai.ts:410), so the task has to be picked again. It defaults status to 'In Progress' when the proposal has none. It collects a forecast-change reason (:186-188) but never sends it, and it has no forecast date input (payload at :77-89).

Proposals are applied in the browser (AiAssistantPanel.jsx:83 calls src/lib/assistApply.js:12-46). Closing the tab, or a failed assist_finish call after assist_confirm set 'Applying' (aiAction/entry.ts:338-343), leaves the proposal stuck in Applying. aiAction/entry.ts:288 treats Applying as final, so it cannot be re-confirmed, and assist_cancel only cancels Proposed (:257). The assist_finish branch (entry.ts:261-285) never checks the current status and trusts the results the client sends, so it can overwrite an Applied proposal.
- **Recommendation:** Put one provider interface in ai.ts, complete({system, messages, schema, files}), with two providers. 'fetch' uses an OpenAI- or Anthropic-compatible key over plain fetch; it is the portable default and moves unchanged into a Supabase Edge Function. 'base44' uses Core.InvokeLLM with response_json_schema and needs no key; use it only while the app is on Base44 and no funded key exists. Keep the rule-based fallback and log usage in AiUsage for every provider. Pre-select the top candidate's task_id, default status to the task's current status, add a forecast date input, send the reason and use the discipline select for trade. Apply actions on the server: aiAction invokes dailyUpdate, taskWrite, snagWrite or saveRecord with the user-scoped client and stores each result in AiProposal.results under `${external_id}:${index}`. Re-confirming resumes only the actions not yet written, and assist_finish is refused once a proposal is Applied.
- **Inspired by:** Base44 built-in integrations; Todoist Quick Add confirmation; Stripe idempotency keys and resumable jobs
- **Portability:** Uses Core.InvokeLLM. Put it behind the ai.ts provider interface as an interim provider; the plain-fetch provider is the portable default for Edge Functions.
- **Files:** `base44/shared/ai.ts`, `base44/functions/aiAction/entry.ts`, `base44/entities/AiSettings.jsonc`, `src/components/admin/AiSettingsTab.jsx`, `src/components/ai/AiUpdatePanel.jsx`, `src/lib/assistApply.js`, `base44/shared/assist.ts`

### Navigation & home

<a id="n-01"></a>
#### N-01 — Navigation by role in 5 sections, with a tab bar on phones

**MVP** · Effort M · Impact High

- **Problem:** NAV_ITEMS (constants.js:54-72) is 17 items in 6 groups, the same for every role, and some items share an icon. On a phone the only control is a hamburger menu, although AppLayout.jsx:64 already leaves pb-20 space for a tab bar.
- **Recommendation:** Regroup into five sections. Home: Today, Dashboard, Villa matrix. Villas: with a Common areas filter replacing Site-wide. Work: Tasks, Planning, Daily activity, Blockers, Snags (which absorbs Handover), Needs Attention. Teams: Contractors with the board, Meetings. Setup (admin only): Projects, Catalogues, Users & access, Import & history, Data, AI settings. All 5 staff hold the same Project Editor level, so the menu differs only between admin and staff. Designation picks the default home (Today for site, MEP and procurement; Overview for management), and each user can switch it. Badge counts come from one pure countsView in dashboardViews over loadProjectData, not from count()/aggregate() calls. Add `<MobileTabBar>` below lg (Today, Villas, +, Snags, More); + opens Log update, Snag and Tell DVG, scoped to the villa or task on screen.
- **Inspired by:** Linear sidebar; Procore tool menu; Fieldwire/WhatsApp bottom tabs
- **Portability:** Badge counts would use count()/aggregate(). Use a pure countsView over loadProjectData instead (a SQL view later).
- **Files:** `src/lib/constants.js`, `src/components/layout/DesktopSidebar.jsx`, `src/components/layout/AppLayout.jsx`, `src/components/layout/MobileTabBar.jsx`, `base44/functions/dashboardData/entry.ts`

<a id="n-02"></a>
#### N-02 — 'Today' home screen built around my work

**MVP** · Effort L · Impact High

- **Problem:** Everyone lands on the executive Dashboard, and no page shows 'my work'. DailyUpdate.plan_tomorrow is recorded but never shown anywhere.
- **Recommendation:** Add Today.jsx, backed by a 'myWork' dashboardData view. It shows my villas (reported today or not); my tasks that are overdue, due within 7 days, blocked or stale (using stale_days and working days from S-01); today's plan from yesterday's plan_tomorrow; commitments due or missed (worked out on read: promised_date < todayIst() and still Open); snags to reinspect; and pending AI proposals. Each card has its own action. Staff land on Today, and coordinators and the admin get an 'All villas' toggle with today's report coverage. Until T-01 lands, match responsible_engineer and assigned_engineer to the user's full_name, ignoring case. Read data with useQuery under queries/keys.js.
- **Inspired by:** Asana My Tasks; Procore My Open Items; Linear My Issues
- **Files:** `src/pages/Today.jsx`, `base44/shared/dashboardViews.ts`, `base44/functions/dashboardData/entry.ts`, `src/lib/queries/keys.js`, `src/App.jsx`

<a id="n-03"></a>
#### N-03 — Shared project/phase selection and a desktop top bar

**Phase 2** · Effort M · Impact High

- **Problem:** 10 pages read ?project= once when they open, each falls back to cat.projects[0] on its own, and none writes the choice back (setSearchParams is used 0 times). There is no top bar on desktop.
- **Recommendation:** Add a ScopeProvider built on useSearchParams (?project=&phase=, falling back to localStorage) and use it on all 10 pages. Add a TopBar with the project/phase switcher, the search trigger (N-05), a '+ New' menu and the bell (K-01).
- **Inspired by:** Linear team switcher; GitHub keeps state in the URL
- **Files:** `src/lib/ScopeContext.jsx`, `src/components/layout/AppLayout.jsx`, `src/pages/Dashboard.jsx`, `src/pages/Planning.jsx`, `src/pages/BlockerBoard.jsx`, `src/pages/Handover.jsx`, `src/pages/Meetings.jsx`, `src/pages/NeedsAttention.jsx`, `src/pages/ContractorBoard.jsx`, `src/pages/AskDvgAi.jsx`, `src/pages/DailyActivity.jsx`, `src/pages/WorkImport.jsx`

<a id="n-04"></a>
#### N-04 — Filters in the URL, preset views and Copy link

**Phase 2** · Effort M · Impact High

- **Problem:** TaskRegister reads 6 filters from the URL when it opens (:30-35) and Locations reads project and phase, but no page writes filter changes back. Shared links go out of date, and filters reset when you navigate away.
- **Recommendation:** Write a useUrlFilters() hook on useSearchParams for Tasks, Planning, Blockers, Snags, Needs Attention and Daily. Add a Copy link button and sidebar presets: My work, Overdue, Blocked, Not updated in N working days, Ready for inspection.
- **Inspired by:** GitHub Issues query URLs; Linear views
- **Files:** `src/lib/useUrlFilters.js`, `src/components/tasks/TaskFilters.jsx`, `src/pages/TaskRegister.jsx`, `src/pages/Planning.jsx`, `src/pages/BlockerBoard.jsx`, `src/pages/NeedsAttention.jsx`, `src/pages/Locations.jsx`

<a id="n-05"></a>
#### N-05 — Command palette (Ctrl/Cmd+K) and keyboard shortcuts

**Phase 2** · Effort M · Impact Medium

- **Problem:** cmdk and ui/command are installed but unused. There is no global search, and finding a villa takes 4-7 taps.
- **Recommendation:** A Ctrl/Cmd+K palette (a search icon on phones) searches a client-side index of villas, task refs, contractors and drawing numbers. Plot-ref matching is forgiving, so 'b56' finds B-05-06. It also offers actions such as Log update, New snag and Go to Blockers. Add keys: C to create, G then T for Tasks, ? for help.
- **Inspired by:** Linear Cmd+K; Slack jump-to
- **Files:** `src/components/layout/CommandPalette.jsx`, `src/components/ui/command.jsx`

### Field capture

<a id="f-01"></a>
#### F-01 — One 'Log update' drawer replaces Quick update and Daily update

**MVP** · Effort L · Impact High

- **Problem:** Quick update calls taskWrite (taskService.js:29) and leaves no DailyUpdate row, yet it is the only inline action on TaskCard. The daily report takes about 12 taps, and its button sits below up to 200 task cards (LocationDetail.jsx:182). Full 4-12 MB photos upload one at a time (PhotoUploader.jsx:23-41), and a wrong report cannot be corrected.
- **Recommendation:** Build LogUpdateDrawer (vaul), opened from the tab bar +, the villa page, task cards and Today. Steps: villa chips (last 5 used, plus search) → open non-parent tasks, mine first → status chips limited to legal steps (taskRules.js), plus Execution complete and Blocked (which opens F-02) → progress chips 25/50/75/100 and +10% → floor/room (L-01) → photo → Save. It always goes through dailyUpdate, starts from the task's values and keeps an unsent draft in localStorage. Compress photos on the phone (about 1600px, JPEG 0.7, ~300 KB) and upload 3 at a time with progress. Add a dailyUpdate 'void' action (own report, same IST day, audit row kept), so the save toast offers Undo and the feed offers Correct.
- **Inspired by:** Things Quick Entry; Todoist Quick Add; Fieldwire/PlanRadar one-tap capture; Gmail undo
- **Portability:** Photos use UploadPrivateFile/CreateFileSignedUrl. Go through the adapter's uploadPrivate/signedUrl; maps to a private Supabase bucket.
- **Files:** `src/components/daily/LogUpdateDrawer.jsx`, `src/components/daily/DailyUpdateDialog.jsx`, `src/components/tasks/QuickUpdateDialog.jsx`, `src/components/tasks/TaskCard.jsx`, `src/pages/LocationDetail.jsx`, `src/components/daily/PhotoUploader.jsx`, `src/lib/taskRules.js`, `base44/functions/dailyUpdate/entry.ts`

<a id="f-02"></a>
#### F-02 — Block and Unblock as one action, with an owner, a due date and Blocker-board actions

**MVP** · Effort M · Impact High

- **Problem:** Raising a blocker takes about 9 taps across two controls. blocker_responsible_party is free text, and the expected date is stored only on DailyUpdate (dashboardBoards.ts:77). The Blocker board has no Resolve, owner or Chase actions.
- **Recommendation:** Add a TaskConstraint entity from the start: {task_id, category, description, owner_type (Contractor/DVG/Villa owner/Consultant/Authority), owner_id, due_date, status, cleared_at}. 'Owner Access Pending' and 'Client Selection Pending' default to Villa owner. The Block sheet creates one row and the server keeps Task's blocker fields in sync as a summary; Unblock asks for the next status and clears the row. P-04 later allows several constraints per task. On the Blocker board, group rows by owner (owner-access rows by villa), flag those past due_date, and add Resolve, Set owner/date and Chase. Chase opens a wa.me message with the task link, sent to Contractor.phone, to the member's phone from T-01, or to the villa owner's phone once P-09 adds it.
- **Inspired by:** Touchplan constraint log; Last Planner make-ready
- **Files:** `base44/entities/TaskConstraint.jsonc`, `base44/entities/Task.jsonc`, `base44/shared/taskWriteRules.ts`, `src/components/daily/BlockerSheet.jsx`, `src/pages/BlockerBoard.jsx`, `base44/shared/dashboardBoards.ts`

<a id="f-03"></a>
#### F-03 — Daily site diary: headcount per contractor, weather, deliveries and incidents

**Phase 2** · Effort M · Impact High

- **Problem:** Manpower is recorded only on per-task reports and then added up. dashboardViews.ts:286 itself says the result 'is not a headcount', because a crew reported on 3 tasks is counted 3 times. Nothing records weather, hours lost, deliveries, visitors or incidents.
- **Recommendation:** Add a SiteDiary entity: one row per project per IST date that any engineer can add to. It holds labour [{contractor_id, heads, villa_ids}], weather from Open-Meteo (using the S-01 site location) plus 'work stopped N h, reason', deliveries [{material, qty, task, challan photo}] that can set procurement_status to Delivered, visitors and inspections, incidents and near misses, and notes. The admin closes the day. Show it on Daily Activity. Dashboards, F-04, F-06, C-04 and D-07 read headcount from the diary, and task-level manpower becomes optional.
- **Inspired by:** Procore Daily Log; Raken daily report; Powerplay attendance and material inward
- **Files:** `base44/entities/SiteDiary.jsonc`, `src/components/daily/SiteDiaryForm.jsx`, `src/pages/DailyActivity.jsx`, `base44/shared/dashboardViews.ts`, `base44/functions/saveRecord/entry.ts`

<a id="f-04"></a>
#### F-04 — 'Save & next' and a Villa Day Sheet

**Phase 2** · Effort L · Impact High

- **Problem:** Updating 5 tasks in one villa repeats the whole flow, about 60 taps even with the drawer.
- **Recommendation:** 'Save & next' keeps the villa, date and photos and moves on to the next open task. A Villa Day Sheet lists the villa's open tasks with inline status and progress steppers and a 'done today' note, and writes contractor headcount once to that day's SiteDiary. It calls a dailyUpdate batch action that looks up rank, members and location once, takes up to 25 tasks, uses a client_ref per row and returns a result per row; task rows are saved without manpower.
- **Inspired by:** Procore Daily Log; Asana complete-and-next
- **Files:** `src/components/daily/LogUpdateDrawer.jsx`, `src/components/daily/VillaDaySheet.jsx`, `base44/functions/dailyUpdate/entry.ts`

<a id="f-05"></a>
#### F-05 — Photo captions, lightbox and markup

**Phase 2** · Effort M · Impact Medium

- **Problem:** Photos have no captions, the remove × is about 16px, and there is no full-screen viewer. A contractor who gets a photo on WhatsApp cannot tell which crack or socket is meant.
- **Recommendation:** Add captions, a swipeable PhotoLightbox and a canvas markup step (arrow, circle, freehand, short text). The marked-up copy becomes the main photo and the original is kept. Use it in SnagDialog, Log update and Snag walk.
- **Inspired by:** CompanyCam; PlanRadar/Fieldwire photo markup
- **Files:** `src/components/daily/PhotoUploader.jsx`, `src/components/daily/PhotoStrip.jsx`, `src/components/common/PhotoLightbox.jsx`, `src/components/common/PhotoMarkup.jsx`, `src/components/handover/SnagDialog.jsx`

<a id="f-06"></a>
#### F-06 — 'My day' summary and share

**Phase 2** · Effort S · Impact Medium

- **Problem:** At the end of the day an engineer cannot see or share what they reported or what they missed.
- **Recommendation:** A MyDay page lists tasks updated, blockers raised and cleared, photos, headcount and weather (read from the SiteDiary) and a 'not yet reported' list. It can be shared through navigator.share or wa.me, or printed to PDF.
- **Inspired by:** Raken daily report; Powerplay site feed
- **Files:** `src/pages/MyDay.jsx`, `base44/shared/dashboardViews.ts`

<a id="f-07"></a>
#### F-07 — Installable app with an offline read cache and an outbox

**Phase 2** · Effort L · Impact High

- **Problem:** index.html links /manifest.json, but there is no public/ folder, so it returns 404 and the app cannot be installed. With weak signal, an engineer has no data to report against and loses entries.
- **Recommendation:** Add vite-plugin-pwa with DVG icons and a cached app shell. Use persistQueryClient to keep the catalog, Today, my villas and their open tasks in IndexedDB, with an 'Offline, data from HH:MM' banner. Queue updates and compressed photos in an IndexedDB outbox (idb-keyval) keyed by client_ref (R-03), and retry when back online. Show a 'N pending sync' chip, with Retry on each item.
- **Inspired by:** Fieldwire/Raken offline mode; WhatsApp message ticks
- **Files:** `vite.config.js`, `index.html`, `public/manifest.webmanifest`, `src/lib/outbox.js`, `src/lib/query-client.js`

<a id="f-08"></a>
#### F-08 — QR codes on villa and room doors

**Future** · Effort S · Impact Medium

- **Problem:** Engineers still have to navigate to a villa before they can report.
- **Recommendation:** Print QR sheets per villa, floor and room from VillaScopePanel. Each code opens /log?location=&floor=&area= with the Log update drawer already filled in.
- **Inspired by:** PlanRadar / Fieldwire location QR codes
- **Files:** `src/components/villa/VillaScopePanel.jsx`

### Tasks & register

<a id="t-01"></a>
#### T-01 — Assign work to real user accounts

**MVP** · Effort M · Impact High

- **Problem:** responsible_engineer, assigned_engineer, MeetingCommitment.responsible_person and blocker owners are all free text. User.jsonc holds only role and designation, with no phone, and non-admins cannot list users, so My work, chasing and notifications are impossible.
- **Recommendation:** Add assignee_user_id and watcher_ids to Task, assigned_engineer_user_id to Location (new tasks inherit it) and responsible_user_id to MeetingCommitment. Build a UserPicker from active ProjectMembership rows (user_id, user_name, user_email), which members can already read. Add phone and initials to the membership, editable in Users & access. Map the old names to the 6 users with the O-01 runner, with a fix-up screen for names that don't match, and keep the old text as read-only history.
- **Inspired by:** Fieldwire single assignee; Procore ball-in-court
- **Files:** `base44/entities/Task.jsonc`, `base44/entities/Location.jsonc`, `base44/entities/MeetingCommitment.jsonc`, `base44/entities/ProjectMembership.jsonc`, `base44/functions/taskWrite/entry.ts`, `src/components/tasks/TaskFormFields.jsx`, `src/components/common/UserPicker.jsx`, `src/components/access/UsersPanel.jsx`

<a id="t-02"></a>
#### T-02 — Task form: essentials first, details in sections, warnings while typing

**Phase 2** · Effort M · Impact Medium

- **Problem:** TaskForm shows 13 essential fields and hides 27 more in one 'More details' block (TaskAdvancedFields.jsx). The essentials leave out floor/room and baseline dates, and data problems are caught only afterwards in Needs Attention.
- **Recommendation:** Essentials: villa, floor/room, discipline, work package, name, contractor (filled from ContractorDefault), assignee, and baseline and forecast dates. Group the rest into labelled sections: Quantities, Procurement (only when supplied_by is Client or Selection), Access, Blocker, Baseline control, and Import details (read-only). Validate with react-hook-form and zod using the enums.ts lists, and reuse the attention.ts checks as inline warnings (no contractor, baseline missing, forecast before start).
- **Inspired by:** Linear new issue (title plus property chips); Asana shows only fields with values
- **Files:** `src/components/tasks/TaskForm.jsx`, `src/components/tasks/TaskFormFields.jsx`, `src/components/tasks/TaskAdvancedFields.jsx`, `base44/shared/attention.ts`

<a id="t-03"></a>
#### T-03 — Task page organised around the next action

**Phase 2** · Effort M · Impact Medium

- **Problem:** On a phone, TaskDetail shows about 45 label rows, many of them '—', before the activity feed. Dependencies, constraints and commitments are not shown.
- **Recommendation:** Header: StatusPill, HealthBadge, the next action from actionFor, and buttons for Log update, Block, Revise forecast and Start inspection/Reject (Q-04). Tabs: Overview (filled-in fields only, plus 'Show all'), Activity, Scope, Dependencies & constraints, and Commitments.
- **Inspired by:** Linear issue view; Asana task pane
- **Files:** `src/pages/TaskDetail.jsx`

<a id="t-04"></a>
#### T-04 — Dependency editor with a loop check and type-aware readiness

**Phase 2** · Effort M · Impact High

- **Problem:** saveRecord already creates TaskDependency with duplicate and self-link checks, but only the AI path uses it (assistApply.js:30). There is no UI and no loop check, and readinessOf ignores link type and lag.
- **Recommendation:** Add a 'Depends on' section to TaskDetail: pick a task, choose FS, SS or FF and a lag in working days. The server rejects any link that would create a loop. Readiness treats FS as met from Execution Complete and SS from In Progress, plus the lag.
- **Inspired by:** MS Project/P6 links; Linear blocking relations
- **Files:** `base44/functions/saveRecord/entry.ts`, `base44/shared/attention.ts`, `src/pages/TaskDetail.jsx`

<a id="t-05"></a>
#### T-05 — Editable grid and bulk actions in the Task Register

**Phase 2** · Effort L · Impact High

- **Problem:** Office staff edit tasks one at a time through the full form, and the register has no multi-select.
- **Recommendation:** On desktop, make TaskTable an inline grid for status, progress, forecast, contractor and assignee, with arrow-key movement. Selecting rows opens a bulk bar for contractor, assignee, status or forecast. A bulk forecast change asks for one reason category and uses a taskWrite batch action. Phones keep cards.
- **Inspired by:** Airtable / Google Sheets; Monday bulk action bar
- **Files:** `src/components/tasks/TaskTable.jsx`, `base44/functions/taskWrite/entry.ts`

<a id="t-06"></a>
#### T-06 — Standard task templates per villa type

**Future** · Effort M · Impact High

- **Problem:** Each villa's standard task set has to be imported or typed by hand. villaWorkCreate creates only villa-work parents and children.
- **Recommendation:** Add a TaskTemplate entity (villa_type, discipline, work package, name, default duration, contractor, order, dependencies). 'Apply template' on one or many villas creates the tasks and links, and running it twice creates no duplicates (template_key per villa).
- **Inspired by:** Fieldwire task templates; Smartsheet row templates
- **Files:** `base44/entities/TaskTemplate.jsonc`, `base44/functions/villaWorkCreate/entry.ts`

<a id="t-07"></a>
#### T-07 — Four fixed automation rules

**Phase 2** · Effort M · Impact Medium

- **Problem:** Routine follow-ups, such as closing parent tasks and escalating long blocks, depend on someone remembering.
- **Recommendation:** Four built-in rules, each switchable in Admin: all villa-work children Closed → close the parent; 100% → prompt Execution Complete; Execution Complete → notify the verifier; Blocked for more than 3 working days → escalate to the admin. They run in the shared write rules and as a step of the R-04 scheduler. Missed commitments are handled in C-01.
- **Inspired by:** Monday/Asana 'when X, then Y' rules
- **Portability:** Rules inside shared write rules are portable; the escalation step needs a scheduler, so it lands after the move as an R-04 step.
- **Files:** `base44/shared/taskWriteRules.ts`, `base44/functions/scheduler/entry.ts`, `src/pages/Admin.jsx`

### Planning & schedule

<a id="p-01"></a>
#### P-01 — Schedule health, actual dates and categorised delay reasons

**MVP** · Effort M · Impact High

- **Problem:** Nothing compares forecast with baseline ('slip' and 'variance' appear nowhere in the code), and work about to be late is not shown. actual_start and actual_finish are never set, and date_revision_reason is free text, so delay causes cannot be counted or ranked.
- **Recommendation:** Compute slip_days and health in dashboardCore. Late means overdue. At risk means due within at_risk_window_days with no update in stale_days, a predecessor still open, or blocked near the due date, all in working days (S-01). Show a HealthBadge on every row and an At risk bucket. In deriveTaskEffects, set actual_start on the first move to In Progress and actual_finish on Execution Complete, clearing it if the task is reopened. Make date_revision_category required on every forecast path (Drawing/design, Material, Labour, Predecessor, Client decision, Weather, Access, Rework, Other) and add a delay-cause Pareto chart. Backfill actual dates from TaskHistory and categories by keyword with the O-01 runner.
- **Inspired by:** Smartsheet RAG health; P6 variance and actual dates; Last Planner reasons for missed work
- **Files:** `base44/shared/dashboardCore.ts`, `base44/shared/dashboardViews.ts`, `base44/shared/taskWriteRules.ts`, `base44/entities/Task.jsonc`, `src/components/planning/ForecastRevisionDialog.jsx`, `src/components/common/HealthBadge.jsx`

<a id="p-02"></a>
#### P-02 — Three-week look-ahead by start date, with readiness

**Phase 2** · Effort M · Impact High

- **Problem:** planningView groups tasks by finish date only (dashboardViews.ts:320). The Ready/Waiting status that attention.ts already computes is not shown in Planning.
- **Recommendation:** Add a Look-ahead tab: tasks starting in the next 3 weeks, grouped by week and villa. Each row is marked Ready, Waiting or Unknown and lists its open constraints (TaskConstraint, predecessor, superseded drawing, readiness lanes from P-03). Filter by contractor for the Monday meeting.
- **Inspired by:** Touchplan / Last Planner look-ahead
- **Files:** `base44/shared/dashboardViews.ts`, `base44/shared/attention.ts`, `src/pages/Planning.jsx`

<a id="p-03"></a>
#### P-03 — Board for client selections, owner access and materials

**Phase 2** · Effort M · Impact High

- **Problem:** Task already stores supplied_by, selection_status, procurement_status, expected_delivery_date, owner_access_required and access_status. These are editable only under 'More details' and appear only as attention reasons (attention.ts:69-72). Location has no owner name or phone.
- **Recommendation:** Add a Readiness view with three lanes: Selections pending; Owner access, read from P-09 visits (Pending, Booked for a date, No-show); and Materials (To order, Ordered, Delivered). Each row shows a need-by date (baseline_start minus WorkPackage.lead_time_days) that turns red once passed, a one-tap chase (K-05, with owner contact from P-09) and bulk status changes. P-02 marks a task Waiting while any lane is open.
- **Inspired by:** Touchplan make-ready; Buildertrend selections; a light version of Procore's procurement log
- **Files:** `src/pages/Readiness.jsx`, `base44/shared/dashboardViews.ts`, `base44/shared/attention.ts`, `base44/entities/WorkPackage.jsonc`, `base44/entities/Location.jsonc`

<a id="p-04"></a>
#### P-04 — Several constraints per task, hard or soft

**Phase 2** · Effort S · Impact High

- **Problem:** Getting a task ready usually involves several constraints, such as a drawing, material, access and the previous trade, each with its own owner and date. F-02 records only one.
- **Recommendation:** Allow several TaskConstraint rows per task, each marked hard or soft. The task stays Blocked while any hard constraint is open, and the Look-ahead and Blocker board list every open constraint.
- **Inspired by:** Touchplan constraints
- **Files:** `base44/entities/TaskConstraint.jsonc`, `base44/shared/taskWriteRules.ts`, `base44/shared/attention.ts`

<a id="p-05"></a>
#### P-05 — Weekly work plan and PPC per contractor

**Phase 2** · Effort M · Impact High

- **Problem:** Commitments exist, but there is no weekly plan and no Percent Plan Complete (PPC, the share of weekly promises kept) to hold contractors to account.
- **Recommendation:** On Monday, pick ready tasks per contractor in the Look-ahead and press 'Commit week', which creates MeetingCommitments tagged week_of. On Saturday, mark each one kept or missed with a reason category. Show PPC per contractor and phase as a weekly trend.
- **Inspired by:** Last Planner System weekly plan and PPC; Linear cycles
- **Files:** `base44/entities/MeetingCommitment.jsonc`, `src/pages/Planning.jsx`, `base44/shared/dashboardBoards.ts`

<a id="p-06"></a>
#### P-06 — Progress from steps, quantities and weights

**Phase 2** · Effort L · Impact High

- **Problem:** Progress is a guessed percentage. planned_quantity and completed_quantity exist, but DailyUpdate has no quantity_done, and villa and phase percentages are not weighted.
- **Recommendation:** Add progress_method (Manual, Steps or Units) and steps [{name, weight}] to WorkPackage. Log update then shows step chips or a 'quantity done today' field, and DailyUpdate.quantity_done adds up into completed_quantity. Villa % = Σ(package weight × task %).
- **Inspired by:** P6 physical % complete and steps; Powerplay BOQ progress
- **Files:** `base44/entities/WorkPackage.jsonc`, `base44/entities/DailyUpdate.jsonc`, `base44/functions/dailyUpdate/entry.ts`, `base44/shared/dashboardCore.ts`

<a id="p-07"></a>
#### P-07 — Villa milestone strip

**Phase 2** · Effort S · Impact Medium

- **Problem:** A villa page does not show where the villa stands against its key stages (slab, plaster, MEP first fix, finishes, handover).
- **Recommendation:** Add is_milestone to WorkPackage and draw a milestone strip on the villa header with planned and forecast dates and slip per milestone. Reuse it in the weekly owner report.
- **Inspired by:** Smartsheet milestones; line-of-balance trackers
- **Files:** `base44/entities/WorkPackage.jsonc`, `base44/shared/dashboardViews.ts`, `src/pages/LocationDetail.jsx`

<a id="p-08"></a>
#### P-08 — Villa timeline and critical path

**Future** · Effort L · Impact Medium

- **Problem:** There is no visual schedule, no durations and no float.
- **Recommendation:** A read-only Gantt per villa or phase showing baseline and forecast bars with dependency arrows (frappe-gantt). Calculate float and the critical path from TaskDependency and the S-01 working calendar once durations exist.
- **Inspired by:** MS Project; Smartsheet Gantt; P6 critical path
- **Files:** `src/pages/Timeline.jsx`, `base44/shared/schedule.ts`

<a id="p-09"></a>
#### P-09 — Owner access visits for handed-over villas

**Phase 2** · Effort M · Impact High

- **Problem:** Work in handed-over villas waits on the owner letting DVG in. Task stores only owner_access_required and access_status (Pending / Confirmed / Denied), with no date, time window, owner contact or visit. As a result, several trades are booked separately, no-shows are not counted, and 'Owner Access Pending' blockers have no next step. Location has no owner name, phone or occupancy.
- **Recommendation:** Add owner_name, owner_phone, occupancy (Occupied / Vacant / Unknown) and access_notes (keys, security, allowed working hours) to Location. Add OwnerAccessVisit {location_id, date, window, status Requested/Confirmed/Done/No-show/Cancelled, task_ids, contractor_ids, requested_by, confirmed_via, notes}. 'Request access' on the villa page bundles the open tasks that need access into one wa.me message to the owner, listing the works, trades and estimated hours. Confirming a visit sets access_status Confirmed on the linked tasks and puts the visit date on their 'Owner Access Pending' constraints (F-02). Today and the look-ahead show entries such as 'Access booked Thu 10:00-17:00, B-05-06: painting, AC'. Marking a visit Done prompts a Log update for each linked task; a No-show returns the tasks to Owner Access Pending and adds to a count per villa. The Blocker board shows each villa's next booked visit next to its owner-access blockers.
- **Inspired by:** Field-service and housing-repair appointment booking (Jobber, ServiceTitan): one visit window covering several jobs, with confirmation and no-show tracking
- **Files:** `base44/entities/Location.jsonc`, `base44/entities/OwnerAccessVisit.jsonc`, `base44/shared/taskWriteRules.ts`, `base44/shared/dashboardViews.ts`, `src/components/villa/OwnerAccessSheet.jsx`, `src/pages/LocationDetail.jsx`, `src/pages/Today.jsx`, `src/pages/BlockerBoard.jsx`

### Quality & snagging

<a id="q-01"></a>
#### Q-01 — Snag register page

**Phase 2** · Effort M · Impact High

- **Problem:** Snags have no page of their own. They appear only on Handover (whole project, no villa filter, a 1000px-wide table at Handover.jsx:130 below 8 stacked tiles) and on villa dashboards.
- **Recommendation:** Add /snags, served from a dashboardData 'snags' view paged on the server, so every member sees every snag. Filters for villa, floor, contractor, kind, status and age are kept in the URL, open snags come first, and phones get cards. Use the D-04 ShareMenu with a contractor filter for per-contractor lists. Handover keeps only the readiness summary.
- **Inspired by:** Procore Punch List; PlanRadar lists per subcontractor
- **Files:** `src/pages/Snags.jsx`, `src/pages/Handover.jsx`, `src/components/handover/SnagList.jsx`, `base44/functions/dashboardData/entry.ts`

<a id="q-02"></a>
#### Q-02 — Snag workflow with rejection and photo evidence

**Phase 2** · Effort M · Impact High

- **Problem:** Snag.status has only Open, Awaiting Reinspection and Closed. Closing needs no evidence, and there is no step for a failed reinspection.
- **Recommendation:** Statuses become Open → Ready for Review → Closed, plus Rejected, which returns the snag to Open and increments rejection_count. An 'after' photo is required to reach Ready for Review, and the verifier closes the snag, not the person who fixed it. Every change is logged.
- **Inspired by:** Procore Punch (Work Required / Ready for Review / Closed); Fieldwire Completed → Verified
- **Files:** `base44/entities/Snag.jsonc`, `base44/functions/snagWrite/entry.ts`, `src/components/handover/SnagDialog.jsx`

<a id="q-03"></a>
#### Q-03 — Raise snags from anywhere, and a snag walk mode

**Phase 2** · Effort M · Impact High

- **Problem:** Raising a snag takes about 10 taps plus sideways scrolling, only from Handover, and with no floor or room picker.
- **Recommendation:** Add a Snag action to the villa page, task page, + menu and photo lightbox, using FloorRoomPicker (L-01). Snag Walk mode keeps villa, floor, room and contractor fixed and loops camera → title → save.
- **Inspired by:** PlanRadar; Fieldwire punch walk
- **Files:** `src/components/handover/SnagDialog.jsx`, `src/components/handover/SnagWalk.jsx`, `src/pages/LocationDetail.jsx`

<a id="q-04"></a>
#### Q-04 — Inspect a task: start inspection, approve, or reject for rework

**Phase 2** · Effort S · Impact High

- **Problem:** TaskApprovalActions offers only Mark execution complete, Approve and Close. Reopening work means editing the status by hand with no reason (taskWriteRules.ts:312), so rework is never recorded.
- **Recommendation:** Add 'Start inspection' and 'Reject' buttons. Reject asks for a category (Workmanship, Incomplete, Wrong material, Not to drawing, Other), a note and an optional photo, moves the task back to In Progress, increments rejection_count, stores last_rejection_reason and writes TaskHistory. Show a rework badge on cards and feed rework counts to C-04.
- **Inspired by:** Procore Inspections pass/fail; Fieldwire Verified/Rejected
- **Files:** `src/components/tasks/TaskApprovalActions.jsx`, `base44/shared/taskWriteRules.ts`, `base44/entities/Task.jsonc`

<a id="q-05"></a>
#### Q-05 — Inspection checklists and hold points

**Phase 2** · Effort L · Impact High

- **Problem:** acceptance_criterion is a single string, and moving from Under Inspection to Approved needs no evidence.
- **Recommendation:** Add a ChecklistTemplate per work package (Pass/Fail/N/A items, photo per item, hold_point flag) and a ChecklistRun on each task. Approval requires a passed run, and a failed item creates a linked Snag. Seed templates: conduit before plaster, plumbing pressure test, waterproofing ponding test, level check before tiling, weekly safety walk.
- **Inspired by:** SafetyCulture/iAuditor; Procore Inspections; Fieldwire forms
- **Files:** `base44/entities/ChecklistTemplate.jsonc`, `base44/entities/ChecklistRun.jsonc`, `base44/shared/taskWriteRules.ts`

<a id="q-06"></a>
#### Q-06 — Snag types: quality, safety, housekeeping and owner-reported

**Phase 2** · Effort S · Impact High

- **Problem:** Snag has no type or source, so safety observations and defects that owners report after possession get mixed in with QA snags or are tracked outside the app.
- **Recommendation:** Add kind (Quality, Safety, Housekeeping, Owner-reported) and source (Internal QA, Owner walkthrough, Consultant, Post-handover) to Snag, with filter chips and a safety count on the dashboard. The workflow, register and export stay the same.
- **Inspired by:** SafetyCulture issues; Procore Observations
- **Files:** `base44/entities/Snag.jsonc`, `base44/functions/snagWrite/entry.ts`, `src/components/handover/SnagDialog.jsx`, `src/components/handover/SnagList.jsx`

<a id="q-07"></a>
#### Q-07 — Handover readiness, handover checklist and pack

**Phase 2** · Effort M · Impact Medium

- **Problem:** Handover shows snag counts, but there is no readiness per villa, no buyer handover checklist and no pack to give the buyer.
- **Recommendation:** Show readiness per villa: tasks approved, open snags, checklists passed, drawings current. Add a handover checklist (keys, meter readings, manuals, warranties, owner signature or photo of the signed form). 'Generate handover pack' prints closed snags with after photos, checklists, current drawings and documents from L-05.
- **Inspired by:** Procore Closeout; Buildertrend
- **Files:** `src/pages/Handover.jsx`, `base44/shared/dashboardBoards.ts`, `base44/entities/Location.jsonc`

<a id="q-08"></a>
#### Q-08 — Owner sign-off for works closed after possession

**Phase 2** · Effort S · Impact Medium

- **Problem:** In a handed-over villa, pending works and owner-reported snags are closed on DVG's word alone. Nothing records that the owner accepted an item, so closed work can be reopened in disputes, and the statement to the owner cannot show what they have already agreed.
- **Recommendation:** For tasks and snags on villas whose possession_status is Handed Over, Close asks for an owner acknowledgement: name, date and method (photo of a signed sheet, screenshot of a WhatsApp confirmation, or noted verbally by the engineer). Each project sets this as required or optional in S-01. Several items can be signed off at once from the printed D-08 statement during a P-09 visit. D-08 shows 'Done, awaiting owner sign-off' and 'Signed off on `<date>`', and each acknowledgement is written to TaskHistory or the snag log.
- **Inspired by:** Customer sign-off on punch lists and work orders (Procore, field-service apps)
- **Files:** `base44/shared/taskWriteRules.ts`, `base44/functions/snagWrite/entry.ts`, `base44/entities/Task.jsonc`, `base44/entities/Snag.jsonc`, `src/components/tasks/TaskApprovalActions.jsx`

### Drawings & locations

<a id="l-01"></a>
#### L-01 — Floors, rooms and drawings usable from start to finish

**MVP** · Effort M · Impact High

- **Problem:** LocationDetail.jsx:18-19 imports VillaScopePanel and DrawingRegister but never renders them; canManage is computed at :74 and never used. Floors and rooms must be entered villa by villa although most villas are identical. Task and Snag floor_id/area_ids are not set by any form, so import rows marked scope_unresolved cannot be fixed.
- **Recommendation:** Render `<VillaScopePanel location canManage>` and `<DrawingRegister location canManage>` now. Add villa_type to Location, plus 'Copy floors & rooms from villa X' to the selected villas, skipping rooms that already exist (by normalized_name). Extract the floor select and room checkboxes from AiProposalAction.jsx (~145-185) into a FloorRoomPicker for TaskFormFields, SnagDialog and Log update. Show scope on cards as 'GF · Kitchen, Utility', and add a 'Resolve scope' action to unresolved tasks.
- **Inspired by:** Fieldwire location tree and typical units; Revit typical floors
- **Files:** `src/pages/LocationDetail.jsx`, `src/components/villa/VillaScopePanel.jsx`, `src/components/drawings/DrawingRegister.jsx`, `base44/entities/Location.jsonc`, `base44/functions/saveRecord/entry.ts`, `src/components/ai/AiProposalAction.jsx`, `src/components/villa/FloorRoomPicker.jsx`, `src/components/tasks/TaskFormFields.jsx`, `src/components/handover/SnagDialog.jsx`

<a id="l-02"></a>
#### L-02 — One page per location, with tabs and breadcrumbs

**Phase 2** · Effort M · Impact High

- **Problem:** LocationDetail stacks up to 200 task cards. VillaExecution is a separate page, SiteWide.jsx handles common areas apart from villas, and there are no breadcrumbs (ui/breadcrumb is unused).
- **Recommendation:** Use one page for every Location type, hiding Floors/Rooms where they don't apply. The header shows the code, health, forecast handover, engineer and the Log update, Snag and Day sheet buttons. Tabs kept in the URL: Overview (VillaExecution content) · Tasks · Daily · Snags · Drawings · Rooms · Photos. Retire SiteWide.jsx in favour of the Villas list filter, and show a Project › Phase › Location › Floor breadcrumb on location, task and snag pages.
- **Inspired by:** Fieldwire/ACC organised around locations; Procore project home
- **Files:** `src/pages/LocationDetail.jsx`, `src/pages/VillaExecution.jsx`, `src/pages/SiteWide.jsx`, `src/components/ui/breadcrumb.jsx`

<a id="l-03"></a>
#### L-03 — Drawing register: current revision, who received it, linked tasks

**Phase 2** · Effort M · Impact High

- **Problem:** DrawingRegister has no 'current only' view, drawings cannot be linked to tasks, and nothing records which contractor received which revision. Building from an old printout is the most common drawing failure on site.
- **Recommendation:** Default to 'Current only' with a Current Rev badge and grey superseded rows. Add issued_to [{contractor_id, issued_at}] to each revision and a 'Share current revision' WhatsApp action. Add drawing_ids to Task, show linked drawings on the task and in Log update, and flag tasks whose drawing was superseded after they started. Villa-type scope arrives earlier, with L-08.
- **Inspired by:** ACC Sheets; Fieldwire plans; transmittal logs
- **Files:** `src/components/drawings/DrawingRegister.jsx`, `src/components/drawings/DrawingDialog.jsx`, `base44/entities/Drawing.jsonc`, `base44/entities/Task.jsonc`

<a id="l-04"></a>
#### L-04 — Villa list with health at a glance and plot-ref search

**Phase 2** · Effort M · Impact High

- **Problem:** LocationTable shows no progress, no open, blocked or overdue counts and no last report date, and there is no search.
- **Recommendation:** Each row or card shows a progress bar (only when measured), open, blocked, overdue and snag counts from a pure villaListView over loadProjectData (a SQL view after the move, not entities.aggregate()), possession status, the engineer, the forecast completion and slip (D-02), and the last report date (red after stale_days). Add forgiving plot-ref search and sort by risk, with handed-over villas with open works first.
- **Inspired by:** Fieldwire locations list; Procore unit list
- **Portability:** Counts would use entities.aggregate(). Use a pure villaListView now and a SQL view after the move.
- **Files:** `src/pages/Locations.jsx`, `src/components/locations/LocationTable.jsx`, `base44/functions/dashboardData/entry.ts`

<a id="l-05"></a>
#### L-05 — Document register for permits, test certificates, warranties and manuals

**Phase 2** · Effort S · Impact Medium

- **Problem:** Drawing.drawing_type covers only plans, elevations and details. Permits, authority approvals, test certificates, warranties and manuals have nowhere to go, although the handover pack needs them.
- **Recommendation:** Extend the register with categories (Drawing, Permit/Approval, Test certificate, Warranty, Manual, Contract), an expiry_date and an optional task_id, scoped to the project, villa or villa type. Add a Documents filter and expiry warnings in Needs Attention.
- **Inspired by:** Procore Documents; ACC Docs
- **Files:** `base44/entities/Drawing.jsonc`, `src/components/drawings/DrawingRegister.jsx`, `src/components/drawings/DrawingDialog.jsx`, `base44/shared/attention.ts`

<a id="l-06"></a>
#### L-06 — Villa photo timeline with before/after comparison

**Phase 2** · Effort M · Impact Medium

- **Problem:** Photos are spread across DailyUpdate.photo_uris and snags, with nowhere to browse a villa's photos.
- **Recommendation:** Add a Photos tab that gathers report and snag photos (Attachment, R-07) by date and room, with filters and a side-by-side comparison of two dates. The weekly owner report uses each villa's latest photo.
- **Inspired by:** CompanyCam; PlanRadar; Procore Photos
- **Files:** `src/components/villa/VillaPhotos.jsx`, `src/pages/LocationDetail.jsx`

<a id="l-07"></a>
#### L-07 — Pins on plans

**Future** · Effort L · Impact Medium

- **Problem:** Snags and tasks cannot be placed on a drawing.
- **Recommendation:** Add drawing_id, pin_x and pin_y (0-1) to Snag and Task. Tapping a villa-type plan drops a pin and creates a snag, and pins are filtered per villa.
- **Inspired by:** Fieldwire; PlanRadar
- **Files:** `base44/entities/Snag.jsonc`, `base44/entities/Task.jsonc`, `src/components/drawings/PlanViewer.jsx`

<a id="l-08"></a>
#### L-08 — Bulk drawing intake for the Imagine drawing set

**MVP** · Effort M · Impact High

- **Problem:** The real Imagine drawings are about to be loaded, but DrawingDialog takes one file at a time against one villa. Most villas share a type, so the same plan would be uploaded villa by villa, and nothing checks whether a drawing number and revision is already in the register.
- **Recommendation:** Add a 'Bulk add drawings' sheet to the register. Drop many PDFs or images, and the sheet parses drawing number, title and revision from each file name using an editable pattern. Assign each file to a villa, a villa type (the L-01 villa_type; it then shows on every villa of that type), a floor or a common area. The preview flags duplicates (same number and revision) and newer revisions, which supersede the current one through the existing chain. Upload 3 at a time with progress through the adapter's uploadPrivate, and resume any file that fails. Default the register to current revisions.
- **Inspired by:** ACC/Fieldwire sheet upload with file-name parsing; transmittal logs
- **Portability:** Drawing files go to Base44 private storage. Upload through the adapter; R-10 copies the files to a private Supabase bucket.
- **Files:** `src/components/drawings/BulkDrawingSheet.jsx`, `src/components/drawings/DrawingRegister.jsx`, `base44/entities/Drawing.jsonc`, `base44/entities/Location.jsonc`, `base44/functions/saveRecord/entry.ts`

### Contractors & meetings

<a id="c-01"></a>
#### C-01 — Commitments followed up everywhere

**Phase 2** · Effort S · Impact High

- **Problem:** Commitments appear only on Meetings, after choosing a contractor. A passed promise date never marks a commitment Missed, and the CommitmentDialog task picker is not limited to that contractor.
- **Recommendation:** Mark a commitment Missed when it is read (promised_date < todayIst() and still Open) in meetingReportView, Today and a Dashboard 'due/missed this week' card, and store the status only when a person confirms it; no scheduler is needed. Show commitments on TaskDetail and the villa Overview, and limit the picker to the contractor's tasks.
- **Inspired by:** Procore Meetings action items
- **Files:** `base44/shared/dashboardBoards.ts`, `src/components/meetings/CommitmentDialog.jsx`, `src/pages/TaskDetail.jsx`, `src/pages/Dashboard.jsx`

<a id="c-02"></a>
#### C-02 — Connected contractor pages

**Phase 2** · Effort S · Impact Medium

- **Problem:** ContractorBoardCard links to neither /contractors/:id nor Meetings, board tiles don't open their lists, and ContractorDetail shows only the newest 100 tasks.
- **Recommendation:** Merge Contractor Dashboard and Contractors into one section: list → detail with Work, Blockers, Snags, Commitments and Manpower tabs. Every tile opens TaskDrilldownDialog, the task list is paged, and an 'Open meeting pack' button is added.
- **Inspired by:** Procore Directory company page
- **Files:** `src/components/contractors/ContractorBoardCard.jsx`, `src/pages/ContractorDetail.jsx`, `src/pages/ContractorBoard.jsx`

<a id="c-03"></a>
#### C-03 — Meeting record with fast entry of many commitments

**Phase 2** · Effort M · Impact High

- **Problem:** There is no Meeting record (attendees, notes), and each commitment needs its own dialog.
- **Recommendation:** Add a Meeting entity {project, contractor_ids, date, attendees, notes} and a grid for entering many commitments at once. 'Start next meeting' carries open commitments into the agenda.
- **Inspired by:** Procore Meetings; Notion meeting notes template
- **Files:** `base44/entities/Meeting.jsonc`, `src/pages/Meetings.jsx`

<a id="c-04"></a>
#### C-04 — Contractor scorecard and headcount trend

**Phase 2** · Effort M · Impact High

- **Problem:** There is no objective view of contractor performance, and per-task manpower counts each crew once per task.
- **Recommendation:** A scorecard per contractor: on-time %, PPC (P-05), commitments kept %, average days blocked, % of tasks stale, rework and rejected snags (Q-02, Q-04), and planned versus actual headcount taken from the SiteDiary (F-03), plus a ranking table.
- **Inspired by:** Procore vendor performance; Powerplay labour reports
- **Files:** `base44/shared/dashboardViews.ts`, `src/pages/ContractorDetail.jsx`

<a id="c-05"></a>
#### C-05 — Commitments proposed from pasted meeting minutes

**Future** · Effort M · Impact Medium

- **Problem:** Minutes and WhatsApp notes have to be retyped as commitments.
- **Recommendation:** Paste the minutes and aiAction, using InvokeLLM, proposes commitments (contractor, task, date) for a person to confirm through the existing proposal flow.
- **Inspired by:** Otter / Fireflies action-item extraction
- **Portability:** Would use InvokeLLM. Call the ai.ts provider interface instead, which stays portable.
- **Files:** `base44/functions/aiAction/entry.ts`, `base44/shared/ai.ts`

### Dashboards & reporting

<a id="d-01"></a>
#### D-01 — Owner dashboard: four headline numbers, a phase health strip and daily snapshots

**MVP** · Effort M · Impact High

- **Problem:** Dashboard.jsx shows 17 tiles of equal weight, including internal ones (Villa work assignments, Children of…, Demo records held out, at :166-168). There is no single health line, no red/amber/green per phase and no history to show change since last week.
- **Recommendation:** Lead with Overdue, At risk (P-01), Blocked and Awaiting verification, each opening its TaskDrilldownDialog list. Add a possession line, 'Handed over with open works: N villas, M tasks, K waiting on owner access', that opens those villas. Add a phase red/amber/green strip and a priority list grouped by who must act, and move the technical tiles into a collapsed 'Data details' section. Start keeping history now: on the first dashboard read after 23:30 IST, write MetricSnapshot rows per project and phase through the R-08 adapter's upsertByKey on [scope_type, scope_id, snapshot_date]. That is entities.upsert today and insert ... on conflict after the move, and it runs this way until a scheduler exists after migration. Show the change since last week once 7 days of snapshots have built up.
- **Inspired by:** Procore executive dashboard; Linear Insights; P6 period snapshots
- **Portability:** Snapshots use entities.upsert. Use adapter.upsertByKey (insert ... on conflict on Postgres), with a lazy first-read trigger until Supabase Cron exists.
- **Files:** `src/pages/Dashboard.jsx`, `base44/shared/dashboardCore.ts`, `src/components/dashboard/PriorityList.jsx`, `base44/entities/MetricSnapshot.jsonc`, `base44/functions/dashboardData/entry.ts`

<a id="d-02"></a>
#### D-02 — Villa x discipline matrix with possession status and forecast completion

**MVP** · Effort M · Impact High

- **Problem:** The classic villa tracker sheet does not exist. Location has only planned_completion_date, shown as plain text, so the owner's main question ('when is B-05-06 handed over?') has no answer anywhere.
- **Recommendation:** A pure dashboardViews function returns villas x disciplines (or work packages). Each row shows possession status (Handed over / With DVG) and its date, and handed-over villas with open works sort first, as on the handover board. Each cell is coloured by status category and shows open and closed counts (a % only when every task in the cell is measured), plus blocked, overdue and owner-access badges. Clicking a cell opens the filtered task list. Each row shows villaForecast, the latest forecast or baseline finish among open tasks, labelled 'Pending works complete by' for handed-over villas and 'Forecast handover' for the rest, or 'Not scheduled' with the count of undated tasks. It also shows slip against planned_completion_date. Filter by phase, contractor or possession, export to Excel, and reuse the forecast on the villa header, in D-08 and in the weekly report.
- **Inspired by:** Line-of-balance villa tracker sheets; Monday heatmap board
- **Files:** `base44/shared/dashboardViews.ts`, `src/pages/VillaMatrix.jsx`, `base44/functions/dashboardData/entry.ts`, `src/pages/LocationDetail.jsx`

<a id="d-03"></a>
#### D-03 — Needs Attention you can act on

**MVP** · Effort M · Impact High

- **Problem:** Needs Attention is read-only, so cleaning up after the full import means opening every task one by one.
- **Recommendation:** Each row gets Fix (edit the offending field in place: contractor, dates, scope), Assign (to a member) and Dismiss with a reason or snooze (AttentionDismissal entity). Multi-select allows setting contractor or dates in bulk. The critical count feeds the O-02 go-live gate.
- **Inspired by:** Linear triage; Gmail inbox zero
- **Files:** `src/pages/NeedsAttention.jsx`, `base44/shared/attention.ts`, `base44/entities/AttentionDismissal.jsonc`

<a id="d-04"></a>
#### D-04 — Share and export from every board

**Phase 2** · Effort M · Impact High

- **Problem:** Only Meetings and AI answers can export. window.print prints the sidebar, and the daily brief returns 'AI Setup Required' even though buildDigest already has the facts.
- **Recommendation:** Add a ShareMenu to Dashboard, Planning, Blockers, Snags, Matrix and Meetings: CSV (ACTIVITY_COLUMNS); WhatsApp text built from buildDigest without AI, through navigator.share with a wa.me fallback; and PDF via a print stylesheet that hides the app frame. jspdf PDFs with embedded photos come later, because signed photo URLs expire and can block canvas.
- **Inspired by:** Procore reports; WhatsApp share sheet
- **Files:** `src/components/common/ShareMenu.jsx`, `base44/functions/aiAction/entry.ts`, `src/index.css`, `src/pages/Meetings.jsx`

<a id="d-05"></a>
#### D-05 — Report coverage grid and team view

**Phase 2** · Effort S · Impact High

- **Problem:** No view shows which villas went unreported over recent days or which engineer is falling behind.
- **Recommendation:** Add a 'coverage' dashboardData view: villas × the last 14 working days, each cell showing reported, blocked or no report, with site-diary entries. Tapping an empty cell opens Log update or a chase to the assigned engineer. Beside it, a Team table shows each engineer's villas, open, overdue and stale tasks, and reports today. Place it on Daily Activity and the coordinator's Today.
- **Inspired by:** Raken report status; GitHub contribution grid; Asana Workload
- **Files:** `base44/shared/dashboardViews.ts`, `base44/functions/dashboardData/entry.ts`, `src/components/daily/CoverageGrid.jsx`, `src/pages/DailyActivity.jsx`

<a id="d-06"></a>
#### D-06 — Trend charts: S-curve, burn-up, overdue and headcount trends

**Phase 2** · Effort M · Impact High

- **Problem:** There are no charts anywhere (recharts is used only by the unused ui/chart.jsx).
- **Recommendation:** Draw from MetricSnapshot rows (D-01, R-04): an S-curve of planned versus actual per phase, a burn-up of closed work, overdue and blocked trends, and a headcount trend from the SiteDiary. Add sparklines to the headline tiles. The delay Pareto stays in P-01.
- **Inspired by:** P6/Procore S-curves; Linear Insights
- **Files:** `src/pages/Dashboard.jsx`, `src/components/charts/SCurve.jsx`, `src/components/charts/TrendChart.jsx`

<a id="d-07"></a>
#### D-07 — Weekly owner report

**Phase 2** · Effort M · Impact High

- **Problem:** The owner gets no automatic weekly summary.
- **Recommendation:** For now, a 'Build this week's report' button runs a pure weeklyReportView and saves the result keyed by week through the adapter. It covers villa progress and forecast completion, slips with reason categories, blockers, owner-access waits, PPC, snags, headcount and the latest photo of each villa. It is shown at /reports/weekly/:date and shared as WhatsApp text or PDF (D-04). After the move, an R-04 step builds it at 17:00 IST on Fridays and a transactional email provider sends a plain-text summary with the link. Core.SendEmail is not used.
- **Inspired by:** Procore / PlanRadar scheduled reports
- **Portability:** Would use Core.SendEmail and a Base44 scheduler. Build reports on demand now; after the move, a scheduled Edge Function plus a transactional email provider.
- **Files:** `base44/functions/scheduler/entry.ts`, `src/pages/WeeklyReport.jsx`, `base44/entities/WeeklyReport.jsonc`

<a id="d-08"></a>
#### D-08 — Villa pending-works statement for owner and handover conversations

**MVP** · Effort S · Impact High

- **Problem:** The question from management and from each villa owner is 'what is still pending on this villa and when will it be done?'. The handover board only gives counts per villa, and the villa page lists up to 200 raw task cards with internal fields. So before every owner call or visit, the engineer rebuilds the list by hand on WhatsApp. 3 of the 9 handed-over villas already have open works.
- **Recommendation:** Add a pure villaStatementView(location) in dashboardViews and a /villas/:id/statement page, opened from the villa page, the matrix row (D-02) and the handover board. The page lists open tasks grouped Floor > Room in plain words: what, trade, status in words, expected date or 'date not set', and what is holding it. It also lists open snags with one photo each, 'Needed from the owner' (pending selections and access), and items completed in the last 30 days. Totals are counts, with no percentage unless measured. The as-of date and possession status head the page. Share it as WhatsApp text (navigator.share or wa.me), print to A4 PDF through a print stylesheet, or export CSV; task refs are optional. A villa whose works_stage or possession says Completed while open work exists is flagged in Needs Attention.
- **Inspired by:** Per-unit punch list sent to buyers; Procore punch list report by location
- **Files:** `base44/shared/dashboardViews.ts`, `base44/functions/dashboardData/entry.ts`, `src/pages/VillaStatement.jsx`, `src/pages/LocationDetail.jsx`, `src/index.css`, `base44/shared/attention.ts`

### Notifications & collaboration

<a id="k-01"></a>
#### K-01 — In-app inbox with notifications

**Phase 2** · Effort M · Impact High

- **Problem:** There are no notifications of any kind.
- **Recommendation:** Add a Notification entity {user_id, type, entity_type, entity_id, title, read_at, pushed_at}, written by server functions through shared notify.ts. Triggers: assignment, @mention, blocker on my villa, AI proposal pending, verification requested, forecast slip on my task, commitment due tomorrow. Show a bell with an unread badge, and an Inbox page.
- **Inspired by:** Linear / GitHub inbox
- **Files:** `base44/entities/Notification.jsonc`, `base44/shared/notify.ts`, `src/pages/Inbox.jsx`

<a id="k-02"></a>
#### K-02 — Reminders and digests on phones

**Phase 2** · Effort M · Impact High

- **Problem:** Nothing reminds staff to report or tells managers what changed, and email rarely reaches site engineers.
- **Recommendation:** After the move, run these as R-04 scheduler steps: a 17:30 IST 'no report today for villas X, Y' reminder and an 08:00 personal digest (overdue, due today, new blockers, owner access booked today), both skipped on non-working days (S-01). Deliver them by Web Push through the PWA service worker (F-07) for engineers, and by plain-text email from a transactional provider, with deep links, for the owner and admin. Store each person's switches on the membership. Until then, Today's 'not reported' list and the one-tap WhatsApp chase (K-05) cover reminders.
- **Inspired by:** Asana daily digest; Raken reminders
- **Portability:** Needs a Base44 scheduler and Core.SendEmail. Do it after the move; Web Push through the PWA service worker is portable, and email goes through a transactional provider.
- **Files:** `base44/functions/scheduler/entry.ts`, `base44/shared/notify.ts`, `base44/entities/ProjectMembership.jsonc`

<a id="k-03"></a>
#### K-03 — Comments with @mentions and 'Seen'

**Phase 2** · Effort M · Impact High

- **Problem:** remarks and latest_update get overwritten, and history cuts them at 400 characters (history.ts:42). Tasks and snags have no place for discussion.
- **Recommendation:** Add a Comment entity {record_type, record_id, body, mention_user_ids, photo_uris} with a comment box on task, snag and villa pages. An @mention creates a Notification, and a 'Seen' button confirms an instruction was read.
- **Inspired by:** Asana comments; Slack threads
- **Files:** `base44/entities/Comment.jsonc`, `src/components/common/CommentThread.jsx`

<a id="k-04"></a>
#### K-04 — One activity timeline, a full change trail and a project feed

**Phase 2** · Effort M · Impact Medium

- **Problem:** Reports, TaskHistory, RecordAudit and AI proposals are kept apart. RecordAudit is written only for Location (saveRecord:308, 343), and managers cannot see what changed across the project since their last visit.
- **Recommendation:** Write RecordAudit in one shape {entity, entity_id, action, actor, at, diff} for every saveRecord and snagWrite entity. Build one Timeline component that merges reports, history, comments, AI proposals and forecast revisions with reasons, storing full text. Use it per record and as a project-wide Activity feed, filterable by villa, person or type, with a 'since your last visit' marker.
- **Inspired by:** Asana / Linear activity feed; GitHub 'new since last visit'
- **Files:** `base44/shared/recordAudit.ts`, `base44/functions/saveRecord/entry.ts`, `base44/shared/history.ts`, `src/components/common/Timeline.jsx`, `src/pages/Activity.jsx`

<a id="k-05"></a>
#### K-05 — One-tap call or WhatsApp to any contractor, person or owner

**Phase 2** · Effort S · Impact High

- **Problem:** The app has no tel:, wa.me or navigator.share anywhere, and Contractor.phone is stored but cannot be tapped.
- **Recommendation:** Build a ContactChip that shows a name with Call and WhatsApp buttons. The WhatsApp message is filled in with the villa, task or snag reference and a deep link. Use it wherever a contractor, member or villa owner appears: task, snag, commitment, blocker and contractor pages.
- **Inspired by:** WhatsApp click-to-chat; Procore Directory
- **Files:** `src/components/common/ContactChip.jsx`, `src/pages/TaskDetail.jsx`, `src/components/handover/SnagList.jsx`, `src/components/blockers/BlockerTable.jsx`

### AI assistant

<a id="a-01"></a>
#### A-01 — One 'Tell DVG' box that understands photos and several tasks

**Phase 2** · Effort M · Impact High

- **Problem:** There are two overlapping AI entry points (Daily Activity's 'Describe the update' and Ask DVG AI's site message assistant), and typing on site is slow.
- **Recommendation:** One box, opened from the + menu and Today, takes text in a large textarea (with a hint to use the phone keyboard's mic for en-IN, hi-IN and ml-IN) plus photos. It accepts a forwarded WhatsApp message or a pasted chat export, such as '[09/10/26, 10:15] Ravi: B 5-6 painting 2nd coat done, AC guy not came'. Sender lines and timestamps set the reporter note and update_date, within X-03's backdate rule. Villa words resolve through villaResolve, and the message is split per villa and task into proposals that already carry task_id, shown as filled-in Log update cards to confirm. Photos go through the X-08 provider interface: a vision-capable model over fetch, with InvokeLLM file_urls only while the app is on Base44. Lines that match nothing are listed, never guessed, and the rule-based fallback stays.
- **Inspired by:** Todoist natural-language Quick Add; WhatsApp voice-to-text
- **Portability:** Would use InvokeLLM file_urls. Go through the provider interface with a vision model over fetch, with files passed as adapter signedUrl links.
- **Files:** `src/components/ai/TellDvg.jsx`, `src/components/ai/AiAssistantPanel.jsx`, `src/components/ai/AiUpdatePanel.jsx`, `base44/functions/aiAction/entry.ts`

<a id="a-02"></a>
#### A-02 — WhatsApp in both directions

**Future** · Effort L · Impact Medium

- **Problem:** Site teams already message on WhatsApp, and those messages are retyped into the app.
- **Recommendation:** Use a Meta Cloud API number. Incoming messages and photos become AiProposals to confirm in the Inbox, and approved outgoing templates carry digests, blocker chases and reminders.
- **Inspired by:** Powerplay and other WhatsApp-first construction tools
- **Files:** `base44/functions/whatsappWebhook/entry.ts`

### Import & data

<a id="i-01"></a>
#### I-01 — Import review: map columns, fix values in place, apply a fix to all rows

**MVP** · Effort M · Impact High

- **Problem:** The import starts with no project selected even when there is one (WorkImport.jsx:35), and the template downloads before a project is chosen, with an empty villa mapping. There is no saved header mapping. ImportRowFix maps one row at a time to existing records but cannot create a villa, room or contractor, correct floor/room, or apply a fix to every matching row, and the 1100px review is lost on navigation.
- **Recommendation:** Default to the selected project and disable the template until one is chosen. Add drag-and-drop and a header-to-field mapping step saved per source (the Imagine workbooks' own headings), warning about ignored columns that contain data. Lift the limits the real lists will hit: send rows in chunks of 250 under one ImportBatch, so a file is no longer capped at 500 rows (MAX_IMPORT_ROWS). Read all project tasks, villas and rooms through readAll for matching and duplicate detection, replacing TASK_SCAN_LIMIT 2,000 and the 500-row Location/VillaArea reads in workImport.ts. In the review, add inline 'Create villa/room/contractor', floor and room correction (FloorRoomPicker), and 'Apply to all N rows with this value'. For a revised list that uses the Task reference column, show a per-row field diff before applying. Keep the review in sessionStorage keyed by the file's fingerprint, and show cards on phones.
- **Inspired by:** Flatfile / OneSchema; Airtable CSV import
- **Portability:** The workImport function and its 500-row cap are Base44 constraints. Chunk under one ImportBatch now; on Supabase one transaction per file, with optional server-side xlsx parsing using the same column list.
- **Files:** `src/pages/WorkImport.jsx`, `src/components/import/ImportUploadStep.jsx`, `src/components/import/ImportRowTable.jsx`, `src/components/import/ImportRowFix.jsx`, `src/lib/xlsxImport.js`, `base44/shared/reconcile.ts`, `base44/functions/workImport/entry.ts`

<a id="i-02"></a>
#### I-02 — Import history and one-click undo

**MVP** · Effort M · Impact High

- **Problem:** There is no import history and no undo, so a bad full Imagine import cannot be reversed.
- **Recommendation:** An Import History page lists each ImportBatch (who, when, counts, reconciled workbook). 'Undo batch' shows a preview, then archives the tasks carrying that import_batch_id and reverts fields using ImportBatch.report changed[{field, from, to}] (workImport/entry.ts:389-395). It reverts only where task.updated_date is unchanged since the batch and lists the rows it skipped.
- **Inspired by:** Smartsheet/Airtable import undo; git revert
- **Files:** `src/pages/ImportHistory.jsx`, `base44/functions/workImport/entry.ts`, `base44/entities/ImportBatch.jsonc`

<a id="i-03"></a>
#### I-03 — Excel round trip for bulk edits

**Phase 2** · Effort S · Impact High

- **Problem:** Import already updates tasks matched by task_ref (reconcile.ts:164-174) with an updated_date check, but there is no way to export the register in that template.
- **Recommendation:** Export the filtered register in the import template (task_ref, updated_date and editable columns), so edits made in Excel come back through the existing reconciliation with a diff for each row.
- **Inspired by:** Smartsheet / Excel round trip
- **Files:** `base44/functions/dataExport/entry.ts`, `src/lib/exportSchema.js`, `base44/shared/reconcileApply.ts`

### Setup & admin

<a id="s-01"></a>
#### S-01 — Project settings: working week, holidays, thresholds and site location

**MVP** · Effort S · Impact High

- **Problem:** Stale is hard-coded as 7 days (attention.ts:114,153; dashboardCore.ts:307; dashboardViews.ts:251), there is no backdating limit, and there is no working week or holiday list. After a Sunday or a festival, tasks show as stale and reminders would fire on days off.
- **Recommendation:** Add a settings object to Project: working_days (Mon-Sat by default), holidays, stale_days, at_risk_window_days, backdate_limit_days, report_cutoff_time and site lat/lng. Add isWorkingDay and workingDaysBetween helpers in dashboardCore, and use them in every stale, at-risk, overdue and reminder rule. Edit the settings on ProjectDetail.
- **Inspired by:** Procore project settings; MS Project working calendar
- **Files:** `base44/entities/Project.jsonc`, `base44/shared/dashboardCore.ts`, `base44/shared/attention.ts`, `base44/shared/dashboardViews.ts`, `src/pages/ProjectDetail.jsx`

<a id="s-02"></a>
#### S-02 — First-run setup checklist with the DVG standard lists

**Future** · Effort M · Impact Medium

- **Problem:** ProjectDialog defaults enabled disciplines to all existing ones (:39), but Discipline and WorkPackage are never seeded (SEED_* in constants.js:76-209 is unused). Saving a project goes nowhere (:64-66), and 19 of 20 empty states offer no next step.
- **Recommendation:** Add a setup checklist on the project: Settings (S-01) → Phases → Villas (S-03) → Floors/rooms (L-01) → Disciplines & packages ('Load DVG standard lists' from SEED_*) → Contractors & defaults → Invite → Import. Each step links to its screen and ticks itself off, and saving a new project opens the checklist.
- **Inspired by:** Notion / Procore onboarding checklists
- **Files:** `src/pages/ProjectDetail.jsx`, `src/components/projects/ProjectDialog.jsx`, `src/components/projects/SetupChecklist.jsx`, `src/lib/constants.js`

<a id="s-03"></a>
#### S-03 — Add many villas at once

**Future** · Effort S · Impact Medium

- **Problem:** LocationDialog adds villas one at a time, with no ranges, no combined plots and no paste.
- **Recommendation:** An 'Add villas' sheet takes a code range (A-01 to A-14), a plot grid with merge (B-05 + B-06 becomes B-05-06), a villa type, or a paste from Excel. Preview, then create them through a saveRecord batch.
- **Inspired by:** Airtable paste into grid; Fieldwire bulk locations
- **Files:** `src/components/locations/LocationDialog.jsx`, `src/components/locations/BulkVillaSheet.jsx`, `base44/functions/saveRecord/entry.ts`

<a id="s-04"></a>
#### S-04 — Easier catalogue management

**Phase 2** · Effort S · Impact Medium

- **Problem:** Work packages belong to a project but are managed one at a time in global Admin, with no copy from another project. Admin opens on Work packages before any disciplines exist (Admin.jsx:44, defaultValue='work-packages').
- **Recommendation:** Open Admin on Disciplines. Allow bulk add or paste and 'Copy from project' for work packages, show which projects use each item, and confirm before deactivating.
- **Inspired by:** Linear workspace settings
- **Files:** `src/pages/Admin.jsx`, `src/components/admin/WorkPackageTab.jsx`, `src/components/admin/DisciplineTab.jsx`

<a id="s-05"></a>
#### S-05 — Archive projects instead of deleting them

**Phase 2** · Effort S · Impact Low

- **Problem:** saveRecord:20,150 can hard-delete a Project and leave its tasks and reports orphaned, although no UI calls deleteRecord today.
- **Recommendation:** Add archived_at (hidden from project lists) with Restore in Admin, and have the server refuse a hard delete while child records exist.
- **Inspired by:** Linear/Asana archive instead of delete
- **Files:** `base44/functions/saveRecord/entry.ts`, `base44/entities/Project.jsonc`, `src/pages/Admin.jsx`

<a id="s-06"></a>
#### S-06 — Project templates: copy a whole setup

**Future** · Effort M · Impact Medium

- **Problem:** A new development would repeat every setup step.
- **Recommendation:** 'Create from template' copies settings, the phase structure, catalogues, villa types with floors and rooms, contractor defaults, and the checklist and task templates.
- **Inspired by:** Procore / Asana project templates
- **Files:** `base44/functions/saveRecord/entry.ts`, `src/pages/Projects.jsx`

### Design system & UX polish

<a id="u-01"></a>
#### U-01 — One status language, defined once

**MVP** · Effort S · Impact High

- **Problem:** The 7 statuses have no grouping, and Pill.jsx hard-codes colours (On Hold uses Blocked's red, Active uses Completed's green). Status, blocker and role lists are copied in Task.jsonc, constants.js:1 and dailyUpdate:17-24, which re-declares what taskWriteRules.ts:16-23 already exports, and roles exist in 4 places.
- **Recommendation:** Create base44/shared/enums.ts (statuses, the categories To do/Active/Stuck/Done, allowed steps, roles, blocker and delay categories). Server functions import it, and the frontend imports it through a Vite alias; add a test that Task.jsonc matches. Add src/lib/tokens.js mapping each status to a category, icon and colour variable. Use StatusPill (icon, colour and text) and HealthBadge everywhere, with a one-line tooltip per status, and give On Hold its own colour.
- **Inspired by:** Linear workflow status categories; single source of truth
- **Files:** `base44/shared/enums.ts`, `src/lib/tokens.js`, `src/components/common/Pill.jsx`, `src/components/common/StatusPill.jsx`, `src/lib/constants.js`, `src/lib/taskRules.js`, `base44/functions/dailyUpdate/entry.ts`, `vite.config.js`

<a id="u-02"></a>
#### U-02 — Forms built for phones, with a toast and Undo on every save

**Phase 2** · Effort M · Impact High

- **Problem:** Centred dialogs scroll Save out of view. Chips are about 28px, text-[10px]/[11px] is used 130 times, and Field renders `<label>` without htmlFor (209 uses, 12 htmlFor). Only 6 files show a toast, although both sonner and react-hot-toast are installed.
- **Recommendation:** Below md, FormDialog becomes a vaul bottom drawer with Save fixed at the bottom. Set a 44px minimum tap target and 12px minimum text (lint against text-[10px]). Field links its label through useId, and every icon button gets an aria-label. Standardise on sonner, with a toast on every save and 6-second Undo on reversible actions, and remove react-hot-toast and use-toast.
- **Inspired by:** iOS bottom sheets; Material touch targets; Gmail undo
- **Files:** `src/components/common/FormDialog.jsx`, `src/components/common/Field.jsx`, `src/components/ui/use-toast.jsx`, `src/lib/taskService.js`, `package.json`

<a id="u-03"></a>
#### U-03 — Searchable selects and one confirmation dialog

**Phase 2** · Effort S · Impact Medium

- **Problem:** Six pages use a native `<select>` (AiSettingsTab, ContractorBoard, Planning, NeedsAttention, Meetings, AskDvgAi), and EnumSelect cannot search long lists. BaselineSection.jsx:84 uses window.confirm, and switches deactivate records instantly.
- **Recommendation:** Build a SearchableSelect (Popover plus cmdk) for villas, contractors, tasks and members, and replace the native selects with it. Add a ConfirmDialog built on AlertDialog, used only for destructive actions.
- **Inspired by:** shadcn Combobox; Linear property pickers
- **Files:** `src/components/common/SearchableSelect.jsx`, `src/components/common/ConfirmDialog.jsx`, `src/components/baselines/BaselineSection.jsx`, `src/pages/Planning.jsx`, `src/pages/NeedsAttention.jsx`, `src/pages/Meetings.jsx`, `src/pages/ContractorBoard.jsx`, `src/pages/AskDvgAi.jsx`

<a id="u-04"></a>
#### U-04 — Empty states that suggest the next step

**Phase 2** · Effort S · Impact Medium

- **Problem:** Only 1 of 20 EmptyState uses offers an action; the empty Dashboard gives the admin no button (Dashboard.jsx:77-86).
- **Recommendation:** Every EmptyState gets one sentence and a next-step button (Import work, Add villas, Log first update, Load DVG standard lists), using the X-05 DataState wrapper.
- **Inspired by:** Notion / Linear empty states
- **Files:** `src/components/common/EmptyState.jsx`, `src/pages/Dashboard.jsx`

<a id="u-05"></a>
#### U-05 — High-contrast site mode and dark mode

**Phase 2** · Effort S · Impact Low

- **Problem:** A .dark palette exists, but nothing switches it on, and colours wash out in sunlight.
- **Recommendation:** Add a theme toggle with next-themes (Light, Dark and a high-contrast 'Site mode'), and make Pill and StatusPill use token colours with dark variants.
- **Inspired by:** Fieldwire / iOS outdoor high contrast
- **Files:** `src/index.css`, `src/components/common/Pill.jsx`, `src/components/layout/AppLayout.jsx`

<a id="u-06"></a>
#### U-06 — Show only the actions each person can take

**Phase 2** · Effort S · Impact Low

- **Problem:** Some buttons appear for everyone and then fail on the server: LocationDetail Edit and Add task (:97, :128), Locations 'New location' (:62), and ContractorDetail Edit and New task, while Contractor and Project create are admin-only.
- **Recommendation:** Gate each action with access.can() or appAdmin, or disable it with a tooltip naming who can do it. This is for clarity, not security.
- **Inspired by:** Linear/Notion disabled controls with a reason tooltip
- **Files:** `src/pages/LocationDetail.jsx`, `src/pages/Locations.jsx`, `src/pages/ContractorDetail.jsx`, `src/lib/AccessContext.jsx`

### Architecture & performance

<a id="r-01"></a>
#### R-01 — TanStack Query for every read and write, with one invokeFn

**Phase 2** · Effort M · Impact High

- **Problem:** React Query is set up (App.jsx:110), but only PageNotFound uses it. About 21 components read entities in useEffect with no cache and no refresh after writes, CatalogContext never refreshes, and the error wrapper is copied into 4 service files.
- **Recommendation:** MVP screens (Today, Log update, matrix) already use queries/keys.js. Every query and mutation function calls the R-08 adapter, never the SDK, so the Supabase move swaps one layer. Next, migrate CatalogContext (5-minute stale time), TaskRegister, LocationDetail, TaskDetail and dashboardService, and move other screens when they are next touched. Refresh tasks, the location and the dashboard after each write and on window focus, apply status and progress taps immediately with rollback if the server refuses, and use one invokeFn() wrapper.
- **Inspired by:** Linear instant UI; TanStack Query optimistic updates
- **Files:** `src/lib/queries/keys.js`, `src/lib/query-client.js`, `src/lib/CatalogContext.jsx`, `src/lib/taskService.js`, `src/lib/dashboardService.js`, `src/App.jsx`

<a id="r-02"></a>
#### R-02 — Load pages on demand and remove unused packages

**Phase 2** · Effort S · Impact Medium

- **Problem:** App.jsx imports every page up front (a 1.1 MB bundle), and about 12 unused packages are installed. moment, however, is used by format.js, and xlsx is already in its own chunk.
- **Recommendation:** Use React.lazy for each route, with Suspense skeletons. Replace moment with date-fns (already installed), then remove moment, @stripe/*, three, react-leaflet, canvas-confetti, react-quill-new, @hello-pangea/dnd, framer-motion, lodash, react-hot-toast, html2canvas and the unused carousel, input-otp and resizable wrappers. Keep the JS needed to open Today under 250 KB gzipped, checked by size-limit in CI.
- **Inspired by:** Vite route splitting; web.dev performance budgets
- **Files:** `src/App.jsx`, `vite.config.js`, `package.json`, `src/lib/format.js`

<a id="r-03"></a>
#### R-03 — Conflict checks and retry keys on writes

**Phase 2** · Effort M · Impact High

- **Problem:** taskWrite update (:191-269) never checks updated_date, so the last save wins. dailyUpdate, taskWrite create and snagWrite have no retry key, so a retry on a patchy connection, or the future offline outbox, can create duplicates.
- **Recommendation:** Reuse the expected-updated_date check from reconcileApply.ts:82 in taskWrite and return 409 with the current record; the UI shows 'Changed by X, review'. Accept a client_ref UUID generated on the phone in dailyUpdate, taskWrite create and snagWrite, and write through the adapter's upsertByKey('client_ref'). On Base44 that is entities.upsert; on Postgres it is a unique index plus insert ... on conflict do nothing.
- **Inspired by:** HTTP If-Match; Stripe idempotency keys; Fieldwire sync
- **Portability:** Uses entities.upsert keyed on client_ref. Go through adapter.upsertByKey; on Postgres a unique index on client_ref plus on conflict do nothing.
- **Files:** `base44/functions/taskWrite/entry.ts`, `base44/functions/dailyUpdate/entry.ts`, `base44/functions/snagWrite/entry.ts`, `base44/entities/DailyUpdate.jsonc`, `base44/shared/reconcileApply.ts`

<a id="r-04"></a>
#### R-04 — One scheduler function with named steps

**Phase 2** · Effort M · Impact High

- **Problem:** Snapshots, escalations, digests, the weekly report and backups each need a timed job, and how Base44 declares scheduled automations is not yet confirmed in this repo.
- **Recommendation:** Build this after the Supabase move (R-10), not on Base44 scheduled automations. Use one scheduled Edge Function triggered by Supabase Cron (pg_cron) with named steps: snapshot at 23:30 IST for project, phase, villa and contractor; escalations; digests; weekly report; backup. Each step is a pure function in shared/scheduler/ with its own enable flag, a scheduler_runs log and idempotent writes (insert ... on conflict). Until then, D-01 and D-07 run lazily on first read or on demand.
- **Inspired by:** Rails Active Job / cron with a run log
- **Portability:** Would use Base44 scheduled automations. Build only after the move, on Supabase Cron (pg_cron) calling one Edge Function whose steps are pure shared functions.
- **Files:** `base44/functions/scheduler/entry.ts`, `base44/entities/SchedulerRun.jsonc`, `base44/entities/MetricSnapshot.jsonc`

<a id="r-05"></a>
#### R-05 — Live updates with subscribe()

**Future** · Effort S · Impact Medium

- **Problem:** Users see stale data until they reload the page.
- **Recommendation:** For now, TanStack Query refetches on window focus and after every write (R-01). After the move, add Supabase Realtime on tasks, daily_updates, snags and ai_proposals only if staff report stale screens, refreshing the matching queries with a short batching delay and an 'Updated by X' hint.
- **Inspired by:** Linear live sync; Base44 entities.subscribe
- **Portability:** Would use entities.subscribe. Use TanStack refetch on focus and after writes now; Supabase Realtime later only if needed.
- **Files:** `src/components/layout/AppLayout.jsx`, `src/lib/queries/keys.js`

<a id="r-07"></a>
#### R-07 — One Attachment entity for photos and files

**Phase 2** · Effort M · Impact Medium

- **Problem:** Photos are lists of links (photo_uris), and Task.attachment_ref is a single string. There are no captions, thumbnails, time taken, room or before/after roles.
- **Recommendation:** Create it as an attachments table in the Supabase schema (R-09) rather than as a new Base44 entity: {file_path, thumb_path, kind, entity_type, entity_id, location_id, floor_id, area_id, taken_at, caption, markup_of, uploaded_by, role}, stored in a private bucket with signed URLs. R-10 backfills it from DailyUpdate.photo_uris, snag photos and Drawing files while it copies them, and photo_uris stays readable for history. It feeds the photo timeline, snag evidence, D-08 and the handover pack.
- **Inspired by:** CompanyCam
- **Portability:** Would be a new Base44 entity plus Base44 storage. Build it directly as a Supabase attachments table with a private bucket, backfilled during R-10.
- **Files:** `base44/entities/Attachment.jsonc`, `base44/functions/dailyUpdate/entry.ts`, `base44/functions/snagWrite/entry.ts`

<a id="r-08"></a>
#### R-08 — Portability seam: one data adapter, pure rules in shared modules

**MVP** · Effort S · Impact High

- **Problem:** 31 files in src and 7 shared modules call Base44 entities and functions directly, and the roadmap would add more Base44-only calls (aggregate, upsert, subscribe, InvokeLLM, analytics, scheduled automations). Each of these becomes rework at the planned Supabase move (MIGRATION_READINESS.md).
- **Recommendation:** Add src/api/data.js (browser) and base44/shared/db.ts (server) with a small interface: get, list(filter, {sort, fields}), readAll, count, create, update, upsertByKey, invoke(fn, payload), uploadPrivate, signedUrl, currentUser and llm.complete. Implement it on the Base44 SDK now. All new MVP code (Today, Log update, matrix, D-08, L-08, import changes) uses it, and existing call sites move when they are next touched. Business rules stay in pure base44/shared/*.ts with no SDK import, enforced by an ESLint no-restricted-imports rule and the O-01 tests. Rule: no new Base44-only feature unless it sits behind the adapter and has a named Supabase equivalent.
- **Inspired by:** Ports and adapters (hexagonal architecture); repository pattern
- **Files:** `src/api/data.js`, `base44/shared/db.ts`, `src/api/base44Client.js`, `eslint.config.js`

<a id="r-09"></a>
#### R-09 — Supabase build alongside the live app, after a post-go-live decision gate

**Phase 2** · Effort L · Impact High

- **Problem:** MIGRATION_READINESS.md maps entities to tables, but nothing has been built. Until it is, every Base44 workaround keeps costing effort: the member_ids mirror, reference arbitration, the 500-row and 2,000-task caps, Excel parsed in the browser, and imports that cannot run as one transaction.
- **Recommendation:** Gate: start once go-live is stable (2 weeks of daily reports and zero critical Needs Attention items), and freeze new Base44-only features from that point. In GitHub, add supabase/migrations covering the section F tables plus Snag, MeetingCommitment, VillaFloor, VillaArea, Drawing, AiProposal, RecordAudit, MetricSnapshot, TaskConstraint, attachments (R-07) and any roadmap tables built by then. Store enums as text with check constraints generated from shared/enums.ts, and give unique(task_ref) and unique(snag_ref) one sequence per prefix. Add project_memberships with one membership RLS policy and a security-definer rank function (Admin / Project Editor / Viewer only). TaskHistory and RecordAudit are insert-only, written by Edge Functions. Port the 12 functions to Deno Edge Functions that reuse base44/shared/*.ts unchanged, and wrap each import in one transaction. Implement the R-08 adapter on supabase-js. In CI, run the O-01 suite and the cross-board count check against local Supabase. Codex/Claude pull requests replace the platform's automatic 'File changes' commits.
- **Inspired by:** Strangler-fig migration; Supabase CLI migrations and local development
- **Files:** `supabase/migrations/`, `supabase/functions/`, `src/api/data.supabase.js`, `base44/shared/db.ts`, `.github/workflows/ci.yml`, `docs/MIGRATION_READINESS.md`

<a id="r-10"></a>
#### R-10 — Rehearsed data move and one-weekend cutover

**Phase 2** · Effort M · Impact High

- **Problem:** There is no one-click migration (MIGRATION_READINESS G8). Data must load in dependency order, reference counters must be reset from the ledger, private photos and drawings must be copied, and the 6 users must be re-invited, all with the live Imagine data and nothing lost.
- **Recommendation:** Write a scripted, repeatable import: take the dataExport JSON bundle, load it in the G8 order, setval each prefix from ref_allocations, copy DailyUpdate photos and Drawing files to private buckets while rewriting paths, backfill attachments, then invite the 6 users through Supabase Auth and re-point user_id by email. Rehearse on a copy at least twice. Gate: a scripted diff shows that every dashboardData figure, each villa's open count, the task_ref set and the history row counts match between the old and new apps. Cut over on a Sunday: set Base44 read-only, take a final export, import, verify, then switch the URL. Keep Base44 read-only for 30 days as a fallback. Then delete member_ids, the reference arbitration code and the Base44 adapter.
- **Inspired by:** Blue-green cutover with reconciliation; backfill verification jobs
- **Files:** `scripts/migrate/`, `base44/functions/dataExport/entry.ts`, `src/lib/exportSchema.js`, `docs/MIGRATION_READINESS.md`

### Testing & ops

<a id="o-01"></a>
#### O-01 — Safety net: Vitest, CI and a dry-run migration runner

**MVP** · Effort M · Impact High

- **Problem:** There are no tests and nothing checks a change before it ships. At least 8 items need one-off backfills on live Imagine data (member roles, latest_report_date, user matching, actual dates, delay categories and others), and Base44 has no migration mechanism.
- **Recommendation:** Use Vitest for both src/lib and base44/shared, stubbing base44:runtime for ai.ts. Cover taskWriteRules, dashboardCore/Views/Boards, attention, reconcile*, villaResolve, taskRef, readAll and taskRules/xlsxImport, with one regression test per Fix-now bug and a cross-board count check, which is reused as the R-10 migration reconciliation. Run GitHub Actions on every PR (npm ci, lint, typecheck, build, vitest) and block merge on failure. Write each backfill as a pure function in base44/shared/migrations/ (rows in, patches out). Run it through a temporary admin-only 'migrate' function with a dry run (counts and sample diffs), batching and a MigrationRun log, plus a test that each migration can be run twice safely. After the move the same functions run as scripts, and schema changes become supabase/migrations SQL.
- **Inspired by:** Testing pyramid; GitHub Actions; Rails/Django migrations; Stripe backfill jobs
- **Portability:** The Base44 'migrate' function and MigrationRun are temporary. Keep backfills as pure functions; after the move, schema changes are supabase/migrations SQL and backfills run as scripts.
- **Files:** `base44/shared/*.test.ts`, `src/lib/*.test.js`, `.github/workflows/ci.yml`, `package.json`, `base44/functions/migrate/entry.ts`, `base44/shared/migrations/`, `base44/entities/MigrationRun.jsonc`, `src/pages/Admin.jsx`

<a id="o-02"></a>
#### O-02 — Go-live kit: practice project, user testing, in-app Help and a go-live gate

**MVP** · Effort M · Impact High

- **Problem:** The 5 staff go live together with the full Imagine import. There is no user-testing script and no training material, and nothing in the app explains terms such as Execution Complete versus Approved, villa-work parent, or the Needs Attention codes.
- **Recommendation:** Set up a practice project with the demo flag and write a user-testing checklist per persona (Today, Log update, Block, Import, Undo import, villa statement). Add a /help page with the status lifecycle diagram, a glossary (glossary.js, also shown as '?' popovers on StatusPill, HealthBadge and the headline tiles) and 1-minute how-to cards that double as the phone field guide. Measure adoption from the app's own data, as reports per user per working day and villas reported today, instead of base44.analytics.track. Go live only when testing passes, there are zero critical Needs Attention items after the import (X-06 must exclude demo tasks first), and the D-08 statements for the handed-over villas with open works have been checked on site with the engineer.
- **Inspired by:** Procore onboarding and certification; Linear docs; Notion '?' menu
- **Portability:** base44.analytics.track is dropped. Measure adoption from DailyUpdate rows (reports per user per working day).
- **Files:** `docs/GO_LIVE_UAT.md`, `src/pages/Help.jsx`, `src/lib/glossary.js`, `src/components/common/StatusPill.jsx`, `src/components/common/StatTile.jsx`

<a id="o-03"></a>
#### O-03 — Staging app and end-to-end smoke tests

**Phase 2** · Effort M · Impact Medium

- **Problem:** Entity schema changes and the main flows are not tested before they reach the live app holding real Imagine data.
- **Recommendation:** Do not build a Base44 staging app. With R-09, run the Supabase stack locally in CI and keep one Supabase staging project seeded with demo data. Deploy pull requests there and require a manual step before production. Run nightly Playwright tests against it: log an update with a photo, save an update that keeps existing values, preview and undo an import, raise and close a snag, book an owner access visit and invite a member.
- **Inspired by:** Playwright smoke tests; staging promotion
- **Portability:** Do not build a Base44 staging app. Use local Supabase in CI plus a Supabase staging project.
- **Files:** `e2e/smoke.spec.ts`, `.github/workflows/nightly.yml`

<a id="o-04"></a>
#### O-04 — Weekly automatic backup

**Phase 2** · Effort S · Impact Medium

- **Problem:** There is only a manual admin export (dataExport) and one hand-made backup (backups/phase1-backup-2026-10-08.json).
- **Recommendation:** Until the move, the admin data-health panel shows the date of the last full dataExport and asks for one every Sunday (a 2-minute manual step), with the file stored outside Base44. After the move, use Supabase daily backups plus a weekly GitHub Action that runs pg_dump and copies the storage buckets to a private location, keeping the last 8, with the last backup's date and size on the panel.
- **Inspired by:** Airtable/Smartsheet scheduled backups
- **Portability:** Would use a Base44 scheduler and dataExport. Run a manual weekly export until the move, then Supabase backups plus a GitHub Action running pg_dump and copying storage.
- **Files:** `base44/functions/dataExport/entry.ts`, `base44/functions/scheduler/entry.ts`, `docs/MIGRATION_READINESS.md`, `src/pages/Admin.jsx`

## 10. Deliberately not built

- Native iOS/Android apps or a Capacitor wrapper: an installable web app with a read cache and an outbox covers 5 phones.
- A full offline sync engine (a Linear-style local database): caching reads and queuing writes and photos is enough at this scale.
- A stored VillaSummary table kept in sync on every write path: with 2,000 tasks or fewer, loadProjectData and entities.aggregate() are enough for the villa list, matrix and badges.
- Atomic counters for task references: Base44 has no atomic increment, and the current claim-and-verify protocol is already safe.
- Many separate cron functions: one scheduler with named, switchable, idempotent steps (R-04).
- Sentry or another error-tracking vendor at launch: ClientError rows, Base44 app logs and 'Report a problem' are enough for 6 users; add it later only if needed.
- Email as the main reminder channel for site engineers: they live on their phones, so use push, in-app and WhatsApp links, and keep email for the owner and admin.
- Paid speech transcription (Whisper and similar): the phone keyboard's dictation already handles English, Hindi and Malayalam into any text box.
- A general automation or rule builder: 4 fixed rules that can be switched on or off (T-07) need no maintenance.
- Custom dashboard widget builders or a personal SavedView entity: role-based homes, presets and copy-link URLs answer each persona's questions.
- A drag-and-drop kanban board for status: a status change needs report, photo and blocker context, which Log update, the register grid and the matrix provide.
- Full BOQ and cost control (contract values, variations, payment certificates, earned value): keep it in accounting and track quantities only to measure progress.
- A material inventory, PO and stock ledger, or RFI/submittal workflows: track materials as readiness lanes and constraints with an owner and a date, and use comments for questions.
- 360° capture, a BIM/IFC viewer or drone integration: far beyond what a 6-person villa team needs.
- A client or buyer portal: share the weekly report, WhatsApp text and handover pack instead.
- A translated (i18n) interface now: staff work in English, and the AI assistant accepts Hinglish and Malayalam.
- A detailed permission matrix or extra roles: security is not the concern; Admin, Project Editor and Viewer are enough, with membership-scoped reads that map to the Supabase policy.
- Gantt editing with drag-to-reschedule and resource levelling: a read-only timeline plus forecast changes with a reason category is enough.
- Worker-level timesheets or biometric attendance: the site diary's daily headcount per contractor gives the insight needed.
- Migrating to Supabase before go-live: it delays the Imagine finishing-works tracker by weeks and users see nothing new. Go live on Base44, then move once daily use is stable (R-09, R-10).
- Opening read RLS to every signed-in user or dropping member_ids on Base44 before the move: keep membership-scoped reads that match the planned Supabase project_memberships policy; member_ids is removed at cutover.
- New Base44-only features without the adapter and a named Supabase equivalent (entities.aggregate, subscribe(), analytics.track, Base44 scheduled automations, Core.SendEmail): each one is rework at migration.
- A Base44 staging app: build staging once, on Supabase (local in CI plus a staging project).
- Running Base44 and Supabase side by side with two-way sync: for 6 users, a rehearsed one-weekend cutover with Base44 left read-only is simpler and safer.
- Third-party product analytics for adoption: count daily reports per user per working day from the app's own data.
- An owner or buyer login for booking access or viewing progress: coordinate owners by WhatsApp from the app (P-09) and share the villa statement (D-08) instead.
- Redux, Zustand, GraphQL, microservices or a custom WebSocket server: TanStack Query refetching and the URL already cover shared state; add Supabase Realtime after the move only if screens feel stale.

