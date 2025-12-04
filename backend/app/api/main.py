# backend/app/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import Base, engine
from app.core.settings import settings  # keep if you use it elsewhere

# Routers
from .LoginPage import router as login_router
from .attempt_submission_test import router as attempts_router
from .courses import router as courses_router
from .registrations import router as registrations_router
from .assignments import router as assignments_router
from .languages import router as languages_router
from .syntax import router as syntax_router

# startup hook
from app.services.piston import get_runtimes, ensure_languages_installed

# App
app = FastAPI(title="AutoGrader API", version="1.0.0")

# ---- Verify database connection on startup ----
@app.on_event("startup")
async def _verify_database():
    """Verify database connection on startup."""
    try:
        from sqlalchemy import inspect
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"[startup] Database connected: {settings.DATABASE_URL}", flush=True)
        print(f"[startup] Found {len(tables)} tables", flush=True)
    except Exception as e:
        print(f"[startup] WARNING: Database connection issue: {e}", flush=True)
        print(f"[startup] Database URL: {settings.DATABASE_URL}", flush=True)
        # Don't raise - let the server start, errors will be caught on first request

# ---- CORS (dev, explicit) ----
ALLOW_ORIGINS = settings.CORS_ORIGINS 
print(">>> CORS allow_origins =", ALLOW_ORIGINS, flush=True)


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],   # you can tighten later
    allow_headers=["*"],   # you can tighten later
)

@app.on_event("startup")
async def _piston_bootstrap():
    """
    Bootstrap Piston: quick check if available, don't block server startup.
    """
    import asyncio
    
    try:
        # Quick single check - don't block server startup
        runtimes = await get_runtimes()
        if "error" in runtimes:
            print(f"[piston] Warning: Piston is not available: {runtimes.get('error', 'Unknown error')}", flush=True)
            print(f"[piston] Server starting without Piston. Code execution/validation requires Docker/Piston to be running.", flush=True)
            return
        
        # Successfully connected
        if isinstance(runtimes, list):
            languages = set(rt.get("language") for rt in runtimes if isinstance(rt, dict))
            print(f"[piston] Connected to Piston. Available languages: {', '.join(sorted(languages))}", flush=True)
        
        # Quick language check in background (don't block)
        # Delay start to let Piston fully initialize
        asyncio.create_task(_install_languages_background())
        
    except Exception as e:
        print(f"[piston] Warning: Could not connect to Piston: {e}", flush=True)
        print(f"[piston] Server starting without Piston. Start Docker/Piston for code execution features.", flush=True)


async def _install_languages_background():
    """Background task to ensure languages are installed - doesn't block startup."""
    import asyncio
    
    # Wait a bit for Piston to fully initialize
    await asyncio.sleep(5)
    
    try:
        print(f"[piston] Checking required languages...", flush=True)
        install_results = await ensure_languages_installed()
        if "error" in install_results:
            print(f"[piston] Warning: Could not ensure languages installed: {install_results['error']}", flush=True)
        else:
            success_count = sum(1 for r in install_results.values() if isinstance(r, dict) and r.get("success", False))
            total_count = len(install_results)
            print(f"[piston] Language check complete: {success_count}/{total_count} languages ready", flush=True)
    except asyncio.CancelledError:
        print(f"[piston] Language installation task cancelled", flush=True)
    except Exception as e:
        print(f"[piston] Warning: Language installation check failed: {e}", flush=True)

# Routers
app.include_router(login_router,       prefix="/api/v1",             tags=["login"])
app.include_router(attempts_router,    prefix="/api/v1/attempts",    tags=["attempts"])
app.include_router(courses_router,        prefix="/api/v1/courses",     tags=["courses"])
app.include_router(registrations_router,  prefix="/api/v1",             tags=["registrations"])
app.include_router(languages_router,      prefix="/api/v1/languages",   tags=["languages"])
app.include_router(syntax_router,         prefix="/api/v1/syntax",      tags=["syntax"])
app.include_router(assignments_router,    prefix="/api/v1/assignments", tags=["assignments"])

# Run the server when executed as a module
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
