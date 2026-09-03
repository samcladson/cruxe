/**
 * functionErrors.ts — Telling a retry apart from a refusal.
 *
 * A queued solve is retried forever. That is right when the server never got
 * the request, and wrong when it got it and said no: the same payload will be
 * refused every time, so the player sits on "pending sync" permanently while
 * the queue churns.
 */

/** An Edge Function call that failed, carrying the HTTP status if there was one. */
export class FunctionCallError extends Error {
  readonly status?: number;
  /** The `error` field from the function's JSON body, when it sent one. */
  readonly serverCode?: string;

  constructor(message: string, status?: number, serverCode?: string) {
    super(message);
    this.name = "FunctionCallError";
    this.status = status;
    this.serverCode = serverCode;
  }
}

/**
 * True when the server rejected the request itself, so resending it unchanged
 * can only fail again.
 *
 * 4xx means "your request is wrong" — except 408 (timeout) and 429 (slow
 * down), which are both invitations to try again. Everything else, including
 * a missing status (a fetch that never reached the server), is treated as
 * retryable: a wrongly-permanent verdict discards a real solve, which is far
 * worse than one wasted retry.
 */
export function isPermanentRejection(error: unknown): boolean {
  const status =
    error instanceof FunctionCallError
      ? error.status
      : (error as { status?: number })?.status;

  if (typeof status !== "number") return false;
  if (status === 408 || status === 429) return false;
  return status >= 400 && status < 500;
}
