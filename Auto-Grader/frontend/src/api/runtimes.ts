/**
 * Runtimes API client
 */
import { fetchJson } from './client';

export interface Runtime {
  id: string;
  language: string;
  version: string;
  host_path: string;
  compile_cmd?: string;
  run_cmd: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuntimeList {
  items: Runtime[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateRuntimeRequest {
  language: string;
  version: string;
  host_path: string;
  compile_cmd?: string;
  run_cmd: string;
  enabled?: boolean;
}

export interface UpdateRuntimeRequest {
  language?: string;
  version?: string;
  host_path?: string;
  compile_cmd?: string;
  run_cmd?: string;
  enabled?: boolean;
}

/**
 * Create a runtime
 */
export async function createRuntime(data: CreateRuntimeRequest): Promise<Runtime> {
  return fetchJson('/v1/runtimes/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get runtime by ID
 */
export async function getRuntime(runtimeId: string): Promise<Runtime> {
  return fetchJson(`/v1/runtimes/${runtimeId}`);
}

/**
 * List runtimes
 */
export async function listRuntimes(skip = 0, limit = 100): Promise<RuntimeList> {
  const params = new URLSearchParams({
    skip: skip.toString(),
    limit: limit.toString(),
  });

  return fetchJson(`/v1/runtimes/?${params}`);
}

/**
 * Update a runtime
 */
export async function updateRuntime(runtimeId: string, data: UpdateRuntimeRequest): Promise<Runtime> {
  return fetchJson(`/v1/runtimes/${runtimeId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

/**
 * Delete a runtime
 */
export async function deleteRuntime(runtimeId: string): Promise<void> {
  await fetchJson(`/v1/runtimes/${runtimeId}`, { method: 'DELETE' });
}
