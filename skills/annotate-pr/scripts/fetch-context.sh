#!/usr/bin/env bash
set -euo pipefail

REPO="$1"
PR_NUMBER="$2"

# Check gh auth
if ! gh auth status &>/dev/null; then
  echo "Error: gh CLI not authenticated. Run 'gh auth login'" >&2
  exit 2
fi

# Fetch PR metadata
PR_JSON=$(gh pr view "$PR_NUMBER" --repo "$REPO" \
  --json title,body,headRefName,baseRefName,commits,headRefOid 2>/dev/null) || {
  echo "Error: PR #$PR_NUMBER not found in $REPO" >&2
  exit 3
}

TITLE=$(echo "$PR_JSON" | jq -r '.title // ""')
DESCRIPTION=$(echo "$PR_JSON" | jq -r '.body // ""')
HEAD_BRANCH=$(echo "$PR_JSON" | jq -r '.headRefName // ""')
BASE_BRANCH=$(echo "$PR_JSON" | jq -r '.baseRefName // ""')
HEAD_SHA=$(echo "$PR_JSON" | jq -r '.headRefOid // ""')
COMMIT_MESSAGES=$(echo "$PR_JSON" | jq '[.commits[]? | .messageHeadline] // []')

# Fetch diff
DIFF=$(gh pr diff "$PR_NUMBER" --repo "$REPO" 2>/dev/null) || {
  echo "Error: Failed to fetch diff for PR #$PR_NUMBER" >&2
  exit 1
}

# Output JSON matching contract schema
jq -n \
  --arg repo "$REPO" \
  --argjson pr_number "$PR_NUMBER" \
  --arg title "$TITLE" \
  --arg description "$DESCRIPTION" \
  --arg base_branch "$BASE_BRANCH" \
  --arg head_branch "$HEAD_BRANCH" \
  --arg head_sha "$HEAD_SHA" \
  --argjson commit_messages "$COMMIT_MESSAGES" \
  --arg diff "$DIFF" \
  '{
    repo: $repo,
    pr_number: $pr_number,
    title: $title,
    description: $description,
    commit_messages: $commit_messages,
    base_branch: $base_branch,
    head_branch: $head_branch,
    head_sha: $head_sha,
    diff: $diff
  }'
