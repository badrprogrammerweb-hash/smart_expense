import React, { useState } from 'react';
import { IconButton } from '../core/IconButton.jsx';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../core/Badge.jsx';
import { Button } from '../core/Button.jsx';
import { Input } from '../forms/Input.jsx';
import { Select } from '../forms/Select.jsx';

const ICON_CHOICES = ['shopping-cart', 'car', 'home', 'utensils', 'heart-pulse', 'receipt', 'gift', 'plane', 'dumbbell', 'book-open', 'wallet', 'tag', 'coffee', 'wrench', 'more-horizontal'];
const STR = {
  ar: { addCategory: 'إضافة فئة', close: 'إغلاق', notAvailable: 'غير متاحة', categoryType: 'نوع الفئة', main: 'فئة رئيسية', sub: 'فئة فرعية', parent: 'الفئة الرئيسية', mainName: 'اسم الفئة الرئيسية', subName: 'اسم الفئة الفرعية', namePlaceholder: 'مثال: ترفيه', icon: 'الأيقونة', cancel: 'إلغاء', saveCategory: 'حفظ الفئة', savedTitle: 'تمت إضافة الفئة بنجاح', nameRequired: 'اسم الفئة مطلوب.', parentRequired: 'يرجى اختيار الفئة الرئيسية.', iconRequired: 'يرجى اختيار أيقونة.', dupMain: 'توجد فئة رئيسية بنفس الاسم بالفعل.', dupSub: 'توجد فئة فرعية بنفس الاسم ضمن هذه الفئة الرئيسية.' },
  en: { addCategory: 'Add category', close: 'Close', notAvailable: 'Not available', categoryType: 'Category type', main: 'Main category', sub: 'Subcategory', parent: 'Main category', mainName: 'Main category name', subName: 'Subcategory name', namePlaceholder: 'Example: Entertainment', icon: 'Icon', cancel: 'Cancel', saveCategory: 'Save category', savedTitle: 'Category added successfully', nameRequired: 'Category name is required.', parentRequired: 'Please select a main category.', iconRequired: 'Please select an icon.', dupMain: 'A main category with this name already exists.', dupSub: 'A subcategory with this name already exists under this main category.' },
};

