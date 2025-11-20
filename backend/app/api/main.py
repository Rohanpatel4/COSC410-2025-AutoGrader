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

# startup hook
from app.services.piston import get_runtimes, ensure_languages_installed

# App
app = FastAPI(title="AutoGrader API", version="1.0.0")

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
    """Bootstrap Piston: check status and ensure required languages are installed."""
    import asyncio
    
    # Retry connecting to Piston with exponential backoff
    max_retries = 10
    retry_delay = 1.0  # Start with 1 second
    
    for attempt in range(max_retries):
        try:
            # First, check Piston is accessible
            runtimes = await get_runtimes()
            if "error" in runtimes:
                if attempt < max_retries - 1:
                    print(f"[piston] Waiting for Piston to be ready... (attempt {attempt + 1}/{max_retries})", flush=True)
                    await asyncio.sleep(retry_delay)
                    retry_delay = min(retry_delay * 1.5, 5.0)  # Exponential backoff, max 5 seconds
                    continue
                else:
                    print(f"[piston] Warning: Could not fetch runtimes after {max_retries} attempts: {runtimes['error']}", flush=True)
                    print(f"[piston] Skipping language installation check.", flush=True)
                    return
            else:
                # Successfully connected
                languages = set(rt.get("language") for rt in runtimes if isinstance(rt, dict))
                print(f"[piston] Connected to Piston. Available languages in runtimes: {', '.join(sorted(languages))}", flush=True)
                
                # Ensure template-supported languages are installed
                print(f"[piston] Ensuring required languages are installed...", flush=True)
                install_results = await ensure_languages_installed()
                if "error" in install_results:
                    print(f"[piston] Warning: Could not ensure languages installed: {install_results['error']}", flush=True)
                else:
                    # Print summary of installation results
                    success_count = sum(1 for r in install_results.values() if isinstance(r, dict) and r.get("success", False))
                    total_count = len(install_results)
                    print(f"[piston] Language installation check complete: {success_count}/{total_count} languages ready", flush=True)
                    # Print any failures
                    for lang, result in install_results.items():
                        if isinstance(result, dict) and not result.get("success", False):
                            error = result.get("error", "Unknown error")
                            print(f"[piston]   - {lang}: {error}", flush=True)
                return
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"[piston] Error connecting to Piston (attempt {attempt + 1}/{max_retries}): {e}", flush=True)
                await asyncio.sleep(retry_delay)
                retry_delay = min(retry_delay * 1.5, 5.0)
            else:
                print(f"[piston] Warning: Could not check Piston status after {max_retries} attempts: {e}", flush=True)
                return

# Routers
app.include_router(login_router,       prefix="/api/v1",             tags=["login"])
app.include_router(attempts_router,    prefix="/api/v1/attempts",    tags=["attempts"])
app.include_router(courses_router,        prefix="/api/v1/courses",     tags=["courses"])
app.include_router(registrations_router,  prefix="/api/v1",             tags=["registrations"])
app.include_router(assignments_router,    prefix="/api/v1/assignments", tags=["assignments"])

# Run the server when executed as a module
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
