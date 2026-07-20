import React from 'react';
import { Icon } from './Icon.jsx';
const sizes = { sm: { h: 32, pad: '0 12px', font: 13 }, md: { h: 40, pad: '0 16px', font: 14 }, lg: { h: 48, pad: '0 20px', font: 15 } };
const variants = {
  primary: { bg: 'var(--color-primary)', color: '#fff', border: '1px solid var(--color-primary)' },
  secondary: { bg: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border-strong)' },
  ghost: { bg: 'transparent', color: 'var(--color-text)', border: '1px solid transparent' },
  destructive: { bg: 'var(--color-expense)', color: '#fff', border: '1px solid var(--color-expense)' },
};
export function Button({ children, variant = 'primary', size = 'md', icon, iconPosition = 'start', loading = false, disabled = false, fullWidth = false, onClick, type = 'button', style: styleOverride, ...rest }) {
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  const isDisabled = disabled || loading;
  const style = { height: s.h, padding: s.pad, fontSize: s.font, background: v.bg, color: v.color, border: v.border, borderRadius: 'var(--radius-control)', fontFamily: 'var(--font-arabic)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: isDisabled ? 'not-allowed' : 'pointer', opacity: isDisabled && !loading ? 0.5 : 1, width: fullWidth ? '100%' : undefined, whiteSpace: 'nowrap', ...styleOverride };
  return React.createElement('button', { type, className: 'se-btn se-focusable', style, disabled: isDisabled, onClick, ...rest },
    loading && React.createElement('span', { style: { width: 14, height: 14, borderRadius: '50%', border: '2px solid currentColor', borderInlineEndColor: 'transparent', animation: 'se-spin .7s linear infinite' } }),
    !loading && icon && iconPosition === 'start' && React.createElement(Icon, { name: icon, size: 16 }),
    children,
    !loading && icon && iconPosition === 'end' && React.createElement(Icon, { name: icon, size: 16 })
  );
}
