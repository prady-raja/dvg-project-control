import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import EnumSelect from '@/components/common/EnumSelect';

/**
 * Optional manpower: one row per trade. The total is the sum of the rows, so
 * nobody has to add it up on site.
 */
export default function ManpowerEditor({ rows, onChange, disciplines = [], defaultDiscipline }) {
  const list = rows || [];
  const options = disciplines.map((d) => ({ value: d.code, label: d.name }));
  const total = list.reduce((sum, row) => sum + (Number(row.count) || 0), 0);

  const update = (index, key, value) =>
    onChange(list.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

  return (
    <div className="space-y-2">
      {list.map((row, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <EnumSelect
              value={row.discipline}
              onChange={(v) => update(index, 'discipline', v)}
              options={options}
              placeholder="Trade"
              size="sm"
            />
          </div>
          <Input
            type="number"
            min="0"
            inputMode="numeric"
            className="w-20"
            placeholder="Nos"
            value={row.count}
            onChange={(e) => update(index, 'count', e.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove trade"
            className="shrink-0 text-muted-foreground"
            onClick={() => onChange(list.filter((_, i) => i !== index))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5 px-2 text-xs text-muted-foreground"
          onClick={() => onChange([...list, { discipline: defaultDiscipline || '', count: '' }])}
        >
          <Plus className="h-3.5 w-3.5" /> Add trade
        </Button>
        {total > 0 && <span className="field-mono text-xs text-muted-foreground">Total {total}</span>}
      </div>
    </div>
  );
}