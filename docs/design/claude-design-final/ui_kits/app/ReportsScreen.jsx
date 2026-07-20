function parseDMY(s) {
  if (!s) return null;
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts.map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}
function diffDays(a, b) {
  if (!a || !b) return 0;
  return Math.abs(Math.round((b - a) / 86400000)) + 1;
}
const MONTHS_AR_FULL = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
function formatRangeAr(start, end) {
  if (!start || !end) return '';
  const s = parseDMY(start), e = parseDMY(end);
  if (!s || !e) return '';
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const startStr = sameMonth ? `${s.getDate()}` : `${s.getDate()} ${MONTHS_AR_FULL[s.getMonth()]}`;
  const endStr = `${e.getDate()} ${MONTHS_AR_FULL[e.getMonth()]} ${e.getFullYear()}`;
  return `${startStr} – ${endStr}`;
}
function ReportsScreen({ errorMode, onNavigate }) {
  const { PageHeading, Tabs, InfoCard, SummaryCard, Chart, ErrorState, DateField, Button, Badge, IconButton, Icon } = window.SmartExpenseAIDesignSystem_44f3e6;
  const { categories, aiQueue, members } = window.SEMockData;
  const [period, setPeriod] = React.useState('current');
  const [customStart, setCustomStart] = React.useState('01/06/2026');
  const [customEnd, setCustomEnd] = React.useState('30/06/2026');
  const [appliedRange, setAppliedRange] = React.useState('01/06/2026|30/06/2026');
  const [aiSummary, setAiSummary] = React.useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = React.useState(false);
  const [membersOpen, setMembersOpen] = React.useState(false);
  if (errorMode) return React.createElement('div', { dir: 'rtl' },
    React.createElement(PageHeading, { title: 'التقارير' }),
    React.createElement(ErrorState, { description: 'تعذّر تحميل بيانات التقرير. تحقق من الاتصال وحاول مرة أخرى.' }));

  const dailyCurrent = [{ label: '08/07', value: 620 }, { label: '09/07', value: 410 }, { label: '10/07', value: 780 }, { label: '11/07', value: 340 }, { label: '12/07', value: 910 }, { label: '13/07', value: 560 }, { label: '14/07', value: 480 }];
  const dailyPrevious = [{ label: '01/06', value: 520 }, { label: '08/06', value: 640 }, { label: '15/06', value: 390 }, { label: '22/06', value: 710 }, { label: '29/06', value: 480 }];
  const monthlyTrend = [{ label: 'أبريل', value: 4200 }, { label: 'مايو', value: 3800 }, { label: 'يونيو', value: 5100 }, { label: 'يوليو', value: 5080 }];
  const [appliedStart, appliedEnd] = appliedRange.split('|');

  let trend, trendTitleMain, trendTitleSub;
  if (period === 'current') { trend = dailyCurrent; trendTitleMain = 'اتجاه الإنفاق اليومي'; trendTitleSub = 'الفترة الحالية'; }
  else if (period === 'previous') { trend = dailyPrevious; trendTitleMain = 'اتجاه الإنفاق اليومي'; trendTitleSub = 'الفترة السابقة'; }
  else {
    const days = diffDays(parseDMY(appliedStart), parseDMY(appliedEnd));
    const isDaily = days > 0 && days <= 31;
    trend = isDaily ? dailyPrevious : monthlyTrend;
    trendTitleMain = isDaily ? 'اتجاه الإنفاق اليومي' : 'اتجاه الإنفاق الشهري';
    trendTitleSub = 'فترة مخصصة';
  }
  const trendTitle = React.createElement('span', { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
    React.createElement('span', null, trendTitleMain),
    React.createElement('span', { style: { fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)' } }, trendTitleSub));

  const catData = categories.slice(0, 5).map((c, i) => ({ label: c.label, value: [1200, 600, 2000, 480, 220][i], color: c.color }));
  const catTotal = catData.reduce((s, d) => s + d.value, 0) || 1;
  const topExpenses = [{ n: 'بقالة العائلة', v: '580.00' }, { n: 'محطة وقود أرامكو', v: '420.00' }, { n: 'مطعم نجد', v: '310.00' }];
  const pendingCount = aiQueue.filter(a => a.status === 'ready' || a.status === 'failed').length;

  const applyCustomRange = () => setAppliedRange(`${customStart}|${customEnd}`);
  const generateAiSummary = () => {
    setAiSummaryLoading(true);
    setTimeout(() => { setAiSummary('أنفقت هذا الشهر أكثر من المعتاد على الفواتير والمواصلات، بينما انخفض إنفاقك على المطاعم مقارنة بالفترة السابقة. رصيدك المتبقي يغطي التزاماتك الحالية.'); setAiSummaryLoading(false); }, 900);
  };

  const membersTitle = React.createElement('button', { type: 'button', onClick: () => setMembersOpen(o => !o), className: 'se-focusable', style: { display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit', color: 'inherit' } },
    React.createElement(Icon, { name: membersOpen ? 'chevron-up' : 'chevron-down', size: 16 }),
    React.createElement('span', null, 'نشاط الأعضاء'));

  const membersList = membersOpen && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
    members.map(m => React.createElement('div', { key: m.id, style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 14 } },
      React.createElement('span', { style: { color: 'var(--color-text)' } }, m.name),
      React.createElement('span', { style: { fontSize: 12, color: 'var(--color-text-muted)' } }, m.role))));
  const membersCard = React.createElement(InfoCard, { title: membersTitle }, membersList);

  return React.createElement('div', { dir: 'rtl', className: 'se-reports-page', style: { display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 } },
    React.createElement(PageHeading, { title: 'التقارير', description: 'ملخص الدخل والمصاريف والرصيد المتبقي' }),
    React.createElement(Tabs, { tabs: [{ key: 'current', label: 'الفترة الحالية' }, { key: 'previous', label: 'الفترة السابقة' }, { key: 'custom', label: 'فترة مخصصة' }], value: period, onChange: setPeriod }),
    period === 'custom' && React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
      React.createElement('div', { className: 'se-reports-custom-fields', style: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' } },
        React.createElement('div', { style: { width: 190 } }, React.createElement(DateField, { label: 'من تاريخ', value: customStart, onChange: e => setCustomStart(e.target.value) })),
        React.createElement('div', { style: { width: 190 } }, React.createElement(DateField, { label: 'إلى تاريخ', value: customEnd, onChange: e => setCustomEnd(e.target.value) })),
        React.createElement(Button, { variant: 'secondary', onClick: applyCustomRange }, 'عرض التقرير')),
      formatRangeAr(appliedStart, appliedEnd) && React.createElement('span', { style: { fontSize: 13, color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)' } }, formatRangeAr(appliedStart, appliedEnd))),
    React.createElement('div', { className: 'se-reports-summary', style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 } },
      React.createElement(SummaryCard, { label: 'الدخل', amount: '8,500.00', kind: 'income', icon: 'trending-up' }),
      React.createElement(SummaryCard, { label: 'المصاريف', amount: '5,080.00', kind: 'expense', icon: 'trending-down' }),
      React.createElement(SummaryCard, { label: 'الرصيد المتبقي', amount: '3,420.00', icon: 'wallet' })),
    React.createElement('div', { className: 'se-reports-charts', style: { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 14 } },
      React.createElement(InfoCard, { title: trendTitle }, React.createElement(Chart, { type: 'bar', data: trend, height: 200 })),
      React.createElement(InfoCard, { title: 'التوزيع حسب الفئة' },
        React.createElement('div', { className: 'se-reports-donut-wrap', style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 } },
          React.createElement(Chart, { type: 'donut', data: catData, height: 140 }),
          React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%' } },
            catData.map((d, i) => React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text)' } },
              React.createElement('span', { style: { width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 } }),
              React.createElement('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, d.label),
              React.createElement('span', { dir: 'ltr', style: { color: 'var(--color-text-muted)', fontFeatureSettings: "'tnum' 1" } }, `${d.value.toLocaleString()} (${Math.round(d.value / catTotal * 100)}%)`))))))),
    React.createElement(InfoCard, { title: 'أكبر المصروفات' },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 10 } },
        topExpenses.map((m, i) =>
          React.createElement('div', { key: i, style: { display: 'flex', justifyContent: 'space-between', fontSize: 14 } },
            React.createElement('span', { style: { color: 'var(--color-text)' } }, m.n),
            React.createElement('span', { dir: 'ltr', style: { color: 'var(--color-text-muted)' } }, m.v + ' ر.س'))))),
    React.createElement(InfoCard, { title: 'الملخص الذكي للإنفاق' },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 12 } },
        aiSummary ? React.createElement('p', { style: { margin: 0, fontSize: 14, lineHeight: 1.8, color: 'var(--color-text)' } }, aiSummary)
          : React.createElement('p', { style: { margin: 0, fontSize: 13, color: 'var(--color-text-muted)' } }, 'احصل على ملخص ذكي لنمط إنفاقك خلال هذه الفترة.'),
        React.createElement(Button, { variant: 'secondary', icon: 'sparkles', onClick: generateAiSummary, loading: aiSummaryLoading }, aiSummary ? 'إعادة إنشاء الملخص' : 'إنشاء ملخص بالذكاء الاصطناعي'))),
    pendingCount > 0 && React.createElement(InfoCard, { title: 'عمليات بانتظار المراجعة' },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
          React.createElement(Badge, { tone: 'warning', dot: true }, `${pendingCount} عملية جاهزة للمراجعة`)),
        React.createElement(Button, { variant: 'secondary', onClick: () => onNavigate && onNavigate('ai-review') }, 'فتح قائمة المراجعة'))),
    React.createElement(InfoCard, { title: membersTitle }, membersList)
  );
}
window.ReportsScreen = ReportsScreen;
