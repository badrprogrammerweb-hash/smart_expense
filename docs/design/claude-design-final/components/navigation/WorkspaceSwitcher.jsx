import React from 'react';
import { DropdownMenu } from '../overlays/DropdownMenu.jsx';
import { Icon } from '../core/Icon.jsx';
export function WorkspaceSwitcher({ current = { name: 'عائلة العتيبي', type: 'عائلي' }, workspaces = [], onSelect, lang = 'ar' }) {
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const items = [
    { label: `${current.name} — ${current.type}`, disabled: true },
    { divider: true },
    ...workspaces.map(w => ({ label: `${w.name} — ${w.type}`, onClick: () => onSelect && onSelect(w) })),
    { divider: true },
    { label: lang === 'en' ? 'Create new workspace' : 'إنشاء مساحة عمل جديدة', onClick: () => {} },
  ];
  return React.createElement(DropdownMenu, {
    align: 'start',
    dir,
    menuWidth: 'min(320px, calc(100vw - 32px))',
    trigger: React.createElement('button', { className: 'se-focusable se-row-hover se-ws-trigger', style: { display: 'flex', alignItems: 'center', gap: 8, height: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', minWidth: 0, width: '100%' } },
      React.createElement(Icon, { name: 'building-2', size: 16, color: 'var(--color-text-muted)', style: { flexShrink: 0 } }),
      React.createElement('span', { className: 'se-ws-name', style: { fontSize: 14, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } }, current.name),
      React.createElement('span', { className: 'se-ws-type', style: { fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 } }, current.type),
      React.createElement(Icon, { name: 'chevrons-up-down', size: 14, color: 'var(--color-text-muted)', style: { flexShrink: 0, marginInlineStart: 'auto' } })),
    items,
  });
}
