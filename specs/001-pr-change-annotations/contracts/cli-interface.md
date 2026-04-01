# CLI Interface Contract

## Commands

### annotate

Analyze a PR and post intent annotations as review comments.

```
gcr annotate --repo <owner/repo> --pr <number> [options]
```

#### Input Options

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--repo` | `string` | Yes | — | GitHub repository in `owner/repo` format |
| `--pr` | `number` | Yes | — | Pull request number |
| `--token` | `string` | No | `$GITHUB_TOKEN` env | GitHub personal access token with `repo` scope |
| `--dry-run` | `boolean` | No | `false` | Print annotations without posting to GitHub |
| `--format` | `json\|text` | No | `text` | Output format for `--dry-run` mode |
| `--max-comments` | `number` | No | `50` | Maximum annotations per review submission |
| `--model` | `string` | No | `claude-haiku-3-5` | AI model to use for annotation generation |

#### Output (stdout)

**Progress** (during analysis):
```
Fetching PR #123 from owner/repo...
Parsing diff: 12 files, 847 changed lines
Analyzing file src/auth/login.ts... (1/12)
Analyzing file src/auth/session.ts... (2/12)
...
Posting review with 47 annotations...
Done. 47 annotations posted to PR #123.
```

**Summary line** (always printed on success):
```
{n} annotations generated for {m} files
```

**Dry-run text output**:
```
=== src/auth/login.ts (lines 45–52) ===
Intent: Adds null check before accessing user.token to prevent runtime
        errors when the OAuth provider returns an incomplete response.
Source: commit message ("fix: handle null token from OAuth provider")
Confidence: High

---
```

**Dry-run JSON output** (`--format json`): see `annotation-format.md` for schema.

#### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success — all annotations generated and posted (or dry-run complete) |
| `1` | General error (diff fetch failed, AI error, unexpected exception) |
| `2` | Authentication failure (invalid or missing token) |
| `3` | PR not found (404 from GitHub API) |
| `4` | Rate limit exceeded (GitHub API 429 / secondary rate limit) |

#### Error Output (stderr)

All error messages go to stderr with context:
```
Error [2]: GitHub authentication failed. Check --token or GITHUB_TOKEN.
Error [3]: PR #999 not found in owner/repo.
Error [4]: GitHub rate limit exceeded. Retry after 2026-03-31T14:22:00Z.
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token (fallback if `--token` not provided) |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI annotation generation |
| `GCR_MODEL` | Default AI model (overridden by `--model`) |
| `GCR_MAX_COMMENTS` | Default max comments (overridden by `--max-comments`) |

---

## GitHub Actions Usage

```yaml
- name: Annotate PR changes
  uses: ./
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    pr-number: ${{ github.event.pull_request.number }}
    max-comments: 50
    dry-run: false
```

Action inputs mirror CLI flags. `repo` is inferred from `GITHUB_REPOSITORY` env var automatically in Actions context.
