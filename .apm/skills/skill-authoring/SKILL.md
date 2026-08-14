---
name: skill-authoring
description: Author new agent skills for this index with correct structure, frontmatter, and scoping. Use when creating or reviewing a SKILL.md file.
---

# Skill Authoring

Create well-scoped agent skills for this skill index.

## Structure

Every skill is a directory under `.apm/skills/` containing a `SKILL.md`:

```
.apm/skills/<skill-name>/
└── SKILL.md
```

Supporting files (scripts, references, templates) may live next to `SKILL.md`
and be referenced from it with relative paths.

## Frontmatter

`SKILL.md` must start with YAML frontmatter:

```yaml
---
name: <kebab-case-name>
description: <one sentence saying what the skill does and when to use it>
---
```

- `name` matches the directory name, kebab-case, no spaces.
- `description` is the trigger: it is what an agent reads to decide whether to
  load the skill. State both the capability and the situation it applies to.

## Writing the body

- Open with a one-line summary of what the skill accomplishes.
- Write instructions to the agent, in the imperative.
- Prefer concrete rules and examples over abstract advice.
- Keep it short: a skill that fits on one screen gets followed; a manual does not.
- Do not duplicate knowledge the agent already has; encode decisions,
  conventions, and constraints specific to your team.

## Checklist before committing

- Directory name and frontmatter `name` match.
- Description mentions when to use the skill, not only what it does.
- Body contains at least one concrete example.
- No secrets, internal URLs, or credentials in the skill content.
