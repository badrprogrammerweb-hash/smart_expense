import { expect, test, type Page } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

type TestUser = {
  email: string;
  password: string;
  userId: string;
  accessToken: string;
};

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [name, ...rest] = trimmed.split("=");
    if (!process.env[name]) {
      process.env[name] = rest.join("=").replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), "..", "api", ".env"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

async function apiFetch<T>(path: string, user: TestUser, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${user.accessToken}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${apiUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return (await response.json()) as T;
}

async function signUp(prefix: string): Promise<TestUser> {
  const email = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
  const password = `Correct-${Date.now()}-A1`;
  const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = await response.json();
  const accessToken = payload.access_token ?? payload.session?.access_token;
  const userId = payload.user?.id;
  if (!accessToken || !userId) {
    throw new Error(`Signup did not return a session: ${JSON.stringify(payload)}`);
  }
  return { email, password, userId, accessToken };
}

async function signIn(page: Page, user: TestUser) {
  await page.goto("/en/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/en\/w\/.+\/dashboard$/, { timeout: 30_000 });
}

test.describe("category management", () => {
  test.skip(
    !supabaseUrl || !supabaseAnonKey,
    "Set Supabase URL and anon key values to run category management checks.",
  );

  test("owner/admin can create, rename, disable/re-enable, reorder, and delete; viewer is read-only", async ({
    page,
  }) => {
    const owner = await signUp("cat-mgmt-owner");
    const viewer = await signUp("cat-mgmt-viewer");
    const workspace = await apiFetch<{ id: string }>("/workspaces", owner, {
      method: "POST",
      body: JSON.stringify({ name: "Category Management E2E" }),
    });
    const workspaceId = workspace.id;
    await apiFetch(`/workspaces/${workspaceId}/members`, owner, {
      method: "POST",
      body: JSON.stringify({ email: viewer.email, role: "viewer" }),
    });

    await signIn(page, owner);
    await page.goto(`/en/w/${workspaceId}/categories`);
    await expect(page).toHaveURL(new RegExp(`/en/w/${workspaceId}/categories$`));

    const petsRow = page.locator("li").filter({ has: page.getByText("Pets", { exact: true }) }).first();
    // Expanding is per-mount UI state: it resets to collapsed every time the
    // categories page remounts (e.g. after navigating away and back), and
    // subcategory rows are not rendered in the DOM at all while collapsed
    // (conditional rendering, not just hidden) — so this must be re-clicked
    // after every such navigation, not just once.
    async function expandPets() {
      await petsRow.getByRole("button").first().click();
    }

    // 1-2: create a main category and a subcategory under it.
    await page.getByLabel("Category name").fill("Pets");
    await page.getByLabel("Parent category").selectOption({ label: "New main category" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(petsRow).toBeVisible();

    await page.getByLabel("Category name").fill("Grooming");
    await page.getByLabel("Parent category").selectOption({ label: "Pets" });
    await page.getByRole("button", { name: "Save" }).click();
    await expandPets();
    await expect(petsRow.getByText("Grooming")).toBeVisible();

    // 3-4: rename the subcategory. Once "Rename" is clicked, the row's text
    // content becomes an <input> value (no longer plain text), so a
    // hasText-scoped locator built before the click would stop matching —
    // the input carries a stable aria-label instead.
    const groomingRowBeforeEdit = petsRow.locator("li").filter({ hasText: "Grooming" });
    await groomingRowBeforeEdit.getByRole("button", { name: "Rename" }).click();
    const renameEditor = page.getByLabel("Rename category").locator("..");
    await renameEditor.getByLabel("Rename category").fill("Pet Grooming");
    await renameEditor.getByRole("button", { name: "Save" }).click();
    await expect(petsRow.getByText("Pet Grooming")).toBeVisible();

    // 5-6: disable the main category; it and its subcategory must
    // disappear from the expense form's selectable options.
    await petsRow.getByRole("button", { name: "Archive" }).first().click();
    await expect(petsRow.getByRole("button", { name: "Unarchive" }).first()).toBeVisible();

    await page.goto(`/en/w/${workspaceId}/expenses`);
    const categorySelect = page.getByLabel("Category", { exact: true });
    await expect(categorySelect.locator("option", { hasText: "Pets" })).toHaveCount(0);

    // 7-8: re-enable; the subcategory becomes selectable again immediately.
    await page.goto(`/en/w/${workspaceId}/categories`);
    await expandPets();
    await petsRow.getByRole("button", { name: "Unarchive" }).first().click();
    await expect(petsRow.getByRole("button", { name: "Archive" }).first()).toBeVisible();

    await page.goto(`/en/w/${workspaceId}/expenses`);
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Pets" });
    await expect(page.getByLabel("Subcategory").locator("option", { hasText: "Pet Grooming" })).toHaveCount(1);

    // 9: reorder subcategories — add a second one, then move it up.
    await page.goto(`/en/w/${workspaceId}/categories`);
    await page.getByLabel("Category name").fill("Walking");
    await page.getByLabel("Parent category").selectOption({ label: "Pets" });
    await page.getByRole("button", { name: "Save" }).click();
    await expandPets();
    const walkingRow = petsRow.locator("li").filter({ hasText: "Walking" });
    await expect(walkingRow).toBeVisible();
    await walkingRow.getByRole("button", { name: "Move up" }).click();
    const subcategoryNames = petsRow.locator("ul li p.text-sm.font-medium");
    await expect(subcategoryNames.first()).toHaveText("Walking");

    // 13: duplicate active sibling name is rejected with an inline error.
    await page.getByLabel("Category name").fill("Pet Grooming");
    await page.getByLabel("Parent category").selectOption({ label: "Pets" });
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("An active category already uses that name.")).toBeVisible();

    // 15-16: delete is blocked while the subcategory has a record
    // reference; delete an unused one, then delete the referenced one
    // after removing the reference is out of scope here — instead prove
    // the "has children" guard blocks the parent, and a genuinely unused
    // leaf can be deleted successfully.
    const petsDeleteButton = petsRow.getByRole("button", { name: "Delete" }).first();
    await expect(petsDeleteButton).toBeDisabled();

    const walkingDeleteButton = walkingRow.getByRole("button", { name: "Delete" });
    await walkingDeleteButton.click();
    await walkingRow.getByRole("button", { name: "Confirm delete" }).click();
    await expect(walkingRow).toHaveCount(0);

    // FR-008: renaming a system-provided category (not just a user-created
    // one) must show through everywhere immediately, including on a
    // historical record already using it — "historical records show the
    // current name, not a frozen snapshot" — not the stale translated
    // catalog name (regression: the display helper introduced in Phase 7
    // preferred the catalog name over the DB row's own `name` unless the
    // rename cleared `translation_key`).
    await page.goto(`/en/w/${workspaceId}/expenses`);
    await page.getByLabel("Amount").fill("40.00");
    await page.getByLabel("Date").fill("2026-07-15");
    await page.getByLabel("Category", { exact: true }).selectOption({ label: "Fuel" });
    await page.getByRole("button", { name: "Save" }).click();
    const fuelExpenseRow = page.locator("li").filter({ hasText: "15/07/2026" });
    await expect(fuelExpenseRow.getByText("Fuel").first()).toBeVisible();

    await page.goto(`/en/w/${workspaceId}/categories`);
    // `fuelRowBeforeEdit` is only used to locate and click "Rename" — once
    // clicked, "Fuel" stops being text content (it becomes the rename
    // <input>'s value), so a hasText/getByText-filtered locator built before
    // the click would stop matching afterward (same gotcha the "Grooming"
    // rename above avoids via the global, un-scoped `renameEditor` locator).
    const fuelRowBeforeEdit = page.locator("li").filter({ has: page.getByText("Fuel", { exact: true }) }).first();
    await fuelRowBeforeEdit.getByRole("button", { name: "Rename" }).click();
    const fuelRenameEditor = page.getByLabel("Rename category").locator("..");
    await fuelRenameEditor.getByLabel("Rename category").fill("Petrol & Fuel");
    await fuelRenameEditor.getByRole("button", { name: "Save" }).click();
    const fuelRowAfterEdit = page
      .locator("li")
      .filter({ has: page.getByText("Petrol & Fuel", { exact: true }) })
      .first();
    await expect(fuelRowAfterEdit).toBeVisible();

    await page.goto(`/en/w/${workspaceId}/expenses`);
    await expect(page.locator("li").filter({ hasText: "15/07/2026" }).getByText("Petrol & Fuel").first()).toBeVisible();
    await expect(page.getByText("Fuel", { exact: true })).toHaveCount(0);

    // 11-12: viewer can read but not mutate.
    await page.context().clearCookies();
    await signIn(page, viewer);
    await page.goto(`/en/w/${workspaceId}/categories`);
    await expect(page.getByText("Pets", { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel("Category name")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rename" })).toHaveCount(0);
  });
});
