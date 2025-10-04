# backend/app/api/mock_courses.py
from fastapi import APIRouter, HTTPException, Query
from app.schemas.schemas import CourseIn, CourseOut, ListCoursesOut
from app.api.mock_db import COURSES
import time

router = APIRouter()

@router.post("", response_model=CourseOut, status_code=201)
def create_course(payload: CourseIn):
    if any(c["course_id"] == payload.course_id for c in COURSES):
        raise HTTPException(status_code=409, detail="Course ID already exists")
    doc = {"id": int(time.time()*1000), **payload.model_dump()}
    COURSES.insert(0, doc)
    return doc

@router.get("", response_model=ListCoursesOut)
def list_courses(
    professor: int | None = None,          # int now
    q: str | None = None,
    limit: int = Query(100, ge=1, le=200),
    cursor: str | None = None,
):
    items = COURSES
    if professor is not None:
        items = [c for c in items if c["professor_id"] == professor]
    if q:
        ql = q.lower()
        items = [c for c in items if ql in c["name"].lower() or ql in str(c["course_id"]).lower()]
    return {"items": items[:limit], "nextCursor": None}

@router.get("/{course_id}", response_model=CourseOut)
def get_course(course_id: int):            # int path param
    for c in COURSES:
        if c["course_id"] == course_id:
            return c
    raise HTTPException(status_code=404, detail="Not found")
