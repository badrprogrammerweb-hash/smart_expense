User-level language preference, always shown separate from `WorkspaceSwitcher` (language belongs to the user; currency/workspace belongs to the workspace — never merge the two). The parent `TopHeader` renders it twice (a desktop inline slot and a mobile second-row slot, toggled by CSS) and owns the shared "Future state — Phase 12" note — don't add a badge inside this component itself.

```jsx
<LanguageSwitcher lang={lang} onChange={setLang} />
```
