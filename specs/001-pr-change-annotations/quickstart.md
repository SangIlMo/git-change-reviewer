# Quickstart: PR Change Annotations

## Prerequisites

- Node.js 20+
- GitHub personal access token with `repo` scope
- Anthropic API key (set as `ANTHROPIC_API_KEY` env var)

## Install

```bash
npm install -g git-change-reviewer
```

## Usage

### Basic

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

### Limit number of annotations

```bash
gcr annotate --repo owner/repo --pr 123 --max-comments 30
```

### Using a specific AI model

```bash
gcr annotate --repo owner/repo --pr 123 --model claude-sonnet-4-5
```

### In GitHub Actions

```yaml
name: Annotate PR changes

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
```

## Environment Variables

```bash
export GITHUB_TOKEN=ghp_...
export ANTHROPIC_API_KEY=sk-ant-...
```

## What it does

1. Fetches the PR diff from GitHub (file list + unified diff patches)
2. Filters out binary files and auto-generated files (lock files, etc.)
3. Parses each file's diff into hunks, then segments hunks into semantically coherent `ChangeBlock` units
4. Fetches available context: commit messages, PR description, linked issues
5. For each `ChangeBlock`, calls the AI model with the diff + context to generate a "why this change was made" explanation
6. Distinguishes context-grounded explanations (High confidence) from code-inferred ones (Medium/Low, marked as [Inferred])
7. Submits all annotations as a single batched PR review via the GitHub Reviews API — visible inline in the "Files changed" tab

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Authentication failure |
| `3` | PR not found |
| `4` | Rate limit exceeded |
