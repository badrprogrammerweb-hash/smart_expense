import React, { useId } from 'react';
export function AmountInput({ label = 'المبلغ', required, value, onChange, kind = 'expense', currency = 'ر.س', error, disabled }) {
  const id = useId();
  const color = kind === 'income' ? 'var(--color-income)' : kind === 'expense' ? 'var(--color-expense)' : kind === 'pending' ? '#92620A' : 'var(--color-text)';
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-arabic)' } },
    React.createElement('label', { htmlFor: id, style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)' } }, label, required && React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
    React.createElement('div', { dir: 'ltr', style: { display: 'flex', alignItems: 'center', height: 52, border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`, borderRadius: 'var(--radius-control)', background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)', overflow: 'hidden' } },
      React.createElement('input', { id, type: 'number', inputMode: 'decimal', step: '0.01', value, onChange, disabled, className: 'se-focusable', style: { flex: 1, border: 'none', outline: 'none', height: '100%', padding: '0 16px', fontSize: 24, fontWeight: 600, color, textAlign: 'end', fontFeatureSettings: "'tnum' 1", background: 'transparent', fontFamily: 'var(--font-numeric)' } }),
      React.createElement('span', { style: { padding: '0 14px', fontSize: 14, color: 'var(--color-text-muted)', borderInlineStart: '1px solid var(--color-border)', height: '100%', display: 'flex', alignItems: 'center' } }, currency)),
    error && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-expense)' } }, error));
}
