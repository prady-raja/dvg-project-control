// The browser keeps hand-trimmed copies of some server rules in src/lib/shared
// (it may not import from base44/). These tests fail when a copy drifts.
import { describe, expect, it } from 'vitest';
import * as serverEnums from '../base44/shared/enums.ts';
import * as serverCalendar from '../base44/shared/calendar.ts';
import * as serverConstraints from '../base44/shared/constraints.ts';
import * as serverAttentionActions from '../base44/shared/attentionActions.ts';
import * as serverAssignees from '../base44/shared/assignees.ts';
import * as serverAreas from '../base44/shared/villaAreas.ts';
import * as serverDrawings from '../base44/shared/drawingIntake.ts';
import * as serverChunks from '../base44/shared/importChunks.ts';
import * as serverViews from '../base44/shared/villaViews.ts';
import * as serverImport from '../base44/shared/workImport.ts';
import * as serverAttention from '../base44/shared/attention.ts';
import * as serverCommitments from '../base44/shared/commitments.ts';
import * as serverHealth from '../base44/shared/dataHealth.ts';
import * as serverChecklists from '../base44/shared/checklists.ts';
import * as serverOwnerAccess from '../base44/shared/ownerAccess.ts';
import * as serverSignoff from '../base44/shared/ownerSignoff.ts';
import * as serverRework from '../base44/shared/rework.ts';

const copies = import.meta.glob('../src/lib/shared/*.ts', { eager: true });
const servers = {
  'enums.ts': serverEnums, 'calendar.ts': serverCalendar, 'constraints.ts': serverConstraints,
  'attentionActions.ts': serverAttentionActions, 'assignees.ts': serverAssignees,
  'villaAreas.ts': serverAreas, 'drawingIntake.ts': serverDrawings, 'importChunks.ts': serverChunks,
  'villaViews.ts': serverViews, 'workImport.ts': serverImport, 'attention.ts': serverAttention, 'commitments.ts': serverCommitments, 'dataHealth.ts': serverHealth, 'checklists.ts': serverChecklists, 'ownerAccess.ts': serverOwnerAccess, 'ownerSignoff.ts': serverSignoff, 'rework.ts': serverRework,
};
const nameOf = (path) => path.split('/').pop();

describe('every frontend copy has a server original', () => {
  it('no copy is orphaned', () => {
    Object.keys(copies).forEach((path) => expect(servers[nameOf(path)], nameOf(path)).toBeTruthy());
  });
});

describe('copied exports match the originals', () => {
  Object.entries(copies).forEach(([path, copy]) => {
    const name = nameOf(path);
    const server = servers[name];
    if (!server) return;
    describe(name, () => {
      Object.entries(copy).forEach(([key, value]) => {
        it(`${key}`, () => {
          expect(server, `${key} missing from the server original`).toHaveProperty(key);
          if (typeof value === 'function') {
            expect(typeof server[key]).toBe('function');
            expect(value.length).toBe(server[key].length);
          } else {
            expect(value).toEqual(server[key]);
          }
        });
      });
    });
  });
});

