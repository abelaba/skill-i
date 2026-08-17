---
name: curate-commits
description: Restructure a messy feature branch into a small sequence of clean, logically-grouped commits that a reviewer can step through one at a time. Use whenever someone wants to clean up, squash, reorganize, tidy, or rewrite commit history before opening or updating a pull request, make a branch reviewable commit-by-commit, turn a pile of "wip" / "fix typo" / "address review" commits into coherent commits, or make history bisectable — even if they don't literally say "squash". It works by repartitioning the net diff against the base branch into hunk-level logical commits (NOT by squashing the original commits), so wip/revert noise disappears entirely. Do NOT use this for resolving merge conflicts, for writing a single commit message, or for ordinary committing of current work.
---

# curate-commits

Turn a noisy branch into a few commits a reviewer reads **one at a time** —
each commit one coherent, self-explanatory idea.

## Approach: repartition, don't squash

Discard the existing commit boundaries and re-slice the net diff (`base..HEAD`)
into fresh commits. Only the **final** content is committed, so wip/revert churn
vanishes and there are **no intermediate conflicts**. Cost: original
messages/authorship are lost — fine for a solo branch into review; stop and say
so if multi-author attribution must survive.

Assignment is at **hunk** level — one file's changes can split across commits.
Indivisible changes degrade to whole-file (new files, deletions, renames,
binaries, mode changes); see `references/hunk-surgery.md`.

## The one hard constraint: hunk dependencies

A hunk that uses what another hunk introduces must come *after* it. So:

- **Order foundations-first**: new types/helpers/renames → logic that uses them
  → wiring → tests. This ordering also tends to satisfy dependencies for free.
- **Regenerate the diff after every commit** — staging shifts line numbers, so
  cut each commit's hunks from the *current* diff (the script reprints it).
- **If two hunks mutually depend**, merge them into one commit rather than
  forcing a broken split. Correct-but-coarser beats broken.

## Workflow

The helper (`scripts/restructure.py` in this skill) owns the
dangerous/deterministic parts; run it with **the repo you're restructuring as
the current directory** — it operates on the git repo at cwd.

1. **Set up** — `python3 scripts/restructure.py init [--base REF] [--allow-protected]`.
   Refuses a dirty tree or protected branch; resolves base (`--base` → upstream
   merge-base → merge-base with main/master/develop); creates a **backup branch**
   `curate-backup/<branch>/<ts>`; `reset --mixed` to base (net diff now
   unstaged); surfaces new files; prints the full diff to repartition.
2. **Plan, then show the user before executing** — the smallest set of one-idea
   commits. One concern each, understandable from its own diff + message.
   Separate mechanical (refactor/rename/format) from semantic and say so in the
   message — "no behavior changed" is a big reviewer win. A long branch usually
   collapses to ~3–7 commits.
3. **Commit, in order** — for each: read the current remaining diff (`status`),
   build a patch of just this commit's hunks (see `references/hunk-surgery.md`),
   then `restructure.py commit -m "<msg>" --patch /tmp/N.patch` (or `--files
   "a b"` for indivisible changes). Imperative subjects; explain *why* in the
   body when it isn't obvious.
4. **Verify** — `restructure.py verify` passes only when **`git diff
   <backup-branch> HEAD` is empty**: the restructured branch is byte-for-byte
   identical to the original. That one diff is comprehensive — anything left
   uncommitted (a stray hunk, a forgotten new file) is missing from HEAD and so
   shows up against the backup. Don't claim success until it passes.
5. **Bisect (optional)** — `restructure.py bisect-check --test "<build/test cmd>"`
   runs the command at each new commit and reports any that don't stand alone.
6. **Hand off — never push.** Show `git log --oneline <base>..HEAD` and the
   publish command: `git push --force-with-lease` (lease, not plain force). The
   backup branch stays; `restructure.py cleanup` deletes it once satisfied.

**If anything goes wrong:** `restructure.py abort` does `git reset --hard` back
to the backup branch — nothing is lost (the worktree held the final content the
whole time).
