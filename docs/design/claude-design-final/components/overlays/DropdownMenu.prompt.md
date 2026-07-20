Click-triggered menu anchored to any element. Set `destructive` on delete/leave items and `disabled` (with the reason communicated elsewhere) for role-restricted actions.

```jsx
<DropdownMenu trigger={<IconButton icon="more-vertical" label="خيارات" />}
  items={[{label:'تعديل',onClick:edit},{divider:true},{label:'حذف',destructive:true,onClick:openConfirm}]} />
```
