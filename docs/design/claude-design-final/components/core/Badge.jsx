import React from 'react';
const tones = {
  neutral: { bg: 'var(--color-surface-sunken)', color: 'var(--color-text-muted)', border: 'var(--color-border)' },
  primary: { bg: 'var(--color-primary-subtle)', color: 'var(--color-primary)', border: 'var(--color-primary-border)' },
  income: { bg: 'var(--color-income-subtle)', color: 'var(--color-income)', border: 'var(--color-income-border)' },
  expense: { bg: 'var(--color-expense-subtle)', color: 'var(--color-expense)', border: 'var(--color-expense-border)' },
  warning: { bg: 'var(--color-warning-subtle)', color: '#92620A', border: 'var(--color-warning-border)' },
  info: { bg: 'var(--color-info-subtle)', color: 'var(--color-info)', border: 'var(--color-info-border)' },
};
export function Badge({ children, tone = 'neutral', dot = false }) {
  const t = tones[tone] || tones.neutral;
  return React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 'var(--radius-pill)', background: t.bg, color: t.color, border: `1px solid ${t.border}`, fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-arabic)', whiteSpace: 'nowrap' } },
    dot && React.createElement('span', { style: { width: 6, height: 6, borderRadius: '50%', background: t.color } }),
    children);
}
