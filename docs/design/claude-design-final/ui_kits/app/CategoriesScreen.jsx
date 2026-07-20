function seedExpenseTree() {
  return [
    { value: 'transport', label: 'مواصلات', icon: 'car', color: '#3B82F6', archived: false, usedInRecords: true, subs: [
      { value: 'fuel', label: 'وقود', icon: 'fuel', archived: false, usedInRecords: true },
      { value: 'maintenance', label: 'صيانة', icon: 'wrench', archived: false, usedInRecords: false },
      { value: 'taxi', label: 'أجرة', icon: 'car-taxi-front', archived: false, usedInRecords: false },
    ] },
    { value: 'food', label: 'طعام', icon: 'utensils', color: '#DC2626', archived: false, usedInRecords: true, subs: [
      { value: 'restaurants', label: 'مطاعم', icon: 'utensils', archived: false, usedInRecords: true },
      { value: 'cafes', label: 'مقاهي', icon: 'coffee', archived: false, usedInRecords: false },
      { value: 'groceries', label: 'بقالة', icon: 'shopping-cart', archived: false, usedInRecords: true },
    ] },
    { value: 'family', label: 'عائلة', icon: 'users', color: '#8B5CF6', archived: false, usedInRecords: false, subs: [
      { value: 'home', label: 'المنزل', icon: 'home', archived: false, usedInRecords: false },
      { value: 'children', label: 'الأطفال', icon: 'baby', archived: false, usedInRecords: false },
      { value: 'home-maintenance', label: 'صيانة منزلية', icon: 'wrench', archived: false, usedInRecords: false },
    ] },
    { value: 'bills', label: 'فواتير', icon: 'receipt', color: '#F59E0B', archived: false, usedInRecords: true, subs: [
      { value: 'electricity', label: 'كهرباء', icon: 'zap', archived: false, usedInRecords: true },
      { value: 'telecom', label: 'اتصالات', icon: 'phone', archived: false, usedInRecords: false },
      { value: 'internet', label: 'إنترنت', icon: 'wifi', archived: false, usedInRecords: false },
      { value: 'gas', label: 'غاز', icon: 'flame', archived: false, usedInRecords: false },
    ] },
    { value: 'health', label: 'صحة', icon: 'heart-pulse', color: '#0D9488', archived: false, usedInRecords: true, subs: [
      { value: 'pharmacy', label: 'صيدلية', icon: 'pill', archived: false, usedInRecords: true },
      { value: 'hospital', label: 'مستشفى', icon: 'stethoscope', archived: false, usedInRecords: false },
    ] },
    { value: 'delivery-legacy', label: 'توصيل طلبات', icon: 'package', color: '#64748B', archived: true, usedInRecords: true, subs: [] },
  ];
}
function seedIncomeTree() {
  return [
    { value: 'fixed', label: 'دخل ثابت', icon: 'wallet', color: '#16A34A', archived: false, usedInRecords: true, subs: [
      { value: 'salary', label: 'راتب', icon: 'banknote', archived: false, usedInRecords: true },
      { value: 'pension', label: 'معاش', icon: 'landmark', archived: false, usedInRecords: false },
    ] },
    { value: 'extra', label: 'دخل إضافي', icon: 'sparkles', color: '#0F7A5C', archived: false, usedInRecords: true, subs: [
      { value: 'freelance', label: 'عمل حر', icon: 'briefcase', archived: false, usedInRecords: true },
      { value: 'refund', label: 'استرداد', icon: 'rotate-ccw', archived: false, usedInRecords: false },
    ] },
    { value: 'bonus-legacy', label: 'مكافأة قديمة', icon: 'gift', color: '#64748B', archived: true, usedInRecords: true, subs: [] },
  ];
}

