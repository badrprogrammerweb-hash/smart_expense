import React from 'react';
import { Icon } from '../core/Icon.jsx';
const dict = {
  ar: [
    { key: 'dashboard', label: 'الرئيسية', icon: 'layout-dashboard' },
    { key: 'expenses', label: 'المصاريف', icon: 'trending-down' },
    { key: 'add', label: 'إضافة', icon: 'plus-circle' },
    { key: 'reports', label: 'التقارير', icon: 'bar-chart-3' },
    { key: 'more', label: 'المزيد', icon: 'menu' },
  ],
  en: [
    { key: 'dashboard', label: 'Home', icon: 'layout-dashboard' },
    { key: 'expenses', label: 'Expenses', icon: 'trending-down' },
    { key: 'add', label: 'Add', icon: 'plus-circle' },
    { key: 'reports', label: 'Reports', icon: 'bar-chart-3' },
    { key: 'more', label: 'More', icon: 'menu' },
  ],
};
export function MobileNav({ active = 'dashboard', onNavigate, lang = 'ar', dir, hideAdd }) {
  const items = (dict[lang] || dict.ar).filter(it => !(hideAdd && it.key === 'add'));
  const resolvedDir = dir || (lang === 'en' ? 'ltr' : 'rtl');
  return React.createElement('nav', { dir: resolvedDir, style: { position: 'fixed', insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, height: 64, background: 'var(--color-surface)', borderTop: '1px solid var(--color-border)', display: 'flex', fontFamily: 'var(--font-arabic)', zIndex: 40 } },
    items.map(it => React.createElement('button', { key: it.key, onClick: () => onNavigate && onNavigate(it.key), className: 'se-focusable', style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, border: 'none', background: 'none', color: active === it.key ? 'var(--color-primary)' : 'var(--color-text-muted)', minHeight: 44 } },
      React.createElement(Icon, { name: it.icon, size: it.key === 'add' ? 26 : 20, color: it.key === 'add' ? 'var(--color-primary)' : (active === it.key ? 'var(--color-primary)' : 'var(--color-text-muted)') }),
      React.createElement('span', { style: { fontSize: 11, fontWeight: active === it.key ? 700 : 500 } }, it.label))));
}
