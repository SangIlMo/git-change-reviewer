import type { ContextSource } from '../types.js';

const ISSUE_REF_PATTERN = /(?:fixes|closes|resolves|fix|close|resolve)?\s*#(\d+)/gi;

function extractIssueRefs(text: string): string[] {
  const refs: string[] = [];
  const matches = text.matchAll(ISSUE_REF_PATTERN);
  for (const match of matches) {
    refs.push(`#${match[1]}`);
  }
  return refs;
}

export function extractContext(options: {
  commitMessages?: string[];
  prDescription?: string;
}): ContextSource[] {
  const sources: ContextSource[] = [];

  for (const msg of options.commitMessages ?? []) {
    if (!msg || msg.trim() === '') continue;
    sources.push({
      type: 'commit_message',
      content: msg.trim(),
    });

    for (const ref of extractIssueRefs(msg)) {
      sources.push({
        type: 'issue_link',
        content: ref,
      });
    }
  }

  if (options.prDescription && options.prDescription.trim() !== '') {
    sources.push({
      type: 'pr_description',
      content: options.prDescription.trim(),
    });

    for (const ref of extractIssueRefs(options.prDescription)) {
      sources.push({
        type: 'issue_link',
        content: ref,
      });
    }
  }

  return sources;
}
