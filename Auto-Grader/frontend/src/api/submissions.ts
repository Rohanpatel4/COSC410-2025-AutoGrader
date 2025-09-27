/**
 * Submissions API client
 */
import { fetchJson } from './client';

export interface Submission {
  id: string;
  name: string;
  file_ids: string[];
  created_at: string;
}

export interface SubmissionList {
  items: Submission[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateSubmissionRequest {
  name: string;
  file_ids: string[];
}

/**
 * Create a submission
 */
export async function createSubmission(data: CreateSubmissionRequest): Promise<Submission> {
  return fetchJson('/v1/submissions/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get submission by ID
 */
export async function getSubmission(submissionId: string): Promise<Submission> {
  return fetchJson(`/v1/submissions/${submissionId}`);
}

/**
 * List submissions
 */
export async function listSubmissions(skip = 0, limit = 100): Promise<SubmissionList> {
  const params = new URLSearchParams({
    skip: skip.toString(),
    limit: limit.toString(),
  });

  return fetchJson(`/v1/submissions/?${params}`);
}

/**
 * Delete a submission
 */
export async function deleteSubmission(submissionId: string): Promise<void> {
  await fetchJson(`/v1/submissions/${submissionId}`, { method: 'DELETE' });
}
