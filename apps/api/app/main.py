from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

from app.core.logging import configure_logging
from app.routes.expenses import router as expenses_router
from app.routes.health import router as health_router
from app.routes.incomes import router as incomes_router
from app.routes.workspace_members import router as workspace_members_router
from app.routes.workspaces import router as workspaces_router


load_dotenv()
configure_logging()

app = FastAPI(title="Smart Expense API")


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
    return JSONResponse(status_code=exc.status_code, content={"error": error})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, __: RequestValidationError) -> JSONResponse:
    code, message = _default_error(422)
    return JSONResponse(status_code=422, content={"error": {"code": code, "message": message}})


app.include_router(health_router)
app.include_router(workspaces_router)
app.include_router(workspace_members_router)
app.include_router(incomes_router)
app.include_router(expenses_router)
