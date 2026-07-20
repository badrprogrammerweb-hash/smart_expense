Desktop sidebar — sits on the right edge in this RTL app; the divider border uses `borderInlineEnd` so it lands between the sidebar and main content, not the outer screen edge. Fixed item set per the brief (no search, no notification center). Shows a pending-review count badge on AI Review only.

```jsx
<Sidebar active="dashboard" onNavigate={go} workspaceName="عائلة العتيبي" pendingCount={3} />
```
Below 1024px, use MobileNav instead.
