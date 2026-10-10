// X-02 — invites failed and new members could not see older records.
import { describe, expect, it } from 'vitest';
import {
  MEMBER_ID_ENTITIES, MEMBERSHIP_ROLES, isMembershipRole, syncProjectMemberIds,
} from '../base44/shared/access.ts';
import { MEMBERSHIP_ROLES as UI_ROLES } from '@/lib/constants';

/** A fake service-role client that records updateMany calls. */
function fakeClient({ projectMemberIds = [], batchesPerEntity = 1 } = {}) {
  const calls = {};
  const entities = new Proxy({}, {
    get(_, name) {
      return {
        filter: async () => (name === 'Project' ? [{ id: 'p1', member_ids: projectMemberIds }] : []),
        update: async () => ({}),
        updateMany: async () => {
          calls[name] = (calls[name] || 0) + 1;
          return { has_more: calls[name] < batchesPerEntity };
        },
      };
    },
  });
  return { calls, client: { asServiceRole: { entities } } };
}

describe('X-02 membership roles', () => {
  it('accepts Project Editor, the default role of every invite', () => {
    expect(isMembershipRole('Project Editor')).toBe(true);
    expect(isMembershipRole('Viewer')).toBe(true);
    expect(isMembershipRole('Owner')).toBe(false);
  });

  it('the screens offer exactly the roles the server accepts', () => {
    expect(UI_ROLES).toEqual(MEMBERSHIP_ROLES);
  });
});

describe('X-02 member_ids mirror', () => {
  it('covers every entity whose read rule depends on member_ids', () => {
    for (const name of ['VillaFloor', 'VillaArea', 'Drawing', 'MeetingCommitment', 'Snag', 'ImportBatch',
      'RecordAudit', 'RefAllocation', 'AiProposal']) {
      expect(MEMBER_ID_ENTITIES).toContain(name);
    }
  });

  it('force backfills even when Project.member_ids is unchanged', async () => {
    const { calls, client } = fakeClient({ projectMemberIds: ['u1'] });
    await syncProjectMemberIds(client, 'p1', ['u1'], { force: true });
    expect(calls.VillaFloor).toBe(1);
    expect(calls.Drawing).toBe(1);
  });

  it('without force, an unchanged project costs no sweep', async () => {
    const { calls, client } = fakeClient({ projectMemberIds: ['u1'] });
    await syncProjectMemberIds(client, 'p1', ['u1']);
    expect(calls).toEqual({});
  });

  it('keeps going until has_more is false', async () => {
    const { calls, client } = fakeClient({ batchesPerEntity: 7 });
    await syncProjectMemberIds(client, 'p1', ['u1', 'u2'], { force: true });
    expect(calls.Task).toBe(7);
  });
});
