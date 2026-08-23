/**
 * Determine whether cookies should use the `secure` flag.
 * By default in production (`NODE_ENV === "production"`), cookies require HTTPS (`secure: true`).
 * For test domains running over HTTP without SSL (e.g. sslip.io or IP addresses),
 * setting `COOKIE_SECURE=false` in `.env` allows cookies to be stored over HTTP.
 */
export function isCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE === "false") return false;
  if (process.env.COOKIE_SECURE === "true") return true;
  return process.env.NODE_ENV === "production";
}
