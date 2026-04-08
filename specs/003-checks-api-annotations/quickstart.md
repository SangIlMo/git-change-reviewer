# Quickstart: Checks API Annotation Output Channel

## Prerequisites

- GitHub CLI (`gh`) installed and authenticated
- For Checks mode in CI: A GitHub App with Checks write permission, and its installation token

## Usage

### Default (Checks mode with auto-fallback)

```bash
# In Claude Code — tries checks first, falls back to review comments
/annotate-pr 42

# Explicit checks mode
/annotate-pr 42 --output-mode=checks
```

### Review mode (existing behavior)

```bash
/annotate-pr 42 --output-mode=review
```

### Dry-run with output mode

```bash
/annotate-pr 42 --dry-run --output-mode=checks
```

## CI (GitHub Actions)

To use Checks mode in CI, you need a GitHub App token:

```yaml
jobs:
  annotate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/create-github-app-token@v1
        id: app-token
        with:
          app-id: ${{ vars.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}
      
      - run: gcr annotate --repo ${{ github.repository }} --pr ${{ github.event.pull_request.number }} --token ${{ steps.app-token.outputs.token }} --output-mode=checks
```

## Fallback Behavior

When `--output-mode=checks` is used but the token lacks Checks API permissions:

1. Tool attempts to create a check run
2. Receives 403 / permission denied
3. Automatically falls back to PR review comments
4. Displays warning: "Checks API not available for this token. Falling back to review comments."

## When to Use Which Mode

| Environment | Recommended Mode | Why |
|-------------|-----------------|-----|
| CI with GitHub App token | `checks` (default) | Clean Conversation tab |
| CI with standard GITHUB_TOKEN | `review` (auto-fallback) | Standard token can't write checks |
| Local (Claude Code) | `review` (auto-fallback) | `gh` CLI token can't write checks |
