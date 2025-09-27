/**
 * API client utilities
 */

export interface ApiError {
  message: string;
  status: number;
  details?: any;
}

export class ApiClientError extends Error implements ApiError {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Generic fetchJson function with error handling
 */
export async function fetchJson<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const apiUrl = import.meta.env.VITE_API_URL || '/api';

  const response = await fetch(`${apiUrl}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorDetails;

    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
      errorDetails = errorData;
    } catch {
      // If we can't parse error response, use default message
    }

    throw new ApiClientError(errorMessage, response.status, errorDetails);
  }

  return response.json();
}

/**
 * Upload file with FormData
 */
export async function uploadFile(
  url: string,
  file: File,
  category: string
): Promise<any> {
  const apiUrl = import.meta.env.VITE_API_URL || '/api';
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', category);

  const response = await fetch(`${apiUrl}${url}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    let errorDetails;

    try {
      const errorData = await response.json();
      errorMessage = errorData.detail || errorData.message || errorMessage;
      errorDetails = errorData;
    } catch {
      // If we can't parse error response, use default message
    }

    throw new ApiClientError(errorMessage, response.status, errorDetails);
  }

  return response.json();
}
