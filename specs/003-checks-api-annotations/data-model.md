# Data Model: Checks API Annotation Output Channel

**Date**: 2026-04-03

---

## Entities

### OutputMode

Represents the user's selected annotation delivery channel.

- **value**: `checks` | `review`
- **default**: `checks`
- **source**: `--output-mode` CLI flag or skill argument

### CheckRunPayload

Represents the data needed to create/update a check run with annotations.

- **name**: Display name for the check run (e.g., "PR Change Annotations")
- **head_sha**: The commit SHA to attach the check run to
- **status**: `in_progress` | `completed`
- **conclusion**: `neutral` (used when completing — annotations are informational)
- **output**: CheckRunOutput

### CheckRunOutput

The output section of a check run containing summary and annotations.

- **title**: Short title (e.g., "PR Change Annotations — 51 annotations")
- **summary**: Markdown summary with annotation counts by type
- **annotations**: Array of CheckRunAnnotation (max 50 per API call)

### CheckRunAnnotation

An individual annotation attached to a specific location in the codebase.

- **path**: File path relative to repository root
- **start_line**: Starting line number in the file
- **end_line**: Ending line number in the file
- **annotation_level**: Always `notice`
- **title**: Short label — "Intent (Context)", "Intent (Inferred)", or "Intent (Conflict)"
- **message**: Full annotation body text (markdown formatted)

### Relationships

```
OutputMode ─── selects ──→ Publisher (ChecksPublisher or ReviewPublisher)
CheckRunPayload ─── contains ──→ CheckRunOutput
CheckRunOutput ─── contains many ──→ CheckRunAnnotation (batched at 50)
CheckRunAnnotation ─── maps from ──→ IntentAnnotation (existing entity)
```

### State Transitions

```
CheckRun lifecycle:
  [created, in_progress] → PATCH with annotation batches → [completed, neutral]
  
Fallback:
  [checks attempt] → 403 permission error → [review fallback]
```

## Mapping: IntentAnnotation → CheckRunAnnotation

| IntentAnnotation field | CheckRunAnnotation field | Transformation |
|---|---|---|
| change_block.file_path | path | Direct copy |
| change_block.start_line | start_line | Direct copy |
| change_block.end_line | end_line | Direct copy |
| formatted body (markdown) | message | Direct copy |
| source_type | title | "Intent (Context)" / "Intent (Inferred)" / "Intent (Conflict)" |
| — | annotation_level | Always `notice` |
