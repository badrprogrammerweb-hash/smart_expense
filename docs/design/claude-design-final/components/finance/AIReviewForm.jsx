import React from 'react';
import { StatusBadge } from './StatusBadge.jsx';
import { AmountInput } from '../forms/AmountInput.jsx';
import { DateField } from '../forms/DateField.jsx';
import { Textarea } from '../forms/Textarea.jsx';
import { Button } from '../core/Button.jsx';
import { Alert } from '../core/Alert.jsx';
import { Badge } from '../core/Badge.jsx';
import { Icon } from '../core/Icon.jsx';
export function AIReviewForm({ status = 'ready', fields = {}, onFieldChange, categories = [], onCreateCategory, canManageCategories = false, receiptCurrency, workspaceCurrency, errorMessage, onConfirm, onDiscard, onRetry, loading, hideHeader, hideActions }) {
  const { CategoryPickerDialog } = (typeof window !== 'undefined' && window.SmartExpenseAIDesignSystem_44f3e6) || {};
  const [catOpen, setCatOpen] = React.useState(false);
  const locked = status === 'confirmed' || status === 'discarded';
  const set = (k) => (e) => onFieldChange && onFieldChange(k, e.target.value);
  const currencyMismatch = receiptCurrency && workspaceCurrency && receiptCurrency !== workspaceCurrency;
  const category = fields.category;
  const categoryLabel = category ? (category.isSub ? `${category.mainLabel} › ${category.label}` : category.label) : 'اختر الفئة الرئيسية أو الفرعية';
  return React.createElement(React.Fragment, null,
    React.createElement('div', { dir: 'rtl', style: { display: 'flex', flexDirection: 'column', gap: 14, fontFamily: 'var(--font-arabic)' } },
      !hideHeader && React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        React.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: 'var(--color-text)' } }, 'قيم مستخرجة — عدّلها قبل التأكيد'),
        React.createElement(StatusBadge, { status })),
      status === 'failed' && errorMessage && React.createElement(Alert, { tone: 'error', title: 'تعذّر الاستخراج' }, errorMessage),
      status === 'failed' && React.createElement(Button, { variant: 'secondary', onClick: onRetry }, 'إعادة محاولة الاستخراج'),
      status !== 'confirmed' && status !== 'discarded' && status !== 'failed' && React.createElement(Alert, { tone: 'warning' }, 'قيمة غير مؤكدة — راجعها قبل إضافتها كمصروف فعلي.'),
      currencyMismatch && React.createElement(Alert, { tone: 'warning', title: 'اختلاف العملة — Future state — Phase 12' }, `عملة الإيصال المستخرجة (${receiptCurrency}) تختلف عن عملة مساحة العمل الأساسية (${workspaceCurrency}). لن يتم تحويل المبلغ تلقائيًا — يرجى مراجعة القيمة وإدخالها بعملة مساحة العمل قبل التأكيد.`),
      React.createElement(AmountInput, { label: 'المبلغ', kind: status === 'confirmed' ? 'expense' : 'pending', value: fields.amount, onChange: set('amount'), disabled: locked }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          React.createElement('label', { style: { fontSize: 'var(--text-label-size)', fontWeight: 500, color: 'var(--color-text)' } }, 'الفئة الرئيسية أو الفرعية'),
          React.createElement(Badge, { tone: 'warning', dot: true }, 'Future state — Phase 13')),
        React.createElement('button', { type: 'button', disabled: locked, onClick: () => setCatOpen(true), className: 'se-focusable', style: { display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 44, boxSizing: 'border-box', padding: '0 12px', borderRadius: 'var(--radius-control)', border: '1px solid var(--color-border-strong)', background: locked ? 'var(--color-surface-sunken)' : 'var(--color-surface)', cursor: locked ? 'not-allowed' : 'pointer', textAlign: 'start' } },
          category && React.createElement(Icon, { name: category.icon, size: 16, color: 'var(--color-text-muted)' }),
          React.createElement('span', { style: { flex: 1, fontSize: 14, color: category ? 'var(--color-text)' : 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, categoryLabel),
          React.createElement(Icon, { name: 'chevron-down', size: 14, color: 'var(--color-text-muted)' }))),
      React.createElement(DateField, { label: 'التاريخ', required: true, value: fields.date, onChange: set('date'), disabled: locked }),
      React.createElement(Textarea, { label: 'ملاحظات', placeholder: 'اسم التاجر أو أي تفاصيل إضافية...', value: fields.notes, onChange: set('notes'), rows: 3, disabled: locked }),
      !hideActions && status !== 'confirmed' && status !== 'discarded' && React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 4 } },
        React.createElement(Button, { variant: 'secondary', onClick: onDiscard, disabled: locked }, 'تجاهل'),
        React.createElement(Button, { onClick: onConfirm, loading, disabled: status === 'failed' }, 'تأكيد'))),
    CategoryPickerDialog && React.createElement(CategoryPickerDialog, { open: catOpen, categories, selected: category, canManageCategories, onCreateCategory, onClose: () => setCatOpen(false), onSelect: (c) => { onFieldChange && onFieldChange('category', c); setCatOpen(false); } }));
}
