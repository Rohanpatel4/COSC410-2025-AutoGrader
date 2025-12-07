// src/test/handlers.ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// ---- Types used in tests/UI ----
type Course = {
  id: number;
  course_code: string;      // e.g., "COSC-410"
  name: string;
  description: string | null;
  professor_id: number;
  enrollment_key?: string;  // e.g., "ABC123XYZ789"
};

type RosterStudent = { id: number; name?: string };
type RosterFaculty = { id: number; name?: string };

type Assignment = {
  id: number;
  course_id: number;
  title: string;
  description?: string | null;
  sub_limit?: number | null;
  start?: string | null;
  stop?: string | null;
  num_attempts?: number;
};

type Attempt = { id: number; grade: number | null };
type AttemptsByAsgStudent = Record<number, Record<number, Attempt[]>>;

/**
 * NOTE ON KEYS:
 * - Tests/components route as /courses/:course_id where :course_id is a string like "500".
 * - We keep internal maps keyed by that string ("500"), but we DO NOT expose any course_tag in payloads.
 * - Public Course shape only includes course_code, name, description, professor_id, enrollment_key.
 */
type DB = {
  // faculty dashboard
  coursesByProfessor: Record<number, Course[]>;
  courseByTag: Record<string, Course>; // keyed by "500", etc.
  nextCourseId: number;

  // student dashboard
  enrollmentsByStudent: Record<number, Course[]>;

  // course page
  facultyByCourseTag: Record<string, RosterFaculty[]>;
  studentsByCourseTag: Record<string, RosterStudent[]>;
  assignmentsByCourseTag: Record<string, Assignment[]>;
  nextAssignmentId: number;

  // assignment detail page
  assignmentById: Record<number, Assignment>;
  attemptsByAsgStudent: AttemptsByAsgStudent;
  nextAttemptId: number;
};

// ---- Seed ----
const seed: DB = {
  // Faculty Dashboard
  coursesByProfessor: {
    // professor_id 301 has one seeded course
    301: [
      {
        id: 1,
        course_code: "COSC-410",
        name: "FirstCourse",
        description: "seed",
        professor_id: 301,
        enrollment_key: "ABC123XYZ789",
      },
    ],
  },
  // Internally we map the route key "500" -> that Course
  courseByTag: {
    "500": {
      id: 1,
      course_code: "COSC-410",
      name: "FirstCourse",
      description: "seed",
      professor_id: 301,
      enrollment_key: "ABC123XYZ789",
    },
  },
  nextCourseId: 2,

  // Student Dashboard (start empty; tests register)
  enrollmentsByStudent: {
    // e.g. 201: [ courseObj ]
  },

  // Course Page (seed a small roster + one assignment for tag "500")
  facultyByCourseTag: {
    "500": [{ id: 301, name: "Prof. Ada" }],
  },
  studentsByCourseTag: {
    "500": [{ id: 201, name: "Student Sam" }],
  },
  assignmentsByCourseTag: {
    "500": [
      {
        id: 9001,
        course_id: 1, // tie back to Course.id
        title: "Seeded Assignment",
        description: "Warm-up",
        sub_limit: 3,
        start: null,
        stop: null,
        num_attempts: 0,
      },
    ],
  },
  nextAssignmentId: 9002,
  assignmentById: {
    1: {
      id: 1,
      course_id: 1,
      title: "Test Assignment",
      description: "Test description",
      sub_limit: 5,
      start: null,
      stop: null,
      num_attempts: 0,
    },
    9001: {
      id: 9001,
      course_id: 1,
      title: "Seeded Assignment",
      description: "Warm-up",
      sub_limit: 3,
      start: null,
      stop: null,
      num_attempts: 0,
    },
  },
  attemptsByAsgStudent: {
    // e.g. 9001: { 201: [ { id: 1, grade: 95 } ] }
  },
  nextAttemptId: 1,
};

export const __db: DB = structuredClone(seed);

