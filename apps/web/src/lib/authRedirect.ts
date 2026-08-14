/**
 * Where an OAuth round trip should return to: this page, including its path and
 * query (invite tokens, agent-consent params), but never its fragment.
 *
 * Supabase returns the session in the URL fragment. If we hand it a redirect
 * that already ends in "#" — which it does after a previous sign-in, since the
 * consumed callback leaves an empty fragment behind — the result is
 * "…com/##access_token=…", and supabase-js parses no session out of it. The
 * user lands back on the sign-in page holding a valid token it never read.
 */
export function oauthRedirectTo(): string {
  const url = new URL(window.location.href);
  url.hash = "";
  return url.toString();
}
