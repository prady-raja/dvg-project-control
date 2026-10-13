import React from 'react';
import { Download, FileText, MessageCircle, Printer, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/components/ui/use-toast';
import { copyText, downloadText, toCsv } from '@/lib/reportExport';
import { todayIst } from '@/lib/format';

/**
 * Share what is on screen (D-04): a CSV of the rows, a WhatsApp-ready text, or a
 * clean printed page (the print stylesheet hides the app frame). The text is
 * built from the figures already on the board — no AI involved.
 */
export default function ShareMenu({ title, text, rows, columns, filename, size = 'sm' }) {
  const { toast } = useToast();
  const hasCsv = Array.isArray(rows) && rows.length > 0 && Array.isArray(columns);

  const shareText = async () => {
    const body = typeof text === 'function' ? text() : text;
    if (!body) return;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text: body });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(body)}`, '_blank', 'noopener');
    if (await copyText(body)) toast({ description: 'Text copied as well, in case WhatsApp does not open.' });
  };

  const csv = () => downloadText(`${filename || title || 'export'}-${todayIst()}.csv`, toCsv(rows, columns), 'text/csv;charset=utf-8');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size={size} className="gap-2 print:hidden"><Share2 className="h-3.5 w-3.5" /> Share</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {text && <DropdownMenuItem onSelect={shareText}><MessageCircle className="mr-2 h-4 w-4" /> WhatsApp text</DropdownMenuItem>}
        {hasCsv && <DropdownMenuItem onSelect={csv}><Download className="mr-2 h-4 w-4" /> CSV for Excel</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => setTimeout(() => window.print(), 50)}><Printer className="mr-2 h-4 w-4" /> Print or save as PDF</DropdownMenuItem>
        {!text && !hasCsv && <DropdownMenuItem disabled><FileText className="mr-2 h-4 w-4" /> Nothing to share yet</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
