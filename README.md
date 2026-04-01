# git-change-reviewer

Automatically generates AI-powered intent annotations for code change blocks in GitHub pull requests. For each logical change block in a PR diff, the tool posts an inline review comment explaining *why* the change was made — grounded in commit messages, PR descriptions, and code analysis.

## Installation

```bash
npm install -g git-change-reviewer
```

## Quick Start

### Basic usage

```bash
gcr annotate --repo owner/repo --pr 123
```

Posts inline annotations to all change blocks in PR #123.

### Dry run (preview without posting)

```bash
gcr annotate --repo owner/repo --pr 123 --dry-run
```

### Dry run with JSON output

```bash
gcr annotate --repo owner/repo --pr 123 --dry-run --format json
```

## CLI Reference

```
gcr annotate --repo <owner/repo> --pr <number> [options]
```

| Flag | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `--repo` | `string` | Yes | — | GitHub repository in `owner/repo` format |
| `--pr` | `number` | Yes | — | Pull request number |
| `--token` | `string` | No | `$GITHUB_TOKEN` | GitHub personal access token with `repo` scope |
| `--dry-run` | `boolean` | No | `false` | Print annotations without posting to GitHub |
| `--format` | `json\|text` | No | `text` | Output format for `--dry-run` mode |
| `--max-comments` | `number` | No | `50` | Maximum annotations per review submission |
| `--concurrency` | `number` | No | `5` | Max concurrent AI annotation requests |
| `--model` | `string` | No | `claude-haiku-3-5` | AI model to use for annotation generation |

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error (diff fetch failed, AI error, unexpected exception) |
| `2` | Authentication failure (invalid or missing token) |
| `3` | PR not found (404 from GitHub API) |
| `4` | Rate limit exceeded (GitHub API 429 / secondary rate limit) |

## GitHub Actions Setup

### Using the action directly

Add the following to your workflow file:

```yaml
name: Annotate PR Changes
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  annotate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Annotate PR changes
        uses: ./
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          pr-number: ${{ github.event.pull_request.number }}
          max-comments: 50
```

### Action inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | Yes | — | GitHub token for posting review comments |
| `pr-number` | Yes | — | PR number to annotate |
| `anthropic-api-key` | Yes | — | Anthropic API key for AI annotations |
| `max-comments` | No | `50` | Maximum comments per review |
| `concurrency` | No | `5` | Max concurrent AI annotation requests |

## How It Works

The tool runs through a five-stage pipeline:

1. **Diff** — Fetches the PR unified diff from the GitHub API along with commit messages and PR description.
2. **Segment** — Parses each file's diff into hunks, then splits hunks into semantically coherent `ChangeBlock` units separated by three or more context lines. Binary files and auto-generated files (lock files, minified assets, source maps) are skipped automatically.
3. **Context** — Extracts available context: commit messages, PR description, and linked issue references.
4. **Annotate** — For each `ChangeBlock`, calls the configured AI model with the diff snippet and context to produce a "why this change was made" explanation. Runs with configurable concurrency. Detects mismatches between commit messages and actual code changes and flags them as `[Conflict]`.
5. **Publish** — Submits all annotations as a single batched PR review via the GitHub Reviews API. Annotations appear inline in the "Files changed" tab.

### Annotation types

- **Context-grounded** (`High` confidence) — explanation directly references available commit messages or PR description.
- **Inferred** (`Medium` confidence) — derived from code analysis alone; no explicit context available.
- **Conflict** (`Low` confidence) — commit message and actual code change appear inconsistent; both are described.

## Configuration

### Environment variables

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub personal access token with `repo` scope (fallback if `--token` not provided) |
| `ANTHROPIC_API_KEY` | Anthropic API key for AI annotation generation |
| `GCR_MODEL` | Default AI model (overridden by `--model`) |
| `GCR_MAX_COMMENTS` | Default max comments (overridden by `--max-comments`) |

```bash
export GITHUB_TOKEN=ghp_...
export ANTHROPIC_API_KEY=sk-ant-...
```

## Contributing

1. Clone the repository and install dependencies: `npm install`
2. Run tests: `npm test`
3. Build: `npm run build`
4. Lint: `npm run lint`

All changes must include tests. The project uses Vitest for unit and integration testing.

## License

ISC
