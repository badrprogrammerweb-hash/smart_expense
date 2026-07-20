import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function PermissionDeniedState({ title = 'هذا الإجراء غير متاح لدورك', description, roleRequired }) {
  return React.createElement('div', { dir: 'rtl', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 10, padding: '48px 24px', fontFamily: 'var(--font-arabic)' } },
    React.createElement('div', { style: { width: 56, height: 56, borderRadius: '50%', background: 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: 'lock', size: 24, color: 'var(--color-text-muted)' })),
    React.createElement('div', { style: { fontSize: 16, fontWeight: 700, color: 'var(--color-text)' } }, title),
    React.createElement('div', { style: { fontSize: 14, color: 'var(--color-text-muted)', maxWidth: 380 } }, description || (roleRequired ? `هذا الإجراء متاح فقط لـ ${roleRequired}.` : 'راجع مالك مساحة العمل لطلب الصلاحية.')));
}
