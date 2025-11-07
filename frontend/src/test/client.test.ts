import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { fetchJson, uploadFile, BASE } from "../api/client";

const originalFetch = global.fetch;

describe("API Client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    localStorage.clear();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    fetchMock.mockReset();
  });

  describe("fetchJson", () => {
    test("throws error if path doesn't start with /", async () => {
      await expect(fetchJson("invalid-path")).rejects.toThrow(/must start with/i);
    });

    test("includes auth headers from localStorage", async () => {
      localStorage.setItem("auth", JSON.stringify({
        token: "test-token",
        userId: "123",
        role: "faculty",
      }));

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: "test" }),
      } as Response);

      await fetchJson("/api/v1/test");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/test"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            "X-User-Id": "123",
            "X-User-Role": "faculty",
          }),
        })
      );
    });

    test("handles missing auth gracefully", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: "test" }),
      } as Response);

      await fetchJson("/api/v1/test");

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            Authorization: expect.anything(),
          }),
        })
      );
    });

    test("throws error on non-OK response with JSON error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => JSON.stringify({ detail: "Resource not found" }),
      } as Response);

      await expect(fetchJson("/api/v1/test")).rejects.toThrow("Resource not found");
    });

    test("throws error on non-OK response with text error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error",
      } as Response);

      await expect(fetchJson("/api/v1/test")).rejects.toThrow("Server error");
    });

    test("returns parsed JSON on success", async () => {
      const mockData = { id: 1, name: "Test" };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await fetchJson("/api/v1/test");
      expect(result).toEqual(mockData);
    });
  });

  describe("uploadFile", () => {
    test("creates FormData with category and file", async () => {
      const file = new File(["content"], "test.py", { type: "text/x-python" });
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      } as Response);

      await uploadFile("TEST_CASE", file);

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/files"),
        expect.objectContaining({
          method: "POST",
          body: expect.any(FormData),
        })
      );
    });

    test("throws error on upload failure", async () => {
      const file = new File(["content"], "test.py", { type: "text/x-python" });
      
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        text: async () => JSON.stringify({ detail: "Invalid file" }),
      } as Response);

      await expect(uploadFile("TEST_CASE", file)).rejects.toThrow("Invalid file");
    });
  });

  describe("BASE export", () => {
    test("BASE is exported", () => {
      expect(BASE).toBeDefined();
    });
  });
});

