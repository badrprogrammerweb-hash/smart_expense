import React from 'react';
import { Icon } from './Icon.jsx';
const tones = {
  info: { color: 'var(--color-info)', icon: 'info' },
  success: { color: 'var(--color-income)', icon: 'check-circle-2' },
  warning: { color: '#92620A', icon: 'triangle-alert' },
  error: { color: 'var(--color-expense)', icon: 'circle-x' },
};
export function Toast({ tone = 'info', title, description, onClose }) {
  const t = tones[tone] || tones.info;
  return React.createElement('div', { role: 'status', style: { display: 'flex', gap: 10, alignItems: 'flex-start', width: 340, padding: '14px 16px', borderRadius: 'var(--radius-card)', background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-dialog)', fontFamily: 'var(--font-arabic)' } },
    React.createElement(Icon, { name: t.icon, size: 18, color: t.color, style: { marginTop: 2, flexShrink: 0 } }),
    React.createElement('div', { style: { flex: 1 } },
      React.createElement('div', { style: { fontSize: 14, fontWeight: 700, color: 'var(--color-text)' } }, title),
      description && React.createElement('div', { style: { fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 } }, description)),
    onClose && React.createElement('button', { onClick: onClose, 'aria-label': 'إغلاق', className: 'se-focusable', style: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-faint)' } }, React.createElement(Icon, { name: 'x', size: 14 })));
}
