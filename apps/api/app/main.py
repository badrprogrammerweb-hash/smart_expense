from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.routes.categories import router as categories_router
from app.routes.dashboard import router as dashboard_router
from app.routes.expenses import router as expenses_router
from app.routes.files import router as files_router
from app.routes.health import router as health_router
from app.routes.incomes import router as incomes_router
from app.routes.workspace_members import router as workspace_members_router
from app.routes.workspaces import router as workspaces_router


load_dotenv()
configure_logging()

app = FastAPI(title="Smart Expense API")

# apps/web calls this API directly from the browser (Authorization: Bearer
# <token>, never cookies), so credentials aren't needed here — only an
# explicit origin allow-list for the preflight to succeed.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(get_settings().cors_allow_origins),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _default_error(status_code: int) -> tuple[str, str]:
    if status_code == 401:
        return "unauthenticated", "Sign in to continue."
    if status_code == 403:
        return "forbidden", "You do not have permission to do that."
    if status_code == 404:
        return "not_found", "Workspace not found."
    if status_code == 409:
        return "conflict", "Request conflicts with the current workspace state."
    if status_code == 422:
        return "invalid_request", "Request is not valid."
    return "error", "Something went wrong."


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict):
        code = str(exc.detail.get("code") or _default_error(exc.status_code)[0])
        message = str(exc.detail.get("message") or _default_error(exc.status_code)[1])
    else:
        code, message = _default_error(exc.status_code)
    error = {"code": code, "message": message}
    if isinstance(exc.detail, dict) and exc.detail.get("diagnostic"):
        error["diagnostic"] = str(exc.detail["diagnostic"])
    if isinstance(exc.detail, dict):
        for key, value in exc.detail.items():
            if key not in {"code", "message", "diagnostic"}:
                error[key] = value
    return JSONResponse(status_code=exc.status_code, content={"error": error})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    if any(tuple(error.get("loc", ()))[-1:] == ("recent_limit",) for error in exc.errors()):
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "invalid_limit",
                    "message": "recent_limit must be an integer between 1 and 50.",
                }
            },
        )
    code, message = _default_error(422)
    return JSONResponse(status_code=422, content={"error": {"code": code, "message": message}})


app.include_router(health_router)
app.include_router(workspaces_router)
app.include_router(workspace_members_router)
app.include_router(incomes_router)
app.include_router(expenses_router)
app.include_router(categories_router)
app.include_router(files_router)
app.include_router(dashboard_router)
