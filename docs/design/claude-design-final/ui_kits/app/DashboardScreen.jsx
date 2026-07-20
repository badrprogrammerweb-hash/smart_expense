function DashboardScreen({ role, onNavigate, onAddExpense, onAddIncome, onUploadReceipt, emptyMode, loadingMode, lang = 'ar' }) {
  const { SummaryCard, InfoCard, Button, Badge, StatusBadge, Chart, EmptyState, Skeleton, MobileRecordCard } = window.SmartExpenseAIDesignSystem_44f3e6;
  const { expenseRecords, incomeRecords, categories, aiQueue } = window.SEMockData;
  const isEn = lang === 'en';
  const dir = isEn ? 'ltr' : 'rtl';
  const currency = isEn ? 'SAR' : 'ر.س';
  const catEn = { 'بقالة': 'Groceries', 'مواصلات': 'Transport', 'سكن': 'Housing', 'طعام': 'Dining', 'مطاعم': 'Dining', 'صحة': 'Health', 'أخرى': 'Other', 'دخل ثابت': 'Fixed income', 'دخل إضافي': 'Extra income' };
  const catLabel = (c) => isEn ? (catEn[c] || c) : c;
  const t = isEn ? {
    balance: 'Remaining balance — July 2026', balanceEmpty: 'No data for this month yet', trend: 'After 5,080.00 SAR in expenses',
    income: 'Total income', expense: 'Total expenses',
    addExpense: 'Add expense', addIncome: 'Add income', uploadReceipt: 'Upload receipt', reviewN: (n) => `Review ${n} extracted item${n === 1 ? '' : 's'}`,
    recent: 'Recent activity', viewAll: 'View all', emptyRecentTitle: 'No transactions yet', emptyRecentDesc: 'Add your first expense or income to start tracking your budget.',
    breakdown: 'Category breakdown', emptyBreakdown: 'No breakdown yet',
    pendingReview: 'Pending review', openQueue: 'Open review queue',
  } : {
    balance: 'الرصيد المتبقي — يوليو 2026', balanceEmpty: 'لا توجد بيانات لهذا الشهر بعد', trend: 'بعد 5,080.00 ر.س من المصاريف',
    income: 'إجمالي الدخل', expense: 'إجمالي المصاريف',
    addExpense: 'إضافة مصروف', addIncome: 'إضافة دخل', uploadReceipt: 'رفع إيصال', reviewN: (n) => `مراجعة ${n} عملية مستخرجة`,
    recent: 'أحدث العمليات', viewAll: 'عرض الكل', emptyRecentTitle: 'لا توجد عمليات بعد', emptyRecentDesc: 'أضف أول مصروف أو دخل لبدء تتبع ميزانيتك.',
    breakdown: 'التوزيع حسب الفئة', emptyBreakdown: 'لا يوجد توزيع بعد',
    pendingReview: 'قيد انتظار المراجعة', openQueue: 'فتح قائمة المراجعة',
  };
  const canAddIncome = role !== 'viewer' && role !== 'member';
  const recent = emptyMode ? [] : [...expenseRecords.slice(0, 3).map(r => ({ ...r, kind: 'expense' })), ...incomeRecords.slice(0, 2).map(r => ({ ...r, kind: 'income' }))].sort((a, b) => b.date.localeCompare(a.date));
  const catData = categories.slice(0, 4).map((c, i) => ({ label: catLabel(c.label), value: [420, 260, 610, 130][i], color: c.color }));
  return React.createElement('div', { dir, style: { display: 'flex', flexDirection: 'column', gap: 20 } },
    React.createElement('div', { className: 'se-summary-grid', style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)', gap: 14 } },
      React.createElement(SummaryCard, { dir, currency, label: t.balance, amount: emptyMode ? '0.00' : '3,420.00', icon: 'wallet', emphasis: true, trend: emptyMode ? t.balanceEmpty : t.trend }),
      React.createElement(SummaryCard, { dir, currency, label: t.income, amount: emptyMode ? '0.00' : '8,500.00', kind: 'income', icon: 'trending-up' }),
      React.createElement(SummaryCard, { dir, currency, label: t.expense, amount: emptyMode ? '0.00' : '5,080.00', kind: 'expense', icon: 'trending-down' })),
    React.createElement('div', { style: { display: 'flex', gap: 10, flexWrap: 'wrap' } },
      React.createElement(Button, { icon: 'plus', onClick: onAddExpense }, t.addExpense),
      canAddIncome && React.createElement(Button, { variant: 'secondary', icon: 'plus', onClick: onAddIncome }, t.addIncome),
      React.createElement(Button, { variant: 'secondary', icon: 'upload', onClick: onUploadReceipt }, t.uploadReceipt),
      aiQueue.filter(a => a.status === 'ready').length > 0 && React.createElement(Button, { variant: 'ghost', icon: 'sparkles', onClick: () => onNavigate('ai-review') }, t.reviewN(aiQueue.filter(a => a.status === 'ready').length))),
    React.createElement('div', { className: 'se-two-col', style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)', gap: 14 } },
      React.createElement(InfoCard, { dir, title: t.recent, actions: React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: () => onNavigate('expenses') }, t.viewAll) },
        loadingMode ? React.createElement(Skeleton, { variant: 'row', count: 4 }) :
        recent.length === 0 ? React.createElement(EmptyState, { dir, icon: 'receipt', title: t.emptyRecentTitle, description: t.emptyRecentDesc, actionLabel: t.addExpense, onAction: onAddExpense }) :
        React.createElement(React.Fragment, null,
          React.createElement('div', { className: 'se-desktop-table', style: { display: 'flex', flexDirection: 'column', gap: 10 } },
            recent.map(r => React.createElement('div', { key: r.id, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, paddingBottom: 10, borderBottom: '1px solid var(--color-border)' } },
              React.createElement('div', null,
                React.createElement('div', { style: { fontSize: 14, fontWeight: 600, color: 'var(--color-text)' } }, r.title),
                React.createElement('div', { style: { fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', gap: 6 } }, catLabel(r.category), React.createElement('span', null, '•'), React.createElement('span', { dir: 'ltr' }, r.date))),
              React.createElement('span', { dir: 'ltr', style: { fontWeight: 700, color: r.kind === 'income' ? 'var(--color-income)' : 'var(--color-expense)', fontFeatureSettings: "'tnum' 1" } }, `${r.kind === 'income' ? '+' : '-'}${r.amount} ${currency}`)))),
          React.createElement('div', { className: 'se-mobile-cards', style: { display: 'none', flexDirection: 'column', gap: 10 } },
            recent.map(r => React.createElement(MobileRecordCard, { key: r.id, currency, icon: r.icon || (r.kind === 'income' ? 'banknote' : 'shopping-cart'), title: r.title, category: catLabel(r.category), date: r.date, amount: r.amount, kind: r.kind }))))),
      React.createElement(InfoCard, { dir, title: t.breakdown },
        loadingMode ? React.createElement(Skeleton, { variant: 'card' }) :
        emptyMode ? React.createElement(EmptyState, { dir, icon: 'pie-chart', title: t.emptyBreakdown }) :
        React.createElement(Chart, { type: 'donut', data: catData, height: 160 }))),
    !emptyMode && aiQueue.some(a => a.status === 'ready' || a.status === 'failed') && React.createElement(InfoCard, { dir, title: t.pendingReview, actions: React.createElement(Button, { variant: 'ghost', size: 'sm', onClick: () => onNavigate('ai-review') }, t.openQueue) },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        aiQueue.filter(a => a.status === 'ready' || a.status === 'failed').map(a => React.createElement('div', { key: a.id, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 } },
          React.createElement('span', { dir: 'ltr', style: { fontSize: 13, color: 'var(--color-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, a.fileName),
          React.createElement(StatusBadge, { status: a.status, lang }))))));
}
window.DashboardScreen = DashboardScreen;
