Table/list pagination. Pass `dir` to flip chevrons for LTR (Phase 12): in RTL "previous" points right and "next" points left (already the default); in LTR they invert.

```jsx
<Pagination page={2} totalPages={8} onChange={setPage} />
<Pagination page={2} totalPages={8} dir="ltr" onChange={setPage} />
```
