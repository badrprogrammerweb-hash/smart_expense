import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function SearchField({ value, onChange, placeholder = 'بحث…' }) {
  return React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center', minWidth: 220 } },
    React.createElement(Icon, { name: 'search', size: 16, color: 'var(--color-text-muted)', style: { position: 'absolute', insetInlineStart: 12 } }),
    React.createElement('input', { value, onChange, placeholder, className: 'se-focusable', style: { width: '100%', height: 40, boxSizing: 'border-box', padding: '0 40px 0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', fontSize: 14, fontFamily: 'var(--font-arabic)', color: 'var(--color-text)' } }));
}
