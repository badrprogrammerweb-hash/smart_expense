import React, { useEffect } from 'react';
import { IconButton } from '../core/IconButton.jsx';
export function Dialog({ open, onClose, title, description, children, footer, size = 'md', dir = 'rtl', mobileFullSheet = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose(); };
    window.addEventListener('keydown', onKey);
    const scroller = document.querySelector('.se-app-main') || document.body;
    const prevOverflow = scroller.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    scroller.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); scroller.style.overflow = prevOverflow; document.body.style.overflow = prevBodyOverflow; };
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: 380, md: 480, lg: 640 };
  const width = typeof size === 'number' ? size : (widths[size] || widths.md);
  return React.createElement('div', { className: `se-dialog-overlay ${mobileFullSheet ? 'se-dialog-overlay-sheet' : ''}`.trim(), onClick: onClose },
    React.createElement('div', { dir, onClick: (e) => e.stopPropagation(), className: `se-dialog-panel ${mobileFullSheet ? 'se-dialog-panel-sheet' : ''}`.trim(), style: { '--se-dialog-width': width + 'px', fontFamily: 'var(--font-arabic)' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '20px 20px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 } },
        React.createElement('div', null,
          React.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: 'var(--color-text)' } }, title),
          description && React.createElement('div', { style: { fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 } }, description)),
        React.createElement(IconButton, { icon: 'x', label: dir === 'ltr' ? 'Close' : 'إغلاق', onClick: onClose })),
      React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '16px 20px' } }, children),
      footer && React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-start', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--color-border)', flexShrink: 0 } }, footer)));
}
