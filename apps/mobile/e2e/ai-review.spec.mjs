import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repositoryRoot = resolve(import.meta.dirname, "..", "..", "..");
const webRoot = resolve(repositoryRoot, "apps", "web");

function source(...segments) {
  return readFile(resolve(webRoot, ...segments), "utf8");
}

// T037/T042: the packaged native shell reuses the existing Phase 8 extraction
// review flow verbatim — start/confirm/discard all call the existing remote
// endpoints via apiFetch, a confirmed extraction carries the resulting
// expense_id, and no mobile-only extraction logic or endpoint exists. A
// device-level "review a real receipt end-to-end" run is covered by the
// documented manual sweep instead (quickstart.md).
test("extraction start, confirm, and discard all call the existing backend endpoints", async () => {
  const extractionsApi = await source("lib", "api", "extractions.ts");

  assert.match(extractionsApi, /apiFetch<ExtractionRecord>/);
  assert.match(extractionsApi, /\/workspaces\/\$\{workspaceId\}\/files\/\$\{fileId\}\/extractions/);
  assert.match(extractionsApi, /\/workspaces\/\$\{workspaceId\}\/extractions\/\$\{extractionId\}\/confirm/);
  assert.match(extractionsApi, /\/workspaces\/\$\{workspaceId\}\/extractions\/\$\{extractionId\}\/discard/);
  assert.match(extractionsApi, /expense_id: string \| null/);
  assert.match(extractionsApi, /status: ExtractionStatus/);
});

// A confirmed extraction becomes an expense; failed and discarded results
// must never be treated as one. The mobile bundle reuses this exact form —
// no local financial logic exists to diverge from it.
test("confirmed extraction becomes an expense via the shared review form; discard is a separate explicit action", async () => {
  const [reviewForm, discardDialog, statusBadge] = await Promise.all([
    source("components", "extraction", "ExtractionReviewForm.tsx"),
    source("components", "extraction", "DiscardExtractionDialog.tsx"),
    source("components", "extraction", "ExtractionStatusBadge.tsx"),
  ]);

  assert.match(reviewForm, /confirmExtraction\(workspaceId, extraction\.id, input\)/);
  assert.match(reviewForm, /onConfirmed\?\.\(confirmed\)/);
  assert.match(discardDialog, /discardExtraction\(workspaceId, extraction\.id\)/);
  assert.match(discardDialog, /invalidateQueries\(\{ queryKey: \["extractions", workspaceId\] \}\)/);
  assert.doesNotMatch(reviewForm, /localStorage|sessionStorage/);
  assert.doesNotMatch(discardDialog, /localStorage|sessionStorage/);
  assert.match(statusBadge, /"processing"|"ready_for_review"|"failed"|"confirmed"|"discarded"/s);
});
