export type Course = {
  id: string;             // server-generated
  course_id: string;      // faculty-specified (for student registration) (e.g., COSC-410)
  name: string;           // of course
  description?: string;   // of course
  professor_id: string;   // creator's userId
  professor_name?: string; // name of professor
};
