import React from 'react';
import { WorkspaceSwitcher } from './WorkspaceSwitcher.jsx';
import { LanguageSwitcher } from './LanguageSwitcher.jsx';
import { DropdownMenu } from '../overlays/DropdownMenu.jsx';
import { Icon } from '../core/Icon.jsx';
export function TopHeader({ user = { name: 'سارة العتيبي', role: 'مالك' }, workspace, workspaces, onSelectWorkspace, onMenu, lang, onLangChange }) {
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const userLine = { label: `${user.name} — ${user.role}`, disabled: true };
  const menuLabels = lang === 'en'
    ? [userLine, { divider: true }, { label: 'Profile' }, { label: 'Settings' }, { divider: true }, { label: 'Sign out', destructive: true }]
    : [userLine, { divider: true }, { label: 'الملف الشخصي' }, { label: 'الإعدادات' }, { divider: true }, { label: 'تسجيل الخروج', destructive: true }];
  const accountTrigger = React.createElement(DropdownMenu, { align: 'end', dir, menuMinWidth: 200, trigger: React.createElement('button', { className: 'se-focusable se-row-hover se-user-trigger', 'aria-label': lang === 'en' ? 'Account menu' : 'قائمة الحساب', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 44, minHeight: 44, boxSizing: 'border-box', padding: '0 8px', borderRadius: 'var(--radius-control)', border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0, overflow: 'hidden' } },
    React.createElement('div', { className: 'se-user-avatar', style: { width: 32, height: 32, borderRadius: '50%', background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, position: 'relative' } },
      user.name.slice(0, 1),
      React.createElement('span', { className: 'se-account-chevron', style: { position: 'absolute', bottom: -2, insetInlineEnd: -2, width: 14, height: 14, borderRadius: '50%', background: 'var(--color-surface)', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        React.createElement(Icon, { name: 'chevron-down', size: 9, color: 'var(--color-text-muted)' }))),
    React.createElement('div', { className: 'se-user-info', style: { textAlign: 'start' } },
      React.createElement('div', { style: { fontSize: 13, fontWeight: 600, color: 'var(--color-text)' } }, user.name),
      React.createElement('div', { style: { fontSize: 11, color: 'var(--color-text-muted)' } }, user.role))),
    items: menuLabels });
  return React.createElement(React.Fragment, null,
    React.createElement('header', { dir, className: 'se-top-header', style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 20px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', fontFamily: 'var(--font-arabic)' } },
      React.createElement('div', { className: 'se-th-row1', style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%' } },
        onMenu && React.createElement('button', { onClick: onMenu, className: 'se-focusable', style: { display: 'none', border: 'none', background: 'none' } }),
        React.createElement('div', { className: 'se-th-workspace', style: { display: 'flex', alignItems: 'center', minWidth: 0, flex: '1 1 auto' } },
          React.createElement(WorkspaceSwitcher, { current: workspace, workspaces, onSelect: onSelectWorkspace, lang: lang || 'ar' })),
        onLangChange && React.createElement(LanguageSwitcher, { lang: lang || 'ar', onChange: onLangChange, className: 'se-lang-desktop-slot' }),
        onLangChange && React.createElement(LanguageSwitcher, { lang: lang || 'ar', onChange: onLangChange, compact: true, className: 'se-lang-mobile-slot' }),
        accountTrigger)),
    onLangChange && React.createElement('div', { className: 'se-th-note', dir, style: { padding: '4px 20px', fontSize: 11, color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' } },
      lang === 'en' ? 'Future state — Phase 12: language switching is a prototype preview.' : 'حالة مستقبلية — المرحلة 12: تبديل اللغة معاينة أولية فقط.'));
}
