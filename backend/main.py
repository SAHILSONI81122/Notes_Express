from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from backend.routes import auth, users, notes, dpp, tracking, batches, class_groups, doubts, upload
from backend.database.database import engine, Base
import logging
import os
from dotenv import load_dotenv

from backend.services.limiter import limiter

load_dotenv(override=True)

logger = logging.getLogger("notesexpress")

# ── Lifespan (replaces deprecated @app.on_event) ──────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        if not os.environ.get("VERCEL"):
            os.makedirs("backend/uploads", exist_ok=True)
    except Exception as e:
        logger.warning(f"Could not create uploads directory: {e}")

    # Create tables that don't exist yet (dev convenience).
    # In production: run `alembic upgrade head` instead.
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        logger.error(f"Database connection failed during startup: {e}")

    logger.info("NotesExpress API started.")
    yield
    # ── Shutdown ──────────────────────────────────────────────────────────────
    logger.info("NotesExpress API shutting down.")

# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="NotesExpress API",
    version="1.0.0",
    lifespan=lifespan,
)

# Attach rate limiter state & error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Static file serving ────────────────────────────────────────────────────────
if os.path.exists("backend/uploads"):
    app.mount("/uploads", StaticFiles(directory="backend/uploads"), name="uploads")

# ── CORS ───────────────────────────────────────────────────────────────────────
# In production set ALLOWED_ORIGINS=https://yourdomain.com in .env
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(notes.router)
app.include_router(dpp.router)
app.include_router(tracking.router)
app.include_router(batches.router)
app.include_router(class_groups.router)
app.include_router(doubts.router)
app.include_router(upload.router)

# ── Health check ───────────────────────────────────────────────────────────────
@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok", "version": "1.0.0"}

@app.get("/", tags=["system"])
def root():
    return {"message": "Welcome to NotesExpress API"}
