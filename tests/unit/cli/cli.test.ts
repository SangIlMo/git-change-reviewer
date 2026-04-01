import { describe, it, expect } from 'vitest';
import { parseArgs } from '../../../src/cli/args.js';

describe('parseArgs', () => {
  it('parses --repo and --pr flags', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '42']);
    expect(args.repo).toBe('owner/repo');
    expect(args.pr).toBe(42);
  });

  it('parses --token flag', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1', '--token', 'mytoken']);
    expect(args.token).toBe('mytoken');
  });

  it('parses --dry-run flag', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1', '--dry-run']);
    expect(args.dryRun).toBe(true);
  });

  it('defaults dry-run to false', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1']);
    expect(args.dryRun).toBe(false);
  });

  it('parses --format flag', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1', '--format', 'json']);
    expect(args.format).toBe('json');
  });

  it('defaults format to text', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1']);
    expect(args.format).toBe('text');
  });

  it('parses --max-comments flag', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1', '--max-comments', '25']);
    expect(args.maxComments).toBe(25);
  });

  it('defaults max-comments to 50', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1']);
    expect(args.maxComments).toBe(50);
  });

  it('parses --model flag', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1', '--model', 'claude-opus-4-5']);
    expect(args.model).toBe('claude-opus-4-5');
  });

  it('throws when --repo is missing', () => {
    expect(() => parseArgs(['--pr', '42'])).toThrow();
  });

  it('throws when --pr is missing', () => {
    expect(() => parseArgs(['--repo', 'owner/repo'])).toThrow();
  });

  it('throws when --pr is not a number', () => {
    expect(() => parseArgs(['--repo', 'owner/repo', '--pr', 'notanumber'])).toThrow();
  });

  it('parses --concurrency flag', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1', '--concurrency', '10']);
    expect(args.concurrency).toBe(10);
  });

  it('defaults concurrency to 5', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1']);
    expect(args.concurrency).toBe(5);
  });

  it('defaults concurrency to 5 when value is not a number', () => {
    const args = parseArgs(['--repo', 'owner/repo', '--pr', '1', '--concurrency', 'bad']);
    expect(args.concurrency).toBe(5);
  });
});

describe('dry-run output', () => {
  it('formats annotations for text dry-run output', async () => {
    const { formatDryRunText } = await import('../../../src/cli/args.js');
    const annotations = [
      {
        file: 'src/auth/login.ts',
        start_line: 45,
        end_line: 52,
        body: '> **Intent**: Adds null check.',
        source_type: 'context',
        confidence: 'high',
        context_refs: ['commit_message'],
      },
    ];

    const output = formatDryRunText(annotations);
    expect(output).toContain('src/auth/login.ts');
    expect(output).toContain('45');
    expect(output).toContain('52');
    expect(output).toContain('Intent');
  });
});
