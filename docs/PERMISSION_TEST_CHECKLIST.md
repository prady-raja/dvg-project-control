# Second-account permission checklist (DVG Project Control)

**Status: not yet executed.** Every rule below is enforced on the server, but
each one needs a *second* signed-in person to prove it — one account cannot show
that a role is refused. Run this list with two people before the team starts
using the app on real Imagine works.

## Setting up

1. Invite the second person (Users & Access), one per role you want to check.
2. On the project, add them in Users & Access → project membership with the role
   under test (Site Engineer, Viewer, Project Manager).
3. Keep a third person available for one item only: checking that access is
   revoked after a membership is removed.

Record for each line: who did it, what happened, and the exact message shown.

## 1. A Site Engineer can report but cannot approve

- As the Site Engineer: open a task → **Daily update** → set progress, write what
  was done, save. **Expected:** saved, appears in Daily Activity.
- As the Site Engineer: open the same task → change status to **Approved** (Quick
  update or the editor).
  **Expected:** refused with *"Only a Project Manager or an administrator can
  approve or close work."* The task status must be unchanged.
- As the Site Engineer: try **Archive** on a task.
  **Expected:** refused with *"Only a Project Manager or an administrator can
  archive or restore a task."*
- As the Site Engineer: try to change a baseline date on a task covered by an
  approved baseline.
  **Expected:** refused with the approved-baseline message.

## 2. A Viewer cannot create or edit tasks

- As the Viewer: Task Register → **Create task**, fill it in, save.
  **Expected:** refused with *"Your project role is read-only."* (or the
  permission message) and no task created — check the register afterwards.
- As the Viewer: open a task → **Quick update** → save a progress change.
  **Expected:** refused; the task shows its original progress.
- As the Viewer: **Daily update** on a task.
  **Expected:** refused — a read-only role cannot file site reports.

## 3. A Project Manager can approve permitted works

- As the Site Engineer: mark the task **Execution Complete**.
- As the Project Manager: approve it (**Approved** / **Closed**).
  **Expected:** accepted, and the task records who approved it and when.
- As the Project Manager: try to approve a task *they themselves* marked
  Execution Complete.
  **Expected:** refused with *"You cannot approve or close work you marked
  Execution Complete yourself."*
- As the Project Manager: create a baseline version, submit and approve it.
  **Expected:** accepted; afterwards, baseline dates are locked for everyone but
  a Project Manager / administrator.

## 4. Removing a project membership revokes access

- As the second person: confirm they can see the project and its tasks.
- As the administrator: on the project's membership, set the membership to
  inactive (or remove it).
- Second person refreshes (sign out and in if in doubt).
  **Expected:** the project and its tasks are gone from their lists; opening a
  task link directly is refused with *"You are not a member of this project."* —
  including a task that already existed before access was removed.
- Administrator restores the membership → access returns.

## 5. Private site photographs

- Photographs are stored privately, with no public URL: the daily report holds a
  storage reference and the image is only readable through a signed link that
  expires. Upload a photo on a daily report (camera and gallery buttons) and
  confirm it displays in the report and on the task.
- As a person with **no** membership on that project: they must not be able to
  see the photo strip or its images, and a signed link they were not given must
  not be usable from their session.
  **Expected:** no reference and no link reachable.
- Also confirm the optional rule: a daily report saves normally with **no**
  photograph attached.

## Known gaps in what a single account can prove

- Everything above: role refusals, cross-user visibility, and revocation.
- That a viewer cannot see another project's data through a direct link.