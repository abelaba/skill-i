#!/usr/bin/env node
// Builds the static site into _site/: copies site/ and generates skills.json
// from the SKILL.md files under .apm/skills/. No dependencies required.

import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(root, ".apm", "skills");
const outDir = join(root, "_site");

const FALLBACK_REPO = "aai-institute/skills-index";

function repoSlug() {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const url = execSync("git remote get-url origin", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    const m = url.match(/github\.com[/:]([^/]+\/[^/.]+)/);
    if (m) return m[1];
  } catch {
    // no remote configured yet
  }
  return FALLBACK_REPO;
}

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { attrs: {}, body: text };
  const attrs = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) attrs[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return { attrs, body: text.slice(m[0].length) };
}

function firstParagraph(markdown) {
  for (const block of markdown.split(/\r?\n\r?\n/)) {
    const t = block.trim();
    if (t && !t.startsWith("#") && !t.startsWith("```")) return t.replace(/\s+/g, " ");
  }
  return "";
}

const repo = repoSlug();
const skills = [];

if (existsSync(skillsDir)) {
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = join(skillsDir, entry.name, "SKILL.md");
    if (!existsSync(skillFile)) continue;
    const { attrs, body } = parseFrontmatter(readFileSync(skillFile, "utf8"));
    skills.push({
      name: attrs.name || entry.name,
      description: attrs.description || firstParagraph(body),
      path: `.apm/skills/${entry.name}`,
      install: `apm install ${repo}/.apm/skills/${entry.name}`,
      source: `https://github.com/${repo}/tree/main/.apm/skills/${entry.name}`,
    });
  }
}

skills.sort((a, b) => a.name.localeCompare(b.name));

mkdirSync(outDir, { recursive: true });
cpSync(join(root, "site"), outDir, { recursive: true });
writeFileSync(
  join(outDir, "skills.json"),
  JSON.stringify(
    {
      repo,
      repoUrl: `https://github.com/${repo}`,
      installAll: `apm install ${repo}`,
      skills,
    },
    null,
    2
  )
);

console.log(`Built _site with ${skills.length} skill(s) for ${repo}`);
