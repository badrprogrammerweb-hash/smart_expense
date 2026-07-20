import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function FileUpload({ label = 'إيصال أو فاتورة', fileName, progress, status = 'idle', onPick, hint = 'JPG، PNG أو PDF — حتى 10MB' }) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'var(--font-arabic)' } },
    React.createElement('span', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)' } }, label),
    React.createElement('label', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 24, borderRadius: 'var(--radius-card)', border: '1.5px dashed var(--color-border-strong)', background: 'var(--color-surface-hover)', cursor: 'pointer', textAlign: 'center' } },
      React.createElement('input', { type: 'file', onChange: onPick, style: { display: 'none' } }),
      React.createElement(Icon, { name: status === 'error' ? 'circle-x' : 'upload', size: 24, color: status === 'error' ? 'var(--color-expense)' : 'var(--color-text-muted)' }),
      fileName ? React.createElement('span', { dir: 'ltr', style: { fontSize: 13, color: 'var(--color-text)' } }, fileName) : React.createElement('span', { style: { fontSize: 13, color: 'var(--color-text)' } }, 'اسحب الملف هنا أو انقر للاختيار'),
      React.createElement('span', { style: { fontSize: 12, color: 'var(--color-text-muted)' } }, hint)),
    status === 'uploading' && React.createElement('div', { style: { height: 6, borderRadius: 99, background: 'var(--color-border)', overflow: 'hidden' } },
      React.createElement('div', { style: { width: `${progress || 0}%`, height: '100%', background: 'var(--color-primary)', transition: 'width .2s ease' } })),
    status === 'error' && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-expense)' } }, 'تعذّر رفع الملف. حاول مرة أخرى.'));
}
