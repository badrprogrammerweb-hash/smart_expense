import os
from dataclasses import dataclass
from functools import lru_cache

from dotenv import dotenv_values


DEFAULT_CORS_ALLOW_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")
DEFAULT_RATE_LIMIT_SUPPORT_CHECKOUT = 5
DEFAULT_RATE_LIMIT_SUPPORT_VERIFY = 10
DEFAULT_RATE_LIMIT_AI_EXTRACTION = 30
DEFAULT_RATE_LIMIT_AI_SUMMARY = 10
DEV_OR_TEST_ENVIRONMENTS = frozenset({"dev", "development", "local", "test", "testing"})

#: Audience carried by Supabase user access tokens. Verified against this
#: project's own local stack: a freshly issued access token decodes with
#: `"aud": "authenticated"`, which is Supabase's fixed audience for signed-in
#: users. Overridable for deployments that customize it, but the default is the
#: value this project's tokens actually carry rather than an assumption.
DEFAULT_SUPABASE_JWT_AUDIENCE = "authenticated"

#: Path appended to `SUPABASE_URL` to form the issuer. Confirmed against a real
#: token: `"iss": "http://127.0.0.1:54321/auth/v1"` for
#: `SUPABASE_URL=http://127.0.0.1:54321`. Mirrors how `jwks_url` is derived.
SUPABASE_ISSUER_PATH = "/auth/v1"


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_db_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    supabase_jwt_audience: str
    supabase_jwt_issuer: str
    cors_allow_origins: tuple[str, ...]
    stripe_secret_key: str
    stripe_publishable_key: str
    stripe_webhook_signing_secret: str
    apple_app_store_issuer_id: str
    apple_app_store_key_id: str
    apple_app_store_private_key: str
    apple_app_store_environment: str
    apple_app_store_root_certificates: str
    google_play_service_account_json: str
    google_play_notification_audience: str
    google_play_notification_service_account_email: str
    rate_limit_support_checkout: int
    rate_limit_support_verify: int
    rate_limit_ai_extraction: int
    rate_limit_ai_summary: int

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def expected_jwt_issuer(self) -> str:
        """Issuer that a Supabase access token must declare.

        An explicit `SUPABASE_JWT_ISSUER` wins, so a deployment fronting
        Supabase with a custom domain can state its issuer directly. Otherwise
        it is derived from `SUPABASE_URL` exactly as `jwks_url` is.

        Returns an empty string when neither is available. Callers must treat
        that as "cannot verify" and reject, not as "skip the check" — see
        `auth._assert_supabase_claims`.
        """

        if self.supabase_jwt_issuer:
            return self.supabase_jwt_issuer
        if not self.supabase_url:
            return ""
        return f"{self.supabase_url.rstrip('/')}{SUPABASE_ISSUER_PATH}"


def _parse_cors_origins(raw: str) -> tuple[str, ...]:
    origins = tuple(origin.strip() for origin in raw.split(",") if origin.strip())
    return origins or DEFAULT_CORS_ALLOW_ORIGINS


def _positive_int_setting(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip()
    try:
        value = int(raw)
    except ValueError as exc:
        raise ValueError(f"{name} must be a positive integer.") from exc
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer.")
    return value


def is_dev_or_test_environment(app_env: str | None) -> bool:
    """Allow development surfaces only for explicitly recognized APP_ENV values."""

    # Unset, empty, and unrecognized values intentionally select the safe mode.
    return (app_env or "").strip().lower() in DEV_OR_TEST_ENVIRONMENTS


#: `APP_ENV` decides whether `/docs`, `/redoc`, `/openapi.json`, and internal
#: diagnostics are exposed, so it is the one setting a file is never allowed to
#: supply. A stray `.env` left on a production host — or checked out beside the
#: process — must not be able to turn those surfaces back on when the real
#: process environment says nothing. Everything else in `.env` is still honoured.
FILE_EXCLUDED_ENVIRONMENT_NAMES = frozenset({"APP_ENV"})


def load_environment(dotenv_path: str | None = None) -> None:
    """Populate `os.environ` from `.env`, except the deployment-mode switch.

    Mirrors `load_dotenv()`'s precedence — real environment variables win over
    file values — but refuses to let the file introduce any name in
    `FILE_EXCLUDED_ENVIRONMENT_NAMES`.
    """

    for name, value in dotenv_values(dotenv_path).items():
        if value is None or name in FILE_EXCLUDED_ENVIRONMENT_NAMES:
            continue
        os.environ.setdefault(name, value)


@lru_cache
def get_settings() -> Settings:
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").strip(),
        supabase_db_url=os.getenv("SUPABASE_DB_URL", "").strip(),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip(),
        supabase_jwt_secret=os.getenv("SUPABASE_JWT_SECRET", "").strip(),
        supabase_jwt_audience=os.getenv(
            "SUPABASE_JWT_AUDIENCE", DEFAULT_SUPABASE_JWT_AUDIENCE
        ).strip()
        or DEFAULT_SUPABASE_JWT_AUDIENCE,
        supabase_jwt_issuer=os.getenv("SUPABASE_JWT_ISSUER", "").strip(),
        cors_allow_origins=_parse_cors_origins(os.getenv("CORS_ALLOW_ORIGINS", "")),
        stripe_secret_key=os.getenv("STRIPE_SECRET_KEY", "").strip(),
        stripe_publishable_key=os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip(),
        stripe_webhook_signing_secret=os.getenv("STRIPE_WEBHOOK_SIGNING_SECRET", "").strip(),
        apple_app_store_issuer_id=os.getenv("APPLE_APP_STORE_ISSUER_ID", "").strip(),
        apple_app_store_key_id=os.getenv("APPLE_APP_STORE_KEY_ID", "").strip(),
        apple_app_store_private_key=os.getenv("APPLE_APP_STORE_PRIVATE_KEY", "").strip(),
        apple_app_store_environment=os.getenv(
            "APPLE_APP_STORE_ENVIRONMENT", "Production"
        ).strip(),
        apple_app_store_root_certificates=os.getenv(
            "APPLE_APP_STORE_ROOT_CERTIFICATES", ""
        ).strip(),
        google_play_service_account_json=os.getenv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "").strip(),
        google_play_notification_audience=os.getenv(
            "GOOGLE_PLAY_NOTIFICATION_AUDIENCE", ""
        ).strip(),
        google_play_notification_service_account_email=os.getenv(
            "GOOGLE_PLAY_NOTIFICATION_SERVICE_ACCOUNT_EMAIL", ""
        ).strip(),
        rate_limit_support_checkout=_positive_int_setting(
            "RATE_LIMIT_SUPPORT_CHECKOUT", DEFAULT_RATE_LIMIT_SUPPORT_CHECKOUT
        ),
        rate_limit_support_verify=_positive_int_setting(
            "RATE_LIMIT_SUPPORT_VERIFY", DEFAULT_RATE_LIMIT_SUPPORT_VERIFY
        ),
        rate_limit_ai_extraction=_positive_int_setting(
            "RATE_LIMIT_AI_EXTRACTION", DEFAULT_RATE_LIMIT_AI_EXTRACTION
        ),
        rate_limit_ai_summary=_positive_int_setting(
            "RATE_LIMIT_AI_SUMMARY", DEFAULT_RATE_LIMIT_AI_SUMMARY
        ),
    )
