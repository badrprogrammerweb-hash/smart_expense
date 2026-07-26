import os
from dataclasses import dataclass
from functools import lru_cache


DEFAULT_CORS_ALLOW_ORIGINS = ("http://localhost:3000", "http://127.0.0.1:3000")


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_db_url: str
    supabase_service_role_key: str
    supabase_jwt_secret: str
    cors_allow_origins: tuple[str, ...]
    stripe_secret_key: str
    stripe_publishable_key: str
    stripe_webhook_signing_secret: str
    apple_app_store_issuer_id: str
    apple_app_store_key_id: str
    apple_app_store_private_key: str
    google_play_service_account_json: str

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _parse_cors_origins(raw: str) -> tuple[str, ...]:
    origins = tuple(origin.strip() for origin in raw.split(",") if origin.strip())
    return origins or DEFAULT_CORS_ALLOW_ORIGINS


@lru_cache
def get_settings() -> Settings:
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL", "").strip(),
        supabase_db_url=os.getenv("SUPABASE_DB_URL", "").strip(),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip(),
        supabase_jwt_secret=os.getenv("SUPABASE_JWT_SECRET", "").strip(),
        cors_allow_origins=_parse_cors_origins(os.getenv("CORS_ALLOW_ORIGINS", "")),
        stripe_secret_key=os.getenv("STRIPE_SECRET_KEY", "").strip(),
        stripe_publishable_key=os.getenv("STRIPE_PUBLISHABLE_KEY", "").strip(),
        stripe_webhook_signing_secret=os.getenv("STRIPE_WEBHOOK_SIGNING_SECRET", "").strip(),
        apple_app_store_issuer_id=os.getenv("APPLE_APP_STORE_ISSUER_ID", "").strip(),
        apple_app_store_key_id=os.getenv("APPLE_APP_STORE_KEY_ID", "").strip(),
        apple_app_store_private_key=os.getenv("APPLE_APP_STORE_PRIVATE_KEY", "").strip(),
        google_play_service_account_json=os.getenv("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "").strip(),
    )
