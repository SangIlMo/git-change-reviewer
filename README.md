# PR Change Annotation Plugin for Claude Code

Automatically generates AI-powered intent annotations for code changes in GitHub pull requests. Each change block gets an inline review comment explaining *why* the change was made.

## Install

```
/plugin marketplace add SangIlMo/git-change-reviewer
/plugin install annotate-pr-plugin
```

## Usage

### Annotate a PR
```
/annotate-pr 123
```

### Preview without posting
```
/annotate-pr 123 --dry-run
```

### Auto-detect current branch PR
```
/annotate-pr
```

## How It Works

1. **Fetch** — Gets PR diff, commit messages, and description via `gh` CLI
2. **Parse** — Splits diff into semantic change blocks (skips binary/generated files)
3. **Analyze** — Claude examines each block's intent using available context
4. **Post** — Publishes annotations as inline review comments on GitHub PR

## Annotation Types

| Type | Confidence | When |
|------|-----------|------|
| **Context** | High | Commit message or PR description explains the change |
| **Inferred** | Medium | Intent derived from code analysis alone |
| **Conflict** | Low | Commit message contradicts actual code change |

## Prerequisites

- [Claude Code](https://claude.ai/code) with active subscription
- [GitHub CLI](https://cli.github.com) installed and authenticated (`gh auth login`)

## Plugin Structure

```
.claude-plugin/plugin.json    # Plugin manifest
skills/annotate-pr/
├── SKILL.md                  # Skill prompt
└── scripts/
    ├── fetch-context.sh      # PR diff + metadata fetcher
    ├── parse-hunks.sh        # Diff → change blocks parser
    └── post-review.sh        # GitHub Reviews API poster
```

## License

MIT
