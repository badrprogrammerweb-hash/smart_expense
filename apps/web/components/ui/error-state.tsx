import { Alert } from "@/components/ui/alert";

type ErrorStateProps = { title?: string; description: string; testId?: string } & (
  | { retry?: undefined; retryLabel?: undefined }
  | { retry: () => void; retryLabel: string }
);

// `retryLabel` is required whenever `retry` is supplied: this primitive
// renders no `useTranslations` of its own, so a hardcoded English fallback
// here would silently show untranslated text in the Arabic UI (FR-006).
export function ErrorState({ title = "Something went wrong", description, retry, retryLabel, testId }: ErrorStateProps) {
  return <Alert variant="error" title={title} data-testid={testId}>{description}{retry ? <button className="mt-2 underline" onClick={retry}>{retryLabel}</button> : null}</Alert>;
}