export function resetDb() {
  __db.coursesByProfessor = structuredClone(seed.coursesByProfessor);
  __db.courseByTag = structuredClone(seed.courseByTag);
  __db.enrollmentsByStudent = structuredClone(seed.enrollmentsByStudent);
  __db.nextCourseId = seed.nextCourseId;

  __db.facultyByCourseTag = structuredClone(seed.facultyByCourseTag);
  __db.studentsByCourseTag = structuredClone(seed.studentsByCourseTag);
  __db.assignmentsByCourseTag = structuredClone(seed.assignmentsByCourseTag);
  __db.nextAssignmentId = seed.nextAssignmentId;

  __db.assignmentById = structuredClone(seed.assignmentById);
  __db.attemptsByAsgStudent = structuredClone(seed.attemptsByAsgStudent);
  __db.nextAttemptId = seed.nextAttemptId;
}

// Compat/test helpers
export const __testDb = {
  reset: resetDb,
  state: __db,
  getAll: (profId: number) => __db.coursesByProfessor[profId] ?? [],
  getStudentCourses: (studentId: number) => __db.enrollmentsByStudent[studentId] ?? [],
  getRoster: (tag: string) => ({
    faculty: __db.facultyByCourseTag[tag] ?? [],
    students: __db.studentsByCourseTag[tag] ?? [],
  }),
  getAssignments: (tag: string) => __db.assignmentsByCourseTag[tag] ?? [],
  getAssignment: (id: number) => __db.assignmentById[id],
  setAssignment: (id: number, patch: Partial<Assignment>) => {
    if (!__db.assignmentById[id]) return;
    __db.assignmentById[id] = { ...__db.assignmentById[id], ...patch };
  },
};

// Helpers
function getProfessorIdFromUrl(url: URL): number | null {
  const p = url.searchParams.get("professor_id");
  if (!p) return null;
  const n = Number(p);
  return Number.isNaN(n) ? null : n;
}

function findCourseByEnrollmentKey(key: string): Course | undefined {
  const lists = Object.values(__db.coursesByProfessor);
  return lists.flat().find((c) => c.enrollment_key === key);
}

function findCourseByNumericId(id: number): Course | undefined {
  const lists = Object.values(__db.coursesByProfessor);
  return lists.flat().find((c) => c.id === id);
}

const COURSES_URL = "**/api/v1/courses";
const STUDENT_COURSES_URL = "**/api/v1/students/:id/courses";
const REGISTRATIONS_URL = "**/api/v1/registrations";

// Course page URL patterns
const COURSE_HEADER_URL = "**/api/v1/courses/:course_id"; // NEW
const COURSE_STUDENTS_URL = "**/api/v1/courses/:course_id/students";
const COURSE_FACULTY_URL = "**/api/v1/courses/:course_id/faculty";
const COURSE_ASSIGNMENTS_URL = "**/api/v1/courses/:course_id/assignments";
const ASSIGNMENT_TESTFILE_URL = "**/api/v1/assignments/:id/test-file";

// Assignment detail page
const ASSIGNMENT_DETAIL_URL = "**/api/v1/assignments/:id";
const ASSIGNMENT_SUBMISSION_DETAIL_URL = "**/api/v1/assignments/:assignment_id/submission-detail/:submission_id";
const ASSIGNMENT_STUDENT_ATTEMPTS_URL = "**/api/v1/assignments/:assignment_id/students/:student_id/attempts";
const ASSIGNMENT_ATTEMPTS_URL = "**/api/v1/assignments/:id/attempts";
const ASSIGNMENT_SUBMIT_URL = "**/api/v1/assignments/:id/submit";
const LANGUAGES_URL = "**/api/v1/languages";
const ASSIGNMENT_TEST_CASES_URL = "**/api/v1/assignments/:id/test-cases";

// Global assignments (AssignmentsPage)
const ASSIGNMENTS_URL = "**/api/v1/assignments";

