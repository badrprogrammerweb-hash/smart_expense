import React, { useState } from 'react';
export function Tabs({ tabs = [], value, onChange, defaultValue }) {
  const [internal, setInternal] = useState(defaultValue || (tabs[0] && tabs[0].key));
  const active = value !== undefined ? value : internal;
  const set = (k) => { if (value === undefined) setInternal(k); onChange && onChange(k); };
  return React.createElement('div', { dir: 'rtl', role: 'tablist', style: { display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', fontFamily: 'var(--font-arabic)' } },
    tabs.map(t => React.createElement('button', { key: t.key, role: 'tab', 'aria-selected': active === t.key, onClick: () => set(t.key), className: 'se-focusable', style: { padding: '10px 4px', margin: '0 12px', border: 'none', borderBottom: `2px solid ${active === t.key ? 'var(--color-primary)' : 'transparent'}`, background: 'none', color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)', fontSize: 14, fontWeight: active === t.key ? 700 : 500, cursor: 'pointer' } }, t.label)));
}
