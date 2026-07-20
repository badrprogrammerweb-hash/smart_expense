import React from 'react';
import { Dialog } from './Dialog.jsx';
import { Button } from '../core/Button.jsx';
import { Icon } from '../core/Icon.jsx';
export function ConfirmDialog({ open, onClose, onConfirm, title = 'تأكيد الحذف', description, confirmLabel = 'حذف نهائي', cancelLabel = 'إلغاء', loading = false }) {
  return React.createElement(Dialog, { open, onClose, size: 'sm', title: null,
    footer: React.createElement(React.Fragment, null,
      React.createElement(Button, { variant: 'secondary', onClick: onClose, disabled: loading }, cancelLabel),
      React.createElement(Button, { variant: 'destructive', onClick: onConfirm, loading }, confirmLabel)) },
    React.createElement('div', { style: { display: 'flex', gap: 12, alignItems: 'flex-start' } },
      React.createElement('div', { style: { width: 40, height: 40, borderRadius: '50%', background: 'var(--color-expense-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
        React.createElement(Icon, { name: 'triangle-alert', size: 20, color: 'var(--color-expense)' })),
      React.createElement('div', null,
        React.createElement('div', { style: { fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 } }, title),
        React.createElement('div', { style: { fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 'var(--line-height-normal)' } }, description))));
}
