import React from 'react';
import EnumSelect from '@/components/common/EnumSelect';
import { useProjectMembers } from '@/hooks/useProjectMembers';

/** Choose a project member. The value is their user id; '' means unassigned. */
export default function UserPicker({ projectId, value, onChange, placeholder = 'Unassigned', disabled }) {
  const { members, loading } = useProjectMembers(projectId);
  const options = [{ value: '', label: placeholder }, ...members.map((m) => ({ value: m.user_id, label: m.name }))];
  // A user who has since left the project stays visible rather than blank.
  const known = !value || members.some((m) => m.user_id === value);
  const list = known ? options : [...options, { value, label: 'Former member' }];
  return (
    <EnumSelect
      value={value || ''}
      onChange={onChange}
      options={list}
      placeholder={loading ? 'Loading…' : placeholder}
      disabled={disabled || !projectId}
    />
  );
}
