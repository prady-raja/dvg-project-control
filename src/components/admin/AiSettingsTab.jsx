import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { items } from '@/lib/dataHelpers';
import { AI_MODELS, aiStatus } from '@/lib/aiService';
import { createRecord, updateRecord } from '@/lib/recordService';
import { MEMBERSHIP_ROLES } from '@/lib/constants';
import BoardSection from '@/components/common/BoardSection';
import Field from '@/components/common/Field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

/**
 * Stage B / 15 — administrative control of the assistant: on or off, who may
 * use it, which model, and the daily usage limit. The API key itself is never
 * held here; this screen only reports whether it is configured.
 */
export default function AiSettingsTab() {
  const { toast } = useToast();
  const [status, setStatus] = useState(null);
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [statusPayload, records] = await Promise.all([
          aiStatus(),
          base44.entities.AiSettings.list({ limit: 1 }),
        ]);
        if (!alive) return;
        const existing = items(records)[0] || null;
        setStatus(statusPayload);
        setRecord(existing);
        setForm({
          enabled: existing?.enabled !== false,
          allowed_roles: existing?.allowed_roles?.length ? existing.allowed_roles : statusPayload.allowed_roles || [],
          model: existing?.model || statusPayload.model || 'gpt-4o-mini',
          daily_request_limit: existing?.daily_request_limit ?? statusPayload.daily_limit ?? 40,
          context_item_limit: existing?.context_item_limit ?? 40,
          instructions: existing?.instructions || '',
          notes: existing?.notes || '',
        });
      } catch (e) {
        if (alive) setError(e?.message || 'Could not load the AI settings.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        enabled: !!form.enabled,
        allowed_roles: form.allowed_roles,
        model: form.model,
        daily_request_limit: Number(form.daily_request_limit) || 0,
        context_item_limit: Number(form.context_item_limit) || 40,
        instructions: form.instructions,
        notes: form.notes,
      };
      if (record?.id) await updateRecord('AiSettings', record.id, payload);
      else await createRecord('AiSettings', payload);
      const fresh = await aiStatus();
      setStatus(fresh);
      toast({ description: 'AI controls saved.' });
    } catch (e) {
      setError(e?.message || 'Could not save the AI controls.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-72 rounded-xl" />;
  if (!form) return <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error || 'AI settings unavailable.'}</p>;

  return (
    <div className="space-y-5">
      <BoardSection
        title="Connection"
        description="The OpenAI key lives in the application's server-side secrets and is never sent to the browser."
      >
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium',
              status?.configured ? 'border-[hsl(var(--success))]/40 text-[hsl(var(--success))]' : 'border-[hsl(var(--warning))]/40 text-[hsl(var(--warning))]',
            )}
          >
            {status?.configured ? 'API key configured' : 'AI Setup Required'}
          </span>
          <span className="text-xs text-muted-foreground">
            {status?.configured
              ? `Secret ${status.key_name} is present. ${status.used_today} of ${status.daily_limit} request(s) used today.`
              : `Add the secret ${status?.key_name || 'OPENAI_API_KEY'} in the app's Secrets settings. Until then the AI screens show a setup notice and everything else keeps working.`}
          </span>
        </div>
      </BoardSection>

      <BoardSection title="Controls" description="Who may use the assistant, which model it uses, and how much it may be used.">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch id="ai-enabled" checked={!!form.enabled} onCheckedChange={(value) => setForm((f) => ({ ...f, enabled: value }))} />
            <Label htmlFor="ai-enabled" className="text-sm">Enable the AI assistant</Label>
          </div>

          <Field label="Project roles allowed to use AI" hint="An application administrator is always allowed. A user must hold the role on the project they are asking about.">
            <div className="flex flex-wrap gap-2">
              {MEMBERSHIP_ROLES.map((role) => {
                const on = form.allowed_roles.includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        allowed_roles: on ? f.allowed_roles.filter((r) => r !== role) : [...f.allowed_roles, role],
                      }))
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs transition-colors',
                      on ? 'border-primary bg-secondary text-foreground' : 'border-border text-muted-foreground',
                    )}
                  >
                    {role}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Model" hint="Higher-quality models cost more per request.">
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              >
                {AI_MODELS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Daily requests per user" hint="0 means no limit.">
              <Input
                type="number"
                min="0"
                value={form.daily_request_limit}
                onChange={(e) => setForm((f) => ({ ...f, daily_request_limit: e.target.value }))}
              />
            </Field>
            <Field label="Records per request" hint="Bounds what is sent to the provider.">
              <Input
                type="number"
                min="10"
                max="200"
                value={form.context_item_limit}
                onChange={(e) => setForm((f) => ({ ...f, context_item_limit: e.target.value }))}
              />
            </Field>
          </div>

          <Field label="Standing instructions" hint="Appended to every request, e.g. a house style for briefs.">
            <Textarea rows={2} value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
          </Field>

          {error && <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

          <Button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save AI controls'}</Button>

          <p className="text-xs text-muted-foreground">
            Every request is logged (user, day, action, model, tokens, outcome) so usage can be reviewed. Failures from the provider are
            recorded too and shown to the user rather than being replaced with an invented answer.
          </p>
        </div>
      </BoardSection>
    </div>
  );
}