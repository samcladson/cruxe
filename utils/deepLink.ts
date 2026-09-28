/**
 * deepLink.ts — what an incoming link is allowed to open.
 *
 * Entering a puzzle spends a free play or coins as soon as it loads, and inside
 * the app the cost is shown on the button that starts it. A `cruxe://game/...`
 * link from a web page or a message would skip that, so game routes are never
 * opened from outside: such a link lands on Home instead. Everything else
 * passes through unchanged.
 */

/** Scheme and host, or an Expo dev-server prefix ending in `/--`. */
const PREFIX = /^(?:[a-z][a-z0-9+.-]*:\/\/(?:[^/?#]*\/--)?)?\/*/i;

export function safeIncomingPath(path: string): string {
  const route = path.replace(PREFIX, "");
  return /^game(?:[/?#]|$)/i.test(route) ? "/" : path;
}
