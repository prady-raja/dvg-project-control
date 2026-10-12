# Go-live kit — user testing and the go-live gate (O-02)

Go live only when **all four** of these are true:

1. Every checklist below has passed with the person it is written for.
2. **Needs Attention shows 0 items that need a decision** after the real import (the "Go-live gate" line on that page). Items dismissed with a reason do not count, but read the reasons first.
3. The pending-works statement of each handed-over villa that still has open works (3 of the 9, at the time of writing) has been checked **on site with the engineer**.
4. The CI check on the branch is green (lint, build, tests).

The numbers to watch after go-live are on **Setup → Catalogues & data → Data → Adoption**: reports per person per working day, and villas reported today.

## 0. Set up the practice project (administrator, once)

1. Create a project named **Practice – Imagine** with a couple of villas and rooms (Projects → New project; Villas → New location).
2. Invite the testers as **Project Editors** on that project (Users & access). All five staff use the same level.
3. Import a small sample work list (10–20 rows) into the practice project so there is something to update. Keep the real project untouched while people practise.
4. Switch the **demo view** on (Overview → Show demo records) when you want to look at practice data; demo records are kept out of every real figure.

When testing is finished, archive the practice project.

## 1. Site engineer (on a phone)

- [ ] Sign in; land on **Today**. My villas show as reported / not reported.
- [ ] Tap **+ → Log update**: pick a villa, a task, a status chip and a progress chip, add a photo, **Save**. It took about a minute or less.
- [ ] Tap **Undo** on the confirmation. The task goes back as it was.
- [ ] Save again, then open the villa's daily updates and use **Correct this report**.
- [ ] Open a task and **Block** it: choose a reason, an owner, a clear-by date. It shows on Blockers under that owner.
- [ ] **Raise a snag** with a floor, a room and a photo.
- [ ] Kill the app mid-update and reopen **+ → Log update**: the unsent draft is offered back.

## 2. Coordinator / planner

- [ ] Today → **All villas**: report coverage and the headline numbers appear.
- [ ] Blockers: **Set owner / date**, **Chase** (WhatsApp opens with the message ready), **Resolve**.
- [ ] Planning: the buckets add up to the open count; **At risk** has its own tab.
- [ ] Needs Attention: **Fix** a missing contractor, **Assign** a task, select several and **Set dates**, **Dismiss** one with a reason.

## 3. Import (administrator or Project Editor)

- [ ] Open **Import works**; the project is already chosen; the template downloads.
- [ ] Drop a workbook with a few renamed headings; map the unknown columns; reload the page and see the mapping remembered.
- [ ] Review: use **Create villa**, **Register room**, and **Apply to all N rows** on a repeated villa spelling.
- [ ] Import a file of more than 500 rows; progress is shown by part.
- [ ] **Import history → Undo batch**: the preview says what will be archived and put back, and lists work edited since.
- [ ] After the real import, re-run the check on **Needs Attention** and bring the gate to 0.

## 4. Management

- [ ] **Overview** leads with Overdue, At risk, Blocked, Awaiting verification; each opens its list.
- [ ] The handed-over line ("Handed over with open works: N villas, M tasks, K waiting on owner access") opens those villas.
- [ ] **Villa matrix**: each cell opens its tasks; the forecast column reads "Pending works complete by" for handed-over villas; **Export to Excel** works.
- [ ] A villa's **Pending works statement**: Share (WhatsApp text), Print / PDF, CSV all work, and read correctly to an owner.
- [ ] The change since last week appears once seven days of snapshots exist (they are written by the first Overview read after 23:30).

## 5. Before inviting staff

- [ ] Run the backfills in order from **Data → Backfills** (dry run first): `legacy-roles`, `latest-report-date`, `actual-dates`, `delay-categories`, `user-matching`; then link any leftover names under **Users & access → Names to link**.
- [ ] Sign-up is closed (`/register` goes to the login page); everyone is invited from Users & access.
- [ ] The Help page opens from the menu and the "?" beside the headline numbers explains each one.
