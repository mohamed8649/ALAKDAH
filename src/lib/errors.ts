/**
 * Structured application errors.
 *
 * Services never throw raw database errors across the boundary. Every failure
 * that reaches a server action becomes an `AppError` with a stable `code`; the
 * UI translates that code through the i18n dictionary so the message shown to a
 * merchant is in their language, not the database's.
 */

export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_FAILED'
  | 'CONFLICT'
  | 'STALE_DATA'
  | 'RATE_LIMITED'
  | 'ORDER_INVALID_TRANSITION'
  | 'ORDER_DUPLICATE_BLOCKED'
  | 'INSUFFICIENT_STOCK'
  | 'PRODUCT_UNAVAILABLE'
  | 'CART_EMPTY'
  | 'CHECKOUT_FIELD_REQUIRED'
  | 'IP_BLOCKED'
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_DISABLED'
  | 'SLUG_TAKEN'
  | 'PLAN_LIMIT_REACHED'
  | 'FEATURE_NOT_IN_PLAN'
  | 'INTEGRATION_ERROR'
  | 'AI_GENERATION_FAILED'
  | 'UPLOAD_FAILED'
  | 'INTERNAL_ERROR';

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;
  readonly meta?: Record<string, unknown>;
  readonly httpStatus: number;

  constructor(
    code: ErrorCode,
    message?: string,
    options?: { fieldErrors?: FieldErrors; meta?: Record<string, unknown>; httpStatus?: number },
  ) {
    super(message ?? code);
    this.name = 'AppError';
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
    this.meta = options?.meta;
    this.httpStatus = options?.httpStatus ?? defaultStatus(code);
  }
}

function defaultStatus(code: ErrorCode): number {
  switch (code) {
    case 'UNAUTHENTICATED':
    case 'INVALID_CREDENTIALS':
      return 401;
    case 'FORBIDDEN':
    case 'ACCOUNT_DISABLED':
    case 'IP_BLOCKED':
    case 'FEATURE_NOT_IN_PLAN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
    case 'STALE_DATA':
    case 'SLUG_TAKEN':
    case 'ORDER_INVALID_TRANSITION':
    case 'ORDER_DUPLICATE_BLOCKED':
    case 'INSUFFICIENT_STOCK':
      return 409;
    case 'VALIDATION_FAILED':
    case 'CHECKOUT_FIELD_REQUIRED':
    case 'CART_EMPTY':
    case 'PRODUCT_UNAVAILABLE':
      return 422;
    case 'RATE_LIMITED':
    case 'ACCOUNT_LOCKED':
    case 'PLAN_LIMIT_REACHED':
      return 429;
    default:
      return 500;
  }
}

/** Discriminated result returned by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode; message: string; fieldErrors?: FieldErrors; meta?: Record<string, unknown> } };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(
  code: ErrorCode,
  message?: string,
  options?: { fieldErrors?: FieldErrors; meta?: Record<string, unknown> },
): ActionResult<never> {
  return {
    ok: false,
    error: { code, message: message ?? code, fieldErrors: options?.fieldErrors, meta: options?.meta },
  };
}

/**
 * Convert any thrown value into an ActionResult. Unknown errors are logged with
 * their detail server-side and reduced to INTERNAL_ERROR for the client — no
 * raw database text ever reaches the browser.
 */
export function toActionResult(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return fail(error.code, error.message, { fieldErrors: error.fieldErrors, meta: error.meta });
  }

  if (isPrismaUniqueViolation(error)) {
    return fail('CONFLICT', 'A record with these values already exists.');
  }

  // eslint-disable-next-line no-console -- replaced by the structured logger in src/lib/logger.ts
  console.error('[unhandled]', error);
  return fail('INTERNAL_ERROR', 'Unexpected error.');
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

export function notFound(entity: string): never {
  throw new AppError('NOT_FOUND', `${entity} not found`);
}
