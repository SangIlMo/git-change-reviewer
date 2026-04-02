# Research: Claude Code PR Annotation Skill Plugin

**Feature**: 002-claude-code-skill
**Date**: 2026-04-02

---

## Topic 1: Claude Code Plugin Marketplace Structure

### Plugin Manifest (`plugin.json`)

Claude Code marketplace plugins are distributed as GitHub repositories. The manifest file lives at `.claude-plugin/plugin.json` in the repository root.

**Schema**:
```json
{
  "name": "string",           // Unique plugin identifier (kebab-case)
  "description": "string",   // One-line description shown in marketplace
  "version": "string",       // Semver (e.g., "1.0.0")
  "author": {
    "name": "string",
    "email": "string"         // optional
  },
  "repository": "string",    // GitHub URL
  "license": "string",       // SPDX identifier (e.g., "MIT")
  "keywords": ["string"],    // Searchable tags in marketplace
  "skills": ["string"]       // Relative paths to SKILL.md files
}
```

### SKILL.md Frontmatter

Each skill is defined by a `SKILL.md` file with YAML frontmatter:

```yaml
---
name: skill-name              # Slash command name (invoked as /skill-name)
description: string           # Shown in /help and plugin listings
user-invocable: true          # If true, user can invoke directly via slash command
disable-model-invocation: false # If true, Claude does not call LLM — pure script
allowed-tools:                # Tool permissions (list of allowed tool patterns)
  - Bash(gh *)
  - Bash(bash *)
argument-hint: "[arg1] [--flag]"  # Shown as usage hint
---
```

The body of SKILL.md is the prompt/instructions that Claude Code executes when the skill is invoked.

### Directory Layout

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json
├── skills/
│   └── my-skill/
│       ├── SKILL.md
│       └── scripts/
│           └── helper.sh
├── README.md
└── LICENSE
```

### Installation

```
/plugin marketplace add owner/repo-name
/plugin install plugin-name
```

After installation, skills are available as slash commands in Claude Code sessions.

---

## Topic 2: `gh` CLI Capabilities

### PR Diff Fetching

```bash
# Fetch PR diff (unified diff format)
gh pr diff <PR-number> --repo owner/repo

# Fetch PR metadata
gh pr view <PR-number> --repo owner/repo --json title,body,headRefName,baseRefName,commits

# Fetch commits with messages
gh pr view <PR-number> --repo owner/repo --json commits \
  --jq '.commits[].messageHeadline'

# Auto-detect repo from git remote
gh pr diff <PR-number>

# Auto-detect PR from current branch
gh pr diff
```

### Review Comment Posting

```bash
# Create a pull request review with inline comments
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/OWNER/REPO/pulls/PR_NUMBER/reviews \
  --input - <<'EOF'
{
  "commit_id": "abc123",
  "body": "Review summary",
  "event": "COMMENT",
  "comments": [
    {
      "path": "src/file.ts",
      "start_line": 10,
      "start_side": "RIGHT",
      "line": 15,
      "side": "RIGHT",
      "body": "Intent annotation text"
    }
  ]
}
EOF
```

Single-line comment (omit `start_line`/`start_side`):
```json
{
  "path": "src/file.ts",
  "line": 10,
  "side": "RIGHT",
  "body": "Annotation text"
}
```

### Getting Current Repo and PR Info

```bash
# Get current repo (owner/repo)
gh repo view --json nameWithOwner --jq '.nameWithOwner'

# Get open PR for current branch
gh pr view --json number,headRefName --jq '.number'

