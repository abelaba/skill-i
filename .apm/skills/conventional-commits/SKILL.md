---
name: conventional-commits
description: Write clear, consistent commit messages following the Conventional Commits specification. Use when committing changes or reviewing commit history.
---

# Conventional Commits

Write commit messages that follow the Conventional Commits specification.

## Format

```
<type>(<optional scope>): <description>

<optional body>

<optional footer>
```

## Types

- `feat`: a new feature
- `fix`: a bug fix
- `docs`: documentation-only changes
- `refactor`: a code change that neither fixes a bug nor adds a feature
- `perf`: a change that improves performance
- `test`: adding or correcting tests
- `build`: changes to the build system or dependencies
- `ci`: changes to CI configuration
- `chore`: other changes that don't modify src or test files

## Rules

- Use the imperative mood in the description ("add", not "added" or "adds").
- Keep the subject line at or under 72 characters.
- Do not end the subject line with a period.
- Mark breaking changes with `!` after the type/scope and explain them in a `BREAKING CHANGE:` footer.
- The body explains what and why, not how.

## Examples

```
feat(parser): add support for YAML frontmatter

fix: handle empty skill directories during index build

refactor(site)!: rename skills.json fields

BREAKING CHANGE: `title` is now `name` in skills.json.
```
