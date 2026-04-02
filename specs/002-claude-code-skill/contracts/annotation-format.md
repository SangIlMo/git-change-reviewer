# Contract: Annotation Format

**Feature**: 002-claude-code-skill

---

## Overview

Each intent annotation is posted as a GitHub PR review comment body using Markdown blockquote formatting. The format varies by `source_type` to clearly communicate how the annotation was derived and how much to trust it.

---

## Format Variants

### Context-based Annotation

Used when the intent is directly traceable to commit messages or PR description.

```markdown
> **Intent**: Replaces the manual token expiry check with JWT's built-in `expiresIn` option, as specified in the PR description ("use library-native session management").
> **Source**: PR description
> **Confidence**: High
```

**Template**:
```
> **Intent**: {explanation referencing specific commit/PR text}
> **Source**: {Commit message | PR description | PR title}
> **Confidence**: High
```

### Inferred Annotation

Used when the intent is derived by Claude from code patterns, naming, or surrounding context — not directly stated in commit or PR text.

```markdown
> **Intent** [Inferred]: Extracts the error handling into a dedicated function to reduce duplication across the three call sites above.
> **Confidence**: Medium
```

**Template**:
```
> **Intent** [Inferred]: {AI-derived explanation}
> **Confidence**: {Medium | Low}
```

### Conflict Annotation

Used when the commit message or PR description contradicts the actual diff content.

```markdown
> **Intent** [Conflict]: Commit message says "remove feature flag", but this change adds a new flag `ENABLE_BETA_UI`. The stated and actual intents appear to diverge.
> **Confidence**: Low
```

**Template**:
```
> **Intent** [Conflict]: {description of the discrepancy between stated and actual change}
> **Confidence**: Low
```

---

## Confidence Level Definitions

| Level | Meaning | Typical Source |
|-------|---------|----------------|
| `High` | Intent explicitly stated in commit or PR text | Context-based |
| `Medium` | Intent strongly implied by code patterns or naming | Inferred |
| `Low` | Intent unclear or contradicts stated context | Inferred / Conflict |

---

## Source Values

| Value | Meaning |
|-------|---------|
| `PR description` | Pulled from PR body text |
| `Commit message` | Pulled from one or more commit message headlines |
| `PR title` | Pulled from the PR title when body is absent |

---

## Formatting Rules

1. Always use blockquote (`>`) formatting so annotations are visually distinct from other review comments.
2. The `[Inferred]` or `[Conflict]` tag must appear directly after `**Intent**` — no space between tag and text.
3. `**Source**` line is omitted for Inferred and Conflict variants (source is always Claude's analysis).
4. Explanation text must answer "Why was this change made?" — not describe what changed (reviewers can read the diff).
5. Maximum annotation body length: 500 characters. Truncate with `…` if needed.
6. Do not include file paths or line numbers in the body — GitHub renders those from the comment metadata.

---

## Example: Full Review Batch (dry-run output)

```
[DRY RUN] Would post 3 annotations to PR #123:

--- src/auth/login.ts (lines 42-58) ---
> **Intent**: Adds JWT token generation with 24-hour expiry per the session timeout requirement in the PR description.
> **Source**: PR description
> **Confidence**: High

--- src/auth/middleware.ts (line 12) ---
> **Intent** [Inferred]: Guards the route against unauthenticated requests by checking for a valid token before handler execution.
> **Confidence**: Medium

--- src/auth/logout.ts (lines 5-8) ---
> **Intent** [Conflict]: Commit message says "add logout endpoint" but this code appears to clear browser storage, not invalidate the server-side token. The server-side invalidation may be missing.
> **Confidence**: Low
```
