# backend/app/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.db import Base, engine
from app.core.settings import settings  # keep if you use it elsewhere

# Routers
from .LoginPage import router as login_router
from .judge0 import router as judge0_router
from .attempt_submission_test import router as attempts_router
from .courses import router as courses_router
from .registrations import router as registrations_router
from .assignments import router as assignments_router

# Init DB
Base.metadata.create_all(bind=engine)

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

# Routers (unchanged)
app.include_router(login_router,       prefix="/api/v1",             tags=["login"])
app.include_router(judge0_router,      prefix="/api/v1/judge0",      tags=["judge0"])
app.include_router(attempts_router,    prefix="/api/v1/attempts",    tags=["attempts"])
app.include_router(courses_router,        prefix="/api/v1/courses",     tags=["courses"])
app.include_router(registrations_router,  prefix="/api/v1",             tags=["registrations"])
app.include_router(assignments_router,    prefix="/api/v1/assignments", tags=["assignments"])

