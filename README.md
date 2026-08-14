# Skill Index Template

A template for publishing an organization's agent skills as a browsable,
searchable website with one-line install commands. Skills install on Claude
Code, GitHub Copilot, Cursor, and other harnesses via
[APM](https://microsoft.github.io/apm/) or the
[GitHub CLI](https://cli.github.com/manual/gh_skill_install).

The website lists every skill with a search filter and copyable install
commands, and is deployed to GitHub Pages on every push to `main`. Skills
live in this repository as directories under the configured skills folder
(default `.apm/skills/`).

## Setting up your own index

1. Create a repository from this template ("Use this template" on GitHub).
2. In the repository settings under Pages, set the source to "GitHub Actions".
3. Replace the example skills with your own (see below) and adjust the
   configuration if needed.
4. Push to `main`. The site goes live at
   `https://<owner>.github.io/<repo>/`.

## Configuration

| Setting | Where | Default |
| --- | --- | --- |
| Skills folder | `env.SKILLS_DIR` in `.github/workflows/pages.yml` and `ci.yml` | `.apm/skills` |
| Site title | `env.SITE_TITLE` in `.github/workflows/pages.yml` | `Skill Index` |
| Package name and author | `apm.yml` | template values |
| Color palette | CSS custom properties at the top of `site/index.html` | brand palette |

Repository owner and name are derived automatically from the GitHub
environment in CI (or the `origin` remote locally), so install commands and
source links are always correct for your repository.

## Adding a skill

1. Create a directory under the skills folder, e.g.
   `.apm/skills/<skill-name>/`, containing a `SKILL.md`.
2. Start the file with YAML frontmatter:

   ```yaml
   ---
   name: <skill-name>
   description: One sentence saying what the skill does and when to use it.
   ---
   ```

3. Open a pull request. CI validates the skills; when it merges to `main`,
   the website rebuilds and the skill appears in the index automatically.

The `skill-authoring` example skill documents the conventions in detail.

## Installing skills from an index

The website offers both commands behind a toggle. Directly:

```sh
# APM: the whole index, or one skill
apm install <owner>/<repo>
apm install <owner>/<repo>/.apm/skills/<skill-name>

# GitHub CLI: all skills, or one skill
gh skill install <owner>/<repo> --all
gh skill install <owner>/<repo> .apm/skills/<skill-name>
```

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request:

- `apm install --frozen` reproduces the lockfile exactly, catching
  manifest/lockfile drift.
- `apm audit --ci` scans for hidden Unicode, content drift, and lockfile
  integrity.
- `node scripts/build-site.mjs` fails the build on broken skill files.

`.github/workflows/pages.yml` builds and deploys the website on pushes to
`main`.

## Repository layout

```
.apm/skills/<name>/SKILL.md   The skills (folder configurable via SKILLS_DIR)
apm.yml                       APM package manifest
apm.lock.yaml                 APM lockfile, required by the CI checks
site/                         Static website source (single file, no dependencies)
scripts/build-site.mjs        Generates _site/ (site + skills.json) from the skills
.github/workflows/pages.yml   Builds and deploys the site to GitHub Pages
.github/workflows/ci.yml      Validates skills on pull requests
```

## Working on the website

Build and preview locally (no dependencies beyond Node):

```sh
node scripts/build-site.mjs
python3 -m http.server -d _site 8000
```

Then open http://localhost:8000. The build only reads the skill files, so it
works without APM installed.
