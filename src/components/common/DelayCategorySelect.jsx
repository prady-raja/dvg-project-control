import React from 'react';
import Field from '@/components/common/Field';
import EnumSelect from '@/components/common/EnumSelect';
import { DELAY_CATEGORIES } from '@/lib/shared/enums.ts';

/** Why a forecast date moved, from a fixed list so delay causes can be counted. Required with every forecast change. */
export default function DelayCategorySelect({ value, onChange, label = 'Delay category', required = true }) {
  return (
    <Field label={label} required={required} hint="Pick the main cause — it is counted in the delay chart.">
      <EnumSelect value={value} onChange={onChange} options={DELAY_CATEGORIES} placeholder="Why did it move?" />
    </Field>
  );
}