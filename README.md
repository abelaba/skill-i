# Skill Index Template

A template for publishing an organization's agent skills as a browsable,
searchable website with one-line install commands. Skills install on Claude
Code, GitHub Copilot, Cursor, and other harnesses via
[APM](https://microsoft.github.io/apm/) or, on GitHub-hosted repos, the
[GitHub CLI](https://cli.github.com/manual/gh_skill_install).

The website lists every skill with a search filter and copyable install
commands, and deploys to GitHub Pages or GitLab Pages on every push to the
default branch. Skills live in this repository as directories under the
configured skills folder (default `skills/`).

The template is host-agnostic: the build detects the git host and repo slug
from the CI environment (GitHub Actions or GitLab CI) or the `origin` remote,
and generates matching install commands and source links. On non-GitHub hosts
APM commands use the fully qualified form (`host/owner/repo`) and the GitHub
CLI option is hidden.

## Setting up your own index

1. Create a repository from this template ("Use this template" on GitHub, or
   fork/import on GitLab).
2. On GitHub: in the repository settings under Pages, set the source to
   "GitHub Actions". On GitLab: nothing to configure, the `pages` job in
   `.gitlab-ci.yml` publishes automatically.
3. Replace the example skills with your own (see below) and adjust the
   configuration if needed.
4. Push to the default branch. The site goes live at
   `https://<owner>.github.io/<repo>/` or `https://<owner>.gitlab.io/<repo>/`.

## Configuration

| Setting | Where | Default |
| --- | --- | --- |
| Skills folder | `SKILLS_DIR` in `.github/workflows/*.yml` and `.gitlab-ci.yml` | `skills` |
| Site title | `SITE_TITLE` in `.github/workflows/pages.yml` and `.gitlab-ci.yml` | `Skill Index` |
| Git host | `REPO_HOST` (e.g. `gitlab.example.com`) | from the CI platform |
| Repository slug | `REPO_SLUG` (e.g. `owner/repo`) | from the CI platform |
| Platform flavor | `GIT_PLATFORM`: `github`, `gitlab`, or `other` | guessed from the host |
| Package name and author | `apm.yml` | template values |
| Color palette | CSS custom properties at the top of `site/index.html` | brand palette |

On github.com and gitlab.com (or self-managed GitLab CI) the defaults are
correct without setting anything: the build reads the variables the CI
platform itself provides. Set the overrides when the guess would be wrong,
e.g. `GIT_PLATFORM: github` on GitHub Enterprise so gh CLI commands appear.
The platform flavor controls whether gh CLI commands are offered and which
source-link layout is used. Keep the skills folder named
`skills` (or `.apm/skills`) if you want the install-everything commands to
work: both APM and the GitHub CLI discover skills by that convention.

## Adding a skill

1. Create a directory under the skills folder, e.g.
   `skills/<skill-name>/`, containing a `SKILL.md`.
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
# APM on GitHub: the whole index, or one skill
apm install <owner>/<repo>
apm install <owner>/<repo>/skills/<skill-name>

# APM on any other host (GitLab, self-hosted): fully qualified form
apm install <host>/<owner>/<repo>
apm install <host>/<owner>/<repo>/skills/<skill-name>

# GitHub CLI (GitHub-hosted repos only): all skills, or one skill
gh skill install <owner>/<repo> --all
gh skill install <owner>/<repo> skills/<skill-name>
```

The website also offers SSH forms for private repos accessed by SSH key.

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
skills/<name>/SKILL.md        The skills (folder configurable via SKILLS_DIR)
site/                         Static website source (single file, no dependencies)
scripts/build-site.mjs        Generates _site/ (site + skills.json) from the skills
.github/workflows/pages.yml   Builds and deploys the site to GitHub Pages
.github/workflows/ci.yml      Validates skills on pull requests (GitHub)
.gitlab-ci.yml                Validates skills and publishes GitLab Pages (GitLab)
```

## Working on the website

Build and preview locally (no dependencies beyond Node):

```sh
node scripts/build-site.mjs
python3 -m http.server -d _site 8000
```

Outside CI the install commands show an `OWNER/REPO` placeholder; pass the
configuration explicitly for a faithful preview:

```sh
REPO_SLUG=acme/skills SKILLS_DIR=skills node scripts/build-site.mjs
```

Then open http://localhost:8000. The build only reads the skill files, so it
works without APM installed.
