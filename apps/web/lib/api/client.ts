import { isLocale, routing } from "@/i18n/routing";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type ErrorShape = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function apiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
}

function redirectToSignIn() {
  if (typeof window === "undefined") {
    return;
  }

  const [, maybeLocale] = window.location.pathname.split("/");
  const locale = isLocale(maybeLocale) ? maybeLocale : routing.defaultLocale;
  window.location.assign(`/${locale}/sign-in`);
}

async function parseError(response: Response) {
  try {
    const body = (await response.json()) as ErrorShape;
    return {
      code: body.error?.code ?? "request_failed",
      message: body.error?.message ?? "The request failed.",
    };
  } catch {
    return {
      code: "request_failed",
      message: "The request failed.",
    };
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    redirectToSignIn();
    throw new ApiError(401, "unauthenticated", "Sign in to continue.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    const error = await parseError(response);

    if (response.status === 401) {
      redirectToSignIn();
    }

    throw new ApiError(response.status, error.code, error.message);
  }

  return (await response.json()) as T;
}
