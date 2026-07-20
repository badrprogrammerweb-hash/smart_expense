Required wrapper for every delete/discard/leave-workspace action. Always states the consequence in plain Arabic before completion.

```jsx
<ConfirmDialog open={open} onClose={close} onConfirm={del}
  title="حذف هذا المصروف؟"
  description="سيتم حذف هذا السجل نهائيًا. لا يمكن التراجع عن هذا الإجراء." />
```
