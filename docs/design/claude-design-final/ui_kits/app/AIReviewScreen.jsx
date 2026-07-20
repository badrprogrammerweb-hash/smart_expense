function ReceiptBlock({ file, onOpen, compact }) {
  const { Icon } = window.SmartExpenseAIDesignSystem_44f3e6;
  const isPdf = file && /\.pdf$/i.test(file.fileName || '');
  if (compact) {
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border)', background: 'var(--color-surface-sunken)' } },
      React.createElement('div', { style: { width: 40, height: 40, borderRadius: 8, background: isPdf ? 'var(--color-expense-subtle)' : 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } },
        React.createElement(Icon, { name: isPdf ? 'file-text' : 'file-image', size: 18, color: isPdf ? 'var(--color-expense)' : 'var(--color-text-faint)' })),
      React.createElement('span', { dir: 'ltr', style: { flex: 1, unicodeBidi: 'plaintext', fontSize: 12.5, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: file.fileName }, file.fileName),
      React.createElement('button', { type: 'button', onClick: onOpen, className: 'se-focusable', style: { border: 'none', background: 'none', color: 'var(--color-primary)', fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer', whiteSpace: 'nowrap' } }, 'فتح الملف'));
  }
  return React.createElement('div', { onClick: onOpen, style: { cursor: 'pointer', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', overflow: 'hidden', background: 'var(--color-surface-sunken)' } },
    React.createElement('div', { style: { position: 'relative', height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#EEF2F6' } },
      React.createElement(Icon, { name: isPdf ? 'file-text' : 'file-image', size: 36, color: 'var(--color-text-faint)' }),
      React.createElement('button', { 'aria-label': 'تكبير', className: 'se-focusable', style: { position: 'absolute', top: 10, insetInlineEnd: 10, width: 32, height: 32, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' } },
        React.createElement(Icon, { name: 'zoom-in', size: 16 }))),
    React.createElement('div', { dir: 'ltr', style: { padding: '10px 14px', fontSize: 12, color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, file.fileName));
}

function AIReviewScreen({ role }) {
  const { PageHeading, InfoCard, StatusBadge, Badge, Icon, IconButton, AIReviewForm, ConfirmDialog, Dialog, PermissionDeniedState } = window.SmartExpenseAIDesignSystem_44f3e6;
  const { aiQueue, expenseCategoryTree, workspaceCurrency } = window.SEMockData;
  const pendingFirst = aiQueue.find(a => a.status !== 'confirmed' && a.status !== 'discarded');
  const [selectedId, setSelectedId] = React.useState((pendingFirst || aiQueue[0]).id);
  const [queue, setQueue] = React.useState(aiQueue);
  const [categories, setCategories] = React.useState(expenseCategoryTree);
  const [discardTarget, setDiscardTarget] = React.useState(null);
  const [mobileStep, setMobileStep] = React.useState('list');
  const [viewerFile, setViewerFile] = React.useState(null);
  const canReview = role !== 'viewer';
  const canManageCategories = role === 'owner' || role === 'admin';
  const selected = queue.find(a => a.id === selectedId);

  const setField = (id) => (k, v) => setQueue(q => q.map(item => item.id === id ? { ...item, fields: { ...item.fields, [k]: v } } : item));
  const confirm = (id) => setQueue(q => q.map(item => item.id === id ? { ...item, status: 'confirmed' } : item));
  const discard = (id) => { setQueue(q => q.map(item => item.id === id ? { ...item, status: 'discarded' } : item)); setDiscardTarget(null); };
  const retryExtraction = (id) => setQueue(q => q.map(item => item.id === id ? { ...item, status: 'ready', error: undefined, fields: { ...item.fields, amount: item.fields.amount || '', category: item.fields.category || null, date: item.fields.date || '' } } : item));
  const onCreateCategory = (newCat, parentValue) => setCategories(prev => parentValue ? prev.map(c => c.value === parentValue ? { ...c, subs: [...(c.subs || []), newCat] } : c) : [...prev, { ...newCat, subs: [] }]);
  const selectItem = (id) => { setSelectedId(id); setMobileStep('detail'); };

  if (!canReview) {
    return React.createElement('div', { dir: 'rtl' },
      React.createElement(PageHeading, { title: 'مراجعة الاستخراج الذكي' }),
      React.createElement(PermissionDeniedState, { roleRequired: 'المالك أو المشرف أو العضو', description: 'لا يمكن للمشاهد مراجعة أو تأكيد عمليات الاستخراج الذكي.' }));
  }

  const queueRow = (a, mobile) => React.createElement('button', {
    key: a.id, onClick: () => mobile ? selectItem(a.id) : setSelectedId(a.id), className: 'se-row-hover se-focusable',
    style: { display: 'flex', alignItems: 'center', gap: 10, textAlign: 'start', width: '100%', padding: mobile ? '14px 16px' : '12px 16px', border: 'none', borderBottom: '1px solid var(--color-border)', background: !mobile && a.id === selectedId ? 'var(--color-primary-subtle)' : 'transparent', cursor: 'pointer' },
  },
    React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 } },
      React.createElement('span', { dir: 'ltr', style: { fontSize: mobile ? 14 : 12, fontWeight: mobile ? 600 : 400, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', unicodeBidi: 'plaintext' }, title: a.fileName }, a.fileName),
      React.createElement(StatusBadge, { status: a.status })),
    mobile && React.createElement(Icon, { name: 'chevron-left', size: 18, color: 'var(--color-text-faint)' }));

  const detailForm = (mobileMode) => {
    if (!selected) return null;
    return React.createElement(AIReviewForm, {
      status: selected.status, fields: selected.fields, onFieldChange: setField(selected.id),
      categories, onCreateCategory, canManageCategories,
      receiptCurrency: selected.currency, workspaceCurrency, errorMessage: selected.error,
      hideHeader: mobileMode,
      hideActions: mobileMode,
      onConfirm: () => { confirm(selected.id); if (mobileMode) setMobileStep('list'); },
      onDiscard: () => setDiscardTarget(selected.id),
      onRetry: () => retryExtraction(selected.id),
    });
  };

  const desktopBlock = React.createElement('div', { className: 'se-air-desktop' },
    React.createElement(PageHeading, { title: 'مراجعة الاستخراج الذكي', description: 'راجع القيم المستخرجة قبل تأكيدها كمصروف. لن تُحتسب أي عملية ضمن الأرصدة حتى تأكيدها.' }),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)', gap: 16, marginTop: 16 } },
      React.createElement(InfoCard, { title: 'قائمة الانتظار', padded: false },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } }, queue.map(a => queueRow(a, false)))),
      selected && React.createElement(InfoCard, { title: 'تفاصيل العملية' },
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 20 } },
          React.createElement(ReceiptBlock, { file: selected, onOpen: () => setViewerFile(selected), compact: true }),
          detailForm(false)),
        selected.status === 'confirmed' && React.createElement(Badge, { tone: 'income', dot: true, style: { marginTop: 10 } }, 'تم التأكيد كمصروف'))));

  const mobileListScreen = mobileStep === 'list' && React.createElement(React.Fragment, null,
    React.createElement(PageHeading, { title: 'مراجعة الاستخراج الذكي', description: 'راجع القيم المستخرجة قبل تأكيدها كمصروف.' }),
    React.createElement(InfoCard, { title: 'قائمة الانتظار', padded: false, style: { marginTop: 16 } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } }, queue.map(a => queueRow(a, true)))));

  const mobileDetailScreen = mobileStep === 'detail' && selected && React.createElement('div', { className: 'se-air-detail-screen' },
    React.createElement('div', { className: 'se-air-detail-header' },
      React.createElement(IconButton, { icon: 'arrow-right', label: 'رجوع إلى قائمة الانتظار', size: 'lg', variant: 'ghost', onClick: () => setMobileStep('list') }),
      React.createElement('div', { style: { flex: 1, minWidth: 0 } },
        React.createElement('div', { dir: 'ltr', style: { fontSize: 14, fontWeight: 700, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', unicodeBidi: 'plaintext' }, title: selected.fileName }, selected.fileName),
        React.createElement(StatusBadge, { status: selected.status }))),
    React.createElement('div', { className: 'se-air-detail-body' },
      React.createElement(ReceiptBlock, { file: selected, onOpen: () => setViewerFile(selected), compact: true }),
      detailForm(true),
      selected.status === 'confirmed' && React.createElement(Badge, { tone: 'income', dot: true, style: { marginTop: 10 } }, 'تم التأكيد كمصروف')),
    selected.status !== 'confirmed' && selected.status !== 'discarded' && React.createElement('div', { className: 'se-air-detail-footer' },
      React.createElement('button', { type: 'button', onClick: () => setDiscardTarget(selected.id), className: 'se-focusable se-btn', style: { flex: 1, height: 48, borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: 'var(--color-surface)', color: 'var(--color-text)', fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: 'pointer' } }, 'تجاهل'),
      React.createElement('button', { type: 'button', disabled: selected.status === 'failed', onClick: () => { confirm(selected.id); setMobileStep('list'); }, className: 'se-focusable se-btn', style: { flex: 2, height: 48, borderRadius: 'var(--radius-control)', border: 'none', background: selected.status === 'failed' ? 'var(--color-border)' : 'var(--color-primary)', color: '#fff', fontWeight: 600, fontFamily: 'var(--font-arabic)', cursor: selected.status === 'failed' ? 'not-allowed' : 'pointer' } }, 'تأكيد')));

  const mobileBlock = React.createElement('div', { className: 'se-air-mobile' }, mobileListScreen, mobileDetailScreen);

  const discardDialog = React.createElement(ConfirmDialog, { open: !!discardTarget, onClose: () => setDiscardTarget(null), onConfirm: () => discard(discardTarget), title: 'تجاهل هذه العملية؟', description: 'لن تتم إضافة هذه القيم كمصروف. يمكنك إعادة رفع الإيصال لاحقًا.', confirmLabel: 'تجاهل' });

  const viewerDialog = viewerFile && React.createElement(Dialog, { open: true, onClose: () => setViewerFile(null), title: viewerFile.fileName, mobileFullSheet: true, size: 420, footer: React.createElement('div', null) },
    React.createElement('div', { style: { height: 240, borderRadius: 'var(--radius-card)', background: 'var(--color-surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement(Icon, { name: /\.pdf$/i.test(viewerFile.fileName) ? 'file-text' : 'file-image', size: 44, color: 'var(--color-text-faint)' })));

  return React.createElement('div', { dir: 'rtl', style: { display: 'flex', flexDirection: 'column', gap: 16 } }, desktopBlock, mobileBlock, discardDialog, viewerDialog);
}
window.AIReviewScreen = AIReviewScreen;
