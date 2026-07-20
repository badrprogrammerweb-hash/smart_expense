import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function Pagination({ page = 1, totalPages = 1, onChange, dir = 'rtl', label }) {
  const go = (p) => p >= 1 && p <= totalPages && onChange && onChange(p);
  const text = label || (dir === 'rtl' ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`);
  const prevIcon = dir === 'rtl' ? 'chevron-right' : 'chevron-left';
  const nextIcon = dir === 'rtl' ? 'chevron-left' : 'chevron-right';
  return React.createElement('div', { dir, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'var(--font-arabic)', fontSize: 13, color: 'var(--color-text-muted)' } },
    React.createElement('span', { dir: dir === 'rtl' ? 'rtl' : 'ltr' }, text),
    React.createElement('div', { style: { display: 'flex', gap: 4 } },
      React.createElement('button', { onClick: () => go(page - 1), disabled: page <= 1, className: 'se-focusable se-row-hover', style: { width: 36, height: 36, borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: prevIcon, size: 16 })),
      React.createElement('button', { onClick: () => go(page + 1), disabled: page >= totalPages, className: 'se-focusable se-row-hover', style: { width: 36, height: 36, borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: nextIcon, size: 16 }))));
}
