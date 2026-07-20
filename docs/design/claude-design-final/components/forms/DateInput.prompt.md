Date field, always `DD/MM/YYYY`, whole input `dir="ltr"` so the day/month/year order and slashes never reverse — the canonical fix for F-001. Pair with a real calendar popover in production; this is the field shell.

```jsx
<DateInput label="تاريخ العملية" value="13/07/2026" onChange={set} required />
```
