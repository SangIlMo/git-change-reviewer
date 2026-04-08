#!/usr/bin/env bash
set -euo pipefail

REPO="$1"
PR_NUMBER="$2"
HEAD_SHA="$3"
MAX_ANNOTATIONS=50
MAX_RETRIES=3

# Check gh auth
if ! gh auth status &>/dev/null; then
  echo "Error: gh CLI not authenticated. Run 'gh auth login'" >&2
  exit 2
fi

# Read annotations from stdin
ANNOTATIONS=$(cat)

if [ -z "$ANNOTATIONS" ] || [ "$ANNOTATIONS" = "[]" ]; then
  echo "No annotations to post."
  exit 0
fi

TOTAL=$(echo "$ANNOTATIONS" | jq 'length')

if [ "$TOTAL" -eq 0 ]; then
  echo "No annotations to post."
  exit 0
fi

OUTPUT_TITLE="PR Change Annotations — $TOTAL annotations"

# Transform annotations to Checks API format (add annotation_level: "notice")
ANNOTATIONS=$(echo "$ANNOTATIONS" | jq '[.[] | {
  path: .path,
  start_line: .start_line,
  end_line: .end_line,
  annotation_level: "notice",
  title: .title,
  message: .message
}]')

# --- Helper: post with retry and rate-limit handling ---
gh_api_with_retry() {
  local method="$1"
  local endpoint="$2"
  local payload="$3"

  local RETRY=0
  local RESPONSE=""

  while [ "$RETRY" -lt "$MAX_RETRIES" ]; do
    RESPONSE=$(echo "$payload" | gh api \
      "$endpoint" \
      --input - \
      --method "$method" \
      --include 2>&1) || true

    HTTP_CODE=$(echo "$RESPONSE" | head -1 | awk '{print $2}')

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
      # Strip headers, return JSON body
      echo "$RESPONSE" | sed '1,/^\r$/d'
      return 0
    elif [ "$HTTP_CODE" = "403" ]; then
      # Check if permission error vs rate limit
      BODY=$(echo "$RESPONSE" | sed '1,/^\r$/d')
      if echo "$BODY" | jq -r '.message // ""' 2>/dev/null | grep -qi "resource not accessible\|not accessible by integration"; then
        echo "Error: Permission denied — check run creation requires write access to Checks." >&2
        exit 3
      fi
      # Treat other 403 as rate limit
      RETRY=$((RETRY + 1))
      if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
        break
      fi
      RESET_TIME=$(gh api /rate_limit 2>/dev/null | jq -r '.rate.reset // 0') || RESET_TIME=0
      NOW=$(date +%s)
      WAIT=$((RESET_TIME - NOW + 5))
      if [ "$WAIT" -le 0 ]; then
        WAIT=$((2 ** RETRY))
      fi
      echo "Rate limit hit. Waiting ${WAIT}s... (attempt $RETRY/$MAX_RETRIES)" >&2
      sleep "$WAIT"
    elif [ "$HTTP_CODE" = "429" ]; then
      RETRY=$((RETRY + 1))
      if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
        break
      fi
      RESET_TIME=$(gh api /rate_limit 2>/dev/null | jq -r '.rate.reset // 0') || RESET_TIME=0
      NOW=$(date +%s)
      WAIT=$((RESET_TIME - NOW + 5))
      if [ "$WAIT" -le 0 ]; then
        WAIT=$((2 ** RETRY))
      fi
      echo "Rate limit hit. Waiting ${WAIT}s... (attempt $RETRY/$MAX_RETRIES)" >&2
      sleep "$WAIT"
    else
      echo "Error: GitHub API returned HTTP $HTTP_CODE" >&2
      exit 1
    fi
  done

  echo "Error: Rate limit exceeded after $MAX_RETRIES retries" >&2
  exit 4
}

# --- Create check run with first batch ---
FIRST_BATCH=$(echo "$ANNOTATIONS" | jq ".[:$MAX_ANNOTATIONS]")

CREATE_PAYLOAD=$(jq -n \
  --arg name "PR Change Annotations" \
  --arg sha "$HEAD_SHA" \
  --arg title "$OUTPUT_TITLE" \
  --arg summary "Analyzing PR #$PR_NUMBER changes..." \
  --argjson annotations "$FIRST_BATCH" \
  '{
    name: $name,
    head_sha: $sha,
    status: "in_progress",
    output: {
      title: $title,
      summary: $summary,
      annotations: $annotations
    }
  }')

CREATE_RESPONSE=$(gh_api_with_retry POST "repos/$REPO/check-runs" "$CREATE_PAYLOAD")
CHECK_RUN_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')

BATCH_COUNT=1

# --- Post remaining batches ---
OFFSET=$MAX_ANNOTATIONS

while [ "$OFFSET" -lt "$TOTAL" ]; do
  BATCH_COUNT=$((BATCH_COUNT + 1))
  BATCH=$(echo "$ANNOTATIONS" | jq ".[$OFFSET:$((OFFSET + MAX_ANNOTATIONS))]")

  PATCH_PAYLOAD=$(jq -n \
    --arg title "$OUTPUT_TITLE" \
    --arg summary "Analyzing PR #$PR_NUMBER changes..." \
    --argjson annotations "$BATCH" \
    '{
      output: {
        title: $title,
        summary: $summary,
        annotations: $annotations
      }
    }')

  gh_api_with_retry PATCH "repos/$REPO/check-runs/$CHECK_RUN_ID" "$PATCH_PAYLOAD" >/dev/null

  # Delay between batches to respect secondary rate limits
  sleep 1

  OFFSET=$((OFFSET + MAX_ANNOTATIONS))
done

# --- Build final summary with category counts ---
CONTEXT_COUNT=$(echo "$ANNOTATIONS" | jq '[.[] | select(.title | test("context"; "i"))] | length')
INFERRED_COUNT=$(echo "$ANNOTATIONS" | jq '[.[] | select(.title | test("infer"; "i"))] | length')
CONFLICT_COUNT=$(echo "$ANNOTATIONS" | jq '[.[] | select(.title | test("conflict"; "i"))] | length')

FINAL_SUMMARY="Posted $TOTAL annotation(s) to PR #$PR_NUMBER.
- Context-based: $CONTEXT_COUNT
- Inferred: $INFERRED_COUNT
- Conflict: $CONFLICT_COUNT"

FINAL_PAYLOAD=$(jq -n \
  --arg title "$OUTPUT_TITLE" \
  --arg summary "$FINAL_SUMMARY" \
  '{
    status: "completed",
    conclusion: "neutral",
    output: {
      title: $title,
      summary: $summary
    }
  }')

gh_api_with_retry PATCH "repos/$REPO/check-runs/$CHECK_RUN_ID" "$FINAL_PAYLOAD" >/dev/null

echo "Posted $TOTAL check annotation(s) to PR #$PR_NUMBER ($BATCH_COUNT batch(es))."
