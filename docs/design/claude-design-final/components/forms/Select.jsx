import React, { useId } from 'react';
import { Icon } from '../core/Icon.jsx';
export function Select({ label, required, value, onChange, options = [], placeholder = 'اختر…', disabled, error }) {
  const id = useId();
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-arabic)' } },
    label && React.createElement('label', { htmlFor: id, style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)' } }, label, required && React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
    React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center' } },
      React.createElement('select', { id, value, onChange, disabled, className: 'se-focusable', style: { width: '100%', height: 44, boxSizing: 'border-box', padding: '0 36px 0 12px', borderRadius: 'var(--radius-control)', border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`, background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)', fontSize: 15, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)', appearance: 'none' } },
        React.createElement('option', { value: '', disabled: true }, placeholder),
        options.map(o => React.createElement('option', { key: o.value, value: o.value, disabled: o.disabled }, o.label))),
      React.createElement('span', { style: { position: 'absolute', insetInlineStart: 12, color: 'var(--color-text-muted)', pointerEvents: 'none', display: 'flex' } }, React.createElement(Icon, { name: 'chevron-down', size: 16 }))),
    error && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-expense)' } }, error));
}
