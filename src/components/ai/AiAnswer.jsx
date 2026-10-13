import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Download, Info, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { copyText, downloadText, todayStamp } from '@/lib/reportExport';
import { useToast } from '@/components/ui/use-toast';

const mdComponents = {
  h1: (props) => <h3 className="mt-4 font-display text-base font-semibold" {...props} />,
  h2: (props) => <h4 className="mt-4 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground" {...props} />,
  h3: (props) => <h5 className="mt-3 text-sm font-semibold" {...props} />,
  p: (props) => <p className="mt-2 text-sm leading-relaxed" {...props} />,
  ul: (props) => <ul className="mt-2 list-disc space-y-1 pl-5 text-sm" {...props} />,
  ol: (props) => <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  strong: (props) => <strong className="font-semibold" {...props} />,
  code: (props) => <code className="field-mono rounded bg-muted px-1 py-0.5 text-xs" {...props} />,
};

/** The one place an AI answer is shown, with its data date and its facts. */
export default function AiAnswer({ result, title = 'AI analysis', showFacts = true }) {
  const { toast } = useToast();
  if (!result) return null;

  if (result.configured === false) {
    return (
      <div className="rounded-xl border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/5 px-4 py-4">
        <p className="font-display text-sm font-semibold text-[hsl(var(--warning))]">AI Setup Required</p>
        <p className="mt-1 text-sm text-muted-foreground">{result.message}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Nothing else in the application depends on this: every dashboard, board and report keeps working from the records.
        </p>
      </div>
    );
  }

  if (result.error) {
    return <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{result.error}</p>;
  }

  const counts = result.facts?.counts;

  return (
    <div className="rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Data date {result.data_date}
            {result.scope?.project ? ` · ${result.scope.project}` : ''}
            {result.scope?.phase ? ` · ${result.scope.phase}` : ''}
            {result.model ? ` · ${result.model}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={async () => {
              const ok = await copyText(result.answer || '');
              toast({ description: ok ? 'Answer copied.' : 'Copying was blocked by the browser.' });
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => downloadText(`dvg-ai-${todayStamp()}.md`, result.answer || '', 'text/markdown;charset=utf-8')}
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </header>

      <div className="px-5 py-4">
        <ReactMarkdown components={mdComponents}>{result.answer || ''}</ReactMarkdown>
      </div>

      {showFacts && counts && (
        <div className="border-t border-border px-5 py-4">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <Info className="h-3.5 w-3.5" /> Figures the answer was given (calculated from records)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded border border-border px-1.5 py-0.5">{counts.open_tasks} open</span>
            <span className="rounded border border-border px-1.5 py-0.5">{counts.overdue_tasks} overdue</span>
            <span className="rounded border border-border px-1.5 py-0.5">{counts.blocked_tasks} blocked</span>
            <span className="rounded border border-border px-1.5 py-0.5">{counts.awaiting_verification} awaiting verification</span>
            <span className="rounded border border-border px-1.5 py-0.5">{counts.due_within_7} due within 7 days</span>
            <span className="rounded border border-border px-1.5 py-0.5">{counts.unscheduled_tasks} without dates</span>
            <span className="rounded border border-border px-1.5 py-0.5">{counts.demo_tasks_excluded} demo records excluded</span>
          </div>
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              The assistant can read and explain these records only. It cannot approve work, move a baseline, change permissions or
              write to a task record.
              {typeof result.remaining_today === 'number' ? ` ${result.remaining_today} AI request(s) left today.` : ''}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}