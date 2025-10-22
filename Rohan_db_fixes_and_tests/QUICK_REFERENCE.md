# Quick Reference - Enrollment Consolidation

## What Changed?

### Old System (BEFORE)
- **Faculty enrollments**: `user_course_association` table
- **Student enrollments**: `student_registrations` table
- Two separate tables for the same concept

### New System (AFTER)
- **All enrollments**: `user_course_association` table
- Single unified table with `id`, `user_id`, `course_id`
- Use `users.role` to distinguish faculty from students

## Database Schema

```sql
CREATE TABLE user_course_association (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
);
```

## Key API Changes

### Course Creation (Auto-Association)
```python
# backend/app/api/courses.py lines 86-124
@router.post("", status_code=status.HTTP_201_CREATED)
def create_course(payload: dict, ident=Depends(get_identity), db: Session = Depends(get_db)):
    course = Course(course_tag=tag, name=name, description=description)
    db.add(course)
    db.flush()
    
    # Auto-link creator if they are faculty
    user_id, role = ident
    if role == RoleEnum.faculty and user_id:
        db.execute(user_course_association.insert().values(
            user_id=user_id, course_id=course.id
        ))
    
    db.commit()
    return course
```

### Get Students for Course (Role-Based Filter)
```python
# backend/app/api/courses.py lines 290-312
@router.get("/{course_key}/students")
def course_students(course_key: str, db: Session = Depends(get_db)):
    student_rows = db.execute(
        select(User)
        .join(user_course_association, user_course_association.c.user_id == User.id)
        .where(
            user_course_association.c.course_id == c.id,
            User.role == RoleEnum.student  # Filter by role
        )
    ).scalars().all()
    return [{"id": s.id, "name": s.username} for s in student_rows]
```

### Student Registration
```python
# backend/app/api/registrations.py lines 19-59
@router.post("/registrations", response_model=dict, status_code=201)
def register(payload: dict, db: Session = Depends(get_db)):
    # Check duplicate
    exists = db.execute(
        select(user_course_association).where(
            and_(
                user_course_association.c.user_id == student_id,
                user_course_association.c.course_id == course.id,
            )
        )
    ).first()
    
    if exists:
        raise HTTPException(409, "Already registered")
    
    # Insert into user_course_association
    result = db.execute(
        user_course_association.insert().values(
            user_id=student_id, 
            course_id=course.id
        )
    )
    db.commit()
    return {"id": result.lastrowid, "student_id": student_id, "course_id": course.id}
```

## Frontend Changes

No changes needed! The frontend was already set up correctly:

```typescript
// frontend/src/webpages/FacultyDashboard.tsx
async function onCreate(e: React.FormEvent) {
  const created = await fetchJson<Course>(`/api/v1/courses`, {
    method: "POST",
    body: JSON.stringify({
      course_tag: courseTag.trim(),
      name: name.trim(),
      description: description || null,
    }),
  });
  setMine((prev) => [created, ...prev]); // Instant update!
}
```

## Testing

```bash
# Run specific tests
cd backend
python -m pytest tests/test_courses.py::test_course_creation_auto_associates_creator -v
python -m pytest tests/test_registrations.py -v

# Verify database
python3 -c "
import sqlite3
conn = sqlite3.connect('app.db')
cursor = conn.cursor()
cursor.execute('SELECT * FROM user_course_association')
print(cursor.fetchall())
conn.close()
"
```

## Common Queries

### Get all enrollments for a course (with roles)
```python
from sqlalchemy import select
from app.models.models import User, user_course_association, RoleEnum

# Get all users enrolled in course
users = db.execute(
    select(User)
    .join(user_course_association, user_course_association.c.user_id == User.id)
    .where(user_course_association.c.course_id == course_id)
).scalars().all()

# Filter by role
students = [u for u in users if u.role == RoleEnum.student]
faculty = [u for u in users if u.role == RoleEnum.faculty]
```

### Get all courses for a user
```python
from sqlalchemy import select
from app.models.models import Course, user_course_association

courses = db.execute(
    select(Course)
    .join(user_course_association, user_course_association.c.course_id == Course.id)
    .where(user_course_association.c.user_id == user_id)
).scalars().all()
```

### Check if user is enrolled
```python
from sqlalchemy import select, and_
from app.models.models import user_course_association

enrollment = db.execute(
    select(user_course_association).where(
        and_(
            user_course_association.c.user_id == user_id,
            user_course_association.c.course_id == course_id
        )
    )
).first()

is_enrolled = enrollment is not None
```

## Migration Commands

```bash
# Apply migration
cd backend
python -m alembic upgrade head

# Check current version
python -m alembic current

# Rollback (if needed)
python -m alembic downgrade -1
```

## Troubleshooting

### Issue: Course doesn't appear for faculty after creation
**Solution**: Check that the create_course endpoint includes the auto-association logic (lines 109-115 in courses.py)

### Issue: Students can't see their courses
**Solution**: Ensure the enrollment was created in `user_course_association` (not the old `student_registrations`)

### Issue: Gradebook shows no students
**Solution**: Check that the query includes the role filter: `User.role == RoleEnum.student`

### Issue: Tests fail with "StudentRegistration not found"
**Solution**: Update test imports to use `user_course_association` instead

## Files Modified

1. `backend/alembic/versions/3bbd35209c21_consolidate_enrollments_into_user_.py` - Migration
2. `backend/app/models/models.py` - Model definitions
3. `backend/app/api/courses.py` - Course endpoints
4. `backend/app/api/registrations.py` - Registration endpoints
5. `backend/app/api/assignments.py` - Assignment endpoints
6. `backend/app/schemas/schemas.py` - Pydantic schemas
7. `backend/tests/test_courses.py` - Course tests
8. `backend/tests/test_registrations.py` - Registration tests

## Benefits

✅ **Simplified Architecture**: One table for all enrollments
✅ **Consistent Queries**: Same pattern for faculty and students
✅ **Auto-Association**: Faculty creators instantly linked to their courses
✅ **Role-Based Access**: Use existing user roles instead of table separation
✅ **Better Performance**: Single table join instead of UNION queries
✅ **Easier Maintenance**: Less code duplication

