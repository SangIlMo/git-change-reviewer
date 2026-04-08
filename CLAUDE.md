# git-change-reviewer Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-03

## Active Technologies
- Markdown (SKILL.md prompt) + Bash (helper scripts) + gh CLI (GitHub API), Claude Code (AI engine) (002-claude-code-skill)
- N/A (stateless) (002-claude-code-skill)
- Bash (sh-compatible) for scripts, Markdown for skill promp + `gh` CLI (GitHub API), `jq` (JSON processing) (003-checks-api-annotations)

- TypeScript 5.x (Node.js 20+) + `@octokit/rest` (GitHub API), `parse-diff` (unified diff parsing), `@anthropic-ai/sdk` (AI annotation generation) (001-pr-change-annotations)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x (Node.js 20+): Follow standard conventions

## Recent Changes
- 003-checks-api-annotations: Added Bash (sh-compatible) for scripts, Markdown for skill promp + `gh` CLI (GitHub API), `jq` (JSON processing)
- 002-claude-code-skill: Added Markdown (SKILL.md prompt) + Bash (helper scripts) + gh CLI (GitHub API), Claude Code (AI engine)

- 001-pr-change-annotations: Added TypeScript 5.x (Node.js 20+) + `@octokit/rest` (GitHub API), `parse-diff` (unified diff parsing), `@anthropic-ai/sdk` (AI annotation generation)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
