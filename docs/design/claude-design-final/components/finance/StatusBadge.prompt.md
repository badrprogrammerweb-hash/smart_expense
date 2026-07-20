Fixed status→color mapping for AI extraction records — never restyle per-screen. `ready` (amber) must never look like `confirmed` (green): pending AI data must not be mistaken for a confirmed transaction.

```jsx
<StatusBadge status="ready" />
```
