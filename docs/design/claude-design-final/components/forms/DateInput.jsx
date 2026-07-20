import React, { useId } from 'react';
import { Icon } from '../core/Icon.jsx';
export function DateInput({ label = 'التاريخ', value, onChange, required, error, disabled }) {
  const id = useId();
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-arabic)' } },
    React.createElement('label', { htmlFor: id, style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)' } }, label, required && React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
    React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center' } },
      React.createElement('input', { id, type: 'text', dir: 'ltr', placeholder: 'DD/MM/YYYY', value, onChange, disabled, className: 'se-focusable', style: { width: '100%', height: 44, boxSizing: 'border-box', padding: '0 40px 0 12px', borderRadius: 'var(--radius-control)', border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`, background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)', fontSize: 15, textAlign: 'end', fontFeatureSettings: "'tnum' 1", fontFamily: 'var(--font-numeric)' } }),
      React.createElement('span', { style: { position: 'absolute', insetInlineStart: 12, color: 'var(--color-text-muted)', display: 'flex' } }, React.createElement(Icon, { name: 'calendar', size: 16 }))),
    error && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-expense)' } }, error));
}
