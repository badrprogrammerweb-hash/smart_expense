import React from 'react';
import { Badge } from '../core/Badge.jsx';
const map = {
  not_started: { tone: 'neutral', label: 'لم يبدأ' },
  processing: { tone: 'info', label: 'قيد المعالجة' },
  ready: { tone: 'warning', label: 'جاهز للمراجعة' },
  confirmed: { tone: 'income', label: 'مؤكَّد' },
  failed: { tone: 'expense', label: 'فشل' },
  discarded: { tone: 'neutral', label: 'تم التجاهل' },
};
const mapEn = { ready: 'Ready for review', failed: 'Failed' };
export function StatusBadge({ status, lang = 'ar' }) {
  const m = map[status] || map.not_started;
  const label = lang === 'en' && mapEn[status] ? mapEn[status] : m.label;
  return React.createElement(Badge, { tone: m.tone, dot: true }, label);
}
