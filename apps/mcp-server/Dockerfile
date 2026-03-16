FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Install deps ──────────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy manifests for the whole monorepo so pnpm can resolve workspace deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/editor-extensions/package.json ./packages/editor-extensions/
COPY apps/mcp-server/package.json ./apps/mcp-server/

RUN pnpm install --frozen-lockfile --filter @motion/mcp-server...

# ── Build ─────────────────────────────────────────────────────────────────────
FROM deps AS build
WORKDIR /app

COPY packages/shared ./packages/shared
COPY packages/editor-extensions ./packages/editor-extensions
COPY apps/mcp-server ./apps/mcp-server

RUN pnpm --filter @motion/shared build
RUN pnpm --filter @motion/editor-extensions build
RUN pnpm --filter @motion/mcp-server build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/editor-extensions ./packages/editor-extensions
COPY --from=build /app/apps/mcp-server ./apps/mcp-server
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/mcp-server/node_modules ./apps/mcp-server/node_modules

ENV PORT=8080
EXPOSE 8080

CMD ["node", "apps/mcp-server/dist/index.js", "--http"]
