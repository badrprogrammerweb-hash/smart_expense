import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Button } from '../core/Button.jsx';
export function ErrorState({ title = 'حدث خطأ غير متوقع', description = 'تعذّر تحميل البيانات. حاول مرة أخرى.', onRetry }) {
  return React.createElement('div', { dir: 'rtl', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '48px 24px', fontFamily: 'var(--font-arabic)' } },
    React.createElement('div', { style: { width: 56, height: 56, borderRadius: '50%', background: 'var(--color-expense-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: 'circle-alert', size: 26, color: 'var(--color-expense)' })),
    React.createElement('div', { style: { fontSize: 16, fontWeight: 700, color: 'var(--color-text)' } }, title),
    React.createElement('div', { style: { fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 360 } }, description),
    onRetry && React.createElement(Button, { variant: 'secondary', icon: 'refresh-cw', onClick: onRetry }, 'إعادة المحاولة'));
}
