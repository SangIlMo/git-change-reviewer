# Data Model: PR Change Annotations

**Date**: 2026-03-31

---

## Entities

### DiffFile

Represents a single file in the PR diff.

```typescript
interface DiffFile {
  path: string;                    // Current file path
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  old_path?: string;               // Previous path (only when status = 'renamed')
  hunks: DiffHunk[];
}
```

---

### DiffHunk

A contiguous changed region within a file, as expressed by a unified diff `@@` header.

```typescript
interface DiffHunk {
  header: string;                  // Raw hunk header, e.g. "@@ -10,7 +10,9 @@"
  start_line: number;              // First new-file line number in hunk
  end_line: number;                // Last new-file line number in hunk
  changes: DiffChange[];
}

interface DiffChange {
  type: 'add' | 'del' | 'normal'; // '+', '-', or context line
  content: string;                 // Line content (without leading +/-/ )
  old_line?: number;               // Old file line number (del/normal)
  new_line?: number;               // New file line number (add/normal)
}
```

---

### ChangeBlock

A semantically coherent unit of change, derived from one or more contiguous changed lines within a hunk. Multiple `ChangeBlock` instances may be extracted from a single `DiffHunk` when logical gaps (≥3 context lines) separate changed regions.

```typescript
interface ChangeBlock {
  file_path: string;
  start_line: number;              // First new-file line (for GitHub API 'line' field)
  end_line: number;                // Last new-file line (for GitHub API multi-line comment)
  content: string;                 // Unified diff fragment for this block (input to AI)
  block_type: 'addition' | 'deletion' | 'modification';
}
```

---

### ContextSource

An information source used to ground the intent annotation in traceable reasoning.

```typescript
interface ContextSource {
  type: 'commit_message' | 'pr_description' | 'issue_link';
  content: string;                 // Raw text of the source
  relevance_score: number;         // 0.0–1.0; computed by AI or heuristic
}
```

---

### IntentAnnotation

The AI-generated explanation for a single `ChangeBlock`, ready for rendering.

```typescript
interface IntentAnnotation {
  change_block: ChangeBlock;       // Reference to the annotated block
  body: string;                    // Rendered Markdown body for GitHub comment
  source_type: 'context' | 'inferred';
  confidence: 'high' | 'medium' | 'low';
  context_references: string[];    // e.g. ["commit:abc123", "pr:description", "issue:#42"]
}
```

---

### ReviewPayload

The complete payload sent to the GitHub Reviews API in a single batched request.

```typescript
interface ReviewPayload {
  pr_number: number;
  repo: string;                    // "owner/repo"
  commit_sha: string;              // HEAD commit SHA of the PR branch
  comments: ReviewComment[];
}

interface ReviewComment {
  path: string;                    // File path
  line: number;                    // End line (new file side)
  start_line?: number;             // Start line for multi-line comment (omit if single-line)
  side: 'RIGHT';                   // Always RIGHT (new file side) for additions/modifications
  body: string;                    // Rendered annotation Markdown
}
```

---

## Entity Relationships

```
DiffFile (1) ──── (N) DiffHunk (1) ──── (M) ChangeBlock (1) ──── (1) IntentAnnotation
                                                                         │
                                                            (N) ContextSource (referenced)
                                                                         │
                                                            ReviewPayload ←── ReviewComment[]
```

---

## Notes

- `ChangeBlock.start_line` and `end_line` use **new file** line numbers (GitHub API `side: "RIGHT"`).
- `ReviewComment.start_line` is omitted when `start_line == line` (single-line comment).
- Binary files and auto-generated files (lock files, etc.) do not produce `ChangeBlock` instances; they are filtered at the `DiffFile` level.
- Deleted files (`status: 'deleted'`) produce `ChangeBlock` entries with `block_type: 'deletion'`; the comment is posted on the `LEFT` side using old line numbers.
