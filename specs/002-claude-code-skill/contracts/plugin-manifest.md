# Contract: Plugin Manifest (`plugin.json`)

**Feature**: 002-claude-code-skill
**File**: `annotate-pr-plugin/.claude-plugin/plugin.json`

---

## Schema

The plugin manifest is a JSON file located at `.claude-plugin/plugin.json` within the plugin repository. It is read by the Claude Code marketplace to register and display the plugin.

```json
{
  "name": "annotate-pr-plugin",
  "description": "Analyzes PR changes and posts AI-generated intent annotations as review comments",
  "version": "1.0.0",
  "author": {
    "name": "SangIlMo"
  },
  "repository": "https://github.com/SangIlMo/git-change-reviewer",
  "license": "MIT",
  "keywords": ["pr", "review", "annotation", "code-review", "ai"],
  "skills": ["./skills/annotate-pr/SKILL.md"]
}
```

## Field Definitions

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | string | Yes | kebab-case, unique in marketplace | Plugin identifier used in `/plugin install <name>` |
| `description` | string | Yes | Max 160 chars | Short description shown in marketplace listing |
| `version` | string | Yes | Semver (MAJOR.MINOR.PATCH) | Current plugin version |
| `author.name` | string | Yes | — | Publisher display name |
| `author.email` | string | No | Valid email format | Optional contact email |
| `repository` | string | Yes | Valid GitHub HTTPS URL | Source repository; used for marketplace `add` command |
| `license` | string | Yes | SPDX identifier | Must match LICENSE file |
| `keywords` | string[] | No | Max 10 tags, lowercase | Searchable tags in marketplace |
| `skills` | string[] | Yes | Relative paths from manifest dir | Paths to SKILL.md files included in this plugin |

## Validation Rules

1. `name` must match the pattern `^[a-z][a-z0-9-]*$`
2. `version` must follow semver — no `v` prefix
3. Each path in `skills` must resolve to an existing `SKILL.md` file
4. `repository` must be a public GitHub repository URL

## Installation Commands

```bash
# Add plugin source (fetches manifest from GitHub)
/plugin marketplace add SangIlMo/git-change-reviewer

# Install the plugin from the added marketplace source
/plugin install annotate-pr-plugin
```

## Update Strategy

- Increment `version` on every release using semver rules:
  - **PATCH**: Bug fixes, prompt tuning, script fixes
  - **MINOR**: New options, new skip patterns, improved output format
  - **MAJOR**: Breaking changes to invocation syntax or output format
- Update `CHANGELOG.md` with each version bump