function CategoriesScreen({ role }) {
  const { Button, Icon, IconButton, Badge, Select, DropdownMenu, ConfirmDialog } = window.SmartExpenseAIDesignSystem_44f3e6;
  const canManage = role === 'owner' || role === 'admin';
  const [domain, setDomain] = React.useState('expense');
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [expanded, setExpanded] = React.useState({});
  const [expenseTree, setExpenseTree] = React.useState(seedExpenseTree);
  const [incomeTree, setIncomeTree] = React.useState(seedIncomeTree);
  const [formState, setFormState] = React.useState(null);
  const [archiveTarget, setArchiveTarget] = React.useState(null);
  const [highlight, setHighlight] = React.useState(null);

  React.useEffect(() => { if (!highlight) return; const t = setTimeout(() => setHighlight(null), 2500); return () => clearTimeout(t); }, [highlight]);

  const tree = domain === 'expense' ? expenseTree : incomeTree;
  const setTree = domain === 'expense' ? setExpenseTree : setIncomeTree;
  const toggleExpand = (v) => setExpanded(e => ({ ...e, [v]: !e[v] }));

  const getSiblingLabels = (type, parentValue) => {
    const excludeValue = formState && formState.target ? formState.target.value : undefined;
    if (type === 'main') return tree.filter(m => m.value !== excludeValue).map(m => m.label);
    const p = tree.find(m => m.value === parentValue);
    return p ? p.subs.filter(s => s.value !== excludeValue).map(s => s.label) : [];
  };

  const handleSubmit = (payload) => {
    const setterForDomain = payload.domain === 'expense' ? setExpenseTree : setIncomeTree;
    if (payload.mode === 'add') {
      const newValue = 'custom-' + Date.now();
      if (payload.type === 'main') {
        setterForDomain(prev => [...prev, { value: newValue, label: payload.label, icon: payload.icon, color: payload.color, archived: false, usedInRecords: false, subs: [] }]);
      } else {
        setterForDomain(prev => prev.map(m => m.value === payload.parentValue ? { ...m, subs: [...m.subs, { value: newValue, label: payload.label, icon: payload.icon, archived: false, usedInRecords: false }] } : m));
        setExpanded(e => ({ ...e, [payload.parentValue]: true }));
      }
      setHighlight(newValue);
    } else {
      if (payload.type === 'main') {
        setterForDomain(prev => prev.map(m => m.value === payload.value ? { ...m, label: payload.label, icon: payload.icon, color: payload.color } : m));
      } else {
        setterForDomain(prev => {
          let subData = null;
          const stripped = prev.map(m => ({ ...m, subs: m.subs.filter(s => { if (s.value === payload.value) { subData = s; return false; } return true; }) }));
          const merged = subData ? { ...subData, label: payload.label, icon: payload.icon } : { value: payload.value, label: payload.label, icon: payload.icon, archived: false, usedInRecords: false };
          return stripped.map(m => m.value === payload.parentValue ? { ...m, subs: [...m.subs, merged] } : m);
        });
        setExpanded(e => ({ ...e, [payload.parentValue]: true }));
      }
      setHighlight(payload.value);
    }
    setFormState(null);
  };

  const confirmArchive = () => {
    const t = archiveTarget;
    const setter = t.domain === 'expense' ? setExpenseTree : setIncomeTree;
    if (t.type === 'main') setter(prev => prev.map(m => m.value === t.value ? { ...m, archived: true } : m));
    else setter(prev => prev.map(m => m.value === t.parentValue ? { ...m, subs: m.subs.map(s => s.value === t.value ? { ...s, archived: true } : s) } : m));
    setArchiveTarget(null);
  };
  const restoreCategory = (type, value, parentValue) => {
    if (type === 'main') setTree(prev => prev.map(m => m.value === value ? { ...m, archived: false } : m));
    else setTree(prev => prev.map(m => m.value === parentValue ? { ...m, subs: m.subs.map(s => s.value === value ? { ...s, archived: false } : s) } : m));
  };

  const q = query.trim();
  const showActive = statusFilter !== 'archived';
  const showArchived = statusFilter !== 'active';
  const activeMains = tree.filter(m => !m.archived && (!q || m.label.includes(q) || m.subs.some(s => s.label.includes(q))));
  const archivedMains = tree.filter(m => m.archived && (!q || m.label.includes(q)));

  const MainCard = (m) => {
    const isOpen = !!expanded[m.value];
    const isHi = highlight === m.value;
    return React.createElement('div', { key: m.value, style: { border: `1px solid ${isHi ? 'var(--color-primary)' : 'var(--color-border)'}`, boxShadow: isHi ? '0 0 0 3px var(--color-primary-subtle)' : 'none', borderRadius: 'var(--radius-card)', background: 'var(--color-surface)', transition: 'box-shadow .3s ease' } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' } },
        React.createElement('button', { type: 'button', onClick: () => toggleExpand(m.value), 'aria-label': isOpen ? 'طي' : 'توسيع', className: 'se-focusable se-row-action' }, React.createElement(Icon, { name: isOpen ? 'chevron-up' : 'chevron-down', size: 16 })),
        React.createElement('div', { style: { width: 36, height: 36, borderRadius: '50%', background: m.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: m.icon, size: 17, color: m.color })),
        React.createElement('div', { style: { flex: 1, minWidth: 0 } },
          React.createElement('div', { style: { fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m.label),
          React.createElement('div', { style: { fontSize: 12, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)' } }, m.subs.length > 0 ? `${m.subs.length} فئات فرعية` : 'بدون فئات فرعية')),
        canManage && React.createElement(IconButton, { icon: 'pencil', label: 'تعديل', size: 'sm', onClick: () => setFormState({ mode: 'edit', type: 'main', domain, target: { value: m.value, label: m.label, icon: m.icon, color: m.color } }) }),
        canManage && React.createElement(DropdownMenu, { align: 'start', trigger: React.createElement(IconButton, { icon: 'more-vertical', label: 'خيارات', size: 'sm' }),
          items: [
            { label: 'إضافة فئة فرعية', onClick: () => setFormState({ mode: 'add', type: 'sub', domain, target: { parentValue: m.value } }) },
            { divider: true },
            { label: 'تعطيل الفئة', destructive: true, onClick: () => setArchiveTarget({ domain, type: 'main', value: m.value, label: m.label, usedInRecords: m.usedInRecords }) },
          ] })),
      isOpen && React.createElement('div', { style: { borderTop: '1px solid var(--color-border)', padding: '8px 14px 12px', paddingInlineStart: 56, display: 'flex', flexDirection: 'column', gap: 4 } },
        m.subs.map(s => {
          const isSubHi = highlight === s.value;
          return React.createElement('div', { key: s.value, style: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, opacity: s.archived ? 0.55 : 1, borderRadius: 'var(--radius-control)', boxShadow: isSubHi ? '0 0 0 2px var(--color-primary-subtle)' : 'none' } },
            React.createElement('div', { style: { width: 26, height: 26, borderRadius: '50%', background: m.color + '1a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: s.icon, size: 13, color: m.color })),
            React.createElement('span', { style: { flex: 1, fontSize: 13.5, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.label),
            s.archived && React.createElement(Badge, { tone: 'neutral' }, 'معطلة'),
            canManage && !s.archived && React.createElement(IconButton, { icon: 'pencil', label: 'تعديل', size: 'sm', onClick: () => setFormState({ mode: 'edit', type: 'sub', domain, target: { value: s.value, label: s.label, icon: s.icon, parentValue: m.value } }) }),
            canManage && (s.archived ?
              React.createElement('button', { type: 'button', onClick: () => restoreCategory('sub', s.value, m.value), className: 'se-focusable se-row-action', title: 'استعادة', 'aria-label': 'استعادة' }, React.createElement(Icon, { name: 'rotate-ccw', size: 14 })) :
              React.createElement('button', { type: 'button', onClick: () => setArchiveTarget({ domain, type: 'sub', value: s.value, parentValue: m.value, label: s.label, usedInRecords: s.usedInRecords }), className: 'se-focusable se-row-action se-row-action-danger', title: 'تعطيل', 'aria-label': 'تعطيل' }, React.createElement(Icon, { name: 'archive', size: 14 }))));
        }),
        canManage && React.createElement('button', { type: 'button', onClick: () => setFormState({ mode: 'add', type: 'sub', domain, target: { parentValue: m.value } }), className: 'se-focusable se-row-hover', style: { display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 8px', border: 'none', background: 'none', borderRadius: 'var(--radius-control)', color: 'var(--color-primary)', fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer', alignSelf: 'flex-start' } },
          React.createElement(Icon, { name: 'plus', size: 14 }), 'إضافة فئة فرعية')));
  };

  return React.createElement('div', { dir: 'rtl', style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--font-arabic)' } },
      React.createElement('div', null,
        React.createElement('h1', { style: { fontSize: 'var(--text-page-title-size)', fontWeight: 'var(--text-page-title-weight)', color: 'var(--color-text)', margin: 0 } }, 'الفئات'),
        React.createElement('p', { style: { fontSize: 14, color: 'var(--color-text-muted)', margin: '6px 0 0' } }, 'تنظيم فئات الدخل والمصاريف الرئيسية والفرعية')),
      canManage && React.createElement(Button, { icon: 'plus', onClick: () => setFormState({ mode: 'add', type: 'main', domain, target: null }) }, 'إضافة فئة')),
    React.createElement('div', { style: { display: 'flex', gap: 8 } },
      React.createElement('button', { type: 'button', onClick: () => setDomain('expense'), className: 'se-focusable', style: { flex: '0 1 220px', height: 40, borderRadius: 'var(--radius-control)', border: `1px solid ${domain === 'expense' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: domain === 'expense' ? 'var(--color-primary-subtle)' : 'var(--color-surface)', color: domain === 'expense' ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: 600, fontSize: 13.5, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'فئات المصاريف'),
      React.createElement('button', { type: 'button', onClick: () => setDomain('income'), className: 'se-focusable', style: { flex: '0 1 220px', height: 40, borderRadius: 'var(--radius-control)', border: `1px solid ${domain === 'income' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`, background: domain === 'income' ? 'var(--color-primary-subtle)' : 'var(--color-surface)', color: domain === 'income' ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: 600, fontSize: 13.5, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'فئات الدخل')),
    React.createElement('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', padding: 12, borderRadius: 'var(--radius-card)', background: 'var(--color-surface)', border: '1px solid var(--color-border)' } },
      React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 220px', minWidth: 200 } },
        React.createElement(Icon, { name: 'search', size: 16, color: 'var(--color-text-muted)', style: { position: 'absolute', insetInlineStart: 12 } }),
        React.createElement('input', { value: query, onChange: e => setQuery(e.target.value), placeholder: 'ابحث عن فئة...', className: 'se-focusable', style: { width: '100%', height: 40, boxSizing: 'border-box', padding: '0 40px 0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', fontSize: 14, fontFamily: 'var(--font-arabic)', color: 'var(--color-text)', background: 'var(--color-surface)' } })),
      React.createElement('div', { style: { width: 160 } }, React.createElement(Select, { value: statusFilter, onChange: e => setStatusFilter(e.target.value), options: [{ value: 'all', label: 'الكل' }, { value: 'active', label: 'النشطة' }, { value: 'archived', label: 'المعطلة' }] }))),
    showActive && React.createElement('div', { className: 'se-cat-grid' }, activeMains.map(MainCard),
      activeMains.length === 0 && React.createElement('div', { style: { fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)', padding: 20, textAlign: 'center', gridColumn: '1/-1' } }, 'لا توجد فئات مطابقة')),
    showArchived && archivedMains.length > 0 && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
      React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)' } }, 'فئات معطّلة (سياق تاريخي)'),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
        archivedMains.map(m => React.createElement('div', { key: m.value, style: { display: 'flex', alignItems: 'center', gap: 10, opacity: 0.6, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: '10px 14px' } },
          React.createElement('div', { style: { width: 32, height: 32, borderRadius: '50%', background: 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: m.icon, size: 15, color: 'var(--color-text-muted)' })),
          React.createElement('span', { style: { flex: 1, fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } }, m.label),
          React.createElement(Badge, { tone: 'neutral' }, 'معطلة'),
          canManage && React.createElement(Button, { variant: 'ghost', size: 'sm', icon: 'rotate-ccw', onClick: () => restoreCategory('main', m.value) }, 'استعادة'))))),
    formState && React.createElement(window.CategoryFormDialog, {
      open: true, domain: formState.domain, mode: formState.mode, initialType: formState.type, target: formState.target,
      mainCategories: (formState.domain === 'expense' ? expenseTree : incomeTree).map(m => ({ value: m.value, label: m.label, icon: m.icon, color: m.color, archived: m.archived })),
      getSiblingLabels, onClose: () => setFormState(null), onSubmit: handleSubmit }),
    archiveTarget && React.createElement(ConfirmDialog, { open: true, onClose: () => setArchiveTarget(null), onConfirm: confirmArchive, confirmLabel: 'تعطيل',
      title: `تعطيل «${archiveTarget.label}»؟`,
      description: archiveTarget.usedInRecords ? 'لا يمكن حذف هذه الفئة نهائيًا لأنها مستخدمة في سجلات مالية سابقة. يمكنك تعطيلها، وستبقى ظاهرة في السجلات القديمة.' : 'سيتم تعطيل هذه الفئة ولن تكون متاحة لسجلات جديدة. يمكنك استعادتها لاحقًا.' }));
}
window.CategoriesScreen = CategoriesScreen;
