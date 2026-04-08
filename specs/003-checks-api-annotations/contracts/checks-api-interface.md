# Checks API Interface Contract

## Script Interface: post-checks.sh

### Input

**Arguments**: `REPO` `PR_NUMBER` `HEAD_SHA`
**Stdin**: JSON array of annotation objects

```json
[
  {
    "path": "src/auth/login.ts",
    "start_line": 42,
    "end_line": 58,
    "title": "Intent (Context)",
    "message": "> **Intent**: Adds JWT token generation...\n> **Source**: PR description\n> **Confidence**: High"
  }
]
```

### Annotation Object Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| path | string | Yes | File path relative to repo root |
| start_line | integer | Yes | Starting line number |
| end_line | integer | Yes | Ending line number |
| title | string | Yes | Short label: "Intent (Context)", "Intent (Inferred)", "Intent (Conflict)" |
| message | string | Yes | Full annotation body (markdown) |

### Output

**stdout**: Success/error messages
**Exit codes**:

| Code | Meaning |
|------|---------|
| 0 | All annotations posted successfully |
| 1 | General error |
| 2 | GitHub CLI authentication failure |
| 3 | Permission denied — Checks API not available for this token |
| 4 | Rate limit exceeded after retries |

### API Flow

```
1. POST /repos/{repo}/check-runs
   Body: { name, head_sha, status: "in_progress", output: { title, summary, annotations[0..49] } }
   → Response: { id: check_run_id }

2. For each remaining batch (50 annotations each):
   PATCH /repos/{repo}/check-runs/{check_run_id}
   Body: { output: { title, summary, annotations[batch] } }

3. Final PATCH:
   Body: { status: "completed", conclusion: "neutral", output: { title, summary } }
```

## CLI Flag Extension

### --output-mode

| Value | Behavior |
|-------|----------|
| checks (default) | Post via Checks API; on 403/permission error, fall back to review comments with warning |
| review | Post via PR review comments (existing behavior) |

## Skill Argument Extension

### --output-mode in /annotate-pr

Same values as CLI flag. Parsed from skill arguments alongside `--dry-run` and PR number.

Example: `/annotate-pr 42 --dry-run --output-mode=checks`
