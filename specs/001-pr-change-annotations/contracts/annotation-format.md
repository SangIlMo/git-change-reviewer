# Annotation Format Contract

## Review Comment Body Format

### Context-based annotation

Posted when commit message, PR description, or linked issue provides explicit reasoning for the change.

```markdown
> **Intent**: {explanation of why this change was made}
>
> **Source**: {commit message / PR description / issue #N}
> **Confidence**: High
```

Example:
```markdown
> **Intent**: Adds null check before accessing `user.token` to prevent runtime errors
> when the OAuth provider returns an incomplete response.
>
> **Source**: commit message ("fix: handle null token from OAuth provider")
> **Confidence**: High
```

---

### Inferred annotation

Posted when no explicit context is available and the explanation is derived from code analysis alone.

```markdown
> **Intent** [Inferred]: {explanation based on code analysis}
>
> **Confidence**: Medium
>
> _This annotation was inferred from code analysis. The change context did not provide explicit reasoning._
```

Example:
```markdown
> **Intent** [Inferred]: Extracts the retry logic into a separate `withRetry` helper
> to reduce duplication across three call sites in this module.
>
> **Confidence**: Medium
>
> _This annotation was inferred from code analysis. The change context did not provide explicit reasoning._
```

---

### Special case: context conflict

Posted when commit message and actual code change are inconsistent.

```markdown
> **Intent** [Conflict]: The commit message states "{commit message summary}", but
> the code change appears to {code-based analysis}. Code analysis is shown below.
>
> **Code-based intent**: {explanation derived from diff}
> **Confidence**: Low
```

---

## JSON Output Format (dry-run `--format json`)

```json
{
  "annotations": [
    {
      "file": "path/to/file.ts",
      "start_line": 10,
      "end_line": 15,
      "body": "Intent explanation rendered as Markdown...",
      "source_type": "context",
      "confidence": "high",
      "context_refs": ["commit:abc123", "pr:description"]
    },
    {
      "file": "path/to/other.py",
      "start_line": 42,
      "end_line": 42,
      "body": "Intent explanation rendered as Markdown...",
      "source_type": "inferred",
      "confidence": "medium",
      "context_refs": []
    }
  ],
  "summary": {
    "total_blocks": 42,
    "annotated": 40,
    "skipped": 2,
    "skipped_reasons": {
      "binary": 1,
      "generated": 1
    }
  }
}
```

### Field Definitions

| Field | Type | Values | Description |
|-------|------|--------|-------------|
| `file` | `string` | — | File path relative to repo root |
| `start_line` | `number` | — | First line of change block (new file) |
| `end_line` | `number` | — | Last line of change block (new file) |
| `body` | `string` | — | Rendered Markdown body (same as GitHub comment) |
| `source_type` | `string` | `"context"` \| `"inferred"` | Whether explanation is context-grounded or code-inferred |
| `confidence` | `string` | `"high"` \| `"medium"` \| `"low"` | AI-assessed confidence in the explanation |
| `context_refs` | `string[]` | — | References used; format: `"commit:{sha}"`, `"pr:description"`, `"issue:#{n}"` |
| `summary.total_blocks` | `number` | — | Total `ChangeBlock` instances extracted from the PR |
| `summary.annotated` | `number` | — | Blocks that received annotations |
| `summary.skipped` | `number` | — | Blocks skipped (no annotation generated) |
| `summary.skipped_reasons` | `object` | — | Keyed by reason: `binary`, `generated`, `error` |

---

## Confidence Level Definitions

| Level | Meaning |
|-------|---------|
| `high` | Strong match between context and change; explanation directly references available context |
| `medium` | Reasonable inference from code structure; partial context match |
| `low` | Code-only analysis with no supporting context; or context conflict detected |
