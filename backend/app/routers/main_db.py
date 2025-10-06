from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from app.core.db import SessionLocal, engine


# Ensure the database table exists
models.Base.metadata.create_all(bind=engine)

router = APIRouter()

# Dependency: DB session for each request
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/users", response_model=schemas.UserRead)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = models.User(role=user.role, name=user.name)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/users", response_model=list[schemas.UserRead])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()

@router.post("/courses", response_model=schemas.CourseRead)
def create_course(course: schemas.CourseCreate, db: Session = Depends(get_db)):
    db_course = models.Course(course_tag=course.course_tag, name=course.name, description=course.description)
    db.add(db_course)
    db.commit()
    db.refresh(db_course)
    return db_course

@router.get("/courses", response_model=list[schemas.CourseRead])
def list_courses(db: Session = Depends(get_db)):
    return db.query(models.Course).all()

@router.post("/assignments", response_model=schemas.AssignmentRead)
def create_assignment(assignment: schemas.AssignmentCreate, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == assignment.course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    new_assignment = models.Assignment(
        title=assignment.title,
        description=assignment.description,
        course_id=assignment.course_id,
        sub_limit=assignment.sub_limit
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    return new_assignment

@router.get("/assignments/", response_model=list[schemas.AssignmentRead])
def get_assignments(db: Session = Depends(get_db)):
    assignments = db.query(models.Assignment).all()
    return assignments

@router.get("/courses/{course_id}/assignments", response_model=list[schemas.AssignmentRead])
def get_assignments_for_course(course_id: int, db: Session = Depends(get_db)):
    course = db.query(models.Course).filter(models.Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course.assignments

@router.get("/assignments/{assignment_id}", response_model=schemas.AssignmentRead)
def get_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment

@router.post("/test_files", response_model=schemas.TestCaseRead)
def create_test_file(test_file: schemas.TestCaseCreate, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == test_file.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    new_test_file = models.TestCase(
        assignment_id=test_file.assignment_id,
        var_char=test_file.var_char
    )
    db.add(new_test_file)
    db.commit()
    db.refresh(new_test_file)
    return new_test_file

@router.get("/test_files/", response_model=list[schemas.TestCaseRead])
def get_test_files(db: Session = Depends(get_db)):
    test_files = db.query(models.TestCase).all()
    return test_files

@router.post("/studentsubmissions", response_model=schemas.StudentSubmissionRead)
def create_student_submission(submission: schemas.StudentSubmissionCreate, db: Session = Depends(get_db)):
    student = db.query(models.User).filter(models.User.id == submission.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    
    assignment = db.query(models.Assignment).filter(models.Assignment.id == submission.assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    
    new_submission = models.StudentSubmission(
        student_id=submission.student_id,
        assignment_id=submission.assignment_id,
        grade=submission.grade
        #file_path=submission.file_path
    )
    db.add(new_submission)
    db.commit()
    db.refresh(new_submission)
    return new_submission

@router.get("/assignments/{assignments_id}/studentsubmissions/", response_model=list[schemas.StudentSubmissionRead])
def get_submissions_for_assignment(assignments_id: int, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignments_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return assignment.student_submissions
