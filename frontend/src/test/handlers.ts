// src/test/handlers.ts
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// ---- Types used in tests/UI ----
type Course = {
  id: number;
  course_tag: string; // NOTE: in your app, the :course_id route param is the tag (e.g., "500")
  name: string;
  description: string | null;
  professor_id: number;
};

type RosterStudent = { id: number; name?: string };
type RosterFaculty = { id: number; name?: string };

type Assignment = {
  id: number;
  course_id: number;            // ADDED: used by AssignmentsPage list
  title: string;
  description?: string | null;
  sub_limit?: number | null;    // ADDED: used by AssignmentsPage list
  start?: string | null;
  stop?: string | null;
  num_attempts?: number;
};

type Attempt = { id: number; grade: number | null };
type AttemptsByAsgStudent = Record<number, Record<number, Attempt[]>>;

type DB = {
  // faculty dashboard
  coursesByProfessor: Record<number, Course[]>;
  courseByTag: Record<string, Course>;
  nextCourseId: number;

  // student dashboard
  enrollmentsByStudent: Record<number, Course[]>;

  // course page
  facultyByCourseTag: Record<string, RosterFaculty[]>;
  studentsByCourseTag: Record<string, RosterStudent[]>;
  assignmentsByCourseTag: Record<string, Assignment[]>; // keyed by course_tag ("500")
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
    // professor_id 301 has one seeded course named "FirstCourse"
    301: [
      {
        id: 1,
        course_tag: "500",
        name: "FirstCourse",
        description: "seed",
        professor_id: 301,
      },
    ],
  },
  courseByTag: {
    "500": {
      id: 1,
      course_tag: "500",
      name: "FirstCourse",
      description: "seed",
      professor_id: 301,
    },
  },
  nextCourseId: 2,

  // Student Dashboard (start empty; tests register)
  enrollmentsByStudent: {
    // e.g. 201: [ courseObj ]
  },

  // Course Page (seed a small roster + one assignment for tag 500)
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
        course_id: 1,           // tie back to Course.id
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

const COURSES_URL = "**/api/v1/courses";
const STUDENT_COURSES_URL = "**/api/v1/students/:id/courses";
const REGISTRATIONS_URL = "**/api/v1/registrations";

// Course page URL patterns
const COURSE_STUDENTS_URL = "**/api/v1/courses/:course_id/students";
const COURSE_FACULTY_URL = "**/api/v1/courses/:course_id/faculty";
const COURSE_ASSIGNMENTS_URL = "**/api/v1/courses/:course_id/assignments";
const ASSIGNMENT_TESTFILE_URL = "**/api/v1/assignments/:id/test-file";

// Assignment detail page
const ASSIGNMENT_DETAIL_URL = "**/api/v1/assignments/:id";
const ASSIGNMENT_ATTEMPTS_URL = "**/api/v1/assignments/:id/attempts";
const ASSIGNMENT_SUBMIT_URL = "**/api/v1/assignments/:id/submit";

// Global assignments (AssignmentsPage)
const ASSIGNMENTS_URL = "**/api/v1/assignments";

export const handlers = [
  // =========================================================
  // ---------- Faculty: Courses CRUD-ish (list/create) ------
  // =========================================================

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

  // POST /api/v1/courses?professor_id=301
  http.post(COURSES_URL, async ({ request }) => {
    const url = new URL(request.url);
    const pid = getProfessorIdFromUrl(url);
    if (!pid) {
      return HttpResponse.json(
        { message: "professor_id is required" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      course_tag?: string;
      name?: string;
      description?: string | null;
    };

    if (!body.course_tag?.trim() || !body.name?.trim()) {
      return HttpResponse.json(
        { message: "course_tag and name are required" },
        { status: 400 }
      );
    }

    const created: Course = {
      id: __db.nextCourseId++,
      course_tag: body.course_tag.trim(),
      name: body.name.trim(),
      description: body.description ?? null,
      professor_id: pid,
    };

    const list = (__db.coursesByProfessor[pid] ??= []);
    list.unshift(created);
    __db.courseByTag[created.course_tag] = created;

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

  // POST /api/v1/registrations  body: { student_id, course_tag | course_id }
  http.post(REGISTRATIONS_URL, async ({ request }) => {
    const body = (await request.json()) as {
      student_id?: number;
      course_tag?: string;
      course_id?: number;
    };

    const sid = Number(body.student_id);
    const tag = body.course_tag?.trim();

    if (!sid || Number.isNaN(sid) || (!tag && !body.course_id)) {
      return HttpResponse.json(
        { message: "student_id and course_tag (or course_id) are required" },
        { status: 400 }
      );
    }

    let course: Course | undefined;
    if (tag) course = __db.courseByTag[tag];
    else if (body.course_id) {
      // find by id across all professors
      const lists = Object.values(__db.coursesByProfessor);
      course = lists.flat().find((c) => c.id === body.course_id);
    }

    if (!course) {
      return HttpResponse.json(
        { message: "course not found" },
        { status: 404 }
      );
    }

    const current = (__db.enrollmentsByStudent[sid] ??= []);
    const exists = current.some((c) => c.id === course!.id);
    if (!exists) current.unshift(course);

    return HttpResponse.json({ ok: true }, { status: 201 });
  }),

  // =========================================================
  // ------------------- Course Page APIs --------------------
  // =========================================================

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
  http.get(COURSE_ASSIGNMENTS_URL, ({ request, params }) => {
    const tag = String(params.course_id ?? "");
    const url = new URL(request.url);
    const studentId = url.searchParams.get("student_id");
    let list = (__db.assignmentsByCourseTag[tag] ?? []).map(a => ({ ...a }));

    // If student-specific view matters, we could adjust num_attempts etc.
    if (studentId) {
      list = list.map(a => ({ ...a, num_attempts: a.num_attempts ?? 0 }));
    }
    return HttpResponse.json(list, { status: 200 });
  }),

  // POST /api/v1/courses/:course_id/assignments
  http.post(COURSE_ASSIGNMENTS_URL, async ({ params, request }) => {
    const tag = String(params.course_id ?? "");
    const body = (await request.json()) as Partial<Assignment>;
    const title = (body.title ?? "").toString().trim();

    if (!title) {
      return HttpResponse.json({ message: "Title is required" }, { status: 400 });
    }

    // map tag → Course to get numeric id
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

  // GET /api/v1/assignments/:id/attempts?student_id=201
  http.get(ASSIGNMENT_ATTEMPTS_URL, ({ request, params }) => {
    const id = Number(params.id);
    const url = new URL(request.url);
    const sid = Number(url.searchParams.get("student_id") || 0);
    if (!sid) return HttpResponse.json({ message: "student required" }, { status: 400 });

    const list = __db.attemptsByAsgStudent[id]?.[sid] ?? [];
    return HttpResponse.json(list, { status: 200 });
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
  const stopOk  = asg.stop  ? now <= new Date(asg.stop).getTime()  : true;
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
        return list.map(a => ({ ...a, course_id: a.course_id ?? courseId }));
      }
    );
    return HttpResponse.json(flattened, { status: 200 });
  }),
];

// Export an MSW server for tests (kept for your current setup)
export const server = setupServer(...handlers);




