import { headers } from "next/headers";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type RateLimitEntry = {
  readonly resetAt: number;
  readonly attempts: number;
};

const attemptsByKey = new Map<string, RateLimitEntry>();

export function toAccountSignupClientKey(headerList: Headers): string {
  const forwardedFor = headerList.get("x-forwarded-for");

  if (forwardedFor !== null) {
    const [clientIp] = forwardedFor.split(",");
    const normalizedClientIp = clientIp?.trim();

    if (normalizedClientIp !== undefined && normalizedClientIp !== "") {
      return normalizedClientIp;
    }
  }

  return headerList.get("x-real-ip")?.trim() || "unknown";
}

type CheckRateLimitOptions = {
  readonly clientKey: string;
  readonly maxAttempts?: number;
  readonly now?: number;
  readonly store?: Map<string, RateLimitEntry>;
  readonly windowMs?: number;
};

export function checkAccountSignupRateLimitForKey({
  clientKey,
  maxAttempts = MAX_ATTEMPTS,
  now = Date.now(),
  store = attemptsByKey,
  windowMs = WINDOW_MS,
}: CheckRateLimitOptions): boolean {
  const currentEntry = store.get(clientKey);

  if (currentEntry === undefined || currentEntry.resetAt <= now) {
    store.set(clientKey, {
      attempts: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (currentEntry.attempts >= maxAttempts) {
    return false;
  }

  store.set(clientKey, {
    attempts: currentEntry.attempts + 1,
    resetAt: currentEntry.resetAt,
  });

  return true;
}

export async function checkAccountSignupRateLimit(): Promise<boolean> {
  const headerList = await headers();
  const clientKey = toAccountSignupClientKey(headerList);

  return checkAccountSignupRateLimitForKey({ clientKey });
}
