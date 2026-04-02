#!/usr/bin/env bash
set -euo pipefail

# Skip patterns for generated/lock/binary-adjacent files per contract
SKIP_PATTERNS='(^|/)package-lock\.json$|(^|/)yarn\.lock$|(^|/)pnpm-lock\.yaml$|(^|/)go\.sum$|(^|/)Cargo\.lock$|(^|/)poetry\.lock$|(^|/)Gemfile\.lock$|(^|/)composer\.lock$|\.lock$|\.min\.js$|\.min\.css$|\.map$|\.generated\.|\.pb\.go$|(^|/)(dist|build|vendor)/'

# Read diff from stdin
DIFF=$(cat)

if [ -z "$DIFF" ]; then
  echo "[]"
  exit 0
fi

# Use awk to parse unified diff into JSON change blocks
echo "$DIFF" | awk -v skip="$SKIP_PATTERNS" '
BEGIN {
  print "["
  first = 1
  in_file = 0
  file_path = ""
  block_start = 0
  block_end = 0
  block_content = ""
  has_add = 0
  has_del = 0
  current_line = 0
  is_binary = 0
  skip_file = 0
  context_count = 0
}

function json_escape(s) {
  gsub(/\\/, "\\\\", s)
  gsub(/"/, "\\\"", s)
  gsub(/\n/, "\\n", s)
  gsub(/\t/, "\\t", s)
  gsub(/\r/, "", s)
  return s
}

function flush_block() {
  if (block_content != "" && !skip_file && !is_binary) {
    if (!first) printf ","
    first = 0

    escaped = json_escape(block_content)

    if (has_add && has_del) btype = "modification"
    else if (has_add) btype = "addition"
    else btype = "deletion"

    printf "{\"file\":\"%s\",\"start_line\":%d,\"end_line\":%d,\"content\":\"%s\",\"type\":\"%s\"}\n",
      file_path, block_start, block_end, escaped, btype
  }
  block_content = ""
  block_start = 0
  block_end = 0
  has_add = 0
  has_del = 0
  context_count = 0
}

/^diff --git/ {
  flush_block()
  in_file = 1
  is_binary = 0
  skip_file = 0
  # Extract file path from "diff --git a/path b/path" — take last field
  n = split($0, parts, " ")
  file_path = parts[n]
  sub(/^b\//, "", file_path)
  # Check skip patterns using match
  if (match(file_path, skip)) {
    skip_file = 1
  }
}

/^Binary files/ {
  is_binary = 1
  flush_block()
}

/^@@/ {
  flush_block()
  in_file = 1
  # Parse @@ -old,count +new,start @@ — extract new file start line
  if (match($0, /\+([0-9]+)/, arr)) {
    current_line = arr[1] + 0
  } else {
    # Fallback: try without gensub
    line = $0
    sub(/.*\+/, "", line)
    sub(/[^0-9].*/, "", line)
    current_line = line + 0
  }
  context_count = 0
}

/^[ ]/ && in_file && !is_binary && !skip_file {
  context_count++
  # Flush block after 3 consecutive context lines (new hunk boundary)
  if (context_count >= 3 && block_content != "") {
    flush_block()
  }
  current_line++
}

/^\+[^+]/ && in_file && !is_binary && !skip_file {
  context_count = 0
  if (block_start == 0) block_start = current_line
  block_end = current_line
  line = substr($0, 2)
  block_content = block_content line "\n"
  has_add = 1
  current_line++
}

/^\-[^-]/ && in_file && !is_binary && !skip_file {
  context_count = 0
  if (block_start == 0) block_start = current_line
  line = substr($0, 2)
  block_content = block_content line "\n"
  has_del = 1
  # deletion lines do not advance new-file line counter
}

END {
  flush_block()
  print "]"
}
'
