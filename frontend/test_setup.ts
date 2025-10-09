import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./src/test/server"; // <- POINT TO server.ts (single source)
import { resetDb } from "./src/test/handlers";

// Fail hard on any unhandled request so we know our tests/handlers are in sync
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });

  // JSDOM lacks localStorage in some setups; give it a tiny shim so AuthContext works
  if (!("localStorage" in globalThis)) {
    // @ts-expect-error test shim
    globalThis.localStorage = {
      store: {} as Record<string, string>,
      getItem(k: string) {
        return this.store[k] ?? null;
      },
      setItem(k: string, v: string) {
        this.store[k] = String(v);
      },
      removeItem(k: string) {
        delete this.store[k];
      },
      clear() {
        this.store = {};
      },
      key() { return null; },
      length: 0,
    };
  }

  // start each run from seed
  resetDb();
});

afterEach(() => {
  server.resetHandlers();
  resetDb(); // reset our in-memory DB to seed after every test
  vi.clearAllMocks();
});

afterAll(() => server.close());
