import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { parseDiff } from '../../../src/diff/parser.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('parseDiff', () => {
  it('parses single-file.diff → 1 DiffFile with correct path, status, hunks', () => {
    const content = readFixture('single-file.diff');
    const files = parseDiff(content);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('src/utils/logger.ts');
    expect(files[0].status).toBe('modified');
    expect(files[0].hunks).toHaveLength(1);
    expect(files[0].hunks[0].changes.length).toBeGreaterThan(0);
  });

  it('parses multi-file.diff → 3 DiffFiles', () => {
    const content = readFixture('multi-file.diff');
    const files = parseDiff(content);

    expect(files).toHaveLength(3);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('src/auth/middleware.ts');
    expect(paths).toContain('src/routes/users.ts');
    expect(paths).toContain('src/services/user.ts');
  });

  it('parses multi-file.diff → new file has status added', () => {
    const content = readFixture('multi-file.diff');
    const files = parseDiff(content);
    const userService = files.find((f) => f.path === 'src/services/user.ts');
    expect(userService).toBeDefined();
    expect(userService!.status).toBe('added');
  });

  it('parses delete.diff → DiffFile with status deleted', () => {
    const content = readFixture('delete.diff');
    const files = parseDiff(content);

    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('src/legacy/xmlParser.ts');
    expect(files[0].status).toBe('deleted');
  });

  it('parses binary.diff → DiffFiles with binary flag and empty hunks', () => {
    const content = readFixture('binary.diff');
    const files = parseDiff(content);

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file.binary).toBe(true);
      expect(file.hunks).toHaveLength(0);
    }
  });

  it('handles empty diff input → returns empty array', () => {
    expect(parseDiff('')).toEqual([]);
    expect(parseDiff('   ')).toEqual([]);
  });

  it('parses hunk changes with correct add/del/normal types', () => {
    const content = readFixture('single-file.diff');
    const files = parseDiff(content);
    const hunk = files[0].hunks[0];

    const adds = hunk.changes.filter((c) => c.type === 'add');
    const dels = hunk.changes.filter((c) => c.type === 'del');

    expect(adds.length).toBeGreaterThan(0);
    expect(dels.length).toBeGreaterThan(0);
  });
});
