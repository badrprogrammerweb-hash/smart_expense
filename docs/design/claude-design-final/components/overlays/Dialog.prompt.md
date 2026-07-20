Base modal shell — forms, filters, member invites. Not for destructive confirmations (use ConfirmDialog).

```jsx
<Dialog open={open} onClose={close} title="دعوة عضو" footer={<><Button variant="secondary" onClick={close}>إلغاء</Button><Button>إرسال الدعوة</Button></>}>
  …form fields…
</Dialog>
```
