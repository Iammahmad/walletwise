export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function normalizeError(error: unknown, fallback = 'Something went wrong. Please try again.'): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return new AppError(error.message || fallback, 'unexpected', error);
  return new AppError(fallback, 'unexpected', error);
}

export function logSafeError(scope: string, error: unknown): void {
  const normalized = normalizeError(error);
  // Never include transcripts, transaction payloads, or secrets in production logs.
  console.error(`[${scope}] ${normalized.code}: ${normalized.message}`);
}
