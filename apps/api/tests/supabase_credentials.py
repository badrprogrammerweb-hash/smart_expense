"""Shared discovery of local Supabase credentials for the test suites.

Deliberately a plain module rather than part of `conftest.py`: `tests/` and
`tests/acceptance/` both contain a `conftest.py`, so a bare `from conftest
import ...` resolves to whichever one pytest put on `sys.path` first. A uniquely
named module cannot be shadowed that way.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

_CLI_TIMEOUT_SECONDS = 30


def _supabase_cli_command() -> list[str] | None:
    """Locate the Supabase CLI however it happens to be installed.

    CI installs the standalone binary through `supabase/setup-cli`, so it is on
    PATH but is **not** an npm package — `npx --no-install supabase` fails there,
    which is what broke the exposure suites. A local checkout may instead have it
    only as an npm dependency. Prefer the standalone binary; fall back to npx just
    when the package is genuinely resolvable.
    """

    standalone = shutil.which("supabase")
    if standalone:
        return [standalone]

    npx = shutil.which("npx")
    if not npx:
        return None
    probe = subprocess.run(
        [npx, "--no-install", "supabase", "--version"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=_CLI_TIMEOUT_SECONDS,
        check=False,
    )
    if probe.returncode != 0:
        return None
    return [npx, "--no-install", "supabase"]


def _supabase_status_env() -> dict[str, str]:
    command = _supabase_cli_command()
    if command is None:
        return {}
    completed = subprocess.run(
        [*command, "status", "-o", "env"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=_CLI_TIMEOUT_SECONDS,
        check=False,
    )
    if completed.returncode != 0:
        return {}
    values: dict[str, str] = {}
    for line in completed.stdout.splitlines():
        name, separator, value = line.partition("=")
        if separator:
            values[name.strip()] = value.strip().strip('"')
    return values


def local_supabase_credential(name: str) -> str:
    """Return a local-stack credential such as `ANON_KEY` or `SERVICE_ROLE_KEY`.

    Resolution order: the explicit `SUPABASE_<NAME>` environment variable that CI
    exports, then the local CLI. Raises with a setup-oriented message rather than
    returning an empty string, so an unavailable local stack can never quietly
    degrade a security assertion into a vacuous pass.
    """

    configured = os.getenv(f"SUPABASE_{name}", "").strip()
    if configured:
        return configured

    value = _supabase_status_env().get(name, "").strip()
    if value:
        return value

    raise RuntimeError(
        f"SUPABASE_{name} is not set and the local Supabase CLI could not supply "
        f"{name}. Export SUPABASE_{name}, or run `supabase start` in the repository "
        "root before running these tests."
    )
