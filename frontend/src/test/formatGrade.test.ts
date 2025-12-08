import { formatGradeDisplay } from "../utils/formatGrade";

describe("formatGradeDisplay", () => {
  test("returns '—' for null value", () => {
    expect(formatGradeDisplay(null)).toBe("—");
  });

  test("returns '—' for undefined value", () => {
    expect(formatGradeDisplay(undefined)).toBe("—");
  });

  test("returns '—' for NaN string", () => {
    expect(formatGradeDisplay("not-a-number")).toBe("—");
  });

  test("returns '—' for empty string", () => {
    expect(formatGradeDisplay("")).toBe("—");
  });

  test("returns '0' for zero", () => {
    expect(formatGradeDisplay(0)).toBe("0");
  });

  test("returns '0' for string zero", () => {
    expect(formatGradeDisplay("0")).toBe("0");
  });

  test("truncates and formats integer numbers", () => {
    expect(formatGradeDisplay(85)).toBe("85");
    expect(formatGradeDisplay(0)).toBe("0");
    expect(formatGradeDisplay(100)).toBe("100");
  });

  test("truncates decimal numbers (removes fractional part)", () => {
    expect(formatGradeDisplay(85.7)).toBe("85");
    expect(formatGradeDisplay(92.3)).toBe("92");
    expect(formatGradeDisplay(0.9)).toBe("0");
  });

  test("handles string numbers", () => {
    expect(formatGradeDisplay("85")).toBe("85");
    expect(formatGradeDisplay("92.7")).toBe("92");
  });

  test("handles negative numbers", () => {
    expect(formatGradeDisplay(-5)).toBe("-5");
    expect(formatGradeDisplay(-85.7)).toBe("-85");
  });

  test("handles very large numbers", () => {
    expect(formatGradeDisplay(999999)).toBe("999999");
  });

  test("handles zero", () => {
    expect(formatGradeDisplay(0)).toBe("0");
  });
});