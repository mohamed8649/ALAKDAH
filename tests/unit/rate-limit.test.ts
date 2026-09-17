import { beforeEach, describe, expect, it } from 'vitest';

import {
  checkRateLimit,
  enforceRateLimit,
  RATE_LIMITS,
  resetRateLimit,
} from '@/lib/rate-limit';

/**
 * Rate limiting protects sign-in, order creation and the AI endpoints. The
 * property that matters most is the one that is easy to get wrong in the other
 * direction: a limit that counts *successful* attempts locks out the people it
 * is meant to protect. That is why both sign-in paths clear their bucket on a
 * correct password, and why it is pinned here.
 */
describe('checkRateLimit', () => {
  beforeEach(() => {
    for (const kind of Object.keys(RATE_LIMITS) as Array<keyof typeof RATE_LIMITS>) {
      resetRateLimit(kind, 'test-subject');
    }
  });

  it('allows attempts up to the limit', () => {
    const { limit } = RATE_LIMITS.login;

    for (let attempt = 1; attempt <= limit; attempt += 1) {
      expect(checkRateLimit('login', 'test-subject').allowed, `attempt ${attempt}`).toBe(true);
    }
  });

  it('refuses the attempt after the limit and says when to retry', () => {
    const { limit } = RATE_LIMITS.login;
    for (let attempt = 0; attempt < limit; attempt += 1) checkRateLimit('login', 'test-subject');

    const result = checkRateLimit('login', 'test-subject');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it('counts each identifier separately', () => {
    const { limit } = RATE_LIMITS.login;
    for (let attempt = 0; attempt < limit; attempt += 1) checkRateLimit('login', 'test-subject');

    expect(checkRateLimit('login', 'test-subject').allowed).toBe(false);
    expect(checkRateLimit('login', 'someone-else').allowed).toBe(true);
    resetRateLimit('login', 'someone-else');
  });

  it('counts each kind separately', () => {
    const { limit } = RATE_LIMITS.login;
    for (let attempt = 0; attempt < limit; attempt += 1) checkRateLimit('login', 'test-subject');

    expect(checkRateLimit('login', 'test-subject').allowed).toBe(false);
    expect(checkRateLimit('agentLogin', 'test-subject').allowed).toBe(true);
  });
});

describe('resetRateLimit', () => {
  it('clears the bucket so a proven identity is not punished', () => {
    const { limit } = RATE_LIMITS.agentLogin;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      checkRateLimit('agentLogin', 'shift-worker');
    }
    expect(checkRateLimit('agentLogin', 'shift-worker').allowed).toBe(false);

    // This is what a correct password does. Both sign-in realms call it; an
    // agent rotating through a shared terminal would otherwise exhaust the
    // window with successful sign-ins and be locked out of their own shift.
    resetRateLimit('agentLogin', 'shift-worker');

    expect(checkRateLimit('agentLogin', 'shift-worker').allowed).toBe(true);
    resetRateLimit('agentLogin', 'shift-worker');
  });
});

describe('enforceRateLimit', () => {
  it('throws a RATE_LIMITED error rather than returning a flag', () => {
    const { limit } = RATE_LIMITS.orderCreate;
    resetRateLimit('orderCreate', 'shop');

    for (let attempt = 0; attempt < limit; attempt += 1) {
      expect(() => enforceRateLimit('orderCreate', 'shop')).not.toThrow();
    }

    expect(() => enforceRateLimit('orderCreate', 'shop')).toThrowError(
      expect.objectContaining({ code: 'RATE_LIMITED' }),
    );

    resetRateLimit('orderCreate', 'shop');
  });
});

describe('the configured limits', () => {
  it('are all positive and bounded to a real window', () => {
    for (const [kind, rule] of Object.entries(RATE_LIMITS)) {
      expect(rule.limit, kind).toBeGreaterThan(0);
      expect(rule.windowMs, kind).toBeGreaterThan(0);
    }
  });

  it('cover every endpoint the brief names as needing one', () => {
    // Auth, order creation, tracking, AI and token creation.
    for (const kind of [
      'login',
      'agentLogin',
      'register',
      'orderCreate',
      'orderTracking',
      'aiGeneration',
      'tokenCreate',
    ] as const) {
      expect(RATE_LIMITS[kind]).toBeDefined();
    }
  });
});
