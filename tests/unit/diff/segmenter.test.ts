import { describe, it, expect } from 'vitest';
import { segmentBlocks, isGeneratedFile } from '../../../src/diff/segmenter.js';
import type { DiffFile, DiffChange } from '../../../src/types.js';

function makeFile(hunks: DiffFile['hunks'], extra?: Partial<DiffFile>): DiffFile {
  return {
    path: 'test/file.ts',
    status: 'modified',
    hunks,
    ...extra,
  };
}

function makeHunk(changes: DiffChange[], startLine = 1): DiffFile['hunks'][0] {
  return {
    header: `@@ -${startLine},${changes.length} +${startLine},${changes.length} @@`,
    start_line: startLine,
    end_line: startLine + changes.length - 1,
    changes,
  };
}

describe('segmentBlocks', () => {
  it('produces ChangeBlocks from mixed add/delete/context hunk', () => {
    const changes: DiffChange[] = [
      { type: 'normal', content: 'context', new_line: 1, old_line: 1 },
      { type: 'del', content: 'old line', old_line: 2 },
      { type: 'add', content: 'new line', new_line: 2 },
      { type: 'normal', content: 'context', new_line: 3, old_line: 3 },
    ];
    const file = makeFile([makeHunk(changes)]);
    const blocks = segmentBlocks(file);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('groups contiguous additions into a single addition block', () => {
    const changes: DiffChange[] = [
      { type: 'add', content: 'line 1', new_line: 1 },
      { type: 'add', content: 'line 2', new_line: 2 },
      { type: 'add', content: 'line 3', new_line: 3 },
    ];
    const file = makeFile([makeHunk(changes)]);
    const blocks = segmentBlocks(file);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].block_type).toBe('addition');
    expect(blocks[0].changes).toHaveLength(3);
  });

  it('creates separate blocks for interleaved add/delete separated by 3+ context lines', () => {
    const changes: DiffChange[] = [
      { type: 'add', content: 'new feature line', new_line: 1 },
      // 3 context lines (boundary)
      { type: 'normal', content: 'ctx1', new_line: 2, old_line: 2 },
      { type: 'normal', content: 'ctx2', new_line: 3, old_line: 3 },
      { type: 'normal', content: 'ctx3', new_line: 4, old_line: 4 },
      { type: 'del', content: 'old code', old_line: 5 },
    ];
    const file = makeFile([makeHunk(changes)]);
    const blocks = segmentBlocks(file);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].block_type).toBe('addition');
    expect(blocks[1].block_type).toBe('deletion');
  });

  it('keeps interleaved add/delete within 2 context lines as single block', () => {
    const changes: DiffChange[] = [
      { type: 'del', content: 'old line', old_line: 1 },
      { type: 'normal', content: 'ctx1', new_line: 1, old_line: 2 },
      { type: 'normal', content: 'ctx2', new_line: 2, old_line: 3 },
      { type: 'add', content: 'new line', new_line: 3 },
    ];
    const file = makeFile([makeHunk(changes)]);
    const blocks = segmentBlocks(file);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].block_type).toBe('modification');
  });

  it('returns empty blocks for a binary file (no hunks)', () => {
    const file: DiffFile = {
      path: 'assets/logo.png',
      status: 'modified',
      hunks: [],
      binary: true,
    };
    const blocks = segmentBlocks(file);
    expect(blocks).toHaveLength(0);
  });

  it('mixed add/delete in same region → modification block_type', () => {
    const changes: DiffChange[] = [
      { type: 'del', content: 'removed', old_line: 1 },
      { type: 'add', content: 'added', new_line: 1 },
    ];
    const file = makeFile([makeHunk(changes)]);
    const blocks = segmentBlocks(file);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].block_type).toBe('modification');
  });

  it('returns empty blocks for generated file (package-lock.json)', () => {
    const changes: DiffChange[] = [
      { type: 'add', content: '"lodash": "4.17.21"', new_line: 1 },
    ];
    const file = makeFile([makeHunk(changes)], { path: 'package-lock.json' });
    const blocks = segmentBlocks(file);
    expect(blocks).toHaveLength(0);
  });

  it('returns empty blocks for yarn.lock', () => {
    const changes: DiffChange[] = [
      { type: 'add', content: 'resolved "https://registry.yarnpkg.com/..."', new_line: 1 },
    ];
    const file = makeFile([makeHunk(changes)], { path: 'yarn.lock' });
    const blocks = segmentBlocks(file);
    expect(blocks).toHaveLength(0);
  });

  it('returns empty blocks for minified JS file', () => {
    const changes: DiffChange[] = [
      { type: 'add', content: 'var x=1;', new_line: 1 },
    ];
    const file = makeFile([makeHunk(changes)], { path: 'dist/bundle.min.js' });
    const blocks = segmentBlocks(file);
    expect(blocks).toHaveLength(0);
  });

  it('returns empty blocks for source map file', () => {
    const changes: DiffChange[] = [
      { type: 'add', content: '{"version":3}', new_line: 1 },
    ];
    const file = makeFile([makeHunk(changes)], { path: 'dist/bundle.js.map' });
    const blocks = segmentBlocks(file);
    expect(blocks).toHaveLength(0);
  });

  it('block content contains unified diff fragment', () => {
    const changes: DiffChange[] = [
      { type: 'del', content: 'old', old_line: 5 },
      { type: 'add', content: 'new', new_line: 5 },
    ];
    const file = makeFile([makeHunk(changes)]);
    const blocks = segmentBlocks(file);

    expect(blocks[0].content).toContain('-old');
    expect(blocks[0].content).toContain('+new');
  });
});

describe('isGeneratedFile', () => {
  it('returns true for package-lock.json', () => {
    expect(isGeneratedFile('package-lock.json')).toBe(true);
  });

  it('returns true for yarn.lock', () => {
    expect(isGeneratedFile('yarn.lock')).toBe(true);
  });

  it('returns true for pnpm-lock.yaml', () => {
    expect(isGeneratedFile('pnpm-lock.yaml')).toBe(true);
  });

  it('returns true for go.sum', () => {
    expect(isGeneratedFile('go.sum')).toBe(true);
  });

  it('returns true for Cargo.lock', () => {
    expect(isGeneratedFile('Cargo.lock')).toBe(true);
  });

  it('returns true for poetry.lock', () => {
    expect(isGeneratedFile('poetry.lock')).toBe(true);
  });

  it('returns true for Gemfile.lock', () => {
    expect(isGeneratedFile('Gemfile.lock')).toBe(true);
  });

  it('returns true for composer.lock', () => {
    expect(isGeneratedFile('composer.lock')).toBe(true);
  });

  it('returns true for *.min.js files', () => {
    expect(isGeneratedFile('dist/app.min.js')).toBe(true);
  });

  it('returns true for *.min.css files', () => {
    expect(isGeneratedFile('public/styles.min.css')).toBe(true);
  });

  it('returns true for *.map files', () => {
    expect(isGeneratedFile('dist/app.js.map')).toBe(true);
  });

  it('returns true for *.generated.* files', () => {
    expect(isGeneratedFile('src/api.generated.ts')).toBe(true);
  });

  it('returns false for normal source files', () => {
    expect(isGeneratedFile('src/auth/login.ts')).toBe(false);
    expect(isGeneratedFile('package.json')).toBe(false);
    expect(isGeneratedFile('README.md')).toBe(false);
  });
});
