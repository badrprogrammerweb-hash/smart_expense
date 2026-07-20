import React from 'react';
import { Icon } from '../core/Icon.jsx';
const dict = {
  ar: { brand: 'Smart Expense', items: [
    { key: 'dashboard', label: 'لوحة التحكم', icon: 'layout-dashboard' },
    { key: 'income', label: 'الدخل', icon: 'trending-up' },
    { key: 'expenses', label: 'المصاريف', icon: 'trending-down' },
    { key: 'categories', label: 'الفئات', icon: 'shapes' },
    { key: 'files', label: 'الإيصالات والملفات', icon: 'receipt' },
    { key: 'ai-review', label: 'مراجعة الاستخراج الذكي', icon: 'sparkles' },
    { key: 'reports', label: 'التقارير', icon: 'bar-chart-3' },
    { key: 'history', label: 'سجل النشاط', icon: 'history' },
    { key: 'settings', label: 'الإعدادات', icon: 'settings' },
  ] },
  en: { brand: 'Smart Expense', items: [
    { key: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard' },
    { key: 'income', label: 'Income', icon: 'trending-up' },
    { key: 'expenses', label: 'Expenses', icon: 'trending-down' },
    { key: 'categories', label: 'Categories', icon: 'shapes' },
    { key: 'files', label: 'Receipts & Files', icon: 'receipt' },
    { key: 'ai-review', label: 'AI Review', icon: 'sparkles' },
    { key: 'reports', label: 'Reports', icon: 'bar-chart-3' },
    { key: 'history', label: 'History', icon: 'history' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
  ] },
};
export function Sidebar({ active = 'dashboard', onNavigate, workspaceName = 'عائلة العتيبي', pendingCount = 0, lang = 'ar', dir }) {
  const t = dict[lang] || dict.ar;
  const resolvedDir = dir || (lang === 'en' ? 'ltr' : 'rtl');
  const border = resolvedDir === 'rtl' ? { borderInlineEnd: '1px solid var(--color-border)' } : { borderInlineEnd: '1px solid var(--color-border)' };
  return React.createElement('nav', { dir: resolvedDir, style: { width: 'var(--sidebar-width)', height: '100%', background: 'var(--color-surface)', ...border, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-arabic)' } },
    React.createElement('div', { style: { padding: '20px 16px 12px', display: 'flex', alignItems: 'center', gap: 8 } },
      React.createElement('div', { style: { width: 32, height: 32, borderRadius: 8, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: 'wallet', size: 18, color: '#fff' })),
      React.createElement('span', { style: { fontSize: 16, fontWeight: 700, color: 'var(--color-text)' } }, t.brand)),
    React.createElement('div', { style: { margin: '4px 12px 12px', padding: '10px 12px', borderRadius: 'var(--radius-control)', background: 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' } },
      React.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: 'var(--color-text)' } }, workspaceName),
      React.createElement(Icon, { name: 'chevrons-up-down', size: 14, color: 'var(--color-text-muted)' })),
    React.createElement('div', { className: 'se-scrollbar', style: { flex: 1, overflowY: 'auto', padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 2 } },
      t.items.map(it => React.createElement('button', { key: it.key, onClick: () => onNavigate && onNavigate(it.key), className: 'se-focusable se-row-hover', style: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-control)', border: 'none', background: active === it.key ? 'var(--color-primary-subtle)' : 'transparent', color: active === it.key ? 'var(--color-primary)' : 'var(--color-text)', fontSize: 14, fontWeight: active === it.key ? 700 : 500, cursor: 'pointer', textAlign: 'start' } },
        React.createElement(Icon, { name: it.icon, size: 18 }),
        React.createElement('span', { style: { flex: 1 } }, it.label),
        it.key === 'ai-review' && pendingCount > 0 && React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: '#92620A', background: 'var(--color-warning-subtle)', borderRadius: 99, padding: '1px 7px' } }, pendingCount)))));
}
