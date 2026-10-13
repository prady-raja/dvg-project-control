import React from 'react';
import { createRoot } from 'react-dom/client';
import '@/index.css';
import StackTable from '@/components/common/StackTable';

// Wide tables shaped like the real ones (a 10-column handover board, a 900px matrix),
// inside the same page padding the app uses, to check a phone never scrolls sideways.
const wide = (cols, min) => (
  <StackTable>
    <div className="scroll-slim overflow-x-auto">
      <table className={`w-full text-sm ${min}`}>
        <thead><tr>{Array.from({ length: cols }, (_, i) => <th key={i} className="py-2 text-left">Column {i + 1}</th>)}</tr></thead>
        <tbody>
          {Array.from({ length: 4 }, (_, r) => (
            <tr key={r}>{Array.from({ length: cols }, (_, c) => <td key={c} className="py-2.5" {...(c === cols - 1 ? { "data-keep": "" } : {})}>{c === cols - 1 ? <a href="#x" data-testid={`link-${r}`}>Open</a> : `Row ${r + 1} value ${c + 1}`}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  </StackTable>
);

createRoot(document.getElementById('root')).render(
  <div className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-5">
    <section id="handover">{wide(10, 'min-w-[1000px]')}</section>
    <section id="matrix" className="mt-6">{wide(14, 'min-w-[900px]')}</section>
    <section id="small" className="mt-6">{wide(5, 'min-w-[640px]')}</section>
  </div>,
);
