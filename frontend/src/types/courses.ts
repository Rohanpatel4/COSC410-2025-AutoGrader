export type Course = {
  id: number;                 // DB PK
  course_code: string;         // human/tag used for joining & URLs
  enrollment_key: string;
  name: string;
  description?: string | null;
};

