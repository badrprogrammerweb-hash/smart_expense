import React from 'react';
export function Chart({ type = 'bar', data = [], height = 220, valueKey = 'value', labelKey = 'label', color = 'var(--color-primary)' }) {
  const max = Math.max(1, ...data.map(d => d[valueKey]));
  if (type === 'donut') {
    let acc = 0;
    const total = data.reduce((s, d) => s + d[valueKey], 0) || 1;
    const stops = data.map(d => { const start = acc / total * 360; acc += d[valueKey]; const end = acc / total * 360; return `${d.color || color} ${start}deg ${end}deg`; });
    return React.createElement('div', { dir: 'rtl', style: { display: 'flex', alignItems: 'center', gap: 20, fontFamily: 'var(--font-arabic)' } },
      React.createElement('div', { style: { width: height, height, borderRadius: '50%', background: `conic-gradient(${stops.join(',')})`, flexShrink: 0, position: 'relative' } },
        React.createElement('div', { style: { position: 'absolute', inset: '18%', borderRadius: '50%', background: 'var(--color-surface)' } })),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        data.map((d, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text)' } },
          React.createElement('span', { style: { width: 10, height: 10, borderRadius: '50%', background: d.color || color } }),
          React.createElement('span', null, d[labelKey]),
          React.createElement('span', { dir: 'ltr', style: { color: 'var(--color-text-muted)', fontFeatureSettings: "'tnum' 1" } }, d[valueKey])))));
  }
  return React.createElement('div', { dir: 'rtl', style: { display: 'flex', alignItems: 'flex-end', gap: 12, height, fontFamily: 'var(--font-arabic)' } },
    data.map((d, i) => React.createElement('div', { key: i, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 } },
      React.createElement('span', { dir: 'ltr', style: { fontSize: 11, color: 'var(--color-text-muted)', fontFeatureSettings: "'tnum' 1" } }, d[valueKey]),
      React.createElement('div', { title: `${d[labelKey]}: ${d[valueKey]}`, style: { width: '100%', maxWidth: 36, height: Math.max(4, d[valueKey] / max * (height - 60)), background: d.color || color, borderRadius: '4px 4px 0 0' } }),
      React.createElement('span', { style: { fontSize: 11, color: 'var(--color-text-muted)' } }, d[labelKey]))));
}
