#!/usr/bin/env node
/**
 * Materialize the Motion agent skill + docs from the single source of truth
 * (packages/shared/src/skill.ts). Run via:
 *   pnpm --filter @motion/shared generate:agent-docs
 *
 * Writes:
 *   - skills/motion/{SKILL.md, references/*}            (canonical)
 *   - plugins/claude/skills/motion/{SKILL.md, references/*}
 *   - plugins/codex/skills/motion/{SKILL.md, references/*}
 *   - docs/agent-document-guide.md
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildSkillMarkdown,
  buildBlockFormatReference,
  buildToolReference,
  buildAgentDocMarkdown,
} from "../dist/index.js";

const here = dirname(fileURLToPath(import.meta.url)); // packages/shared/scripts
const repo = join(here, "..", "..", ".."); // repo root

const skillMd = buildSkillMarkdown();
const blockRef = buildBlockFormatReference();
const toolRef = buildToolReference();
const docMd = buildAgentDocMarkdown();

const skillDirs = [
  join(repo, "skills", "motion"),
  join(repo, "plugins", "claude", "skills", "motion"),
  join(repo, "plugins", "codex", "skills", "motion"),
];

for (const dir of skillDirs) {
  mkdirSync(join(dir, "references"), { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), skillMd);
  writeFileSync(join(dir, "references", "block-format.md"), blockRef);
  writeFileSync(join(dir, "references", "tools.md"), toolRef);
}

mkdirSync(join(repo, "docs"), { recursive: true });
writeFileSync(join(repo, "docs", "agent-document-guide.md"), docMd);

console.log(`Generated skill into ${skillDirs.length} locations + docs/agent-document-guide.md`);
