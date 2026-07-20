import React from 'react';
export function InfoCard({ title, actions, children, padded = true, dir = 'rtl' }) {
  return React.createElement('div', { dir, style: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', fontFamily: 'var(--font-arabic)' } },
    (title || actions) && React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border)' } },
      React.createElement('span', { style: { fontSize: 'var(--text-section-heading-size)', fontWeight: 'var(--text-section-heading-weight)', color: 'var(--color-text)' } }, title),
      actions),
    React.createElement('div', { style: { padding: padded ? 20 : 0 } }, children));
}
