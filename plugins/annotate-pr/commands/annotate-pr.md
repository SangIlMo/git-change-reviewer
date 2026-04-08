---
name: annotate-pr
description: Analyzes PR changes and posts intent annotations as inline review comments
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash(gh *), Bash(bash *)
argument-hint: "[PR-number] [--dry-run] [--output-mode=checks|review]"
---

You are executing the `annotate-pr` skill. Follow these steps precisely and in order. Use only the allowed tools: `Bash(gh *)` and `Bash(bash *)`.

---

## Arguments

Parse the arguments the user provided after `/annotate-pr`:

- If a number is present: use it as the PR number.
- If `--dry-run` is present anywhere: enable dry-run mode (preview only, do not post to GitHub).
- If `--output-mode=checks` or `--output-mode=review` is present: use the specified output mode. If no `--output-mode` is specified, default to `checks`.
- If `--output-mode` is present with an invalid value (anything other than `checks` or `review`): tell the user "Invalid output mode. Valid values: checks, review" and stop.
- If no PR number is provided: auto-detect by running:

```bash
gh pr view --json number -q .number
```

If that command returns nothing or fails, inform the user: "No open PR found for the current branch. Please push your branch and open a PR first, or provide a PR number explicitly." Then stop.

Determine the repository from the current git remote by running:

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
```

If this fails, inform the user: "Could not determine repository. Make sure you are inside a git repository with a GitHub remote." Then stop.

You now have:
- `REPO` — the repository in `owner/repo` format
- `PR_NUMBER` — the pull request number
- `DRY_RUN` — true or false
- `OUTPUT_MODE` — `checks` or `review` (default: `checks`)

---

## Pre-flight Checks

Before proceeding, verify the environment:

1. Check that `gh` is available:

```bash
gh --version
```

If this fails, tell the user: "GitHub CLI (gh) is required. Install it from https://cli.github.com and run `gh auth login`." Then stop.

2. Check that `gh` is authenticated:

```bash
gh auth status
```

If this fails with an authentication error, tell the user: "Not authenticated with GitHub CLI. Run `gh auth login` to authenticate." Then stop.

---

## Step 1: Fetch PR Context

Run the fetch-context script with the repository and PR number you determined above. Replace `REPO` and `PR_NUMBER` with the actual values:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-context.sh" "REPO" "PR_NUMBER"
```

