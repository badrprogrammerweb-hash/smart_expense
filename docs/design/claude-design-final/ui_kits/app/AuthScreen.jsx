function AuthScreen({ onSignIn }) {
  const { Input, Button, Icon } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [loading, setLoading] = React.useState(false);
  const submit = (e) => { e.preventDefault(); setLoading(true); setTimeout(() => { setLoading(false); onSignIn(); }, 700); };
  return React.createElement('div', { dir: 'rtl', style: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', fontFamily: 'var(--font-arabic)' } },
    React.createElement('form', { onSubmit: submit, style: { width: 380, maxWidth: '92vw', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)', padding: 32, display: 'flex', flexDirection: 'column', gap: 16 } },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 4 } },
        React.createElement('div', { style: { width: 44, height: 44, borderRadius: 10, background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, React.createElement(Icon, { name: 'wallet', size: 22, color: '#fff' })),
        React.createElement('div', { style: { fontSize: 18, fontWeight: 700, color: 'var(--color-text)' } }, 'Smart Expense'),
        React.createElement('div', { style: { fontSize: 13, color: 'var(--color-text-muted)' } }, 'تتبّع مصاريفك بذكاء وبساطة')),
      React.createElement(Input, { label: 'البريد الإلكتروني', type: 'email', dirOverride: 'ltr', placeholder: 'name@example.com', required: true }),
      React.createElement(Input, { label: 'كلمة المرور', type: 'password', required: true }),
      React.createElement(Button, { type: 'submit', fullWidth: true, loading: loading }, 'تسجيل الدخول'),
      React.createElement('div', { style: { textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' } }, 'ليس لديك حساب؟ ', React.createElement('a', { className: 'se-link', href: '#' }, 'إنشاء حساب جديد'))));
}
window.AuthScreen = AuthScreen;
