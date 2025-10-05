export type Assignment = {
    id: string;
    course_id: string;
    title: string;
    description?: string | null;
    test_file: File;
    submission_limit?: number | null;
    start_at?: Date | null;  // Date object in client
    end_at?: Date | null;
    submission_count?: number; // server-provided count
  };