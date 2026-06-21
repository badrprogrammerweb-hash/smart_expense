import os
from typing import Literal
from urllib.error import URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter


router = APIRouter()
DatabaseStatus = Literal["ok", "not_configured", "error"]


def _database_status() -> DatabaseStatus:
    supabase_url = os.getenv("SUPABASE_URL", "").strip()
    service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()

    if not supabase_url or not service_role_key:
        return "not_configured"

    request = Request(
        f"{supabase_url.rstrip('/')}/rest/v1/",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
        },
    )

    try:
        with urlopen(request, timeout=3) as response:
            return "ok" if 200 <= response.status < 400 else "error"
    except (URLError, TimeoutError, ValueError):
        return "error"


@router.get("/health")
def health() -> dict[str, object]:
    return {
        "status": "ok",
        "dependencies": {"database": _database_status()},
    }
