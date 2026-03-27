# ESLint Configuration

## Problem

The monorepo has a `lint` script in `turbo.json` and `apps/web/package.json`, but no ESLint configuration file exists anywhere in the project. Running `pnpm lint` either fails or does nothing. This means:

- No code quality enforcement across the team
- No automated detection of unused variables, missing dependencies in React hooks, or type errors
- The CI/CD pipeline (when built) has no lint step to gate PRs
- Inconsistent code style across packages

## Priority

~0.5-1 day of effort. Small scope, foundational for code quality.

## What to Build

### 1. Root ESLint flat config

Create `eslint.config.js` at the monorepo root using the new flat config format (ESLint 9+):

```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default tseslint.config(
  // Ignore build outputs
  { ignores: ["**/dist/**", "**/node_modules/**", "**/.partykit/**"] },

  // Base JS rules
  js.configs.recommended,

  // TypeScript rules
  ...tseslint.configs.recommended,

  // React hooks rules (web app only)
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Project-wide rules
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      // TypeScript
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",  // warn not error -- many existing 'any' types
      "@typescript-eslint/no-empty-object-type": "off",

      // General
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
    },
  },

  // Relax rules for config files
  {
    files: ["*.config.{js,ts}", "vite.config.ts", "tailwind.config.ts"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);
```

### 2. Install dependencies

Add to root `package.json` devDependencies:

```bash
pnpm add -Dw eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-react-refresh
```

### 3. Update lint scripts

Ensure each workspace package has a lint script that ESLint can find:

**Root `package.json`:**
```json
{
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  }
}
```

**`turbo.json`** (already has lint task, verify it works):
```json
{
  "tasks": {
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 4. Fix existing lint errors

After adding the config, run `pnpm lint` and triage the results:

- **Auto-fixable** (unused imports, const preference): run `pnpm lint:fix`
- **Warnings** (`no-explicit-any`): leave as warnings for now, fix incrementally
- **Errors** (unused vars, missing hook deps): fix immediately or suppress with targeted comments
- **`no-console`**: review console.log statements -- remove debug logs, keep intentional error logging with `console.error`

Expected areas with most issues:
- `apps/web/src/hooks/useWorkspace.ts` -- many `any` types, console.error calls
- `apps/web/src/hooks/useComments.ts` -- similar pattern
- `apps/mcp-server/src/yjs-peer.ts` -- some `any` casts in Yjs operations

### 5. VS Code integration

Add `.vscode/settings.json` to the repo (if not already present):

```json
{
  "eslint.useFlatConfig": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

## Files to Modify

- `eslint.config.js` (new) -- ESLint flat config at repo root
- `package.json` (root) -- add ESLint devDependencies and lint:fix script
- `.vscode/settings.json` -- ESLint integration (new or update)
- Various source files -- fix auto-fixable lint errors

## Verification

1. `pnpm lint` runs successfully and reports issues
2. `pnpm lint:fix` auto-fixes what it can
3. Unused variables flagged as warnings
4. Missing React hook dependencies flagged
5. `console.log` flagged as warning (but `console.error` allowed)
6. `@typescript-eslint/no-explicit-any` reports as warning (not blocking)
7. VS Code shows inline lint errors/warnings
8. `pnpm build` still succeeds (lint doesn't break the build pipeline)

## Dependencies

None. Should be done before CI/CD pipeline setup so the lint step is meaningful.
