import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';
import { Icon } from '../core/Icon.jsx';
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAYS_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function parse(d) { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d || ''); return m ? { day: +m[1], month: +m[2] - 1, year: +m[3] } : null; }
function format(y, m, d) { return `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`; }
export function DateField({ label, value, onChange, required, error, disabled, lang = 'ar' }) {
  const isEn = lang === 'en';
  const dir = isEn ? 'ltr' : 'rtl';
  const MONTHS = isEn ? MONTHS_EN : MONTHS_AR;
  const WEEKDAYS = isEn ? WEEKDAYS_EN : WEEKDAYS_AR;
  const fieldLabel = label === undefined ? (isEn ? 'Date' : 'التاريخ') : label;
  const placeholder = isEn ? 'Select date' : 'اختر التاريخ';
  const prevLabel = isEn ? 'Previous month' : 'الشهر السابق';
  const nextLabel = isEn ? 'Next month' : 'الشهر التالي';
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const now = new Date();
  const parsed = parse(value);
  const [viewYear, setViewYear] = useState((parsed || { year: now.getFullYear() }).year);
  const [viewMonth, setViewMonth] = useState((parsed || { month: now.getMonth() }).month);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => { if (open) { const p = parse(value); if (p) { setViewYear(p.year); setViewMonth(p.month); } } }, [open]);
  useEffect(() => { if (!open) setPos(null); }, [open]);
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popRef.current) return;
    const margin = 8;
    const update = () => {
      const t = triggerRef.current.getBoundingClientRect();
      const p = popRef.current.getBoundingClientRect();
      let left = dir === 'rtl' ? t.right - p.width : t.left;
      left = Math.min(Math.max(left, margin), window.innerWidth - p.width - margin);
      let top = t.bottom + 6;
      if (top + p.height > window.innerHeight - margin) top = Math.max(t.top - p.height - 6, margin);
      setPos({ top, left });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open, dir]);
  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const selectDay = (d) => { onChange && onChange({ target: { value: format(viewYear, viewMonth, d) } }); setOpen(false); };
  const isSelected = (d) => parsed && parsed.day === d && parsed.month === viewMonth && parsed.year === viewYear;
  const isToday = (d) => now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === d;
  const years = []; const nowY = now.getFullYear();
  for (let y = nowY - 5; y <= nowY + 1; y++) years.push(y);
  const popStyle = { position: 'fixed', top: pos ? pos.top : -9999, left: pos ? pos.left : -9999, visibility: pos ? 'visible' : 'hidden', width: 280, maxWidth: 'calc(100vw - 16px)', boxSizing: 'border-box', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-dropdown)', padding: 14, zIndex: 1000, fontFamily: 'var(--font-arabic)' };
  return React.createElement('div', { ref: triggerRef, dir, style: { position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-arabic)' } },
    fieldLabel && React.createElement('label', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)' } }, fieldLabel, required && React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
    React.createElement('button', { type: 'button', disabled, onClick: () => setOpen(o => !o), className: 'se-focusable', style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 'var(--radius-control)', border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`, background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'start' } },
      React.createElement(Icon, { name: 'calendar', size: 16, color: 'var(--color-text-muted)' }),
      React.createElement('span', { dir: 'ltr', style: { flex: 1, fontSize: 15, color: value ? 'var(--color-text)' : 'var(--color-text-muted)', fontFeatureSettings: "'tnum' 1" } }, value || placeholder),
      React.createElement(Icon, { name: 'chevron-down', size: 14, color: 'var(--color-text-muted)' })),
    error && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-expense)' } }, error),
    open && ReactDOM.createPortal(React.createElement('div', { ref: popRef, dir, className: 'se-datefield-pop', role: 'dialog', 'aria-label': placeholder, style: popStyle },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 10 } },
        React.createElement('button', { type: 'button', onClick: prevMonth, 'aria-label': prevLabel, className: 'se-focusable', style: { width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(Icon, { name: isEn ? 'chevron-left' : 'chevron-right', size: 16 })),
        React.createElement('div', { style: { display: 'flex', gap: 6, minWidth: 0 } },
          React.createElement('select', { value: viewMonth, onChange: e => setViewMonth(+e.target.value), className: 'se-focusable', style: { border: '1px solid var(--color-border-strong)', borderRadius: 8, padding: '4px 6px', fontSize: 13, fontFamily: 'var(--font-arabic)', background: 'var(--color-surface)', color: 'var(--color-text)' } }, MONTHS.map((m, i) => React.createElement('option', { key: i, value: i }, m))),
          React.createElement('select', { value: viewYear, onChange: e => setViewYear(+e.target.value), className: 'se-focusable', style: { border: '1px solid var(--color-border-strong)', borderRadius: 8, padding: '4px 6px', fontSize: 13, fontFamily: 'var(--font-numeric)', background: 'var(--color-surface)', color: 'var(--color-text)' } }, years.map(y => React.createElement('option', { key: y, value: y }, y)))),
        React.createElement('button', { type: 'button', onClick: nextMonth, 'aria-label': nextLabel, className: 'se-focusable', style: { width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'var(--color-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 } }, React.createElement(Icon, { name: isEn ? 'chevron-right' : 'chevron-left', size: 16 }))),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, marginBottom: 4 } },
        WEEKDAYS.map(w => React.createElement('div', { key: w, style: { fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 600, padding: '4px 0' } }, w))),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 } },
        cells.map((d, i) => d === null ? React.createElement('div', { key: 'e' + i }) :
          React.createElement('button', { type: 'button', key: d, onClick: () => selectDay(d), className: 'se-focusable', style: { width: '100%', aspectRatio: '1', minHeight: 32, borderRadius: '50%', border: 'none', background: isSelected(d) ? 'var(--color-primary)' : 'transparent', color: isSelected(d) ? '#fff' : (isToday(d) ? 'var(--color-primary)' : 'var(--color-text)'), fontWeight: isSelected(d) || isToday(d) ? 700 : 500, fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-numeric)' } }, d)))), document.body));
}
