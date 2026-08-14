#!/usr/bin/env node
// Builds the static site into _site/: copies site/ and generates skills.json.
//
// Skills come from two places:
//   1. Local:    .apm/skills/<name>/SKILL.md in this repository
//   2. External: entries under dependencies.apm in apm.yml, pointing at
//                skills that live in other repositories
//
// External metadata is read from apm_modules/ when `apm install` has run;
// otherwise it is fetched from the source repository on GitHub.
// No dependencies required.

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

// Reads dependencies.apm entries out of apm.yml without a YAML library.
function apmDependencies() {
  const manifest = join(root, "apm.yml");
  if (!existsSync(manifest)) return [];
  const lines = readFileSync(manifest, "utf8").split(/\r?\n/);
  const deps = [];
  let inDeps = false;
  let inApm = false;
  for (const line of lines) {
    const item = line.match(/^\s+-\s*(\S+)/);
    if (item) {
      if (inDeps && inApm && !item[1].startsWith("#")) deps.push(item[1]);
    } else if (/^\S/.test(line)) {
      inDeps = /^dependencies:/.test(line);
      inApm = false;
    } else if (inDeps && /^\s+[A-Za-z_]+:/.test(line)) {
      inApm = /^\s+apm:/.test(line);
    }
  }
  return deps;
}

async function externalSkill(spec) {
  const [path, ref] = spec.split("#");
  const segments = path.split("/");
  const [owner, repo] = segments;
  const subpath = segments.slice(2).join("/");
  const name = segments[segments.length - 1];
  const treeRef = ref || "HEAD";

  let description = "";
  // Prefer locally installed metadata, fall back to fetching from GitHub.
  const candidates = subpath
    ? [join(root, "apm_modules", owner, repo, subpath, "SKILL.md")]
    : [join(root, "apm_modules", owner, repo, "apm.yml")];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    const { attrs, body } = parseFrontmatter(text);
    description = attrs.description || firstParagraph(body);
  }
  if (!description) {
    const remote = subpath ? `${subpath}/SKILL.md` : "apm.yml";
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${treeRef}/${remote}`);
      if (res.ok) {
        const { attrs, body } = parseFrontmatter(await res.text());
        description = attrs.description || firstParagraph(body);
      }
    } catch {
      // offline or private repo; keep the generic description
    }
  }
  if (!description) description = `External ${subpath ? "skill" : "package"} from ${owner}/${repo}.`;

  return {
    name,
    description,
    origin: "external",
    originRepo: `${owner}/${repo}`,
    install: `apm install ${spec}`,
    source: `https://github.com/${owner}/${repo}/tree/${treeRef}/${subpath}`.replace(/\/$/, ""),
  };
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
      origin: "local",
      originRepo: repo,
      install: `apm install ${repo}/.apm/skills/${entry.name}`,
      source: `https://github.com/${repo}/tree/main/.apm/skills/${entry.name}`,
    });
  }
}

skills.push(...(await Promise.all(apmDependencies().map(externalSkill))));
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

const external = skills.filter((s) => s.origin === "external").length;
console.log(`Built _site with ${skills.length} skill(s) (${skills.length - external} local, ${external} external) for ${repo}`);
