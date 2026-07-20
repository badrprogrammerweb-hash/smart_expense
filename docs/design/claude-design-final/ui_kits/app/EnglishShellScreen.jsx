function EnglishShellScreen({ onBackToArabic }) {
  const { Sidebar, MobileNav, TopHeader, Toast } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [screen, setScreen] = React.useState('dashboard');
  const [formDialog, setFormDialog] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const notify = (title) => { setToast({ title }); setTimeout(() => setToast(null), 3200); };
  const nav = (key) => (key === 'income' || key === 'expenses' || key === 'dashboard') ? setScreen(key) : null;
  const header = React.createElement(TopHeader, { lang: 'en', onLangChange: (l) => { if (l === 'ar') onBackToArabic(); }, user: { name: 'Sara Al-Otaibi', role: 'Owner' }, workspace: { name: 'Al-Otaibi Family', type: 'Family' }, workspaces: [{ name: 'My Personal Space', type: 'Personal' }] });
  if (screen === 'income' || screen === 'expenses') {
    return React.createElement('div', { dir: 'ltr', style: { display: 'flex', minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-arabic)' } },
      React.createElement('div', { className: 'se-sidebar' }, React.createElement(Sidebar, { active: screen, onNavigate: nav, lang: 'en', dir: 'ltr', workspaceName: 'Al-Otaibi Family' })),
      React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } },
        header,
        React.createElement('div', { className: 'se-app-main', style: { flex: 1, padding: 24, overflowY: 'auto' } },
          React.createElement(window.RecordsScreen, { kind: screen === 'income' ? 'income' : 'expense', role: 'owner', lang: 'en', onAdd: () => screen === 'income' && setFormDialog(true), onDeleteRequest: () => {} }))),
      React.createElement('div', { className: 'se-mobile-nav' }, React.createElement(MobileNav, { active: screen, onNavigate: nav, lang: 'en', dir: 'ltr' })),
      React.createElement(window.RecordFormDialog, { open: formDialog, kind: 'income', role: 'owner', lang: 'en', onClose: () => setFormDialog(false), onSave: () => { notify('Income saved'); setFormDialog(false); } }),
      toast && React.createElement('div', { style: { position: 'fixed', top: 20, insetInlineStart: 20, zIndex: 300 } }, React.createElement(Toast, { tone: 'success', title: toast.title, onClose: () => setToast(null) })));
  }
  return React.createElement('div', { dir: 'ltr', style: { display: 'flex', minHeight: '100vh', background: 'var(--color-bg)', fontFamily: 'var(--font-arabic)' } },
    React.createElement('div', { className: 'se-sidebar' }, React.createElement(Sidebar, { active: 'dashboard', onNavigate: nav, lang: 'en', dir: 'ltr', workspaceName: 'Al-Otaibi Family' })),
    React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' } },
      header,
      React.createElement('div', { className: 'se-app-main', style: { flex: 1, padding: 24, overflowY: 'auto', minHeight: 0 } },
        React.createElement(window.DashboardScreen, { role: 'owner', lang: 'en', onNavigate: nav, onAddExpense: () => {}, onAddIncome: () => {}, onUploadReceipt: () => {} }))),
    React.createElement('div', { className: 'se-mobile-nav' }, React.createElement(MobileNav, { active: 'dashboard', onNavigate: nav, lang: 'en', dir: 'ltr' })));
}
window.EnglishShellScreen = EnglishShellScreen;
