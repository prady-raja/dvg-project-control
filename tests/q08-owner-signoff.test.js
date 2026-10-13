import { describe, expect, it } from 'vitest';
import { ackInput, needsAck, signoffState } from '../base44/shared/ownerSignoff.ts';
import { statementText, villaStatementView } from '../base44/shared/villaViews.ts';
import { buildIndex } from '../base44/shared/dashboardCore.ts';

const ok = { name: 'Mr Rao', date: '2026-03-10', method: 'Told to the engineer' };

describe('acknowledgement input', () => {
  it('needs a name, a real date and a method', () => {
    expect(() => ackInput({ ...ok, name: ' ' })).toThrow(/owner's name/);
    expect(() => ackInput({ ...ok, date: 'yesterday' })).toThrow(/date/);
    expect(() => ackInput({ ...ok, method: 'Smoke signal' })).toThrow(/how it was acknowledged/);
  });
  it('a photo or screenshot method needs the evidence; a verbal one does not', () => {
    expect(() => ackInput({ ...ok, method: 'Signed sheet (photo)' })).toThrow(/Attach/);
    expect(ackInput({ ...ok, method: 'Signed sheet (photo)', evidence_uri: 'files/x.jpg' }).owner_ack_evidence_uri).toBe('files/x.jpg');
    expect(ackInput(ok).owner_ack_evidence_uri).toBeNull();
  });
  it('cannot be dated in the future', () => expect(() => ackInput({ ...ok, date: '2026-03-20' }, { today: '2026-03-10' })).toThrow(/future/));
});

describe('when it is required', () => {
  const handed = { possession_status: 'Handed Over' };
  it('only in a handed-over villa of a project that requires it', () => {
    expect(needsAck({ location: handed, project: { owner_signoff: 'Required' } })).toBe(true);
    expect(needsAck({ location: handed, project: { owner_signoff: 'Optional' } })).toBe(false);
    expect(needsAck({ location: { possession_status: 'Not Handed Over' }, project: { owner_signoff: 'Required' } })).toBe(false);
  });
  it('state of a finished item', () => {
    expect(signoffState({ owner_ack_date: '2026-03-01' }, { location: handed })).toBe('signed');
    expect(signoffState({}, { location: handed })).toBe('awaiting');
    expect(signoffState({}, { location: { possession_status: 'Not Handed Over' } })).toBe('not_needed');
  });
});

describe('the statement shows sign-off', () => {
  const location = { id: 'v', project_id: 'p', villa_code: 'B-05', possession_status: 'Handed Over' };
  const tasks = [
    { id: 't1', project_id: 'p', location_id: 'v', name: 'Paint', status: 'Closed', actual_finish: '2026-03-01' },
    { id: 't2', project_id: 'p', location_id: 'v', name: 'Tiles', status: 'Closed', actual_finish: '2026-03-02', owner_ack_date: '2026-03-05', owner_ack_name: 'Mr Rao', owner_ack_method: 'Told to the engineer' },
  ];
  const snags = [{ id: 's1', location_id: 'v', title: 'Chipped tile', status: 'Closed' }];
  const ix = buildIndex({ projects: [{ id: 'p' }], locations: [location], tasks });
  const view = villaStatementView({ location, tasks, snags, ix, asOf: '2026-03-10' });
  it('lists finished work awaiting the owner, and what is signed', () => {
    expect(view.awaiting_signoff.map((i) => i.id)).toEqual(['t1', 's1']);
    expect(view.signed_off.map((i) => i.id)).toEqual(['t2']);
  });
  it('the text for WhatsApp says so', () => {
    const text = statementText(view);
    expect(text).toContain('DONE — WAITING FOR YOUR SIGN-OFF');
    expect(text).toContain('SIGNED OFF BY YOU: 1');
  });
  it('a villa not yet handed over asks for no sign-off', () => {
    const v = villaStatementView({ location: { ...location, possession_status: 'Not Handed Over' }, tasks, snags, ix, asOf: '2026-03-10' });
    expect(v.awaiting_signoff).toEqual([]);
  });
});
