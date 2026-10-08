# Users, permissions and account setup

## The two things that are not the same

- **App role** (`admin` / `user`) is the application-wide level, set by the app
  owner on the App Users page. It decides administration: who may invite people,
  change permissions, change company-wide lists and AI settings, run migration
  exports, and create or delete projects.
- **Project membership role** lives in `ProjectMembership` and decides what a
  person may do *inside a project they are a member of*.

A job designation — Site Engineer, MEP Engineer, Procurement, Planning,
Management — is a **label only**. It is stored on the user profile
(`User.designation`) and never grants or removes a single capability.

## The one operational level: Project Editor

All five staff users hold **Project Editor** on the projects they are assigned to.
There is one level, so nobody is quietly more restricted than somebody else
because of their job title. On their projects a Project Editor may:

- read all operational project information;
- create, edit, update and archive tasks;
- add and update daily reports (progress, manpower, blockers, dependencies);
- create and update villa, floor and room-level work, and site-wide/common work;
- import approved CSV work lists and export operational reports and task lists;
- create and update snags, and upload and manage drawings;
- record contractor meeting commitments;
- revise forecast dates through the protected workflow (a reason is mandatory);
- see dashboards and planning, and use the AI assistant;
- review and confirm AI-proposed updates;
- verify and approve another person's completed work — but never their own.

Deletion stays controlled: tasks are archived, snags are closed, history and
references are never destroyed.

## What only the application administrator may do

Invite, deactivate or re-invite users · assign or revoke project membership ·
change anyone's permission level · change company-wide lists (disciplines,
contractors, work packages) · change AI settings and secrets · run the full
migration export · create, delete or transfer a project.

This is enforced twice: the interface hides it from a Project Editor, and the
server refuses it (`canManageMembers` requires the application administrator rank,
and membership writes are administrator-only).

## Setting the six accounts up

Base44 authentication is by invitation — the platform sends the email and the
person sets their own password. **No password is ever created, stored or written
into the repository from here**, and there is no supported way for an
administrator to set a temporary password for somebody else.

1. Administration → Users & access → **Invite user**.
2. Enter the real email address that will sign in, the display name, the
   designation, the project and the permission level (**Project Editor**).
3. The account appears as **Pending Setup** until the invitation is accepted.
4. Repeat for the five staff addresses. Assign all five to Imagine Villas.
5. Once they have signed in, their name and designation can be edited in place in
   the same list, and a password reset can be requested for them there.

Suggested sign-in labels and designations (the email address itself is the
credential identifier — the labels below are what the person is called):

| Label | Designation | Permission | Status |
| --- | --- | --- | --- |
| admin | Administrator | Application administrator | Active (existing account, reused) |
| site.engineer | Site Engineer | Project Editor | Pending Setup — needs the real invitation address |
| mep.engineer | MEP Engineer | Project Editor | Pending Setup |
| procurement | Procurement | Project Editor | Pending Setup |
| planning | Planning | Project Editor | Pending Setup |
| management | Management | Project Editor | Pending Setup |

Future projects use the same model: invite the person once, then add a
membership row for each further project at the same Project Editor level.