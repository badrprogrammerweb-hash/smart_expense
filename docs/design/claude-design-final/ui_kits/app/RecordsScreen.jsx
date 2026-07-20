function RecordsScreen({ kind, role, onAdd, onEdit, onDeleteRequest, onOpenReceipt, lang = 'ar' }) {
  const { PageHeading, Button, FilterBar, Input, Select, DateField, Table, MobileRecordCard, Pagination, Badge, IconButton, DropdownMenu, EmptyState, Alert, Icon } = window.SmartExpenseAIDesignSystem_44f3e6;
  const { incomeRecords, expenseRecords, categories } = window.SEMockData;
  const isEn = lang === 'en';
  const dir = isEn ? 'ltr' : 'rtl';
  const incomeCategories = isEn ? [
    { value: 'all', label: 'All income categories' },
    { value: 'fixed', label: 'Fixed income' },
    { value: 'extra', label: 'Extra income' },
    { value: 'refund', label: 'Refund' },
    { value: 'other', label: 'Other' },
  ] : [
    { value: 'all', label: 'جميع فئات الدخل' },
    { value: 'fixed', label: 'دخل ثابت' },
    { value: 'extra', label: 'دخل إضافي' },
    { value: 'refund', label: 'استرداد' },
    { value: 'other', label: 'أخرى' },
  ];
  const t = isEn ? {
    incomeTitle: 'Income', expenseTitle: 'Expenses',
    incomeDesc: 'All recorded income sources', expenseDesc: 'All expenses recorded this month',
    addIncome: 'Add income', addExpense: 'Add expense',
    search: 'Search', searchPlaceholder: 'Search by name…', searchPlaceholderExpense: 'Search by description or category...',
    expenseCategory: 'Expense category', allCategories: 'All categories', date: 'Date',
    emptyIncomeTitle: 'No income records', emptyExpenseTitle: 'No expenses',
    emptyDesc: 'Try changing the filters or add a new record.',
    source: 'Source', description: 'Description', category: 'Category', by: 'By', amount: 'Amount',
    edit: 'Edit', delete: 'Delete', options: 'Options', empty: 'No data to display',
    editExpense: 'Edit expense', openReceipt: 'Open receipt', deleteExpense: 'Delete expense',
  } : {
    incomeTitle: 'الدخل', expenseTitle: 'المصاريف',
    incomeDesc: 'جميع مصادر الدخل المسجّلة', expenseDesc: 'جميع المصاريف المسجّلة لهذا الشهر',
    addIncome: 'إضافة دخل', addExpense: 'إضافة مصروف',
    search: 'البحث', searchPlaceholder: 'ابحث بالاسم…', searchPlaceholderExpense: 'ابحث في الوصف أو الفئة...',
    expenseCategory: 'فئة المصروف', allCategories: 'جميع الفئات', date: 'التاريخ',
    emptyIncomeTitle: 'لا توجد سجلات دخل', emptyExpenseTitle: 'لا توجد مصاريف',
    emptyDesc: 'جرّب تغيير الفلاتر أو أضف سجلًا جديدًا.',
    source: 'المصدر', description: 'الوصف', category: 'الفئة', by: 'بواسطة', amount: 'المبلغ',
    edit: 'تعديل', delete: 'حذف', options: 'خيارات', empty: 'لا توجد بيانات لعرضها',
    editExpense: 'تعديل المصروف', openReceipt: 'فتح الإيصال', deleteExpense: 'حذف المصروف',
  };
  const catEn = {
    'بقالة': 'Groceries', 'مواصلات': 'Transport', 'سكن': 'Housing', 'طعام': 'Dining', 'مطاعم': 'Dining', 'صحة': 'Health', 'أخرى': 'Other',
    'دخل ثابت': 'Fixed income', 'دخل إضافي': 'Extra income',
    'مشتريات منزلية': 'Household purchases', 'وقود': 'Fuel', 'صيدلية': 'Pharmacy',
  };
  const catLabel = (c) => isEn ? (catEn[c] || c) : c;
  const currency = isEn ? 'SAR' : 'ر.س';
  const isIncome = kind === 'income';
  const incomeCatIcon = { 'دخل ثابت': 'wallet', 'دخل إضافي': 'sparkles', 'أخرى': 'more-horizontal' };
  const iconFor = (r) => isIncome ? (incomeCatIcon[r.category] || 'more-horizontal') : (r.icon || 'shopping-cart');
  const categoryPath = (r) => r.subcategory ? `${catLabel(r.category)} › ${catLabel(r.subcategory)}` : catLabel(r.category);
  const records = isIncome ? incomeRecords : expenseRecords;
  const canAdd = isIncome ? (role === 'owner' || role === 'admin') : (role !== 'viewer');
  const canDelete = role === 'owner' || role === 'admin';
  const [q, setQ] = React.useState('');
  const [incomeCategory, setIncomeCategory] = React.useState('all');
  const [expenseCategory, setExpenseCategory] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState('');
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [draftCategory, setDraftCategory] = React.useState('all');
  const [draftDate, setDraftDate] = React.useState('');
  const [actionSheetRecord, setActionSheetRecord] = React.useState(null);
  const filtered = records.filter(r => r.title.includes(q) || (r.category && r.category.includes(q)) || (r.subcategory && r.subcategory.includes(q)));
  const categoryOptions = [{ value: 'all', label: t.allCategories }, ...categories.map(c => ({ value: c.value, label: catLabel(c.label) }))];
  const openFilterSheet = () => { setDraftCategory(expenseCategory); setDraftDate(dateFilter); setFilterSheetOpen(true); };
  const applyFilters = () => { setExpenseCategory(draftCategory); setDateFilter(draftDate); setFilterSheetOpen(false); };
  const clearFilters = () => { setExpenseCategory('all'); setDateFilter(''); setDraftCategory('all'); setDraftDate(''); setFilterSheetOpen(false); };
  const activeChips = [];
  if (!isIncome && expenseCategory !== 'all') { const opt = categoryOptions.find(o => o.value === expenseCategory); activeChips.push({ key: 'cat', label: opt ? opt.label : expenseCategory, onRemove: () => setExpenseCategory('all') }); }
  if (!isIncome && dateFilter) activeChips.push({ key: 'date', label: dateFilter, onRemove: () => setDateFilter('') });

  const rowActions = (r, size) => React.createElement(React.Fragment, null,
    React.createElement('button', { type: 'button', title: t.edit, 'aria-label': t.edit, disabled: !canDelete, onClick: (e) => { e.stopPropagation(); onEdit && onEdit(r); }, className: `se-focusable se-row-action ${size === 'lg' ? 'se-row-action-lg' : ''}`.trim() }, React.createElement(Icon, { name: 'pencil', size: size === 'lg' ? 18 : 15 })),
    !isIncome && r.hasReceipt && React.createElement('button', { type: 'button', title: t.openReceipt, 'aria-label': t.openReceipt, onClick: (e) => { e.stopPropagation(); onOpenReceipt && onOpenReceipt(r); }, className: `se-focusable se-row-action ${size === 'lg' ? 'se-row-action-lg' : ''}`.trim() }, React.createElement(Icon, { name: 'receipt', size: size === 'lg' ? 18 : 15 })),
    React.createElement('button', { type: 'button', title: t.delete, 'aria-label': t.delete, disabled: !canDelete, onClick: (e) => { e.stopPropagation(); onDeleteRequest({ ...r, kind }); }, className: `se-focusable se-row-action se-row-action-danger ${size === 'lg' ? 'se-row-action-lg' : ''}`.trim() }, React.createElement(Icon, { name: 'trash-2', size: size === 'lg' ? 18 : 15 })));

  return React.createElement('div', { dir, className: !isIncome ? 'se-expense-page' : undefined, style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    isEn && React.createElement(Alert, { tone: 'warning', title: 'Future state — Phase 12' }, 'This English preview mirrors the current Arabic layout; full localization is planned for a later phase.'),
    isIncome ?
      React.createElement('div', { dir, style: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontFamily: 'var(--font-arabic)' } },
        React.createElement('div', null,
          React.createElement('h1', { style: { fontSize: 'var(--text-page-title-size)', fontWeight: 'var(--text-page-title-weight)', color: 'var(--color-text)', margin: 0 } }, t.incomeTitle),
          React.createElement('p', { style: { fontSize: 14, color: 'var(--color-text-muted)', margin: '6px 0 0' } }, t.incomeDesc)),
        canAdd && React.createElement(Button, { icon: 'plus', onClick: onAdd }, t.addIncome)) :
      React.createElement('div', { className: 'se-expense-heading' }, React.createElement(PageHeading, { dir, title: t.expenseTitle, description: t.expenseDesc,
        actions: canAdd ? React.createElement(Button, { icon: 'plus', onClick: onAdd }, t.addExpense) : null })),
    React.createElement(FilterBar, { dir },
      React.createElement(Input, { label: t.search, icon: 'search', value: q, onChange: e => setQ(e.target.value), placeholder: isIncome ? t.searchPlaceholder : t.searchPlaceholderExpense }),
      isIncome ? React.createElement(Select, { label: isEn ? 'Income category' : 'فئة الدخل', value: incomeCategory, onChange: e => setIncomeCategory(e.target.value), options: incomeCategories }) :
        React.createElement('div', { className: 'se-filters-desktop-only' },
          React.createElement(Select, { label: t.expenseCategory, value: expenseCategory, onChange: e => setExpenseCategory(e.target.value), options: categoryOptions }),
          React.createElement('div', { style: { width: 190 } }, React.createElement(DateField, { label: t.date, value: dateFilter, onChange: e => setDateFilter(e.target.value) }))),
      isIncome && React.createElement('div', { style: { width: 190 } }, React.createElement(DateField, { label: t.date })),
      !isIncome && React.createElement('button', { type: 'button', onClick: openFilterSheet, className: 'se-focusable se-filter-trigger-mobile', style: { alignSelf: 'flex-end', alignItems: 'center', gap: 6, height: 44, padding: '0 14px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer', flexShrink: 0 } },
        React.createElement(Icon, { name: 'sliders-horizontal', size: 16 }), isEn ? 'Filter' : 'تصفية', activeChips.length > 0 && React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--color-primary)', borderRadius: 99, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' } }, activeChips.length))),
    !isIncome && activeChips.length > 0 && React.createElement('div', { className: 'se-filter-chips-mobile', style: { flexWrap: 'wrap', gap: 8 } },
      activeChips.map(chip => React.createElement('span', { key: chip.key, style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 6px 0 10px', borderRadius: 99, background: 'var(--color-surface-sunken)', fontSize: 12.5, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } },
        chip.label,
        React.createElement('button', { type: 'button', onClick: chip.onRemove, 'aria-label': isEn ? 'Remove filter' : 'إزالة الفلتر', className: 'se-focusable', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'var(--color-border)', cursor: 'pointer' } }, React.createElement(Icon, { name: 'x', size: 12 }))))),
    filtered.length === 0 ? React.createElement(EmptyState, { dir, icon: isIncome ? 'trending-up' : 'trending-down', title: isIncome ? t.emptyIncomeTitle : t.emptyExpenseTitle, description: t.emptyDesc }) :
    React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'se-desktop-table' },
        React.createElement(Table, { dir, emptyLabel: t.empty, columns: [
          { key: 'title', label: isIncome ? t.source : t.description, render: r => React.createElement('span', { style: { display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.title || undefined }, r.title || '—') },
          { key: 'category', label: t.category, width: 190, render: r => React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' } }, React.createElement(Icon, { name: iconFor(r), size: 14, color: 'var(--color-text-muted)', style: { flexShrink: 0 } }), React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 } }, React.createElement(Badge, { tone: 'neutral' }, categoryPath(r)))) },
          { key: 'date', label: t.date, width: 104, render: r => React.createElement('span', { dir: 'ltr' }, r.date) },
          { key: 'actor', label: t.by, width: 122, className: 'se-col-hide-narrow' },
          { key: 'amount', label: t.amount, align: 'end', width: 112, render: r => React.createElement('span', { dir: 'ltr', style: { fontWeight: 700, color: isIncome ? 'var(--color-income)' : 'var(--color-expense)' } }, `${isIncome ? '+' : '-'}${r.amount} ${currency}`) },
          { key: 'actions', label: '', align: 'center', width: isIncome ? 88 : 116, render: r => React.createElement('div', { style: { display: 'flex', justifyContent: 'center', gap: 4 } }, rowActions(r)) },
        ], rows: filtered })),
      React.createElement('div', { className: 'se-mobile-cards', style: { display: 'none', flexDirection: 'column', gap: 10 } },
        filtered.map(r => React.createElement(MobileRecordCard, { key: r.id, currency, icon: iconFor(r), title: r.title || '—', category: categoryPath(r), date: r.date, amount: r.amount, kind: isIncome ? 'income' : 'expense',
          actions: isIncome ? rowActions(r, 'lg') : undefined,
          cornerAction: !isIncome ? React.createElement('button', { type: 'button', 'aria-label': t.options, title: t.options, onClick: () => setActionSheetRecord(r), className: 'se-focusable se-row-action' }, React.createElement(Icon, { name: 'more-vertical', size: 16 })) : undefined })))),
    filtered.length > 0 && React.createElement(Pagination, { page: 1, totalPages: 1, dir }),
    !isIncome && filterSheetOpen && React.createElement('div', { dir, style: { position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 250, display: 'flex', alignItems: 'flex-end' }, onClick: () => setFilterSheetOpen(false) },
      React.createElement('div', { onClick: e => e.stopPropagation(), style: { width: '100%', background: 'var(--color-surface)', borderRadius: '16px 16px 0 0', padding: '10px 16px calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-arabic)' } },
        React.createElement('div', { style: { width: 36, height: 4, borderRadius: 99, background: 'var(--color-border-strong)', alignSelf: 'center', margin: '4px 0 2px' } }),
        React.createElement('div', { style: { fontSize: 16, fontWeight: 700, color: 'var(--color-text)' } }, isEn ? 'Filter' : 'تصفية'),
        React.createElement(Select, { label: t.expenseCategory, value: draftCategory, onChange: e => setDraftCategory(e.target.value), options: categoryOptions }),
        React.createElement(DateField, { label: t.date, value: draftDate, onChange: e => setDraftDate(e.target.value) }),
        React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 4 } },
          React.createElement(Button, { variant: 'secondary', size: 'lg', fullWidth: true, onClick: clearFilters }, isEn ? 'Clear filters' : 'مسح الفلاتر'),
          React.createElement(Button, { size: 'lg', fullWidth: true, onClick: applyFilters }, isEn ? 'Apply' : 'تطبيق')))),
    !isIncome && actionSheetRecord && React.createElement('div', { dir, style: { position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 250, display: 'flex', alignItems: 'flex-end' }, onClick: () => setActionSheetRecord(null) },
      React.createElement('div', { onClick: e => e.stopPropagation(), style: { width: '100%', background: 'var(--color-surface)', borderRadius: '16px 16px 0 0', padding: '10px 12px calc(12px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'var(--font-arabic)' } },
        React.createElement('div', { style: { width: 36, height: 4, borderRadius: 99, background: 'var(--color-border-strong)', alignSelf: 'center', margin: '4px 0 10px' } }),
        React.createElement('button', { onClick: () => { onEdit && onEdit(actionSheetRecord); setActionSheetRecord(null); }, disabled: !canDelete, className: 'se-focusable se-row-hover', style: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '0 12px', borderRadius: 'var(--radius-control)', border: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 15, fontWeight: 500, cursor: 'pointer', textAlign: 'start', opacity: canDelete ? 1 : 0.5 } },
          React.createElement(Icon, { name: 'pencil', size: 18 }), t.editExpense),
        actionSheetRecord.hasReceipt && React.createElement('button', { onClick: () => { onOpenReceipt && onOpenReceipt(actionSheetRecord); setActionSheetRecord(null); }, className: 'se-focusable se-row-hover', style: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '0 12px', borderRadius: 'var(--radius-control)', border: 'none', background: 'transparent', color: 'var(--color-text)', fontSize: 15, fontWeight: 500, cursor: 'pointer', textAlign: 'start' } },
          React.createElement(Icon, { name: 'receipt', size: 18 }), t.openReceipt),
        React.createElement('button', { onClick: () => { onDeleteRequest({ ...actionSheetRecord, kind: 'expense' }); setActionSheetRecord(null); }, disabled: !canDelete, className: 'se-focusable se-row-hover', style: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '0 12px', borderRadius: 'var(--radius-control)', border: 'none', background: 'transparent', color: 'var(--color-expense)', fontSize: 15, fontWeight: 500, cursor: 'pointer', textAlign: 'start', opacity: canDelete ? 1 : 0.5 } },
          React.createElement(Icon, { name: 'trash-2', size: 18 }), t.deleteExpense))));
}
window.RecordsScreen = RecordsScreen;
