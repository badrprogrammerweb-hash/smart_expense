import React from 'react';
function toPascal(name) { return name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(''); }
function nodeToSvg(node, size, color, strokeWidth) {
  const inner = node.map(([tag, attrs]) => {
    const attrStr = Object.entries(attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${attrStr}></${tag}>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
export function Icon({ name, size = 20, strokeWidth = 1.75, color = 'currentColor', style, ...rest }) {
  const pascal = toPascal(name || '');
  const node = (typeof window !== 'undefined' && window.lucide && window.lucide.icons) ? window.lucide.icons[pascal] : null;
  const svg = node ? nodeToSvg(node, size, color, strokeWidth) : null;
  if (svg) return React.createElement('span', { style: { display: 'inline-flex', lineHeight: 0, ...style }, dangerouslySetInnerHTML: { __html: svg }, ...rest });
  return React.createElement('span', { style: { display: 'inline-block', width: size, height: size, borderRadius: 4, background: 'var(--color-border)', ...style }, ...rest });
}
