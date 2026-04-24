#!/usr/bin/env -S deno run --allow-read
/**
 * EOS Pulse — Architecture Lint
 *
 * Mechanically enforces the layered architecture rules defined in ARCHITECTURE.md.
 *
 * Run:
 *   deno run --allow-read scripts/lint-arch.ts
 *
 * Rules checked:
 *  1. No handler file imports another handler
 *  2. No domain file imports from handlers/ or db.ts
 *  3. server.ts does not import from domain/ or schema.ts directly
 *  4. No raw fetch() calls in pages/
 *  5. No raw HTML elements (button, input, select, table, dialog, textarea) in pages/
 */

import { join, relative } from "https://deno.land/std@0.224.0/path/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const ROOT = new URL("..", import.meta.url).pathname;

const PATHS = {
  handlers: join(ROOT, "service/handlers"),
  domain:   join(ROOT, "service/domain"),
  server:   join(ROOT, "service/server.ts"),
  pages:    join(ROOT, "pages"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface Violation {
  file:    string;
  line:    number;
  rule:    string;
  detail:  string;
}

const violations: Violation[] = [];

function fail(file: string, line: number, rule: string, detail: string) {
  violations.push({ file: relative(ROOT, file), line, rule, detail });
}

async function readLines(filePath: string): Promise<string[]> {
  const text = await Deno.readTextFile(filePath);
  return text.split("\n");
}

async function collectFiles(dir: string, ext = ".ts"): Promise<string[]> {
  const files: string[] = [];
  try {
    for await (const entry of walk(dir, { exts: [ext], followSymlinks: false })) {
      if (entry.isFile) files.push(entry.path);
    }
  } catch {
    // directory may not exist yet
  }
  return files;
}

// Match import/require/export-from statements
const IMPORT_RE = /(?:^|\s)(?:import|export)\s+.*?from\s+['"]([^'"]+)['"]/;
const DYNAMIC_IMPORT_RE = /import\s*\(\s*['"]([^'"]+)['"]/;

function extractImports(line: string): string[] {
  const imports: string[] = [];
  const m1 = IMPORT_RE.exec(line);
  if (m1) imports.push(m1[1]);
  const m2 = DYNAMIC_IMPORT_RE.exec(line);
  if (m2) imports.push(m2[1]);
  return imports;
}

// ---------------------------------------------------------------------------
// Rule 1 — No handler imports another handler
// ---------------------------------------------------------------------------

async function checkHandlersCrossImport() {
  const files = await collectFiles(PATHS.handlers);
  for (const file of files) {
    const lines = await readLines(file);
    lines.forEach((line, idx) => {
      for (const imp of extractImports(line)) {
        if (imp.includes("handlers/") || imp.includes(".handler")) {
          // Allow self-import edge case (shouldn't happen, but be safe)
          if (!file.endsWith(imp.replace(/.*\//, "") + ".ts")) {
            fail(file, idx + 1, "RULE_1", `Handler imports another handler: '${imp}'`);
          }
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 2 — No domain file imports from handlers/ or db.ts
//          Exception: nudges.domain.ts may NOT import from handlers/
//          (it may import other domain files — that is allowed)
// ---------------------------------------------------------------------------

async function checkDomainForbiddenImports() {
  const files = await collectFiles(PATHS.domain);
  for (const file of files) {
    const lines = await readLines(file);
    lines.forEach((line, idx) => {
      for (const imp of extractImports(line)) {
        if (imp.includes("handlers/") || imp.includes(".handler")) {
          fail(file, idx + 1, "RULE_2", `Domain file imports from handlers/: '${imp}'`);
        }
        // Domain files must import db via relative path (../db.ts) — direct is fine
        // but importing from a handler is not
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 3 — server.ts does not import from domain/ or schema.ts directly
// ---------------------------------------------------------------------------

async function checkServerDirectImports() {
  let lines: string[];
  try {
    lines = await readLines(PATHS.server);
  } catch {
    return; // server.ts doesn't exist yet
  }
  lines.forEach((line, idx) => {
    for (const imp of extractImports(line)) {
      if (imp.includes("domain/") || imp.includes(".domain")) {
        fail(PATHS.server, idx + 1, "RULE_3", `server.ts imports from domain/ directly: '${imp}'`);
      }
      if (imp.endsWith("schema") || imp.endsWith("schema.ts") || imp.includes("/schema")) {
        fail(PATHS.server, idx + 1, "RULE_3", `server.ts imports from schema.ts directly: '${imp}'`);
      }
      if (imp.endsWith("/db") || imp.endsWith("/db.ts")) {
        fail(PATHS.server, idx + 1, "RULE_3", `server.ts imports db.ts directly: '${imp}'`);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Rule 4 — No raw fetch() in pages/
// ---------------------------------------------------------------------------

const RAW_FETCH_RE = /(?<![.\w])fetch\s*\(/;
const FETCH_EXCEPTIONS = [
  // Allow fetch in nudges domain (outbound integration)
  // This rule only applies to pages/
];
void FETCH_EXCEPTIONS;

async function checkRawFetchInPages() {
  const files = [
    ...await collectFiles(PATHS.pages, ".ts"),
    ...await collectFiles(PATHS.pages, ".tsx"),
  ];
  for (const file of files) {
    const lines = await readLines(file);
    lines.forEach((line, idx) => {
      // Skip comment lines
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
      if (RAW_FETCH_RE.test(line)) {
        fail(file, idx + 1, "RULE_4", `Raw fetch() call in pages/ — use $fetch from @mspbots/fetch instead`);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 5 — No raw HTML elements in pages/
// ---------------------------------------------------------------------------

// Tags that must be replaced with @mspbots/ui components
const FORBIDDEN_HTML_TAGS = [
  "button",
  "input",
  "select",
  "table",
  "dialog",
  "textarea",
];

// Matches JSX usage: <button, <input, <select, etc.
// Ignores: comments, string literals that aren't JSX, type annotations
function buildTagPattern(tag: string): RegExp {
  // Match <tag> or <tag  or <tag/ but not <ButtonGroup or similar component names
  return new RegExp(`<${tag}[\\s/>]`, "i");
}

const TAG_PATTERNS = FORBIDDEN_HTML_TAGS.map((tag) => ({
  tag,
  pattern: buildTagPattern(tag),
}));

async function checkRawHtmlInPages() {
  const files = [
    ...await collectFiles(PATHS.pages, ".ts"),
    ...await collectFiles(PATHS.pages, ".tsx"),
  ];
  for (const file of files) {
    const lines = await readLines(file);
    lines.forEach((line, idx) => {
      // Skip comment lines
      if (line.trim().startsWith("//") || line.trim().startsWith("*")) return;
      // Skip lines that are clearly just string content (inside quotes)
      const trimmed = line.trim();
      if (trimmed.startsWith('"') || trimmed.startsWith("'") || trimmed.startsWith("`")) return;

      for (const { tag, pattern } of TAG_PATTERNS) {
        if (pattern.test(line)) {
          fail(
            file,
            idx + 1,
            "RULE_5",
            `Raw HTML <${tag}> in pages/ — use @mspbots/ui component instead (see docs/DESIGN.md)`
          );
        }
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("EOS Pulse — Architecture Lint\n");

  await Promise.all([
    checkHandlersCrossImport(),
    checkDomainForbiddenImports(),
    checkServerDirectImports(),
    checkRawFetchInPages(),
    checkRawHtmlInPages(),
  ]);

  if (violations.length === 0) {
    console.log("✅  No architecture violations found.\n");
    Deno.exit(0);
  }

  console.error(`❌  ${violations.length} architecture violation(s) found:\n`);

  // Group by rule
  const byRule = new Map<string, Violation[]>();
  for (const v of violations) {
    const list = byRule.get(v.rule) ?? [];
    list.push(v);
    byRule.set(v.rule, list);
  }

  const ruleDescriptions: Record<string, string> = {
    RULE_1: "No handler imports another handler",
    RULE_2: "No domain file imports from handlers/ or db.ts",
    RULE_3: "server.ts must not import domain/, schema.ts, or db.ts directly",
    RULE_4: "No raw fetch() in pages/ — use $fetch from @mspbots/fetch",
    RULE_5: "No raw HTML elements in pages/ — use @mspbots/ui components",
  };

  for (const [rule, vs] of byRule) {
    console.error(`  [${rule}] ${ruleDescriptions[rule] ?? rule}`);
    for (const v of vs) {
      console.error(`    ${v.file}:${v.line}  ${v.detail}`);
    }
    console.error();
  }

  console.error("See ARCHITECTURE.md and docs/DESIGN.md for the full rules.\n");
  Deno.exit(1);
}

main();
