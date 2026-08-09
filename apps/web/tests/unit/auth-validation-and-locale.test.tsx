import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthApiError } from "@supabase/supabase-js";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SignInPage from "@/app/[locale]/(auth)/sign-in/page";
import SignUpPage from "@/app/[locale]/(auth)/sign-up/page";
import arMessages from "@/messages/ar.json";
import enMessages from "@/messages/en.json";

const signInMock = vi.hoisted(() => vi.fn());
const signUpMock = vi.hoisted(() => vi.fn());
const updateLocaleMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn());
const rememberExplicitLocaleMock = vi.hoisted(() => vi.fn());
const routerReplaceMock = vi.hoisted(() => vi.fn());
const currentLocale = vi.hoisted(() => ({ value: "en" as "en" | "ar" }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({
    auth: { signInWithPassword: signInMock, signUp: signUpMock },
  }),
}));

vi.mock("@/lib/api/me", () => ({ updateLocale: updateLocaleMock }));

vi.mock("@/lib/auth-routing", () => ({
  redirectToPreferredWorkspace: redirectMock,
  rememberExplicitLocale: rememberExplicitLocaleMock,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock, push: vi.fn() }),
  usePathname: () => "/sign-up",
}));

vi.mock("next-intl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-intl")>();
  return { ...actual, useLocale: () => currentLocale.value };
});

