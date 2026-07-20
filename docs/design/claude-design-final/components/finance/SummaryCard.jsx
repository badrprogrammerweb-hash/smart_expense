import React from 'react';
import { Icon } from '../core/Icon.jsx';
export function SummaryCard({ label, amount, kind = 'neutral', icon, trend, emphasis = false, dir = 'rtl', currency = 'ر.س' }) {
  const color = kind === 'income' ? 'var(--color-income)' : kind === 'expense' ? 'var(--color-expense)' : 'var(--color-text)';
  return React.createElement('div', { dir, style: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: emphasis ? 24 : 18, fontFamily: 'var(--font-arabic)', display: 'flex', flexDirection: 'column', gap: 8 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
      React.createElement('span', { style: { fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 } }, label),
      icon && React.createElement('div', { style: { width: 32, height: 32, borderRadius: 8, background: kind === 'income' ? 'var(--color-income-subtle)' : kind === 'expense' ? 'var(--color-expense-subtle)' : 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: icon, size: 16, color }))),
    React.createElement('div', { dir: 'ltr', style: { fontSize: emphasis ? 'var(--text-financial-lg-size)' : 'var(--text-financial-md-size)', fontWeight: 'var(--text-financial-weight)', color, fontFeatureSettings: "'tnum' 1", textAlign: 'end' } }, amount, React.createElement('span', { style: { fontSize: 14, fontWeight: 500, marginInlineStart: 6, color: 'var(--color-text-muted)' } }, currency)),
    trend && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-text-muted)' } }, trend));
}