For example, if the repo is `acme/my-service` and the PR number is `42`:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/fetch-context.sh" "acme/my-service" "42"
```

Capture the JSON output. This JSON contains:
- `diff` — the full unified diff text
- `title` — the PR title
- `description` — the PR body
- `commit_messages` — array of commit message strings
- `head_sha` — the HEAD commit SHA of the PR branch
- `repo` — the repository
- `pr_number` — the PR number

**Exit code handling:**
- Exit code `0`: proceed normally.
- Exit code `2`: tell the user "GitHub CLI authentication failed. Run `gh auth login`." Then stop.
- Exit code `3`: tell the user "PR #PR_NUMBER not found in REPO. Verify the PR number and that you have access to the repository." Then stop.
- Any other non-zero exit: show the stderr output and tell the user "Failed to fetch PR context. Check your gh auth status and network connectivity." Then stop.

Store the fetched values:
- `DIFF` — the value of `.diff`
- `PR_TITLE` — the value of `.title`
- `PR_DESCRIPTION` — the value of `.description`
- `COMMIT_MESSAGES` — the value of `.commit_messages` (array)
- `HEAD_SHA` — the value of `.head_sha`

---

## Step 2: Parse Change Blocks

Pipe the diff content through the parse-hunks script. Use the actual diff content captured in Step 1:

```bash
echo "$DIFF" | bash "${CLAUDE_PLUGIN_ROOT}/scripts/parse-hunks.sh"
```

This returns a JSON array of change blocks. Each block has:
- `file` — the file path
- `start_line` — first line of the block in the new file
- `end_line` — last line of the block in the new file
- `content` — the diff content for this block (lines starting with `+` and `-`)
- `type` — one of `addition`, `deletion`, or `modification`

**Exit code handling:**
- Exit code `0`: proceed (the array may be empty `[]` if all files were skipped).
- Exit code `1`: tell the user "Failed to parse the diff. The PR diff may be empty or malformed." Then stop.

If the array is empty, tell the user: "No annotatable changes found. All modified files were skipped (binary files, lock files, or generated files)." Then stop.

Report progress to the user: "Found N change blocks across M files." (Count blocks and unique file values.)

---

## Step 3: Analyze Change Blocks

For EACH change block in the array, determine the intent of the change and generate an annotation. Work through them one by one.

### Progress Reporting

For PRs with more than 10 change blocks, report progress as you analyze each block:

```
Analyzing block N/TOTAL: path/to/file.ts (lines X-Y)...
```

Replace `N` with the current block index (1-based), `TOTAL` with the total number of blocks, and `path/to/file.ts (lines X-Y)` with the block's `file` and line range. For single-line blocks, use `(line X)` instead.

### How to Determine Intent

For each block, you have access to:
- The block's `content` (the actual code changes)
- The block's `file` path
- `PR_TITLE`, `PR_DESCRIPTION`, and `COMMIT_MESSAGES` from Step 1

Apply this decision process in order:

**1. Check for explicit context match (source_type: "context", confidence: "high")**

Read through `PR_DESCRIPTION` and each entry in `COMMIT_MESSAGES`. Ask: does any of this text explicitly explain why THIS specific change was made? Look for references to the same function, file, feature, or behavior.

If yes:
- Set `source_type` to `"context"`
- Set `confidence` to `"high"`
- Set `source_label` to `"PR description"`, `"Commit message"`, or `"PR title"` — whichever matches
- Write an explanation that directly references that source text

**2. Check for conflict (source_type: "conflict", confidence: "low")**

Ask: does the commit message or PR description describe something that *contradicts* what the code actually does? For example, the commit says "remove feature flag" but the code adds a new flag.

If yes:
- Set `source_type` to `"conflict"`
- Set `confidence` to `"low"`
- Write an explanation that describes the discrepancy between what the text says and what the code does

**3. Default to inference (source_type: "inferred", confidence: "medium")**

If neither of the above applies, analyze the code change itself. What does the code do structurally? What problem does it appear to solve based on naming, patterns, and surrounding context?

- Set `source_type` to `"inferred"`
- Set `confidence` to `"medium"`
- Write an explanation derived from code analysis

### Annotation Body Format

Format the body according to the `source_type`:

**Context-based (high confidence):**
```
> **Intent**: [1-3 sentence explanation that references the specific commit message or PR description section]
> **Source**: [PR description | Commit message | PR title]
> **Confidence**: High
```

**Inferred (medium confidence):**
```
> **Intent** [Inferred]: [1-3 sentence explanation derived from code analysis]
> **Confidence**: Medium
>
> _This annotation was inferred from code analysis. The change context did not provide explicit reasoning._
```

**Conflict (low confidence):**
```
> **Intent** [Conflict]: [Explanation of what the code actually does vs what the commit message or PR description states]
> **Confidence**: Low
>
> _The commit message or PR description appears inconsistent with the actual code change._
```

**Formatting rules:**
- The explanation must answer "Why was this change made?" — not describe what changed (reviewers can see the diff).
- Do not include file paths or line numbers in the body text.
- Maximum body length is 500 characters. Truncate with `…` if needed.
- Always use blockquote (`>`) formatting.

### Build the Comments Array

Collect all generated annotations into a JSON array. Each element must have:
- `path` — the `file` value from the change block
- `line` — the `end_line` value from the change block
- `start_line` — the `start_line` value (include only if `start_line` differs from `end_line`)
- `side` — always `"RIGHT"`
- `start_side` — always `"RIGHT"` (include only if `start_line` is included)
- `body` — the formatted annotation text
- `title` — a short label based on source_type: `"Intent (Context)"`, `"Intent (Inferred)"`, or `"Intent (Conflict)"`

Example for a multi-line block:
```json
{
  "path": "src/auth/login.ts",
  "line": 58,
  "start_line": 42,
  "side": "RIGHT",
  "start_side": "RIGHT",
  "body": "> **Intent**: Adds JWT token generation with 24-hour expiry per the session timeout requirement in the PR description.\n> **Source**: PR description\n> **Confidence**: High",
  "title": "Intent (Context)"
}
```

Example for a single-line block:
```json
{
  "path": "src/auth/middleware.ts",
  "line": 12,
  "side": "RIGHT",
  "body": "> **Intent** [Inferred]: Guards the route against unauthenticated requests by checking for a valid token before handler execution.\n> **Confidence**: Medium\n>\n> _This annotation was inferred from code analysis. The change context did not provide explicit reasoning._",
  "title": "Intent (Inferred)"
}
```

Count the annotations by type:
- `COUNT_CONTEXT` — number of context-based (high confidence) annotations
- `COUNT_INFERRED` — number of inferred (medium confidence) annotations
- `COUNT_CONFLICT` — number of conflict (low confidence) annotations
- `COUNT_TOTAL` — total annotations in the array
- `COUNT_FILES` — number of unique files covered

---

## Step 4: Output Results

### If dry-run mode is enabled:

Display each annotation in the terminal in this format:

```
[DRY RUN] [Output Mode: OUTPUT_MODE] Would post COUNT_TOTAL annotations to PR #PR_NUMBER:

--- path/to/file.ts (lines START_LINE-END_LINE) [TYPE] ---
> **Intent**: ...
> **Source**: ...
> **Confidence**: High

