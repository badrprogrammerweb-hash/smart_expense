const HISTORY_TYPE_META = {
  income: { icon: 'trending-up', bg: 'var(--color-income-subtle)', color: 'var(--color-income)' },
  expense: { icon: 'trending-down', bg: 'var(--color-expense-subtle)', color: 'var(--color-expense)' },
  'expense-delete': { icon: 'trash-2', bg: 'var(--color-expense-subtle)', color: 'var(--color-expense)' },
  ai: { icon: 'sparkles', bg: 'var(--color-primary-subtle)', color: 'var(--color-primary)' },
  member: { icon: 'user', bg: 'var(--color-info-subtle)', color: 'var(--color-info)' },
  category: { icon: 'tag', bg: 'var(--color-warning-subtle)', color: 'var(--color-warning)' },
};
const TYPE_FILTERS = [
  { value: '', label: 'جميع الأحداث' },
  { value: 'income', label: 'الدخل' },
  { value: 'expense', label: 'المصاريف' },
  { value: 'ai', label: 'الاستخراج الذكي' },
  { value: 'category', label: 'الفئات' },
  { value: 'member', label: 'الأعضاء' },
];
function HistoryRow({ h, Icon }) {
  const meta = HISTORY_TYPE_META[h.type] || HISTORY_TYPE_META.category;
  return React.createElement('div', { className: 'se-history-row', style: { display: 'flex', gap: 12, alignItems: 'flex-start' } },
    React.createElement('div', { style: { width: 36, height: 36, borderRadius: '50%', background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, React.createElement(Icon, { name: meta.icon, size: 16, color: meta.color })),
    React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 } },
      React.createElement('div', { style: { fontSize: 14.5, fontWeight: 600, color: 'var(--color-text)' } }, h.action),
      React.createElement('div', { style: { fontSize: 13, color: 'var(--color-text-muted)' } }, h.detail),
      React.createElement('div', { style: { fontSize: 12, color: 'var(--color-text-faint)' } }, h.actor + ' · ', React.createElement('span', { dir: 'ltr', style: { unicodeBidi: 'plaintext' } }, `${h.date}، ${h.time || ''}`))));
}
function HistoryScreen() {
  const { PageHeading, FilterBar, Input, DateField, Select, InfoCard, Icon } = window.SmartExpenseAIDesignSystem_44f3e6;
  const { history } = window.SEMockData;
  const [q, setQ] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const filtered = history.filter(h => {
    if (typeFilter) { const t = typeFilter === 'expense' ? (h.type === 'expense' || h.type === 'expense-delete') : h.type === typeFilter; if (!t) return false; }
    if (q && !(h.action + h.detail).includes(q)) return false;
    return true;
  });
  return React.createElement('div', { dir: 'rtl', className: 'se-history-page', style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement(PageHeading, { title: 'سجل النشاط', description: 'سجل تراكمي لجميع أحداث مساحة العمل المهمة، لا يمكن تعديله أو حذفه.' }),
    React.createElement('div', { className: 'se-history-filterbar' }, React.createElement(FilterBar, null,
      React.createElement('div', { className: 'se-history-filter-search' }, React.createElement(Input, { label: 'البحث', icon: 'search', value: q, onChange: e => setQ(e.target.value), placeholder: 'ابحث في السجل…' })),
      React.createElement('div', { className: 'se-history-filter-type' }, React.createElement(Select, { label: 'نوع الحدث', value: typeFilter, onChange: e => setTypeFilter(e.target.value), options: TYPE_FILTERS, placeholder: 'جميع الأحداث' })),
      React.createElement('div', { className: 'se-history-filter-date' }, React.createElement(DateField, { label: 'من', value: dateFrom, onChange: e => setDateFrom(e.target.value) })),
      React.createElement('div', { className: 'se-history-filter-date' }, React.createElement(DateField, { label: 'إلى', value: dateTo, onChange: e => setDateTo(e.target.value) })))),
    React.createElement('div', { className: 'se-history-desktop' },
      React.createElement(InfoCard, { padded: false },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
          filtered.map((h, i) => React.createElement('div', { key: h.id, style: { padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none' } },
            React.createElement(HistoryRow, { h, Icon })))))),
    React.createElement('div', { className: 'se-history-mobile', style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      filtered.map(h => React.createElement('div', { key: h.id, style: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', padding: '12px 14px' } },
        React.createElement(HistoryRow, { h, Icon })))));
}
window.HistoryScreen = HistoryScreen;
