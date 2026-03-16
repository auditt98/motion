/**
 * Centralized app branding config.
 *
 * Fork this project? Change these values to rebrand the entire app.
 * All runtime UI text, server messages, and agent guide headers
 * derive from these constants.
 *
 * Also update:
 *  - apps/web/index.html (page title)
 *  - skills/motion-agent/ (skill name, descriptions, example URLs)
 */

/** Display name shown in the UI (auth page, sidebar fallback, page title) */
export const APP_NAME = "Motion";

/** One-line tagline */
export const APP_DESCRIPTION = "AI-native collaborative document editor";

/** Lowercase slug used in CLI help text and MCP server registration */
export const APP_SLUG = "motion";

/** Default MCP server host for the agent guide (override per-deployment) */
export const DEFAULT_MCP_HOST = "https://motion-mcp-server.fly.dev";
