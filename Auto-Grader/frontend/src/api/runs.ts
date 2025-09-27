/**
 * Runs API client
 */
import { fetchJson } from './client';

export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface Run {
  id: string;
  submission_id: string;
  testsuite_id: string;
  runtime_id: string;
  status: RunStatus;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  exit_code?: number;
  stdout_path?: string;
  stderr_path?: string;
}

export interface RunList {
  items: Run[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateRunRequest {
  submission_id: string;
  testsuite_id: string;
  runtime_id: string;
}

/**
 * Create a run
 */
export async function createRun(data: CreateRunRequest): Promise<Run> {
  return fetchJson('/v1/runs/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get run by ID
 */
export async function getRun(runId: string): Promise<Run> {
  return fetchJson(`/v1/runs/${runId}`);
}

/**
 * List runs
 */
export async function listRuns(skip = 0, limit = 100): Promise<RunList> {
  const params = new URLSearchParams({
    skip: skip.toString(),
    limit: limit.toString(),
  });

  return fetchJson(`/v1/runs/?${params}`);
}

/**
 * Get run stdout
 */
export async function getRunStdout(runId: string): Promise<string> {
  const response = await fetch(`/api/v1/runs/${runId}/stdout`);
  if (!response.ok) {
    throw new Error(`Failed to get stdout: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Get run stderr
 */
export async function getRunStderr(runId: string): Promise<string> {
  const response = await fetch(`/api/v1/runs/${runId}/stderr`);
  if (!response.ok) {
    throw new Error(`Failed to get stderr: ${response.statusText}`);
  }
  return response.text();
}

/**
 * Delete a run
 */
export async function deleteRun(runId: string): Promise<void> {
  await fetchJson(`/v1/runs/${runId}`, { method: 'DELETE' });
}
