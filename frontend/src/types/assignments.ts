export type Assignment = {
  id: number;
  title: string;
  course_id: number;
  description?: string | null;
  language?: string;
  test_file_id?: string | number | null;
  sub_limit?: number | null;
  num_attempts?: number;
  start?: string | null;
  stop?: string | null;
};

