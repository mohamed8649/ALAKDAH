/**
 * Structured logging.
 *
 * One JSON line per event in production so logs are queryable; a readable line
 * in development. console.log is never the final answer — every call site goes
 * through here so log shape stays consistent and a transport can be swapped in
 * without touching application code.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  storeId?: string;
  actorId?: string;
  requestId?: string;
  entityType?: string;
  entityId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

function minLevel(): number {
  const configured = (process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug')) as Level;
  return LEVEL_ORDER[configured] ?? LEVEL_ORDER.info;
}

function write(level: Level, message: string, context?: LogContext, error?: unknown): void {
  if (LEVEL_ORDER[level] < minLevel()) return;

  const entry = {
    level,
    time: new Date().toISOString(),
    message,
    ...context,
    ...(error ? { error: serialiseError(error) } : {}),
  };

  const target = level === 'error' || level === 'warn' ? console.error : console.log;

  if (process.env.NODE_ENV === 'production') {
    target(JSON.stringify(entry));
  } else {
    const { level: _l, time: _t, message: _m, ...rest } = entry;
    const extras = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
    target(`[${level}] ${message}${extras}`);
  }
}

function serialiseError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { value: String(error) };
}

export const logger = {
  debug: (message: string, context?: LogContext) => write('debug', message, context),
  info: (message: string, context?: LogContext) => write('info', message, context),
  warn: (message: string, context?: LogContext) => write('warn', message, context),
  error: (message: string, error?: unknown, context?: LogContext) =>
    write('error', message, context, error),
};
