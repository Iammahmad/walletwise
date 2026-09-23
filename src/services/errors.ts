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
  const safeScope = scope.replace(/[^a-z0-9_-]/gi, '').slice(0, 48) || 'app';
  const safeCode = normalized.code.replace(/[^a-z0-9_-]/gi, '').slice(0, 48) || 'unexpected';
  // Error messages can contain provider payloads or user-entered text. Keep
  // details in development only and emit identifiers—not financial data—in production.
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error(`[${safeScope}] ${safeCode}: ${normalized.message}`);
    return;
  }
  console.error(`[${safeScope}] ${safeCode}`);
}
