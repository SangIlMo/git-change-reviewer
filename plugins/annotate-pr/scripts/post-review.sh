#!/usr/bin/env bash
set -euo pipefail

REPO="$1"
PR_NUMBER="$2"
COMMIT_SHA="$3"
MAX_COMMENTS=100
MAX_RETRIES=3

# Check gh auth
if ! gh auth status &>/dev/null; then
  echo "Error: gh CLI not authenticated. Run 'gh auth login'" >&2
  exit 2
fi

# Read comments from stdin
COMMENTS=$(cat)

if [ -z "$COMMENTS" ] || [ "$COMMENTS" = "[]" ]; then
  echo "No comments to post."
  exit 0
fi

TOTAL=$(echo "$COMMENTS" | jq 'length')

if [ "$TOTAL" -eq 0 ]; then
  echo "No comments to post."
  exit 0
fi

BATCH_COUNT=0
OFFSET=0

while [ "$OFFSET" -lt "$TOTAL" ]; do
  BATCH_COUNT=$((BATCH_COUNT + 1))
  END=$((OFFSET + MAX_COMMENTS))
  BATCH_COMMENTS=$(echo "$COMMENTS" | jq ".[$OFFSET:$END]")
  BATCH_SIZE=$(echo "$BATCH_COMMENTS" | jq 'length')

  # Build review payload — empty body per contract ("event": "COMMENT", "body": "")
  PAYLOAD=$(jq -n \
    --arg sha "$COMMIT_SHA" \
    --argjson comments "$BATCH_COMMENTS" \
    '{"body": "", "commit_id": $sha, "event": "COMMENT", "comments": $comments}')

  # Post with retry
  RETRY=0
  SUCCESS=0
  while [ "$RETRY" -lt "$MAX_RETRIES" ]; do
    HTTP_RESPONSE=$(echo "$PAYLOAD" | gh api \
      "repos/$REPO/pulls/$PR_NUMBER/reviews" \
      --input - \
      --method POST \
      --include 2>&1) || true

    HTTP_CODE=$(echo "$HTTP_RESPONSE" | head -1 | awk '{print $2}')

    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
      SUCCESS=1
      break
    elif [ "$HTTP_CODE" = "429" ] || [ "$HTTP_CODE" = "403" ]; then
      RETRY=$((RETRY + 1))
      if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
        break
      fi
      # Read rate limit reset time
      RESET_TIME=$(gh api /rate_limit 2>/dev/null | jq -r '.rate.reset // 0') || RESET_TIME=0
      NOW=$(date +%s)
      WAIT=$((RESET_TIME - NOW + 5))
      if [ "$WAIT" -le 0 ]; then
        WAIT=$((2 ** RETRY))
      fi
      echo "Rate limit hit. Waiting ${WAIT}s... (attempt $RETRY/$MAX_RETRIES)" >&2
      sleep "$WAIT"
    else
      echo "Error: Failed to post review batch $BATCH_COUNT (HTTP $HTTP_CODE)" >&2
      exit 1
    fi
  done

  if [ "$SUCCESS" -eq 0 ]; then
    echo "Error: Rate limit exceeded after $MAX_RETRIES retries for batch $BATCH_COUNT" >&2
    exit 4
  fi

  # Insert 1-second delay between batches to respect GitHub secondary rate limits
  if [ "$((OFFSET + MAX_COMMENTS))" -lt "$TOTAL" ]; then
    sleep 1
  fi

  OFFSET=$((OFFSET + MAX_COMMENTS))
done

if [ "$BATCH_COUNT" -eq 1 ]; then
  echo "Posted $TOTAL review comment(s) to PR #$PR_NUMBER ($BATCH_COUNT review batch)."
else
  echo "Posted $TOTAL review comment(s) to PR #$PR_NUMBER ($BATCH_COUNT review batches)."
fi
