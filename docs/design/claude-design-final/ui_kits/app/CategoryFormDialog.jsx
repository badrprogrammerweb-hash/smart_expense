const ICON_GROUPS = [
  { key: 'food', label: 'طعام', icons: ['utensils', 'coffee', 'pizza', 'apple', 'shopping-basket'] },
  { key: 'transport', label: 'مواصلات', icons: ['car', 'bus', 'bike', 'plane', 'car-taxi-front', 'fuel', 'train-front'] },
  { key: 'home', label: 'منزل', icons: ['home', 'lamp', 'sofa', 'wrench', 'key-round'] },
  { key: 'bills', label: 'فواتير', icons: ['receipt', 'zap', 'wifi', 'phone', 'flame', 'file-text'] },
  { key: 'health', label: 'صحة', icons: ['heart-pulse', 'pill', 'stethoscope', 'thermometer'] },
  { key: 'shopping', label: 'تسوق', icons: ['shopping-cart', 'shopping-bag', 'gift', 'shirt'] },
  { key: 'family', label: 'عائلة', icons: ['users', 'baby', 'dog', 'cat', 'heart'] },
  { key: 'education', label: 'تعليم', icons: ['book-open', 'graduation-cap', 'pencil', 'backpack'] },
  { key: 'entertainment', label: 'ترفيه', icons: ['gamepad-2', 'music', 'film', 'tv', 'palette'] },
  { key: 'work', label: 'عمل ودخل', icons: ['briefcase', 'wallet', 'banknote', 'trending-up', 'landmark'] },
  { key: 'other', label: 'أخرى', icons: ['more-horizontal', 'tag', 'star', 'archive', 'sparkles'] },
];
const COLOR_PALETTE = ['#3B82F6', '#0F7A5C', '#DC2626', '#F59E0B', '#8B5CF6', '#0D9488', '#DB2777', '#64748B'];

