import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';
export function EmptyState({ icon = 'inbox', title, description, actionLabel, onAction, dir = 'rtl' }) {
  return React.createElement('div', { dir, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '48px 24px', fontFamily: 'var(--font-arabic)' } },
    React.createElement('div', { style: { width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: icon, size: 26, color: 'var(--color-text-muted)' })),
    React.createElement('div', { style: { fontSize: 16, fontWeight: 700, color: 'var(--color-text)' } }, title),
    description && React.createElement('div', { style: { fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 360 } }, description),
    actionLabel && React.createElement(Button, { onClick: onAction, icon: 'plus' }, actionLabel));
}
