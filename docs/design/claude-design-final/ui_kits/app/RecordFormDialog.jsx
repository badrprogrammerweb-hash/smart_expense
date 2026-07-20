const STR = {
  ar: {
    incomeTitle: 'إضافة دخل', incomeDesc: 'سجّل دخلاً جديدًا', expenseTitle: 'إضافة مصروف', expenseDesc: 'سجّل مصروفًا جديدًا يدويًا',
    amount: 'المبلغ', category: 'الفئة', incomeCategory: 'فئة الدخل', selectCategory: 'اختر الفئة',
    description: 'وصف الدخل (اختياري)', descPlaceholder: 'مثال: راتب شهر يوليو',
    notes: 'ملاحظات (اختياري)', notesPlaceholderIncome: 'أضف أي تفاصيل إضافية...', notesPlaceholderExpense: 'يمكنك إضافة اسم التاجر أو أي تفاصيل إضافية هنا…',
    receipt: 'إيصال (اختياري)', cancel: 'إلغاء', addIncome: 'إضافة الدخل', save: 'حفظ',
    phase12: 'Future state — Phase 12', phase12Note: 'ستُستخدم عملة مساحة العمل: ر.س',
    phase13: 'Phase 13', currency: 'ر.س', notAvailable: 'غير متاحة',
    expenseTitleEdit: 'تعديل المصروف', addExpense: 'إضافة المصروف', saveChanges: 'حفظ التعديلات',
  },
  en: {
    incomeTitle: 'Add income', incomeDesc: 'Record a new income entry',
    amount: 'Amount', incomeCategory: 'Income category', selectCategory: 'Select category',
    description: 'Income description (optional)', descPlaceholder: 'Example: July salary',
    notes: 'Notes (optional)', notesPlaceholderIncome: 'Add any additional details...',
    cancel: 'Cancel', addIncome: 'Add income',
    phase12: 'Future state — Phase 12', phase12Note: 'Workspace currency: SAR',
    phase13: 'Phase 13', currency: 'SAR',
    expenseTitleEdit: 'Edit expense', addExpense: 'Add expense', saveChanges: 'Save changes',
  },
};
function todayStr() { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; }

