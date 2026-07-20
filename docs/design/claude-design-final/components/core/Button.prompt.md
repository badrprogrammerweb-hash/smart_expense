Standard action button — 4 variants, 3 sizes, optional icon, loading state that keeps size fixed.

```jsx
<Button variant="primary" icon="plus">إضافة مصروف</Button>
<Button variant="destructive" loading>جارٍ الحذف…</Button>
```

`destructive` is reserved for delete/discard/leave-workspace actions and always pairs with a ConfirmDialog. `ghost` is for low-emphasis actions inside toolbars/cards.
