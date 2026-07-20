import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
export function DropdownMenu({ trigger, items = [], align = 'start', menuMinWidth = 200, menuWidth, dir = 'rtl' }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => { if (!open) setPos(null); }, [open]);
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const margin = 8;
    const update = () => {
      const t = triggerRef.current.getBoundingClientRect();
      const m = menuRef.current.getBoundingClientRect();
      const alignEnd = (dir === 'rtl') ? (align === 'start') : (align === 'end');
      let left = alignEnd ? t.right - m.width : t.left;
      left = Math.min(Math.max(left, margin), window.innerWidth - m.width - margin);
      let top = t.bottom + 6;
      if (top + m.height > window.innerHeight - margin) top = Math.max(t.top - m.height - 6, margin);
      setPos({ top, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open, align, dir]);
  const menuStyle = { position: 'fixed', top: pos ? pos.top : -9999, left: pos ? pos.left : -9999, visibility: pos ? 'visible' : 'hidden', minWidth: menuWidth ? undefined : menuMinWidth, width: menuWidth || 'max-content', maxWidth: menuWidth ? undefined : 'calc(100vw - 16px)', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-control)', boxShadow: 'var(--shadow-dropdown)', padding: 6, zIndex: 1000 };
  return React.createElement('div', { ref: triggerRef, style: { position: 'relative', display: 'inline-block', fontFamily: 'var(--font-arabic)' } },
    React.createElement('div', { onClick: () => setOpen(o => !o) }, trigger),
    open && ReactDOM.createPortal(
      React.createElement('div', { ref: menuRef, role: 'menu', dir, style: menuStyle },
        items.map((it, i) => it.divider ? React.createElement('div', { key: i, style: { height: 1, background: 'var(--color-border)', margin: '4px 0' } }) :
          React.createElement('button', { key: i, onClick: () => { it.onClick && it.onClick(); setOpen(false); }, disabled: it.disabled, className: 'se-row-hover se-focusable', style: { display: 'flex', width: '100%', textAlign: 'start', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'none', borderRadius: 6, fontSize: 14, whiteSpace: 'nowrap', color: it.destructive ? 'var(--color-expense)' : 'var(--color-text)', cursor: it.disabled ? 'not-allowed' : 'pointer', opacity: it.disabled ? 0.5 : 1 } }, it.label))),
      document.body));
}
