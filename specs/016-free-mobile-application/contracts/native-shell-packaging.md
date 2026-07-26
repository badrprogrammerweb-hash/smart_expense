# Contract: Native Shell Packaging

**Type**: Behavioural / build contract (not an HTTP API). Binding for this phase.

## Purpose

Define what the native shell is and is not, so the app reuses the existing web
experience and backend without becoming a rewrite or a remote-URL viewer.

## Rules

1. **Local bundle, remote data**: The native shell MUST bundle a build of the
   existing `apps/web` UI as **local** assets (`webDir`) and MUST NOT load its
   shell from a remote URL. All business/financial data MUST be fetched from the
   **existing remote** FastAPI backend and Supabase over the network.
2. **No reimplemented logic**: The shell MUST NOT reimplement any financial
   calculation, permission check, or business rule. It reuses the same React
   components and `components/ui` primitives.
3. **Additive shims only in `apps/web`**: Changes to `apps/web` are limited to
   additive capability shims (detect Capacitor; route camera / secure storage /
   deep links to native, else existing web behaviour). No endpoint, financial
   logic, or display-only-posture change.
4. **App identity**: Each platform MUST declare a correct, non-placeholder name,
   icon set, and splash consistent with the approved design system, understandable
   to both Arabic and English audiences.
5. **Standalone launch**: The app MUST launch full-screen (no browser chrome)
   into the correct locale/direction and resume a valid secure session.
6. **Update path**: Users are kept current via the stores' native update
   mechanisms. NO backend version-gate endpoint or contract is added.
7. **Free**: The package MUST declare no in-app purchase entitlement and MUST NOT
   gate any functionality behind payment.

## Verification

- The built native app runs with network disabled for the shell (shell renders
  from local bundle; data views show the offline state).
- Inspect config: `server.url` is unset / points to no remote shell.
- `apps/api` and `supabase` diffs are empty; backend `pytest` suite passes
  unmodified.
- Store build declares free / no-IAP.