describe('copied functions give the same answers', () => {
  const same = (copyFile, fn, ...args) => {
    const copy = copies[`../src/lib/shared/${copyFile}`][fn];
    const server = servers[copyFile][fn];
    expect(copy(...args)).toEqual(server(...args));
  };

  it('status helpers', () => {
    TASK_STATUSES().forEach((s) => {
      same('enums.ts', 'allowedNextStatuses', s);
      same('enums.ts', 'statusCategoryOf', s);
    });
    ['Material', 'Client', 'Drawing'].forEach((c) => same('enums.ts', 'defaultOwnerTypeFor', c));
  });

  it('calendar settings and checks', () => {
    [{}, { working_days: ['Mon', 'Tue'], holidays: ['2026-01-01'] }, { stale_days: 0 }, null].forEach((p) => {
      same('calendar.ts', 'projectSettings', p);
      same('calendar.ts', 'settingsProblems', p);
    });
  });

  it('room names', () => {
    ['Master Bedroom 1', 'master-bedroom  1', 'the Kitchen', ''].forEach((n) => same('villaAreas.ts', 'normalizeAreaName', n));
  });

  it('drawing names and revisions', () => {
    ['IMG-A-101_Rev B_Ground Floor Plan.pdf', 'ST-02 R3 sections.pdf', 'plan.pdf'].forEach((n) => same('drawingIntake.ts', 'parseDrawingName', n));
    [['A', 'B'], ['P1', 'P2'], ['', 'A'], ['10', '9']].forEach(([a, b]) => same('drawingIntake.ts', 'compareRevisions', a, b));
  });

  it('chunks and headers', () => {
    const rows = Array.from({ length: 600 }, (_, i) => ({ i }));
    same('importChunks.ts', 'splitIntoChunks', rows);
    same('importChunks.ts', 'headerFingerprint', ['Task', 'Villa', 'Due']);
    same('importChunks.ts', 'toCsv', [['a', 'b'], ['x,y', '"q"']]);
  });

  it('csv parsing and cleaning', () => {
    same('workImport.ts', 'parseCsv', 'a,b\n1,"2,3"\n');
    same('workImport.ts', 'cleanText', '  Hello   world ');
    same('workImport.ts', 'looseKey', 'Villa No.');
  });

  it('chase message and WhatsApp link', () => {
    const c = { description: 'Tiles', owner_name: 'Ravi', owner_phone: '+91 98765 43210', due_date: '2026-01-05' };
    const task = { task_ref: 'T-1', name: 'Tiling' };
    same('constraints.ts', 'chaseMessage', c, task);
    same('constraints.ts', 'whatsappLink', '+91 98765 43210', 'hi');
    same('constraints.ts', 'isPastDue', c, '2026-02-01');
  });

  it('checklists', () => {
    ['CIVIL', 'ELEC', 'NOPE', ''].forEach((code) => same('checklists.ts', 'templateFor', code, undefined));
    same('checklists.ts', 'templateFor', 'CIVIL', [' a ', 'b']);
    same('checklists.ts', 'parseTemplateText', '- one\n2) two\n\nONE');
    same('checklists.ts', 'overallOf', [{ result: 'Pass' }, { result: 'Fail' }]);
    ['Task', 'Snag', 'Other'].forEach((type) => ['Execution Complete', 'In Progress', 'Closed'].forEach((status) => same('checklists.ts', 'inspectableProblem', type, { status })));
    same('checklists.ts', 'snagFromFailure', { item: { text: 'x', comment: 'y', photo_uri: 'p' }, subject: { task_ref: 'T', location_id: 'v' }, subjectType: 'Task' });
  });

  it('data health', () => {
    [{}, { assignee_user_id: 'u' }, { responsible_engineer: 'A', priority: 'High' }, { current_forecast_finish: '2026-01-01' }].forEach((t) => same('dataHealth.ts', 'missingFieldsOf', t));
  });

  it('commitment state', () => {
    const c = { status: 'Open', promised_date: '2026-03-01' };
    ['2026-02-28', '2026-03-01', '2026-03-02'].forEach((d) => same('commitments.ts', 'commitmentState', c, d));
    same('commitments.ts', 'commitmentSummary', [c, { status: 'Fulfilled', promised_date: '2026-01-01' }], '2026-03-02');
  });

  it('the statement text', () => {
    const view = {
      villa: { code: 'B-05', plots: '12', project: 'Imagine', phase: 'A', possession_status: 'Handed Over', possession_date: '2026-01-05' }, as_of: '2026-03-10',
      forecast: { date: '2026-04-01', label: 'Pending works complete by', undated: 1 }, groups: [{ floor: 'Ground', items: [{ room: 'Hall', what: 'Paint', ref: 'T-1', trade: 'Paint', status: 'In progress', expected: '2026-03-20', holding: '' }] }],
      snags: [], needed_from_owner: [], completed_recently: [{}], totals: { open_tasks: 1, open_snags: 0, percent: null },
      awaiting_signoff: [{ room: 'Kitchen', what: 'Tiles' }], signed_off: [{}],
    };
    same('villaViews.ts', 'statementText', view);
    same('villaViews.ts', 'statementText', view, { includeRefs: true });
  });

  it('owner sign-off', () => {
    const loc = { possession_status: 'Handed Over' };
    same('ownerSignoff.ts', 'needsAck', { location: loc, project: { owner_signoff: 'Required' } });
    same('ownerSignoff.ts', 'needsAck', { location: loc, project: { owner_signoff: 'Optional' } });
    same('ownerSignoff.ts', 'signoffState', { owner_ack_date: '2026-03-01' }, { location: loc });
    same('ownerSignoff.ts', 'signoffState', {}, { location: loc });
    same('ownerSignoff.ts', 'signoffState', {}, { location: { possession_status: 'Not Handed Over' } });
  });

  it('owner access', () => {
    const visit = { status: 'Confirmed', visit_date: '2026-03-12', window_start: '10:00', window_end: '17:00' };
    same('ownerAccess.ts', 'accessLine', visit);
    same('ownerAccess.ts', 'accessLine', { ...visit, status: 'Requested' });
    same('ownerAccess.ts', 'tasksNeedingAccess', [{ id: '1', location_id: 'v', status: 'In Progress', access_status: 'Pending' }, { id: '2', location_id: 'v', status: 'Closed', access_status: 'Pending' }], 'v');
  });

  it('dismissals', () => {
    const item = { code: 'no_contractor', task_id: 't1' };
    const key = copies['../src/lib/shared/attentionActions.ts'].dismissalKey(item);
    expect(key).toEqual(serverAttentionActions.dismissalKey(item));
    const d = [{ item_key: key, snooze_until: '2026-05-01', active: true }, { item_key: key, active: false }];
    ['2026-04-01', '2026-06-01'].forEach((day) => same('attentionActions.ts', 'isDismissed', item, d, day));
  });
});

function TASK_STATUSES() { return serverEnums.TASK_STATUSES; }
