Desktop record table. Below 1024px, prefer `MobileRecordCard` instead of forcing this to scroll horizontally.

```jsx
<Table columns={[{key:'merchant',label:'التاجر'},{key:'amount',label:'المبلغ',align:'end',render:r=><span dir="ltr">{r.amount}</span>}]} rows={records} />
```
