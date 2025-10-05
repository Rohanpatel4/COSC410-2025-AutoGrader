export type Assignment = {
    id: string;
    course_id: string;
    title: string;
    description?: string | null;
    test_file_id: string;
    submission_limit?: number | null;
    start_at?: string | null;  // ISO timestamps
    end_at?: string | null;
    submission_count?: number; // server-provided count
  };