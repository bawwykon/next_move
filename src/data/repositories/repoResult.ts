/**
 * Consistent fetch wrapper for repositories (S3-01).
 * `data` is null on failure; `error` carries a human-readable message.
 */
export interface RepoResult<T> {
  data: T | null;
  error: string | null;
}

export function ok<T>(data: T): RepoResult<T> {
  return { data, error: null };
}

export function fail<T>(error: string): RepoResult<T> {
  return { data: null, error };
}
