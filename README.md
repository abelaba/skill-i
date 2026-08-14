# Skill Index Template

A template for publishing an organization's agent skills as a browsable,
searchable website with one-line install commands. Skills install on Claude
Code, GitHub Copilot, Cursor, and other harnesses via
[APM](https://microsoft.github.io/apm/) or the
[GitHub CLI](https://cli.github.com/manual/gh_skill_install).

The website lists every skill with a search filter and copyable install
commands, and is deployed to GitHub Pages on every push to `main`.

Skills can live in two places, and the website lists both:

- **In this repository**, as directories under the configured skills folder
  (default `.apm/skills/`).
- **In other repositories**, referenced as APM dependencies in `apm.yml`.

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

### Option 1: keep the skill in this repository

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

### Option 2: reference a skill that lives in another repository

Add the skill to `dependencies.apm` in `apm.yml`:

```yaml
dependencies:
  apm:
  - anthropics/skills/skills/frontend-design#<commit-sha>
  - your-org/your-repo/path/to/skill#v1.0.0
```

Then run `apm install` and commit `apm.yml` together with the updated
`apm.lock.yaml`. Pin a tag or commit SHA with `#<ref>`; CI's audit flags
unpinned dependencies. The website shows external skills with a badge naming
their source repository and reads their descriptions from the source
`SKILL.md`.

## Installing skills from an index

The website offers both commands behind a toggle. Directly:

```sh
# APM: the whole index (including external references), or one skill
apm install <owner>/<repo>
apm install <owner>/<repo>/.apm/skills/<skill-name>

# GitHub CLI: all skills hosted in the repo, or one skill
gh skill install <owner>/<repo> --all
gh skill install <owner>/<repo> .apm/skills/<skill-name>
```

Note that only APM resolves the external references in `apm.yml`; the GitHub
CLI installs skills from one repository at a time.

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
.apm/skills/<name>/SKILL.md   Skills hosted in this repository (configurable)
apm.yml                       APM package manifest; external skills under dependencies.apm
apm.lock.yaml                 Pinned resolution of external dependencies
site/                         Static website source (single file, no dependencies)
scripts/build-site.mjs        Generates _site/ (site + skills.json) from both skill sources
.github/workflows/pages.yml   Builds and deploys the site to GitHub Pages
.github/workflows/ci.yml      Validates skills on pull requests
```

## Working on the website

Build and preview locally (no dependencies beyond Node):

```sh
node scripts/build-site.mjs
python3 -m http.server -d _site 8000
```

Then open http://localhost:8000. External skill descriptions come from
`apm_modules/` when `apm install` has run, and are otherwise fetched from
GitHub, so the site builds without APM installed.
