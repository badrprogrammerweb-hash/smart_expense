import React from 'react';
import { Icon } from './Icon.jsx';
const tones = {
  info: { bg: 'var(--color-info-subtle)', border: 'var(--color-info-border)', color: 'var(--color-info)', icon: 'info' },
  success: { bg: 'var(--color-income-subtle)', border: 'var(--color-income-border)', color: 'var(--color-income)', icon: 'check-circle-2' },
  warning: { bg: 'var(--color-warning-subtle)', border: 'var(--color-warning-border)', color: '#92620A', icon: 'triangle-alert' },
  error: { bg: 'var(--color-expense-subtle)', border: 'var(--color-expense-border)', color: 'var(--color-expense)', icon: 'circle-x' },
};
export function Alert({ tone = 'info', title, children, onDismiss }) {
  const t = tones[tone] || tones.info;
  return React.createElement('div', { role: 'alert', style: { display: 'flex', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius-card)', background: t.bg, border: `1px solid ${t.border}`, fontFamily: 'var(--font-arabic)' } },
    React.createElement(Icon, { name: t.icon, size: 20, color: t.color, style: { flexShrink: 0, marginTop: 2 } }),
    React.createElement('div', { style: { flex: 1 } },
      title && React.createElement('div', { style: { fontSize: 14, fontWeight: 700, color: t.color, marginBottom: children ? 4 : 0 } }, title),
      children && React.createElement('div', { style: { fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-normal)' } }, children)),
    onDismiss && React.createElement('button', { onClick: onDismiss, 'aria-label': 'إغلاق', className: 'se-focusable', style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 } }, React.createElement(Icon, { name: 'x', size: 16 })));
}
