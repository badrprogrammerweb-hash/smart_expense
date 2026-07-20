import React from 'react';
export function PageHeading({ title, description, actions, dir = 'rtl' }) {
  return React.createElement('div', { dir, style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--font-arabic)' } },
    React.createElement('div', null,
      React.createElement('h1', { style: { fontSize: 'var(--text-page-title-size)', fontWeight: 'var(--text-page-title-weight)', color: 'var(--color-text)', margin: 0 } }, title),
      description && React.createElement('p', { style: { fontSize: 14, color: 'var(--color-text-muted)', margin: '6px 0 0' } }, description)),
    actions && React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } }, actions));
}
