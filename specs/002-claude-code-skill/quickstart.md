# Quickstart: PR Change Annotation Plugin

## Prerequisites
- Claude Code with active subscription
- gh CLI installed and authenticated (`gh auth status`)

## Install
```
/plugin marketplace add SangIlMo/git-change-reviewer
/plugin install annotate-pr-plugin
```

## Usage

### Annotate a specific PR
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

## What happens
1. Fetches PR diff and metadata via gh CLI
2. Splits diff into semantic change blocks
3. Claude analyzes each block's intent using commit messages and PR context
4. Posts annotations as inline review comments on GitHub PR
