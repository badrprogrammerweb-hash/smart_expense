import React from 'react';
const shimmer = { background: 'linear-gradient(90deg, var(--color-surface-sunken) 25%, var(--color-border) 37%, var(--color-surface-sunken) 63%)', backgroundSize: '400% 100%', animation: 'se-shimmer 1.6s ease infinite' };
export function Skeleton({ variant = 'text', width, height, count = 1 }) {
  const h = height || (variant === 'row' ? 56 : variant === 'card' ? 120 : 14);
  const items = Array.from({ length: count });
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
    items.map((_, i) => React.createElement('div', { key: i, style: { ...shimmer, width: width || '100%', height: h, borderRadius: variant === 'card' ? 'var(--radius-card)' : 6 } })));
}