# Get head commit SHA of PR
gh pr view <PR-number> --json headRefOid --jq '.headRefOid'
```

### Auth Check

```bash
gh auth status   # exits 0 if authenticated, non-zero otherwise
```

---

## Topic 3: Shell Script Patterns for Diff Parsing and Hunk Segmentation

### Unified Diff Structure

```
diff --git a/path/to/file.ts b/path/to/file.ts
index abc123..def456 100644
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -10,6 +10,8 @@ function foo() {
 context line
-removed line
+added line
 context line
```

Key patterns:
- `diff --git` — file boundary
- `---` / `+++` — old/new file paths
- `@@ -old_start,old_count +new_start,new_count @@` — hunk header
- Lines starting with `-` — deletions (old file line numbers)
- Lines starting with `+` — additions (new file line numbers)
- Lines starting with ` ` (space) — context (unchanged)

### Parsing Approach (awk/Python)

**awk-based hunk extractor**:
```awk
/^diff --git/ { file = $NF; gsub("^b/","",file) }
/^@@/         { match($0, /@@ -[0-9,]+ \+([0-9]+)/, arr); new_start = arr[1]; hunk_lines = "" }
/^[+-]/       { hunk_lines = hunk_lines $0 "\n" }
/^@@ /        { if (hunk_lines) print file "\t" new_start "\t" hunk_lines }
```

**Python-based segmentation** (more robust):
```python
import re

def parse_hunks(diff_text):
    hunks = []
    current_file = None
    current_hunk = None
    new_line = 0

    for line in diff_text.splitlines():
        if line.startswith('diff --git'):
            current_file = line.split(' b/')[-1]
        elif line.startswith('+++ b/'):
            current_file = line[6:]
        elif line.startswith('@@'):
            m = re.match(r'@@ -\d+(?:,\d+)? \+(\d+)', line)
            if m:
                new_line = int(m.group(1))
                current_hunk = {'file': current_file, 'start': new_line, 'lines': []}
                hunks.append(current_hunk)
        elif current_hunk:
            if line.startswith('+'):
                current_hunk['lines'].append({'type': 'add', 'line': new_line, 'content': line[1:]})
                new_line += 1
            elif line.startswith('-'):
                current_hunk['lines'].append({'type': 'del', 'content': line[1:]})
            elif line.startswith(' '):
                new_line += 1
    return hunks
```

### Skip Patterns

Files to skip:
```bash
SKIP_PATTERNS=(
  "*.lock"
  "package-lock.json"
  "yarn.lock"
  "Cargo.lock"
  "Gemfile.lock"
  "*.min.js"
  "*.min.css"
  "dist/*"
  "build/*"
  "vendor/*"
  "*.pb.go"
  "*.generated.*"
)
```

Binary file detection in diff output:
```
Binary files a/image.png and b/image.png differ
```

---

## Topic 4: Rate Limit Handling for GitHub API via `gh api`

### Rate Limit Headers

GitHub REST API returns these headers:
- `X-RateLimit-Limit`: requests per hour
- `X-RateLimit-Remaining`: remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets
- `X-RateLimit-Used`: requests used

### Check Current Rate Limit

```bash
gh api /rate_limit --jq '.rate'
# Returns: {"limit":5000,"remaining":4987,"reset":1712345678,"used":13}
```

### Retry Pattern

```bash
call_with_retry() {
  local max_retries=3
  local attempt=0
  while [ $attempt -lt $max_retries ]; do
    response=$(gh api "$@" 2>&1)
    exit_code=$?
    if [ $exit_code -eq 0 ]; then
      echo "$response"
      return 0
    fi
    # Check for rate limit (HTTP 403 with rate limit message)
    if echo "$response" | grep -q "rate limit"; then
      reset_time=$(gh api /rate_limit --jq '.rate.reset')
      now=$(date +%s)
      wait_seconds=$((reset_time - now + 5))
      echo "Rate limit hit. Waiting ${wait_seconds}s..." >&2
      sleep "$wait_seconds"
    else
      attempt=$((attempt + 1))
      sleep $((2 ** attempt))  # exponential backoff
    fi
  done
  return 1
}
```

### Batching Reviews (100 comment limit)

GitHub PR Reviews API accepts at most 100 inline comments per request. For larger PRs:

```bash
post_batched_reviews() {
  local repo=$1
  local pr_number=$2
  local commit_sha=$3
  local comments_json=$4  # JSON array

  total=$(echo "$comments_json" | jq 'length')
  batch_size=100
  offset=0

  while [ $offset -lt $total ]; do
    batch=$(echo "$comments_json" | jq "[.[$offset:$((offset + batch_size))]]")
    gh api --method POST "/repos/$repo/pulls/$pr_number/reviews" \
      --field commit_id="$commit_sha" \
      --field event="COMMENT" \
      --field body="" \
      --field comments="$batch"
    offset=$((offset + batch_size))
    # Respect secondary rate limits (1s between requests)
    sleep 1
  done
}
```

### Secondary Rate Limits

GitHub also enforces secondary rate limits (concurrent requests, rapid succession). Best practices:
- Add 1-second delay between consecutive API calls
- Avoid parallelizing POST requests to the same resource
- Use `--silent` with `gh api` to suppress progress output in scripts
