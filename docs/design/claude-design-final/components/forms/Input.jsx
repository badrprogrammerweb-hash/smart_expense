import React, { useId } from 'react';
import { Icon } from '../core/Icon.jsx';
export function Input({ label, required, helper, error, icon, disabled, value, onChange, placeholder, type = 'text', dirOverride, ...rest }) {
  const id = useId();
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-arabic)' } },
    label && React.createElement('label', { htmlFor: id, style: { fontSize: 'var(--text-label-size)', fontWeight: 'var(--text-label-weight)', color: 'var(--color-text)' } }, label, required && React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
    React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center' } },
      icon && React.createElement('span', { style: { position: 'absolute', insetInlineStart: 12, color: 'var(--color-text-muted)', display: 'flex' } }, React.createElement(Icon, { name: icon, size: 16 })),
      React.createElement('input', { id, type, value, onChange, placeholder, disabled, dir: dirOverride, className: 'se-focusable', style: { width: '100%', height: 44, boxSizing: 'border-box', padding: icon ? '0 40px 0 12px' : '0 12px', borderRadius: 'var(--radius-control)', border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`, background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)', fontSize: 'var(--text-body-size)', color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' }, ...rest })),
    error ? React.createElement('span', { style: { fontSize: 12, color: 'var(--color-expense)' } }, error) : helper && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-text-muted)' } }, helper));
}