--- path/to/other.ts (line LINE) [TYPE] ---
> **Intent** [Inferred]: ...
> **Confidence**: Medium
...
```

Then display the summary:

```
Summary: COUNT_TOTAL annotations generated for COUNT_FILES files
- Context-based: COUNT_CONTEXT (high confidence)
- Inferred: COUNT_INFERRED (medium confidence)
- Conflict: COUNT_CONFLICT (low confidence)
- Output mode: OUTPUT_MODE
```

Then ask the user: "Would you like to post these annotations to PR #PR_NUMBER? (yes/no)"

If the user says yes, proceed to the posting step below. If the user says no or anything other than yes, tell them "Dry-run complete. No annotations were posted." and stop.

### If posting mode (not dry-run, or user approved after dry-run):

#### If OUTPUT_MODE is `checks`:

First, build a checks-compatible JSON array from the comments. Each element must have:
- `path` — file path
- `start_line` — start line number
- `end_line` — end line number (use `line` value from the comments array)
- `title` — the title field from the comments array
- `message` — the `body` field from the comments array

Pipe this JSON array to the post-checks script:

```bash
echo "$CHECKS_JSON" | bash "${CLAUDE_PLUGIN_ROOT}/scripts/post-checks.sh" "REPO" "PR_NUMBER" "HEAD_SHA"
```

**Exit code handling for post-checks.sh:**
- Exit code `0`: report the success output from the script to the user, then show the summary counts.
- Exit code `2`: tell the user "GitHub CLI authentication failed while posting. Run `gh auth login`." Then stop.
- Exit code `3`: **Fallback to review comments.** Display warning: "Checks API not available for this token. Falling back to review comments." Then re-post the annotations using `post-review.sh` (see review mode below). The `post-review.sh` script does not use the `title` field, so you can pass the original comments array as-is.
- Exit code `4`: tell the user "GitHub rate limit was exceeded and all retries were exhausted. No annotations were posted in the affected batch. Wait a few minutes and then retry by running `/annotate-pr PR_NUMBER` again. If the problem persists, try posting in smaller increments or wait until your rate limit resets (check with `gh api /rate_limit`)." Then stop.
- Exit code `1`: show the error output and tell the user "Some or all annotations failed to post. Check the output above for details."

#### If OUTPUT_MODE is `review` (or falling back from checks):

Post the comments using the post-review script. Pipe the JSON array to the script with the actual values for REPO, PR_NUMBER, and HEAD_SHA:

```bash
echo "$COMMENTS_JSON" | bash "${CLAUDE_PLUGIN_ROOT}/scripts/post-review.sh" "REPO" "PR_NUMBER" "HEAD_SHA"
```

For example, if repo is `acme/my-service`, PR is `42`, and SHA is `abc123def456`:

```bash
echo "$COMMENTS_JSON" | bash "${CLAUDE_PLUGIN_ROOT}/scripts/post-review.sh" "acme/my-service" "42" "abc123def456"
```

**Exit code handling for post-review.sh:**
- Exit code `0`: report the success output from the script to the user, then show the summary counts.
- Exit code `2`: tell the user "GitHub CLI authentication failed while posting. Run `gh auth login`." Then stop.
- Exit code `4`: tell the user "GitHub rate limit was exceeded and all retries were exhausted. No annotations were posted in the affected batch. Wait a few minutes and then retry by running `/annotate-pr PR_NUMBER` again. If the problem persists, try posting in smaller increments or wait until your rate limit resets (check with `gh api /rate_limit`)." Then stop.
- Exit code `1`: show the error output and tell the user "Some or all annotations failed to post. Check the output above for details."

On success, show the final summary:

```
Annotations posted to PR #PR_NUMBER in REPO (via OUTPUT_MODE).
- Context-based: COUNT_CONTEXT (high confidence)
- Inferred: COUNT_INFERRED (medium confidence)
- Conflict: COUNT_CONFLICT (low confidence)
- Total: COUNT_TOTAL comments across COUNT_FILES files
```

---

## Error Handling

Handle these conditions at any point in the steps above:

| Condition | Action |
|-----------|--------|
| `gh` not installed | Tell user: "GitHub CLI (gh) is required. Install it from https://cli.github.com" and stop. |
| `gh` not authenticated | Tell user: "Not authenticated. Run `gh auth login` to authenticate with GitHub." and stop. |
| PR not found | Tell user: "PR #PR_NUMBER was not found in REPO. Verify the PR number and your repository access." and stop. |
| No open PR for current branch | Tell user: "No open PR found for the current branch. Push your branch and open a PR first, or specify a PR number." and stop. |
| Rate limited during posting (retries in progress) | The post-review script retries automatically. Report any wait messages shown on stderr to the user. |
| Rate limit exhausted (exit code `4`) | Tell user: "GitHub rate limit was exceeded after all retries. Wait a few minutes and retry with `/annotate-pr PR_NUMBER`. Check your reset time with `gh api /rate_limit`." and stop. |
| Checks API permission denied (exit code `3`) | Display warning: "Checks API not available for this token. Falling back to review comments." Then re-post annotations via `post-review.sh`. |
| All change blocks skipped | Tell user: "No annotatable changes found. All files in this PR were skipped (binary, lock, or generated files)." and stop. |
| Invalid output mode | Tell user: "Invalid output mode. Valid values: checks, review" and stop. |
| Script not found | Tell user: "Helper script not found. Make sure the plugin is installed correctly." and stop. |