function IconColorSheet({ open, icon, color, showColor, onClose, onConfirm }) {
  const { IconButton, Icon } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [q, setQ] = React.useState('');
  const [pendingIcon, setPendingIcon] = React.useState(icon || 'tag');
  const [pendingColor, setPendingColor] = React.useState(color || COLOR_PALETTE[0]);
  React.useEffect(() => { if (open) { setPendingIcon(icon || 'tag'); setPendingColor(color || COLOR_PALETTE[0]); setQ(''); } }, [open, icon, color]);
  if (!open) return null;
  const groups = ICON_GROUPS.map(g => ({ ...g, icons: g.icons.filter(i => !q.trim() || i.includes(q.trim().toLowerCase())) })).filter(g => g.icons.length > 0);
  return React.createElement('div', { className: 'se-picker-overlay', style: { zIndex: 220 }, onClick: onClose },
    React.createElement('div', { className: 'se-picker-panel', dir: 'rtl', role: 'dialog', 'aria-modal': true, onClick: e => e.stopPropagation() },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '16px 12px 12px 16px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 } },
        React.createElement('span', { style: { fontSize: 17, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, 'اختر أيقونة'),
        React.createElement(IconButton, { icon: 'x', label: 'إغلاق', size: 'lg', onClick: onClose })),
      React.createElement('div', { style: { padding: '12px 16px 0' } },
        React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center' } },
          React.createElement(Icon, { name: 'search', size: 16, color: 'var(--color-text-muted)', style: { position: 'absolute', insetInlineStart: 12 } }),
          React.createElement('input', { value: q, onChange: e => setQ(e.target.value), placeholder: 'ابحث عن أيقونة...', className: 'se-focusable', style: { width: '100%', height: 44, boxSizing: 'border-box', padding: '0 40px 0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', fontSize: 14, fontFamily: 'var(--font-arabic)', color: 'var(--color-text)', background: 'var(--color-surface)' } }))),
      React.createElement('div', { style: { padding: 16, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 } },
        React.createElement('div', { style: { width: 48, height: 48, borderRadius: '50%', background: pendingColor + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: pendingIcon, size: 22, color: pendingColor })),
        React.createElement('span', { style: { fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)' } }, 'معاينة الأيقونة واللون المختارَين')),
      showColor && React.createElement('div', { style: { padding: '0 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 } },
        COLOR_PALETTE.map(c => React.createElement('button', { key: c, type: 'button', onClick: () => setPendingColor(c), 'aria-label': c, className: 'se-focusable', style: { width: 32, height: 32, borderRadius: '50%', background: c, border: pendingColor === c ? '3px solid var(--color-text)' : '1px solid var(--color-border)', cursor: 'pointer', padding: 0 } }))),
      React.createElement('div', { className: 'se-scrollbar', style: { flex: 1, overflowY: 'auto', padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 14 } },
        groups.length === 0 && React.createElement('span', { style: { fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)' } }, 'لا توجد نتائج'),
        groups.map(g => React.createElement('div', { key: g.key },
          React.createElement('div', { style: { fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)', marginBottom: 8 } }, g.label),
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,44px)', gap: 8 } },
            g.icons.map(ic => React.createElement('button', { key: ic, type: 'button', onClick: () => setPendingIcon(ic), 'aria-label': ic, className: 'se-focusable', style: { width: 44, height: 44, borderRadius: 'var(--radius-control)', border: `1px solid ${pendingIcon === ic ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: pendingIcon === ic ? 'var(--color-primary-subtle)' : 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } }, React.createElement(Icon, { name: ic, size: 18, color: pendingIcon === ic ? 'var(--color-primary)' : 'var(--color-text-muted)' }))))))),
      React.createElement('div', { style: { display: 'flex', gap: 10, padding: 16, borderTop: '1px solid var(--color-border)', flexShrink: 0 } },
        React.createElement('button', { type: 'button', onClick: onClose, className: 'se-focusable se-btn', style: { flex: 1, height: 44, borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'إلغاء'),
        React.createElement('button', { type: 'button', onClick: () => onConfirm(pendingIcon, pendingColor), className: 'se-focusable se-btn', style: { flex: 1, height: 44, borderRadius: 'var(--radius-control)', border: '1px solid var(--color-primary)', background: 'var(--color-primary)', color: '#fff', fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'تأكيد'))));
}

function CategoryFormDialog({ open, domain, mode = 'add', initialType = 'main', target, mainCategories = [], getSiblingLabels, onClose, onSubmit }) {
  const { Dialog, Button, Icon, Badge } = window.SmartExpenseAIDesignSystem_44f3e6;
  const isEdit = mode === 'edit';
  const [type, setType] = React.useState(initialType);
  const [domainLocal, setDomainLocal] = React.useState(domain);
  const [parentValue, setParentValue] = React.useState(target && target.parentValue ? target.parentValue : (mainCategories[0] ? mainCategories[0].value : ''));
  const [parentQuery, setParentQuery] = React.useState('');
  const [name, setName] = React.useState(target ? target.label : '');
  const [icon, setIcon] = React.useState(target ? target.icon : 'tag');
  const [color, setColor] = React.useState((target && target.color) || COLOR_PALETTE[0]);
  const [iconSheetOpen, setIconSheetOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setType(initialType);
    setDomainLocal(domain);
    setParentValue(target && target.parentValue ? target.parentValue : (mainCategories[0] ? mainCategories[0].value : ''));
    setParentQuery('');
    setName(target ? target.label : '');
    setIcon(target ? target.icon : 'tag');
    setColor((target && target.color) || COLOR_PALETTE[0]);
    setError(''); setSaving(false); setSuccess(false);
  }, [open, mode, initialType, target, domain]);

  if (!open) return null;
  const eligibleParents = mainCategories.filter(m => !m.archived && (!parentQuery.trim() || m.label.includes(parentQuery.trim())));
  const parent = mainCategories.find(m => m.value === parentValue);

  const save = () => {
    if (saving || success) return;
    const trimmed = name.trim();
    if (!trimmed) return setError(type === 'main' ? 'اسم الفئة الرئيسية مطلوب.' : 'اسم الفئة الفرعية مطلوب.');
    if (type === 'sub' && !parentValue) return setError('يرجى اختيار الفئة الرئيسية.');
    const siblings = getSiblingLabels ? getSiblingLabels(type, type === 'sub' ? parentValue : null) : [];
    if (siblings.includes(trimmed)) return setError('يوجد اسم مطابق ضمن هذا المستوى بالفعل.');
    setError(''); setSaving(true);
    setTimeout(() => {
      setSaving(false); setSuccess(true);
      setTimeout(() => {
        onSubmit({ mode, type, domain: domainLocal, value: target ? target.value : undefined, label: trimmed, icon, color: type === 'main' ? color : undefined, parentValue: type === 'sub' ? parentValue : undefined });
      }, 450);
    }, 600);
  };

  return React.createElement(React.Fragment, null,
    React.createElement(Dialog, { open, onClose, size: 540, mobileFullSheet: true,
      title: isEdit ? (type === 'main' ? 'تعديل فئة رئيسية' : 'تعديل فئة فرعية') : (type === 'main' ? 'إضافة فئة رئيسية' : 'إضافة فئة فرعية'),
      description: isEdit ? undefined : 'الفئات الهرمية للمصاريف والدخل',
      footer: React.createElement(React.Fragment, null,
        React.createElement(Button, { variant: 'secondary', onClick: onClose, disabled: saving }, 'إلغاء'),
        React.createElement(Button, { onClick: save, loading: saving }, type === 'main' ? 'إضافة الفئة' : 'إضافة الفئة الفرعية')) },
      success ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '24px 0', textAlign: 'center' } },
        React.createElement('div', { style: { width: 48, height: 48, borderRadius: '50%', background: 'var(--color-income-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: 'check-circle-2', size: 26, color: 'var(--color-income)' })),
        React.createElement('span', { style: { fontSize: 15, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, 'تم حفظ الفئة بنجاح')) :
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } },
        !isEdit && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          React.createElement('span', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, 'نوع الفئة'),
          React.createElement('div', { style: { display: 'flex', gap: 8 } },
            React.createElement('button', { type: 'button', onClick: () => setType('main'), className: 'se-focusable', style: { flex: 1, height: 44, borderRadius: 'var(--radius-control)', border: `1px solid ${type === 'main' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: type === 'main' ? 'var(--color-primary-subtle)' : 'var(--color-surface)', color: type === 'main' ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'فئة رئيسية'),
            React.createElement('button', { type: 'button', onClick: () => setType('sub'), className: 'se-focusable', style: { flex: 1, height: 44, borderRadius: 'var(--radius-control)', border: `1px solid ${type === 'sub' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: type === 'sub' ? 'var(--color-primary-subtle)' : 'var(--color-surface)', color: type === 'sub' ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'فئة فرعية'))),
        !isEdit && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          React.createElement('span', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, 'نوع البيانات'),
          React.createElement('div', { style: { display: 'flex', gap: 8 } },
            React.createElement('button', { type: 'button', onClick: () => setDomainLocal('expense'), className: 'se-focusable', style: { flex: 1, height: 40, borderRadius: 'var(--radius-control)', border: `1px solid ${domainLocal === 'expense' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: domainLocal === 'expense' ? 'var(--color-primary-subtle)' : 'var(--color-surface)', color: domainLocal === 'expense' ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'مصروف'),
            React.createElement('button', { type: 'button', onClick: () => setDomainLocal('income'), className: 'se-focusable', style: { flex: 1, height: 40, borderRadius: 'var(--radius-control)', border: `1px solid ${domainLocal === 'income' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: domainLocal === 'income' ? 'var(--color-primary-subtle)' : 'var(--color-surface)', color: domainLocal === 'income' ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'دخل'))),
        type === 'sub' && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          React.createElement('span', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, 'الفئة الرئيسية', React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
          React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center' } },
            React.createElement(Icon, { name: 'search', size: 15, color: 'var(--color-text-muted)', style: { position: 'absolute', insetInlineStart: 12 } }),
            React.createElement('input', { value: parentQuery, onChange: e => setParentQuery(e.target.value), placeholder: 'ابحث عن الفئة الرئيسية...', className: 'se-focusable', style: { width: '100%', height: 40, boxSizing: 'border-box', padding: '0 36px 0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', fontSize: 13, fontFamily: 'var(--font-arabic)', color: 'var(--color-text)', background: 'var(--color-surface)' } })),
          React.createElement('div', { className: 'se-scrollbar', style: { maxHeight: 150, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-control)', padding: 4, display: 'flex', flexDirection: 'column', gap: 2 } },
            eligibleParents.length === 0 && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-text-muted)', padding: 8, fontFamily: 'var(--font-arabic)' } }, 'لا توجد نتائج'),
            eligibleParents.map(m => React.createElement('button', { key: m.value, type: 'button', onClick: () => setParentValue(m.value), className: `se-focusable se-cat-row ${parentValue === m.value ? 'se-cat-selected' : ''}` },
              React.createElement('div', { style: { width: 26, height: 26, borderRadius: '50%', background: m.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: m.icon, size: 13, color: m.color })),
              React.createElement('span', { style: { flex: 1, fontSize: 13.5, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)', textAlign: 'start' } }, m.label),
              parentValue === m.value && React.createElement(Icon, { name: 'check', size: 15, color: 'var(--color-primary)' }))))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          React.createElement('label', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, type === 'main' ? 'اسم الفئة الرئيسية' : 'اسم الفئة الفرعية', React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
          React.createElement('input', { value: name, onChange: e => setName(e.target.value), placeholder: type === 'main' ? 'مثال: ترفيه' : 'مثال: وقود', className: 'se-focusable', style: { width: '100%', height: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', fontSize: 14, fontFamily: 'var(--font-arabic)', color: 'var(--color-text)', background: 'var(--color-surface)' } })),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          React.createElement('label', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, 'الأيقونة', type === 'main' && ' واللون', React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
          React.createElement('button', { type: 'button', onClick: () => setIconSheetOpen(true), className: 'se-focusable', style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 52, boxSizing: 'border-box', padding: '0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', cursor: 'pointer', textAlign: 'start' } },
            React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: (type === 'main' ? color : (parent ? parent.color : color)) + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: icon, size: 16, color: type === 'main' ? color : (parent ? parent.color : color) })),
            React.createElement('span', { style: { flex: 1, fontSize: 14, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, 'تغيير الأيقونة' + (type === 'main' ? ' واللون' : '')),
            React.createElement(Icon, { name: 'chevron-down', size: 14, color: 'var(--color-text-muted)' }))),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)' } }, 'المعاينة'),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', background: 'var(--color-surface-sunken)' } },
            React.createElement('div', { style: { width: 36, height: 36, borderRadius: '50%', background: (type === 'main' ? color : (parent ? parent.color : color)) + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: icon, size: 17, color: type === 'main' ? color : (parent ? parent.color : color) })),
            React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, type === 'sub' ? `${parent ? parent.label : ''} ← ${name || '...'}` : (name || '...')))),
        error && React.createElement('span', { style: { fontSize: 12, color: 'var(--color-expense)', fontFamily: 'var(--font-arabic)' } }, error))),
    React.createElement(IconColorSheet, { open: iconSheetOpen, icon, color, showColor: type === 'main', onClose: () => setIconSheetOpen(false), onConfirm: (i, c) => { setIcon(i); if (type === 'main') setColor(c); setIconSheetOpen(false); } }));
}
window.CategoryFormDialog = CategoryFormDialog;
