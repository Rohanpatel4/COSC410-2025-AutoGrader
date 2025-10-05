export type Course = {
  id: number;
  course_id: number;            // int now
  name: string;
  description?: string | null;
  professor_id: number;         // int now
  professor_name?: string | null;
};
