#!/usr/bin/env node
// Builds the static site into _site/: copies site/ and generates skills.json
// from the SKILL.md files in the skills folder. No dependencies required.

import { cpSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "_site");

// Template configuration, set in .github/workflows/pages.yml or .gitlab-ci.yml.
// SKILLS_DIR:   repo-relative folder that contains the skill directories.
// SITE_TITLE:   heading shown on the website.
// REPO_HOST:    git host, e.g. github.com or gitlab.example.com. Defaults to
//               the value the CI platform provides.
// REPO_SLUG:    repository path, e.g. owner/repo. Same default.
// GIT_PLATFORM: github | gitlab | other. Controls the source-link layout.
//               Defaults to a guess from REPO_HOST; set it explicitly for
//               self-hosted GitLab whose hostname does not contain "gitlab".
// REPO_ACCESS:  https | ssh. How consumers reach the repo; decides which apm
//               command form the website shows. Default https.
const SKILLS_DIR = (process.env.SKILLS_DIR || "skills").replace(/^\/+|\/+$/g, "");
const SITE_TITLE = process.env.SITE_TITLE || "Skill Index";
const REPO_ACCESS = process.env.REPO_ACCESS === "ssh" ? "ssh" : "https";
// Used outside CI when no explicit configuration is set (e.g. a local
// preview): commands then show an obvious placeholder.
const FALLBACK = { host: "github.com", repo: "OWNER/REPO" };

const skillsDir = join(root, SKILLS_DIR);

// Resolves host and slug: explicit env vars win, then the variables the CI
// platform itself provides (GitHub Actions, GitLab CI), then the placeholder.
function resolveRepo() {
	if (process.env.REPO_HOST || process.env.REPO_SLUG) {
		return {
			host: process.env.REPO_HOST || FALLBACK.host,
			repo: process.env.REPO_SLUG || FALLBACK.repo,
		};
	}
	if (process.env.GITHUB_REPOSITORY) {
		const host = (process.env.GITHUB_SERVER_URL || "https://github.com").replace(/^https?:\/\//, "");
		return { host, repo: process.env.GITHUB_REPOSITORY };
	}
	if (process.env.CI_PROJECT_PATH) {
		return { host: process.env.CI_SERVER_HOST || "gitlab.com", repo: process.env.CI_PROJECT_PATH };
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

const { host, repo } = resolveRepo();
const platform =
	process.env.GIT_PLATFORM || (host === "github.com" ? "github" : host.includes("gitlab") ? "gitlab" : "other");
// APM's bare owner/repo shorthand is GitHub-only; other hosts use the
// FQDN shorthand (host/owner/repo), which supports the same subpath syntax.
const apmRef = host === "github.com" ? repo : `${host}/${repo}`;
// Browse-URL layout differs per platform; GitLab inserts /-/ before tree/.
const treeBase = platform === "gitlab"
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
				// Single skills over SSH need the apm.yml object form; this
				// snippet goes under dependencies.apm, followed by `apm install`.
				apm: REPO_ACCESS === "ssh"
					? `- git: git@${host}:${repo}.git\n  path: ${SKILLS_DIR}/${entry.name}`
					: `apm install ${apmRef}/${SKILLS_DIR}/${entry.name}`,
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
			access: REPO_ACCESS,
			installAll: {
				apm: REPO_ACCESS === "ssh" ? `apm install git@${host}:${repo}.git` : `apm install ${apmRef}`,
			},
			skills,
		},
		null,
		2
	)
);

console.log(`Built _site with ${skills.length} skill(s) for ${repo}`);
