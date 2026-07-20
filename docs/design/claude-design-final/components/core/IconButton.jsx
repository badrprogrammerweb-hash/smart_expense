import React from 'react';
import { Icon } from './Icon.jsx';
const sizeMap = { sm: 32, md: 40, lg: 44 };
export function IconButton({ icon, label, size = 'md', variant = 'ghost', active = false, disabled = false, onClick, ...rest }) {
  const dim = sizeMap[size] || 40;
  const bg = active ? 'var(--color-primary-subtle)' : (variant === 'filled' ? 'var(--color-surface)' : 'transparent');
  const color = active ? 'var(--color-primary)' : 'var(--color-text-muted)';
  const border = variant === 'filled' ? '1px solid var(--color-border-strong)' : '1px solid transparent';
  return React.createElement('button', { type: 'button', 'aria-label': label, title: label, disabled, onClick, className: 'se-btn se-focusable se-row-hover', style: { width: dim, height: dim, borderRadius: 'var(--radius-control)', background: bg, color, border, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }, ...rest },
    React.createElement(Icon, { name: icon, size: 18 }));
}
