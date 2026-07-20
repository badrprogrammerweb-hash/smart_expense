import React, { useId } from 'react';
export function Textarea({ label, required, value, onChange, placeholder, rows = 3, helper, error, disabled }) {
  const id = useId();
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-arabic)' } },
    label && React.createElement('label', { htmlFor: id, style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)' } }, label, required && React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
    React.createElement('textarea', { id, value, onChange, placeholder, rows, disabled, className: 'se-focusable', style: { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 'var(--radius-control)', border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`, background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)', fontSize: 15, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)', resize: 'vertical', lineHeight: 'var(--line-height-normal)' } }),
    error ? React.createElement('span', { style: { fontSize: 12, color: 'var(--color-expense)' } }, error) : helper && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-text-muted)' } }, helper));
}
