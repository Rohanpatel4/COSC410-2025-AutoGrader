import { http, HttpResponse } from "msw";

// --- Mock data you can tweak ---
let FILES = [
  { id: "f_sub_1", name: "solution1.py", category: "SUBMISSION" },
  { id: "f_tc_1",  name: "test_input_1.txt", category: "TEST_CASE" },
];

let SUBMISSIONS = [{ id: "s1", name: "Submission One", file_ids: ["f_sub_1"] }];
let TEST_SUITES  = [{ id: "ts1", name: "Suite One", file_ids: ["f_tc_1"] }];
let RUNTIMES     = [{ id: "rt_py_3_11", name: "Python 3.11", language: "python", version: "3.11" }];

// (Optional) Simple auth gate
function requireAuth(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth) return new HttpResponse("Unauthorized", { status: 401 });
  return null;
}

export const handlers = [
  // --- Auth ---
  http.post("*/api/v1/login", async () => {
    return HttpResponse.json({ token: "test-token", userId: "u1", role: "student" });
  }),

  // --- Files (GET) ---
  http.get("*/api/v1/files", ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get("category");
    const data = category ? FILES.filter((f) => f.category === category) : FILES;
    return HttpResponse.json(data);
  }),
  // Explicit relative-path match for tests using "/api/..."
  http.get("/api/v1/files", ({ request }) => {
    const url = new URL(request.url, "http://localhost"); // base to parse query
    const category = url.searchParams.get("category");
    const data = category ? FILES.filter((f) => f.category === category) : FILES;
    return HttpResponse.json(data);
  }),

  // --- Files (POST: FormData "category" + "file" | "f") ---
  http.post("*/api/v1/files", async ({ request }) => {
    // const gate = requireAuth(request); if (gate) return gate;

    const fd =
      typeof (request as any).formData === "function"
        ? await (request as any).formData()
        : undefined;

    // Accept either "file" or "f"
    const uploaded = fd?.get?.("file") ?? fd?.get?.("f");
    const name =
      uploaded && typeof (uploaded as any).name === "string"
        ? (uploaded as any).name
        : "uploaded.bin";

    const category = String(fd?.get?.("category") || "SUBMISSION");
    const newFile = { id: `f_${Date.now()}`, name, category };
    FILES.push(newFile);
    return HttpResponse.json(newFile, { status: 201 });
  }),
  // Explicit relative-path match
  http.post("/api/v1/files", async ({ request }) => {
    const fd =
      typeof (request as any).formData === "function"
        ? await (request as any).formData()
        : undefined;

    // Accept either "file" or "f"
    const uploaded = fd?.get?.("file") ?? fd?.get?.("f");
    const name =
      uploaded && typeof (uploaded as any).name === "string"
        ? (uploaded as any).name
        : "uploaded.bin";

    const category = String(fd?.get?.("category") || "SUBMISSION");
    const newFile = { id: `f_${Date.now()}`, name, category };
    FILES.push(newFile);
    return HttpResponse.json(newFile, { status: 201 });
  }),

  // --- Submissions ---
  http.get("*/api/v1/submissions", () => HttpResponse.json(SUBMISSIONS)),
  http.get("/api/v1/submissions", () => HttpResponse.json(SUBMISSIONS)),

  http.post("*/api/v1/submissions", async ({ request }) => {
    const body = await request.json();
    const created = { id: `s_${Date.now()}`, ...body };
    SUBMISSIONS.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.post("/api/v1/submissions", async ({ request }) => {
    const body = await request.json();
    const created = { id: `s_${Date.now()}`, ...body };
    SUBMISSIONS.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  // --- Test Suites ---
  http.get("*/api/v1/test-suites", () => HttpResponse.json(TEST_SUITES)),
  http.get("/api/v1/test-suites", () => HttpResponse.json(TEST_SUITES)),

  http.post("*/api/v1/test-suites", async ({ request }) => {
    const body = await request.json();
    const created = { id: `ts_${Date.now()}`, ...body };
    TEST_SUITES.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.post("/api/v1/test-suites", async ({ request }) => {
    const body = await request.json();
    const created = { id: `ts_${Date.now()}`, ...body };
    TEST_SUITES.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  // --- Runtimes ---
  http.get("*/api/v1/runtimes", () => HttpResponse.json(RUNTIMES)),
  http.get("/api/v1/runtimes", () => HttpResponse.json(RUNTIMES)),

  http.post("*/api/v1/runtimes", async ({ request }) => {
    const body = await request.json();
    const created = { id: `rt_${Date.now()}`, ...body };
    RUNTIMES.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),
  http.post("/api/v1/runtimes", async ({ request }) => {
    const body = await request.json();
    const created = { id: `rt_${Date.now()}`, ...body };
    RUNTIMES.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

  // --- Runs ---
  http.post("*/api/v1/runs", async ({ request }) => {
    const body = await request.json();
    const run = { id: `run_${Date.now()}`, status: "CREATED", ...body };
    return HttpResponse.json(run, { status: 201 });
  }),
  http.post("/api/v1/runs", async ({ request }) => {
    const body = await request.json();
    const run = { id: `run_${Date.now()}`, status: "CREATED", ...body };
    return HttpResponse.json(run, { status: 201 });
  }),

  // Execute
  http.post("*/api/v1/runs/:id/execute", async () => {
    const result = {
      id: "exec_1",
      status: "COMPLETED",
      summary: { passed: 5, failed: 0, errors: 0 },
      logs: ["Started", "Running tests...", "All green"],
    };
    return HttpResponse.json(result, { status: 200 });
  }),
  http.post("/api/v1/runs/:id/execute", async () => {
    const result = {
      id: "exec_1",
      status: "COMPLETED",
      summary: { passed: 5, failed: 0, errors: 0 },
      logs: ["Started", "Running tests...", "All green"],
    };
    return HttpResponse.json(result, { status: 200 });
  }),
];

