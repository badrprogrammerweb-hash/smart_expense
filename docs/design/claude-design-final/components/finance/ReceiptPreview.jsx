import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function ReceiptPreview({ src, fileName, onZoom }) {
  return React.createElement('div', { dir: 'rtl', style: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--color-surface-sunken)', fontFamily: 'var(--font-arabic)' } },
    React.createElement('div', { style: { position: 'relative', height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF2F6' },
      onClick: onZoom },
      src ? React.createElement('img', { src, alt: fileName || 'إيصال', style: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } }) : React.createElement(Icon, { name: 'file-image', size: 40, color: 'var(--color-text-faint)' }),
      React.createElement('button', { 'aria-label': 'تكبير', className: 'se-focusable', style: { position: 'absolute', top: 10, insetInlineEnd: 10, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } }, React.createElement(Icon, { name: 'zoom-in', size: 16 }))),
    fileName && React.createElement('div', { dir: 'ltr', style: { padding: '10px 14px', fontSize: 12, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, fileName));
}