function renderPage(ui: ReactNode, locale: "en" | "ar") {
  currentLocale.value = locale;
  return render(
    <NextIntlClientProvider locale={locale} messages={locale === "ar" ? arMessages : enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function fill(labels: { email?: string; password?: string }) {
  if (labels.email !== undefined) {
    fireEvent.change(screen.getByLabelText(/Email|البريد الإلكتروني/), {
      target: { value: labels.email },
    });
  }
  if (labels.password !== undefined) {
    fireEvent.change(screen.getByLabelText(/^(Password|كلمة المرور)$/), {
      target: { value: labels.password },
    });
  }
}

function submit(name: RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}

const SIGN_IN = /^(Sign in|تسجيل الدخول)$/;
const SIGN_UP = /^(Create account|إنشاء حساب)$/;

beforeEach(() => {
  signInMock.mockReset().mockResolvedValue({ data: {}, error: null });
  signUpMock.mockReset().mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
  updateLocaleMock.mockReset().mockResolvedValue({ id: "user-1", locale: "en" });
  redirectMock.mockReset().mockResolvedValue(undefined);
  rememberExplicitLocaleMock.mockReset();
  routerReplaceMock.mockReset();
});

afterEach(() => {
  cleanup();
});

// BUG-07: Zod's defaults ("Too small: expected string to have >=6 characters")
// and Supabase's English strings were rendered straight to users.
describe("auth validation messages are localized application copy", () => {
  it("names the missing field rather than emitting a Zod default", async () => {
    renderPage(<SignUpPage />, "en");

    submit(SIGN_UP);

    expect(await screen.findByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("explains an invalid email and a short password in English", async () => {
    renderPage(<SignUpPage />, "en");

    // `user@example` satisfies the input's own type="email" check (HTML allows
    // a dotless domain) but not the schema's, so this is the path a real
    // browser actually reaches — a value the native check rejects never
    // submits at all.
    fill({ email: "user@example", password: "abc" });
    submit(SIGN_UP);

    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Password must be at least 6 characters.")).toBeInTheDocument();
  });

  it("explains the same failures in Arabic", async () => {
    renderPage(<SignUpPage />, "ar");

    fill({ email: "user@example", password: "abc" });
    submit(SIGN_UP);

    expect(await screen.findByText("أدخل بريدًا إلكترونيًا صالحًا.")).toBeInTheDocument();
    expect(
      screen.getByText("يجب أن تتكون كلمة المرور من 6 أحرف على الأقل."),
    ).toBeInTheDocument();
  });

  it("never shows Zod's developer-facing wording", async () => {
    renderPage(<SignUpPage />, "ar");

    fill({ email: "user@example", password: "abc" });
    submit(SIGN_UP);

    await screen.findByText("أدخل بريدًا إلكترونيًا صالحًا.");

    const rendered = document.body.textContent ?? "";
    ["Too small", ">=6", "Invalid email address", "expected string"].forEach((fragment) => {
      expect(rendered).not.toContain(fragment);
    });
  });

  it("replaces Supabase's English invalid-credentials string on the Arabic form", async () => {
    signInMock.mockResolvedValue({
      data: {},
      error: new AuthApiError("Invalid login credentials", 400, "invalid_credentials"),
    });

    renderPage(<SignInPage />, "ar");
    fill({ email: "user@example.com", password: "wrong-password" });
    submit(SIGN_IN);

    expect(
      await screen.findByText("البريد الإلكتروني أو كلمة المرور غير صحيحة."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Invalid login credentials")).not.toBeInTheDocument();
  });

  it("maps a Supabase failure that carries no code by its status", async () => {
    signInMock.mockResolvedValue({
      data: {},
      error: new AuthApiError("Invalid login credentials", 400, undefined),
    });

    renderPage(<SignInPage />, "en");
    fill({ email: "user@example.com", password: "wrong-password" });
    submit(SIGN_IN);

    expect(await screen.findByText("Invalid email or password.")).toBeInTheDocument();
  });

  it("falls back to safe copy for an unrecognised Supabase failure", async () => {
    signUpMock.mockResolvedValue({
      data: {},
      error: new AuthApiError("upstream connect error at auth-internal:9999", 500, "unexpected_failure"),
    });

    renderPage(<SignUpPage />, "ar");
    fill({ email: "user@example.com", password: "correct-horse" });
    submit(SIGN_UP);

    expect(await screen.findByText("حدث خطأ ما. حاول مرة أخرى.")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toContain("auth-internal");
  });
});

// BUG-03: the profile row is created by a database trigger with the column
// default, so signing up from /ar/sign-up produced an English account.
describe("sign-up persists the locale the account was created in", () => {
  it("writes locale ar and routes to the Arabic app from /ar/sign-up", async () => {
    renderPage(<SignUpPage />, "ar");

    fill({ email: "arabic@example.com", password: "correct-horse" });
    submit(SIGN_UP);

    await waitFor(() => expect(updateLocaleMock).toHaveBeenCalledWith("ar"));
    expect(rememberExplicitLocaleMock).toHaveBeenCalledWith("ar");
    expect(redirectMock).toHaveBeenCalledWith("ar", expect.anything());
  });

  it("writes locale en and routes to the English app from /en/sign-up", async () => {
    renderPage(<SignUpPage />, "en");

    fill({ email: "english@example.com", password: "correct-horse" });
    submit(SIGN_UP);

    await waitFor(() => expect(updateLocaleMock).toHaveBeenCalledWith("en"));
    expect(rememberExplicitLocaleMock).toHaveBeenCalledWith("en");
    expect(redirectMock).toHaveBeenCalledWith("en", expect.anything());
  });

  it("records the locale before the redirect reads the stored profile back", async () => {
    const order: string[] = [];
    updateLocaleMock.mockImplementation(async () => {
      order.push("updateLocale");
      return { id: "user-1", locale: "ar" };
    });
    redirectMock.mockImplementation(async () => {
      order.push("redirect");
    });

    renderPage(<SignUpPage />, "ar");
    fill({ email: "arabic@example.com", password: "correct-horse" });
    submit(SIGN_UP);

    // `redirectToPreferredWorkspace` reads the profile locale to choose the
    // destination; writing after it would still land the user in English.
    await waitFor(() => expect(order).toEqual(["updateLocale", "redirect"]));
  });

  it("still enters the app in the chosen language if the preference write fails", async () => {
    updateLocaleMock.mockRejectedValue(new Error("network"));

    renderPage(<SignUpPage />, "ar");
    fill({ email: "arabic@example.com", password: "correct-horse" });
    submit(SIGN_UP);

    // The account exists; blocking entry on a failed preference write would be
    // worse than the bug being fixed.
    await waitFor(() => expect(redirectMock).toHaveBeenCalledWith("ar", expect.anything()));
    expect(rememberExplicitLocaleMock).toHaveBeenCalledWith("ar");
    expect(screen.queryByText(/حدث خطأ|Something went wrong/)).not.toBeInTheDocument();
  });

  it("does not attempt a profile write when sign-up needs email confirmation", async () => {
    signUpMock.mockResolvedValue({ data: { session: null }, error: null });

    renderPage(<SignUpPage />, "ar");
    fill({ email: "arabic@example.com", password: "correct-horse" });
    submit(SIGN_UP);

    // No session means no authenticated PATCH is possible.
    expect(
      await screen.findByText("تحقق من بريدك الإلكتروني لتأكيد حسابك قبل تسجيل الدخول."),
    ).toBeInTheDocument();
    expect(updateLocaleMock).not.toHaveBeenCalled();
  });
});
