import tomllib
from pathlib import Path


def test_only_email_password_auth_is_enabled() -> None:
    config_path = Path(__file__).resolve().parents[3] / "supabase" / "config.toml"
    config = tomllib.loads(config_path.read_text(encoding="utf-8"))

    assert config["auth"]["email"]["enable_signup"] is True
    assert config["auth"]["sms"]["enable_signup"] is False

    external_providers = config["auth"].get("external", {})
    assert external_providers, "Expected explicit external provider blocks"
    for provider, settings in external_providers.items():
        assert settings.get("enabled") is False, f"{provider} provider must stay disabled"
