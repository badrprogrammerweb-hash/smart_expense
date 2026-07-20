function WorkspaceMembersScreen({ role, onInvite }) {
  const { Button, Table, Badge, IconButton, DropdownMenu, ConfirmDialog } = window.SmartExpenseAIDesignSystem_44f3e6;
  const { members } = window.SEMockData;
  const canManage = role === 'owner' || role === 'admin';
  const [removeTarget, setRemoveTarget] = React.useState(null);
  const roleTone = { owner: 'primary', admin: 'info', member: 'neutral', viewer: 'neutral' };
  const memberActions = r => canManage && r.roleKey !== 'owner' ? React.createElement(DropdownMenu, { align: 'start', trigger: React.createElement(IconButton, { icon: 'more-vertical', label: 'خيارات' }),
    items: [{ label: 'تغيير الدور' }, { divider: true }, { label: 'إزالة من مساحة العمل', destructive: true, onClick: () => setRemoveTarget(r) }] }) : null;
  return React.createElement('div', { dir: 'rtl', style: { display: 'flex', flexDirection: 'column', gap: 16 } },
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
      React.createElement('span', { style: { fontSize: 'var(--text-section-heading-size)', fontWeight: 'var(--text-section-heading-weight)', color: 'var(--color-text)' } }, 'أعضاء مساحة العمل'),
      canManage && React.createElement(Button, { icon: 'user-plus', onClick: onInvite }, 'دعوة عضو')),
    React.createElement('div', { className: 'se-desktop-table' }, React.createElement(Table, { columns: [
      { key: 'name', label: 'الاسم' },
      { key: 'email', label: 'البريد الإلكتروني', render: r => React.createElement('span', { dir: 'ltr' }, r.email) },
      { key: 'role', label: 'الدور', render: r => React.createElement(Badge, { tone: roleTone[r.roleKey] }, r.role) },
      { key: 'actions', label: '', align: 'center', render: memberActions },
    ], rows: members })),
    React.createElement('div', { className: 'se-mobile-cards', style: { display: 'none', flexDirection: 'column', gap: 10 } },
      members.map(m => React.createElement('div', { key: m.id, style: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', boxSizing: 'border-box', padding: 14, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', background: 'var(--color-surface)', fontFamily: 'var(--font-arabic)' } },
        React.createElement('div', { style: { width: 38, height: 38, borderRadius: '50%', flexShrink: 0, background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 } }, m.name.trim()[0]),
        React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 } },
          React.createElement('span', { style: { fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, m.name),
          React.createElement('span', { dir: 'ltr', style: { fontSize: 12.5, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'start' } }, m.email),
          React.createElement(Badge, { tone: roleTone[m.roleKey] }, m.role)),
        memberActions(m)))),
    React.createElement(ConfirmDialog, { open: !!removeTarget, onClose: () => setRemoveTarget(null), onConfirm: () => setRemoveTarget(null),
      title: 'إزالة هذا العضو؟', description: removeTarget ? `سيفقد ${removeTarget.name} إمكانية الوصول إلى مساحة العمل فورًا.` : '', confirmLabel: 'إزالة' }));
}
window.WorkspaceMembersScreen = WorkspaceMembersScreen;
