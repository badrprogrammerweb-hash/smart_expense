import React from 'react';
export function Table({ columns = [], rows = [], rowKey = 'id', onRowClick, dir = 'rtl', emptyLabel = 'لا توجد بيانات لعرضها' }) {
  return React.createElement('div', { dir, style: { width: '100%', overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', background: 'var(--color-surface)', fontFamily: 'var(--font-arabic)' } },
    React.createElement('table', { style: { width: '100%', tableLayout: columns.some(c => c.width) ? 'fixed' : 'auto', borderCollapse: 'collapse', fontSize: 'var(--text-table-size)' } },
      React.createElement('thead', null, React.createElement('tr', null,
        columns.map(c => React.createElement('th', { key: c.key, className: c.className, style: { textAlign: c.align || 'start', padding: '12px 16px', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', ...(c.width ? { width: c.width } : {}) } }, c.label)))),
      React.createElement('tbody', null,
        rows.map(row => React.createElement('tr', { key: row[rowKey], onClick: () => onRowClick && onRowClick(row), className: 'se-row-hover', style: { cursor: onRowClick ? 'pointer' : 'default', borderBottom: '1px solid var(--color-border)' } },
          columns.map(c => React.createElement('td', { key: c.key, className: c.className, style: { padding: '12px 16px', textAlign: c.align || 'start', color: 'var(--color-text)', overflow: 'hidden', whiteSpace: c.width ? 'normal' : 'nowrap', textOverflow: c.width ? undefined : 'ellipsis', ...(c.width ? { width: c.width, maxWidth: c.width } : {}) } }, c.render ? c.render(row) : React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' } }, row[c.key])))))),
      rows.length === 0 && React.createElement('tfoot', null, React.createElement('tr', null, React.createElement('td', { colSpan: columns.length, style: { padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 } }, emptyLabel)))));
}
