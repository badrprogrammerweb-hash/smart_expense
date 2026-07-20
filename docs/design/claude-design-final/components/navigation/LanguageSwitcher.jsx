import React from 'react';
import { DropdownMenu } from '../overlays/DropdownMenu.jsx';
import { Icon } from '../core/Icon.jsx';
export function LanguageSwitcher({ lang = 'ar', onChange, className, compact }) {
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const label = lang === 'ar' ? 'العربية' : 'English';
  const items = [
    { label: 'العربية', onClick: () => onChange && onChange('ar') },
    { label: 'English', onClick: () => onChange && onChange('en') },
  ];
  if (compact) {
    return React.createElement('div', { className: `se-lang-switcher ${className || ''}`.trim(), style: { display: 'flex', alignItems: 'center' } },
      React.createElement(DropdownMenu, { align: lang === 'ar' ? 'start' : 'end', dir, menuMinWidth: 130, trigger: React.createElement('button', { className: 'se-focusable se-row-hover', 'aria-label': lang === 'ar' ? 'تغيير اللغة' : 'Change language', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, minWidth: 44, minHeight: 44, boxSizing: 'border-box', borderRadius: '50%', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: 15, fontWeight: 700, color: 'var(--color-text)', flexShrink: 0 } }, lang === 'ar' ? 'ع' : 'E'), items }));
  }
  return React.createElement('div', { className: `se-lang-switcher ${className || ''}`.trim(), style: { display: 'flex', alignItems: 'center' } },
    React.createElement(DropdownMenu, { align: lang === 'ar' ? 'start' : 'end', dir, menuMinWidth: 130, trigger: React.createElement('button', { className: 'se-focusable se-row-hover se-lang-trigger', 'aria-label': lang === 'ar' ? 'تغيير اللغة' : 'Change language', style: { display: 'flex', alignItems: 'center', gap: 6, height: 44, boxSizing: 'border-box', padding: '0 10px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', cursor: 'pointer' } },
      React.createElement(Icon, { name: 'globe', size: 16, color: 'var(--color-text-muted)' }),
      React.createElement('span', { className: 'se-lang-label', style: { fontSize: 13, fontWeight: 600, color: 'var(--color-text)', whiteSpace: 'nowrap' } }, label),
      React.createElement(Icon, { name: 'chevron-down', size: 13, color: 'var(--color-text-muted)' })),
      items }));
}
