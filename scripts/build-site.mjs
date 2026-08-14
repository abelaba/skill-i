#!/usr/bin/env node
// Builds the static site into _site/: copies site/ and generates skills.json
// from the SKILL.md files in the skills folder. No dependencies required.

import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "_site");

// Template configuration, normally set in .github/workflows/pages.yml.
// SKILLS_DIR: repo-relative folder that contains the skill directories.
// SITE_TITLE: heading shown on the website.
const SKILLS_DIR = (process.env.SKILLS_DIR || "skills").replace(/^\/+|\/+$/g, "");
const SITE_TITLE = process.env.SITE_TITLE || "Skill Index";
// Used when the repo has no remote yet (e.g. building right after creating
// a repo from the template). CI and cloned repos derive the real host/slug.
const FALLBACK = { host: "github.com", repo: "OWNER/REPO" };

const skillsDir = join(root, SKILLS_DIR);

// Detects the git host and repo slug from CI environments (GitHub Actions,
// GitLab CI) or the origin remote, so the template works on any git host.
function detectRepo() {
	if (process.env.GITHUB_REPOSITORY) {
		const host = (process.env.GITHUB_SERVER_URL || "https://github.com").replace(/^https?:\/\//, "");
		return { host, repo: process.env.GITHUB_REPOSITORY };
	}
	if (process.env.CI_PROJECT_PATH) {
		return { host: process.env.CI_SERVER_HOST || "gitlab.com", repo: process.env.CI_PROJECT_PATH };
	}
	try {
		const url = execSync("git remote get-url origin", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
			.toString()
			.trim();
		// Handles https://host/owner/repo(.git), git@host:owner/repo(.git),
		// and ssh://git@host/owner/repo(.git) on default ports.
		const m = url.match(/^(?:https?:\/\/|ssh:\/\/)?(?:[^@/]+@)?([^/:]+)[/:](.+?)(?:\.git)?\/?$/);
		if (m) return { host: m[1], repo: m[2] };
	} catch {
		// no remote configured yet
	}
	return FALLBACK;
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

const { host, repo } = detectRepo();
const isGitHub = host === "github.com";
// APM's bare owner/repo shorthand is GitHub-only; other hosts use the
// FQDN shorthand (host/owner/repo), which supports the same subpath syntax.
const apmRef = isGitHub ? repo : `${host}/${repo}`;
// Browse-URL layout differs per host; GitLab inserts /-/ before tree/.
const treeBase = host.includes("gitlab")
	? `https://${host}/${repo}/-/tree/main`
	: `https://${host}/${repo}/tree/main`;

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
			install: {
				apm: `apm install ${apmRef}/${SKILLS_DIR}/${entry.name}`,
				// Single skills over SSH need the apm.yml object form; this
				// snippet goes under dependencies.apm, followed by `apm install`.
				apmSsh: `- git: git@${host}:${repo}.git\n  path: ${SKILLS_DIR}/${entry.name}`,
				// The gh CLI only supports GitHub-hosted repos.
				...(isGitHub && { gh: `gh skill install ${repo} ${SKILLS_DIR}/${entry.name}` }),
			},
			source: `${treeBase}/${SKILLS_DIR}/${entry.name}`,
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
			title: SITE_TITLE,
			host,
			repo,
			repoUrl: `https://${host}/${repo}`,
			skillsDir: SKILLS_DIR,
			installAll: {
				apm: `apm install ${apmRef}`,
				apmSsh: `apm install git@${host}:${repo}.git`,
				...(isGitHub && { gh: `gh skill install ${repo} --all` }),
			},
			skills,
		},
		null,
		2
	)
);

console.log(`Built _site with ${skills.length} skill(s) for ${repo}`);
