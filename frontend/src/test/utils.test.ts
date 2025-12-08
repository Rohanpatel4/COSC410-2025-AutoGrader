import { cn } from "../lib/utils";

describe("cn (className utility)", () => {
  test("combines single class names", () => {
    expect(cn("class1", "class2")).toBe("class1 class2");
  });

  test("handles undefined and null values", () => {
    expect(cn("class1", undefined, "class2", null)).toBe("class1 class2");
  });

  test("handles empty strings", () => {
    expect(cn("class1", "", "class2")).toBe("class1 class2");
  });

  test("merges Tailwind classes correctly", () => {
    expect(cn("px-2", "px-4")).toBe("px-4"); // Later class wins
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  test("preserves non-conflicting classes", () => {
    expect(cn("px-2 text-red-500", "py-4")).toBe("px-2 text-red-500 py-4");
  });

  test("handles array inputs", () => {
    expect(cn(["class1", "class2"])).toBe("class1 class2");
  });

  test("handles mixed array and string inputs", () => {
    expect(cn("class1", ["class2", "class3"])).toBe("class1 class2 class3");
  });

  test("handles empty input", () => {
    expect(cn()).toBe("");
  });

  test("handles falsy values", () => {
    expect(cn("class1", false, "class2", 0, "class3")).toBe("class1 class2 class3");
  });

  test("preserves complex Tailwind combinations", () => {
    const result = cn("bg-red-500 hover:bg-red-600", "text-white");
    expect(result).toContain("bg-red-500");
    expect(result).toContain("hover:bg-red-600");
    expect(result).toContain("text-white");
  });

  test("handles conditional classes with arrays", () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn(
      "base-class",
      isActive && "active-class",
      isDisabled && "disabled-class"
    );
    expect(result).toBe("base-class active-class");
  });
});