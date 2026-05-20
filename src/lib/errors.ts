/**
 * Error taxonomy — layered error types for Clean Architecture.
 * Domain errors: business rule violations (price not available, position stale).
 * Application errors: use-case orchestration failures.
 */

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class ApplicationError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function toUserFriendlyMessage(error: unknown): string {
  if (error instanceof DomainError) {
    return error.message;
  }
  if (error instanceof ApplicationError) {
    if (error.statusCode >= 500) {
      return "Something went wrong. Please try again later.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return "An unexpected error occurred.";
  }
  return "An unknown error occurred.";
}
