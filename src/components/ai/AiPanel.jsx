import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import AiAnswer from '@/components/ai/AiAnswer';
import { cn } from '@/lib/utils';

/**
 * The shell around every AI request: a question box for ask mode, a single
 * button for brief mode, and one place where the answer is rendered with its
 * data date. The caller supplies the guarded service call.
 */
export default function AiPanel({
  title,
  description,
  mode = 'ask',
  run,
  suggestions = [],
  placeholder = 'Ask about outstanding works, delays, blockers or contractor performance…',
  actionLabel = 'Ask DVG AI',
  answerTitle = 'AI analysis',
  disabled = false,
  disabledReason = '',
  className,
}) {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const execute = async (text) => {
    setLoading(true);
    setError('');
    try {
      const payload = await run(text ?? '');
      setResult(payload || {});
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'The request could not be completed.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        </div>
        {description && <p className="mt-1.5 text-xs text-muted-foreground">{description}</p>}

        {disabled ? (
          <p className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{disabledReason}</p>
        ) : (
          <>
            {mode === 'ask' && (
              <>
                <Textarea
                  className="mt-3"
                  rows={3}
                  value={question}
                  placeholder={placeholder}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                {!!suggestions.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {suggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setQuestion(item)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <Button className="mt-3 gap-2" disabled={loading || (mode === 'ask' && !question.trim())} onClick={() => execute(question)}>
              <Sparkles className="h-4 w-4" />
              {loading ? 'Working…' : actionLabel}
            </Button>
          </>
        )}

        {loading && (
          <p className="mt-3 text-xs text-muted-foreground">
            Reading the permitted records, calculating the figures, then asking the model to explain them.
          </p>
        )}
      </div>

      {error && <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}
      <AiAnswer result={result} title={answerTitle} />
    </div>
  );
}