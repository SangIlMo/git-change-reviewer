import { describe, it, expect } from 'vitest';
import { extractContext } from '../../../src/context/extractor.js';

describe('extractContext', () => {
  it('extracts context from commit message → ContextSource with type commit_message', () => {
    const sources = extractContext({ commitMessages: ['fix: handle null token'] });
    const commitSources = sources.filter((s) => s.type === 'commit_message');
    expect(commitSources).toHaveLength(1);
    expect(commitSources[0].content).toBe('fix: handle null token');
  });

  it('extracts context from PR description → ContextSource with type pr_description', () => {
    const sources = extractContext({ prDescription: 'This PR adds retry logic to API calls.' });
    const prSources = sources.filter((s) => s.type === 'pr_description');
    expect(prSources).toHaveLength(1);
    expect(prSources[0].content).toBe('This PR adds retry logic to API calls.');
  });

  it('extracts plain issue reference #123 → ContextSource with type issue_link', () => {
    const sources = extractContext({ commitMessages: ['fix: crash in auth #123'] });
    const issueSources = sources.filter((s) => s.type === 'issue_link');
    expect(issueSources).toHaveLength(1);
    expect(issueSources[0].content).toBe('#123');
  });

  it('extracts "fixes #456" → ContextSource with type issue_link', () => {
    const sources = extractContext({ commitMessages: ['feat: add login page, fixes #456'] });
    const issueSources = sources.filter((s) => s.type === 'issue_link');
    expect(issueSources.some((s) => s.content === '#456')).toBe(true);
  });

  it('extracts "closes #789" → ContextSource with type issue_link', () => {
    const sources = extractContext({ prDescription: 'closes #789' });
    const issueSources = sources.filter((s) => s.type === 'issue_link');
    expect(issueSources.some((s) => s.content === '#789')).toBe(true);
  });

  it('handles empty commit messages gracefully', () => {
    const sources = extractContext({ commitMessages: [] });
    expect(sources).toEqual([]);
  });

  it('handles null/undefined inputs gracefully', () => {
    expect(() => extractContext({})).not.toThrow();
    const sources = extractContext({});
    expect(sources).toEqual([]);
  });

  it('handles empty string inputs gracefully', () => {
    const sources = extractContext({ commitMessages: [''], prDescription: '' });
    expect(sources).toEqual([]);
  });

  it('handles multiple commit messages', () => {
    const sources = extractContext({
      commitMessages: [
        'fix: auth bug',
        'refactor: cleanup #100',
        'docs: update README',
      ],
    });
    const commitSources = sources.filter((s) => s.type === 'commit_message');
    expect(commitSources).toHaveLength(3);
    const issueSources = sources.filter((s) => s.type === 'issue_link');
    expect(issueSources).toHaveLength(1);
    expect(issueSources[0].content).toBe('#100');
  });

  it('extracts issue refs from PR description as well', () => {
    const sources = extractContext({ prDescription: 'This fixes #42 and closes #55.' });
    const issueSources = sources.filter((s) => s.type === 'issue_link');
    expect(issueSources.length).toBeGreaterThanOrEqual(2);
    const refs = issueSources.map((s) => s.content);
    expect(refs).toContain('#42');
    expect(refs).toContain('#55');
  });
});