function CreateCategorySheet({ categories, lang, onClose, onCreated }) {
  const t = STR[lang] || STR.ar;
  const [type, setType] = useState('main');
  const [name, setName] = useState('');
  const [parentValue, setParentValue] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const mainOptions = categories.map(c => ({ value: c.value, label: c.label, disabled: c.disabled }));

  const save = () => {
    if (saving || success) return;
    const trimmed = name.trim();
    if (!trimmed) return setError(t.nameRequired);
    if (type === 'sub' && !parentValue) return setError(t.parentRequired);
    if (!icon) return setError(t.iconRequired);
    if (type === 'main') {
      if (categories.some(c => c.label.trim() === trimmed)) return setError(t.dupMain);
    } else {
      const parent = categories.find(c => c.value === parentValue);
      if (parent && parent.subs && parent.subs.some(s => s.label.trim() === trimmed)) return setError(t.dupSub);
    }
    setError('');
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => {
        const value = `custom-${Date.now()}`;
        onCreated({ value, label: trimmed, icon }, type === 'sub' ? parentValue : null);
      }, 500);
    }, 700);
  };

  return React.createElement('div', { className: 'se-picker-overlay', style: { zIndex: 210 }, onClick: onClose },
    React.createElement('div', { className: 'se-picker-panel', dir: lang === 'en' ? 'ltr' : 'rtl', role: 'dialog', 'aria-modal': true, onClick: e => e.stopPropagation() },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '16px 12px 12px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 } },
        React.createElement('span', { style: { fontSize: 17, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, t.addCategory),
        React.createElement(IconButton, { icon: 'x', label: t.close, size: 'lg', onClick: onClose, disabled: saving })),
      React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 } },
        success ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 0', textAlign: 'center' } },
          React.createElement('div', { style: { width: 48, height: 48, borderRadius: '50%', background: 'var(--color-income-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: 'check-circle-2', size: 26, color: 'var(--color-income)' })),
          React.createElement('span', { style: { fontSize: 15, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, t.savedTitle)) :
        React.createElement(React.Fragment, null,
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            React.createElement('span', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, t.categoryType),
            React.createElement('div', { style: { display: 'flex', gap: 8 } },
              React.createElement('button', { disabled: saving, onClick: () => { setType('main'); setParentValue(''); }, className: 'se-focusable', style: { flex: 1, height: 44, borderRadius: 'var(--radius-control)', border: `1px solid ${type === 'main' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: type === 'main' ? 'var(--color-primary-subtle)' : 'var(--color-surface)', color: type === 'main' ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, t.main),
              React.createElement('button', { disabled: saving, onClick: () => setType('sub'), className: 'se-focusable', style: { flex: 1, height: 44, borderRadius: 'var(--radius-control)', border: `1px solid ${type === 'sub' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: type === 'sub' ? 'var(--color-primary-subtle)' : 'var(--color-surface)', color: type === 'sub' ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, t.sub))),
          type === 'sub' && React.createElement(Select, { label: t.parent, required: true, value: parentValue, onChange: e => setParentValue(e.target.value), options: mainOptions, disabled: saving }),
          React.createElement(Input, { label: type === 'main' ? t.mainName : t.subName, required: true, value: name, onChange: e => setName(e.target.value), placeholder: t.namePlaceholder, disabled: saving }),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            React.createElement('span', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, t.icon, React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,44px)', gap: 8 } },
              ICON_CHOICES.map(ic => React.createElement('button', { key: ic, disabled: saving, onClick: () => setIcon(ic), 'aria-label': ic, className: 'se-focusable', style: { width: 44, height: 44, borderRadius: 'var(--radius-control)', border: `1px solid ${icon === ic ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: icon === ic ? 'var(--color-primary-subtle)' : 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } }, React.createElement(Icon, { name: ic, size: 18, color: icon === ic ? 'var(--color-primary)' : 'var(--color-text-muted)' }))))),
          error && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-expense)', fontFamily: 'var(--font-arabic)' } }, error))),
      !success && React.createElement('div', { style: { display: 'flex', gap: 10, padding: 16, borderTop: '1px solid var(--color-border)', flexShrink: 0 } },
        React.createElement(Button, { variant: 'secondary', size: 'lg', fullWidth: true, onClick: onClose, disabled: saving }, t.cancel),
        React.createElement(Button, { size: 'lg', fullWidth: true, onClick: save, loading: saving }, t.saveCategory))));
}

export function CategoryPickerDialog({ open, categories = [], selected, onClose, onSelect, onCreateCategory, canManageCategories = false, title, lang = 'ar' }) {
  const t = STR[lang] || STR.ar;
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const heading = title || (lang === 'en' ? 'Select category' : 'اختر الفئة');
  const [creating, setCreating] = useState(false);
  if (!open) return null;
  return React.createElement(React.Fragment, null,
    React.createElement('div', { className: 'se-picker-overlay', onClick: onClose },
      React.createElement('div', { className: 'se-picker-panel', dir, role: 'dialog', 'aria-modal': true, onClick: e => e.stopPropagation() },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '16px 12px 12px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 } },
            React.createElement('span', { style: { fontSize: 17, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, heading),
            React.createElement(Badge, { tone: 'warning', dot: true }, 'Future state — Phase 13')),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 } },
            canManageCategories && React.createElement('span', { className: 'se-cat-add-desktop' }, React.createElement(Button, { variant: 'secondary', size: 'md', icon: 'plus', onClick: () => setCreating(true) }, t.addCategory)),
            canManageCategories && React.createElement('span', { className: 'se-cat-add-mobile' }, React.createElement(IconButton, { icon: 'plus', label: t.addCategory, size: 'lg', variant: 'filled', onClick: () => setCreating(true) })),
            React.createElement(IconButton, { icon: 'x', label: t.close, size: 'lg', onClick: onClose }))),
        React.createElement('div', { style: { flex: 1, overflowY: 'auto', padding: '8px 16px 16px' } },
          categories.map(cat => React.createElement('div', { key: cat.value, style: { marginBottom: 6 } },
            React.createElement('button', {
              disabled: cat.disabled,
              onClick: () => !cat.disabled && onSelect({ value: cat.value, label: cat.label, icon: cat.icon }),
              className: `se-focusable se-cat-row ${selected && selected.value === cat.value && !selected.isSub ? 'se-cat-selected' : ''}`,
            },
              React.createElement('div', { style: { width: 36, height: 36, borderRadius: '50%', background: 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: cat.icon, size: 18, color: 'var(--color-text-muted)' })),
              React.createElement('span', { style: { flex: 1, fontSize: 15, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)', textAlign: 'start' } }, cat.label),
              cat.disabled && React.createElement('span', { style: { fontSize: 11, color: 'var(--color-text-faint)', fontFamily: 'var(--font-arabic)' } }, t.notAvailable),
              selected && selected.value === cat.value && !selected.isSub && React.createElement(Icon, { name: 'check', size: 18, color: 'var(--color-primary)' })),
            cat.subs && cat.subs.length > 0 && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', paddingInlineStart: 30 } },
              cat.subs.map(sub => React.createElement('button', {
                key: sub.value,
                disabled: cat.disabled,
                onClick: () => !cat.disabled && onSelect({ value: sub.value, label: sub.label, icon: sub.icon, isSub: true, mainLabel: cat.label }),
                className: `se-focusable se-cat-row ${selected && selected.value === sub.value && selected.isSub ? 'se-cat-selected' : ''}`,
              },
                React.createElement('div', { style: { width: 28, height: 28, borderRadius: '50%', background: 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: sub.icon, size: 14, color: 'var(--color-text-muted)' })),
                React.createElement('span', { style: { flex: 1, fontSize: 14, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)', textAlign: 'start' } }, sub.label),
                selected && selected.value === sub.value && selected.isSub && React.createElement(Icon, { name: 'check', size: 16, color: 'var(--color-primary)' }))))))))),
    creating && React.createElement(CreateCategorySheet, {
      categories,
      lang,
      onClose: () => setCreating(false),
      onCreated: (newCat, parentValue) => {
        onCreateCategory && onCreateCategory(newCat, parentValue);
        setCreating(false);
        const parent = parentValue ? categories.find(c => c.value === parentValue) : null;
        onSelect(parent ? { value: newCat.value, label: newCat.label, icon: newCat.icon, isSub: true, mainLabel: parent.label } : { value: newCat.value, label: newCat.label, icon: newCat.icon });
      },
    }));
}
