export function formatGradeDisplay(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return "—";
  }

  return Math.trunc(numeric).toString();
}

