# Contract: Skill Interface (SKILL.md)

**Feature**: 002-claude-code-skill
**File**: `annotate-pr-plugin/skills/annotate-pr/SKILL.md`

---

## SKILL.md Frontmatter

```yaml
---
name: annotate-pr
description: Analyzes PR changes and posts intent annotations as review comments
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Bash(gh *)
  - Bash(bash *)
argument-hint: "[PR-number] [--dry-run]"
---
```

## Frontmatter Field Definitions

| Field | Value | Description |
|-------|-------|-------------|
| `name` | `annotate-pr` | Slash command name — invoked as `/annotate-pr` |
| `description` | string | Displayed in `/help` and plugin listings |
| `user-invocable` | `true` | User can invoke directly; not auto-triggered |
| `disable-model-invocation` | `true` | Claude Code does not call LLM automatically on install; skill body is the prompt |
| `allowed-tools` | list | Restricts what tools the skill may use |
| `argument-hint` | string | Usage hint shown when user types `/annotate-pr` |

## Invocation Modes

### Mode 1: Specific PR
```
/annotate-pr 123
```
Analyzes and annotates PR #123 in the current repository.

### Mode 2: Dry-run Preview
```
/annotate-pr 123 --dry-run
```
Fetches PR data and generates annotations, but prints them to the terminal instead of posting to GitHub.

### Mode 3: Auto-detect Current Branch PR
```
/annotate-pr
```
Uses `gh pr view` to detect the open PR associated with the current branch. Fails with a clear error if no open PR is found.

## Argument Parsing

The skill body must handle:
- `$1` — optional PR number (integer); if absent, auto-detect
- `--dry-run` — present anywhere in arguments; suppresses GitHub posting

Detection logic (pseudo):
```bash
PR_NUMBER=""
DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    [0-9]*) PR_NUMBER="$arg" ;;
  esac
done

if [ -z "$PR_NUMBER" ]; then
  PR_NUMBER=$(gh pr view --json number --jq '.number' 2>/dev/null)
  [ -z "$PR_NUMBER" ] && { echo "Error: No open PR found for current branch."; exit 1; }
fi
```

## Tool Permissions

The skill uses only:
- `Bash(gh *)` — all `gh` CLI commands (pr diff, pr view, api)
- `Bash(bash *)` — execute helper scripts in `scripts/`

No network access beyond what `gh` CLI provides. No file writes. No LLM API calls (Claude Code itself is the engine).

## Error Cases

| Condition | Behavior |
|-----------|----------|
| `gh` not installed | Print error: "gh CLI is required. Install: https://cli.github.com" and exit 1 |
| `gh` not authenticated | Print error: "Not authenticated. Run: gh auth login" and exit 1 |
| PR number not found | Print error: "PR #N not found in owner/repo" and exit 1 |
| No open PR for branch | Print error: "No open PR found for current branch" and exit 1 |
| Rate limit hit | Print progress message with wait time, retry automatically |
| All changes skipped | Print summary: "No annotatable changes found (all files skipped)" and exit 0 |
