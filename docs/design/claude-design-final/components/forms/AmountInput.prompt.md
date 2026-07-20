Amount field for income/expense forms — large tabular numerals, `ر.س` suffix locked to the field (never wraps away from the number), whole field isolated `dir="ltr"` so typing and cursor behave correctly.

```jsx
<AmountInput label="المبلغ" kind="expense" value={amount} onChange={set} required />
```