function RecordFormDialog({ open, kind, role = 'owner', lang = 'ar', editRecord, previewMode = true, onClose, onSave }) {
  const { Dialog, Button, AmountInput, Input, Textarea, FileUpload, CategoryPickerDialog, DateField, Icon, Badge } = window.SmartExpenseAIDesignSystem_44f3e6;
  const isIncome = kind === 'income';
  const isEditing = !!editRecord;
  const isEn = isIncome && lang === 'en';
  const dir = isEn ? 'ltr' : 'rtl';
  const t = isEn ? STR.en : STR.ar;
  const canManageCategories = role === 'owner' || role === 'admin';
  const initialCategories = () => isIncome ? (isEn ? window.SEMockData.incomeCategoryTreeEn : window.SEMockData.incomeCategoryTree) : window.SEMockData.expenseCategoryTree;
  const [categories, setCategories] = React.useState(initialCategories);
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState(todayStr);
  const [category, setCategory] = React.useState(null);
  const [notes, setNotes] = React.useState('');
  const [receipt, setReceipt] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [sheet, setSheet] = React.useState(null);

  React.useEffect(() => {
    if (!open) return;
    setCategories(initialCategories());
    if (editRecord) {
      setAmount(editRecord.amount ? String(editRecord.amount).replace(/,/g, '') : '');
      setDescription(editRecord.title || '');
      setDate(editRecord.date || todayStr());
      setCategory(null);
      setNotes('');
    } else {
      setAmount(''); setDescription(''); setDate(todayStr()); setCategory(null); setNotes('');
    }
    setReceipt(null); setSheet(null); setSaving(false);
  }, [open, kind, lang, editRecord]);

  const onPickReceipt = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name);
    setReceipt({ name: file.name, isPdf, url: isPdf ? null : URL.createObjectURL(file) });
  };
  const save = () => { setSaving(true); setTimeout(() => { setSaving(false); onSave(); }, 700); };
  const onCreateCategory = (newCat, parentValue) => {
    setCategories(prev => parentValue
      ? prev.map(c => c.value === parentValue ? { ...c, subs: [...(c.subs || []), newCat] } : c)
      : [...prev, { ...newCat, subs: [] }]);
  };
  const fieldTrigger = (icon, text, onClick, isPlaceholder) => React.createElement('button', { onClick, className: 'se-focusable', style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', cursor: 'pointer', textAlign: 'start' } },
    icon && React.createElement(Icon, { name: icon, size: 16, color: 'var(--color-text-muted)' }),
    React.createElement('span', { style: { flex: 1, fontSize: 14, color: isPlaceholder ? 'var(--color-text-muted)' : 'var(--color-text)' } }, text),
    React.createElement(Icon, { name: 'chevron-down', size: 14, color: 'var(--color-text-muted)' }));
  const categoryLabel = category ? (category.isSub ? `${category.mainLabel} › ${category.label}` : category.label) : t.selectCategory;

  return React.createElement(React.Fragment, null,
    React.createElement(Dialog, { open, onClose, dir, size: isIncome ? 540 : 'md', mobileFullSheet: isIncome,
      title: isIncome ? t.incomeTitle : (isEditing ? t.expenseTitleEdit : t.expenseTitle), description: isIncome ? t.incomeDesc : t.expenseDesc,
      footer: React.createElement(React.Fragment, null,
        React.createElement(Button, { variant: 'secondary', onClick: onClose, disabled: saving }, t.cancel),
        React.createElement(Button, { onClick: save, loading: saving }, isIncome ? t.addIncome : (isEditing ? t.saveChanges : t.addExpense))) },
      React.createElement('div', { dir, style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement(AmountInput, { label: t.amount, kind: isIncome ? 'income' : 'expense', currency: t.currency, value: amount, onChange: e => setAmount(e.target.value), required: true }),
        !isIncome && previewMode && React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: -6 } },
          React.createElement(Badge, { tone: 'warning', dot: true }, t.phase12),
          React.createElement('span', { style: { fontSize: 12, color: 'var(--color-text-muted)' } }, t.phase12Note)),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            React.createElement('label', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)' } }, isIncome ? t.incomeCategory : t.category, React.createElement('span', { style: { color: 'var(--color-expense)' } }, ' *')),
            previewMode && React.createElement(Badge, { tone: 'warning', dot: true }, t.phase13)),
          fieldTrigger(category && category.icon, categoryLabel, () => setSheet('category'), !category)),
        isIncome && React.createElement(Input, { label: t.description, placeholder: t.descPlaceholder, value: description, onChange: e => setDescription(e.target.value) }),
        DateField && React.createElement(DateField, { label: isEn ? 'Date' : 'التاريخ', lang: isEn ? 'en' : 'ar', required: true, value: date, onChange: e => setDate(e.target.value) }),
        !isIncome && React.createElement(FileUpload, { label: t.receipt, fileName: receipt && receipt.name, onPick: onPickReceipt }),
        !isIncome && receipt && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border)', background: 'var(--color-surface-hover)' } },
          receipt.isPdf ?
            React.createElement('div', { style: { width: 36, height: 36, borderRadius: 8, background: 'var(--color-expense-subtle)', color: 'var(--color-expense)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 } }, 'PDF') :
            React.createElement('img', { src: receipt.url, alt: '', style: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 } }),
          React.createElement('span', { dir: 'ltr', style: { fontSize: 13, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, receipt.name)),
        React.createElement(Textarea, { label: t.notes, placeholder: isIncome ? t.notesPlaceholderIncome : t.notesPlaceholderExpense, value: notes, onChange: e => setNotes(e.target.value), rows: isIncome ? 3 : undefined }))),
    CategoryPickerDialog && React.createElement(CategoryPickerDialog, { open: sheet === 'category', categories, selected: category, canManageCategories, onCreateCategory, lang: isEn ? 'en' : 'ar', title: isIncome ? t.incomeCategory : undefined, onClose: () => setSheet(null), onSelect: (c) => { setCategory(c); setSheet(null); } }));
}
window.RecordFormDialog = RecordFormDialog;
