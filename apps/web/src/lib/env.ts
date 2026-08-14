/**
 * Vite inlines env vars at build time, so a production build made without the
 * repo-root .env silently falls back to localhost and ships a dead site.
 * (envDir is the monorepo root — see apps/web/vite.config.ts.)
 * Fail the build's first render instead, loudly.
 */
export function requireEnv(name: string, devFallback: string): string {
  const value = import.meta.env[name as keyof ImportMetaEnv] as string | undefined;
  if (value) return value;
  if (import.meta.env.PROD) {
    throw new Error(
      `${name} is not set. Production builds must run with the monorepo-root .env present — ` +
        `see .env.example. Refusing to fall back to ${devFallback}.`,
    );
  }
  console.warn(`${name} not set, falling back to ${devFallback}`);
  return devFallback;
}