export const handlers = [
  // =========================================================
  // ---------- Faculty: Courses CRUD-ish (list/create) ------
  // =========================================================

  // Back-compat (query param style) – keep if any legacy tests still hit it.
  // GET /api/v1/courses?professor_id=301
  http.get(COURSES_URL, ({ request }) => {
    const url = new URL(request.url);
    const pid = getProfessorIdFromUrl(url);
    if (!pid) {
      return HttpResponse.json(
        { message: "professor_id is required" },
        { status: 400 }
      );
    }
    const list = __db.coursesByProfessor[pid] ?? [];
    return HttpResponse.json(list, { status: 200 });
  }),

  // NEW: path-based faculty filter used by FacultyDashboard
  // GET /api/v1/courses/faculty/:id
  http.get("**/api/v1/courses/faculty/:id", ({ params }) => {
    const id = Number(params.id ?? 0);
    if (!id) return HttpResponse.json({ message: "bad professor id" }, { status: 400 });
    const list = __db.coursesByProfessor[id] ?? [];
    return HttpResponse.json(list, { status: 200 });
  }),

  // POST /api/v1/courses  (JSON body: { professor_id, course_code, name, description })
  http.post(COURSES_URL, async ({ request }) => {
  const body = (await request.json()) as {
    course_code?: string;
    name?: string;
    description?: string | null;
    // professor_id?: number; // optional/ignored
  };

  const code = (body?.course_code ?? "").trim();
  const name = (body?.name ?? "").trim();

  if (!code || !name) {
    return HttpResponse.json({ message: "course_code and name are required" }, { status: 400 });
  }

  // Default professor for test environment
  const pid = 301;

  // derive a simple string route key like "501", "502", ...
  const newTag = String(__db.nextCourseId + 499);

  const created: Course = {
    id: __db.nextCourseId++,
    course_code: code,
    name,
    description: body.description ?? null,
    professor_id: pid,
    enrollment_key: "EK-" + Math.random().toString(36).slice(2, 10).toUpperCase(),
  };

  const list = (__db.coursesByProfessor[pid] ??= []);
  list.unshift(created);
  __db.courseByTag[newTag] = created;

  return HttpResponse.json(created, { status: 201 });
}),

  // =========================================================
  // ----------------- Student: My courses -------------------
  // =========================================================

  // GET /api/v1/students/:id/courses
  http.get(STUDENT_COURSES_URL, ({ params }) => {
    const raw = params.id as string;
    const sid = Number(raw);
    if (!sid || Number.isNaN(sid)) {
      return HttpResponse.json({ message: "bad student id" }, { status: 400 });
    }
    const list = __db.enrollmentsByStudent[sid] ?? [];
    return HttpResponse.json(list, { status: 200 });
  }),

  // GET /api/v1/courses/students/:id (alternative endpoint used by CalendarWidget)
  http.get("**/api/v1/courses/students/:id", ({ params }) => {
    const raw = params.id as string;
    const sid = Number(raw);
    if (!sid || Number.isNaN(sid)) {
      return HttpResponse.json({ message: "bad student id" }, { status: 400 });
    }
    const list = __db.enrollmentsByStudent[sid] ?? [];
    return HttpResponse.json(list, { status: 200 });
  }),

  // POST /api/v1/registrations
  // body can be: { student_id, enrollment_key } (preferred)
  // OR legacy:   { student_id, course_id } or { student_id, course_tag }
  http.post(REGISTRATIONS_URL, async ({ request }) => {
    const body = (await request.json()) as {
      student_id?: number;
      enrollment_key?: string;
      course_id?: number;
      course_tag?: string; // legacy
    };

    const sid = Number(body.student_id);
    if (!sid || Number.isNaN(sid)) {
      return HttpResponse.json({ message: "student_id is required" }, { status: 400 });
    }

    let course: Course | undefined;

    // Preferred: enrollment_key
    const key = (body.enrollment_key ?? "").trim();
    if (key) {
      course = findCourseByEnrollmentKey(key);
    }

    // Fallback: numeric course_id
    if (!course && body.course_id) {
      course = findCourseByNumericId(Number(body.course_id));
    }

    // Fallback: legacy course_tag string
    if (!course && body.course_tag) {
      const tag = String(body.course_tag).trim();
      course = __db.courseByTag[tag];
    }

    if (!course) {
      return HttpResponse.text("Not Found", { status: 404 });
    }

    const current = (__db.enrollmentsByStudent[sid] ??= []);
    if (!current.some((c) => c.id === course!.id)) current.unshift(course);

    return HttpResponse.json({ ok: true }, { status: 201 });
  }),

  // =========================================================
  // ------------------- Course Page APIs --------------------
  // =========================================================

  // NEW: Course header payload expected by CoursePage
  // GET /api/v1/courses/:course_id
  http.get(COURSE_HEADER_URL, ({ params }) => {
    const tag = String(params.course_id ?? "");
    const course = __db.courseByTag[tag];
    if (!course) return HttpResponse.json({ message: "not found" }, { status: 404 });
    const payload = {
      id: course.id,
      course_code: course.course_code,
      name: course.name,
      description: course.description,
      enrollment_key: course.enrollment_key,
    };
    return HttpResponse.json(payload, { status: 200 });
  }),

  // GET /api/v1/courses/:course_id/students
  http.get(COURSE_STUDENTS_URL, ({ params }) => {
    const tag = String(params.course_id ?? "");
    const list = __db.studentsByCourseTag[tag] ?? [];
    return HttpResponse.json(list, { status: 200 });
  }),

  // GET /api/v1/courses/:course_id/faculty
  http.get(COURSE_FACULTY_URL, ({ params }) => {
    const tag = String(params.course_id ?? "");
    const list = __db.facultyByCourseTag[tag] ?? [];
    return HttpResponse.json(list, { status: 200 });
  }),

  // GET /api/v1/courses/:course_id/assignments(?student_id=…)
  // Supports both course_id (tag), course_code, and numeric course.id
  http.get(COURSE_ASSIGNMENTS_URL, ({ request, params }) => {
    const courseIdentifier = String(params.course_id ?? "");
    const url = new URL(request.url);
    const studentId = url.searchParams.get("student_id");
    
    // Check if it's a course_code, tag (numeric tag like "500"), or course.id (number like "1")
    let tag = courseIdentifier;
    if (!__db.assignmentsByCourseTag[courseIdentifier]) {
      // Try to find by course_code
      for (const [t, course] of Object.entries(__db.courseByTag)) {
        if (course.course_code === courseIdentifier) {
          tag = t;
          break;
        }
      }
      // If still not found, try to find by course.id (numeric)
      if (!__db.assignmentsByCourseTag[tag] && !Number.isNaN(Number(courseIdentifier))) {
        const courseIdNum = Number(courseIdentifier);
        for (const [t, course] of Object.entries(__db.courseByTag)) {
          if (course.id === courseIdNum) {
            tag = t;
            break;
          }
        }
      }
    }
    
    let list = (__db.assignmentsByCourseTag[tag] ?? []).map((a) => ({ ...a }));

    // student-specific view: ensure num_attempts present
    if (studentId) {
      list = list.map((a) => ({ ...a, num_attempts: a.num_attempts ?? 0 }));
    }
    return HttpResponse.json(list, { status: 200 });
  }),

  // GET /api/v1/assignments/:id/grades  (faculty view)
http.get("**/api/v1/assignments/:id/grades", ({ params }) => {
  const id = Number(params.id);
  const asg = __db.assignmentById[id];
  if (!asg) {
    return HttpResponse.json({ message: "not found" }, { status: 404 });
  }

  // find the course's "tag" (your test data keys, e.g., "500") by matching course_id
  let tag = "";
  for (const [k, course] of Object.entries(__db.courseByTag)) {
    if (course.id === asg.course_id) {
      tag = k;
      break;
    }
  }

  // students enrolled in that course tag
  const roster = __db.studentsByCourseTag[tag] ?? [];

  // attempts for this assignment keyed by student
  const attemptsByStudent = __db.attemptsByAsgStudent[id] ?? {};

  const students = roster.map((s) => {
    const atts = (attemptsByStudent[s.id] ?? []).map((a) => ({ id: a.id, grade: a.grade }));
    const best =
      atts.length
        ? atts.reduce((m, r) => (r.grade != null && r.grade > m ? r.grade : m), -1)
        : null;
    return {
      student_id: s.id,
      username: s.name ?? String(s.id),
      attempts: atts,
      best: best === -1 ? null : best,
    };
  });

  const payload = {
    assignment: { id: asg.id, title: asg.title },
    students,
  };

  return HttpResponse.json(payload, { status: 200 });
}),

  // POST /api/v1/courses/:course_id/assignments
  http.post(COURSE_ASSIGNMENTS_URL, async ({ params, request }) => {
    const tag = String(params.course_id ?? "");
    const body = (await request.json()) as Partial<Assignment>;
    const title = (body.title ?? "").toString().trim();

    if (!title) {
      return HttpResponse.json({ message: "Title is required" }, { status: 400 });
    }

    const course = __db.courseByTag[tag];
    const created: Assignment = {
      id: __db.nextAssignmentId++,
      course_id: course ? course.id : 0,
      title,
      description: body.description ?? null,
      sub_limit: body.sub_limit ?? null,
      start: (body as any).start ?? null,
      stop: (body as any).stop ?? null,
      num_attempts: 0,
    };

    const list = (__db.assignmentsByCourseTag[tag] ??= []);
    list.unshift(created);

    __db.assignmentById[created.id] = created;

    return HttpResponse.json(created, { status: 201 });
  }),

  // POST /api/v1/assignments/:id/test-file (accept & ignore; used in CoursePage after create)
  http.post(ASSIGNMENT_TESTFILE_URL, async () => {
    return HttpResponse.text("ok", { status: 200 });
  }),

  // ==========================================================
  // ------------------- Assignment Detail --------------------
  // ==========================================================
  http.get(ASSIGNMENT_DETAIL_URL, ({ params }) => {
    const id = Number(params.id);
    const asg = __db.assignmentById[id];
    if (!asg) return HttpResponse.json({ message: "not found" }, { status: 404 });
    return HttpResponse.json(asg, { status: 200 });
  }),

  // GET /api/v1/languages
  http.get(LANGUAGES_URL, () => {
    const languages = [
      { id: "python", name: "Python", piston_name: "python" },
      { id: "javascript", name: "JavaScript", piston_name: "javascript" },
      { id: "java", name: "Java", piston_name: "java" },
    ];
    return HttpResponse.json(languages, { status: 200 });
  }),

  // GET /api/v1/assignments/:id/test-cases
  http.get(ASSIGNMENT_TEST_CASES_URL, ({ params }) => {
    const id = Number(params.id);

    // Return mock test cases
    const testCases = [
      {
        id: 1,
        code: "def test_example():\n    assert True",
        point_value: 100,
        visibility: true,
      }
    ];

    return HttpResponse.json(testCases, { status: 200 });
  }),

  // GET /api/v1/assignments/:assignment_id/students/:student_id/attempts
  http.get(ASSIGNMENT_STUDENT_ATTEMPTS_URL, ({ params }) => {
    const assignmentId = Number(params.assignment_id);
    const studentId = Number(params.student_id);

    // Return mock attempts for the student
    const attempts = [
      { id: 2001, earned_points: 90, created_at: "2024-12-06T10:30:00Z" },
    ];

    return HttpResponse.json(attempts, { status: 200 });
  }),

  // GET /api/v1/assignments/:assignment_id/submission-detail/:submission_id
  http.get(ASSIGNMENT_SUBMISSION_DETAIL_URL, ({ params }) => {
    const assignmentId = Number(params.assignment_id);
    const submissionId = Number(params.submission_id);

    // Return mock submission detail data
    const mockResponse = {
      submission: {
        id: submissionId,
        earned_points: 85,
        code: "# Sample Python code\nprint('Hello, World!')\n",
        created_at: "2024-12-05T10:30:00Z",
      },
      student: {
        id: 201,
        username: "student1",
      },
      assignment: {
        id: assignmentId,
        title: "Python Assignment 1",
        language: "python",
        total_points: 100,
      },
      course: {
        id: 1,
        name: "Computer Science 101",
        course_code: "CS101",
      },
      course_assignments: [
        { id: assignmentId, title: "Python Assignment 1" },
      ],
      attempt_number: 1,
      total_attempts: 2,
      all_attempts: [
        { id: submissionId, earned_points: 85 },
      ],
      students_with_attempts: [
        { id: 201, username: "student1" },
        { id: 202, username: "student2" },
      ],
    };

    return HttpResponse.json(mockResponse, { status: 200 });
  }),

  // GET /api/v1/assignments/:id/attempts?student_id=201
  http.get(ASSIGNMENT_ATTEMPTS_URL, ({ request, params }) => {
    const id = Number(params.id);
    const url = new URL(request.url);
    const sid = Number(url.searchParams.get("student_id") || 0);
    if (!sid) return HttpResponse.json({ message: "student required" }, { status: 400 });

    const list = __db.attemptsByAsgStudent[id]?.[sid] ?? [];
    return HttpResponse.json(list, { status: 200 });
  }),

  // GET /api/v1/assignments/:id/rerun-status
  http.get("**/api/v1/assignments/:id/rerun-status", () => {
    return HttpResponse.json({ rerun_active: false }, { status: 200 });
  }),

  // POST /api/v1/assignments/:id/submit  (multipart)
  http.post(ASSIGNMENT_SUBMIT_URL, async ({ request, params }) => {
    const id = Number(params.id);
    const asg = __db.assignmentById[id];
    if (!asg) {
      return HttpResponse.json({ detail: "assignment not found" }, { status: 404 });
    }

    // Try to read multipart, but don't let parsing block the request.
    let sid = 0;
    let file: unknown = null;
    try {
      const form = await request.formData();
      sid = Number(form.get("student_id") || 0);
      file = form.get("submission");
    } catch {
      // Fall back to the student in your tests
      sid = 201;
    }

    // Window check (mirror UI)
    const now = Date.now();
    const startOk = asg.start ? now >= new Date(asg.start).getTime() : true;
    const stopOk = asg.stop ? now <= new Date(asg.stop).getTime() : true;
    if (!(startOk && stopOk)) {
      return HttpResponse.json({ detail: "window closed" }, { status: 403 });
    }

    // Limit check
    if (asg.sub_limit != null && asg.sub_limit >= 0) {
      const existing = __db.attemptsByAsgStudent[id]?.[sid] ?? [];
      if (existing.length >= asg.sub_limit) {
        return HttpResponse.json({ detail: "limit reached" }, { status: 429 });
      }
    }

    // Fake grading + persist attempt
    const grade = 95;
    const attempt = { id: __db.nextAttemptId++, grade };
    const slot = (__db.attemptsByAsgStudent[id] ??= {});
    const list = (slot[sid] ??= []);
    list.unshift(attempt);

    const grading = { passed: true, passed_tests: 3, total_tests: 3 };
    return HttpResponse.json(
      { ok: true, grade, grading },
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  }),

  // =========================================================
  // ---------------- Global Assignments list ----------------
  // =========================================================
  // GET /api/v1/assignments  → flatten all course assignments
  http.get(ASSIGNMENTS_URL, () => {
    // ensure each item has a valid course_id
    const flattened = Object.entries(__db.assignmentsByCourseTag).flatMap(
      ([tag, list]) => {
        const course = __db.courseByTag[tag];
        const courseId = course ? course.id : 0;
        return list.map((a) => ({ ...a, course_id: a.course_id ?? courseId }));
      }
    );
    return HttpResponse.json(flattened, { status: 200 });
  }),
];

// Export an MSW server for tests (kept for your current setup)
export const server = setupServer(...handlers);




