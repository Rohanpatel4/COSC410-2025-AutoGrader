# Frontend Testing Instructions - Judge0 Grading System

## ✅ System Status

All services are running:
- ✅ Frontend: http://localhost:5173
- ✅ Backend: http://localhost:8000
- ✅ Judge0: http://localhost:2358 (DinD)

## 🧪 Test Plan: Frontend Grading Verification

### Step 1: Login as Faculty

1. Open http://localhost:5173 in your browser
2. Login with:
   - Email: `prof.x@wofford.edu`
   - Password: `secret`

### Step 2: Create an Assignment (or Use Existing)

If you need to create a new assignment:

1. Click on a course (e.g., "COSC-235 – Dr.Garret")
2. Click "New Assignment" or scroll to the assignment form
3. Fill in:
   - **Title**: Calculator Functions
   - **Description**: (optional)
   - **Submission limit**: (leave blank or set to 10)
   - **Start/Stop dates**: (optional)
4. **Upload test file**: Use `manual_test_files/test_calculator.py`
5. Click "Save Assignment"

### Step 3: Logout and Login as Student

1. Logout from faculty account
2. Login with student credentials:
   - Email: `alice@wofford.edu` 
   - Password: `secret`

### Step 4: Test Submission - PASSES ALL

1. Navigate to "My Courses"
2. Click on the course (e.g., "COSC-235")
3. Click on the "Calculator Functions" assignment
4. Submit `manual_test_files/submission_passes_all.py`
5. Click "Submit"

**Expected Result:**
- ✅ Grade: **100%**
- ✅ Tests passed: **8/8**
- ✅ All test units show "PASSED"
- ✅ Test names displayed: test_add_positive, test_add_negative, etc.

### Step 5: Test Submission - PASSES NONE

1. Stay on the same assignment page
2. Submit `manual_test_files/submission_passes_none.py`
3. Click "Submit"

**Expected Result:**
- ❌ Grade: **12.5%** (1/8 tests)
- ✅ Failed: **7/8** tests
- ✅ One test passes: `test_add_zero` (mathematical edge case: 0*0 = 0+0 = 0)
- ✅ All other tests show "FAILED_ASSERTION"
- ✅ Individual test results visible

### Step 6: Test Submission - PASSES SOME

1. Stay on the same assignment page
2. Submit `manual_test_files/submission_passes_some.py`
3. Click "Submit"

**Expected Result:**
- ⚙️  Grade: **~50%** (approximately 4/8 tests)
- ✅ Some tests pass, some fail
- ✅ Individual results show which tests passed/failed
- ✅ Clear distinction between PASSED and FAILED_ASSERTION

## 📊 What to Verify

### Frontend Display

Check that the assignment detail page shows:

1. **Overall Grade** - Percentage and pass/fail count
2. **Individual Test Results** - Each test listed with:
   - Test name (e.g., `test_add_positive`)
   - Status (PASSED or FAILED_ASSERTION)
   - Green ✅ for passed, Red ❌ for failed
3. **Submission History** - All attempts listed with grades
4. **Best Grade** - Highest score highlighted

### Database Verification

After submissions, verify in the database:

```bash
docker-compose exec backend python << 'PYEOF'
import sys
sys.path.insert(0, '/app')

from backend.app.core.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    result = conn.execute(text("""
        SELECT id, student_id, assignment_id, grade 
        FROM student_submissions 
        ORDER BY id DESC 
        LIMIT 5
    """))
    
    print("Recent Submissions:")
    for row in result:
        print(f"  ID: {row[0]}, Student: {row[1]}, Assignment: {row[2]}, Grade: {row[3]}%")
PYEOF
```

Expected: Grades match frontend display (100%, 12.5%, ~50%)

## 🐛 Troubleshooting

### Issue: All Submissions Show 100%

**Diagnosis:** Test splitter not working correctly

**Fix:**
```bash
docker-compose restart backend
sleep 10
# Try submission again
```

### Issue: Frontend Shows "Internal Server Error"

**Check backend logs:**
```bash
docker-compose logs backend | tail -50
```

**Common causes:**
- Judge0 not ready yet (wait 30 seconds)
- Backend can't reach Judge0 (check `JUDGE0_URL`)
- Test file has syntax errors

### Issue: Grade is 0% for All Submissions

**Diagnosis:** Judge0 not executing code

**Check Judge0:**
```bash
# From host
curl http://localhost:2358/system_info

# From backend
docker-compose exec backend python -c "
import httpx, asyncio
async def test():
    async with httpx.AsyncClient() as client:
        r = await client.get('http://dind:2358/system_info')
        print(f'Status: {r.status_code}')
asyncio.run(test())
"
```

Both should return `Status: 200`

### Issue: Frontend Not Loading

**Clear browser cache:**
- Chrome/Edge: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)
- Firefox: `Cmd+Shift+R` (Mac) or `Ctrl+F5` (Windows)
- Safari: `Cmd+Option+R` (Mac)

## 🎯 Success Criteria

✅ **System is working correctly if:**

1. submission_passes_all.py → 100% (8/8 tests)
2. submission_passes_none.py → 12.5% (1/8 tests)
   - Note: 1 test passes due to mathematical edge case (0+0 = 0*0)
3. submission_passes_some.py → ~50% (4/8 tests)
4. Individual test results visible for each submission
5. Test names shown (test_add_positive, test_multiply_positive, etc.)
6. Grades saved correctly in database
7. Submission history shows all attempts

## 📁 Test Files Location

All test files are in `manual_test_files/`:

- `test_calculator.py` - Test cases to upload to assignment
- `submission_passes_all.py` - Correct implementation (100%)
- `submission_passes_none.py` - Wrong implementation (12.5%)
- `submission_passes_some.py` - Partially correct (50%)

## 🔄 Quick Reset (if needed)

If you need to start fresh:

```bash
# Stop services
docker-compose down

# Clear cache
find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null

# Rebuild
docker-compose build --no-cache backend

# Start
docker-compose up -d

# Wait for Judge0
sleep 30
```

---

**Current Status:** ✅ System is ready for testing!

**Frontend:** http://localhost:5173  
**Backend API:** http://localhost:8000/docs  
**Judge0:** http://localhost:2358/system_info

**Start testing now!** 🚀

