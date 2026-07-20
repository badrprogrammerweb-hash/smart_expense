The AI review screen's core: original receipt beside editable extracted fields, never presented as a confirmed record until the user confirms. `errorMessage` should name the specific failure (invalid key, quota, unreadable image, provider failure) — never a generic error. Pass `categoryHierarchy` for the Phase 13 main+sub category picker (choosing a main category resets the sub); pass `receiptCurrency`/`workspaceCurrency` for the Phase 12 currency-mismatch warning (no auto-conversion implied).

```jsx
<AIReviewForm receipt={{src:url,fileName:'r.jpg'}} status="ready" fields={fields} onFieldChange={set}
  categoryHierarchy={[{value:'food',label:'طعام',subs:[{value:'cafes',label:'مقاهي'}]}]}
  receiptCurrency="USD" workspaceCurrency="SAR" onConfirm={confirm} onDiscard={discard} />
```
