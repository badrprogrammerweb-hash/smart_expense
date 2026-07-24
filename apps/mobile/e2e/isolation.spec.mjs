import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const mobileRoot = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(mobileRoot, "..", "..");
const webRoot = resolve(repositoryRoot, "apps", "web");

function webSource(...segments) {
  return readFile(resolve(webRoot, ...segments), "utf8");
}

// T044/T046, contracts/on-device-security.md rule 4: a workspace switch must
// purge the previous workspace's cached queries so no A data can render
// under B, including while offline. A real multi-workspace device run is
// covered by the documented manual sweep (quickstart.md); the eviction
// predicate itself is unit-tested directly against a real QueryClient in
// apps/web/lib/__tests__/workspace-context.test.ts.
test("switching workspaces evicts every query scoped to the previous workspace", async () => {
  const workspaceContext = await webSource("lib", "workspace-context.tsx");

  assert.match(workspaceContext, /evictQueriesForPreviousWorkspace/);
  assert.match(workspaceContext, /previousWorkspaceId !== workspaceId/);
  assert.match(workspaceContext, /queryClient\.removeQueries/);
});

// T044/T047, rules 5 & 6: sign-out must clear the secure session AND every
// in-memory cache (react-query plus the native-only last-workspace hint that
// lives outside react-query) so a different user signing in afterwards never
// inherits the previous user's data.
test("sign-out clears the secure session, the query cache, and the native last-workspace hint", async () => {
  const [workspaceShell, workspaceContext] = await Promise.all([
    webSource("components", "layout", "WorkspaceShell.tsx"),
    webSource("lib", "workspace-context.tsx"),
  ]);

  assert.match(workspaceShell, /supabase\.auth\.signOut\(\)/);
  // A comprehensive prefix-sweep backstop, not just trusting Supabase's own
  // internal key list — see secure-storage.spec.mjs for the module itself.
  assert.match(workspaceShell, /nativeSecureSession\(\)\?\.clear\(\)/);
  assert.match(workspaceShell, /queryClient\.clear\(\)/);
  assert.match(workspaceShell, /clearNativeLastWorkspaceId\(\)/);
  assert.match(workspaceContext, /export function clearNativeLastWorkspaceId/);

  // Order matters: signOut()'s network call needs the still-valid access
  // token to invalidate the session server-side before we erase it locally.
  assert.ok(workspaceShell.indexOf("supabase.auth.signOut()") < workspaceShell.indexOf("nativeSecureSession()?.clear()"));
});

// T044/T047, rule 6: the native last-workspace hint is a module variable
// (not persistent storage) scoped per running app process, and is native-only
// — the web fallback (localStorage) is a separate, already-isolated-per-origin
// path. A second user's fresh sign-in never reads a value written before it
// was cleared.
test("the native last-workspace hint never falls back to persistent web storage while native", async () => {
  const workspaceContext = await webSource("lib", "workspace-context.tsx");

  assert.match(workspaceContext, /nativeLastWorkspaceId = workspaceId/);
  assert.match(workspaceContext, /isNative\(\) \? nativeLastWorkspaceId/);
});

// T044/T049, rule 9 + FR-010: a session that expired or was revoked
// (including while offline) must return the user to sign-in on the next
// protected action or reconnect, clearing the in-memory cache first so no
// stale workspace data from the expired session is ever shown.
test("an expired or missing session clears the query cache before redirecting to sign-in", async () => {
  const apiClient = await webSource("lib", "api", "client.ts");

  assert.match(apiClient, /clearInMemoryQueryCache\(\)/);
  assert.match(apiClient, /if \(!session\?\.access_token\)/);
  assert.match(apiClient, /response\.status === 401/);
  // Cache clearing must precede navigation, or a stale screen could flash
  // before the redirect completes. Both calls exist exactly once in this
  // file (inside redirectToSignIn), so a whole-file ordering check is exact.
  assert.ok(apiClient.indexOf("clearInMemoryQueryCache()") < apiClient.indexOf("window.location.assign"));
});

// T049, rule 8: the native shell reuses the Phase 15 read-only offline
// model verbatim — no offline write path, no queued/replayed mutation, no
// automatic retry — gated by the same connectivity signal every mutating
// surface already consumes.
test("the connectivity gate blocks mutation with no offline write path", async () => {
  const connectivityProvider = await webSource("components", "connectivity", "ConnectivityProvider.tsx");

  assert.match(connectivityProvider, /canMutate/);
  assert.doesNotMatch(connectivityProvider, /queue|replay|retry/i);
});
