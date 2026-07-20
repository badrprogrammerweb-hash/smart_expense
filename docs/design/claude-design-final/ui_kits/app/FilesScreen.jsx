const STATUS_META = {
  processing: { tone: 'info', label: 'قيد المعالجة' },
  ready: { tone: 'warning', label: 'جاهز للمراجعة' },
  confirmed: { tone: 'income', label: 'مؤكَّد' },
  failed: { tone: 'expense', label: 'فشل' },
};
function FileThumb({ file, size }) {
  const { Icon } = window.SmartExpenseAIDesignSystem_44f3e6;
  const isPdf = file.fileType === 'pdf';
  return React.createElement('div', { style: { width: size, height: size, flexShrink: 0, borderRadius: 'var(--radius-control)', background: isPdf ? 'var(--color-expense-subtle)' : 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' } },
    React.createElement(Icon, { name: isPdf ? 'file-text' : 'file-image', size: Math.round(size * 0.4), color: isPdf ? 'var(--color-expense)' : 'var(--color-text-faint)' }));
}
function FilesScreen({ onUpload, loadingMode, emptyMode, errorMode }) {
  const { PageHeading, Button, Icon, IconButton, Badge, StatusBadge, EmptyState, Dialog, ConfirmDialog, DropdownMenu, Select, DateField, Skeleton } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [files, setFiles] = React.useState(window.SEMockData.files);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState('');
  const [draft, setDraft] = React.useState({ status: 'all', type: 'all', date: '' });
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [previewFile, setPreviewFile] = React.useState(null);
  const [actionSheetFile, setActionSheetFile] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [retryLoading, setRetryLoading] = React.useState(null);

  const statusOptions = [{ value: 'all', label: 'جميع الحالات' }, { value: 'processing', label: 'قيد المعالجة' }, { value: 'ready', label: 'جاهز للمراجعة' }, { value: 'confirmed', label: 'مؤكد' }, { value: 'failed', label: 'فشل' }];
  const typeOptions = [{ value: 'all', label: 'جميع الملفات' }, { value: 'image', label: 'الصور' }, { value: 'pdf', label: 'PDF' }];

  const filtered = files.filter(f => f.fileName.toLowerCase().includes(query.trim().toLowerCase()) && (statusFilter === 'all' || f.status === statusFilter) && (typeFilter === 'all' || f.fileType === typeFilter) && (!dateFilter || f.date === dateFilter));
  const activeChips = [statusFilter !== 'all' && { key: 'status', label: statusOptions.find(o => o.value === statusFilter).label, clear: () => setStatusFilter('all') }, typeFilter !== 'all' && { key: 'type', label: typeOptions.find(o => o.value === typeFilter).label, clear: () => setTypeFilter('all') }, dateFilter && { key: 'date', label: dateFilter, clear: () => setDateFilter('') }].filter(Boolean);

  const openFilterSheet = () => { setDraft({ status: statusFilter, type: typeFilter, date: dateFilter }); setFilterSheetOpen(true); };
  const applyFilters = () => { setStatusFilter(draft.status); setTypeFilter(draft.type); setDateFilter(draft.date); setFilterSheetOpen(false); };
  const clearFilters = () => { setStatusFilter('all'); setTypeFilter('all'); setDateFilter(''); setDraft({ status: 'all', type: 'all', date: '' }); setFilterSheetOpen(false); };

  const retryFile = (f) => {
    setRetryLoading(f.id);
    setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: 'processing' } : x));
    setTimeout(() => { setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: 'ready' } : x)); setRetryLoading(null); }, 1200);
  };
  const confirmDelete = () => { setFiles(prev => prev.filter(x => x.id !== deleteTarget.id)); setDeleteTarget(null); };

  const menuItems = (f, close) => {
    const items = [{ label: 'معاينة الملف', onClick: () => { setPreviewFile(f); close && close(); } }];
    if (f.linkedTitle) items.push({ label: 'فتح المصروف المرتبط', onClick: close });
    else if (f.status === 'ready' || f.status === 'confirmed') items.push({ label: 'ربط الملف بمصروف', onClick: close });
    if (f.status === 'ready') items.push({ label: 'مراجعة نتيجة الاستخراج', onClick: close });
    if (f.status === 'failed') items.push({ label: 'إعادة المحاولة', onClick: () => { retryFile(f); close && close(); } });
    items.push({ divider: true }, { label: 'حذف الملف', destructive: true, onClick: () => { setDeleteTarget(f); close && close(); } });
    return items;
  };

  const linkLabel = (f) => f.linkedTitle ? `مرتبط بـ ${f.linkedTitle}` : 'غير مرتبط';

  const DesktopCard = (f) => React.createElement('div', { key: f.id, style: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column' } },
    React.createElement('div', { onClick: () => setPreviewFile(f), style: { cursor: 'pointer', height: 108, borderRadius: 'var(--radius-card) var(--radius-card) 0 0', background: f.fileType === 'pdf' ? 'var(--color-expense-subtle)' : 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement(Icon, { name: f.fileType === 'pdf' ? 'file-text' : 'file-image', size: 30, color: f.fileType === 'pdf' ? 'var(--color-expense)' : 'var(--color-text-faint)' })),
    React.createElement('div', { style: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 } },
      React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 } },
        React.createElement('span', { dir: 'ltr', title: f.fileName, style: { fontSize: 13, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 } }, f.fileName),
        React.createElement(DropdownMenu, { align: 'end', trigger: React.createElement(IconButton, { icon: 'more-vertical', label: 'خيارات', size: 'sm' }), items: menuItems(f) })),
      React.createElement('span', { dir: 'ltr', style: { fontSize: 11, color: 'var(--color-text-muted)' } }, `${f.date} · ${f.size}`),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } },
        React.createElement(StatusBadge, { status: f.status }),
        f.status === 'failed' ? React.createElement('button', { type: 'button', onClick: () => retryFile(f), disabled: retryLoading === f.id, className: 'se-focusable', style: { border: 'none', background: 'none', color: 'var(--color-expense)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, retryLoading === f.id ? 'جارٍ إعادة المحاولة...' : 'إعادة المحاولة')
        : f.status === 'ready' ? React.createElement('button', { type: 'button', onClick: () => setPreviewFile(f), className: 'se-focusable', style: { border: 'none', background: 'none', color: 'var(--color-primary)', fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'مراجعة النتيجة')
        : React.createElement('span', { style: { fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, linkLabel(f)))));

  const MobileCard = (f) => React.createElement('div', { key: f.id, style: { display: 'flex', alignItems: 'center', gap: 10, minHeight: 76, padding: '10px 12px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', background: 'var(--color-surface)' } },
    React.createElement('div', { onClick: () => setPreviewFile(f) }, React.createElement(FileThumb, { file: f, size: 56 })),
    React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 } },
      React.createElement('span', { dir: 'ltr', style: { fontSize: 14, fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, f.fileName),
      React.createElement('span', { dir: 'ltr', style: { fontSize: 12, color: 'var(--color-text-muted)' } }, `${f.date} · ${f.size}`),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
        React.createElement(StatusBadge, { status: f.status }),
        React.createElement('span', { style: { fontSize: 11, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)' } }, linkLabel(f)))),
    React.createElement('button', { type: 'button', onClick: () => setActionSheetFile(f), 'aria-label': 'خيارات', className: 'se-focusable se-row-action', style: { flexShrink: 0 } }, React.createElement(Icon, { name: 'more-vertical', size: 18 })));

  const showEmpty = emptyMode || files.length === 0;

  return React.createElement('div', { dir: 'rtl', style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement(PageHeading, { title: 'الإيصالات والملفات', description: 'جميع الإيصالات والفواتير والملفات المرفوعة', actions: React.createElement(Button, { icon: 'upload', onClick: onUpload }, 'رفع إيصال أو فاتورة') }),
    !showEmpty && !errorMode && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 10 } },
        React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 220px', minWidth: 200 } },
          React.createElement(Icon, { name: 'search', size: 16, color: 'var(--color-text-muted)', style: { position: 'absolute', insetInlineStart: 12 } }),
          React.createElement('input', { value: query, onChange: e => setQuery(e.target.value), placeholder: 'ابحث باسم الملف...', className: 'se-focusable', style: { width: '100%', height: 44, boxSizing: 'border-box', padding: '0 40px 0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', fontSize: 14, fontFamily: 'var(--font-arabic)', color: 'var(--color-text)', background: 'var(--color-surface)' } })),
        React.createElement('div', { className: 'se-files-filters-inline', style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
          React.createElement('div', { style: { width: 170 } }, React.createElement(Select, { value: statusFilter, onChange: e => setStatusFilter(e.target.value), options: statusOptions })),
          React.createElement('div', { style: { width: 150 } }, React.createElement(Select, { value: typeFilter, onChange: e => setTypeFilter(e.target.value), options: typeOptions })),
          React.createElement('div', { style: { width: 170 } }, React.createElement(DateField, { label: '', value: dateFilter, onChange: e => setDateFilter(e.target.value) }))),
        React.createElement('button', { type: 'button', onClick: openFilterSheet, className: 'se-focusable se-files-filter-trigger', style: { alignSelf: 'flex-end', alignItems: 'center', gap: 6, height: 44, padding: '0 14px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer', flexShrink: 0 } },
          React.createElement(Icon, { name: 'sliders-horizontal', size: 16 }), 'تصفية', activeChips.length > 0 && React.createElement('span', { style: { fontSize: 11, fontWeight: 700, background: 'var(--color-primary)', color: '#fff', borderRadius: 99, minWidth: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' } }, activeChips.length))),
      activeChips.length > 0 && React.createElement('div', { className: 'se-files-chips', style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
        activeChips.map(chip => React.createElement('span', { key: chip.key, style: { display: 'inline-flex', alignItems: 'center', gap: 6, height: 30, padding: '0 6px 0 10px', borderRadius: 99, background: 'var(--color-surface-sunken)', fontSize: 12, color: 'var(--color-text)', fontFamily: 'var(--font-arabic)' } },
          chip.label, React.createElement('button', { type: 'button', onClick: chip.clear, 'aria-label': 'إزالة', className: 'se-focusable', style: { border: 'none', background: 'none', display: 'flex', cursor: 'pointer', color: 'var(--color-text-muted)' } }, React.createElement(Icon, { name: 'x', size: 12 })))))),
    errorMode ? React.createElement(EmptyState, { icon: 'alert-triangle', title: 'تعذّر تحميل الملفات', description: 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.', actionLabel: 'إعادة المحاولة', onAction: () => {} }) :
    loadingMode ? React.createElement('div', { className: 'se-files-grid' }, Array.from({ length: 6 }).map((_, i) => React.createElement('div', { key: i, style: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', overflow: 'hidden' } }, React.createElement(Skeleton, { variant: 'card', height: 108 }), React.createElement('div', { style: { padding: 12, display: 'flex', flexDirection: 'column', gap: 8 } }, React.createElement(Skeleton, { width: '80%' }), React.createElement(Skeleton, { width: '50%' }))))) :
    showEmpty ? React.createElement(EmptyState, { icon: 'file-image', title: 'لا توجد ملفات بعد', description: 'ارفع أول إيصال أو فاتورة لبدء الاستخراج الذكي.', actionLabel: 'رفع إيصال أو فاتورة', onAction: onUpload }) :
    filtered.length === 0 ? React.createElement(EmptyState, { icon: 'search-x', title: 'لا توجد نتائج مطابقة', description: 'جرّب تعديل كلمة البحث أو الفلاتر.' }) :
    React.createElement(React.Fragment, null,
      React.createElement('div', { className: 'se-files-grid', style: { display: 'grid' } }, filtered.map(DesktopCard)),
      React.createElement('div', { className: 'se-files-list-wrap', style: { flexDirection: 'column', gap: 10 } }, filtered.map(MobileCard))),
    filterSheetOpen && React.createElement('div', { dir: 'rtl', style: { position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 250, display: 'flex', alignItems: 'flex-end' }, onClick: () => setFilterSheetOpen(false) },
      React.createElement('div', { onClick: e => e.stopPropagation(), style: { width: '100%', background: 'var(--color-surface)', borderRadius: '16px 16px 0 0', padding: '10px 16px calc(16px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-arabic)' } },
        React.createElement('div', { style: { width: 36, height: 4, borderRadius: 99, background: 'var(--color-border-strong)', alignSelf: 'center', margin: '4px 0 2px' } }),
        React.createElement('div', { style: { fontSize: 16, fontWeight: 700, color: 'var(--color-text)' } }, 'تصفية'),
        React.createElement(Select, { label: 'الحالة', value: draft.status, onChange: e => setDraft(d => ({ ...d, status: e.target.value })), options: statusOptions }),
        React.createElement(Select, { label: 'نوع الملف', value: draft.type, onChange: e => setDraft(d => ({ ...d, type: e.target.value })), options: typeOptions }),
        React.createElement(DateField, { label: 'التاريخ', value: draft.date, onChange: e => setDraft(d => ({ ...d, date: e.target.value })) }),
        React.createElement('div', { style: { display: 'flex', gap: 10, marginTop: 4 } },
          React.createElement(Button, { variant: 'secondary', size: 'lg', fullWidth: true, onClick: clearFilters }, 'مسح الفلاتر'),
          React.createElement(Button, { size: 'lg', fullWidth: true, onClick: applyFilters }, 'تطبيق')))),
    actionSheetFile && React.createElement('div', { dir: 'rtl', style: { position: 'fixed', inset: 0, background: 'var(--color-overlay)', zIndex: 250, display: 'flex', alignItems: 'flex-end' }, onClick: () => setActionSheetFile(null) },
      React.createElement('div', { onClick: e => e.stopPropagation(), style: { width: '100%', background: 'var(--color-surface)', borderRadius: '16px 16px 0 0', padding: '10px 12px calc(12px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'var(--font-arabic)' } },
        React.createElement('div', { style: { width: 36, height: 4, borderRadius: 99, background: 'var(--color-border-strong)', alignSelf: 'center', margin: '4px 0 10px' } }),
        menuItems(actionSheetFile, () => setActionSheetFile(null)).map((it, i) => it.divider ? React.createElement('div', { key: i, style: { height: 1, background: 'var(--color-border)', margin: '6px 0' } }) :
          React.createElement('button', { key: i, onClick: it.onClick, className: 'se-focusable se-row-hover', style: { display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, padding: '0 12px', borderRadius: 'var(--radius-control)', border: 'none', background: 'transparent', color: it.destructive ? 'var(--color-expense)' : 'var(--color-text)', fontSize: 15, fontWeight: 500, cursor: 'pointer', textAlign: 'start' } },
            React.createElement(Icon, { name: it.destructive ? 'trash-2' : (it.label === 'معاينة الملف' ? 'eye' : it.label.includes('مرتبط') || it.label.includes('ربط') ? 'link' : it.label.includes('محاولة') ? 'rotate-ccw' : 'sparkles'), size: 18 }), it.label)))),
    previewFile && React.createElement(Dialog, { open: true, onClose: () => setPreviewFile(null), title: previewFile.fileName, mobileFullSheet: true, size: 480,
      footer: React.createElement(Button, { variant: 'secondary', onClick: () => setPreviewFile(null) }, 'إغلاق') },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
        React.createElement('div', { style: { height: 220, borderRadius: 'var(--radius-card)', background: previewFile.fileType === 'pdf' ? 'var(--color-expense-subtle)' : 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
          React.createElement(Icon, { name: previewFile.fileType === 'pdf' ? 'file-text' : 'file-image', size: 48, color: previewFile.fileType === 'pdf' ? 'var(--color-expense)' : 'var(--color-text-faint)' })),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
          [['النوع', previewFile.fileType === 'pdf' ? 'PDF' : 'صورة'], ['الحجم', previewFile.size], ['تاريخ الرفع', previewFile.date], ['الارتباط', linkLabel(previewFile)]].map(([k, v]) => React.createElement('div', { key: k, style: { display: 'flex', justifyContent: 'space-between', fontSize: 13 } },
            React.createElement('span', { style: { color: 'var(--color-text-muted)' } }, k), React.createElement('span', { dir: k === 'الحجم' || k === 'تاريخ الرفع' ? 'ltr' : undefined, style: { color: 'var(--color-text)', fontWeight: 600 } }, v))),
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 } },
            React.createElement('span', { style: { color: 'var(--color-text-muted)' } }, 'الحالة'), React.createElement(StatusBadge, { status: previewFile.status }))))),
    deleteTarget && React.createElement(ConfirmDialog, { open: true, onClose: () => setDeleteTarget(null), onConfirm: confirmDelete, confirmLabel: 'حذف', title: 'حذف الملف؟', description: 'سيتم حذف هذا الملف نهائيًا، ولا يمكن التراجع عن هذا الإجراء.' }));
}
window.FilesScreen = FilesScreen;
