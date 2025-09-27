/**
 * Files API client
 */
import { fetchJson, uploadFile } from './client';

export interface File {
  id: string;
  name: string;
  category: 'TEST_CASE' | 'SUBMISSION';
  size_bytes: number;
  sha256: string;
  created_at: string;
}

export interface FileList {
  items: File[];
  total: number;
  skip: number;
  limit: number;
}

/**
 * Upload a file
 */
export async function uploadFileApi(file: File, category: 'TEST_CASE' | 'SUBMISSION'): Promise<File> {
  return uploadFile('/v1/files/', file, category);
}

/**
 * Get file by ID
 */
export async function getFile(fileId: string): Promise<File> {
  return fetchJson(`/v1/files/${fileId}`);
}

/**
 * List files with optional category filter
 */
export async function listFiles(
  category?: 'TEST_CASE' | 'SUBMISSION',
  skip = 0,
  limit = 100
): Promise<FileList> {
  const params = new URLSearchParams({
    skip: skip.toString(),
    limit: limit.toString(),
  });

  if (category) {
    params.append('category', category);
  }

  return fetchJson(`/v1/files/?${params}`);
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string): Promise<void> {
  await fetchJson(`/v1/files/${fileId}`, { method: 'DELETE' });
}
