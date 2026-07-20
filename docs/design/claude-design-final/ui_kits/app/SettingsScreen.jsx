function SettingsScreen({ role, onInvite }) {
  const { PageHeading, Tabs, InfoCard, Input, Select, Button, Badge, Alert, ConfirmDialog, PermissionDeniedState } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [tab, setTab] = React.useState('general');
  const canManageAI = role === 'owner' || role === 'admin';
  const canManageCurrency = role === 'owner' || role === 'admin';
  const currencyOptions = [
    { value: 'SAR', label: 'ريال سعودي (ر.س) — الحالية' },
    { value: 'USD', label: 'دولار أمريكي ($) — تجريبي' },
    { value: 'AED', label: 'درهم إماراتي (د.إ) — تجريبي' },
    { value: 'EGP', label: 'جنيه مصري (ج.م) — تجريبي' },
  ];
  const [currency, setCurrency] = React.useState('SAR');
  const [pendingCurrency, setPendingCurrency] = React.useState(null);
  const workspaceHasRecords = true;
  const requestCurrencyChange = (value) => { if (value === currency) return; if (workspaceHasRecords) setPendingCurrency(value); else setCurrency(value); };
  const confirmCurrencyChange = () => { setCurrency(pendingCurrency); setPendingCurrency(null); };
  return React.createElement('div', { dir: 'rtl', style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement(PageHeading, { title: 'الإعدادات', description: 'إعدادات الحساب، مزوّد الاستخراج الذكي، وأعضاء مساحة العمل' }),
    React.createElement(Tabs, { tabs: [{ key: 'general', label: 'عام' }, { key: 'ai', label: 'الاستخراج الذكي' }, { key: 'members', label: 'الأعضاء' }], value: tab, onChange: setTab }),
    tab === 'members' && React.createElement(window.WorkspaceMembersScreen, { role, onInvite }),
    tab === 'general' && React.createElement('div', { className: 'se-settings-narrow', style: { display: 'flex', flexDirection: 'column', gap: 16 } },
      React.createElement(InfoCard, { title: 'الملف الشخصي' },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
          React.createElement(Input, { label: 'الاسم الكامل', value: 'سارة العتيبي' }),
          React.createElement(Input, { label: 'البريد الإلكتروني', dirOverride: 'ltr', value: 'sara@example.com', disabled: true, helper: 'لا يمكن تغيير البريد الإلكتروني حاليًا' }),
          React.createElement('div', { className: 'se-settings-save-wrap' }, React.createElement(Button, { style: { alignSelf: 'flex-start' } }, 'حفظ التغييرات')))),
      React.createElement(InfoCard, { title: 'عملة مساحة العمل', actions: React.createElement(Badge, { tone: 'warning', dot: true }, 'Future state — Phase 12') },
        canManageCurrency ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
          React.createElement(Alert, { tone: 'info', title: 'عملة أساسية واحدة لكل مساحة عمل' }, 'لكل مساحة عمل عملة أساسية واحدة فقط تُستخدم لجميع السجلات — لا يمكن اختيار عملة مختلفة لكل سجل، ولا يدعم النظام التحويل بين العملات أو المحاسبة بعملات متعددة.'),
          React.createElement(Select, { label: 'العملة الأساسية', value: currency, onChange: e => requestCurrencyChange(e.target.value), options: currencyOptions }),
          React.createElement('span', { className: 'se-settings-currency-helper', style: { fontSize: 12, color: 'var(--color-text-muted)' } }, 'هذا إعداد مستقبلي لمرحلة قادمة (Phase 12) لأغراض العرض فقط، وهو مستقل عن لغة الواجهة الشخصية.')) :
          React.createElement(PermissionDeniedState, { roleRequired: 'المالك أو المشرف', description: 'تغيير عملة مساحة العمل متاح فقط لمالك مساحة العمل أو المشرف.' })),
      React.createElement(ConfirmDialog, { open: !!pendingCurrency, onClose: () => setPendingCurrency(null), onConfirm: confirmCurrencyChange,
        title: 'تغيير العملة الأساسية؟ — Future state — Phase 12',
        description: `تحتوي مساحة العمل على سجلات مسجّلة بالعملة الحالية. تغيير العملة الأساسية لن يحوّل المبالغ الموجودة تلقائيًا؛ ستبقى القيم القديمة كما هي وقد لا تعكس العملة الجديدة بدقة.`,
        confirmLabel: 'تغيير العملة' })),
    tab === 'ai' && React.createElement('div', { className: 'se-settings-narrow' },
      canManageAI ? React.createElement(InfoCard, { title: 'مزوّد الاستخراج الذكي' },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
          React.createElement(Alert, { tone: 'info', title: 'مفاتيح API محمية' }, 'لن تُعرض قيمة المفتاح كاملة بعد الحفظ لأسباب أمنية.'),
          React.createElement(Select, { label: 'المزوّد', options: [{ value: 'openai', label: 'OpenAI' }, { value: 'gemini', label: 'Gemini' }] }),
          React.createElement(Input, { label: 'مفتاح API', dirOverride: 'ltr', value: 'sk-••••••••••••4f2a', disabled: true }),
          React.createElement('div', { className: 'se-settings-ai-actions', style: { display: 'flex', gap: 8 } }, React.createElement(Button, { variant: 'secondary' }, 'استبدال المفتاح'), React.createElement(Button, { variant: 'ghost' }, 'اختبار الاتصال')))) :
        React.createElement(InfoCard, null, React.createElement(PermissionDeniedState, { roleRequired: 'المالك أو المشرف', description: 'إعدادات مزوّد الاستخراج الذكي متاحة فقط لمالك مساحة العمل أو المشرف.' }))));
}
window.SettingsScreen = SettingsScreen;
