# backend/app/api/mock_registrations.py
from fastapi import APIRouter, HTTPException
from app.schemas.schemas import RegistrationIn, RegistrationOut, CourseOut
from .mock_db import COURSES, REGISTRATIONS
import time

router = APIRouter()

@router.post("/registrations", response_model=RegistrationOut, status_code=201)
def register(payload: RegistrationIn):
    if not any(c["course_id"] == payload.course_id for c in COURSES):
        raise HTTPException(status_code=404, detail="Invalid course")
    if any(r["student_id"] == payload.student_id and r["course_id"] == payload.course_id for r in REGISTRATIONS):
        raise HTTPException(status_code=409, detail="Already registered")
    rec = {"id": f"r_{int(time.time()*1000)}", **payload.dict()}
    REGISTRATIONS.append(rec)
    return rec

@router.get("/students/{student_id}/courses", response_model=list[CourseOut])
def student_courses(student_id: str):
    course_ids = {r["course_id"] for r in REGISTRATIONS if r["student_id"] == student_id}
    return [c for c in COURSES if c["course_id"] in course_ids]
