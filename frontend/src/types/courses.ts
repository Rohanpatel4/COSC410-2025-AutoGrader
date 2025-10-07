export type Course = {
  id: number;                 // DB PK
  course_tag: string;         // human/tag used for joining & URLs
  name: string;
  description?: string | null;
};

