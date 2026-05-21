// Retry helper for idempotent provider calls.
//
// Used for read-only operations (getQuote, getStatus, getCoinList) where a
// retry is safe. NEVER use this around createTransaction — retrying a create
// can produce two real swaps with two deposit addresses (money risk).

export interface RetryOptions {
  /** How many times to retry AFTER the first attempt. Default 2. */
  retries?: number;
  /** Delay between attempts in ms. Default 500. */
  delayMs?: number;
  /** Optional label for log lines. */
  label?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run `fn`, retrying on failure. Total attempts = retries + 1.
 *
 * A predicate decides whether an error is retryable — by default everything
 * is retried, but the ChangeNOW client passes a predicate that skips 4xx
 * client errors (a bad pair won't fix itself on retry).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions & { isRetryable?: (err: unknown) => boolean } = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 500;
  const label = options.label ?? "request";
  const isRetryable = options.isRetryable ?? (() => true);

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err)) break;
      console.warn(
        `[retry] ${label} attempt ${attempt + 1} failed, retrying in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }
  throw lastErr;
}
