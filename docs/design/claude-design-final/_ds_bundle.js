/* @ds-bundle: {"format":4,"namespace":"SmartExpenseAIDesignSystem_44f3e6","components":[{"name":"Alert","sourcePath":"components/core/Alert.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Toast","sourcePath":"components/core/Toast.jsx"},{"name":"FilterBar","sourcePath":"components/data/FilterBar.jsx"},{"name":"MobileRecordCard","sourcePath":"components/data/MobileRecordCard.jsx"},{"name":"Pagination","sourcePath":"components/data/Pagination.jsx"},{"name":"SearchField","sourcePath":"components/data/SearchField.jsx"},{"name":"Table","sourcePath":"components/data/Table.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"ErrorState","sourcePath":"components/feedback/ErrorState.jsx"},{"name":"PermissionDeniedState","sourcePath":"components/feedback/PermissionDeniedState.jsx"},{"name":"Skeleton","sourcePath":"components/feedback/Skeleton.jsx"},{"name":"AIReviewForm","sourcePath":"components/finance/AIReviewForm.jsx"},{"name":"Chart","sourcePath":"components/finance/Chart.jsx"},{"name":"InfoCard","sourcePath":"components/finance/InfoCard.jsx"},{"name":"ReceiptPreview","sourcePath":"components/finance/ReceiptPreview.jsx"},{"name":"StatusBadge","sourcePath":"components/finance/StatusBadge.jsx"},{"name":"SummaryCard","sourcePath":"components/finance/SummaryCard.jsx"},{"name":"AmountInput","sourcePath":"components/forms/AmountInput.jsx"},{"name":"DateField","sourcePath":"components/forms/DateField.jsx"},{"name":"DateInput","sourcePath":"components/forms/DateInput.jsx"},{"name":"FileUpload","sourcePath":"components/forms/FileUpload.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"LanguageSwitcher","sourcePath":"components/navigation/LanguageSwitcher.jsx"},{"name":"MobileNav","sourcePath":"components/navigation/MobileNav.jsx"},{"name":"PageHeading","sourcePath":"components/navigation/PageHeading.jsx"},{"name":"Sidebar","sourcePath":"components/navigation/Sidebar.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"},{"name":"TopHeader","sourcePath":"components/navigation/TopHeader.jsx"},{"name":"WorkspaceSwitcher","sourcePath":"components/navigation/WorkspaceSwitcher.jsx"},{"name":"CategoryPickerDialog","sourcePath":"components/overlays/CategoryPickerDialog.jsx"},{"name":"ConfirmDialog","sourcePath":"components/overlays/ConfirmDialog.jsx"},{"name":"Dialog","sourcePath":"components/overlays/Dialog.jsx"},{"name":"DropdownMenu","sourcePath":"components/overlays/DropdownMenu.jsx"}],"sourceHashes":{"components/core/Alert.jsx":"5d4bd093dae5","components/core/Badge.jsx":"50711aabc57b","components/core/Button.jsx":"68548a34f532","components/core/Icon.jsx":"037f0ce118e9","components/core/IconButton.jsx":"68d443af93eb","components/core/Toast.jsx":"4e73bec083f8","components/data/FilterBar.jsx":"8c950f4bcbf8","components/data/MobileRecordCard.jsx":"0867038779f1","components/data/Pagination.jsx":"fb8ff31bd964","components/data/SearchField.jsx":"fef5187e6fc1","components/data/Table.jsx":"ac51dbf94e77","components/feedback/EmptyState.jsx":"bf72574d114e","components/feedback/ErrorState.jsx":"b91995ec6ed7","components/feedback/PermissionDeniedState.jsx":"23195a284ebb","components/feedback/Skeleton.jsx":"5321028192b3","components/finance/AIReviewForm.jsx":"23875dcf2d27","components/finance/Chart.jsx":"7cffbb5b5d8c","components/finance/InfoCard.jsx":"2aefdad3aabc","components/finance/ReceiptPreview.jsx":"a334515f3ca0","components/finance/StatusBadge.jsx":"0d08e648ec0a","components/finance/SummaryCard.jsx":"b4b2809aee3c","components/forms/AmountInput.jsx":"9edb8d95ce5f","components/forms/DateField.jsx":"42ade0c3359d","components/forms/DateInput.jsx":"7edbcd5a7e55","components/forms/FileUpload.jsx":"845384c9c3fd","components/forms/Input.jsx":"ce8b98a1adfe","components/forms/Select.jsx":"079186607d8f","components/forms/Textarea.jsx":"7a8e812166a0","components/navigation/LanguageSwitcher.jsx":"44525ca407bc","components/navigation/MobileNav.jsx":"4722ebfc51e9","components/navigation/PageHeading.jsx":"11486378d7e6","components/navigation/Sidebar.jsx":"b9ea27168a43","components/navigation/Tabs.jsx":"9b4394e8e6f6","components/navigation/TopHeader.jsx":"f911ead1ec68","components/navigation/WorkspaceSwitcher.jsx":"0d708400ccc8","components/overlays/CategoryPickerDialog.jsx":"260c525a45a9","components/overlays/ConfirmDialog.jsx":"209d8ec5cc85","components/overlays/Dialog.jsx":"10a0ace57316","components/overlays/DropdownMenu.jsx":"548995476f67","ui_kits/app/AIReviewScreen.jsx":"922ecdcc5887","ui_kits/app/AuthScreen.jsx":"c78dcc7ac0f4","ui_kits/app/CategoriesScreen.jsx":"aab9a764c141","ui_kits/app/CategoryFormDialog.jsx":"8a3276f979da","ui_kits/app/DashboardScreen.jsx":"66f22f94bfe7","ui_kits/app/EnglishShellScreen.jsx":"61496612341b","ui_kits/app/FilesScreen.jsx":"9221a564f14f","ui_kits/app/HistoryScreen.jsx":"0d705533512a","ui_kits/app/RecordFormDialog.jsx":"43c1eee0da43","ui_kits/app/RecordsScreen.jsx":"174b1895b1fe","ui_kits/app/ReportsScreen.jsx":"bb139544bb4c","ui_kits/app/SettingsScreen.jsx":"ab3e35624227","ui_kits/app/WorkspaceMembersScreen.jsx":"4d229b4e3d37","ui_kits/app/mock-data.js":"1efa15b5d613"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.SmartExpenseAIDesignSystem_44f3e6 = window.SmartExpenseAIDesignSystem_44f3e6 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
const tones = {
  neutral: {
    bg: 'var(--color-surface-sunken)',
    color: 'var(--color-text-muted)',
    border: 'var(--color-border)'
  },
  primary: {
    bg: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)',
    border: 'var(--color-primary-border)'
  },
  income: {
    bg: 'var(--color-income-subtle)',
    color: 'var(--color-income)',
    border: 'var(--color-income-border)'
  },
  expense: {
    bg: 'var(--color-expense-subtle)',
    color: 'var(--color-expense)',
    border: 'var(--color-expense-border)'
  },
  warning: {
    bg: 'var(--color-warning-subtle)',
    color: '#92620A',
    border: 'var(--color-warning-border)'
  },
  info: {
    bg: 'var(--color-info-subtle)',
    color: 'var(--color-info)',
    border: 'var(--color-info-border)'
  }
};
function Badge({
  children,
  tone = 'neutral',
  dot = false
}) {
  const t = tones[tone] || tones.neutral;
  return React.createElement('span', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 'var(--radius-pill)',
      background: t.bg,
      color: t.color,
      border: `1px solid ${t.border}`,
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      whiteSpace: 'nowrap'
    }
  }, dot && React.createElement('span', {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: t.color
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function toPascal(name) {
  return name.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}
function nodeToSvg(node, size, color, strokeWidth) {
  const inner = node.map(([tag, attrs]) => {
    const attrStr = Object.entries(attrs || {}).map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${attrStr}></${tag}>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
function Icon({
  name,
  size = 20,
  strokeWidth = 1.75,
  color = 'currentColor',
  style,
  ...rest
}) {
  const pascal = toPascal(name || '');
  const node = typeof window !== 'undefined' && window.lucide && window.lucide.icons ? window.lucide.icons[pascal] : null;
  const svg = node ? nodeToSvg(node, size, color, strokeWidth) : null;
  if (svg) return React.createElement('span', {
    style: {
      display: 'inline-flex',
      lineHeight: 0,
      ...style
    },
    dangerouslySetInnerHTML: {
      __html: svg
    },
    ...rest
  });
  return React.createElement('span', {
    style: {
      display: 'inline-block',
      width: size,
      height: size,
      borderRadius: 4,
      background: 'var(--color-border)',
      ...style
    },
    ...rest
  });
}
Object.assign(__ds_scope, { Icon });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/Alert.jsx
try { (() => {
const tones = {
  info: {
    bg: 'var(--color-info-subtle)',
    border: 'var(--color-info-border)',
    color: 'var(--color-info)',
    icon: 'info'
  },
  success: {
    bg: 'var(--color-income-subtle)',
    border: 'var(--color-income-border)',
    color: 'var(--color-income)',
    icon: 'check-circle-2'
  },
  warning: {
    bg: 'var(--color-warning-subtle)',
    border: 'var(--color-warning-border)',
    color: '#92620A',
    icon: 'triangle-alert'
  },
  error: {
    bg: 'var(--color-expense-subtle)',
    border: 'var(--color-expense-border)',
    color: 'var(--color-expense)',
    icon: 'circle-x'
  }
};
function Alert({
  tone = 'info',
  title,
  children,
  onDismiss
}) {
  const t = tones[tone] || tones.info;
  return React.createElement('div', {
    role: 'alert',
    style: {
      display: 'flex',
      gap: 12,
      padding: '14px 16px',
      borderRadius: 'var(--radius-card)',
      background: t.bg,
      border: `1px solid ${t.border}`,
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: t.icon,
    size: 20,
    color: t.color,
    style: {
      flexShrink: 0,
      marginTop: 2
    }
  }), React.createElement('div', {
    style: {
      flex: 1
    }
  }, title && React.createElement('div', {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: t.color,
      marginBottom: children ? 4 : 0
    }
  }, title), children && React.createElement('div', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)',
      lineHeight: 'var(--line-height-normal)'
    }
  }, children)), onDismiss && React.createElement('button', {
    onClick: onDismiss,
    'aria-label': 'إغلاق',
    className: 'se-focusable',
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--color-text-muted)',
      padding: 4
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'x',
    size: 16
  })));
}
Object.assign(__ds_scope, { Alert });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Alert.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
const sizes = {
  sm: {
    h: 32,
    pad: '0 12px',
    font: 13
  },
  md: {
    h: 40,
    pad: '0 16px',
    font: 14
  },
  lg: {
    h: 48,
    pad: '0 20px',
    font: 15
  }
};
const variants = {
  primary: {
    bg: 'var(--color-primary)',
    color: '#fff',
    border: '1px solid var(--color-primary)'
  },
  secondary: {
    bg: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border-strong)'
  },
  ghost: {
    bg: 'transparent',
    color: 'var(--color-text)',
    border: '1px solid transparent'
  },
  destructive: {
    bg: 'var(--color-expense)',
    color: '#fff',
    border: '1px solid var(--color-expense)'
  }
};
function Button({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'start',
  loading = false,
  disabled = false,
  fullWidth = false,
  onClick,
  type = 'button',
  style: styleOverride,
  ...rest
}) {
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.md;
  const isDisabled = disabled || loading;
  const style = {
    height: s.h,
    padding: s.pad,
    fontSize: s.font,
    background: v.bg,
    color: v.color,
    border: v.border,
    borderRadius: 'var(--radius-control)',
    fontFamily: 'var(--font-arabic)',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled && !loading ? 0.5 : 1,
    width: fullWidth ? '100%' : undefined,
    whiteSpace: 'nowrap',
    ...styleOverride
  };
  return React.createElement('button', {
    type,
    className: 'se-btn se-focusable',
    style,
    disabled: isDisabled,
    onClick,
    ...rest
  }, loading && React.createElement('span', {
    style: {
      width: 14,
      height: 14,
      borderRadius: '50%',
      border: '2px solid currentColor',
      borderInlineEndColor: 'transparent',
      animation: 'se-spin .7s linear infinite'
    }
  }), !loading && icon && iconPosition === 'start' && React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }), children, !loading && icon && iconPosition === 'end' && React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  }));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
const sizeMap = {
  sm: 32,
  md: 40,
  lg: 44
};
function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  active = false,
  disabled = false,
  onClick,
  ...rest
}) {
  const dim = sizeMap[size] || 40;
  const bg = active ? 'var(--color-primary-subtle)' : variant === 'filled' ? 'var(--color-surface)' : 'transparent';
  const color = active ? 'var(--color-primary)' : 'var(--color-text-muted)';
  const border = variant === 'filled' ? '1px solid var(--color-border-strong)' : '1px solid transparent';
  return React.createElement('button', {
    type: 'button',
    'aria-label': label,
    title: label,
    disabled,
    onClick,
    className: 'se-btn se-focusable se-row-hover',
    style: {
      width: dim,
      height: dim,
      borderRadius: 'var(--radius-control)',
      background: bg,
      color,
      border,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1
    },
    ...rest
  }, React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18
  }));
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Toast.jsx
try { (() => {
const tones = {
  info: {
    color: 'var(--color-info)',
    icon: 'info'
  },
  success: {
    color: 'var(--color-income)',
    icon: 'check-circle-2'
  },
  warning: {
    color: '#92620A',
    icon: 'triangle-alert'
  },
  error: {
    color: 'var(--color-expense)',
    icon: 'circle-x'
  }
};
function Toast({
  tone = 'info',
  title,
  description,
  onClose
}) {
  const t = tones[tone] || tones.info;
  return React.createElement('div', {
    role: 'status',
    style: {
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
      width: 340,
      padding: '14px 16px',
      borderRadius: 'var(--radius-card)',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      boxShadow: 'var(--shadow-dialog)',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: t.icon,
    size: 18,
    color: t.color,
    style: {
      marginTop: 2,
      flexShrink: 0
    }
  }), React.createElement('div', {
    style: {
      flex: 1
    }
  }, React.createElement('div', {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--color-text)'
    }
  }, title), description && React.createElement('div', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)',
      marginTop: 2
    }
  }, description)), onClose && React.createElement('button', {
    onClick: onClose,
    'aria-label': 'إغلاق',
    className: 'se-focusable',
    style: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: 'var(--color-text-faint)'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'x',
    size: 14
  })));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Toast.jsx", error: String((e && e.message) || e) }); }

// components/data/FilterBar.jsx
try { (() => {
function FilterBar({
  children,
  dir = 'rtl'
}) {
  return React.createElement('div', {
    dir,
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center',
      padding: 12,
      borderRadius: 'var(--radius-card)',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)'
    }
  }, children);
}
Object.assign(__ds_scope, { FilterBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/FilterBar.jsx", error: String((e && e.message) || e) }); }

// components/data/MobileRecordCard.jsx
try { (() => {
function MobileRecordCard({
  icon = 'shopping-cart',
  title,
  category,
  date,
  amount,
  kind = 'expense',
  status,
  onClick,
  currency = 'ر.س',
  actions,
  cornerAction
}) {
  const amountColor = kind === 'income' ? 'var(--color-income)' : 'var(--color-expense)';
  return React.createElement('div', {
    onClick,
    role: onClick ? 'button' : undefined,
    tabIndex: onClick ? 0 : undefined,
    className: `se-focusable ${onClick ? 'se-row-hover' : ''}`.trim(),
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      boxSizing: 'border-box',
      padding: '14px',
      borderRadius: 'var(--radius-card)',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      fontFamily: 'var(--font-arabic)',
      textAlign: 'start',
      cursor: onClick ? 'pointer' : 'default'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 44
    }
  }, React.createElement('div', {
    className: 'se-mrc-icon',
    style: {
      borderRadius: '50%',
      background: kind === 'income' ? 'var(--color-income-subtle)' : 'var(--color-expense-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 18,
    color: amountColor
  })), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8
    }
  }, React.createElement('span', {
    className: 'se-mrc-title',
    style: {
      fontWeight: 600,
      color: 'var(--color-text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0
    }
  }, title), React.createElement('span', {
    className: 'se-mrc-amount',
    dir: 'ltr',
    style: {
      fontWeight: 700,
      color: amountColor,
      flexShrink: 0,
      fontFeatureSettings: "'tnum' 1"
    }
  }, `${kind === 'income' ? '+' : '-'}${amount} ${currency}`)), React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0
    }
  }, React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 12.5,
      color: 'var(--color-text-muted)'
    }
  }, React.createElement('span', {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, category), category && date && React.createElement('span', null, '•'), React.createElement('span', {
    dir: 'ltr',
    style: {
      flexShrink: 0
    }
  }, date), status && React.createElement(__ds_scope.Badge, {
    tone: 'warning'
  }, status)), cornerAction && React.createElement('div', {
    style: {
      flexShrink: 0
    }
  }, cornerAction)))), actions && React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 8,
      marginTop: 10,
      paddingTop: 10,
      borderTop: '1px solid var(--color-border)'
    }
  }, actions));
}
Object.assign(__ds_scope, { MobileRecordCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/MobileRecordCard.jsx", error: String((e && e.message) || e) }); }

// components/data/Pagination.jsx
try { (() => {
function Pagination({
  page = 1,
  totalPages = 1,
  onChange,
  dir = 'rtl',
  label
}) {
  const go = p => p >= 1 && p <= totalPages && onChange && onChange(p);
  const text = label || (dir === 'rtl' ? `صفحة ${page} من ${totalPages}` : `Page ${page} of ${totalPages}`);
  const prevIcon = dir === 'rtl' ? 'chevron-right' : 'chevron-left';
  const nextIcon = dir === 'rtl' ? 'chevron-left' : 'chevron-right';
  return React.createElement('div', {
    dir,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontFamily: 'var(--font-arabic)',
      fontSize: 13,
      color: 'var(--color-text-muted)'
    }
  }, React.createElement('span', {
    dir: dir === 'rtl' ? 'rtl' : 'ltr'
  }, text), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 4
    }
  }, React.createElement('button', {
    onClick: () => go(page - 1),
    disabled: page <= 1,
    className: 'se-focusable se-row-hover',
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: 'var(--color-surface)',
      cursor: page <= 1 ? 'not-allowed' : 'pointer',
      opacity: page <= 1 ? 0.4 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: prevIcon,
    size: 16
  })), React.createElement('button', {
    onClick: () => go(page + 1),
    disabled: page >= totalPages,
    className: 'se-focusable se-row-hover',
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: 'var(--color-surface)',
      cursor: page >= totalPages ? 'not-allowed' : 'pointer',
      opacity: page >= totalPages ? 0.4 : 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: nextIcon,
    size: 16
  }))));
}
Object.assign(__ds_scope, { Pagination });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Pagination.jsx", error: String((e && e.message) || e) }); }

// components/data/SearchField.jsx
try { (() => {
function SearchField({
  value,
  onChange,
  placeholder = 'بحث…'
}) {
  return React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      minWidth: 220
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'search',
    size: 16,
    color: 'var(--color-text-muted)',
    style: {
      position: 'absolute',
      insetInlineStart: 12
    }
  }), React.createElement('input', {
    value,
    onChange,
    placeholder,
    className: 'se-focusable',
    style: {
      width: '100%',
      height: 40,
      boxSizing: 'border-box',
      padding: '0 40px 0 12px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: 'var(--color-surface)',
      fontSize: 14,
      fontFamily: 'var(--font-arabic)',
      color: 'var(--color-text)'
    }
  }));
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/data/Table.jsx
try { (() => {
function Table({
  columns = [],
  rows = [],
  rowKey = 'id',
  onRowClick,
  dir = 'rtl',
  emptyLabel = 'لا توجد بيانات لعرضها'
}) {
  return React.createElement('div', {
    dir,
    style: {
      width: '100%',
      overflowX: 'auto',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      background: 'var(--color-surface)',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('table', {
    style: {
      width: '100%',
      tableLayout: columns.some(c => c.width) ? 'fixed' : 'auto',
      borderCollapse: 'collapse',
      fontSize: 'var(--text-table-size)'
    }
  }, React.createElement('thead', null, React.createElement('tr', null, columns.map(c => React.createElement('th', {
    key: c.key,
    className: c.className,
    style: {
      textAlign: c.align || 'start',
      padding: '12px 16px',
      color: 'var(--color-text-muted)',
      fontWeight: 600,
      fontSize: 12,
      borderBottom: '1px solid var(--color-border)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      ...(c.width ? {
        width: c.width
      } : {})
    }
  }, c.label)))), React.createElement('tbody', null, rows.map(row => React.createElement('tr', {
    key: row[rowKey],
    onClick: () => onRowClick && onRowClick(row),
    className: 'se-row-hover',
    style: {
      cursor: onRowClick ? 'pointer' : 'default',
      borderBottom: '1px solid var(--color-border)'
    }
  }, columns.map(c => React.createElement('td', {
    key: c.key,
    className: c.className,
    style: {
      padding: '12px 16px',
      textAlign: c.align || 'start',
      color: 'var(--color-text)',
      overflow: 'hidden',
      whiteSpace: c.width ? 'normal' : 'nowrap',
      textOverflow: c.width ? undefined : 'ellipsis',
      ...(c.width ? {
        width: c.width,
        maxWidth: c.width
      } : {})
    }
  }, c.render ? c.render(row) : React.createElement('span', {
    style: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      display: 'block'
    }
  }, row[c.key])))))), rows.length === 0 && React.createElement('tfoot', null, React.createElement('tr', null, React.createElement('td', {
    colSpan: columns.length,
    style: {
      padding: 24,
      textAlign: 'center',
      color: 'var(--color-text-muted)',
      fontSize: 13
    }
  }, emptyLabel)))));
}
Object.assign(__ds_scope, { Table });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Table.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  icon = 'inbox',
  title,
  description,
  actionLabel,
  onAction,
  dir = 'rtl'
}) {
  return React.createElement('div', {
    dir,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 10,
      padding: '48px 24px',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 26,
    color: 'var(--color-text-muted)'
  })), React.createElement('div', {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--color-text)'
    }
  }, title), description && React.createElement('div', {
    style: {
      fontSize: 14,
      color: 'var(--color-text-muted)',
      maxWidth: 360
    }
  }, description), actionLabel && React.createElement(__ds_scope.Button, {
    onClick: onAction,
    icon: 'plus'
  }, actionLabel));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ErrorState.jsx
try { (() => {
function ErrorState({
  title = 'حدث خطأ غير متوقع',
  description = 'تعذّر تحميل البيانات. حاول مرة أخرى.',
  onRetry
}) {
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 10,
      padding: '48px 24px',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--color-expense-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'circle-alert',
    size: 26,
    color: 'var(--color-expense)'
  })), React.createElement('div', {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--color-text)'
    }
  }, title), React.createElement('div', {
    style: {
      fontSize: 14,
      color: 'var(--color-text-muted)',
      maxWidth: 360
    }
  }, description), onRetry && React.createElement(__ds_scope.Button, {
    variant: 'secondary',
    icon: 'refresh-cw',
    onClick: onRetry
  }, 'إعادة المحاولة'));
}
Object.assign(__ds_scope, { ErrorState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ErrorState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/PermissionDeniedState.jsx
try { (() => {
function PermissionDeniedState({
  title = 'هذا الإجراء غير متاح لدورك',
  description,
  roleRequired
}) {
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 10,
      padding: '48px 24px',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'lock',
    size: 24,
    color: 'var(--color-text-muted)'
  })), React.createElement('div', {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--color-text)'
    }
  }, title), React.createElement('div', {
    style: {
      fontSize: 14,
      color: 'var(--color-text-muted)',
      maxWidth: 380
    }
  }, description || (roleRequired ? `هذا الإجراء متاح فقط لـ ${roleRequired}.` : 'راجع مالك مساحة العمل لطلب الصلاحية.')));
}
Object.assign(__ds_scope, { PermissionDeniedState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/PermissionDeniedState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Skeleton.jsx
try { (() => {
const shimmer = {
  background: 'linear-gradient(90deg, var(--color-surface-sunken) 25%, var(--color-border) 37%, var(--color-surface-sunken) 63%)',
  backgroundSize: '400% 100%',
  animation: 'se-shimmer 1.6s ease infinite'
};
function Skeleton({
  variant = 'text',
  width,
  height,
  count = 1
}) {
  const h = height || (variant === 'row' ? 56 : variant === 'card' ? 120 : 14);
  const items = Array.from({
    length: count
  });
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, items.map((_, i) => React.createElement('div', {
    key: i,
    style: {
      ...shimmer,
      width: width || '100%',
      height: h,
      borderRadius: variant === 'card' ? 'var(--radius-card)' : 6
    }
  })));
}
Object.assign(__ds_scope, { Skeleton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Skeleton.jsx", error: String((e && e.message) || e) }); }

// components/finance/Chart.jsx
try { (() => {
function Chart({
  type = 'bar',
  data = [],
  height = 220,
  valueKey = 'value',
  labelKey = 'label',
  color = 'var(--color-primary)'
}) {
  const max = Math.max(1, ...data.map(d => d[valueKey]));
  if (type === 'donut') {
    let acc = 0;
    const total = data.reduce((s, d) => s + d[valueKey], 0) || 1;
    const stops = data.map(d => {
      const start = acc / total * 360;
      acc += d[valueKey];
      const end = acc / total * 360;
      return `${d.color || color} ${start}deg ${end}deg`;
    });
    return React.createElement('div', {
      dir: 'rtl',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        fontFamily: 'var(--font-arabic)'
      }
    }, React.createElement('div', {
      style: {
        width: height,
        height,
        borderRadius: '50%',
        background: `conic-gradient(${stops.join(',')})`,
        flexShrink: 0,
        position: 'relative'
      }
    }, React.createElement('div', {
      style: {
        position: 'absolute',
        inset: '18%',
        borderRadius: '50%',
        background: 'var(--color-surface)'
      }
    })), React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8
      }
    }, data.map((d, i) => React.createElement('div', {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        color: 'var(--color-text)'
      }
    }, React.createElement('span', {
      style: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: d.color || color
      }
    }), React.createElement('span', null, d[labelKey]), React.createElement('span', {
      dir: 'ltr',
      style: {
        color: 'var(--color-text-muted)',
        fontFeatureSettings: "'tnum' 1"
      }
    }, d[valueKey])))));
  }
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 12,
      height,
      fontFamily: 'var(--font-arabic)'
    }
  }, data.map((d, i) => React.createElement('div', {
    key: i,
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      flex: 1
    }
  }, React.createElement('span', {
    dir: 'ltr',
    style: {
      fontSize: 11,
      color: 'var(--color-text-muted)',
      fontFeatureSettings: "'tnum' 1"
    }
  }, d[valueKey]), React.createElement('div', {
    title: `${d[labelKey]}: ${d[valueKey]}`,
    style: {
      width: '100%',
      maxWidth: 36,
      height: Math.max(4, d[valueKey] / max * (height - 60)),
      background: d.color || color,
      borderRadius: '4px 4px 0 0'
    }
  }), React.createElement('span', {
    style: {
      fontSize: 11,
      color: 'var(--color-text-muted)'
    }
  }, d[labelKey]))));
}
Object.assign(__ds_scope, { Chart });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/Chart.jsx", error: String((e && e.message) || e) }); }

// components/finance/InfoCard.jsx
try { (() => {
function InfoCard({
  title,
  actions,
  children,
  padded = true,
  dir = 'rtl'
}) {
  return React.createElement('div', {
    dir,
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      fontFamily: 'var(--font-arabic)'
    }
  }, (title || actions) && React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      borderBottom: '1px solid var(--color-border)'
    }
  }, React.createElement('span', {
    style: {
      fontSize: 'var(--text-section-heading-size)',
      fontWeight: 'var(--text-section-heading-weight)',
      color: 'var(--color-text)'
    }
  }, title), actions), React.createElement('div', {
    style: {
      padding: padded ? 20 : 0
    }
  }, children));
}
Object.assign(__ds_scope, { InfoCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/InfoCard.jsx", error: String((e && e.message) || e) }); }

// components/finance/ReceiptPreview.jsx
try { (() => {
function ReceiptPreview({
  src,
  fileName,
  onZoom
}) {
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      background: 'var(--color-surface-sunken)',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      position: 'relative',
      height: 260,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#EEF2F6'
    },
    onClick: onZoom
  }, src ? React.createElement('img', {
    src,
    alt: fileName || 'إيصال',
    style: {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain'
    }
  }) : React.createElement(__ds_scope.Icon, {
    name: 'file-image',
    size: 40,
    color: 'var(--color-text-faint)'
  }), React.createElement('button', {
    'aria-label': 'تكبير',
    className: 'se-focusable',
    style: {
      position: 'absolute',
      top: 10,
      insetInlineEnd: 10,
      width: 32,
      height: 32,
      borderRadius: 8,
      border: 'none',
      background: 'rgba(255,255,255,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'zoom-in',
    size: 16
  }))), fileName && React.createElement('div', {
    dir: 'ltr',
    style: {
      padding: '10px 14px',
      fontSize: 12,
      color: 'var(--color-text-muted)',
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, fileName));
}
Object.assign(__ds_scope, { ReceiptPreview });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/ReceiptPreview.jsx", error: String((e && e.message) || e) }); }

// components/finance/StatusBadge.jsx
try { (() => {
const map = {
  not_started: {
    tone: 'neutral',
    label: 'لم يبدأ'
  },
  processing: {
    tone: 'info',
    label: 'قيد المعالجة'
  },
  ready: {
    tone: 'warning',
    label: 'جاهز للمراجعة'
  },
  confirmed: {
    tone: 'income',
    label: 'مؤكَّد'
  },
  failed: {
    tone: 'expense',
    label: 'فشل'
  },
  discarded: {
    tone: 'neutral',
    label: 'تم التجاهل'
  }
};
const mapEn = {
  ready: 'Ready for review',
  failed: 'Failed'
};
function StatusBadge({
  status,
  lang = 'ar'
}) {
  const m = map[status] || map.not_started;
  const label = lang === 'en' && mapEn[status] ? mapEn[status] : m.label;
  return React.createElement(__ds_scope.Badge, {
    tone: m.tone,
    dot: true
  }, label);
}
Object.assign(__ds_scope, { StatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/StatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/finance/SummaryCard.jsx
try { (() => {
function SummaryCard({
  label,
  amount,
  kind = 'neutral',
  icon,
  trend,
  emphasis = false,
  dir = 'rtl',
  currency = 'ر.س'
}) {
  const color = kind === 'income' ? 'var(--color-income)' : kind === 'expense' ? 'var(--color-expense)' : 'var(--color-text)';
  return React.createElement('div', {
    dir,
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      padding: emphasis ? 24 : 18,
      fontFamily: 'var(--font-arabic)',
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, React.createElement('span', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)',
      fontWeight: 500
    }
  }, label), icon && React.createElement('div', {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: kind === 'income' ? 'var(--color-income-subtle)' : kind === 'expense' ? 'var(--color-expense-subtle)' : 'var(--color-primary-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16,
    color
  }))), React.createElement('div', {
    dir: 'ltr',
    style: {
      fontSize: emphasis ? 'var(--text-financial-lg-size)' : 'var(--text-financial-md-size)',
      fontWeight: 'var(--text-financial-weight)',
      color,
      fontFeatureSettings: "'tnum' 1",
      textAlign: 'end'
    }
  }, amount, React.createElement('span', {
    style: {
      fontSize: 14,
      fontWeight: 500,
      marginInlineStart: 6,
      color: 'var(--color-text-muted)'
    }
  }, currency)), trend && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)'
    }
  }, trend));
}
Object.assign(__ds_scope, { SummaryCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/SummaryCard.jsx", error: String((e && e.message) || e) }); }

// components/forms/AmountInput.jsx
try { (() => {
const {
  useId
} = React;
function AmountInput({
  label = 'المبلغ',
  required,
  value,
  onChange,
  kind = 'expense',
  currency = 'ر.س',
  error,
  disabled
}) {
  const id = useId();
  const color = kind === 'income' ? 'var(--color-income)' : kind === 'expense' ? 'var(--color-expense)' : kind === 'pending' ? '#92620A' : 'var(--color-text)';
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('label', {
    htmlFor: id,
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)'
    }
  }, label, required && React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('div', {
    dir: 'ltr',
    style: {
      display: 'flex',
      alignItems: 'center',
      height: 52,
      border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`,
      borderRadius: 'var(--radius-control)',
      background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)',
      overflow: 'hidden'
    }
  }, React.createElement('input', {
    id,
    type: 'number',
    inputMode: 'decimal',
    step: '0.01',
    value,
    onChange,
    disabled,
    className: 'se-focusable',
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      height: '100%',
      padding: '0 16px',
      fontSize: 24,
      fontWeight: 600,
      color,
      textAlign: 'end',
      fontFeatureSettings: "'tnum' 1",
      background: 'transparent',
      fontFamily: 'var(--font-numeric)'
    }
  }), React.createElement('span', {
    style: {
      padding: '0 14px',
      fontSize: 14,
      color: 'var(--color-text-muted)',
      borderInlineStart: '1px solid var(--color-border)',
      height: '100%',
      display: 'flex',
      alignItems: 'center'
    }
  }, currency)), error && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-expense)'
    }
  }, error));
}
Object.assign(__ds_scope, { AmountInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/AmountInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/DateField.jsx
try { (() => {
const {
  useState,
  useRef,
  useEffect,
  useLayoutEffect
} = React;
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const WEEKDAYS_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function parse(d) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d || '');
  return m ? {
    day: +m[1],
    month: +m[2] - 1,
    year: +m[3]
  } : null;
}
function format(y, m, d) {
  return `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
}
function DateField({
  label,
  value,
  onChange,
  required,
  error,
  disabled,
  lang = 'ar'
}) {
  const isEn = lang === 'en';
  const dir = isEn ? 'ltr' : 'rtl';
  const MONTHS = isEn ? MONTHS_EN : MONTHS_AR;
  const WEEKDAYS = isEn ? WEEKDAYS_EN : WEEKDAYS_AR;
  const fieldLabel = label === undefined ? isEn ? 'Date' : 'التاريخ' : label;
  const placeholder = isEn ? 'Select date' : 'اختر التاريخ';
  const prevLabel = isEn ? 'Previous month' : 'الشهر السابق';
  const nextLabel = isEn ? 'Next month' : 'الشهر التالي';
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const now = new Date();
  const parsed = parse(value);
  const [viewYear, setViewYear] = useState((parsed || {
    year: now.getFullYear()
  }).year);
  const [viewMonth, setViewMonth] = useState((parsed || {
    month: now.getMonth()
  }).month);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  useEffect(() => {
    const onDoc = e => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (popRef.current && popRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => {
    if (open) {
      const p = parse(value);
      if (p) {
        setViewYear(p.year);
        setViewMonth(p.month);
      }
    }
  }, [open]);
  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !popRef.current) return;
    const margin = 8;
    const update = () => {
      const t = triggerRef.current.getBoundingClientRect();
      const p = popRef.current.getBoundingClientRect();
      let left = dir === 'rtl' ? t.right - p.width : t.left;
      left = Math.min(Math.max(left, margin), window.innerWidth - p.width - margin);
      let top = t.bottom + 6;
      if (top + p.height > window.innerHeight - margin) top = Math.max(t.top - p.height - 6, margin);
      setPos({
        top,
        left
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, dir]);
  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else setViewMonth(m => m + 1);
  };
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const selectDay = d => {
    onChange && onChange({
      target: {
        value: format(viewYear, viewMonth, d)
      }
    });
    setOpen(false);
  };
  const isSelected = d => parsed && parsed.day === d && parsed.month === viewMonth && parsed.year === viewYear;
  const isToday = d => now.getFullYear() === viewYear && now.getMonth() === viewMonth && now.getDate() === d;
  const years = [];
  const nowY = now.getFullYear();
  for (let y = nowY - 5; y <= nowY + 1; y++) years.push(y);
  const popStyle = {
    position: 'fixed',
    top: pos ? pos.top : -9999,
    left: pos ? pos.left : -9999,
    visibility: pos ? 'visible' : 'hidden',
    width: 280,
    maxWidth: 'calc(100vw - 16px)',
    boxSizing: 'border-box',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-card)',
    boxShadow: 'var(--shadow-dropdown)',
    padding: 14,
    zIndex: 1000,
    fontFamily: 'var(--font-arabic)'
  };
  return React.createElement('div', {
    ref: triggerRef,
    dir,
    style: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-arabic)'
    }
  }, fieldLabel && React.createElement('label', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)'
    }
  }, fieldLabel, required && React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('button', {
    type: 'button',
    disabled,
    onClick: () => setOpen(o => !o),
    className: 'se-focusable',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      height: 44,
      boxSizing: 'border-box',
      padding: '0 12px',
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`,
      background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      textAlign: 'start'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'calendar',
    size: 16,
    color: 'var(--color-text-muted)'
  }), React.createElement('span', {
    dir: 'ltr',
    style: {
      flex: 1,
      fontSize: 15,
      color: value ? 'var(--color-text)' : 'var(--color-text-muted)',
      fontFeatureSettings: "'tnum' 1"
    }
  }, value || placeholder), React.createElement(__ds_scope.Icon, {
    name: 'chevron-down',
    size: 14,
    color: 'var(--color-text-muted)'
  })), error && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-expense)'
    }
  }, error), open && ReactDOM.createPortal(React.createElement('div', {
    ref: popRef,
    dir,
    className: 'se-datefield-pop',
    role: 'dialog',
    'aria-label': placeholder,
    style: popStyle
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
      marginBottom: 10
    }
  }, React.createElement('button', {
    type: 'button',
    onClick: prevMonth,
    'aria-label': prevLabel,
    className: 'se-focusable',
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: 'none',
      background: 'var(--color-surface-hover)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, React.createElement(__ds_scope.Icon, {
    name: isEn ? 'chevron-left' : 'chevron-right',
    size: 16
  })), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 6,
      minWidth: 0
    }
  }, React.createElement('select', {
    value: viewMonth,
    onChange: e => setViewMonth(+e.target.value),
    className: 'se-focusable',
    style: {
      border: '1px solid var(--color-border-strong)',
      borderRadius: 8,
      padding: '4px 6px',
      fontSize: 13,
      fontFamily: 'var(--font-arabic)',
      background: 'var(--color-surface)',
      color: 'var(--color-text)'
    }
  }, MONTHS.map((m, i) => React.createElement('option', {
    key: i,
    value: i
  }, m))), React.createElement('select', {
    value: viewYear,
    onChange: e => setViewYear(+e.target.value),
    className: 'se-focusable',
    style: {
      border: '1px solid var(--color-border-strong)',
      borderRadius: 8,
      padding: '4px 6px',
      fontSize: 13,
      fontFamily: 'var(--font-numeric)',
      background: 'var(--color-surface)',
      color: 'var(--color-text)'
    }
  }, years.map(y => React.createElement('option', {
    key: y,
    value: y
  }, y)))), React.createElement('button', {
    type: 'button',
    onClick: nextMonth,
    'aria-label': nextLabel,
    className: 'se-focusable',
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      border: 'none',
      background: 'var(--color-surface-hover)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, React.createElement(__ds_scope.Icon, {
    name: isEn ? 'chevron-right' : 'chevron-left',
    size: 16
  }))), React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gap: 2,
      marginBottom: 4
    }
  }, WEEKDAYS.map(w => React.createElement('div', {
    key: w,
    style: {
      fontSize: 11,
      color: 'var(--color-text-muted)',
      textAlign: 'center',
      fontWeight: 600,
      padding: '4px 0'
    }
  }, w))), React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gap: 2
    }
  }, cells.map((d, i) => d === null ? React.createElement('div', {
    key: 'e' + i
  }) : React.createElement('button', {
    type: 'button',
    key: d,
    onClick: () => selectDay(d),
    className: 'se-focusable',
    style: {
      width: '100%',
      aspectRatio: '1',
      minHeight: 32,
      borderRadius: '50%',
      border: 'none',
      background: isSelected(d) ? 'var(--color-primary)' : 'transparent',
      color: isSelected(d) ? '#fff' : isToday(d) ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: isSelected(d) || isToday(d) ? 700 : 500,
      fontSize: 13,
      cursor: 'pointer',
      fontFamily: 'var(--font-numeric)'
    }
  }, d)))), document.body));
}
Object.assign(__ds_scope, { DateField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/DateField.jsx", error: String((e && e.message) || e) }); }

// components/forms/DateInput.jsx
try { (() => {
const {
  useId
} = React;
function DateInput({
  label = 'التاريخ',
  value,
  onChange,
  required,
  error,
  disabled
}) {
  const id = useId();
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('label', {
    htmlFor: id,
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)'
    }
  }, label, required && React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, React.createElement('input', {
    id,
    type: 'text',
    dir: 'ltr',
    placeholder: 'DD/MM/YYYY',
    value,
    onChange,
    disabled,
    className: 'se-focusable',
    style: {
      width: '100%',
      height: 44,
      boxSizing: 'border-box',
      padding: '0 40px 0 12px',
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`,
      background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)',
      fontSize: 15,
      textAlign: 'end',
      fontFeatureSettings: "'tnum' 1",
      fontFamily: 'var(--font-numeric)'
    }
  }), React.createElement('span', {
    style: {
      position: 'absolute',
      insetInlineStart: 12,
      color: 'var(--color-text-muted)',
      display: 'flex'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'calendar',
    size: 16
  }))), error && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-expense)'
    }
  }, error));
}
Object.assign(__ds_scope, { DateInput });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/DateInput.jsx", error: String((e && e.message) || e) }); }

// components/forms/FileUpload.jsx
try { (() => {
function FileUpload({
  label = 'إيصال أو فاتورة',
  fileName,
  progress,
  status = 'idle',
  onPick,
  hint = 'JPG، PNG أو PDF — حتى 10MB'
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('span', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)'
    }
  }, label), React.createElement('label', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: 24,
      borderRadius: 'var(--radius-card)',
      border: '1.5px dashed var(--color-border-strong)',
      background: 'var(--color-surface-hover)',
      cursor: 'pointer',
      textAlign: 'center'
    }
  }, React.createElement('input', {
    type: 'file',
    onChange: onPick,
    style: {
      display: 'none'
    }
  }), React.createElement(__ds_scope.Icon, {
    name: status === 'error' ? 'circle-x' : 'upload',
    size: 24,
    color: status === 'error' ? 'var(--color-expense)' : 'var(--color-text-muted)'
  }), fileName ? React.createElement('span', {
    dir: 'ltr',
    style: {
      fontSize: 13,
      color: 'var(--color-text)'
    }
  }, fileName) : React.createElement('span', {
    style: {
      fontSize: 13,
      color: 'var(--color-text)'
    }
  }, 'اسحب الملف هنا أو انقر للاختيار'), React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)'
    }
  }, hint)), status === 'uploading' && React.createElement('div', {
    style: {
      height: 6,
      borderRadius: 99,
      background: 'var(--color-border)',
      overflow: 'hidden'
    }
  }, React.createElement('div', {
    style: {
      width: `${progress || 0}%`,
      height: '100%',
      background: 'var(--color-primary)',
      transition: 'width .2s ease'
    }
  })), status === 'error' && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-expense)'
    }
  }, 'تعذّر رفع الملف. حاول مرة أخرى.'));
}
Object.assign(__ds_scope, { FileUpload });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/FileUpload.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
const {
  useId
} = React;
function Input({
  label,
  required,
  helper,
  error,
  icon,
  disabled,
  value,
  onChange,
  placeholder,
  type = 'text',
  dirOverride,
  ...rest
}) {
  const id = useId();
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-arabic)'
    }
  }, label && React.createElement('label', {
    htmlFor: id,
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 'var(--text-label-weight)',
      color: 'var(--color-text)'
    }
  }, label, required && React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, icon && React.createElement('span', {
    style: {
      position: 'absolute',
      insetInlineStart: 12,
      color: 'var(--color-text-muted)',
      display: 'flex'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: icon,
    size: 16
  })), React.createElement('input', {
    id,
    type,
    value,
    onChange,
    placeholder,
    disabled,
    dir: dirOverride,
    className: 'se-focusable',
    style: {
      width: '100%',
      height: 44,
      boxSizing: 'border-box',
      padding: icon ? '0 40px 0 12px' : '0 12px',
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`,
      background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)',
      fontSize: 'var(--text-body-size)',
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    },
    ...rest
  })), error ? React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-expense)'
    }
  }, error) : helper && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)'
    }
  }, helper));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
const {
  useId
} = React;
function Select({
  label,
  required,
  value,
  onChange,
  options = [],
  placeholder = 'اختر…',
  disabled,
  error
}) {
  const id = useId();
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-arabic)'
    }
  }, label && React.createElement('label', {
    htmlFor: id,
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)'
    }
  }, label, required && React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, React.createElement('select', {
    id,
    value,
    onChange,
    disabled,
    className: 'se-focusable',
    style: {
      width: '100%',
      height: 44,
      boxSizing: 'border-box',
      padding: '0 36px 0 12px',
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`,
      background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)',
      fontSize: 15,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)',
      appearance: 'none'
    }
  }, React.createElement('option', {
    value: '',
    disabled: true
  }, placeholder), options.map(o => React.createElement('option', {
    key: o.value,
    value: o.value,
    disabled: o.disabled
  }, o.label))), React.createElement('span', {
    style: {
      position: 'absolute',
      insetInlineStart: 12,
      color: 'var(--color-text-muted)',
      pointerEvents: 'none',
      display: 'flex'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'chevron-down',
    size: 16
  }))), error && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-expense)'
    }
  }, error));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
const {
  useId
} = React;
function Textarea({
  label,
  required,
  value,
  onChange,
  placeholder,
  rows = 3,
  helper,
  error,
  disabled
}) {
  const id = useId();
  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-arabic)'
    }
  }, label && React.createElement('label', {
    htmlFor: id,
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)'
    }
  }, label, required && React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('textarea', {
    id,
    value,
    onChange,
    placeholder,
    rows,
    disabled,
    className: 'se-focusable',
    style: {
      width: '100%',
      boxSizing: 'border-box',
      padding: 12,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${error ? 'var(--color-expense)' : 'var(--color-border-strong)'}`,
      background: disabled ? 'var(--color-surface-sunken)' : 'var(--color-surface)',
      fontSize: 15,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)',
      resize: 'vertical',
      lineHeight: 'var(--line-height-normal)'
    }
  }), error ? React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-expense)'
    }
  }, error) : helper && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)'
    }
  }, helper));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/finance/AIReviewForm.jsx
try { (() => {
function AIReviewForm({
  status = 'ready',
  fields = {},
  onFieldChange,
  categories = [],
  onCreateCategory,
  canManageCategories = false,
  receiptCurrency,
  workspaceCurrency,
  errorMessage,
  onConfirm,
  onDiscard,
  onRetry,
  loading,
  hideHeader,
  hideActions
}) {
  const {
    CategoryPickerDialog
  } = typeof window !== 'undefined' && window.SmartExpenseAIDesignSystem_44f3e6 || {};
  const [catOpen, setCatOpen] = React.useState(false);
  const locked = status === 'confirmed' || status === 'discarded';
  const set = k => e => onFieldChange && onFieldChange(k, e.target.value);
  const currencyMismatch = receiptCurrency && workspaceCurrency && receiptCurrency !== workspaceCurrency;
  const category = fields.category;
  const categoryLabel = category ? category.isSub ? `${category.mainLabel} › ${category.label}` : category.label : 'اختر الفئة الرئيسية أو الفرعية';
  return React.createElement(React.Fragment, null, React.createElement('div', {
    dir: 'rtl',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      fontFamily: 'var(--font-arabic)'
    }
  }, !hideHeader && React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between'
    }
  }, React.createElement('span', {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--color-text)'
    }
  }, 'قيم مستخرجة — عدّلها قبل التأكيد'), React.createElement(__ds_scope.StatusBadge, {
    status
  })), status === 'failed' && errorMessage && React.createElement(__ds_scope.Alert, {
    tone: 'error',
    title: 'تعذّر الاستخراج'
  }, errorMessage), status === 'failed' && React.createElement(__ds_scope.Button, {
    variant: 'secondary',
    onClick: onRetry
  }, 'إعادة محاولة الاستخراج'), status !== 'confirmed' && status !== 'discarded' && status !== 'failed' && React.createElement(__ds_scope.Alert, {
    tone: 'warning'
  }, 'قيمة غير مؤكدة — راجعها قبل إضافتها كمصروف فعلي.'), currencyMismatch && React.createElement(__ds_scope.Alert, {
    tone: 'warning',
    title: 'اختلاف العملة — Future state — Phase 12'
  }, `عملة الإيصال المستخرجة (${receiptCurrency}) تختلف عن عملة مساحة العمل الأساسية (${workspaceCurrency}). لن يتم تحويل المبلغ تلقائيًا — يرجى مراجعة القيمة وإدخالها بعملة مساحة العمل قبل التأكيد.`), React.createElement(__ds_scope.AmountInput, {
    label: 'المبلغ',
    kind: status === 'confirmed' ? 'expense' : 'pending',
    value: fields.amount,
    onChange: set('amount'),
    disabled: locked
  }), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement('label', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)'
    }
  }, 'الفئة الرئيسية أو الفرعية'), React.createElement(__ds_scope.Badge, {
    tone: 'warning',
    dot: true
  }, 'Future state — Phase 13')), React.createElement('button', {
    type: 'button',
    disabled: locked,
    onClick: () => setCatOpen(true),
    className: 'se-focusable',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      height: 44,
      boxSizing: 'border-box',
      padding: '0 12px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: locked ? 'var(--color-surface-sunken)' : 'var(--color-surface)',
      cursor: locked ? 'not-allowed' : 'pointer',
      textAlign: 'start'
    }
  }, category && React.createElement(__ds_scope.Icon, {
    name: category.icon,
    size: 16,
    color: 'var(--color-text-muted)'
  }), React.createElement('span', {
    style: {
      flex: 1,
      fontSize: 14,
      color: category ? 'var(--color-text)' : 'var(--color-text-muted)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, categoryLabel), React.createElement(__ds_scope.Icon, {
    name: 'chevron-down',
    size: 14,
    color: 'var(--color-text-muted)'
  }))), React.createElement(__ds_scope.DateField, {
    label: 'التاريخ',
    required: true,
    value: fields.date,
    onChange: set('date'),
    disabled: locked
  }), React.createElement(__ds_scope.Textarea, {
    label: 'ملاحظات',
    placeholder: 'اسم التاجر أو أي تفاصيل إضافية...',
    value: fields.notes,
    onChange: set('notes'),
    rows: 3,
    disabled: locked
  }), !hideActions && status !== 'confirmed' && status !== 'discarded' && React.createElement('div', {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 4
    }
  }, React.createElement(__ds_scope.Button, {
    variant: 'secondary',
    onClick: onDiscard,
    disabled: locked
  }, 'تجاهل'), React.createElement(__ds_scope.Button, {
    onClick: onConfirm,
    loading,
    disabled: status === 'failed'
  }, 'تأكيد'))), CategoryPickerDialog && React.createElement(CategoryPickerDialog, {
    open: catOpen,
    categories,
    selected: category,
    canManageCategories,
    onCreateCategory,
    onClose: () => setCatOpen(false),
    onSelect: c => {
      onFieldChange && onFieldChange('category', c);
      setCatOpen(false);
    }
  }));
}
Object.assign(__ds_scope, { AIReviewForm });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/finance/AIReviewForm.jsx", error: String((e && e.message) || e) }); }

// components/navigation/MobileNav.jsx
try { (() => {
const dict = {
  ar: [{
    key: 'dashboard',
    label: 'الرئيسية',
    icon: 'layout-dashboard'
  }, {
    key: 'expenses',
    label: 'المصاريف',
    icon: 'trending-down'
  }, {
    key: 'add',
    label: 'إضافة',
    icon: 'plus-circle'
  }, {
    key: 'reports',
    label: 'التقارير',
    icon: 'bar-chart-3'
  }, {
    key: 'more',
    label: 'المزيد',
    icon: 'menu'
  }],
  en: [{
    key: 'dashboard',
    label: 'Home',
    icon: 'layout-dashboard'
  }, {
    key: 'expenses',
    label: 'Expenses',
    icon: 'trending-down'
  }, {
    key: 'add',
    label: 'Add',
    icon: 'plus-circle'
  }, {
    key: 'reports',
    label: 'Reports',
    icon: 'bar-chart-3'
  }, {
    key: 'more',
    label: 'More',
    icon: 'menu'
  }]
};
function MobileNav({
  active = 'dashboard',
  onNavigate,
  lang = 'ar',
  dir,
  hideAdd
}) {
  const items = (dict[lang] || dict.ar).filter(it => !(hideAdd && it.key === 'add'));
  const resolvedDir = dir || (lang === 'en' ? 'ltr' : 'rtl');
  return React.createElement('nav', {
    dir: resolvedDir,
    style: {
      position: 'fixed',
      insetInlineStart: 0,
      insetInlineEnd: 0,
      bottom: 0,
      height: 64,
      background: 'var(--color-surface)',
      borderTop: '1px solid var(--color-border)',
      display: 'flex',
      fontFamily: 'var(--font-arabic)',
      zIndex: 40
    }
  }, items.map(it => React.createElement('button', {
    key: it.key,
    onClick: () => onNavigate && onNavigate(it.key),
    className: 'se-focusable',
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      border: 'none',
      background: 'none',
      color: active === it.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
      minHeight: 44
    }
  }, React.createElement(__ds_scope.Icon, {
    name: it.icon,
    size: it.key === 'add' ? 26 : 20,
    color: it.key === 'add' ? 'var(--color-primary)' : active === it.key ? 'var(--color-primary)' : 'var(--color-text-muted)'
  }), React.createElement('span', {
    style: {
      fontSize: 11,
      fontWeight: active === it.key ? 700 : 500
    }
  }, it.label))));
}
Object.assign(__ds_scope, { MobileNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/MobileNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PageHeading.jsx
try { (() => {
function PageHeading({
  title,
  description,
  actions,
  dir = 'rtl'
}) {
  return React.createElement('div', {
    dir,
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', null, React.createElement('h1', {
    style: {
      fontSize: 'var(--text-page-title-size)',
      fontWeight: 'var(--text-page-title-weight)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, title), description && React.createElement('p', {
    style: {
      fontSize: 14,
      color: 'var(--color-text-muted)',
      margin: '6px 0 0'
    }
  }, description)), actions && React.createElement('div', {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, actions));
}
Object.assign(__ds_scope, { PageHeading });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PageHeading.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Sidebar.jsx
try { (() => {
const dict = {
  ar: {
    brand: 'Smart Expense',
    items: [{
      key: 'dashboard',
      label: 'لوحة التحكم',
      icon: 'layout-dashboard'
    }, {
      key: 'income',
      label: 'الدخل',
      icon: 'trending-up'
    }, {
      key: 'expenses',
      label: 'المصاريف',
      icon: 'trending-down'
    }, {
      key: 'categories',
      label: 'الفئات',
      icon: 'shapes'
    }, {
      key: 'files',
      label: 'الإيصالات والملفات',
      icon: 'receipt'
    }, {
      key: 'ai-review',
      label: 'مراجعة الاستخراج الذكي',
      icon: 'sparkles'
    }, {
      key: 'reports',
      label: 'التقارير',
      icon: 'bar-chart-3'
    }, {
      key: 'history',
      label: 'سجل النشاط',
      icon: 'history'
    }, {
      key: 'settings',
      label: 'الإعدادات',
      icon: 'settings'
    }]
  },
  en: {
    brand: 'Smart Expense',
    items: [{
      key: 'dashboard',
      label: 'Dashboard',
      icon: 'layout-dashboard'
    }, {
      key: 'income',
      label: 'Income',
      icon: 'trending-up'
    }, {
      key: 'expenses',
      label: 'Expenses',
      icon: 'trending-down'
    }, {
      key: 'categories',
      label: 'Categories',
      icon: 'shapes'
    }, {
      key: 'files',
      label: 'Receipts & Files',
      icon: 'receipt'
    }, {
      key: 'ai-review',
      label: 'AI Review',
      icon: 'sparkles'
    }, {
      key: 'reports',
      label: 'Reports',
      icon: 'bar-chart-3'
    }, {
      key: 'history',
      label: 'History',
      icon: 'history'
    }, {
      key: 'settings',
      label: 'Settings',
      icon: 'settings'
    }]
  }
};
function Sidebar({
  active = 'dashboard',
  onNavigate,
  workspaceName = 'عائلة العتيبي',
  pendingCount = 0,
  lang = 'ar',
  dir
}) {
  const t = dict[lang] || dict.ar;
  const resolvedDir = dir || (lang === 'en' ? 'ltr' : 'rtl');
  const border = resolvedDir === 'rtl' ? {
    borderInlineEnd: '1px solid var(--color-border)'
  } : {
    borderInlineEnd: '1px solid var(--color-border)'
  };
  return React.createElement('nav', {
    dir: resolvedDir,
    style: {
      width: 'var(--sidebar-width)',
      height: '100%',
      background: 'var(--color-surface)',
      ...border,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      padding: '20px 16px 12px',
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, React.createElement('div', {
    style: {
      width: 32,
      height: 32,
      borderRadius: 8,
      background: 'var(--color-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'wallet',
    size: 18,
    color: '#fff'
  })), React.createElement('span', {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--color-text)'
    }
  }, t.brand)), React.createElement('div', {
    style: {
      margin: '4px 12px 12px',
      padding: '10px 12px',
      borderRadius: 'var(--radius-control)',
      background: 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer'
    }
  }, React.createElement('span', {
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--color-text)'
    }
  }, workspaceName), React.createElement(__ds_scope.Icon, {
    name: 'chevrons-up-down',
    size: 14,
    color: 'var(--color-text-muted)'
  })), React.createElement('div', {
    className: 'se-scrollbar',
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 8px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, t.items.map(it => React.createElement('button', {
    key: it.key,
    onClick: () => onNavigate && onNavigate(it.key),
    className: 'se-focusable se-row-hover',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 12px',
      borderRadius: 'var(--radius-control)',
      border: 'none',
      background: active === it.key ? 'var(--color-primary-subtle)' : 'transparent',
      color: active === it.key ? 'var(--color-primary)' : 'var(--color-text)',
      fontSize: 14,
      fontWeight: active === it.key ? 700 : 500,
      cursor: 'pointer',
      textAlign: 'start'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: it.icon,
    size: 18
  }), React.createElement('span', {
    style: {
      flex: 1
    }
  }, it.label), it.key === 'ai-review' && pendingCount > 0 && React.createElement('span', {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#92620A',
      background: 'var(--color-warning-subtle)',
      borderRadius: 99,
      padding: '1px 7px'
    }
  }, pendingCount)))));
}
Object.assign(__ds_scope, { Sidebar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Sidebar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
const {
  useState
} = React;
function Tabs({
  tabs = [],
  value,
  onChange,
  defaultValue
}) {
  const [internal, setInternal] = useState(defaultValue || tabs[0] && tabs[0].key);
  const active = value !== undefined ? value : internal;
  const set = k => {
    if (value === undefined) setInternal(k);
    onChange && onChange(k);
  };
  return React.createElement('div', {
    dir: 'rtl',
    role: 'tablist',
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--color-border)',
      fontFamily: 'var(--font-arabic)'
    }
  }, tabs.map(t => React.createElement('button', {
    key: t.key,
    role: 'tab',
    'aria-selected': active === t.key,
    onClick: () => set(t.key),
    className: 'se-focusable',
    style: {
      padding: '10px 4px',
      margin: '0 12px',
      border: 'none',
      borderBottom: `2px solid ${active === t.key ? 'var(--color-primary)' : 'transparent'}`,
      background: 'none',
      color: active === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
      fontSize: 14,
      fontWeight: active === t.key ? 700 : 500,
      cursor: 'pointer'
    }
  }, t.label)));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// components/overlays/CategoryPickerDialog.jsx
try { (() => {
const {
  useState
} = React;
const ICON_CHOICES = ['shopping-cart', 'car', 'home', 'utensils', 'heart-pulse', 'receipt', 'gift', 'plane', 'dumbbell', 'book-open', 'wallet', 'tag', 'coffee', 'wrench', 'more-horizontal'];
const STR = {
  ar: {
    addCategory: 'إضافة فئة',
    close: 'إغلاق',
    notAvailable: 'غير متاحة',
    categoryType: 'نوع الفئة',
    main: 'فئة رئيسية',
    sub: 'فئة فرعية',
    parent: 'الفئة الرئيسية',
    mainName: 'اسم الفئة الرئيسية',
    subName: 'اسم الفئة الفرعية',
    namePlaceholder: 'مثال: ترفيه',
    icon: 'الأيقونة',
    cancel: 'إلغاء',
    saveCategory: 'حفظ الفئة',
    savedTitle: 'تمت إضافة الفئة بنجاح',
    nameRequired: 'اسم الفئة مطلوب.',
    parentRequired: 'يرجى اختيار الفئة الرئيسية.',
    iconRequired: 'يرجى اختيار أيقونة.',
    dupMain: 'توجد فئة رئيسية بنفس الاسم بالفعل.',
    dupSub: 'توجد فئة فرعية بنفس الاسم ضمن هذه الفئة الرئيسية.'
  },
  en: {
    addCategory: 'Add category',
    close: 'Close',
    notAvailable: 'Not available',
    categoryType: 'Category type',
    main: 'Main category',
    sub: 'Subcategory',
    parent: 'Main category',
    mainName: 'Main category name',
    subName: 'Subcategory name',
    namePlaceholder: 'Example: Entertainment',
    icon: 'Icon',
    cancel: 'Cancel',
    saveCategory: 'Save category',
    savedTitle: 'Category added successfully',
    nameRequired: 'Category name is required.',
    parentRequired: 'Please select a main category.',
    iconRequired: 'Please select an icon.',
    dupMain: 'A main category with this name already exists.',
    dupSub: 'A subcategory with this name already exists under this main category.'
  }
};
function CreateCategorySheet({
  categories,
  lang,
  onClose,
  onCreated
}) {
  const t = STR[lang] || STR.ar;
  const [type, setType] = useState('main');
  const [name, setName] = useState('');
  const [parentValue, setParentValue] = useState('');
  const [icon, setIcon] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const mainOptions = categories.map(c => ({
    value: c.value,
    label: c.label,
    disabled: c.disabled
  }));
  const save = () => {
    if (saving || success) return;
    const trimmed = name.trim();
    if (!trimmed) return setError(t.nameRequired);
    if (type === 'sub' && !parentValue) return setError(t.parentRequired);
    if (!icon) return setError(t.iconRequired);
    if (type === 'main') {
      if (categories.some(c => c.label.trim() === trimmed)) return setError(t.dupMain);
    } else {
      const parent = categories.find(c => c.value === parentValue);
      if (parent && parent.subs && parent.subs.some(s => s.label.trim() === trimmed)) return setError(t.dupSub);
    }
    setError('');
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => {
        const value = `custom-${Date.now()}`;
        onCreated({
          value,
          label: trimmed,
          icon
        }, type === 'sub' ? parentValue : null);
      }, 500);
    }, 700);
  };
  return React.createElement('div', {
    className: 'se-picker-overlay',
    style: {
      zIndex: 210
    },
    onClick: onClose
  }, React.createElement('div', {
    className: 'se-picker-panel',
    dir: lang === 'en' ? 'ltr' : 'rtl',
    role: 'dialog',
    'aria-modal': true,
    onClick: e => e.stopPropagation()
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '16px 12px 12px 16px',
      borderBottom: '1px solid var(--color-border)',
      flexShrink: 0
    }
  }, React.createElement('span', {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, t.addCategory), React.createElement(__ds_scope.IconButton, {
    icon: 'x',
    label: t.close,
    size: 'lg',
    onClick: onClose,
    disabled: saving
  })), React.createElement('div', {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, success ? React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      padding: '24px 0',
      textAlign: 'center'
    }
  }, React.createElement('div', {
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: 'var(--color-income-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'check-circle-2',
    size: 26,
    color: 'var(--color-income)'
  })), React.createElement('span', {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, t.savedTitle)) : React.createElement(React.Fragment, null, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('span', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, t.categoryType), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement('button', {
    disabled: saving,
    onClick: () => {
      setType('main');
      setParentValue('');
    },
    className: 'se-focusable',
    style: {
      flex: 1,
      height: 44,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${type === 'main' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: type === 'main' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      color: type === 'main' ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, t.main), React.createElement('button', {
    disabled: saving,
    onClick: () => setType('sub'),
    className: 'se-focusable',
    style: {
      flex: 1,
      height: 44,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${type === 'sub' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: type === 'sub' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      color: type === 'sub' ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, t.sub))), type === 'sub' && React.createElement(__ds_scope.Select, {
    label: t.parent,
    required: true,
    value: parentValue,
    onChange: e => setParentValue(e.target.value),
    options: mainOptions,
    disabled: saving
  }), React.createElement(__ds_scope.Input, {
    label: type === 'main' ? t.mainName : t.subName,
    required: true,
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: t.namePlaceholder,
    disabled: saving
  }), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('span', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, t.icon, React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,44px)',
      gap: 8
    }
  }, ICON_CHOICES.map(ic => React.createElement('button', {
    key: ic,
    disabled: saving,
    onClick: () => setIcon(ic),
    'aria-label': ic,
    className: 'se-focusable',
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${icon === ic ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: icon === ic ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, React.createElement(__ds_scope.Icon, {
    name: ic,
    size: 18,
    color: icon === ic ? 'var(--color-primary)' : 'var(--color-text-muted)'
  }))))), error && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-expense)',
      fontFamily: 'var(--font-arabic)'
    }
  }, error))), !success && React.createElement('div', {
    style: {
      display: 'flex',
      gap: 10,
      padding: 16,
      borderTop: '1px solid var(--color-border)',
      flexShrink: 0
    }
  }, React.createElement(__ds_scope.Button, {
    variant: 'secondary',
    size: 'lg',
    fullWidth: true,
    onClick: onClose,
    disabled: saving
  }, t.cancel), React.createElement(__ds_scope.Button, {
    size: 'lg',
    fullWidth: true,
    onClick: save,
    loading: saving
  }, t.saveCategory))));
}
function CategoryPickerDialog({
  open,
  categories = [],
  selected,
  onClose,
  onSelect,
  onCreateCategory,
  canManageCategories = false,
  title,
  lang = 'ar'
}) {
  const t = STR[lang] || STR.ar;
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const heading = title || (lang === 'en' ? 'Select category' : 'اختر الفئة');
  const [creating, setCreating] = useState(false);
  if (!open) return null;
  return React.createElement(React.Fragment, null, React.createElement('div', {
    className: 'se-picker-overlay',
    onClick: onClose
  }, React.createElement('div', {
    className: 'se-picker-panel',
    dir,
    role: 'dialog',
    'aria-modal': true,
    onClick: e => e.stopPropagation()
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '16px 12px 12px 16px',
      borderBottom: '1px solid var(--color-border)',
      flexShrink: 0
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0
    }
  }, React.createElement('span', {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, heading), React.createElement(__ds_scope.Badge, {
    tone: 'warning',
    dot: true
  }, 'Future state — Phase 13')), React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexShrink: 0
    }
  }, canManageCategories && React.createElement('span', {
    className: 'se-cat-add-desktop'
  }, React.createElement(__ds_scope.Button, {
    variant: 'secondary',
    size: 'md',
    icon: 'plus',
    onClick: () => setCreating(true)
  }, t.addCategory)), canManageCategories && React.createElement('span', {
    className: 'se-cat-add-mobile'
  }, React.createElement(__ds_scope.IconButton, {
    icon: 'plus',
    label: t.addCategory,
    size: 'lg',
    variant: 'filled',
    onClick: () => setCreating(true)
  })), React.createElement(__ds_scope.IconButton, {
    icon: 'x',
    label: t.close,
    size: 'lg',
    onClick: onClose
  }))), React.createElement('div', {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '8px 16px 16px'
    }
  }, categories.map(cat => React.createElement('div', {
    key: cat.value,
    style: {
      marginBottom: 6
    }
  }, React.createElement('button', {
    disabled: cat.disabled,
    onClick: () => !cat.disabled && onSelect({
      value: cat.value,
      label: cat.label,
      icon: cat.icon
    }),
    className: `se-focusable se-cat-row ${selected && selected.value === cat.value && !selected.isSub ? 'se-cat-selected' : ''}`
  }, React.createElement('div', {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(__ds_scope.Icon, {
    name: cat.icon,
    size: 18,
    color: 'var(--color-text-muted)'
  })), React.createElement('span', {
    style: {
      flex: 1,
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)',
      textAlign: 'start'
    }
  }, cat.label), cat.disabled && React.createElement('span', {
    style: {
      fontSize: 11,
      color: 'var(--color-text-faint)',
      fontFamily: 'var(--font-arabic)'
    }
  }, t.notAvailable), selected && selected.value === cat.value && !selected.isSub && React.createElement(__ds_scope.Icon, {
    name: 'check',
    size: 18,
    color: 'var(--color-primary)'
  })), cat.subs && cat.subs.length > 0 && React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      paddingInlineStart: 30
    }
  }, cat.subs.map(sub => React.createElement('button', {
    key: sub.value,
    disabled: cat.disabled,
    onClick: () => !cat.disabled && onSelect({
      value: sub.value,
      label: sub.label,
      icon: sub.icon,
      isSub: true,
      mainLabel: cat.label
    }),
    className: `se-focusable se-cat-row ${selected && selected.value === sub.value && selected.isSub ? 'se-cat-selected' : ''}`
  }, React.createElement('div', {
    style: {
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(__ds_scope.Icon, {
    name: sub.icon,
    size: 14,
    color: 'var(--color-text-muted)'
  })), React.createElement('span', {
    style: {
      flex: 1,
      fontSize: 14,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)',
      textAlign: 'start'
    }
  }, sub.label), selected && selected.value === sub.value && selected.isSub && React.createElement(__ds_scope.Icon, {
    name: 'check',
    size: 16,
    color: 'var(--color-primary)'
  }))))))))), creating && React.createElement(CreateCategorySheet, {
    categories,
    lang,
    onClose: () => setCreating(false),
    onCreated: (newCat, parentValue) => {
      onCreateCategory && onCreateCategory(newCat, parentValue);
      setCreating(false);
      const parent = parentValue ? categories.find(c => c.value === parentValue) : null;
      onSelect(parent ? {
        value: newCat.value,
        label: newCat.label,
        icon: newCat.icon,
        isSub: true,
        mainLabel: parent.label
      } : {
        value: newCat.value,
        label: newCat.label,
        icon: newCat.icon
      });
    }
  }));
}
Object.assign(__ds_scope, { CategoryPickerDialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/CategoryPickerDialog.jsx", error: String((e && e.message) || e) }); }

// components/overlays/Dialog.jsx
try { (() => {
const {
  useEffect
} = React;
function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  dir = 'rtl',
  mobileFullSheet = false
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => {
      if (e.key === 'Escape') onClose && onClose();
    };
    window.addEventListener('keydown', onKey);
    const scroller = document.querySelector('.se-app-main') || document.body;
    const prevOverflow = scroller.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    scroller.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      scroller.style.overflow = prevOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [open, onClose]);
  if (!open) return null;
  const widths = {
    sm: 380,
    md: 480,
    lg: 640
  };
  const width = typeof size === 'number' ? size : widths[size] || widths.md;
  return React.createElement('div', {
    className: `se-dialog-overlay ${mobileFullSheet ? 'se-dialog-overlay-sheet' : ''}`.trim(),
    onClick: onClose
  }, React.createElement('div', {
    dir,
    onClick: e => e.stopPropagation(),
    className: `se-dialog-panel ${mobileFullSheet ? 'se-dialog-panel-sheet' : ''}`.trim(),
    style: {
      '--se-dialog-width': width + 'px',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      padding: '20px 20px 16px',
      borderBottom: '1px solid var(--color-border)',
      flexShrink: 0
    }
  }, React.createElement('div', null, React.createElement('div', {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--color-text)'
    }
  }, title), description && React.createElement('div', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)',
      marginTop: 4
    }
  }, description)), React.createElement(__ds_scope.IconButton, {
    icon: 'x',
    label: dir === 'ltr' ? 'Close' : 'إغلاق',
    onClick: onClose
  })), React.createElement('div', {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px 20px'
    }
  }, children), footer && React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'flex-start',
      gap: 8,
      padding: '14px 20px',
      borderTop: '1px solid var(--color-border)',
      flexShrink: 0
    }
  }, footer)));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/overlays/ConfirmDialog.jsx
try { (() => {
function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'تأكيد الحذف',
  description,
  confirmLabel = 'حذف نهائي',
  cancelLabel = 'إلغاء',
  loading = false
}) {
  return React.createElement(__ds_scope.Dialog, {
    open,
    onClose,
    size: 'sm',
    title: null,
    footer: React.createElement(React.Fragment, null, React.createElement(__ds_scope.Button, {
      variant: 'secondary',
      onClick: onClose,
      disabled: loading
    }, cancelLabel), React.createElement(__ds_scope.Button, {
      variant: 'destructive',
      onClick: onConfirm,
      loading
    }, confirmLabel))
  }, React.createElement('div', {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, React.createElement('div', {
    style: {
      width: 40,
      height: 40,
      borderRadius: '50%',
      background: 'var(--color-expense-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(__ds_scope.Icon, {
    name: 'triangle-alert',
    size: 20,
    color: 'var(--color-expense)'
  })), React.createElement('div', null, React.createElement('div', {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--color-text)',
      marginBottom: 6
    }
  }, title), React.createElement('div', {
    style: {
      fontSize: 14,
      color: 'var(--color-text-muted)',
      lineHeight: 'var(--line-height-normal)'
    }
  }, description))));
}
Object.assign(__ds_scope, { ConfirmDialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/ConfirmDialog.jsx", error: String((e && e.message) || e) }); }

// components/overlays/DropdownMenu.jsx
try { (() => {
const {
  useState,
  useRef,
  useEffect,
  useLayoutEffect
} = React;
function DropdownMenu({
  trigger,
  items = [],
  align = 'start',
  menuMinWidth = 200,
  menuWidth,
  dir = 'rtl'
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    const onDoc = e => {
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => {
    if (!open) setPos(null);
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) return;
    const margin = 8;
    const update = () => {
      const t = triggerRef.current.getBoundingClientRect();
      const m = menuRef.current.getBoundingClientRect();
      const alignEnd = dir === 'rtl' ? align === 'start' : align === 'end';
      let left = alignEnd ? t.right - m.width : t.left;
      left = Math.min(Math.max(left, margin), window.innerWidth - m.width - margin);
      let top = t.bottom + 6;
      if (top + m.height > window.innerHeight - margin) top = Math.max(t.top - m.height - 6, margin);
      setPos({
        top,
        left
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, align, dir]);
  const menuStyle = {
    position: 'fixed',
    top: pos ? pos.top : -9999,
    left: pos ? pos.left : -9999,
    visibility: pos ? 'visible' : 'hidden',
    minWidth: menuWidth ? undefined : menuMinWidth,
    width: menuWidth || 'max-content',
    maxWidth: menuWidth ? undefined : 'calc(100vw - 16px)',
    boxSizing: 'border-box',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-control)',
    boxShadow: 'var(--shadow-dropdown)',
    padding: 6,
    zIndex: 1000
  };
  return React.createElement('div', {
    ref: triggerRef,
    style: {
      position: 'relative',
      display: 'inline-block',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    onClick: () => setOpen(o => !o)
  }, trigger), open && ReactDOM.createPortal(React.createElement('div', {
    ref: menuRef,
    role: 'menu',
    dir,
    style: menuStyle
  }, items.map((it, i) => it.divider ? React.createElement('div', {
    key: i,
    style: {
      height: 1,
      background: 'var(--color-border)',
      margin: '4px 0'
    }
  }) : React.createElement('button', {
    key: i,
    onClick: () => {
      it.onClick && it.onClick();
      setOpen(false);
    },
    disabled: it.disabled,
    className: 'se-row-hover se-focusable',
    style: {
      display: 'flex',
      width: '100%',
      textAlign: 'start',
      alignItems: 'center',
      gap: 8,
      padding: '8px 10px',
      border: 'none',
      background: 'none',
      borderRadius: 6,
      fontSize: 14,
      whiteSpace: 'nowrap',
      color: it.destructive ? 'var(--color-expense)' : 'var(--color-text)',
      cursor: it.disabled ? 'not-allowed' : 'pointer',
      opacity: it.disabled ? 0.5 : 1
    }
  }, it.label))), document.body));
}
Object.assign(__ds_scope, { DropdownMenu });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/overlays/DropdownMenu.jsx", error: String((e && e.message) || e) }); }

// components/navigation/LanguageSwitcher.jsx
try { (() => {
function LanguageSwitcher({
  lang = 'ar',
  onChange,
  className,
  compact
}) {
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const label = lang === 'ar' ? 'العربية' : 'English';
  const items = [{
    label: 'العربية',
    onClick: () => onChange && onChange('ar')
  }, {
    label: 'English',
    onClick: () => onChange && onChange('en')
  }];
  if (compact) {
    return React.createElement('div', {
      className: `se-lang-switcher ${className || ''}`.trim(),
      style: {
        display: 'flex',
        alignItems: 'center'
      }
    }, React.createElement(__ds_scope.DropdownMenu, {
      align: lang === 'ar' ? 'start' : 'end',
      dir,
      menuMinWidth: 130,
      trigger: React.createElement('button', {
        className: 'se-focusable se-row-hover',
        'aria-label': lang === 'ar' ? 'تغيير اللغة' : 'Change language',
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          minWidth: 44,
          minHeight: 44,
          boxSizing: 'border-box',
          borderRadius: '50%',
          border: '1px solid var(--color-border-strong)',
          background: 'var(--color-surface)',
          cursor: 'pointer',
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--color-text)',
          flexShrink: 0
        }
      }, lang === 'ar' ? 'ع' : 'E'),
      items
    }));
  }
  return React.createElement('div', {
    className: `se-lang-switcher ${className || ''}`.trim(),
    style: {
      display: 'flex',
      alignItems: 'center'
    }
  }, React.createElement(__ds_scope.DropdownMenu, {
    align: lang === 'ar' ? 'start' : 'end',
    dir,
    menuMinWidth: 130,
    trigger: React.createElement('button', {
      className: 'se-focusable se-row-hover se-lang-trigger',
      'aria-label': lang === 'ar' ? 'تغيير اللغة' : 'Change language',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 44,
        boxSizing: 'border-box',
        padding: '0 10px',
        borderRadius: 'var(--radius-control)',
        border: '1px solid var(--color-border-strong)',
        background: 'var(--color-surface)',
        cursor: 'pointer'
      }
    }, React.createElement(__ds_scope.Icon, {
      name: 'globe',
      size: 16,
      color: 'var(--color-text-muted)'
    }), React.createElement('span', {
      className: 'se-lang-label',
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text)',
        whiteSpace: 'nowrap'
      }
    }, label), React.createElement(__ds_scope.Icon, {
      name: 'chevron-down',
      size: 13,
      color: 'var(--color-text-muted)'
    })),
    items
  }));
}
Object.assign(__ds_scope, { LanguageSwitcher });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/LanguageSwitcher.jsx", error: String((e && e.message) || e) }); }

// components/navigation/WorkspaceSwitcher.jsx
try { (() => {
function WorkspaceSwitcher({
  current = {
    name: 'عائلة العتيبي',
    type: 'عائلي'
  },
  workspaces = [],
  onSelect,
  lang = 'ar'
}) {
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const items = [{
    label: `${current.name} — ${current.type}`,
    disabled: true
  }, {
    divider: true
  }, ...workspaces.map(w => ({
    label: `${w.name} — ${w.type}`,
    onClick: () => onSelect && onSelect(w)
  })), {
    divider: true
  }, {
    label: lang === 'en' ? 'Create new workspace' : 'إنشاء مساحة عمل جديدة',
    onClick: () => {}
  }];
  return React.createElement(__ds_scope.DropdownMenu, {
    align: 'start',
    dir,
    menuWidth: 'min(320px, calc(100vw - 32px))',
    trigger: React.createElement('button', {
      className: 'se-focusable se-row-hover se-ws-trigger',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 44,
        boxSizing: 'border-box',
        padding: '0 12px',
        borderRadius: 'var(--radius-control)',
        border: '1px solid var(--color-border-strong)',
        background: 'var(--color-surface)',
        cursor: 'pointer',
        fontFamily: 'var(--font-arabic)',
        minWidth: 0,
        width: '100%'
      }
    }, React.createElement(__ds_scope.Icon, {
      name: 'building-2',
      size: 16,
      color: 'var(--color-text-muted)',
      style: {
        flexShrink: 0
      }
    }), React.createElement('span', {
      className: 'se-ws-name',
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        minWidth: 0
      }
    }, current.name), React.createElement('span', {
      className: 'se-ws-type',
      style: {
        fontSize: 12,
        color: 'var(--color-text-muted)',
        flexShrink: 0
      }
    }, current.type), React.createElement(__ds_scope.Icon, {
      name: 'chevrons-up-down',
      size: 14,
      color: 'var(--color-text-muted)',
      style: {
        flexShrink: 0,
        marginInlineStart: 'auto'
      }
    })),
    items
  });
}
Object.assign(__ds_scope, { WorkspaceSwitcher });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/WorkspaceSwitcher.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TopHeader.jsx
try { (() => {
function TopHeader({
  user = {
    name: 'سارة العتيبي',
    role: 'مالك'
  },
  workspace,
  workspaces,
  onSelectWorkspace,
  onMenu,
  lang,
  onLangChange
}) {
  const dir = lang === 'en' ? 'ltr' : 'rtl';
  const userLine = {
    label: `${user.name} — ${user.role}`,
    disabled: true
  };
  const menuLabels = lang === 'en' ? [userLine, {
    divider: true
  }, {
    label: 'Profile'
  }, {
    label: 'Settings'
  }, {
    divider: true
  }, {
    label: 'Sign out',
    destructive: true
  }] : [userLine, {
    divider: true
  }, {
    label: 'الملف الشخصي'
  }, {
    label: 'الإعدادات'
  }, {
    divider: true
  }, {
    label: 'تسجيل الخروج',
    destructive: true
  }];
  const accountTrigger = React.createElement(__ds_scope.DropdownMenu, {
    align: 'end',
    dir,
    menuMinWidth: 200,
    trigger: React.createElement('button', {
      className: 'se-focusable se-row-hover se-user-trigger',
      'aria-label': lang === 'en' ? 'Account menu' : 'قائمة الحساب',
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 44,
        minHeight: 44,
        boxSizing: 'border-box',
        padding: '0 8px',
        borderRadius: 'var(--radius-control)',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        overflow: 'hidden'
      }
    }, React.createElement('div', {
      className: 'se-user-avatar',
      style: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: 'var(--color-primary-subtle)',
        color: 'var(--color-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 13,
        fontWeight: 700,
        flexShrink: 0,
        position: 'relative'
      }
    }, user.name.slice(0, 1), React.createElement('span', {
      className: 'se-account-chevron',
      style: {
        position: 'absolute',
        bottom: -2,
        insetInlineEnd: -2,
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }
    }, React.createElement(__ds_scope.Icon, {
      name: 'chevron-down',
      size: 9,
      color: 'var(--color-text-muted)'
    }))), React.createElement('div', {
      className: 'se-user-info',
      style: {
        textAlign: 'start'
      }
    }, React.createElement('div', {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text)'
      }
    }, user.name), React.createElement('div', {
      style: {
        fontSize: 11,
        color: 'var(--color-text-muted)'
      }
    }, user.role))),
    items: menuLabels
  });
  return React.createElement(React.Fragment, null, React.createElement('header', {
    dir,
    className: 'se-top-header',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      padding: '10px 20px',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    className: 'se-th-row1',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%'
    }
  }, onMenu && React.createElement('button', {
    onClick: onMenu,
    className: 'se-focusable',
    style: {
      display: 'none',
      border: 'none',
      background: 'none'
    }
  }), React.createElement('div', {
    className: 'se-th-workspace',
    style: {
      display: 'flex',
      alignItems: 'center',
      minWidth: 0,
      flex: '1 1 auto'
    }
  }, React.createElement(__ds_scope.WorkspaceSwitcher, {
    current: workspace,
    workspaces,
    onSelect: onSelectWorkspace,
    lang: lang || 'ar'
  })), onLangChange && React.createElement(__ds_scope.LanguageSwitcher, {
    lang: lang || 'ar',
    onChange: onLangChange,
    className: 'se-lang-desktop-slot'
  }), onLangChange && React.createElement(__ds_scope.LanguageSwitcher, {
    lang: lang || 'ar',
    onChange: onLangChange,
    compact: true,
    className: 'se-lang-mobile-slot'
  }), accountTrigger)), onLangChange && React.createElement('div', {
    className: 'se-th-note',
    dir,
    style: {
      padding: '4px 20px',
      fontSize: 11,
      color: 'var(--color-text-muted)',
      background: 'var(--color-surface)',
      borderBottom: '1px solid var(--color-border)'
    }
  }, lang === 'en' ? 'Future state — Phase 12: language switching is a prototype preview.' : 'حالة مستقبلية — المرحلة 12: تبديل اللغة معاينة أولية فقط.'));
}
Object.assign(__ds_scope, { TopHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TopHeader.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/AIReviewScreen.jsx
try { (() => {
function ReceiptBlock({
  file,
  onOpen,
  compact
}) {
  const {
    Icon
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const isPdf = file && /\.pdf$/i.test(file.fileName || '');
  if (compact) {
    return React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        borderRadius: 'var(--radius-control)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface-sunken)'
      }
    }, React.createElement('div', {
      style: {
        width: 40,
        height: 40,
        borderRadius: 8,
        background: isPdf ? 'var(--color-expense-subtle)' : 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, React.createElement(Icon, {
      name: isPdf ? 'file-text' : 'file-image',
      size: 18,
      color: isPdf ? 'var(--color-expense)' : 'var(--color-text-faint)'
    })), React.createElement('span', {
      dir: 'ltr',
      style: {
        flex: 1,
        unicodeBidi: 'plaintext',
        fontSize: 12.5,
        color: 'var(--color-text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      },
      title: file.fileName
    }, file.fileName), React.createElement('button', {
      type: 'button',
      onClick: onOpen,
      className: 'se-focusable',
      style: {
        border: 'none',
        background: 'none',
        color: 'var(--color-primary)',
        fontSize: 12.5,
        fontWeight: 600,
        fontFamily: 'var(--font-arabic)',
        cursor: 'pointer',
        whiteSpace: 'nowrap'
      }
    }, 'فتح الملف'));
  }
  return React.createElement('div', {
    onClick: onOpen,
    style: {
      cursor: 'pointer',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden',
      background: 'var(--color-surface-sunken)'
    }
  }, React.createElement('div', {
    style: {
      position: 'relative',
      height: 220,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#EEF2F6'
    }
  }, React.createElement(Icon, {
    name: isPdf ? 'file-text' : 'file-image',
    size: 36,
    color: 'var(--color-text-faint)'
  }), React.createElement('button', {
    'aria-label': 'تكبير',
    className: 'se-focusable',
    style: {
      position: 'absolute',
      top: 10,
      insetInlineEnd: 10,
      width: 32,
      height: 32,
      borderRadius: 8,
      border: 'none',
      background: 'rgba(255,255,255,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, React.createElement(Icon, {
    name: 'zoom-in',
    size: 16
  }))), React.createElement('div', {
    dir: 'ltr',
    style: {
      padding: '10px 14px',
      fontSize: 12,
      color: 'var(--color-text-muted)',
      borderTop: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, file.fileName));
}
function AIReviewScreen({
  role
}) {
  const {
    PageHeading,
    InfoCard,
    StatusBadge,
    Badge,
    Icon,
    IconButton,
    AIReviewForm,
    ConfirmDialog,
    Dialog,
    PermissionDeniedState
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const {
    aiQueue,
    expenseCategoryTree,
    workspaceCurrency
  } = window.SEMockData;
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
  const setField = id => (k, v) => setQueue(q => q.map(item => item.id === id ? {
    ...item,
    fields: {
      ...item.fields,
      [k]: v
    }
  } : item));
  const confirm = id => setQueue(q => q.map(item => item.id === id ? {
    ...item,
    status: 'confirmed'
  } : item));
  const discard = id => {
    setQueue(q => q.map(item => item.id === id ? {
      ...item,
      status: 'discarded'
    } : item));
    setDiscardTarget(null);
  };
  const retryExtraction = id => setQueue(q => q.map(item => item.id === id ? {
    ...item,
    status: 'ready',
    error: undefined,
    fields: {
      ...item.fields,
      amount: item.fields.amount || '',
      category: item.fields.category || null,
      date: item.fields.date || ''
    }
  } : item));
  const onCreateCategory = (newCat, parentValue) => setCategories(prev => parentValue ? prev.map(c => c.value === parentValue ? {
    ...c,
    subs: [...(c.subs || []), newCat]
  } : c) : [...prev, {
    ...newCat,
    subs: []
  }]);
  const selectItem = id => {
    setSelectedId(id);
    setMobileStep('detail');
  };
  if (!canReview) {
    return React.createElement('div', {
      dir: 'rtl'
    }, React.createElement(PageHeading, {
      title: 'مراجعة الاستخراج الذكي'
    }), React.createElement(PermissionDeniedState, {
      roleRequired: 'المالك أو المشرف أو العضو',
      description: 'لا يمكن للمشاهد مراجعة أو تأكيد عمليات الاستخراج الذكي.'
    }));
  }
  const queueRow = (a, mobile) => React.createElement('button', {
    key: a.id,
    onClick: () => mobile ? selectItem(a.id) : setSelectedId(a.id),
    className: 'se-row-hover se-focusable',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      textAlign: 'start',
      width: '100%',
      padding: mobile ? '14px 16px' : '12px 16px',
      border: 'none',
      borderBottom: '1px solid var(--color-border)',
      background: !mobile && a.id === selectedId ? 'var(--color-primary-subtle)' : 'transparent',
      cursor: 'pointer'
    }
  }, React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('span', {
    dir: 'ltr',
    style: {
      fontSize: mobile ? 14 : 12,
      fontWeight: mobile ? 600 : 400,
      color: 'var(--color-text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      unicodeBidi: 'plaintext'
    },
    title: a.fileName
  }, a.fileName), React.createElement(StatusBadge, {
    status: a.status
  })), mobile && React.createElement(Icon, {
    name: 'chevron-left',
    size: 18,
    color: 'var(--color-text-faint)'
  }));
  const detailForm = mobileMode => {
    if (!selected) return null;
    return React.createElement(AIReviewForm, {
      status: selected.status,
      fields: selected.fields,
      onFieldChange: setField(selected.id),
      categories,
      onCreateCategory,
      canManageCategories,
      receiptCurrency: selected.currency,
      workspaceCurrency,
      errorMessage: selected.error,
      hideHeader: mobileMode,
      hideActions: mobileMode,
      onConfirm: () => {
        confirm(selected.id);
        if (mobileMode) setMobileStep('list');
      },
      onDiscard: () => setDiscardTarget(selected.id),
      onRetry: () => retryExtraction(selected.id)
    });
  };
  const desktopBlock = React.createElement('div', {
    className: 'se-air-desktop'
  }, React.createElement(PageHeading, {
    title: 'مراجعة الاستخراج الذكي',
    description: 'راجع القيم المستخرجة قبل تأكيدها كمصروف. لن تُحتسب أي عملية ضمن الأرصدة حتى تأكيدها.'
  }), React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)',
      gap: 16,
      marginTop: 16
    }
  }, React.createElement(InfoCard, {
    title: 'قائمة الانتظار',
    padded: false
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, queue.map(a => queueRow(a, false)))), selected && React.createElement(InfoCard, {
    title: 'تفاصيل العملية'
  }, React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
      gap: 20
    }
  }, React.createElement(ReceiptBlock, {
    file: selected,
    onOpen: () => setViewerFile(selected),
    compact: true
  }), detailForm(false)), selected.status === 'confirmed' && React.createElement(Badge, {
    tone: 'income',
    dot: true,
    style: {
      marginTop: 10
    }
  }, 'تم التأكيد كمصروف'))));
  const mobileListScreen = mobileStep === 'list' && React.createElement(React.Fragment, null, React.createElement(PageHeading, {
    title: 'مراجعة الاستخراج الذكي',
    description: 'راجع القيم المستخرجة قبل تأكيدها كمصروف.'
  }), React.createElement(InfoCard, {
    title: 'قائمة الانتظار',
    padded: false,
    style: {
      marginTop: 16
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, queue.map(a => queueRow(a, true)))));
  const mobileDetailScreen = mobileStep === 'detail' && selected && React.createElement('div', {
    className: 'se-air-detail-screen'
  }, React.createElement('div', {
    className: 'se-air-detail-header'
  }, React.createElement(IconButton, {
    icon: 'arrow-right',
    label: 'رجوع إلى قائمة الانتظار',
    size: 'lg',
    variant: 'ghost',
    onClick: () => setMobileStep('list')
  }), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, React.createElement('div', {
    dir: 'ltr',
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: 'var(--color-text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      unicodeBidi: 'plaintext'
    },
    title: selected.fileName
  }, selected.fileName), React.createElement(StatusBadge, {
    status: selected.status
  }))), React.createElement('div', {
    className: 'se-air-detail-body'
  }, React.createElement(ReceiptBlock, {
    file: selected,
    onOpen: () => setViewerFile(selected),
    compact: true
  }), detailForm(true), selected.status === 'confirmed' && React.createElement(Badge, {
    tone: 'income',
    dot: true,
    style: {
      marginTop: 10
    }
  }, 'تم التأكيد كمصروف')), selected.status !== 'confirmed' && selected.status !== 'discarded' && React.createElement('div', {
    className: 'se-air-detail-footer'
  }, React.createElement('button', {
    type: 'button',
    onClick: () => setDiscardTarget(selected.id),
    className: 'se-focusable se-btn',
    style: {
      flex: 1,
      height: 48,
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: 'var(--color-surface)',
      color: 'var(--color-text)',
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'تجاهل'), React.createElement('button', {
    type: 'button',
    disabled: selected.status === 'failed',
    onClick: () => {
      confirm(selected.id);
      setMobileStep('list');
    },
    className: 'se-focusable se-btn',
    style: {
      flex: 2,
      height: 48,
      borderRadius: 'var(--radius-control)',
      border: 'none',
      background: selected.status === 'failed' ? 'var(--color-border)' : 'var(--color-primary)',
      color: '#fff',
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: selected.status === 'failed' ? 'not-allowed' : 'pointer'
    }
  }, 'تأكيد')));
  const mobileBlock = React.createElement('div', {
    className: 'se-air-mobile'
  }, mobileListScreen, mobileDetailScreen);
  const discardDialog = React.createElement(ConfirmDialog, {
    open: !!discardTarget,
    onClose: () => setDiscardTarget(null),
    onConfirm: () => discard(discardTarget),
    title: 'تجاهل هذه العملية؟',
    description: 'لن تتم إضافة هذه القيم كمصروف. يمكنك إعادة رفع الإيصال لاحقًا.',
    confirmLabel: 'تجاهل'
  });
  const viewerDialog = viewerFile && React.createElement(Dialog, {
    open: true,
    onClose: () => setViewerFile(null),
    title: viewerFile.fileName,
    mobileFullSheet: true,
    size: 420,
    footer: React.createElement('div', null)
  }, React.createElement('div', {
    style: {
      height: 240,
      borderRadius: 'var(--radius-card)',
      background: 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(Icon, {
    name: /\.pdf$/i.test(viewerFile.fileName) ? 'file-text' : 'file-image',
    size: 44,
    color: 'var(--color-text-faint)'
  })));
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, desktopBlock, mobileBlock, discardDialog, viewerDialog);
}
window.AIReviewScreen = AIReviewScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/AIReviewScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/AuthScreen.jsx
try { (() => {
function AuthScreen({
  onSignIn
}) {
  const {
    Input,
    Button,
    Icon
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [loading, setLoading] = React.useState(false);
  const submit = e => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onSignIn();
    }, 700);
  };
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--color-bg)',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('form', {
    onSubmit: submit,
    style: {
      width: 380,
      maxWidth: '92vw',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'var(--shadow-card)',
      padding: 32,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      marginBottom: 4
    }
  }, React.createElement('div', {
    style: {
      width: 44,
      height: 44,
      borderRadius: 10,
      background: 'var(--color-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(Icon, {
    name: 'wallet',
    size: 22,
    color: '#fff'
  })), React.createElement('div', {
    style: {
      fontSize: 18,
      fontWeight: 700,
      color: 'var(--color-text)'
    }
  }, 'Smart Expense'), React.createElement('div', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)'
    }
  }, 'تتبّع مصاريفك بذكاء وبساطة')), React.createElement(Input, {
    label: 'البريد الإلكتروني',
    type: 'email',
    dirOverride: 'ltr',
    placeholder: 'name@example.com',
    required: true
  }), React.createElement(Input, {
    label: 'كلمة المرور',
    type: 'password',
    required: true
  }), React.createElement(Button, {
    type: 'submit',
    fullWidth: true,
    loading: loading
  }, 'تسجيل الدخول'), React.createElement('div', {
    style: {
      textAlign: 'center',
      fontSize: 13,
      color: 'var(--color-text-muted)'
    }
  }, 'ليس لديك حساب؟ ', React.createElement('a', {
    className: 'se-link',
    href: '#'
  }, 'إنشاء حساب جديد'))));
}
window.AuthScreen = AuthScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/AuthScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CategoriesScreen.jsx
try { (() => {
function seedExpenseTree() {
  return [{
    value: 'transport',
    label: 'مواصلات',
    icon: 'car',
    color: '#3B82F6',
    archived: false,
    usedInRecords: true,
    subs: [{
      value: 'fuel',
      label: 'وقود',
      icon: 'fuel',
      archived: false,
      usedInRecords: true
    }, {
      value: 'maintenance',
      label: 'صيانة',
      icon: 'wrench',
      archived: false,
      usedInRecords: false
    }, {
      value: 'taxi',
      label: 'أجرة',
      icon: 'car-taxi-front',
      archived: false,
      usedInRecords: false
    }]
  }, {
    value: 'food',
    label: 'طعام',
    icon: 'utensils',
    color: '#DC2626',
    archived: false,
    usedInRecords: true,
    subs: [{
      value: 'restaurants',
      label: 'مطاعم',
      icon: 'utensils',
      archived: false,
      usedInRecords: true
    }, {
      value: 'cafes',
      label: 'مقاهي',
      icon: 'coffee',
      archived: false,
      usedInRecords: false
    }, {
      value: 'groceries',
      label: 'بقالة',
      icon: 'shopping-cart',
      archived: false,
      usedInRecords: true
    }]
  }, {
    value: 'family',
    label: 'عائلة',
    icon: 'users',
    color: '#8B5CF6',
    archived: false,
    usedInRecords: false,
    subs: [{
      value: 'home',
      label: 'المنزل',
      icon: 'home',
      archived: false,
      usedInRecords: false
    }, {
      value: 'children',
      label: 'الأطفال',
      icon: 'baby',
      archived: false,
      usedInRecords: false
    }, {
      value: 'home-maintenance',
      label: 'صيانة منزلية',
      icon: 'wrench',
      archived: false,
      usedInRecords: false
    }]
  }, {
    value: 'bills',
    label: 'فواتير',
    icon: 'receipt',
    color: '#F59E0B',
    archived: false,
    usedInRecords: true,
    subs: [{
      value: 'electricity',
      label: 'كهرباء',
      icon: 'zap',
      archived: false,
      usedInRecords: true
    }, {
      value: 'telecom',
      label: 'اتصالات',
      icon: 'phone',
      archived: false,
      usedInRecords: false
    }, {
      value: 'internet',
      label: 'إنترنت',
      icon: 'wifi',
      archived: false,
      usedInRecords: false
    }, {
      value: 'gas',
      label: 'غاز',
      icon: 'flame',
      archived: false,
      usedInRecords: false
    }]
  }, {
    value: 'health',
    label: 'صحة',
    icon: 'heart-pulse',
    color: '#0D9488',
    archived: false,
    usedInRecords: true,
    subs: [{
      value: 'pharmacy',
      label: 'صيدلية',
      icon: 'pill',
      archived: false,
      usedInRecords: true
    }, {
      value: 'hospital',
      label: 'مستشفى',
      icon: 'stethoscope',
      archived: false,
      usedInRecords: false
    }]
  }, {
    value: 'delivery-legacy',
    label: 'توصيل طلبات',
    icon: 'package',
    color: '#64748B',
    archived: true,
    usedInRecords: true,
    subs: []
  }];
}
function seedIncomeTree() {
  return [{
    value: 'fixed',
    label: 'دخل ثابت',
    icon: 'wallet',
    color: '#16A34A',
    archived: false,
    usedInRecords: true,
    subs: [{
      value: 'salary',
      label: 'راتب',
      icon: 'banknote',
      archived: false,
      usedInRecords: true
    }, {
      value: 'pension',
      label: 'معاش',
      icon: 'landmark',
      archived: false,
      usedInRecords: false
    }]
  }, {
    value: 'extra',
    label: 'دخل إضافي',
    icon: 'sparkles',
    color: '#0F7A5C',
    archived: false,
    usedInRecords: true,
    subs: [{
      value: 'freelance',
      label: 'عمل حر',
      icon: 'briefcase',
      archived: false,
      usedInRecords: true
    }, {
      value: 'refund',
      label: 'استرداد',
      icon: 'rotate-ccw',
      archived: false,
      usedInRecords: false
    }]
  }, {
    value: 'bonus-legacy',
    label: 'مكافأة قديمة',
    icon: 'gift',
    color: '#64748B',
    archived: true,
    usedInRecords: true,
    subs: []
  }];
}
function CategoriesScreen({
  role
}) {
  const {
    Button,
    Icon,
    IconButton,
    Badge,
    Select,
    DropdownMenu,
    ConfirmDialog
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const canManage = role === 'owner' || role === 'admin';
  const [domain, setDomain] = React.useState('expense');
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [expanded, setExpanded] = React.useState({});
  const [expenseTree, setExpenseTree] = React.useState(seedExpenseTree);
  const [incomeTree, setIncomeTree] = React.useState(seedIncomeTree);
  const [formState, setFormState] = React.useState(null);
  const [archiveTarget, setArchiveTarget] = React.useState(null);
  const [highlight, setHighlight] = React.useState(null);
  React.useEffect(() => {
    if (!highlight) return;
    const t = setTimeout(() => setHighlight(null), 2500);
    return () => clearTimeout(t);
  }, [highlight]);
  const tree = domain === 'expense' ? expenseTree : incomeTree;
  const setTree = domain === 'expense' ? setExpenseTree : setIncomeTree;
  const toggleExpand = v => setExpanded(e => ({
    ...e,
    [v]: !e[v]
  }));
  const getSiblingLabels = (type, parentValue) => {
    const excludeValue = formState && formState.target ? formState.target.value : undefined;
    if (type === 'main') return tree.filter(m => m.value !== excludeValue).map(m => m.label);
    const p = tree.find(m => m.value === parentValue);
    return p ? p.subs.filter(s => s.value !== excludeValue).map(s => s.label) : [];
  };
  const handleSubmit = payload => {
    const setterForDomain = payload.domain === 'expense' ? setExpenseTree : setIncomeTree;
    if (payload.mode === 'add') {
      const newValue = 'custom-' + Date.now();
      if (payload.type === 'main') {
        setterForDomain(prev => [...prev, {
          value: newValue,
          label: payload.label,
          icon: payload.icon,
          color: payload.color,
          archived: false,
          usedInRecords: false,
          subs: []
        }]);
      } else {
        setterForDomain(prev => prev.map(m => m.value === payload.parentValue ? {
          ...m,
          subs: [...m.subs, {
            value: newValue,
            label: payload.label,
            icon: payload.icon,
            archived: false,
            usedInRecords: false
          }]
        } : m));
        setExpanded(e => ({
          ...e,
          [payload.parentValue]: true
        }));
      }
      setHighlight(newValue);
    } else {
      if (payload.type === 'main') {
        setterForDomain(prev => prev.map(m => m.value === payload.value ? {
          ...m,
          label: payload.label,
          icon: payload.icon,
          color: payload.color
        } : m));
      } else {
        setterForDomain(prev => {
          let subData = null;
          const stripped = prev.map(m => ({
            ...m,
            subs: m.subs.filter(s => {
              if (s.value === payload.value) {
                subData = s;
                return false;
              }
              return true;
            })
          }));
          const merged = subData ? {
            ...subData,
            label: payload.label,
            icon: payload.icon
          } : {
            value: payload.value,
            label: payload.label,
            icon: payload.icon,
            archived: false,
            usedInRecords: false
          };
          return stripped.map(m => m.value === payload.parentValue ? {
            ...m,
            subs: [...m.subs, merged]
          } : m);
        });
        setExpanded(e => ({
          ...e,
          [payload.parentValue]: true
        }));
      }
      setHighlight(payload.value);
    }
    setFormState(null);
  };
  const confirmArchive = () => {
    const t = archiveTarget;
    const setter = t.domain === 'expense' ? setExpenseTree : setIncomeTree;
    if (t.type === 'main') setter(prev => prev.map(m => m.value === t.value ? {
      ...m,
      archived: true
    } : m));else setter(prev => prev.map(m => m.value === t.parentValue ? {
      ...m,
      subs: m.subs.map(s => s.value === t.value ? {
        ...s,
        archived: true
      } : s)
    } : m));
    setArchiveTarget(null);
  };
  const restoreCategory = (type, value, parentValue) => {
    if (type === 'main') setTree(prev => prev.map(m => m.value === value ? {
      ...m,
      archived: false
    } : m));else setTree(prev => prev.map(m => m.value === parentValue ? {
      ...m,
      subs: m.subs.map(s => s.value === value ? {
        ...s,
        archived: false
      } : s)
    } : m));
  };
  const q = query.trim();
  const showActive = statusFilter !== 'archived';
  const showArchived = statusFilter !== 'active';
  const activeMains = tree.filter(m => !m.archived && (!q || m.label.includes(q) || m.subs.some(s => s.label.includes(q))));
  const archivedMains = tree.filter(m => m.archived && (!q || m.label.includes(q)));
  const MainCard = m => {
    const isOpen = !!expanded[m.value];
    const isHi = highlight === m.value;
    return React.createElement('div', {
      key: m.value,
      style: {
        border: `1px solid ${isHi ? 'var(--color-primary)' : 'var(--color-border)'}`,
        boxShadow: isHi ? '0 0 0 3px var(--color-primary-subtle)' : 'none',
        borderRadius: 'var(--radius-card)',
        background: 'var(--color-surface)',
        transition: 'box-shadow .3s ease'
      }
    }, React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px'
      }
    }, React.createElement('button', {
      type: 'button',
      onClick: () => toggleExpand(m.value),
      'aria-label': isOpen ? 'طي' : 'توسيع',
      className: 'se-focusable se-row-action'
    }, React.createElement(Icon, {
      name: isOpen ? 'chevron-up' : 'chevron-down',
      size: 16
    })), React.createElement('div', {
      style: {
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: m.color + '1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, React.createElement(Icon, {
      name: m.icon,
      size: 17,
      color: m.color
    })), React.createElement('div', {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, React.createElement('div', {
      style: {
        fontSize: 14.5,
        fontWeight: 700,
        color: 'var(--color-text)',
        fontFamily: 'var(--font-arabic)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }
    }, m.label), React.createElement('div', {
      style: {
        fontSize: 12,
        color: 'var(--color-text-muted)',
        fontFamily: 'var(--font-arabic)'
      }
    }, m.subs.length > 0 ? `${m.subs.length} فئات فرعية` : 'بدون فئات فرعية')), canManage && React.createElement(IconButton, {
      icon: 'pencil',
      label: 'تعديل',
      size: 'sm',
      onClick: () => setFormState({
        mode: 'edit',
        type: 'main',
        domain,
        target: {
          value: m.value,
          label: m.label,
          icon: m.icon,
          color: m.color
        }
      })
    }), canManage && React.createElement(DropdownMenu, {
      align: 'start',
      trigger: React.createElement(IconButton, {
        icon: 'more-vertical',
        label: 'خيارات',
        size: 'sm'
      }),
      items: [{
        label: 'إضافة فئة فرعية',
        onClick: () => setFormState({
          mode: 'add',
          type: 'sub',
          domain,
          target: {
            parentValue: m.value
          }
        })
      }, {
        divider: true
      }, {
        label: 'تعطيل الفئة',
        destructive: true,
        onClick: () => setArchiveTarget({
          domain,
          type: 'main',
          value: m.value,
          label: m.label,
          usedInRecords: m.usedInRecords
        })
      }]
    })), isOpen && React.createElement('div', {
      style: {
        borderTop: '1px solid var(--color-border)',
        padding: '8px 14px 12px',
        paddingInlineStart: 56,
        display: 'flex',
        flexDirection: 'column',
        gap: 4
      }
    }, m.subs.map(s => {
      const isSubHi = highlight === s.value;
      return React.createElement('div', {
        key: s.value,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minHeight: 40,
          opacity: s.archived ? 0.55 : 1,
          borderRadius: 'var(--radius-control)',
          boxShadow: isSubHi ? '0 0 0 2px var(--color-primary-subtle)' : 'none'
        }
      }, React.createElement('div', {
        style: {
          width: 26,
          height: 26,
          borderRadius: '50%',
          background: m.color + '1a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }
      }, React.createElement(Icon, {
        name: s.icon,
        size: 13,
        color: m.color
      })), React.createElement('span', {
        style: {
          flex: 1,
          fontSize: 13.5,
          color: 'var(--color-text)',
          fontFamily: 'var(--font-arabic)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }, s.label), s.archived && React.createElement(Badge, {
        tone: 'neutral'
      }, 'معطلة'), canManage && !s.archived && React.createElement(IconButton, {
        icon: 'pencil',
        label: 'تعديل',
        size: 'sm',
        onClick: () => setFormState({
          mode: 'edit',
          type: 'sub',
          domain,
          target: {
            value: s.value,
            label: s.label,
            icon: s.icon,
            parentValue: m.value
          }
        })
      }), canManage && (s.archived ? React.createElement('button', {
        type: 'button',
        onClick: () => restoreCategory('sub', s.value, m.value),
        className: 'se-focusable se-row-action',
        title: 'استعادة',
        'aria-label': 'استعادة'
      }, React.createElement(Icon, {
        name: 'rotate-ccw',
        size: 14
      })) : React.createElement('button', {
        type: 'button',
        onClick: () => setArchiveTarget({
          domain,
          type: 'sub',
          value: s.value,
          parentValue: m.value,
          label: s.label,
          usedInRecords: s.usedInRecords
        }),
        className: 'se-focusable se-row-action se-row-action-danger',
        title: 'تعطيل',
        'aria-label': 'تعطيل'
      }, React.createElement(Icon, {
        name: 'archive',
        size: 14
      }))));
    }), canManage && React.createElement('button', {
      type: 'button',
      onClick: () => setFormState({
        mode: 'add',
        type: 'sub',
        domain,
        target: {
          parentValue: m.value
        }
      }),
      className: 'se-focusable se-row-hover',
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 36,
        padding: '0 8px',
        border: 'none',
        background: 'none',
        borderRadius: 'var(--radius-control)',
        color: 'var(--color-primary)',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'var(--font-arabic)',
        cursor: 'pointer',
        alignSelf: 'flex-start'
      }
    }, React.createElement(Icon, {
      name: 'plus',
      size: 14
    }), 'إضافة فئة فرعية')));
  };
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', null, React.createElement('h1', {
    style: {
      fontSize: 'var(--text-page-title-size)',
      fontWeight: 'var(--text-page-title-weight)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, 'الفئات'), React.createElement('p', {
    style: {
      fontSize: 14,
      color: 'var(--color-text-muted)',
      margin: '6px 0 0'
    }
  }, 'تنظيم فئات الدخل والمصاريف الرئيسية والفرعية')), canManage && React.createElement(Button, {
    icon: 'plus',
    onClick: () => setFormState({
      mode: 'add',
      type: 'main',
      domain,
      target: null
    })
  }, 'إضافة فئة')), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement('button', {
    type: 'button',
    onClick: () => setDomain('expense'),
    className: 'se-focusable',
    style: {
      flex: '0 1 220px',
      height: 40,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${domain === 'expense' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: domain === 'expense' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      color: domain === 'expense' ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: 600,
      fontSize: 13.5,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'فئات المصاريف'), React.createElement('button', {
    type: 'button',
    onClick: () => setDomain('income'),
    className: 'se-focusable',
    style: {
      flex: '0 1 220px',
      height: 40,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${domain === 'income' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: domain === 'income' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      color: domain === 'income' ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: 600,
      fontSize: 13.5,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'فئات الدخل')), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap',
      alignItems: 'center',
      padding: 12,
      borderRadius: 'var(--radius-card)',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)'
    }
  }, React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      flex: '1 1 220px',
      minWidth: 200
    }
  }, React.createElement(Icon, {
    name: 'search',
    size: 16,
    color: 'var(--color-text-muted)',
    style: {
      position: 'absolute',
      insetInlineStart: 12
    }
  }), React.createElement('input', {
    value: query,
    onChange: e => setQuery(e.target.value),
    placeholder: 'ابحث عن فئة...',
    className: 'se-focusable',
    style: {
      width: '100%',
      height: 40,
      boxSizing: 'border-box',
      padding: '0 40px 0 12px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      fontSize: 14,
      fontFamily: 'var(--font-arabic)',
      color: 'var(--color-text)',
      background: 'var(--color-surface)'
    }
  })), React.createElement('div', {
    style: {
      width: 160
    }
  }, React.createElement(Select, {
    value: statusFilter,
    onChange: e => setStatusFilter(e.target.value),
    options: [{
      value: 'all',
      label: 'الكل'
    }, {
      value: 'active',
      label: 'النشطة'
    }, {
      value: 'archived',
      label: 'المعطلة'
    }]
  }))), showActive && React.createElement('div', {
    className: 'se-cat-grid'
  }, activeMains.map(MainCard), activeMains.length === 0 && React.createElement('div', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-arabic)',
      padding: 20,
      textAlign: 'center',
      gridColumn: '1/-1'
    }
  }, 'لا توجد فئات مطابقة')), showArchived && archivedMains.length > 0 && React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, React.createElement('span', {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'فئات معطّلة (سياق تاريخي)'), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, archivedMains.map(m => React.createElement('div', {
    key: m.value,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      opacity: 0.6,
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      padding: '10px 14px'
    }
  }, React.createElement('div', {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(Icon, {
    name: m.icon,
    size: 15,
    color: 'var(--color-text-muted)'
  })), React.createElement('span', {
    style: {
      flex: 1,
      fontSize: 13.5,
      fontWeight: 600,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, m.label), React.createElement(Badge, {
    tone: 'neutral'
  }, 'معطلة'), canManage && React.createElement(Button, {
    variant: 'ghost',
    size: 'sm',
    icon: 'rotate-ccw',
    onClick: () => restoreCategory('main', m.value)
  }, 'استعادة'))))), formState && React.createElement(window.CategoryFormDialog, {
    open: true,
    domain: formState.domain,
    mode: formState.mode,
    initialType: formState.type,
    target: formState.target,
    mainCategories: (formState.domain === 'expense' ? expenseTree : incomeTree).map(m => ({
      value: m.value,
      label: m.label,
      icon: m.icon,
      color: m.color,
      archived: m.archived
    })),
    getSiblingLabels,
    onClose: () => setFormState(null),
    onSubmit: handleSubmit
  }), archiveTarget && React.createElement(ConfirmDialog, {
    open: true,
    onClose: () => setArchiveTarget(null),
    onConfirm: confirmArchive,
    confirmLabel: 'تعطيل',
    title: `تعطيل «${archiveTarget.label}»؟`,
    description: archiveTarget.usedInRecords ? 'لا يمكن حذف هذه الفئة نهائيًا لأنها مستخدمة في سجلات مالية سابقة. يمكنك تعطيلها، وستبقى ظاهرة في السجلات القديمة.' : 'سيتم تعطيل هذه الفئة ولن تكون متاحة لسجلات جديدة. يمكنك استعادتها لاحقًا.'
  }));
}
window.CategoriesScreen = CategoriesScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CategoriesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/CategoryFormDialog.jsx
try { (() => {
const ICON_GROUPS = [{
  key: 'food',
  label: 'طعام',
  icons: ['utensils', 'coffee', 'pizza', 'apple', 'shopping-basket']
}, {
  key: 'transport',
  label: 'مواصلات',
  icons: ['car', 'bus', 'bike', 'plane', 'car-taxi-front', 'fuel', 'train-front']
}, {
  key: 'home',
  label: 'منزل',
  icons: ['home', 'lamp', 'sofa', 'wrench', 'key-round']
}, {
  key: 'bills',
  label: 'فواتير',
  icons: ['receipt', 'zap', 'wifi', 'phone', 'flame', 'file-text']
}, {
  key: 'health',
  label: 'صحة',
  icons: ['heart-pulse', 'pill', 'stethoscope', 'thermometer']
}, {
  key: 'shopping',
  label: 'تسوق',
  icons: ['shopping-cart', 'shopping-bag', 'gift', 'shirt']
}, {
  key: 'family',
  label: 'عائلة',
  icons: ['users', 'baby', 'dog', 'cat', 'heart']
}, {
  key: 'education',
  label: 'تعليم',
  icons: ['book-open', 'graduation-cap', 'pencil', 'backpack']
}, {
  key: 'entertainment',
  label: 'ترفيه',
  icons: ['gamepad-2', 'music', 'film', 'tv', 'palette']
}, {
  key: 'work',
  label: 'عمل ودخل',
  icons: ['briefcase', 'wallet', 'banknote', 'trending-up', 'landmark']
}, {
  key: 'other',
  label: 'أخرى',
  icons: ['more-horizontal', 'tag', 'star', 'archive', 'sparkles']
}];
const COLOR_PALETTE = ['#3B82F6', '#0F7A5C', '#DC2626', '#F59E0B', '#8B5CF6', '#0D9488', '#DB2777', '#64748B'];
function IconColorSheet({
  open,
  icon,
  color,
  showColor,
  onClose,
  onConfirm
}) {
  const {
    IconButton,
    Icon
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [q, setQ] = React.useState('');
  const [pendingIcon, setPendingIcon] = React.useState(icon || 'tag');
  const [pendingColor, setPendingColor] = React.useState(color || COLOR_PALETTE[0]);
  React.useEffect(() => {
    if (open) {
      setPendingIcon(icon || 'tag');
      setPendingColor(color || COLOR_PALETTE[0]);
      setQ('');
    }
  }, [open, icon, color]);
  if (!open) return null;
  const groups = ICON_GROUPS.map(g => ({
    ...g,
    icons: g.icons.filter(i => !q.trim() || i.includes(q.trim().toLowerCase()))
  })).filter(g => g.icons.length > 0);
  return React.createElement('div', {
    className: 'se-picker-overlay',
    style: {
      zIndex: 220
    },
    onClick: onClose
  }, React.createElement('div', {
    className: 'se-picker-panel',
    dir: 'rtl',
    role: 'dialog',
    'aria-modal': true,
    onClick: e => e.stopPropagation()
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '16px 12px 12px 16px',
      borderBottom: '1px solid var(--color-border)',
      flexShrink: 0
    }
  }, React.createElement('span', {
    style: {
      fontSize: 17,
      fontWeight: 700,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'اختر أيقونة'), React.createElement(IconButton, {
    icon: 'x',
    label: 'إغلاق',
    size: 'lg',
    onClick: onClose
  })), React.createElement('div', {
    style: {
      padding: '12px 16px 0'
    }
  }, React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, React.createElement(Icon, {
    name: 'search',
    size: 16,
    color: 'var(--color-text-muted)',
    style: {
      position: 'absolute',
      insetInlineStart: 12
    }
  }), React.createElement('input', {
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: 'ابحث عن أيقونة...',
    className: 'se-focusable',
    style: {
      width: '100%',
      height: 44,
      boxSizing: 'border-box',
      padding: '0 40px 0 12px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      fontSize: 14,
      fontFamily: 'var(--font-arabic)',
      color: 'var(--color-text)',
      background: 'var(--color-surface)'
    }
  }))), React.createElement('div', {
    style: {
      padding: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0
    }
  }, React.createElement('div', {
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: pendingColor + '1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(Icon, {
    name: pendingIcon,
    size: 22,
    color: pendingColor
  })), React.createElement('span', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'معاينة الأيقونة واللون المختارَين')), showColor && React.createElement('div', {
    style: {
      padding: '0 16px 12px',
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      flexShrink: 0
    }
  }, COLOR_PALETTE.map(c => React.createElement('button', {
    key: c,
    type: 'button',
    onClick: () => setPendingColor(c),
    'aria-label': c,
    className: 'se-focusable',
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: c,
      border: pendingColor === c ? '3px solid var(--color-text)' : '1px solid var(--color-border)',
      cursor: 'pointer',
      padding: 0
    }
  }))), React.createElement('div', {
    className: 'se-scrollbar',
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 16px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, groups.length === 0 && React.createElement('span', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'لا توجد نتائج'), groups.map(g => React.createElement('div', {
    key: g.key
  }, React.createElement('div', {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-arabic)',
      marginBottom: 8
    }
  }, g.label), React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill,44px)',
      gap: 8
    }
  }, g.icons.map(ic => React.createElement('button', {
    key: ic,
    type: 'button',
    onClick: () => setPendingIcon(ic),
    'aria-label': ic,
    className: 'se-focusable',
    style: {
      width: 44,
      height: 44,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${pendingIcon === ic ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: pendingIcon === ic ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer'
    }
  }, React.createElement(Icon, {
    name: ic,
    size: 18,
    color: pendingIcon === ic ? 'var(--color-primary)' : 'var(--color-text-muted)'
  }))))))), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 10,
      padding: 16,
      borderTop: '1px solid var(--color-border)',
      flexShrink: 0
    }
  }, React.createElement('button', {
    type: 'button',
    onClick: onClose,
    className: 'se-focusable se-btn',
    style: {
      flex: 1,
      height: 44,
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: 'var(--color-surface)',
      color: 'var(--color-text)',
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'إلغاء'), React.createElement('button', {
    type: 'button',
    onClick: () => onConfirm(pendingIcon, pendingColor),
    className: 'se-focusable se-btn',
    style: {
      flex: 1,
      height: 44,
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-primary)',
      background: 'var(--color-primary)',
      color: '#fff',
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'تأكيد'))));
}
function CategoryFormDialog({
  open,
  domain,
  mode = 'add',
  initialType = 'main',
  target,
  mainCategories = [],
  getSiblingLabels,
  onClose,
  onSubmit
}) {
  const {
    Dialog,
    Button,
    Icon,
    Badge
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const isEdit = mode === 'edit';
  const [type, setType] = React.useState(initialType);
  const [domainLocal, setDomainLocal] = React.useState(domain);
  const [parentValue, setParentValue] = React.useState(target && target.parentValue ? target.parentValue : mainCategories[0] ? mainCategories[0].value : '');
  const [parentQuery, setParentQuery] = React.useState('');
  const [name, setName] = React.useState(target ? target.label : '');
  const [icon, setIcon] = React.useState(target ? target.icon : 'tag');
  const [color, setColor] = React.useState(target && target.color || COLOR_PALETTE[0]);
  const [iconSheetOpen, setIconSheetOpen] = React.useState(false);
  const [error, setError] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  React.useEffect(() => {
    if (!open) return;
    setType(initialType);
    setDomainLocal(domain);
    setParentValue(target && target.parentValue ? target.parentValue : mainCategories[0] ? mainCategories[0].value : '');
    setParentQuery('');
    setName(target ? target.label : '');
    setIcon(target ? target.icon : 'tag');
    setColor(target && target.color || COLOR_PALETTE[0]);
    setError('');
    setSaving(false);
    setSuccess(false);
  }, [open, mode, initialType, target, domain]);
  if (!open) return null;
  const eligibleParents = mainCategories.filter(m => !m.archived && (!parentQuery.trim() || m.label.includes(parentQuery.trim())));
  const parent = mainCategories.find(m => m.value === parentValue);
  const save = () => {
    if (saving || success) return;
    const trimmed = name.trim();
    if (!trimmed) return setError(type === 'main' ? 'اسم الفئة الرئيسية مطلوب.' : 'اسم الفئة الفرعية مطلوب.');
    if (type === 'sub' && !parentValue) return setError('يرجى اختيار الفئة الرئيسية.');
    const siblings = getSiblingLabels ? getSiblingLabels(type, type === 'sub' ? parentValue : null) : [];
    if (siblings.includes(trimmed)) return setError('يوجد اسم مطابق ضمن هذا المستوى بالفعل.');
    setError('');
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => {
        onSubmit({
          mode,
          type,
          domain: domainLocal,
          value: target ? target.value : undefined,
          label: trimmed,
          icon,
          color: type === 'main' ? color : undefined,
          parentValue: type === 'sub' ? parentValue : undefined
        });
      }, 450);
    }, 600);
  };
  return React.createElement(React.Fragment, null, React.createElement(Dialog, {
    open,
    onClose,
    size: 540,
    mobileFullSheet: true,
    title: isEdit ? type === 'main' ? 'تعديل فئة رئيسية' : 'تعديل فئة فرعية' : type === 'main' ? 'إضافة فئة رئيسية' : 'إضافة فئة فرعية',
    description: isEdit ? undefined : 'الفئات الهرمية للمصاريف والدخل',
    footer: React.createElement(React.Fragment, null, React.createElement(Button, {
      variant: 'secondary',
      onClick: onClose,
      disabled: saving
    }, 'إلغاء'), React.createElement(Button, {
      onClick: save,
      loading: saving
    }, type === 'main' ? 'إضافة الفئة' : 'إضافة الفئة الفرعية'))
  }, success ? React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      padding: '24px 0',
      textAlign: 'center'
    }
  }, React.createElement('div', {
    style: {
      width: 48,
      height: 48,
      borderRadius: '50%',
      background: 'var(--color-income-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(Icon, {
    name: 'check-circle-2',
    size: 26,
    color: 'var(--color-income)'
  })), React.createElement('span', {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'تم حفظ الفئة بنجاح')) : React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, !isEdit && React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('span', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'نوع الفئة'), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement('button', {
    type: 'button',
    onClick: () => setType('main'),
    className: 'se-focusable',
    style: {
      flex: 1,
      height: 44,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${type === 'main' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: type === 'main' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      color: type === 'main' ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'فئة رئيسية'), React.createElement('button', {
    type: 'button',
    onClick: () => setType('sub'),
    className: 'se-focusable',
    style: {
      flex: 1,
      height: 44,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${type === 'sub' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: type === 'sub' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      color: type === 'sub' ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'فئة فرعية'))), !isEdit && React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('span', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'نوع البيانات'), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement('button', {
    type: 'button',
    onClick: () => setDomainLocal('expense'),
    className: 'se-focusable',
    style: {
      flex: 1,
      height: 40,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${domainLocal === 'expense' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: domainLocal === 'expense' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      color: domainLocal === 'expense' ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'مصروف'), React.createElement('button', {
    type: 'button',
    onClick: () => setDomainLocal('income'),
    className: 'se-focusable',
    style: {
      flex: 1,
      height: 40,
      borderRadius: 'var(--radius-control)',
      border: `1px solid ${domainLocal === 'income' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
      background: domainLocal === 'income' ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
      color: domainLocal === 'income' ? 'var(--color-primary)' : 'var(--color-text)',
      fontWeight: 600,
      fontSize: 13,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'دخل'))), type === 'sub' && React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('span', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'الفئة الرئيسية', React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, React.createElement(Icon, {
    name: 'search',
    size: 15,
    color: 'var(--color-text-muted)',
    style: {
      position: 'absolute',
      insetInlineStart: 12
    }
  }), React.createElement('input', {
    value: parentQuery,
    onChange: e => setParentQuery(e.target.value),
    placeholder: 'ابحث عن الفئة الرئيسية...',
    className: 'se-focusable',
    style: {
      width: '100%',
      height: 40,
      boxSizing: 'border-box',
      padding: '0 36px 0 12px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      fontSize: 13,
      fontFamily: 'var(--font-arabic)',
      color: 'var(--color-text)',
      background: 'var(--color-surface)'
    }
  })), React.createElement('div', {
    className: 'se-scrollbar',
    style: {
      maxHeight: 150,
      overflowY: 'auto',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-control)',
      padding: 4,
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, eligibleParents.length === 0 && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)',
      padding: 8,
      fontFamily: 'var(--font-arabic)'
    }
  }, 'لا توجد نتائج'), eligibleParents.map(m => React.createElement('button', {
    key: m.value,
    type: 'button',
    onClick: () => setParentValue(m.value),
    className: `se-focusable se-cat-row ${parentValue === m.value ? 'se-cat-selected' : ''}`
  }, React.createElement('div', {
    style: {
      width: 26,
      height: 26,
      borderRadius: '50%',
      background: m.color + '1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(Icon, {
    name: m.icon,
    size: 13,
    color: m.color
  })), React.createElement('span', {
    style: {
      flex: 1,
      fontSize: 13.5,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)',
      textAlign: 'start'
    }
  }, m.label), parentValue === m.value && React.createElement(Icon, {
    name: 'check',
    size: 15,
    color: 'var(--color-primary)'
  }))))), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('label', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, type === 'main' ? 'اسم الفئة الرئيسية' : 'اسم الفئة الفرعية', React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('input', {
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: type === 'main' ? 'مثال: ترفيه' : 'مثال: وقود',
    className: 'se-focusable',
    style: {
      width: '100%',
      height: 44,
      boxSizing: 'border-box',
      padding: '0 12px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      fontSize: 14,
      fontFamily: 'var(--font-arabic)',
      color: 'var(--color-text)',
      background: 'var(--color-surface)'
    }
  })), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('label', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'الأيقونة', type === 'main' && ' واللون', React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), React.createElement('button', {
    type: 'button',
    onClick: () => setIconSheetOpen(true),
    className: 'se-focusable',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      height: 52,
      boxSizing: 'border-box',
      padding: '0 12px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: 'var(--color-surface)',
      cursor: 'pointer',
      textAlign: 'start'
    }
  }, React.createElement('div', {
    style: {
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: (type === 'main' ? color : parent ? parent.color : color) + '1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(Icon, {
    name: icon,
    size: 16,
    color: type === 'main' ? color : parent ? parent.color : color
  })), React.createElement('span', {
    style: {
      flex: 1,
      fontSize: 14,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'تغيير الأيقونة' + (type === 'main' ? ' واللون' : '')), React.createElement(Icon, {
    name: 'chevron-down',
    size: 14,
    color: 'var(--color-text-muted)'
  }))), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('span', {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-arabic)'
    }
  }, 'المعاينة'), React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 'var(--radius-card)',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface-sunken)'
    }
  }, React.createElement('div', {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: (type === 'main' ? color : parent ? parent.color : color) + '1a',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(Icon, {
    name: icon,
    size: 17,
    color: type === 'main' ? color : parent ? parent.color : color
  })), React.createElement('span', {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, type === 'sub' ? `${parent ? parent.label : ''} ← ${name || '...'}` : name || '...'))), error && React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-expense)',
      fontFamily: 'var(--font-arabic)'
    }
  }, error))), React.createElement(IconColorSheet, {
    open: iconSheetOpen,
    icon,
    color,
    showColor: type === 'main',
    onClose: () => setIconSheetOpen(false),
    onConfirm: (i, c) => {
      setIcon(i);
      if (type === 'main') setColor(c);
      setIconSheetOpen(false);
    }
  }));
}
window.CategoryFormDialog = CategoryFormDialog;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/CategoryFormDialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/DashboardScreen.jsx
try { (() => {
function DashboardScreen({
  role,
  onNavigate,
  onAddExpense,
  onAddIncome,
  onUploadReceipt,
  emptyMode,
  loadingMode,
  lang = 'ar'
}) {
  const {
    SummaryCard,
    InfoCard,
    Button,
    Badge,
    StatusBadge,
    Chart,
    EmptyState,
    Skeleton,
    MobileRecordCard
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const {
    expenseRecords,
    incomeRecords,
    categories,
    aiQueue
  } = window.SEMockData;
  const isEn = lang === 'en';
  const dir = isEn ? 'ltr' : 'rtl';
  const currency = isEn ? 'SAR' : 'ر.س';
  const catEn = {
    'بقالة': 'Groceries',
    'مواصلات': 'Transport',
    'سكن': 'Housing',
    'طعام': 'Dining',
    'مطاعم': 'Dining',
    'صحة': 'Health',
    'أخرى': 'Other',
    'دخل ثابت': 'Fixed income',
    'دخل إضافي': 'Extra income'
  };
  const catLabel = c => isEn ? catEn[c] || c : c;
  const t = isEn ? {
    balance: 'Remaining balance — July 2026',
    balanceEmpty: 'No data for this month yet',
    trend: 'After 5,080.00 SAR in expenses',
    income: 'Total income',
    expense: 'Total expenses',
    addExpense: 'Add expense',
    addIncome: 'Add income',
    uploadReceipt: 'Upload receipt',
    reviewN: n => `Review ${n} extracted item${n === 1 ? '' : 's'}`,
    recent: 'Recent activity',
    viewAll: 'View all',
    emptyRecentTitle: 'No transactions yet',
    emptyRecentDesc: 'Add your first expense or income to start tracking your budget.',
    breakdown: 'Category breakdown',
    emptyBreakdown: 'No breakdown yet',
    pendingReview: 'Pending review',
    openQueue: 'Open review queue'
  } : {
    balance: 'الرصيد المتبقي — يوليو 2026',
    balanceEmpty: 'لا توجد بيانات لهذا الشهر بعد',
    trend: 'بعد 5,080.00 ر.س من المصاريف',
    income: 'إجمالي الدخل',
    expense: 'إجمالي المصاريف',
    addExpense: 'إضافة مصروف',
    addIncome: 'إضافة دخل',
    uploadReceipt: 'رفع إيصال',
    reviewN: n => `مراجعة ${n} عملية مستخرجة`,
    recent: 'أحدث العمليات',
    viewAll: 'عرض الكل',
    emptyRecentTitle: 'لا توجد عمليات بعد',
    emptyRecentDesc: 'أضف أول مصروف أو دخل لبدء تتبع ميزانيتك.',
    breakdown: 'التوزيع حسب الفئة',
    emptyBreakdown: 'لا يوجد توزيع بعد',
    pendingReview: 'قيد انتظار المراجعة',
    openQueue: 'فتح قائمة المراجعة'
  };
  const canAddIncome = role !== 'viewer' && role !== 'member';
  const recent = emptyMode ? [] : [...expenseRecords.slice(0, 3).map(r => ({
    ...r,
    kind: 'expense'
  })), ...incomeRecords.slice(0, 2).map(r => ({
    ...r,
    kind: 'income'
  }))].sort((a, b) => b.date.localeCompare(a.date));
  const catData = categories.slice(0, 4).map((c, i) => ({
    label: catLabel(c.label),
    value: [420, 260, 610, 130][i],
    color: c.color
  }));
  return React.createElement('div', {
    dir,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 20
    }
  }, React.createElement('div', {
    className: 'se-summary-grid',
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)',
      gap: 14
    }
  }, React.createElement(SummaryCard, {
    dir,
    currency,
    label: t.balance,
    amount: emptyMode ? '0.00' : '3,420.00',
    icon: 'wallet',
    emphasis: true,
    trend: emptyMode ? t.balanceEmpty : t.trend
  }), React.createElement(SummaryCard, {
    dir,
    currency,
    label: t.income,
    amount: emptyMode ? '0.00' : '8,500.00',
    kind: 'income',
    icon: 'trending-up'
  }), React.createElement(SummaryCard, {
    dir,
    currency,
    label: t.expense,
    amount: emptyMode ? '0.00' : '5,080.00',
    kind: 'expense',
    icon: 'trending-down'
  })), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement(Button, {
    icon: 'plus',
    onClick: onAddExpense
  }, t.addExpense), canAddIncome && React.createElement(Button, {
    variant: 'secondary',
    icon: 'plus',
    onClick: onAddIncome
  }, t.addIncome), React.createElement(Button, {
    variant: 'secondary',
    icon: 'upload',
    onClick: onUploadReceipt
  }, t.uploadReceipt), aiQueue.filter(a => a.status === 'ready').length > 0 && React.createElement(Button, {
    variant: 'ghost',
    icon: 'sparkles',
    onClick: () => onNavigate('ai-review')
  }, t.reviewN(aiQueue.filter(a => a.status === 'ready').length))), React.createElement('div', {
    className: 'se-two-col',
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)',
      gap: 14
    }
  }, React.createElement(InfoCard, {
    dir,
    title: t.recent,
    actions: React.createElement(Button, {
      variant: 'ghost',
      size: 'sm',
      onClick: () => onNavigate('expenses')
    }, t.viewAll)
  }, loadingMode ? React.createElement(Skeleton, {
    variant: 'row',
    count: 4
  }) : recent.length === 0 ? React.createElement(EmptyState, {
    dir,
    icon: 'receipt',
    title: t.emptyRecentTitle,
    description: t.emptyRecentDesc,
    actionLabel: t.addExpense,
    onAction: onAddExpense
  }) : React.createElement(React.Fragment, null, React.createElement('div', {
    className: 'se-desktop-table',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, recent.map(r => React.createElement('div', {
    key: r.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingBottom: 10,
      borderBottom: '1px solid var(--color-border)'
    }
  }, React.createElement('div', null, React.createElement('div', {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--color-text)'
    }
  }, r.title), React.createElement('div', {
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)',
      display: 'flex',
      gap: 6
    }
  }, catLabel(r.category), React.createElement('span', null, '•'), React.createElement('span', {
    dir: 'ltr'
  }, r.date))), React.createElement('span', {
    dir: 'ltr',
    style: {
      fontWeight: 700,
      color: r.kind === 'income' ? 'var(--color-income)' : 'var(--color-expense)',
      fontFeatureSettings: "'tnum' 1"
    }
  }, `${r.kind === 'income' ? '+' : '-'}${r.amount} ${currency}`)))), React.createElement('div', {
    className: 'se-mobile-cards',
    style: {
      display: 'none',
      flexDirection: 'column',
      gap: 10
    }
  }, recent.map(r => React.createElement(MobileRecordCard, {
    key: r.id,
    currency,
    icon: r.icon || (r.kind === 'income' ? 'banknote' : 'shopping-cart'),
    title: r.title,
    category: catLabel(r.category),
    date: r.date,
    amount: r.amount,
    kind: r.kind
  }))))), React.createElement(InfoCard, {
    dir,
    title: t.breakdown
  }, loadingMode ? React.createElement(Skeleton, {
    variant: 'card'
  }) : emptyMode ? React.createElement(EmptyState, {
    dir,
    icon: 'pie-chart',
    title: t.emptyBreakdown
  }) : React.createElement(Chart, {
    type: 'donut',
    data: catData,
    height: 160
  }))), !emptyMode && aiQueue.some(a => a.status === 'ready' || a.status === 'failed') && React.createElement(InfoCard, {
    dir,
    title: t.pendingReview,
    actions: React.createElement(Button, {
      variant: 'ghost',
      size: 'sm',
      onClick: () => onNavigate('ai-review')
    }, t.openQueue)
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, aiQueue.filter(a => a.status === 'ready' || a.status === 'failed').map(a => React.createElement('div', {
    key: a.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      minHeight: 44
    }
  }, React.createElement('span', {
    dir: 'ltr',
    style: {
      fontSize: 13,
      color: 'var(--color-text)',
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, a.fileName), React.createElement(StatusBadge, {
    status: a.status,
    lang
  }))))));
}
window.DashboardScreen = DashboardScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/EnglishShellScreen.jsx
try { (() => {
function EnglishShellScreen({
  onBackToArabic
}) {
  const {
    Sidebar,
    MobileNav,
    TopHeader,
    Toast
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [screen, setScreen] = React.useState('dashboard');
  const [formDialog, setFormDialog] = React.useState(false);
  const [toast, setToast] = React.useState(null);
  const notify = title => {
    setToast({
      title
    });
    setTimeout(() => setToast(null), 3200);
  };
  const nav = key => key === 'income' || key === 'expenses' || key === 'dashboard' ? setScreen(key) : null;
  const header = React.createElement(TopHeader, {
    lang: 'en',
    onLangChange: l => {
      if (l === 'ar') onBackToArabic();
    },
    user: {
      name: 'Sara Al-Otaibi',
      role: 'Owner'
    },
    workspace: {
      name: 'Al-Otaibi Family',
      type: 'Family'
    },
    workspaces: [{
      name: 'My Personal Space',
      type: 'Personal'
    }]
  });
  if (screen === 'income' || screen === 'expenses') {
    return React.createElement('div', {
      dir: 'ltr',
      style: {
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--color-bg)',
        fontFamily: 'var(--font-arabic)'
      }
    }, React.createElement('div', {
      className: 'se-sidebar'
    }, React.createElement(Sidebar, {
      active: screen,
      onNavigate: nav,
      lang: 'en',
      dir: 'ltr',
      workspaceName: 'Al-Otaibi Family'
    })), React.createElement('div', {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column'
      }
    }, header, React.createElement('div', {
      className: 'se-app-main',
      style: {
        flex: 1,
        padding: 24,
        overflowY: 'auto'
      }
    }, React.createElement(window.RecordsScreen, {
      kind: screen === 'income' ? 'income' : 'expense',
      role: 'owner',
      lang: 'en',
      onAdd: () => screen === 'income' && setFormDialog(true),
      onDeleteRequest: () => {}
    }))), React.createElement('div', {
      className: 'se-mobile-nav'
    }, React.createElement(MobileNav, {
      active: screen,
      onNavigate: nav,
      lang: 'en',
      dir: 'ltr'
    })), React.createElement(window.RecordFormDialog, {
      open: formDialog,
      kind: 'income',
      role: 'owner',
      lang: 'en',
      onClose: () => setFormDialog(false),
      onSave: () => {
        notify('Income saved');
        setFormDialog(false);
      }
    }), toast && React.createElement('div', {
      style: {
        position: 'fixed',
        top: 20,
        insetInlineStart: 20,
        zIndex: 300
      }
    }, React.createElement(Toast, {
      tone: 'success',
      title: toast.title,
      onClose: () => setToast(null)
    })));
  }
  return React.createElement('div', {
    dir: 'ltr',
    style: {
      display: 'flex',
      minHeight: '100vh',
      background: 'var(--color-bg)',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    className: 'se-sidebar'
  }, React.createElement(Sidebar, {
    active: 'dashboard',
    onNavigate: nav,
    lang: 'en',
    dir: 'ltr',
    workspaceName: 'Al-Otaibi Family'
  })), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, header, React.createElement('div', {
    className: 'se-app-main',
    style: {
      flex: 1,
      padding: 24,
      overflowY: 'auto',
      minHeight: 0
    }
  }, React.createElement(window.DashboardScreen, {
    role: 'owner',
    lang: 'en',
    onNavigate: nav,
    onAddExpense: () => {},
    onAddIncome: () => {},
    onUploadReceipt: () => {}
  }))), React.createElement('div', {
    className: 'se-mobile-nav'
  }, React.createElement(MobileNav, {
    active: 'dashboard',
    onNavigate: nav,
    lang: 'en',
    dir: 'ltr'
  })));
}
window.EnglishShellScreen = EnglishShellScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/EnglishShellScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/FilesScreen.jsx
try { (() => {
const STATUS_META = {
  processing: {
    tone: 'info',
    label: 'قيد المعالجة'
  },
  ready: {
    tone: 'warning',
    label: 'جاهز للمراجعة'
  },
  confirmed: {
    tone: 'income',
    label: 'مؤكَّد'
  },
  failed: {
    tone: 'expense',
    label: 'فشل'
  }
};
function FileThumb({
  file,
  size
}) {
  const {
    Icon
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const isPdf = file.fileType === 'pdf';
  return React.createElement('div', {
    style: {
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: 'var(--radius-control)',
      background: isPdf ? 'var(--color-expense-subtle)' : 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden'
    }
  }, React.createElement(Icon, {
    name: isPdf ? 'file-text' : 'file-image',
    size: Math.round(size * 0.4),
    color: isPdf ? 'var(--color-expense)' : 'var(--color-text-faint)'
  }));
}
function FilesScreen({
  onUpload,
  loadingMode,
  emptyMode,
  errorMode
}) {
  const {
    PageHeading,
    Button,
    Icon,
    IconButton,
    Badge,
    StatusBadge,
    EmptyState,
    Dialog,
    ConfirmDialog,
    DropdownMenu,
    Select,
    DateField,
    Skeleton
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [files, setFiles] = React.useState(window.SEMockData.files);
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('all');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState('');
  const [draft, setDraft] = React.useState({
    status: 'all',
    type: 'all',
    date: ''
  });
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [previewFile, setPreviewFile] = React.useState(null);
  const [actionSheetFile, setActionSheetFile] = React.useState(null);
  const [deleteTarget, setDeleteTarget] = React.useState(null);
  const [retryLoading, setRetryLoading] = React.useState(null);
  const statusOptions = [{
    value: 'all',
    label: 'جميع الحالات'
  }, {
    value: 'processing',
    label: 'قيد المعالجة'
  }, {
    value: 'ready',
    label: 'جاهز للمراجعة'
  }, {
    value: 'confirmed',
    label: 'مؤكد'
  }, {
    value: 'failed',
    label: 'فشل'
  }];
  const typeOptions = [{
    value: 'all',
    label: 'جميع الملفات'
  }, {
    value: 'image',
    label: 'الصور'
  }, {
    value: 'pdf',
    label: 'PDF'
  }];
  const filtered = files.filter(f => f.fileName.toLowerCase().includes(query.trim().toLowerCase()) && (statusFilter === 'all' || f.status === statusFilter) && (typeFilter === 'all' || f.fileType === typeFilter) && (!dateFilter || f.date === dateFilter));
  const activeChips = [statusFilter !== 'all' && {
    key: 'status',
    label: statusOptions.find(o => o.value === statusFilter).label,
    clear: () => setStatusFilter('all')
  }, typeFilter !== 'all' && {
    key: 'type',
    label: typeOptions.find(o => o.value === typeFilter).label,
    clear: () => setTypeFilter('all')
  }, dateFilter && {
    key: 'date',
    label: dateFilter,
    clear: () => setDateFilter('')
  }].filter(Boolean);
  const openFilterSheet = () => {
    setDraft({
      status: statusFilter,
      type: typeFilter,
      date: dateFilter
    });
    setFilterSheetOpen(true);
  };
  const applyFilters = () => {
    setStatusFilter(draft.status);
    setTypeFilter(draft.type);
    setDateFilter(draft.date);
    setFilterSheetOpen(false);
  };
  const clearFilters = () => {
    setStatusFilter('all');
    setTypeFilter('all');
    setDateFilter('');
    setDraft({
      status: 'all',
      type: 'all',
      date: ''
    });
    setFilterSheetOpen(false);
  };
  const retryFile = f => {
    setRetryLoading(f.id);
    setFiles(prev => prev.map(x => x.id === f.id ? {
      ...x,
      status: 'processing'
    } : x));
    setTimeout(() => {
      setFiles(prev => prev.map(x => x.id === f.id ? {
        ...x,
        status: 'ready'
      } : x));
      setRetryLoading(null);
    }, 1200);
  };
  const confirmDelete = () => {
    setFiles(prev => prev.filter(x => x.id !== deleteTarget.id));
    setDeleteTarget(null);
  };
  const menuItems = (f, close) => {
    const items = [{
      label: 'معاينة الملف',
      onClick: () => {
        setPreviewFile(f);
        close && close();
      }
    }];
    if (f.linkedTitle) items.push({
      label: 'فتح المصروف المرتبط',
      onClick: close
    });else if (f.status === 'ready' || f.status === 'confirmed') items.push({
      label: 'ربط الملف بمصروف',
      onClick: close
    });
    if (f.status === 'ready') items.push({
      label: 'مراجعة نتيجة الاستخراج',
      onClick: close
    });
    if (f.status === 'failed') items.push({
      label: 'إعادة المحاولة',
      onClick: () => {
        retryFile(f);
        close && close();
      }
    });
    items.push({
      divider: true
    }, {
      label: 'حذف الملف',
      destructive: true,
      onClick: () => {
        setDeleteTarget(f);
        close && close();
      }
    });
    return items;
  };
  const linkLabel = f => f.linkedTitle ? `مرتبط بـ ${f.linkedTitle}` : 'غير مرتبط';
  const DesktopCard = f => React.createElement('div', {
    key: f.id,
    style: {
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      background: 'var(--color-surface)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, React.createElement('div', {
    onClick: () => setPreviewFile(f),
    style: {
      cursor: 'pointer',
      height: 108,
      borderRadius: 'var(--radius-card) var(--radius-card) 0 0',
      background: f.fileType === 'pdf' ? 'var(--color-expense-subtle)' : 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(Icon, {
    name: f.fileType === 'pdf' ? 'file-text' : 'file-image',
    size: 30,
    color: f.fileType === 'pdf' ? 'var(--color-expense)' : 'var(--color-text-faint)'
  })), React.createElement('div', {
    style: {
      padding: '10px 12px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 6
    }
  }, React.createElement('span', {
    dir: 'ltr',
    title: f.fileName,
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: 'var(--color-text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      minWidth: 0
    }
  }, f.fileName), React.createElement(DropdownMenu, {
    align: 'end',
    trigger: React.createElement(IconButton, {
      icon: 'more-vertical',
      label: 'خيارات',
      size: 'sm'
    }),
    items: menuItems(f)
  })), React.createElement('span', {
    dir: 'ltr',
    style: {
      fontSize: 11,
      color: 'var(--color-text-muted)'
    }
  }, `${f.date} · ${f.size}`), React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6
    }
  }, React.createElement(StatusBadge, {
    status: f.status
  }), f.status === 'failed' ? React.createElement('button', {
    type: 'button',
    onClick: () => retryFile(f),
    disabled: retryLoading === f.id,
    className: 'se-focusable',
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--color-expense)',
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, retryLoading === f.id ? 'جارٍ إعادة المحاولة...' : 'إعادة المحاولة') : f.status === 'ready' ? React.createElement('button', {
    type: 'button',
    onClick: () => setPreviewFile(f),
    className: 'se-focusable',
    style: {
      border: 'none',
      background: 'none',
      color: 'var(--color-primary)',
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer'
    }
  }, 'مراجعة النتيجة') : React.createElement('span', {
    style: {
      fontSize: 11,
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-arabic)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, linkLabel(f)))));
  const MobileCard = f => React.createElement('div', {
    key: f.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minHeight: 76,
      padding: '10px 12px',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      background: 'var(--color-surface)'
    }
  }, React.createElement('div', {
    onClick: () => setPreviewFile(f)
  }, React.createElement(FileThumb, {
    file: f,
    size: 56
  })), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 4
    }
  }, React.createElement('span', {
    dir: 'ltr',
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: 'var(--color-text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, f.fileName), React.createElement('span', {
    dir: 'ltr',
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)'
    }
  }, `${f.date} · ${f.size}`), React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, React.createElement(StatusBadge, {
    status: f.status
  }), React.createElement('span', {
    style: {
      fontSize: 11,
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-arabic)'
    }
  }, linkLabel(f)))), React.createElement('button', {
    type: 'button',
    onClick: () => setActionSheetFile(f),
    'aria-label': 'خيارات',
    className: 'se-focusable se-row-action',
    style: {
      flexShrink: 0
    }
  }, React.createElement(Icon, {
    name: 'more-vertical',
    size: 18
  })));
  const showEmpty = emptyMode || files.length === 0;
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement(PageHeading, {
    title: 'الإيصالات والملفات',
    description: 'جميع الإيصالات والفواتير والملفات المرفوعة',
    actions: React.createElement(Button, {
      icon: 'upload',
      onClick: onUpload
    }, 'رفع إيصال أو فاتورة')
  }), !showEmpty && !errorMode && React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10
    }
  }, React.createElement('div', {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      flex: '1 1 220px',
      minWidth: 200
    }
  }, React.createElement(Icon, {
    name: 'search',
    size: 16,
    color: 'var(--color-text-muted)',
    style: {
      position: 'absolute',
      insetInlineStart: 12
    }
  }), React.createElement('input', {
    value: query,
    onChange: e => setQuery(e.target.value),
    placeholder: 'ابحث باسم الملف...',
    className: 'se-focusable',
    style: {
      width: '100%',
      height: 44,
      boxSizing: 'border-box',
      padding: '0 40px 0 12px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      fontSize: 14,
      fontFamily: 'var(--font-arabic)',
      color: 'var(--color-text)',
      background: 'var(--color-surface)'
    }
  })), React.createElement('div', {
    className: 'se-files-filters-inline',
    style: {
      display: 'flex',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, React.createElement('div', {
    style: {
      width: 170
    }
  }, React.createElement(Select, {
    value: statusFilter,
    onChange: e => setStatusFilter(e.target.value),
    options: statusOptions
  })), React.createElement('div', {
    style: {
      width: 150
    }
  }, React.createElement(Select, {
    value: typeFilter,
    onChange: e => setTypeFilter(e.target.value),
    options: typeOptions
  })), React.createElement('div', {
    style: {
      width: 170
    }
  }, React.createElement(DateField, {
    label: '',
    value: dateFilter,
    onChange: e => setDateFilter(e.target.value)
  }))), React.createElement('button', {
    type: 'button',
    onClick: openFilterSheet,
    className: 'se-focusable se-files-filter-trigger',
    style: {
      alignSelf: 'flex-end',
      alignItems: 'center',
      gap: 6,
      height: 44,
      padding: '0 14px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: 'var(--color-surface)',
      color: 'var(--color-text)',
      fontSize: 14,
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, React.createElement(Icon, {
    name: 'sliders-horizontal',
    size: 16
  }), 'تصفية', activeChips.length > 0 && React.createElement('span', {
    style: {
      fontSize: 11,
      fontWeight: 700,
      background: 'var(--color-primary)',
      color: '#fff',
      borderRadius: 99,
      minWidth: 18,
      height: 18,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 5px'
    }
  }, activeChips.length))), activeChips.length > 0 && React.createElement('div', {
    className: 'se-files-chips',
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 8
    }
  }, activeChips.map(chip => React.createElement('span', {
    key: chip.key,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 30,
      padding: '0 6px 0 10px',
      borderRadius: 99,
      background: 'var(--color-surface-sunken)',
      fontSize: 12,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, chip.label, React.createElement('button', {
    type: 'button',
    onClick: chip.clear,
    'aria-label': 'إزالة',
    className: 'se-focusable',
    style: {
      border: 'none',
      background: 'none',
      display: 'flex',
      cursor: 'pointer',
      color: 'var(--color-text-muted)'
    }
  }, React.createElement(Icon, {
    name: 'x',
    size: 12
  })))))), errorMode ? React.createElement(EmptyState, {
    icon: 'alert-triangle',
    title: 'تعذّر تحميل الملفات',
    description: 'حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.',
    actionLabel: 'إعادة المحاولة',
    onAction: () => {}
  }) : loadingMode ? React.createElement('div', {
    className: 'se-files-grid'
  }, Array.from({
    length: 6
  }).map((_, i) => React.createElement('div', {
    key: i,
    style: {
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      overflow: 'hidden'
    }
  }, React.createElement(Skeleton, {
    variant: 'card',
    height: 108
  }), React.createElement('div', {
    style: {
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, React.createElement(Skeleton, {
    width: '80%'
  }), React.createElement(Skeleton, {
    width: '50%'
  }))))) : showEmpty ? React.createElement(EmptyState, {
    icon: 'file-image',
    title: 'لا توجد ملفات بعد',
    description: 'ارفع أول إيصال أو فاتورة لبدء الاستخراج الذكي.',
    actionLabel: 'رفع إيصال أو فاتورة',
    onAction: onUpload
  }) : filtered.length === 0 ? React.createElement(EmptyState, {
    icon: 'search-x',
    title: 'لا توجد نتائج مطابقة',
    description: 'جرّب تعديل كلمة البحث أو الفلاتر.'
  }) : React.createElement(React.Fragment, null, React.createElement('div', {
    className: 'se-files-grid',
    style: {
      display: 'grid'
    }
  }, filtered.map(DesktopCard)), React.createElement('div', {
    className: 'se-files-list-wrap',
    style: {
      flexDirection: 'column',
      gap: 10
    }
  }, filtered.map(MobileCard))), filterSheetOpen && React.createElement('div', {
    dir: 'rtl',
    style: {
      position: 'fixed',
      inset: 0,
      background: 'var(--color-overlay)',
      zIndex: 250,
      display: 'flex',
      alignItems: 'flex-end'
    },
    onClick: () => setFilterSheetOpen(false)
  }, React.createElement('div', {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: 'var(--color-surface)',
      borderRadius: '16px 16px 0 0',
      padding: '10px 16px calc(16px + env(safe-area-inset-bottom))',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      width: 36,
      height: 4,
      borderRadius: 99,
      background: 'var(--color-border-strong)',
      alignSelf: 'center',
      margin: '4px 0 2px'
    }
  }), React.createElement('div', {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--color-text)'
    }
  }, 'تصفية'), React.createElement(Select, {
    label: 'الحالة',
    value: draft.status,
    onChange: e => setDraft(d => ({
      ...d,
      status: e.target.value
    })),
    options: statusOptions
  }), React.createElement(Select, {
    label: 'نوع الملف',
    value: draft.type,
    onChange: e => setDraft(d => ({
      ...d,
      type: e.target.value
    })),
    options: typeOptions
  }), React.createElement(DateField, {
    label: 'التاريخ',
    value: draft.date,
    onChange: e => setDraft(d => ({
      ...d,
      date: e.target.value
    }))
  }), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 4
    }
  }, React.createElement(Button, {
    variant: 'secondary',
    size: 'lg',
    fullWidth: true,
    onClick: clearFilters
  }, 'مسح الفلاتر'), React.createElement(Button, {
    size: 'lg',
    fullWidth: true,
    onClick: applyFilters
  }, 'تطبيق')))), actionSheetFile && React.createElement('div', {
    dir: 'rtl',
    style: {
      position: 'fixed',
      inset: 0,
      background: 'var(--color-overlay)',
      zIndex: 250,
      display: 'flex',
      alignItems: 'flex-end'
    },
    onClick: () => setActionSheetFile(null)
  }, React.createElement('div', {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: 'var(--color-surface)',
      borderRadius: '16px 16px 0 0',
      padding: '10px 12px calc(12px + env(safe-area-inset-bottom))',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      width: 36,
      height: 4,
      borderRadius: 99,
      background: 'var(--color-border-strong)',
      alignSelf: 'center',
      margin: '4px 0 10px'
    }
  }), menuItems(actionSheetFile, () => setActionSheetFile(null)).map((it, i) => it.divider ? React.createElement('div', {
    key: i,
    style: {
      height: 1,
      background: 'var(--color-border)',
      margin: '6px 0'
    }
  }) : React.createElement('button', {
    key: i,
    onClick: it.onClick,
    className: 'se-focusable se-row-hover',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      padding: '0 12px',
      borderRadius: 'var(--radius-control)',
      border: 'none',
      background: 'transparent',
      color: it.destructive ? 'var(--color-expense)' : 'var(--color-text)',
      fontSize: 15,
      fontWeight: 500,
      cursor: 'pointer',
      textAlign: 'start'
    }
  }, React.createElement(Icon, {
    name: it.destructive ? 'trash-2' : it.label === 'معاينة الملف' ? 'eye' : it.label.includes('مرتبط') || it.label.includes('ربط') ? 'link' : it.label.includes('محاولة') ? 'rotate-ccw' : 'sparkles',
    size: 18
  }), it.label)))), previewFile && React.createElement(Dialog, {
    open: true,
    onClose: () => setPreviewFile(null),
    title: previewFile.fileName,
    mobileFullSheet: true,
    size: 480,
    footer: React.createElement(Button, {
      variant: 'secondary',
      onClick: () => setPreviewFile(null)
    }, 'إغلاق')
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement('div', {
    style: {
      height: 220,
      borderRadius: 'var(--radius-card)',
      background: previewFile.fileType === 'pdf' ? 'var(--color-expense-subtle)' : 'var(--color-surface-sunken)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, React.createElement(Icon, {
    name: previewFile.fileType === 'pdf' ? 'file-text' : 'file-image',
    size: 48,
    color: previewFile.fileType === 'pdf' ? 'var(--color-expense)' : 'var(--color-text-faint)'
  })), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, [['النوع', previewFile.fileType === 'pdf' ? 'PDF' : 'صورة'], ['الحجم', previewFile.size], ['تاريخ الرفع', previewFile.date], ['الارتباط', linkLabel(previewFile)]].map(([k, v]) => React.createElement('div', {
    key: k,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 13
    }
  }, React.createElement('span', {
    style: {
      color: 'var(--color-text-muted)'
    }
  }, k), React.createElement('span', {
    dir: k === 'الحجم' || k === 'تاريخ الرفع' ? 'ltr' : undefined,
    style: {
      color: 'var(--color-text)',
      fontWeight: 600
    }
  }, v))), React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      fontSize: 13
    }
  }, React.createElement('span', {
    style: {
      color: 'var(--color-text-muted)'
    }
  }, 'الحالة'), React.createElement(StatusBadge, {
    status: previewFile.status
  }))))), deleteTarget && React.createElement(ConfirmDialog, {
    open: true,
    onClose: () => setDeleteTarget(null),
    onConfirm: confirmDelete,
    confirmLabel: 'حذف',
    title: 'حذف الملف؟',
    description: 'سيتم حذف هذا الملف نهائيًا، ولا يمكن التراجع عن هذا الإجراء.'
  }));
}
window.FilesScreen = FilesScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/FilesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/HistoryScreen.jsx
try { (() => {
const HISTORY_TYPE_META = {
  income: {
    icon: 'trending-up',
    bg: 'var(--color-income-subtle)',
    color: 'var(--color-income)'
  },
  expense: {
    icon: 'trending-down',
    bg: 'var(--color-expense-subtle)',
    color: 'var(--color-expense)'
  },
  'expense-delete': {
    icon: 'trash-2',
    bg: 'var(--color-expense-subtle)',
    color: 'var(--color-expense)'
  },
  ai: {
    icon: 'sparkles',
    bg: 'var(--color-primary-subtle)',
    color: 'var(--color-primary)'
  },
  member: {
    icon: 'user',
    bg: 'var(--color-info-subtle)',
    color: 'var(--color-info)'
  },
  category: {
    icon: 'tag',
    bg: 'var(--color-warning-subtle)',
    color: 'var(--color-warning)'
  }
};
const TYPE_FILTERS = [{
  value: '',
  label: 'جميع الأحداث'
}, {
  value: 'income',
  label: 'الدخل'
}, {
  value: 'expense',
  label: 'المصاريف'
}, {
  value: 'ai',
  label: 'الاستخراج الذكي'
}, {
  value: 'category',
  label: 'الفئات'
}, {
  value: 'member',
  label: 'الأعضاء'
}];
function HistoryRow({
  h,
  Icon
}) {
  const meta = HISTORY_TYPE_META[h.type] || HISTORY_TYPE_META.category;
  return React.createElement('div', {
    className: 'se-history-row',
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }
  }, React.createElement('div', {
    style: {
      width: 36,
      height: 36,
      borderRadius: '50%',
      background: meta.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement(Icon, {
    name: meta.icon,
    size: 16,
    color: meta.color
  })), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, React.createElement('div', {
    style: {
      fontSize: 14.5,
      fontWeight: 600,
      color: 'var(--color-text)'
    }
  }, h.action), React.createElement('div', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)'
    }
  }, h.detail), React.createElement('div', {
    style: {
      fontSize: 12,
      color: 'var(--color-text-faint)'
    }
  }, h.actor + ' · ', React.createElement('span', {
    dir: 'ltr',
    style: {
      unicodeBidi: 'plaintext'
    }
  }, `${h.date}، ${h.time || ''}`))));
}
function HistoryScreen() {
  const {
    PageHeading,
    FilterBar,
    Input,
    DateField,
    Select,
    InfoCard,
    Icon
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const {
    history
  } = window.SEMockData;
  const [q, setQ] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const filtered = history.filter(h => {
    if (typeFilter) {
      const t = typeFilter === 'expense' ? h.type === 'expense' || h.type === 'expense-delete' : h.type === typeFilter;
      if (!t) return false;
    }
    if (q && !(h.action + h.detail).includes(q)) return false;
    return true;
  });
  return React.createElement('div', {
    dir: 'rtl',
    className: 'se-history-page',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement(PageHeading, {
    title: 'سجل النشاط',
    description: 'سجل تراكمي لجميع أحداث مساحة العمل المهمة، لا يمكن تعديله أو حذفه.'
  }), React.createElement('div', {
    className: 'se-history-filterbar'
  }, React.createElement(FilterBar, null, React.createElement('div', {
    className: 'se-history-filter-search'
  }, React.createElement(Input, {
    label: 'البحث',
    icon: 'search',
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: 'ابحث في السجل…'
  })), React.createElement('div', {
    className: 'se-history-filter-type'
  }, React.createElement(Select, {
    label: 'نوع الحدث',
    value: typeFilter,
    onChange: e => setTypeFilter(e.target.value),
    options: TYPE_FILTERS,
    placeholder: 'جميع الأحداث'
  })), React.createElement('div', {
    className: 'se-history-filter-date'
  }, React.createElement(DateField, {
    label: 'من',
    value: dateFrom,
    onChange: e => setDateFrom(e.target.value)
  })), React.createElement('div', {
    className: 'se-history-filter-date'
  }, React.createElement(DateField, {
    label: 'إلى',
    value: dateTo,
    onChange: e => setDateTo(e.target.value)
  })))), React.createElement('div', {
    className: 'se-history-desktop'
  }, React.createElement(InfoCard, {
    padded: false
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, filtered.map((h, i) => React.createElement('div', {
    key: h.id,
    style: {
      padding: '14px 20px',
      borderBottom: i < filtered.length - 1 ? '1px solid var(--color-border)' : 'none'
    }
  }, React.createElement(HistoryRow, {
    h,
    Icon
  })))))), React.createElement('div', {
    className: 'se-history-mobile',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, filtered.map(h => React.createElement('div', {
    key: h.id,
    style: {
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-card)',
      padding: '12px 14px'
    }
  }, React.createElement(HistoryRow, {
    h,
    Icon
  })))));
}
window.HistoryScreen = HistoryScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/HistoryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/RecordFormDialog.jsx
try { (() => {
const STR = {
  ar: {
    incomeTitle: 'إضافة دخل',
    incomeDesc: 'سجّل دخلاً جديدًا',
    expenseTitle: 'إضافة مصروف',
    expenseDesc: 'سجّل مصروفًا جديدًا يدويًا',
    amount: 'المبلغ',
    category: 'الفئة',
    incomeCategory: 'فئة الدخل',
    selectCategory: 'اختر الفئة',
    description: 'وصف الدخل (اختياري)',
    descPlaceholder: 'مثال: راتب شهر يوليو',
    notes: 'ملاحظات (اختياري)',
    notesPlaceholderIncome: 'أضف أي تفاصيل إضافية...',
    notesPlaceholderExpense: 'يمكنك إضافة اسم التاجر أو أي تفاصيل إضافية هنا…',
    receipt: 'إيصال (اختياري)',
    cancel: 'إلغاء',
    addIncome: 'إضافة الدخل',
    save: 'حفظ',
    phase12: 'Future state — Phase 12',
    phase12Note: 'ستُستخدم عملة مساحة العمل: ر.س',
    phase13: 'Phase 13',
    currency: 'ر.س',
    notAvailable: 'غير متاحة',
    expenseTitleEdit: 'تعديل المصروف',
    addExpense: 'إضافة المصروف',
    saveChanges: 'حفظ التعديلات'
  },
  en: {
    incomeTitle: 'Add income',
    incomeDesc: 'Record a new income entry',
    amount: 'Amount',
    incomeCategory: 'Income category',
    selectCategory: 'Select category',
    description: 'Income description (optional)',
    descPlaceholder: 'Example: July salary',
    notes: 'Notes (optional)',
    notesPlaceholderIncome: 'Add any additional details...',
    cancel: 'Cancel',
    addIncome: 'Add income',
    phase12: 'Future state — Phase 12',
    phase12Note: 'Workspace currency: SAR',
    phase13: 'Phase 13',
    currency: 'SAR',
    expenseTitleEdit: 'Edit expense',
    addExpense: 'Add expense',
    saveChanges: 'Save changes'
  }
};
function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
function RecordFormDialog({
  open,
  kind,
  role = 'owner',
  lang = 'ar',
  editRecord,
  previewMode = true,
  onClose,
  onSave
}) {
  const {
    Dialog,
    Button,
    AmountInput,
    Input,
    Textarea,
    FileUpload,
    CategoryPickerDialog,
    DateField,
    Icon,
    Badge
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const isIncome = kind === 'income';
  const isEditing = !!editRecord;
  const isEn = isIncome && lang === 'en';
  const dir = isEn ? 'ltr' : 'rtl';
  const t = isEn ? STR.en : STR.ar;
  const canManageCategories = role === 'owner' || role === 'admin';
  const initialCategories = () => isIncome ? isEn ? window.SEMockData.incomeCategoryTreeEn : window.SEMockData.incomeCategoryTree : window.SEMockData.expenseCategoryTree;
  const [categories, setCategories] = React.useState(initialCategories);
  const [amount, setAmount] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState(todayStr);
  const [category, setCategory] = React.useState(null);
  const [notes, setNotes] = React.useState('');
  const [receipt, setReceipt] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [sheet, setSheet] = React.useState(null);
  React.useEffect(() => {
    if (!open) return;
    setCategories(initialCategories());
    if (editRecord) {
      setAmount(editRecord.amount ? String(editRecord.amount).replace(/,/g, '') : '');
      setDescription(editRecord.title || '');
      setDate(editRecord.date || todayStr());
      setCategory(null);
      setNotes('');
    } else {
      setAmount('');
      setDescription('');
      setDate(todayStr());
      setCategory(null);
      setNotes('');
    }
    setReceipt(null);
    setSheet(null);
    setSaving(false);
  }, [open, kind, lang, editRecord]);
  const onPickReceipt = e => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name);
    setReceipt({
      name: file.name,
      isPdf,
      url: isPdf ? null : URL.createObjectURL(file)
    });
  };
  const save = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      onSave();
    }, 700);
  };
  const onCreateCategory = (newCat, parentValue) => {
    setCategories(prev => parentValue ? prev.map(c => c.value === parentValue ? {
      ...c,
      subs: [...(c.subs || []), newCat]
    } : c) : [...prev, {
      ...newCat,
      subs: []
    }]);
  };
  const fieldTrigger = (icon, text, onClick, isPlaceholder) => React.createElement('button', {
    onClick,
    className: 'se-focusable',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      width: '100%',
      height: 44,
      boxSizing: 'border-box',
      padding: '0 12px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: 'var(--color-surface)',
      cursor: 'pointer',
      textAlign: 'start'
    }
  }, icon && React.createElement(Icon, {
    name: icon,
    size: 16,
    color: 'var(--color-text-muted)'
  }), React.createElement('span', {
    style: {
      flex: 1,
      fontSize: 14,
      color: isPlaceholder ? 'var(--color-text-muted)' : 'var(--color-text)'
    }
  }, text), React.createElement(Icon, {
    name: 'chevron-down',
    size: 14,
    color: 'var(--color-text-muted)'
  }));
  const categoryLabel = category ? category.isSub ? `${category.mainLabel} › ${category.label}` : category.label : t.selectCategory;
  return React.createElement(React.Fragment, null, React.createElement(Dialog, {
    open,
    onClose,
    dir,
    size: isIncome ? 540 : 'md',
    mobileFullSheet: isIncome,
    title: isIncome ? t.incomeTitle : isEditing ? t.expenseTitleEdit : t.expenseTitle,
    description: isIncome ? t.incomeDesc : t.expenseDesc,
    footer: React.createElement(React.Fragment, null, React.createElement(Button, {
      variant: 'secondary',
      onClick: onClose,
      disabled: saving
    }, t.cancel), React.createElement(Button, {
      onClick: save,
      loading: saving
    }, isIncome ? t.addIncome : isEditing ? t.saveChanges : t.addExpense))
  }, React.createElement('div', {
    dir,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement(AmountInput, {
    label: t.amount,
    kind: isIncome ? 'income' : 'expense',
    currency: t.currency,
    value: amount,
    onChange: e => setAmount(e.target.value),
    required: true
  }), !isIncome && previewMode && React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      marginTop: -6
    }
  }, React.createElement(Badge, {
    tone: 'warning',
    dot: true
  }, t.phase12), React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)'
    }
  }, t.phase12Note)), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6
    }
  }, React.createElement('label', {
    style: {
      fontSize: 'var(--text-label-size)',
      fontWeight: 500,
      color: 'var(--color-text)'
    }
  }, isIncome ? t.incomeCategory : t.category, React.createElement('span', {
    style: {
      color: 'var(--color-expense)'
    }
  }, ' *')), previewMode && React.createElement(Badge, {
    tone: 'warning',
    dot: true
  }, t.phase13)), fieldTrigger(category && category.icon, categoryLabel, () => setSheet('category'), !category)), isIncome && React.createElement(Input, {
    label: t.description,
    placeholder: t.descPlaceholder,
    value: description,
    onChange: e => setDescription(e.target.value)
  }), DateField && React.createElement(DateField, {
    label: isEn ? 'Date' : 'التاريخ',
    lang: isEn ? 'en' : 'ar',
    required: true,
    value: date,
    onChange: e => setDate(e.target.value)
  }), !isIncome && React.createElement(FileUpload, {
    label: t.receipt,
    fileName: receipt && receipt.name,
    onPick: onPickReceipt
  }), !isIncome && receipt && React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface-hover)'
    }
  }, receipt.isPdf ? React.createElement('div', {
    style: {
      width: 36,
      height: 36,
      borderRadius: 8,
      background: 'var(--color-expense-subtle)',
      color: 'var(--color-expense)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 10,
      fontWeight: 700,
      flexShrink: 0
    }
  }, 'PDF') : React.createElement('img', {
    src: receipt.url,
    alt: '',
    style: {
      width: 36,
      height: 36,
      borderRadius: 8,
      objectFit: 'cover',
      flexShrink: 0
    }
  }), React.createElement('span', {
    dir: 'ltr',
    style: {
      fontSize: 13,
      color: 'var(--color-text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, receipt.name)), React.createElement(Textarea, {
    label: t.notes,
    placeholder: isIncome ? t.notesPlaceholderIncome : t.notesPlaceholderExpense,
    value: notes,
    onChange: e => setNotes(e.target.value),
    rows: isIncome ? 3 : undefined
  }))), CategoryPickerDialog && React.createElement(CategoryPickerDialog, {
    open: sheet === 'category',
    categories,
    selected: category,
    canManageCategories,
    onCreateCategory,
    lang: isEn ? 'en' : 'ar',
    title: isIncome ? t.incomeCategory : undefined,
    onClose: () => setSheet(null),
    onSelect: c => {
      setCategory(c);
      setSheet(null);
    }
  }));
}
window.RecordFormDialog = RecordFormDialog;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/RecordFormDialog.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/RecordsScreen.jsx
try { (() => {
function RecordsScreen({
  kind,
  role,
  onAdd,
  onEdit,
  onDeleteRequest,
  onOpenReceipt,
  lang = 'ar'
}) {
  const {
    PageHeading,
    Button,
    FilterBar,
    Input,
    Select,
    DateField,
    Table,
    MobileRecordCard,
    Pagination,
    Badge,
    IconButton,
    DropdownMenu,
    EmptyState,
    Alert,
    Icon
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const {
    incomeRecords,
    expenseRecords,
    categories
  } = window.SEMockData;
  const isEn = lang === 'en';
  const dir = isEn ? 'ltr' : 'rtl';
  const incomeCategories = isEn ? [{
    value: 'all',
    label: 'All income categories'
  }, {
    value: 'fixed',
    label: 'Fixed income'
  }, {
    value: 'extra',
    label: 'Extra income'
  }, {
    value: 'refund',
    label: 'Refund'
  }, {
    value: 'other',
    label: 'Other'
  }] : [{
    value: 'all',
    label: 'جميع فئات الدخل'
  }, {
    value: 'fixed',
    label: 'دخل ثابت'
  }, {
    value: 'extra',
    label: 'دخل إضافي'
  }, {
    value: 'refund',
    label: 'استرداد'
  }, {
    value: 'other',
    label: 'أخرى'
  }];
  const t = isEn ? {
    incomeTitle: 'Income',
    expenseTitle: 'Expenses',
    incomeDesc: 'All recorded income sources',
    expenseDesc: 'All expenses recorded this month',
    addIncome: 'Add income',
    addExpense: 'Add expense',
    search: 'Search',
    searchPlaceholder: 'Search by name…',
    searchPlaceholderExpense: 'Search by description or category...',
    expenseCategory: 'Expense category',
    allCategories: 'All categories',
    date: 'Date',
    emptyIncomeTitle: 'No income records',
    emptyExpenseTitle: 'No expenses',
    emptyDesc: 'Try changing the filters or add a new record.',
    source: 'Source',
    description: 'Description',
    category: 'Category',
    by: 'By',
    amount: 'Amount',
    edit: 'Edit',
    delete: 'Delete',
    options: 'Options',
    empty: 'No data to display',
    editExpense: 'Edit expense',
    openReceipt: 'Open receipt',
    deleteExpense: 'Delete expense'
  } : {
    incomeTitle: 'الدخل',
    expenseTitle: 'المصاريف',
    incomeDesc: 'جميع مصادر الدخل المسجّلة',
    expenseDesc: 'جميع المصاريف المسجّلة لهذا الشهر',
    addIncome: 'إضافة دخل',
    addExpense: 'إضافة مصروف',
    search: 'البحث',
    searchPlaceholder: 'ابحث بالاسم…',
    searchPlaceholderExpense: 'ابحث في الوصف أو الفئة...',
    expenseCategory: 'فئة المصروف',
    allCategories: 'جميع الفئات',
    date: 'التاريخ',
    emptyIncomeTitle: 'لا توجد سجلات دخل',
    emptyExpenseTitle: 'لا توجد مصاريف',
    emptyDesc: 'جرّب تغيير الفلاتر أو أضف سجلًا جديدًا.',
    source: 'المصدر',
    description: 'الوصف',
    category: 'الفئة',
    by: 'بواسطة',
    amount: 'المبلغ',
    edit: 'تعديل',
    delete: 'حذف',
    options: 'خيارات',
    empty: 'لا توجد بيانات لعرضها',
    editExpense: 'تعديل المصروف',
    openReceipt: 'فتح الإيصال',
    deleteExpense: 'حذف المصروف'
  };
  const catEn = {
    'بقالة': 'Groceries',
    'مواصلات': 'Transport',
    'سكن': 'Housing',
    'طعام': 'Dining',
    'مطاعم': 'Dining',
    'صحة': 'Health',
    'أخرى': 'Other',
    'دخل ثابت': 'Fixed income',
    'دخل إضافي': 'Extra income',
    'مشتريات منزلية': 'Household purchases',
    'وقود': 'Fuel',
    'صيدلية': 'Pharmacy'
  };
  const catLabel = c => isEn ? catEn[c] || c : c;
  const currency = isEn ? 'SAR' : 'ر.س';
  const isIncome = kind === 'income';
  const incomeCatIcon = {
    'دخل ثابت': 'wallet',
    'دخل إضافي': 'sparkles',
    'أخرى': 'more-horizontal'
  };
  const iconFor = r => isIncome ? incomeCatIcon[r.category] || 'more-horizontal' : r.icon || 'shopping-cart';
  const categoryPath = r => r.subcategory ? `${catLabel(r.category)} › ${catLabel(r.subcategory)}` : catLabel(r.category);
  const records = isIncome ? incomeRecords : expenseRecords;
  const canAdd = isIncome ? role === 'owner' || role === 'admin' : role !== 'viewer';
  const canDelete = role === 'owner' || role === 'admin';
  const [q, setQ] = React.useState('');
  const [incomeCategory, setIncomeCategory] = React.useState('all');
  const [expenseCategory, setExpenseCategory] = React.useState('all');
  const [dateFilter, setDateFilter] = React.useState('');
  const [filterSheetOpen, setFilterSheetOpen] = React.useState(false);
  const [draftCategory, setDraftCategory] = React.useState('all');
  const [draftDate, setDraftDate] = React.useState('');
  const [actionSheetRecord, setActionSheetRecord] = React.useState(null);
  const filtered = records.filter(r => r.title.includes(q) || r.category && r.category.includes(q) || r.subcategory && r.subcategory.includes(q));
  const categoryOptions = [{
    value: 'all',
    label: t.allCategories
  }, ...categories.map(c => ({
    value: c.value,
    label: catLabel(c.label)
  }))];
  const openFilterSheet = () => {
    setDraftCategory(expenseCategory);
    setDraftDate(dateFilter);
    setFilterSheetOpen(true);
  };
  const applyFilters = () => {
    setExpenseCategory(draftCategory);
    setDateFilter(draftDate);
    setFilterSheetOpen(false);
  };
  const clearFilters = () => {
    setExpenseCategory('all');
    setDateFilter('');
    setDraftCategory('all');
    setDraftDate('');
    setFilterSheetOpen(false);
  };
  const activeChips = [];
  if (!isIncome && expenseCategory !== 'all') {
    const opt = categoryOptions.find(o => o.value === expenseCategory);
    activeChips.push({
      key: 'cat',
      label: opt ? opt.label : expenseCategory,
      onRemove: () => setExpenseCategory('all')
    });
  }
  if (!isIncome && dateFilter) activeChips.push({
    key: 'date',
    label: dateFilter,
    onRemove: () => setDateFilter('')
  });
  const rowActions = (r, size) => React.createElement(React.Fragment, null, React.createElement('button', {
    type: 'button',
    title: t.edit,
    'aria-label': t.edit,
    disabled: !canDelete,
    onClick: e => {
      e.stopPropagation();
      onEdit && onEdit(r);
    },
    className: `se-focusable se-row-action ${size === 'lg' ? 'se-row-action-lg' : ''}`.trim()
  }, React.createElement(Icon, {
    name: 'pencil',
    size: size === 'lg' ? 18 : 15
  })), !isIncome && r.hasReceipt && React.createElement('button', {
    type: 'button',
    title: t.openReceipt,
    'aria-label': t.openReceipt,
    onClick: e => {
      e.stopPropagation();
      onOpenReceipt && onOpenReceipt(r);
    },
    className: `se-focusable se-row-action ${size === 'lg' ? 'se-row-action-lg' : ''}`.trim()
  }, React.createElement(Icon, {
    name: 'receipt',
    size: size === 'lg' ? 18 : 15
  })), React.createElement('button', {
    type: 'button',
    title: t.delete,
    'aria-label': t.delete,
    disabled: !canDelete,
    onClick: e => {
      e.stopPropagation();
      onDeleteRequest({
        ...r,
        kind
      });
    },
    className: `se-focusable se-row-action se-row-action-danger ${size === 'lg' ? 'se-row-action-lg' : ''}`.trim()
  }, React.createElement(Icon, {
    name: 'trash-2',
    size: size === 'lg' ? 18 : 15
  })));
  return React.createElement('div', {
    dir,
    className: !isIncome ? 'se-expense-page' : undefined,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, isEn && React.createElement(Alert, {
    tone: 'warning',
    title: 'Future state — Phase 12'
  }, 'This English preview mirrors the current Arabic layout; full localization is planned for a later phase.'), isIncome ? React.createElement('div', {
    dir,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      flexWrap: 'wrap',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', null, React.createElement('h1', {
    style: {
      fontSize: 'var(--text-page-title-size)',
      fontWeight: 'var(--text-page-title-weight)',
      color: 'var(--color-text)',
      margin: 0
    }
  }, t.incomeTitle), React.createElement('p', {
    style: {
      fontSize: 14,
      color: 'var(--color-text-muted)',
      margin: '6px 0 0'
    }
  }, t.incomeDesc)), canAdd && React.createElement(Button, {
    icon: 'plus',
    onClick: onAdd
  }, t.addIncome)) : React.createElement('div', {
    className: 'se-expense-heading'
  }, React.createElement(PageHeading, {
    dir,
    title: t.expenseTitle,
    description: t.expenseDesc,
    actions: canAdd ? React.createElement(Button, {
      icon: 'plus',
      onClick: onAdd
    }, t.addExpense) : null
  })), React.createElement(FilterBar, {
    dir
  }, React.createElement(Input, {
    label: t.search,
    icon: 'search',
    value: q,
    onChange: e => setQ(e.target.value),
    placeholder: isIncome ? t.searchPlaceholder : t.searchPlaceholderExpense
  }), isIncome ? React.createElement(Select, {
    label: isEn ? 'Income category' : 'فئة الدخل',
    value: incomeCategory,
    onChange: e => setIncomeCategory(e.target.value),
    options: incomeCategories
  }) : React.createElement('div', {
    className: 'se-filters-desktop-only'
  }, React.createElement(Select, {
    label: t.expenseCategory,
    value: expenseCategory,
    onChange: e => setExpenseCategory(e.target.value),
    options: categoryOptions
  }), React.createElement('div', {
    style: {
      width: 190
    }
  }, React.createElement(DateField, {
    label: t.date,
    value: dateFilter,
    onChange: e => setDateFilter(e.target.value)
  }))), isIncome && React.createElement('div', {
    style: {
      width: 190
    }
  }, React.createElement(DateField, {
    label: t.date
  })), !isIncome && React.createElement('button', {
    type: 'button',
    onClick: openFilterSheet,
    className: 'se-focusable se-filter-trigger-mobile',
    style: {
      alignSelf: 'flex-end',
      alignItems: 'center',
      gap: 6,
      height: 44,
      padding: '0 14px',
      borderRadius: 'var(--radius-control)',
      border: '1px solid var(--color-border-strong)',
      background: 'var(--color-surface)',
      color: 'var(--color-text)',
      fontSize: 14,
      fontWeight: 600,
      fontFamily: 'var(--font-arabic)',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, React.createElement(Icon, {
    name: 'sliders-horizontal',
    size: 16
  }), isEn ? 'Filter' : 'تصفية', activeChips.length > 0 && React.createElement('span', {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#fff',
      background: 'var(--color-primary)',
      borderRadius: 99,
      minWidth: 16,
      height: 16,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0 4px'
    }
  }, activeChips.length))), !isIncome && activeChips.length > 0 && React.createElement('div', {
    className: 'se-filter-chips-mobile',
    style: {
      flexWrap: 'wrap',
      gap: 8
    }
  }, activeChips.map(chip => React.createElement('span', {
    key: chip.key,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      height: 30,
      padding: '0 6px 0 10px',
      borderRadius: 99,
      background: 'var(--color-surface-sunken)',
      fontSize: 12.5,
      color: 'var(--color-text)',
      fontFamily: 'var(--font-arabic)'
    }
  }, chip.label, React.createElement('button', {
    type: 'button',
    onClick: chip.onRemove,
    'aria-label': isEn ? 'Remove filter' : 'إزالة الفلتر',
    className: 'se-focusable',
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      borderRadius: '50%',
      border: 'none',
      background: 'var(--color-border)',
      cursor: 'pointer'
    }
  }, React.createElement(Icon, {
    name: 'x',
    size: 12
  }))))), filtered.length === 0 ? React.createElement(EmptyState, {
    dir,
    icon: isIncome ? 'trending-up' : 'trending-down',
    title: isIncome ? t.emptyIncomeTitle : t.emptyExpenseTitle,
    description: t.emptyDesc
  }) : React.createElement(React.Fragment, null, React.createElement('div', {
    className: 'se-desktop-table'
  }, React.createElement(Table, {
    dir,
    emptyLabel: t.empty,
    columns: [{
      key: 'title',
      label: isIncome ? t.source : t.description,
      render: r => React.createElement('span', {
        style: {
          display: 'block',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        },
        title: r.title || undefined
      }, r.title || '—')
    }, {
      key: 'category',
      label: t.category,
      width: 190,
      render: r => React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
          overflow: 'hidden'
        }
      }, React.createElement(Icon, {
        name: iconFor(r),
        size: 14,
        color: 'var(--color-text-muted)',
        style: {
          flexShrink: 0
        }
      }), React.createElement('span', {
        style: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          minWidth: 0
        }
      }, React.createElement(Badge, {
        tone: 'neutral'
      }, categoryPath(r))))
    }, {
      key: 'date',
      label: t.date,
      width: 104,
      render: r => React.createElement('span', {
        dir: 'ltr'
      }, r.date)
    }, {
      key: 'actor',
      label: t.by,
      width: 122,
      className: 'se-col-hide-narrow'
    }, {
      key: 'amount',
      label: t.amount,
      align: 'end',
      width: 112,
      render: r => React.createElement('span', {
        dir: 'ltr',
        style: {
          fontWeight: 700,
          color: isIncome ? 'var(--color-income)' : 'var(--color-expense)'
        }
      }, `${isIncome ? '+' : '-'}${r.amount} ${currency}`)
    }, {
      key: 'actions',
      label: '',
      align: 'center',
      width: isIncome ? 88 : 116,
      render: r => React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'center',
          gap: 4
        }
      }, rowActions(r))
    }],
    rows: filtered
  })), React.createElement('div', {
    className: 'se-mobile-cards',
    style: {
      display: 'none',
      flexDirection: 'column',
      gap: 10
    }
  }, filtered.map(r => React.createElement(MobileRecordCard, {
    key: r.id,
    currency,
    icon: iconFor(r),
    title: r.title || '—',
    category: categoryPath(r),
    date: r.date,
    amount: r.amount,
    kind: isIncome ? 'income' : 'expense',
    actions: isIncome ? rowActions(r, 'lg') : undefined,
    cornerAction: !isIncome ? React.createElement('button', {
      type: 'button',
      'aria-label': t.options,
      title: t.options,
      onClick: () => setActionSheetRecord(r),
      className: 'se-focusable se-row-action'
    }, React.createElement(Icon, {
      name: 'more-vertical',
      size: 16
    })) : undefined
  })))), filtered.length > 0 && React.createElement(Pagination, {
    page: 1,
    totalPages: 1,
    dir
  }), !isIncome && filterSheetOpen && React.createElement('div', {
    dir,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'var(--color-overlay)',
      zIndex: 250,
      display: 'flex',
      alignItems: 'flex-end'
    },
    onClick: () => setFilterSheetOpen(false)
  }, React.createElement('div', {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: 'var(--color-surface)',
      borderRadius: '16px 16px 0 0',
      padding: '10px 16px calc(16px + env(safe-area-inset-bottom))',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      width: 36,
      height: 4,
      borderRadius: 99,
      background: 'var(--color-border-strong)',
      alignSelf: 'center',
      margin: '4px 0 2px'
    }
  }), React.createElement('div', {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: 'var(--color-text)'
    }
  }, isEn ? 'Filter' : 'تصفية'), React.createElement(Select, {
    label: t.expenseCategory,
    value: draftCategory,
    onChange: e => setDraftCategory(e.target.value),
    options: categoryOptions
  }), React.createElement(DateField, {
    label: t.date,
    value: draftDate,
    onChange: e => setDraftDate(e.target.value)
  }), React.createElement('div', {
    style: {
      display: 'flex',
      gap: 10,
      marginTop: 4
    }
  }, React.createElement(Button, {
    variant: 'secondary',
    size: 'lg',
    fullWidth: true,
    onClick: clearFilters
  }, isEn ? 'Clear filters' : 'مسح الفلاتر'), React.createElement(Button, {
    size: 'lg',
    fullWidth: true,
    onClick: applyFilters
  }, isEn ? 'Apply' : 'تطبيق')))), !isIncome && actionSheetRecord && React.createElement('div', {
    dir,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'var(--color-overlay)',
      zIndex: 250,
      display: 'flex',
      alignItems: 'flex-end'
    },
    onClick: () => setActionSheetRecord(null)
  }, React.createElement('div', {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: 'var(--color-surface)',
      borderRadius: '16px 16px 0 0',
      padding: '10px 12px calc(12px + env(safe-area-inset-bottom))',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      width: 36,
      height: 4,
      borderRadius: 99,
      background: 'var(--color-border-strong)',
      alignSelf: 'center',
      margin: '4px 0 10px'
    }
  }), React.createElement('button', {
    onClick: () => {
      onEdit && onEdit(actionSheetRecord);
      setActionSheetRecord(null);
    },
    disabled: !canDelete,
    className: 'se-focusable se-row-hover',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      padding: '0 12px',
      borderRadius: 'var(--radius-control)',
      border: 'none',
      background: 'transparent',
      color: 'var(--color-text)',
      fontSize: 15,
      fontWeight: 500,
      cursor: 'pointer',
      textAlign: 'start',
      opacity: canDelete ? 1 : 0.5
    }
  }, React.createElement(Icon, {
    name: 'pencil',
    size: 18
  }), t.editExpense), actionSheetRecord.hasReceipt && React.createElement('button', {
    onClick: () => {
      onOpenReceipt && onOpenReceipt(actionSheetRecord);
      setActionSheetRecord(null);
    },
    className: 'se-focusable se-row-hover',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      padding: '0 12px',
      borderRadius: 'var(--radius-control)',
      border: 'none',
      background: 'transparent',
      color: 'var(--color-text)',
      fontSize: 15,
      fontWeight: 500,
      cursor: 'pointer',
      textAlign: 'start'
    }
  }, React.createElement(Icon, {
    name: 'receipt',
    size: 18
  }), t.openReceipt), React.createElement('button', {
    onClick: () => {
      onDeleteRequest({
        ...actionSheetRecord,
        kind: 'expense'
      });
      setActionSheetRecord(null);
    },
    disabled: !canDelete,
    className: 'se-focusable se-row-hover',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      padding: '0 12px',
      borderRadius: 'var(--radius-control)',
      border: 'none',
      background: 'transparent',
      color: 'var(--color-expense)',
      fontSize: 15,
      fontWeight: 500,
      cursor: 'pointer',
      textAlign: 'start',
      opacity: canDelete ? 1 : 0.5
    }
  }, React.createElement(Icon, {
    name: 'trash-2',
    size: 18
  }), t.deleteExpense))));
}
window.RecordsScreen = RecordsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/RecordsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ReportsScreen.jsx
try { (() => {
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
  const s = parseDMY(start),
    e = parseDMY(end);
  if (!s || !e) return '';
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
  const startStr = sameMonth ? `${s.getDate()}` : `${s.getDate()} ${MONTHS_AR_FULL[s.getMonth()]}`;
  const endStr = `${e.getDate()} ${MONTHS_AR_FULL[e.getMonth()]} ${e.getFullYear()}`;
  return `${startStr} – ${endStr}`;
}
function ReportsScreen({
  errorMode,
  onNavigate
}) {
  const {
    PageHeading,
    Tabs,
    InfoCard,
    SummaryCard,
    Chart,
    ErrorState,
    DateField,
    Button,
    Badge,
    IconButton,
    Icon
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const {
    categories,
    aiQueue,
    members
  } = window.SEMockData;
  const [period, setPeriod] = React.useState('current');
  const [customStart, setCustomStart] = React.useState('01/06/2026');
  const [customEnd, setCustomEnd] = React.useState('30/06/2026');
  const [appliedRange, setAppliedRange] = React.useState('01/06/2026|30/06/2026');
  const [aiSummary, setAiSummary] = React.useState(null);
  const [aiSummaryLoading, setAiSummaryLoading] = React.useState(false);
  const [membersOpen, setMembersOpen] = React.useState(false);
  if (errorMode) return React.createElement('div', {
    dir: 'rtl'
  }, React.createElement(PageHeading, {
    title: 'التقارير'
  }), React.createElement(ErrorState, {
    description: 'تعذّر تحميل بيانات التقرير. تحقق من الاتصال وحاول مرة أخرى.'
  }));
  const dailyCurrent = [{
    label: '08/07',
    value: 620
  }, {
    label: '09/07',
    value: 410
  }, {
    label: '10/07',
    value: 780
  }, {
    label: '11/07',
    value: 340
  }, {
    label: '12/07',
    value: 910
  }, {
    label: '13/07',
    value: 560
  }, {
    label: '14/07',
    value: 480
  }];
  const dailyPrevious = [{
    label: '01/06',
    value: 520
  }, {
    label: '08/06',
    value: 640
  }, {
    label: '15/06',
    value: 390
  }, {
    label: '22/06',
    value: 710
  }, {
    label: '29/06',
    value: 480
  }];
  const monthlyTrend = [{
    label: 'أبريل',
    value: 4200
  }, {
    label: 'مايو',
    value: 3800
  }, {
    label: 'يونيو',
    value: 5100
  }, {
    label: 'يوليو',
    value: 5080
  }];
  const [appliedStart, appliedEnd] = appliedRange.split('|');
  let trend, trendTitleMain, trendTitleSub;
  if (period === 'current') {
    trend = dailyCurrent;
    trendTitleMain = 'اتجاه الإنفاق اليومي';
    trendTitleSub = 'الفترة الحالية';
  } else if (period === 'previous') {
    trend = dailyPrevious;
    trendTitleMain = 'اتجاه الإنفاق اليومي';
    trendTitleSub = 'الفترة السابقة';
  } else {
    const days = diffDays(parseDMY(appliedStart), parseDMY(appliedEnd));
    const isDaily = days > 0 && days <= 31;
    trend = isDaily ? dailyPrevious : monthlyTrend;
    trendTitleMain = isDaily ? 'اتجاه الإنفاق اليومي' : 'اتجاه الإنفاق الشهري';
    trendTitleSub = 'فترة مخصصة';
  }
  const trendTitle = React.createElement('span', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, React.createElement('span', null, trendTitleMain), React.createElement('span', {
    style: {
      fontSize: 12,
      fontWeight: 400,
      color: 'var(--color-text-muted)'
    }
  }, trendTitleSub));
  const catData = categories.slice(0, 5).map((c, i) => ({
    label: c.label,
    value: [1200, 600, 2000, 480, 220][i],
    color: c.color
  }));
  const catTotal = catData.reduce((s, d) => s + d.value, 0) || 1;
  const topExpenses = [{
    n: 'بقالة العائلة',
    v: '580.00'
  }, {
    n: 'محطة وقود أرامكو',
    v: '420.00'
  }, {
    n: 'مطعم نجد',
    v: '310.00'
  }];
  const pendingCount = aiQueue.filter(a => a.status === 'ready' || a.status === 'failed').length;
  const applyCustomRange = () => setAppliedRange(`${customStart}|${customEnd}`);
  const generateAiSummary = () => {
    setAiSummaryLoading(true);
    setTimeout(() => {
      setAiSummary('أنفقت هذا الشهر أكثر من المعتاد على الفواتير والمواصلات، بينما انخفض إنفاقك على المطاعم مقارنة بالفترة السابقة. رصيدك المتبقي يغطي التزاماتك الحالية.');
      setAiSummaryLoading(false);
    }, 900);
  };
  const membersTitle = React.createElement('button', {
    type: 'button',
    onClick: () => setMembersOpen(o => !o),
    className: 'se-focusable',
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      font: 'inherit',
      color: 'inherit'
    }
  }, React.createElement(Icon, {
    name: membersOpen ? 'chevron-up' : 'chevron-down',
    size: 16
  }), React.createElement('span', null, 'نشاط الأعضاء'));
  const membersList = membersOpen && React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, members.map(m => React.createElement('div', {
    key: m.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 14
    }
  }, React.createElement('span', {
    style: {
      color: 'var(--color-text)'
    }
  }, m.name), React.createElement('span', {
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)'
    }
  }, m.role))));
  const membersCard = React.createElement(InfoCard, {
    title: membersTitle
  }, membersList);
  return React.createElement('div', {
    dir: 'rtl',
    className: 'se-reports-page',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      minWidth: 0
    }
  }, React.createElement(PageHeading, {
    title: 'التقارير',
    description: 'ملخص الدخل والمصاريف والرصيد المتبقي'
  }), React.createElement(Tabs, {
    tabs: [{
      key: 'current',
      label: 'الفترة الحالية'
    }, {
      key: 'previous',
      label: 'الفترة السابقة'
    }, {
      key: 'custom',
      label: 'فترة مخصصة'
    }],
    value: period,
    onChange: setPeriod
  }), period === 'custom' && React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, React.createElement('div', {
    className: 'se-reports-custom-fields',
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-end',
      flexWrap: 'wrap'
    }
  }, React.createElement('div', {
    style: {
      width: 190
    }
  }, React.createElement(DateField, {
    label: 'من تاريخ',
    value: customStart,
    onChange: e => setCustomStart(e.target.value)
  })), React.createElement('div', {
    style: {
      width: 190
    }
  }, React.createElement(DateField, {
    label: 'إلى تاريخ',
    value: customEnd,
    onChange: e => setCustomEnd(e.target.value)
  })), React.createElement(Button, {
    variant: 'secondary',
    onClick: applyCustomRange
  }, 'عرض التقرير')), formatRangeAr(appliedStart, appliedEnd) && React.createElement('span', {
    style: {
      fontSize: 13,
      color: 'var(--color-text-muted)',
      fontFamily: 'var(--font-arabic)'
    }
  }, formatRangeAr(appliedStart, appliedEnd))), React.createElement('div', {
    className: 'se-reports-summary',
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 14
    }
  }, React.createElement(SummaryCard, {
    label: 'الدخل',
    amount: '8,500.00',
    kind: 'income',
    icon: 'trending-up'
  }), React.createElement(SummaryCard, {
    label: 'المصاريف',
    amount: '5,080.00',
    kind: 'expense',
    icon: 'trending-down'
  }), React.createElement(SummaryCard, {
    label: 'الرصيد المتبقي',
    amount: '3,420.00',
    icon: 'wallet'
  })), React.createElement('div', {
    className: 'se-reports-charts',
    style: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
      gap: 14
    }
  }, React.createElement(InfoCard, {
    title: trendTitle
  }, React.createElement(Chart, {
    type: 'bar',
    data: trend,
    height: 200
  })), React.createElement(InfoCard, {
    title: 'التوزيع حسب الفئة'
  }, React.createElement('div', {
    className: 'se-reports-donut-wrap',
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16
    }
  }, React.createElement(Chart, {
    type: 'donut',
    data: catData,
    height: 140
  }), React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: '100%'
    }
  }, catData.map((d, i) => React.createElement('div', {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      fontSize: 13,
      color: 'var(--color-text)'
    }
  }, React.createElement('span', {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: d.color,
      flexShrink: 0
    }
  }), React.createElement('span', {
    style: {
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, d.label), React.createElement('span', {
    dir: 'ltr',
    style: {
      color: 'var(--color-text-muted)',
      fontFeatureSettings: "'tnum' 1"
    }
  }, `${d.value.toLocaleString()} (${Math.round(d.value / catTotal * 100)}%)`))))))), React.createElement(InfoCard, {
    title: 'أكبر المصروفات'
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10
    }
  }, topExpenses.map((m, i) => React.createElement('div', {
    key: i,
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: 14
    }
  }, React.createElement('span', {
    style: {
      color: 'var(--color-text)'
    }
  }, m.n), React.createElement('span', {
    dir: 'ltr',
    style: {
      color: 'var(--color-text-muted)'
    }
  }, m.v + ' ر.س'))))), React.createElement(InfoCard, {
    title: 'الملخص الذكي للإنفاق'
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, aiSummary ? React.createElement('p', {
    style: {
      margin: 0,
      fontSize: 14,
      lineHeight: 1.8,
      color: 'var(--color-text)'
    }
  }, aiSummary) : React.createElement('p', {
    style: {
      margin: 0,
      fontSize: 13,
      color: 'var(--color-text-muted)'
    }
  }, 'احصل على ملخص ذكي لنمط إنفاقك خلال هذه الفترة.'), React.createElement(Button, {
    variant: 'secondary',
    icon: 'sparkles',
    onClick: generateAiSummary,
    loading: aiSummaryLoading
  }, aiSummary ? 'إعادة إنشاء الملخص' : 'إنشاء ملخص بالذكاء الاصطناعي'))), pendingCount > 0 && React.createElement(InfoCard, {
    title: 'عمليات بانتظار المراجعة'
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      flexWrap: 'wrap'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, React.createElement(Badge, {
    tone: 'warning',
    dot: true
  }, `${pendingCount} عملية جاهزة للمراجعة`)), React.createElement(Button, {
    variant: 'secondary',
    onClick: () => onNavigate && onNavigate('ai-review')
  }, 'فتح قائمة المراجعة'))), React.createElement(InfoCard, {
    title: membersTitle
  }, membersList));
}
window.ReportsScreen = ReportsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ReportsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/SettingsScreen.jsx
try { (() => {
function SettingsScreen({
  role,
  onInvite
}) {
  const {
    PageHeading,
    Tabs,
    InfoCard,
    Input,
    Select,
    Button,
    Badge,
    Alert,
    ConfirmDialog,
    PermissionDeniedState
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const [tab, setTab] = React.useState('general');
  const canManageAI = role === 'owner' || role === 'admin';
  const canManageCurrency = role === 'owner' || role === 'admin';
  const currencyOptions = [{
    value: 'SAR',
    label: 'ريال سعودي (ر.س) — الحالية'
  }, {
    value: 'USD',
    label: 'دولار أمريكي ($) — تجريبي'
  }, {
    value: 'AED',
    label: 'درهم إماراتي (د.إ) — تجريبي'
  }, {
    value: 'EGP',
    label: 'جنيه مصري (ج.م) — تجريبي'
  }];
  const [currency, setCurrency] = React.useState('SAR');
  const [pendingCurrency, setPendingCurrency] = React.useState(null);
  const workspaceHasRecords = true;
  const requestCurrencyChange = value => {
    if (value === currency) return;
    if (workspaceHasRecords) setPendingCurrency(value);else setCurrency(value);
  };
  const confirmCurrencyChange = () => {
    setCurrency(pendingCurrency);
    setPendingCurrency(null);
  };
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement(PageHeading, {
    title: 'الإعدادات',
    description: 'إعدادات الحساب، مزوّد الاستخراج الذكي، وأعضاء مساحة العمل'
  }), React.createElement(Tabs, {
    tabs: [{
      key: 'general',
      label: 'عام'
    }, {
      key: 'ai',
      label: 'الاستخراج الذكي'
    }, {
      key: 'members',
      label: 'الأعضاء'
    }],
    value: tab,
    onChange: setTab
  }), tab === 'members' && React.createElement(window.WorkspaceMembersScreen, {
    role,
    onInvite
  }), tab === 'general' && React.createElement('div', {
    className: 'se-settings-narrow',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement(InfoCard, {
    title: 'الملف الشخصي'
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement(Input, {
    label: 'الاسم الكامل',
    value: 'سارة العتيبي'
  }), React.createElement(Input, {
    label: 'البريد الإلكتروني',
    dirOverride: 'ltr',
    value: 'sara@example.com',
    disabled: true,
    helper: 'لا يمكن تغيير البريد الإلكتروني حاليًا'
  }), React.createElement('div', {
    className: 'se-settings-save-wrap'
  }, React.createElement(Button, {
    style: {
      alignSelf: 'flex-start'
    }
  }, 'حفظ التغييرات')))), React.createElement(InfoCard, {
    title: 'عملة مساحة العمل',
    actions: React.createElement(Badge, {
      tone: 'warning',
      dot: true
    }, 'Future state — Phase 12')
  }, canManageCurrency ? React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement(Alert, {
    tone: 'info',
    title: 'عملة أساسية واحدة لكل مساحة عمل'
  }, 'لكل مساحة عمل عملة أساسية واحدة فقط تُستخدم لجميع السجلات — لا يمكن اختيار عملة مختلفة لكل سجل، ولا يدعم النظام التحويل بين العملات أو المحاسبة بعملات متعددة.'), React.createElement(Select, {
    label: 'العملة الأساسية',
    value: currency,
    onChange: e => requestCurrencyChange(e.target.value),
    options: currencyOptions
  }), React.createElement('span', {
    className: 'se-settings-currency-helper',
    style: {
      fontSize: 12,
      color: 'var(--color-text-muted)'
    }
  }, 'هذا إعداد مستقبلي لمرحلة قادمة (Phase 12) لأغراض العرض فقط، وهو مستقل عن لغة الواجهة الشخصية.')) : React.createElement(PermissionDeniedState, {
    roleRequired: 'المالك أو المشرف',
    description: 'تغيير عملة مساحة العمل متاح فقط لمالك مساحة العمل أو المشرف.'
  })), React.createElement(ConfirmDialog, {
    open: !!pendingCurrency,
    onClose: () => setPendingCurrency(null),
    onConfirm: confirmCurrencyChange,
    title: 'تغيير العملة الأساسية؟ — Future state — Phase 12',
    description: `تحتوي مساحة العمل على سجلات مسجّلة بالعملة الحالية. تغيير العملة الأساسية لن يحوّل المبالغ الموجودة تلقائيًا؛ ستبقى القيم القديمة كما هي وقد لا تعكس العملة الجديدة بدقة.`,
    confirmLabel: 'تغيير العملة'
  })), tab === 'ai' && React.createElement('div', {
    className: 'se-settings-narrow'
  }, canManageAI ? React.createElement(InfoCard, {
    title: 'مزوّد الاستخراج الذكي'
  }, React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, React.createElement(Alert, {
    tone: 'info',
    title: 'مفاتيح API محمية'
  }, 'لن تُعرض قيمة المفتاح كاملة بعد الحفظ لأسباب أمنية.'), React.createElement(Select, {
    label: 'المزوّد',
    options: [{
      value: 'openai',
      label: 'OpenAI'
    }, {
      value: 'gemini',
      label: 'Gemini'
    }]
  }), React.createElement(Input, {
    label: 'مفتاح API',
    dirOverride: 'ltr',
    value: 'sk-••••••••••••4f2a',
    disabled: true
  }), React.createElement('div', {
    className: 'se-settings-ai-actions',
    style: {
      display: 'flex',
      gap: 8
    }
  }, React.createElement(Button, {
    variant: 'secondary'
  }, 'استبدال المفتاح'), React.createElement(Button, {
    variant: 'ghost'
  }, 'اختبار الاتصال')))) : React.createElement(InfoCard, null, React.createElement(PermissionDeniedState, {
    roleRequired: 'المالك أو المشرف',
    description: 'إعدادات مزوّد الاستخراج الذكي متاحة فقط لمالك مساحة العمل أو المشرف.'
  }))));
}
window.SettingsScreen = SettingsScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/SettingsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/WorkspaceMembersScreen.jsx
try { (() => {
function WorkspaceMembersScreen({
  role,
  onInvite
}) {
  const {
    Button,
    Table,
    Badge,
    IconButton,
    DropdownMenu,
    ConfirmDialog
  } = window.SmartExpenseAIDesignSystem_44f3e6;
  const {
    members
  } = window.SEMockData;
  const canManage = role === 'owner' || role === 'admin';
  const [removeTarget, setRemoveTarget] = React.useState(null);
  const roleTone = {
    owner: 'primary',
    admin: 'info',
    member: 'neutral',
    viewer: 'neutral'
  };
  const memberActions = r => canManage && r.roleKey !== 'owner' ? React.createElement(DropdownMenu, {
    align: 'start',
    trigger: React.createElement(IconButton, {
      icon: 'more-vertical',
      label: 'خيارات'
    }),
    items: [{
      label: 'تغيير الدور'
    }, {
      divider: true
    }, {
      label: 'إزالة من مساحة العمل',
      destructive: true,
      onClick: () => setRemoveTarget(r)
    }]
  }) : null;
  return React.createElement('div', {
    dir: 'rtl',
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    }
  }, React.createElement('span', {
    style: {
      fontSize: 'var(--text-section-heading-size)',
      fontWeight: 'var(--text-section-heading-weight)',
      color: 'var(--color-text)'
    }
  }, 'أعضاء مساحة العمل'), canManage && React.createElement(Button, {
    icon: 'user-plus',
    onClick: onInvite
  }, 'دعوة عضو')), React.createElement('div', {
    className: 'se-desktop-table'
  }, React.createElement(Table, {
    columns: [{
      key: 'name',
      label: 'الاسم'
    }, {
      key: 'email',
      label: 'البريد الإلكتروني',
      render: r => React.createElement('span', {
        dir: 'ltr'
      }, r.email)
    }, {
      key: 'role',
      label: 'الدور',
      render: r => React.createElement(Badge, {
        tone: roleTone[r.roleKey]
      }, r.role)
    }, {
      key: 'actions',
      label: '',
      align: 'center',
      render: memberActions
    }],
    rows: members
  })), React.createElement('div', {
    className: 'se-mobile-cards',
    style: {
      display: 'none',
      flexDirection: 'column',
      gap: 10
    }
  }, members.map(m => React.createElement('div', {
    key: m.id,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      width: '100%',
      boxSizing: 'border-box',
      padding: 14,
      borderRadius: 'var(--radius-card)',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface)',
      fontFamily: 'var(--font-arabic)'
    }
  }, React.createElement('div', {
    style: {
      width: 38,
      height: 38,
      borderRadius: '50%',
      flexShrink: 0,
      background: 'var(--color-primary-subtle)',
      color: 'var(--color-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 14
    }
  }, m.name.trim()[0]), React.createElement('div', {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 4
    }
  }, React.createElement('span', {
    style: {
      fontWeight: 600,
      color: 'var(--color-text)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, m.name), React.createElement('span', {
    dir: 'ltr',
    style: {
      fontSize: 12.5,
      color: 'var(--color-text-muted)',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      textAlign: 'start'
    }
  }, m.email), React.createElement(Badge, {
    tone: roleTone[m.roleKey]
  }, m.role)), memberActions(m)))), React.createElement(ConfirmDialog, {
    open: !!removeTarget,
    onClose: () => setRemoveTarget(null),
    onConfirm: () => setRemoveTarget(null),
    title: 'إزالة هذا العضو؟',
    description: removeTarget ? `سيفقد ${removeTarget.name} إمكانية الوصول إلى مساحة العمل فورًا.` : '',
    confirmLabel: 'إزالة'
  }));
}
window.WorkspaceMembersScreen = WorkspaceMembersScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/WorkspaceMembersScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/mock-data.js
try { (() => {
window.SEMockData = function () {
  const categories = [{
    value: 'groceries',
    label: 'بقالة',
    icon: 'shopping-cart',
    color: '#0F7A5C'
  }, {
    value: 'transport',
    label: 'مواصلات',
    icon: 'car',
    color: '#3B82F6'
  }, {
    value: 'housing',
    label: 'سكن',
    icon: 'home',
    color: '#F59E0B'
  }, {
    value: 'dining',
    label: 'مطاعم',
    icon: 'utensils',
    color: '#DC2626'
  }, {
    value: 'health',
    label: 'صحة',
    icon: 'heart-pulse',
    color: '#8B5CF6'
  }, {
    value: 'other',
    label: 'أخرى',
    icon: 'more-horizontal',
    color: '#64748B'
  }];
  const incomeRecords = [{
    id: 'i1',
    title: 'راتب شهري',
    category: 'دخل ثابت',
    date: '01/07/2026',
    amount: '8,500.00',
    status: null,
    actor: 'سارة العتيبي'
  }, {
    id: 'i2',
    title: 'عمل حر — تصميم',
    category: 'دخل إضافي',
    date: '05/07/2026',
    amount: '1,200.00',
    status: null,
    actor: 'سارة العتيبي'
  }, {
    id: 'i3',
    title: 'استرداد تأمين',
    category: 'أخرى',
    date: '09/07/2026',
    amount: '350.00',
    status: null,
    actor: 'محمد العتيبي'
  }];
  const expenseRecords = [{
    id: 'e1',
    title: 'بقالة العائلة',
    category: 'بقالة',
    subcategory: 'مشتريات منزلية',
    date: '12/07/2026',
    amount: '145.00',
    status: null,
    actor: 'سارة العتيبي',
    icon: 'shopping-cart',
    hasReceipt: true
  }, {
    id: 'e2',
    title: 'محطة وقود أرامكو',
    category: 'مواصلات',
    subcategory: 'وقود',
    date: '10/07/2026',
    amount: '220.00',
    status: null,
    actor: 'محمد العتيبي',
    icon: 'car',
    hasReceipt: true
  }, {
    id: 'e3',
    title: 'مطعم نجد',
    category: 'مطاعم',
    date: '08/07/2026',
    amount: '96.50',
    status: null,
    actor: 'سارة العتيبي',
    icon: 'utensils',
    hasReceipt: false
  }, {
    id: 'e4',
    title: 'فاتورة الكهرباء',
    category: 'سكن',
    date: '06/07/2026',
    amount: '410.00',
    status: null,
    actor: 'سارة العتيبي',
    icon: 'home',
    hasReceipt: false
  }, {
    id: 'e5',
    title: 'صيدلية النهدي',
    category: 'صحة',
    subcategory: 'صيدلية',
    date: '03/07/2026',
    amount: '78.25',
    status: null,
    actor: 'محمد العتيبي',
    icon: 'heart-pulse',
    hasReceipt: true
  }];
  const aiQueue = [{
    id: 'a1',
    fileName: 'receipt-2026-07-13.jpg',
    status: 'ready',
    currency: 'SAR',
    fields: {
      amount: '62.00',
      notes: 'كافيه العنود',
      date: '13/07/2026',
      category: {
        value: 'cafes',
        label: 'مقاهي',
        icon: 'coffee',
        isSub: true,
        mainLabel: 'طعام'
      }
    }
  }, {
    id: 'a2',
    fileName: 'invoice-jarir-2026-07-11.pdf',
    status: 'ready',
    currency: 'USD',
    fields: {
      amount: '389.00',
      notes: 'مكتبة جرير',
      date: '11/07/2026',
      category: {
        value: 'home',
        label: 'المنزل',
        icon: 'home',
        isSub: true,
        mainLabel: 'عائلة'
      }
    }
  }, {
    id: 'a3',
    fileName: 'receipt-blurry-2026-07-09.jpg',
    status: 'failed',
    currency: 'SAR',
    fields: {
      amount: '',
      notes: '',
      date: '',
      category: null
    },
    error: 'تعذّرت قراءة الإيصال. الصورة غير واضحة — جرّب صورة أوضح أو أدخل القيم يدويًا.'
  }];
  const categoryHierarchy = [{
    value: 'transport',
    label: 'مواصلات',
    subs: [{
      value: 'fuel',
      label: 'وقود'
    }, {
      value: 'maintenance',
      label: 'صيانة'
    }, {
      value: 'rent',
      label: 'إيجار'
    }]
  }, {
    value: 'food',
    label: 'طعام',
    subs: [{
      value: 'restaurants',
      label: 'مطاعم'
    }, {
      value: 'cafes',
      label: 'مقاهي'
    }]
  }, {
    value: 'family',
    label: 'عائلة',
    subs: [{
      value: 'home',
      label: 'المنزل'
    }, {
      value: 'children',
      label: 'الأطفال'
    }, {
      value: 'maintenance',
      label: 'صيانة'
    }]
  }, {
    value: 'bills',
    label: 'فواتير',
    subs: [{
      value: 'electricity',
      label: 'كهرباء'
    }, {
      value: 'telecom',
      label: 'اتصالات'
    }, {
      value: 'internet',
      label: 'إنترنت'
    }, {
      value: 'gas',
      label: 'غاز'
    }]
  }];
  const expenseCategoryTree = [{
    value: 'transport',
    label: 'مواصلات',
    icon: 'car',
    subs: [{
      value: 'fuel',
      label: 'وقود',
      icon: 'fuel'
    }, {
      value: 'maintenance',
      label: 'صيانة',
      icon: 'wrench'
    }, {
      value: 'taxi',
      label: 'أجرة',
      icon: 'car-taxi-front'
    }]
  }, {
    value: 'food',
    label: 'طعام',
    icon: 'utensils',
    subs: [{
      value: 'restaurants',
      label: 'مطاعم',
      icon: 'utensils'
    }, {
      value: 'cafes',
      label: 'مقاهي',
      icon: 'coffee'
    }]
  }, {
    value: 'family',
    label: 'عائلة',
    icon: 'users',
    subs: [{
      value: 'home',
      label: 'المنزل',
      icon: 'home'
    }, {
      value: 'children',
      label: 'الأطفال',
      icon: 'baby'
    }, {
      value: 'maintenance',
      label: 'صيانة',
      icon: 'wrench'
    }]
  }, {
    value: 'bills',
    label: 'فواتير',
    icon: 'receipt',
    subs: [{
      value: 'electricity',
      label: 'كهرباء',
      icon: 'zap'
    }, {
      value: 'telecom',
      label: 'اتصالات',
      icon: 'phone'
    }, {
      value: 'internet',
      label: 'إنترنت',
      icon: 'wifi'
    }, {
      value: 'gas',
      label: 'غاز',
      icon: 'flame'
    }]
  }, {
    value: 'investments',
    label: 'استثمارات',
    icon: 'trending-up',
    disabled: true,
    subs: []
  }];
  const incomeCategoryTree = [{
    value: 'fixed',
    label: 'دخل ثابت',
    icon: 'wallet',
    subs: [{
      value: 'salary',
      label: 'راتب',
      icon: 'banknote'
    }, {
      value: 'pension',
      label: 'معاش',
      icon: 'landmark'
    }]
  }, {
    value: 'extra',
    label: 'دخل إضافي',
    icon: 'sparkles',
    subs: [{
      value: 'freelance',
      label: 'عمل حر',
      icon: 'briefcase'
    }, {
      value: 'refund',
      label: 'استرداد',
      icon: 'rotate-ccw'
    }]
  }];
  const incomeCategoryTreeEn = [{
    value: 'fixed',
    label: 'Fixed income',
    icon: 'wallet',
    subs: [{
      value: 'salary',
      label: 'Salary',
      icon: 'banknote'
    }, {
      value: 'pension',
      label: 'Pension',
      icon: 'landmark'
    }]
  }, {
    value: 'extra',
    label: 'Extra income',
    icon: 'sparkles',
    subs: [{
      value: 'freelance',
      label: 'Freelance',
      icon: 'briefcase'
    }, {
      value: 'refund',
      label: 'Refund',
      icon: 'rotate-ccw'
    }]
  }];
  const workspaceCurrency = 'SAR';
  const files = [{
    id: 'f1',
    fileName: 'receipt-2026-07-13.jpg',
    size: '1.2 MB',
    date: '13/07/2026',
    status: 'ready',
    fileType: 'image',
    linkedTitle: null
  }, {
    id: 'f2',
    fileName: 'invoice-jarir-2026-07-11.pdf',
    size: '340 KB',
    date: '11/07/2026',
    status: 'ready',
    fileType: 'pdf',
    linkedTitle: null
  }, {
    id: 'f3',
    fileName: 'receipt-2026-07-08.jpg',
    size: '980 KB',
    date: '08/07/2026',
    status: 'confirmed',
    fileType: 'image',
    linkedTitle: 'بقالة العائلة'
  }, {
    id: 'f4',
    fileName: 'receipt-blurry-2026-07-09.jpg',
    size: '2.1 MB',
    date: '09/07/2026',
    status: 'failed',
    fileType: 'image',
    linkedTitle: null
  }, {
    id: 'f5',
    fileName: 'invoice-fuel-2026-07-14.pdf',
    size: '510 KB',
    date: '14/07/2026',
    status: 'processing',
    fileType: 'pdf',
    linkedTitle: null
  }, {
    id: 'f6',
    fileName: 'receipt-electricity-2026-07-06.jpg',
    size: '860 KB',
    date: '06/07/2026',
    status: 'confirmed',
    fileType: 'image',
    linkedTitle: 'فاتورة الكهرباء'
  }];
  const members = [{
    id: 'm1',
    name: 'سارة العتيبي',
    email: 'sara@example.com',
    role: 'مالك',
    roleKey: 'owner'
  }, {
    id: 'm2',
    name: 'محمد العتيبي',
    email: 'mohammed@example.com',
    role: 'مشرف',
    roleKey: 'admin'
  }, {
    id: 'm3',
    name: 'نورة العتيبي',
    email: 'noura@example.com',
    role: 'عضو',
    roleKey: 'member'
  }, {
    id: 'm4',
    name: 'خالد العتيبي',
    email: 'khaled@example.com',
    role: 'مشاهد',
    roleKey: 'viewer'
  }];
  const history = [{
    id: 'h1',
    action: 'تم تأكيد مصروف مستخرج بالذكاء الاصطناعي',
    detail: '62.00 ر.س · كافيه العنود',
    actor: 'سارة العتيبي',
    date: '13/07/2026',
    time: '10:42 ص',
    type: 'ai'
  }, {
    id: 'h2',
    action: 'تم حذف مصروف',
    detail: '45.00 ر.س · توصيل طلبات',
    actor: 'محمد العتيبي',
    date: '12/07/2026',
    time: '04:15 م',
    type: 'expense-delete'
  }, {
    id: 'h3',
    action: 'تمت إضافة دخل',
    detail: '1,200.00 ر.س · عمل حر',
    actor: 'سارة العتيبي',
    date: '05/07/2026',
    time: '09:03 ص',
    type: 'income'
  }, {
    id: 'h4',
    action: 'تمت دعوة عضو جديد',
    detail: 'خالد العتيبي كمشاهد',
    actor: 'سارة العتيبي',
    date: '02/07/2026',
    time: '01:27 م',
    type: 'member'
  }];
  const roles = [{
    key: 'owner',
    label: 'مالك'
  }, {
    key: 'admin',
    label: 'مشرف'
  }, {
    key: 'member',
    label: 'عضو'
  }, {
    key: 'viewer',
    label: 'مشاهد'
  }];
  return {
    categories,
    incomeRecords,
    expenseRecords,
    aiQueue,
    files,
    members,
    history,
    roles,
    categoryHierarchy,
    expenseCategoryTree,
    incomeCategoryTree,
    incomeCategoryTreeEn,
    workspaceCurrency
  };
}();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/mock-data.js", error: String((e && e.message) || e) }); }

__ds_ns.Alert = __ds_scope.Alert;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.FilterBar = __ds_scope.FilterBar;

__ds_ns.MobileRecordCard = __ds_scope.MobileRecordCard;

__ds_ns.Pagination = __ds_scope.Pagination;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.Table = __ds_scope.Table;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.ErrorState = __ds_scope.ErrorState;

__ds_ns.PermissionDeniedState = __ds_scope.PermissionDeniedState;

__ds_ns.Skeleton = __ds_scope.Skeleton;

__ds_ns.AIReviewForm = __ds_scope.AIReviewForm;

__ds_ns.Chart = __ds_scope.Chart;

__ds_ns.InfoCard = __ds_scope.InfoCard;

__ds_ns.ReceiptPreview = __ds_scope.ReceiptPreview;

__ds_ns.StatusBadge = __ds_scope.StatusBadge;

__ds_ns.SummaryCard = __ds_scope.SummaryCard;

__ds_ns.AmountInput = __ds_scope.AmountInput;

__ds_ns.DateField = __ds_scope.DateField;

__ds_ns.DateInput = __ds_scope.DateInput;

__ds_ns.FileUpload = __ds_scope.FileUpload;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.LanguageSwitcher = __ds_scope.LanguageSwitcher;

__ds_ns.MobileNav = __ds_scope.MobileNav;

__ds_ns.PageHeading = __ds_scope.PageHeading;

__ds_ns.Sidebar = __ds_scope.Sidebar;

__ds_ns.Tabs = __ds_scope.Tabs;

__ds_ns.TopHeader = __ds_scope.TopHeader;

__ds_ns.WorkspaceSwitcher = __ds_scope.WorkspaceSwitcher;

__ds_ns.CategoryPickerDialog = __ds_scope.CategoryPickerDialog;

__ds_ns.ConfirmDialog = __ds_scope.ConfirmDialog;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.DropdownMenu = __ds_scope.DropdownMenu;

})();
