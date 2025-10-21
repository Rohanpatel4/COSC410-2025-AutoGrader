#!/bin/bash

# Migration Reset Verification Script
# Run this to verify the migration reset was successful

echo "========================================================================"
echo "MIGRATION RESET VERIFICATION"
echo "========================================================================"
echo ""

cd "$(dirname "$0")/backend"

# Check migration files
echo "1. Checking migration files..."
MIGRATION_COUNT=$(ls alembic/versions/*.py 2>/dev/null | wc -l | tr -d ' ')
if [ "$MIGRATION_COUNT" -eq "1" ]; then
    echo "   ✓ Found exactly 1 migration file"
    MIGRATION_FILE=$(ls alembic/versions/*.py)
    echo "   ✓ Migration: $(basename $MIGRATION_FILE)"
else
    echo "   ✗ Expected 1 migration file, found $MIGRATION_COUNT"
fi

# Check database version
echo ""
echo "2. Checking database migration version..."
DB_VERSION=$(python3 -c "import sqlite3; conn=sqlite3.connect('app.db'); cursor=conn.cursor(); cursor.execute('SELECT version_num FROM alembic_version'); print(cursor.fetchone()[0]); conn.close()" 2>/dev/null)
if [ -n "$DB_VERSION" ]; then
    echo "   ✓ Database version: $DB_VERSION"
else
    echo "   ✗ Could not read database version"
fi

# Check table structure
echo ""
echo "3. Checking user_course_association structure..."
python3 << 'EOF'
import sqlite3
conn = sqlite3.connect('app.db')
cursor = conn.cursor()
cursor.execute('PRAGMA table_info(user_course_association)')
columns = {row[1]: row[2] for row in cursor.fetchall()}
conn.close()

if 'id' in columns and 'user_id' in columns and 'course_id' in columns:
    print("   ✓ All required columns present: id, user_id, course_id")
else:
    print("   ✗ Missing columns")
EOF

# Check for old references
echo ""
echo "4. Checking for old references..."
if grep -r "student_registrations" app/ tests/ --include="*.py" 2>/dev/null | grep -v "#" | grep -v "DEPRECATED" > /dev/null; then
    echo "   ⚠ Found references to student_registrations"
else
    echo "   ✓ No references to student_registrations"
fi

if grep -r "StudentRegistration" app/ tests/ --include="*.py" 2>/dev/null | grep -v "#" | grep -v "DEPRECATED" > /dev/null; then
    echo "   ⚠ Found imports of StudentRegistration"
else
    echo "   ✓ No imports of StudentRegistration"
fi

# Check backend can start
echo ""
echo "5. Checking backend can import..."
python3 << 'EOF'
try:
    from app.api.main import app
    from app.models.models import user_course_association
    print("   ✓ Backend imports successfully")
except Exception as e:
    print(f"   ✗ Error: {e}")
EOF

# Final summary
echo ""
echo "========================================================================"
echo "VERIFICATION COMPLETE"
echo "========================================================================"
echo ""
echo "If all checks passed, the system is ready to use:"
echo ""
echo "  Start backend:  cd backend && uvicorn app.api.main:app --reload"
echo "  Start frontend: cd frontend && npm run dev"
echo ""
echo "Key Features:"
echo "  • Course creators auto-associated on creation"
echo "  • New courses appear instantly on faculty dashboard"
echo "  • Single unified enrollment table (user_course_association)"
echo "  • Clean migration history (1 migration)"
echo ""

