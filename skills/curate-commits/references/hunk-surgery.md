# Hunk surgery: patches for one commit at a time

**Golden rule:** cut hunks from the *current* `git diff` (`restructure.py
status`), never a saved copy — staging shifts line numbers and a stale patch
won't apply. `commit --patch` runs `git apply --cached --recount` (with a
`--3way` retry), so **you needn't get the `@@ -a,b +c,d @@` counts right** — git
recomputes them. That's what makes hand-editing hunks safe.

## Whole-file changes → `--files`

When there's no line-level split to make — a file going entirely into one
commit, new files, deletions, renames, mode changes, binaries — skip patches:

```
restructure.py commit -m "msg" --files "src/a.py src/b.py"   # renames: list both paths
```

`--files` uses `git add -A` (stages modifications, adds, and deletions).
Binary/rename/mode changes have no hunks, so this is the only way to stage them.

## Split a file across commits (hunks stay whole)

Copy from the current diff, verbatim, the file header (`diff --git`, `index`,
`---`, `+++`) plus only the `@@` hunks for *this* commit; drop the rest. Repeat
the header block per file to combine files in one patch. A new file carries its
`new file mode` / `--- /dev/null` header on the first commit that touches it;
later commits see it as an ordinary modification.

## Split a single hunk across commits (the subtle one)

One `@@` block mixes two concerns. For the patch that takes concern A, rewrite
B's lines as context:

- B's **additions** (`+`): delete the line — it isn't in this commit yet.
- B's **deletions** (`-`): keep it, as context (space prefix).
- A's lines and surrounding unchanged lines: keep as-is.

Apply A, commit, then `status`: B now shows relative to the new index — build
B's patch from that fresh diff. If A and B are so interleaved that B can't be
context without A, they mutually depend — put both in one commit.

## When apply fails

Re-cut from the *current* diff (`status`); it's almost always a stale offset. If
a hunk genuinely can't be isolated, fold it into the commit that supplies its
context. Last resort: `abort` and re-plan.
