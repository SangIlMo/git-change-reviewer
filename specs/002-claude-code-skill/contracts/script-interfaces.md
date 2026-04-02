# Contract: Helper Script Interfaces

**Feature**: 002-claude-code-skill
**Location**: `annotate-pr-plugin/skills/annotate-pr/scripts/`

---

## Overview

Three helper scripts support the SKILL.md prompt. Each script handles a distinct phase: data collection, diff parsing, and review posting. All scripts communicate via stdin/stdout using JSON. All scripts are invoked with `bash scripts/<name>.sh`.

---

## `fetch-context.sh`

**Purpose**: Fetches PR diff and metadata from GitHub using `gh` CLI.

### Invocation

```bash
bash scripts/fetch-context.sh <repo> <pr_number>
```

### Arguments

| Position | Name | Type | Description |
|----------|------|------|-------------|
| `$1` | `repo` | string | Repository in `owner/repo` format |
| `$2` | `pr_number` | integer | Pull request number |

### Output (stdout)

JSON object:

```json
{
  "repo": "owner/repo",
  "pr_number": 123,
  "title": "feat: add user authentication",
  "description": "Implements JWT-based auth...",
  "commit_messages": [
    "feat: add login endpoint",
    "feat: add JWT token generation"
  ],
  "base_branch": "main",
  "head_branch": "feat/user-auth",
  "head_sha": "abc123def456",
  "diff": "diff --git a/src/auth/login.ts ..."
}
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — JSON written to stdout |
| `1` | General error (logged to stderr) |
| `2` | Authentication failure (`gh auth status` failed) |
| `3` | PR not found (HTTP 404 from GitHub) |

### Dependencies

- `gh pr diff`
- `gh pr view --json title,body,headRefName,baseRefName,commits,headRefOid`

---

## `parse-hunks.sh`

**Purpose**: Parses unified diff text into structured change blocks. Filters out binary and generated files.

### Invocation

```bash
echo "$diff_text" | bash scripts/parse-hunks.sh
# or
bash scripts/parse-hunks.sh < diff.txt
```

### Input (stdin)

Unified diff text (as produced by `gh pr diff` or `git diff`).

### Output (stdout)

JSON array of change blocks:

```json
[
  {
    "file": "src/auth/login.ts",
    "start_line": 42,
    "end_line": 58,
    "content": "+  const token = jwt.sign(payload, secret, { expiresIn: '24h' });\n+  return token;",
    "type": "addition"
  },
  {
    "file": "src/auth/middleware.ts",
    "start_line": 12,
    "end_line": 12,
    "content": "+  if (!req.headers.authorization) return res.status(401).send();",
    "type": "addition"
  }
]
```

### Block Type Values

| Value | Meaning |
|-------|---------|
| `addition` | Only `+` lines (new code added) |
| `deletion` | Only `-` lines (code removed) |
| `modification` | Mix of `+` and `-` lines (code changed) |

### Skip Conditions

Files matching any of the following patterns are silently excluded from output:

- `*.lock` (all lock files)
- `package-lock.json`
- `yarn.lock`
- `Cargo.lock`
- `Gemfile.lock`
- `*.min.js`, `*.min.css`
- `dist/*`, `build/*`, `vendor/*`
- `*.pb.go`, `*.generated.*`
- Any file where the diff contains `Binary files ... differ`

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — JSON array written to stdout (may be empty `[]`) |
| `1` | Invalid or empty input |

---

## `post-review.sh`

**Purpose**: Posts an array of review comments to GitHub as a PR review. Handles batching when the comment count exceeds 100.

### Invocation

```bash
echo "$review_comments_json" | bash scripts/post-review.sh <repo> <pr_number> <commit_sha>
# or
bash scripts/post-review.sh <repo> <pr_number> <commit_sha> < comments.json
```

### Arguments

| Position | Name | Type | Description |
|----------|------|------|-------------|
| `$1` | `repo` | string | Repository in `owner/repo` format |
| `$2` | `pr_number` | integer | Pull request number |
| `$3` | `commit_sha` | string | HEAD commit SHA of the PR branch |

### Input (stdin)

JSON array of review comment objects matching the GitHub PR Reviews API schema:

```json
[
  {
    "path": "src/auth/login.ts",
    "line": 58,
    "start_line": 42,
    "side": "RIGHT",
    "start_side": "RIGHT",
    "body": "> **Intent**: ...\n> **Source**: PR description\n> **Confidence**: High"
  }
]
```

For single-line comments, omit `start_line` and `start_side`.

### Batching Behavior

- GitHub PR Reviews API accepts a maximum of 100 inline comments per request.
- If the input array has more than 100 items, `post-review.sh` splits them into batches of 100 and posts each as a separate review.
- A 1-second delay is inserted between batches to respect GitHub secondary rate limits.
- Each batch uses `"event": "COMMENT"` and an empty `"body": ""`.

### Rate Limit Handling

- On HTTP 403 with a rate limit message, the script reads `X-RateLimit-Reset` (via `gh api /rate_limit`) and sleeps until the reset time + 5 seconds.
- Maximum 3 retry attempts per batch before aborting with exit code 1.
- Progress is reported to stderr during waits: `Rate limit hit. Waiting Xs...`

### Output (stdout)

Human-readable summary on success:

```
Posted 3 review comment(s) to PR #123 (1 review batch).
Posted 150 review comment(s) to PR #123 (2 review batches).
```

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All comments posted successfully |
| `1` | One or more batches failed after retries |
| `2` | Authentication failure |

### Dependencies

- `gh api --method POST /repos/{owner}/{repo}/pulls/{pr_number}/reviews`
- `gh api /rate_limit` (for rate limit reset time)
- `jq` (for JSON slicing and formatting)
