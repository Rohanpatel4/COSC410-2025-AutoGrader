/**
 * Test Suites API client
 */
import { fetchJson } from './client';

export interface TestSuite {
  id: string;
  name: string;
  file_ids: string[];
  created_at: string;
}

export interface TestSuiteList {
  items: TestSuite[];
  total: number;
  skip: number;
  limit: number;
}

export interface CreateTestSuiteRequest {
  name: string;
  file_ids: string[];
}

/**
 * Create a test suite
 */
export async function createTestSuite(data: CreateTestSuiteRequest): Promise<TestSuite> {
  return fetchJson('/v1/test-suites/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Get test suite by ID
 */
export async function getTestSuite(testSuiteId: string): Promise<TestSuite> {
  return fetchJson(`/v1/test-suites/${testSuiteId}`);
}

/**
 * List test suites
 */
export async function listTestSuites(skip = 0, limit = 100): Promise<TestSuiteList> {
  const params = new URLSearchParams({
    skip: skip.toString(),
    limit: limit.toString(),
  });

  return fetchJson(`/v1/test-suites/?${params}`);
}

/**
 * Delete a test suite
 */
export async function deleteTestSuite(testSuiteId: string): Promise<void> {
  await fetchJson(`/v1/test-suites/${testSuiteId}`, { method: 'DELETE' });
}
