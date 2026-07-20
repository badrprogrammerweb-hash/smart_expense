import React from 'react';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../core/Badge.jsx';
export function MobileRecordCard({ icon = 'shopping-cart', title, category, date, amount, kind = 'expense', status, onClick, currency = 'ر.س', actions, cornerAction }) {
  const amountColor = kind === 'income' ? 'var(--color-income)' : 'var(--color-expense)';
  return React.createElement('div', { onClick, role: onClick ? 'button' : undefined, tabIndex: onClick ? 0 : undefined, className: `se-focusable ${onClick ? 'se-row-hover' : ''}`.trim(), style: { position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', boxSizing: 'border-box', padding: '14px', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontFamily: 'var(--font-arabic)', textAlign: 'start', cursor: onClick ? 'pointer' : 'default' } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 44 } },
    React.createElement('div', { className: 'se-mrc-icon', style: { borderRadius: '50%', background: kind === 'income' ? 'var(--color-income-subtle)' : 'var(--color-expense-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: icon, size: 18, color: amountColor })),
    React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 } },
        React.createElement('span', { className: 'se-mrc-title', style: { fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } }, title),
        React.createElement('span', { className: 'se-mrc-amount', dir: 'ltr', style: { fontWeight: 700, color: amountColor, flexShrink: 0, fontFeatureSettings: "'tnum' 1" } }, `${kind === 'income' ? '+' : '-'}${amount} ${currency}`)),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
        React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--color-text-muted)' } },
          React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, category),
          category && date && React.createElement('span', null, '•'),
          React.createElement('span', { dir: 'ltr', style: { flexShrink: 0 } }, date),
          status && React.createElement(Badge, { tone: 'warning' }, status)),
        cornerAction && React.createElement('div', { style: { flexShrink: 0 } }, cornerAction)))),
    actions && React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--color-border)' } }, actions));
}
