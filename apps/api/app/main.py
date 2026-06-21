from fastapi import FastAPI
from dotenv import load_dotenv

from app.routes.health import router as health_router


load_dotenv()

app = FastAPI(title="Smart Expense API")
app.include_router(health_router)
