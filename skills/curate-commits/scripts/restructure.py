#!/usr/bin/env python3
"""Drive a hunk-level branch restructure safely.

Strategy ("repartition the net diff"): reset HEAD to the base while keeping the
worktree at its final content, so the entire net diff sits unstaged. Then build
a clean sequence of commits by staging selected hunks into the index, one commit
at a time. The worktree is never modified, so the final tree is guaranteed to
match the original (this is asserted by `verify`).

This script owns the operations that are dangerous to improvise — backup, reset,
applying patches, the tree-equality assertion, and rollback — and leaves the
semantic work (which hunks belong together) to the caller.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from pathlib import Path

PROTECTED_PREFIXES = ("release/", "hotfix/")
PROTECTED_EXACT = {"main", "master", "develop", "trunk"}
BASE_CANDIDATES = ("main", "master", "develop", "trunk")


# --- low-level git helpers ---------------------------------------------------

def git(*args: str, check: bool = True, capture: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(
        ["git", *args],
        check=check,
        text=True,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.PIPE if capture else None,
    )


def git_out(*args: str) -> str:
    return git(*args).stdout.strip()


def git_ok(*args: str) -> bool:
    """Return True iff the command exits 0 (used for diff --quiet style checks)."""
    return git(*args, check=False, capture=True).returncode == 0


def die(msg: str, code: int = 1) -> "NoReturn":  # type: ignore[name-defined]
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def info(msg: str) -> None:
    print(msg)


# --- state -------------------------------------------------------------------

@dataclass
class State:
    branch: str
    base: str            # resolved base commit sha
    backup_ref: str      # full ref, e.g. refs/heads/curate-backup/feat/2026...
    backup_name: str     # branch name without refs/heads/
    original_head: str   # sha of HEAD before reset

    @staticmethod
    def path() -> Path:
        git_dir = git_out("rev-parse", "--git-dir")
        return Path(git_dir) / "curate_state.json"

    def save(self) -> None:
        self.path().write_text(json.dumps(asdict(self), indent=2))

    @staticmethod
    def load() -> "State":
        p = State.path()
        if not p.exists():
            die("no restructure in progress (run `init` first).")
        return State(**json.loads(p.read_text()))

    @staticmethod
    def exists() -> bool:
        return State.path().exists()

    def clear(self) -> None:
        self.path().unlink(missing_ok=True)


# --- base / branch resolution ------------------------------------------------

def current_branch() -> str:
    name = git_out("rev-parse", "--abbrev-ref", "HEAD")
    if name == "HEAD":
        die("HEAD is detached; check out the feature branch first.")
    return name


def is_protected(branch: str) -> bool:
    return branch in PROTECTED_EXACT or branch.startswith(PROTECTED_PREFIXES)


def resolve_base(explicit: str | None, branch: str) -> str:
    if explicit:
        if not git_ok("rev-parse", "--verify", "--quiet", explicit + "^{commit}"):
            die(f"--base {explicit!r} is not a valid commit/ref.")
        return git_out("rev-parse", explicit + "^{commit}")

    # Prefer the branch's upstream, if it has one.
    up = git("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}",
             check=False)
    if up.returncode == 0 and up.stdout.strip():
        return git_out("merge-base", "HEAD", up.stdout.strip())

    # Fall back to a merge-base with a conventional default branch.
    for cand in BASE_CANDIDATES:
        if cand == branch:
            continue
        if git_ok("rev-parse", "--verify", "--quiet", cand + "^{commit}"):
            return git_out("merge-base", "HEAD", cand)

    die("could not determine a base. Pass it explicitly with --base <ref>.")


# --- commands ----------------------------------------------------------------

def cmd_init(args: argparse.Namespace) -> None:
    if not git_ok("rev-parse", "--git-dir"):
        die("not inside a git repository.")
    if State.exists():
        die("a restructure is already in progress. Finish it, or run "
            "`abort` to discard it, before starting another.")

    branch = current_branch()
    if is_protected(branch) and not args.allow_protected:
        die(f"refusing to rewrite protected branch {branch!r}. "
            f"Re-run with --allow-protected if you really mean to.")

    if git_out("status", "--porcelain"):
        die("working tree is not clean. Commit or stash your changes first — "
            "this skill rewrites history and needs a clean starting point.")

    original_head = git_out("rev-parse", "HEAD")
    base = resolve_base(args.base, branch)
    if base == original_head:
        die("base equals HEAD — there are no commits to restructure.")
    if not git_ok("merge-base", "--is-ancestor", base, "HEAD"):
        die(f"base {base[:12]} is not an ancestor of HEAD; pick a base on this "
            f"branch's history.")

    ts = time.strftime("%Y%m%d-%H%M%S")
    backup_name = f"curate-backup/{branch}/{ts}"
    git("branch", backup_name, "HEAD")
    backup_ref = f"refs/heads/{backup_name}"

    commits = git_out("log", "--oneline", f"{base}..HEAD")
    n_commits = len(commits.splitlines())

    # Move HEAD to base, keep index+worktree → net diff is now all unstaged.
    git("reset", "--mixed", base, capture=False)

    # Make new (untracked) files visible in `git diff` so they can be split.
    others = git("ls-files", "--others", "--exclude-standard", "-z").stdout
    new_files = [f for f in others.split("\0") if f]
    for f in new_files:
        git("add", "-N", "--", f)

    State(branch=branch, base=base, backup_ref=backup_ref,
          backup_name=backup_name, original_head=original_head).save()

    info("=" * 70)
    info(f"Restructuring branch : {branch}")
    info(f"Base                 : {base[:12]}  ({git_out('log', '-1', '--format=%s', base)})")
    info(f"Commits being replaced: {n_commits}")
    info(f"Backup branch        : {backup_name}  (original tip preserved here)")
    if new_files:
        info(f"New files (intent-add): {', '.join(new_files)}")
    info("=" * 70)
    info("\nThe full net diff to repartition follows. Plan your commits, then")
    info("stage them one at a time with `commit`.\n")
    diff = git_out("diff")
    info(diff if diff else "(no textual diff — only new/binary files; use --files)")


def cmd_status(args: argparse.Namespace) -> None:
    State.load()
    info("# Remaining unstaged net diff (what still needs a commit):\n")
    diff = git_out("diff")
    info(diff if diff else "(none — all textual changes are committed)")
    porcelain = git_out("status", "--porcelain")
    if porcelain:
        info("\n# git status (note new/untracked files needing --files):\n")
        info(porcelain)


def cmd_commit(args: argparse.Namespace) -> None:
    State.load()
    if not args.patch and not args.files:
        die("commit needs either --patch <file> or --files \"a b c\".")
    if args.patch and args.files:
        die("use either --patch or --files, not both, per commit.")

    if args.patch:
        if not Path(args.patch).exists():
            die(f"patch file not found: {args.patch}")
        applied = git("apply", "--cached", "--recount", "--", args.patch, check=False)
        if applied.returncode != 0:
            # Retry with 3-way, which can recover from drifted context using
            # the blob shas recorded in the patch's `index` lines.
            applied = git("apply", "--cached", "--recount", "--3way", "--",
                          args.patch, check=False)
        if applied.returncode != 0:
            die("patch did not apply.\n"
                f"{applied.stderr}\n"
                "Tip: re-extract the hunks from the *current* diff "
                "(`status`) — line numbers shift after each commit.")
    else:
        files = args.files.split()
        # -A stages modifications, additions, and deletions for these paths.
        git("add", "-A", "--", *files)

    staged = git_out("diff", "--cached", "--stat")
    if not staged:
        die("nothing was staged for this commit — check your patch/files.")

    git("commit", "--no-verify", "-m", args.message, capture=False)
    info("\n# Committed. Remaining net diff:\n")
    remaining = git_out("diff")
    info(remaining if remaining else "(none — ready to `verify`)")


def cmd_verify(args: argparse.Namespace) -> None:
    st = State.load()

    # THE final check: the restructured branch must have NO diff against the
    # backup branch. This single comparison is comprehensive — anything not
    # committed (a leftover hunk, a forgotten new file) is absent from HEAD but
    # present in the backup, so it shows up here. The working-tree check below
    # is only a secondary guard against stray manual edits.
    tree_matches = git_ok("diff", "--quiet", st.backup_ref, "HEAD")
    porcelain = git_out("status", "--porcelain")

    if tree_matches and not porcelain:
        info("verify PASSED ✓")
        info(f"  • `git diff {st.backup_name} HEAD` is empty — the restructured")
        info(f"    branch is byte-for-byte identical to the original")
        info(f"  • working tree is clean")
        info("\nNew history:\n")
        info(git_out("log", "--oneline", f"{st.base}..HEAD"))
        info("\nNothing has been pushed. To publish (after review):")
        info("    git push --force-with-lease")
        info(f"\nBackup branch {st.backup_name} is kept. Remove it once satisfied:")
        info(f"    python3 {Path(__file__).name} cleanup")
        return

    info(f"verify FAILED — there is a diff against backup branch "
         f"{st.backup_name}:\n")
    if not tree_matches:
        info(f"• `git diff {st.backup_name} HEAD` is NOT empty:")
        info(_indent(git_out("diff", "--stat", st.backup_ref, "HEAD")))
        if porcelain:
            info("  Cause: changes are still uncommitted (see below) — finish "
                 "committing them, then re-verify.")
        else:
            info(f"  A hunk applied wrong. Safest fix: `abort` (restores "
                 f"{st.backup_name}) and start over.")
    if porcelain:
        info(f"\n• working tree not clean (uncommitted hunks / new files):")
        info(_indent(porcelain))
        info("  Fix: commit the rest (`commit ... --patch` or `--files`), "
             "then re-verify.")
    info("")
    sys.exit(1)


def cmd_bisect_check(args: argparse.Namespace) -> None:
    st = State.load()
    if git_out("status", "--porcelain"):
        die("working tree not clean; run `verify` first.")
    revs = git_out("rev-list", "--reverse", f"{st.base}..HEAD").splitlines()
    if not revs:
        die("no commits to check.")
    failures: list[str] = []
    try:
        for rev in revs:
            # Detached checkout of each commit to run the test in isolation.
            git("checkout", "--quiet", "--detach", rev, capture=False)
            subj = git_out("log", "-1", "--format=%h %s", rev)
            res = subprocess.run(args.test, shell=True)
            mark = "ok " if res.returncode == 0 else "FAIL"
            info(f"  [{mark}] {subj}")
            if res.returncode != 0:
                failures.append(subj)
    finally:
        # Reattach to the branch (not the bare SHA) so we don't strand HEAD.
        git("checkout", "--quiet", st.branch, capture=False)
    if failures:
        info(f"\n{len(failures)} commit(s) failed `{args.test}`:")
        for f in failures:
            info("  • " + f)
        info("These commits are not independently buildable/testable. Decide "
             "with the user whether to regroup so each commit stands alone.")
        sys.exit(1)
    info(f"\nAll {len(revs)} commits pass `{args.test}` — history is bisectable.")


def cmd_abort(args: argparse.Namespace) -> None:
    st = State.load()
    # Reattach to the branch first; otherwise (e.g. after a `bisect-check`)
    # HEAD may be detached and `reset` would move a stray HEAD instead of the
    # branch pointer, leaving the branch on the restructured commits.
    if git_out("rev-parse", "--abbrev-ref", "HEAD") != st.branch:
        git("checkout", "--quiet", "--force", st.branch, capture=False)
    git("reset", "--hard", st.backup_ref, capture=False)
    st.clear()
    info(f"Restored branch {st.branch} to {st.backup_name} ({st.original_head[:12]}). "
         f"Backup branch kept.")


def cmd_cleanup(args: argparse.Namespace) -> None:
    st = State.load()
    git("branch", "-D", st.backup_name, check=False, capture=False)
    st.clear()
    info(f"Deleted backup branch {st.backup_name} and cleared state.")


def _indent(text: str, prefix: str = "    ") -> str:
    return "\n".join(prefix + line for line in text.splitlines())


# --- CLI ---------------------------------------------------------------------

def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init", help="safety checks, backup, reset, print diff")
    s.add_argument("--base", help="base ref to restructure against")
    s.add_argument("--allow-protected", action="store_true",
                   help="permit rewriting main/master/develop/release/hotfix")
    s.set_defaults(func=cmd_init)

    s = sub.add_parser("status", help="show remaining net diff")
    s.set_defaults(func=cmd_status)

    s = sub.add_parser("commit", help="stage a group and commit it")
    s.add_argument("--message", "-m", required=True)
    s.add_argument("--patch", help="patch file with this commit's hunks")
    s.add_argument("--files", help="space-separated whole files to stage")
    s.set_defaults(func=cmd_commit)

    s = sub.add_parser("verify", help="assert no leftovers and tree equality")
    s.set_defaults(func=cmd_verify)

    s = sub.add_parser("bisect-check", help="run a command at each new commit")
    s.add_argument("--test", required=True, help="build/test command")
    s.set_defaults(func=cmd_bisect_check)

    s = sub.add_parser("abort", help="restore the original branch tip")
    s.set_defaults(func=cmd_abort)

    s = sub.add_parser("cleanup", help="delete the backup tag and clear state")
    s.set_defaults(func=cmd_cleanup)

    args = p.parse_args()
    try:
        args.func(args)
    except subprocess.CalledProcessError as e:
        die(f"git command failed: {' '.join(e.cmd)}\n{e.stderr or ''}")


if __name__ == "__main__":
    main()
