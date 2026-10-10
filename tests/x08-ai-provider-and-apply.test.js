// X-08 — the AI assistant could not run and could leave proposals half applied.
import { describe, expect, it, vi } from 'vitest';
import { chooseProvider, makeProvider } from '../base44/shared/aiProvider.ts';
import { applyProposal, proposalStatus, resultKey } from '../base44/shared/assistApply.ts';
import { aiUpdateForm, aiUpdatePayload } from '@/lib/aiUpdateForm';

describe('X-08 provider selection', () => {
  it('falls back to Base44 InvokeLLM when no key is stored', () => {
    expect(chooseProvider({}, {}, { invokeAvailable: true })?.kind).toBe('base44');
    expect(chooseProvider({}, {}, { invokeAvailable: false })).toBeNull();
  });

  it('prefers a stored key (the portable provider)', () => {
    const choice = chooseProvider({ model: 'gpt-4o-mini' }, { ANTHROPIC_API_KEY: 'k' }, { invokeAvailable: true });
    expect(choice).toMatchObject({ kind: 'fetch', api: 'anthropic' });
    expect(choice.model).toMatch(/^claude/);
  });

  it('an administrator can force Base44 even when a key without credits is stored', () => {
    const choice = chooseProvider({ provider: 'base44' }, { OPENAI_API_KEY: 'k' }, { invokeAvailable: true });
    expect(choice.kind).toBe('base44');
  });

  it('the Base44 provider returns JSON text for a JSON request', async () => {
    const invokeLLM = vi.fn(async () => ({ intent: 'update_progress' }));
    const provider = makeProvider({ kind: 'base44', api: 'base44', model: 'base44-default' }, { invokeLLM });
    const { content } = await provider.complete({ system: 'S', user: 'U', json: true });
    expect(JSON.parse(content)).toEqual({ intent: 'update_progress' });
    expect(invokeLLM.mock.calls[0][0].response_json_schema).toBeTruthy();
  });

  it('the fetch provider speaks the Anthropic messages API', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'Here: {"a":1}' }], usage: { input_tokens: 3, output_tokens: 2 } }),
    }));
    const provider = makeProvider(
      { kind: 'fetch', api: 'anthropic', apiKey: 'k', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-5-5' },
      { fetchImpl },
    );
    const { content, usage } = await provider.complete({ system: 'S', user: 'U', json: true });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.anthropic.com/v1/messages');
    expect(JSON.parse(content)).toEqual({ a: 1 });
    expect(usage.total_tokens).toBe(5);
  });
});

describe('X-08 server-side apply', () => {
  const actions = [
    { action_id: 'a1', type: 'record_progress', payload: { task_id: 't1' }, review: { task_ref: 'IMG-A-0001' } },
    { action_id: 'a2', type: 'raise_snag', payload: { snag: { title: 'Crack' } } },
  ];

  it('stores each result under external_id:index and resumes only what was not written', async () => {
    let failSnag = true;
    const invoke = vi.fn(async (fn) => {
      if (fn === 'snagWrite' && failSnag) throw new Error('Timed out');
      return { data: fn === 'snagWrite' ? { snag: { snag_ref: 'SN-1' } } : { task: { id: 't1', task_ref: 'IMG-A-0001' } } };
    });

    const first = await applyProposal({ externalId: 'PR-1', allActions: actions, selected: actions, invoke });
    expect(first.map((r) => r.result_key)).toEqual([resultKey('PR-1', 0), resultKey('PR-1', 1)]);
    expect(proposalStatus(first, 2)).toBe('Partial');

    failSnag = false;
    invoke.mockClear();
    const second = await applyProposal({ externalId: 'PR-1', allActions: actions, selected: actions, previous: first, invoke });
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke.mock.calls[0][0]).toBe('snagWrite');
    expect(proposalStatus(second, 2)).toBe('Applied');
  });
});

describe('X-08 update panel form', () => {
  const payload = {
    proposed: { task_ref: 'IMG-A-0007' },
    candidates: [{ task_id: 't7', ref: 'IMG-A-0007', status: 'Blocked', discipline_code: 'FIN' }],
  };

  it("pre-selects the matched task and keeps the task's own status", () => {
    const form = aiUpdateForm(payload, 'false ceiling done');
    expect(form.task_id).toBe('t7');
    expect(form.status).toBe('Blocked');
    expect(form.manpower_discipline).toBe('FIN');
  });

  it('sends the forecast date and its reason', () => {
    const form = { ...aiUpdateForm(payload, 'x'), forecast: '2026-11-30', date_revision_reason: 'Late tiles' };
    expect(aiUpdatePayload(form, '2026-10-10')).toMatchObject({
      current_forecast_finish: '2026-11-30', date_revision_reason: 'Late tiles',
    });
  });
});
