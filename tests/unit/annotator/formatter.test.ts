import { describe, it, expect } from 'vitest';
import { formatAnnotation } from '../../../src/annotator/formatter.js';
import type { IntentAnnotation, ChangeBlock } from '../../../src/types.js';

const makeBlock = (): ChangeBlock => ({
  file_path: 'src/auth/login.ts',
  start_line: 45,
  end_line: 52,
  content: '+const token = user.token ?? null;',
  block_type: 'addition',
  changes: [{ type: 'add', content: 'const token = user.token ?? null;', new_line: 45 }],
});

describe('formatAnnotation', () => {
  it('formats a context-based annotation with Intent, Source, and Confidence: High', () => {
    const annotation: IntentAnnotation = {
      change_block: makeBlock(),
      body: 'Adds null check before accessing user.token to prevent runtime errors.',
      source_type: 'context',
      confidence: 'high',
      context_references: ['commit_message'],
    };

    const result = formatAnnotation(annotation);

    expect(result).toContain('**Intent**:');
    expect(result).toContain('**Source**:');
    expect(result).toContain('**Confidence**: High');
    expect(result).toContain('commit_message');
    expect(result).not.toContain('[Inferred]');
    expect(result).not.toContain('_This annotation was inferred');
  });

  it('formats an inferred annotation with [Inferred] label and disclaimer', () => {
    const annotation: IntentAnnotation = {
      change_block: makeBlock(),
      body: 'Extracts retry logic into a separate helper to reduce duplication.',
      source_type: 'inferred',
      confidence: 'medium',
      context_references: [],
    };

    const result = formatAnnotation(annotation);

    expect(result).toContain('**Intent** [Inferred]:');
    expect(result).toContain('**Confidence**: Medium');
    expect(result).toContain('_This annotation was inferred');
    expect(result).not.toContain('**Source**:');
  });

  it('formats annotation with multiple context references', () => {
    const annotation: IntentAnnotation = {
      change_block: makeBlock(),
      body: 'Updates logger configuration to include timestamps and JSON formatting.',
      source_type: 'context',
      confidence: 'high',
      context_references: ['commit_message', 'pr_description', 'issue:#42'],
    };

    const result = formatAnnotation(annotation);

    expect(result).toContain('commit_message');
    expect(result).toContain('pr_description');
    expect(result).toContain('issue:#42');
    expect(result).toContain('**Source**:');
  });

  it('formats context annotation as blockquote lines starting with >', () => {
    const annotation: IntentAnnotation = {
      change_block: makeBlock(),
      body: 'Some intent body.',
      source_type: 'context',
      confidence: 'high',
      context_references: ['pr_description'],
    };

    const result = formatAnnotation(annotation);
    const lines = result.split('\n');
    // All non-empty lines should start with '>'
    for (const line of lines) {
      if (line.trim() !== '') {
        expect(line.startsWith('>')).toBe(true);
      }
    }
  });

  it('formats inferred annotation as blockquote lines starting with >', () => {
    const annotation: IntentAnnotation = {
      change_block: makeBlock(),
      body: 'Some inferred body.',
      source_type: 'inferred',
      confidence: 'medium',
      context_references: [],
    };

    const result = formatAnnotation(annotation);
    const lines = result.split('\n');
    for (const line of lines) {
      if (line.trim() !== '') {
        expect(line.startsWith('>')).toBe(true);
      }
    }
  });
});
