Dashboard's core financial figures. Only the remaining-balance card should ever set `emphasis` — the brief requires balance to visually dominate; income/expense/pending cards stay one size down.

```jsx
<SummaryCard label="الرصيد المتبقي" amount="3,420.00" icon="wallet" emphasis />
<SummaryCard label="الدخل" amount="8,500.00" kind="income" icon="trending-up" />
```
