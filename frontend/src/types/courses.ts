export type Course = {
  id: number;
  course_code: string;         // e.g., "COSC-410"
  enrollment_key?: string;     // 12-char random code for student registration
  name: string;
  description?: string | null;
};

