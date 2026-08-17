# Skill Index Template

A template for publishing an organization's agent skills as a browsable,
searchable website with one-line install commands. Skills install on Claude
Code, GitHub Copilot, Cursor, and other harnesses via
[APM](https://microsoft.github.io/apm/).

The website lists every skill with a search filter and copyable install
commands, and deploys to GitHub Pages or GitLab Pages on every push to the
default branch. Skills live in this repository as directories under the
configured skills folder (default `skills/`).

The template is host-agnostic: the build takes the git host and repo slug
from the CI environment (GitHub Actions or GitLab CI) or explicit variables,
and generates matching install commands and source links. On non-GitHub hosts
APM commands use the fully qualified form (`host/owner/repo`).

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
| Repo access | `REPO_ACCESS`: `https` or `ssh` | `https` |
| Color palette | CSS custom properties at the top of `site/index.html` | brand palette |

On github.com and gitlab.com (or self-managed GitLab CI) the defaults are
correct without setting anything: the build reads the variables the CI
platform itself provides. Set the overrides when the guess would be wrong,
e.g. `GIT_PLATFORM: gitlab` on a self-hosted GitLab whose hostname does not
contain "gitlab". The platform flavor controls the source-link layout. Keep
the skills folder named `skills` (or `.apm/skills`) if you want the
install-everything command to work: APM discovers skills by that convention.

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

```sh
# On GitHub: the whole index, or one skill
apm install <owner>/<repo>
apm install <owner>/<repo>/skills/<skill-name>

# On any other host (GitLab, self-hosted): fully qualified form
apm install <host>/<owner>/<repo>
apm install <host>/<owner>/<repo>/skills/<skill-name>
```

With `REPO_ACCESS: ssh` the website shows SSH forms instead (for private
repos accessed by SSH key): install-everything becomes
`apm install git@<host>:<owner>/<repo>.git`, and single skills become an
`apm.yml` dependencies snippet, since APM does not accept subpaths inside git
URLs. The configured connection type is displayed on the website.

## Continuous integration

`.github/workflows/ci.yml` runs on every pull request and builds the website
index, failing on broken skill files.

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
