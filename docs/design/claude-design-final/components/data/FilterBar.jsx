import React from 'react';
export function FilterBar({ children, dir = 'rtl' }) {
  return React.createElement('div', { dir, style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: 12, borderRadius: 'var(--radius-card)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' } }, children);
}
