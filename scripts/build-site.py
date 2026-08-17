#!/usr/bin/env python3
"""Builds the static site into _site/: copies site/ and generates skills.json
from the SKILL.md files in the skills folder.

Requires python-frontmatter (pip install -r requirements.txt).

Template configuration, set in .github/workflows/pages.yml or .gitlab-ci.yml:
  SKILLS_DIR:   repo-relative folder that contains the skill directories.
  SITE_TITLE:   heading shown on the website.
  REPO_HOST:    git host, e.g. github.com or gitlab.example.com. Defaults to
                the value the CI platform provides.
  REPO_SLUG:    repository path, e.g. owner/repo. Same default.
  GIT_PLATFORM: github | gitlab | other. Controls the source-link layout.
                Defaults to a guess from REPO_HOST; set it explicitly for
                self-hosted GitLab whose hostname does not contain "gitlab".
  REPO_ACCESS:  https | ssh. How consumers reach the repo; decides which apm
                command form the website shows. Default https.
"""

import json
import os
import re
import shutil
from pathlib import Path

import frontmatter

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "_site"

SKILLS_DIR = os.environ.get("SKILLS_DIR", "skills").strip("/")
SITE_TITLE = os.environ.get("SITE_TITLE", "Skill Index")
REPO_ACCESS = "ssh" if os.environ.get("REPO_ACCESS") == "ssh" else "https"
# Used outside CI when no explicit configuration is set (e.g. a local
# preview): commands then show an obvious placeholder.
FALLBACK = {"host": "github.com", "repo": "OWNER/REPO"}


def resolve_repo():
    """Explicit env vars win, then the variables the CI platform itself
    provides (GitHub Actions, GitLab CI), then the placeholder."""
    if os.environ.get("REPO_HOST") or os.environ.get("REPO_SLUG"):
        return {
            "host": os.environ.get("REPO_HOST", FALLBACK["host"]),
            "repo": os.environ.get("REPO_SLUG", FALLBACK["repo"]),
        }
    if os.environ.get("GITHUB_REPOSITORY"):
        server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
        host = re.sub(r"^https?://", "", server)
        return {"host": host, "repo": os.environ["GITHUB_REPOSITORY"]}
    if os.environ.get("CI_PROJECT_PATH"):
        return {
            "host": os.environ.get("CI_SERVER_HOST", "gitlab.com"),
            "repo": os.environ["CI_PROJECT_PATH"],
        }
    return FALLBACK


def first_paragraph(markdown):
    for block in re.split(r"\r?\n\r?\n", markdown):
        t = block.strip()
        if t and not t.startswith("#") and not t.startswith("```"):
            return re.sub(r"\s+", " ", t)
    return ""


def main():
    resolved = resolve_repo()
    host, repo = resolved["host"], resolved["repo"]
    platform = os.environ.get("GIT_PLATFORM") or (
        "github" if host == "github.com" else "gitlab" if "gitlab" in host else "other"
    )
    # APM's bare owner/repo shorthand is GitHub-only; other hosts use the
    # FQDN shorthand (host/owner/repo), which supports the same subpath syntax.
    apm_ref = repo if host == "github.com" else f"{host}/{repo}"
    # Browse-URL layout differs per platform; GitLab inserts /-/ before tree/.
    tree_base = (
        f"https://{host}/{repo}/-/tree/main"
        if platform == "gitlab"
        else f"https://{host}/{repo}/tree/main"
    )

    skills = []
    skills_dir = ROOT / SKILLS_DIR
    if skills_dir.is_dir():
        for entry in skills_dir.iterdir():
            skill_file = entry / "SKILL.md"
            if not entry.is_dir() or not skill_file.is_file():
                continue
            post = frontmatter.loads(skill_file.read_text(encoding="utf-8"))
            skills.append(
                {
                    "name": str(post.get("name") or entry.name),
                    "description": str(post.get("description") or first_paragraph(post.content)),
                    "install": {
                        # Single skills over SSH need the apm.yml object form; this
                        # snippet goes under dependencies.apm, followed by `apm install`.
                        "apm": (
                            f"- git: git@{host}:{repo}.git\n  path: {SKILLS_DIR}/{entry.name}"
                            if REPO_ACCESS == "ssh"
                            else f"apm install {apm_ref}/{SKILLS_DIR}/{entry.name}"
                        ),
                    },
                    "source": f"{tree_base}/{SKILLS_DIR}/{entry.name}",
                }
            )

    skills.sort(key=lambda s: s["name"])

    shutil.copytree(ROOT / "site", OUT_DIR, dirs_exist_ok=True)
    data = {
        "title": SITE_TITLE,
        "host": host,
        "repo": repo,
        "repoUrl": f"https://{host}/{repo}",
        "skillsDir": SKILLS_DIR,
        "access": REPO_ACCESS,
        "installAll": {
            "apm": (
                f"apm install git@{host}:{repo}.git"
                if REPO_ACCESS == "ssh"
                else f"apm install {apm_ref}"
            ),
        },
        "skills": skills,
    }
    (OUT_DIR / "skills.json").write_text(
        json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )

    print(f"Built _site with {len(skills)} skill(s) for {repo}")


if __name__ == "__main__":
    main()
