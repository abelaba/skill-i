# skill-index

A curated index of agent skills, packaged with [APM](https://microsoft.github.io/apm/)
and browsable on a static website. Skills install on Claude Code, GitHub Copilot,
Cursor, and every other harness APM supports.

Skills can live in two places, and the website lists both:

- **In this repository**, as directories under `.apm/skills/`.
- **In other repositories**, referenced as APM dependencies in `apm.yml`.

Installing the whole index pulls in both kinds.

## Using the skills

Install APM once:

```sh
curl -sSL https://aka.ms/apm-unix | sh
```

Install every skill in this index into your project:

```sh
apm install aai-institute/skills-index
```

Or install a single skill:

```sh
apm install aai-institute/skills-index/.apm/skills/conventional-commits
```

Browse all skills on the website (published via GitHub Pages from this repo).

## Adding a skill

### Option 1: keep the skill in this repository

1. Create a directory under `.apm/skills/<skill-name>/` containing a `SKILL.md`.
2. Start the file with YAML frontmatter:

   ```yaml
   ---
   name: <skill-name>
   description: One sentence saying what the skill does and when to use it.
   ---
   ```

3. Open a pull request. When it merges to `main`, the website rebuilds and the
   skill appears in the index automatically.

The `skill-authoring` skill in this index documents the conventions in detail.

### Option 2: reference a skill that lives in another repository

Add the skill to `dependencies.apm` in `apm.yml`:

```yaml
dependencies:
  apm:
  - anthropics/skills/skills/frontend-design
  - your-org/your-repo/path/to/skill#v1.0.0
```

Then run `apm install` and commit `apm.yml` together with the updated
`apm.lock.yaml`. Pin a tag or commit SHA with `#<ref>` to prevent drift.
The website shows external skills with a badge naming their source repository
and reads their descriptions from the source `SKILL.md`.

## Repository layout

```
.apm/skills/<name>/SKILL.md   Skills hosted in this repository
apm.yml                       APM package manifest; external skills under dependencies.apm
apm.lock.yaml                 Pinned resolution of external dependencies
site/                         Static website source
scripts/build-site.mjs        Generates _site/ (site + skills.json) from both skill sources
.github/workflows/pages.yml   Builds and deploys the site to GitHub Pages
```

## Working on the website

Build and preview locally (no dependencies beyond Node):

```sh
node scripts/build-site.mjs
python3 -m http.server -d _site 8000
```

Then open http://localhost:8000.

The build script derives the GitHub repo slug from `GITHUB_REPOSITORY` (in CI)
or the `origin` remote, so install commands and source links stay correct if
the repo moves.

## Enabling GitHub Pages

One-time setup after pushing to GitHub: in the repo settings under
Pages, set the source to "GitHub Actions".
