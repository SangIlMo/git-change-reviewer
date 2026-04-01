import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { parseDiff } from '../../../src/diff/parser.js';
import { segmentBlocks } from '../../../src/diff/segmenter.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/multi-lang');

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf-8');
}

describe('parseDiff — multi-language fixtures', () => {
  describe('typescript-python-yaml.diff', () => {
    it('produces a DiffFile for each language (TS, Python, YAML)', () => {
      const content = readFixture('typescript-python-yaml.diff');
      const files = parseDiff(content);

      expect(files).toHaveLength(3);
      const paths = files.map((f) => f.path);
      expect(paths).toContain('src/services/payment.ts');
      expect(paths).toContain('scripts/sync_products.py');
      expect(paths).toContain('config/app.yaml');
    });

    it('TypeScript file has modified status and non-empty hunks', () => {
      const files = parseDiff(readFixture('typescript-python-yaml.diff'));
      const tsFile = files.find((f) => f.path === 'src/services/payment.ts');
      expect(tsFile).toBeDefined();
      expect(tsFile!.status).toBe('modified');
      expect(tsFile!.hunks.length).toBeGreaterThan(0);
      expect(tsFile!.hunks[0].changes.length).toBeGreaterThan(0);
    });

    it('Python file has add and del changes', () => {
      const files = parseDiff(readFixture('typescript-python-yaml.diff'));
      const pyFile = files.find((f) => f.path === 'scripts/sync_products.py');
      expect(pyFile).toBeDefined();
      const allChanges = pyFile!.hunks.flatMap((h) => h.changes);
      expect(allChanges.some((c) => c.type === 'add')).toBe(true);
      expect(allChanges.some((c) => c.type === 'del')).toBe(true);
    });

    it('YAML config file produces a DiffFile with hunks', () => {
      const files = parseDiff(readFixture('typescript-python-yaml.diff'));
      const yamlFile = files.find((f) => f.path === 'config/app.yaml');
      expect(yamlFile).toBeDefined();
      expect(yamlFile!.hunks.length).toBeGreaterThan(0);
    });
  });

  describe('rust-go-json.diff', () => {
    it('produces a DiffFile for each language (Rust, Go, JSON)', () => {
      const content = readFixture('rust-go-json.diff');
      const files = parseDiff(content);

      expect(files).toHaveLength(3);
      const paths = files.map((f) => f.path);
      expect(paths).toContain('src/cache/lru.rs');
      expect(paths).toContain('handlers/user_handler.go');
      expect(paths).toContain('schemas/user.schema.json');
    });

    it('Rust file has modified status and changes', () => {
      const files = parseDiff(readFixture('rust-go-json.diff'));
      const rsFile = files.find((f) => f.path === 'src/cache/lru.rs');
      expect(rsFile).toBeDefined();
      expect(rsFile!.status).toBe('modified');
      const allChanges = rsFile!.hunks.flatMap((h) => h.changes);
      expect(allChanges.length).toBeGreaterThan(0);
    });

    it('Go file has both add and del changes', () => {
      const files = parseDiff(readFixture('rust-go-json.diff'));
      const goFile = files.find((f) => f.path === 'handlers/user_handler.go');
      expect(goFile).toBeDefined();
      const allChanges = goFile!.hunks.flatMap((h) => h.changes);
      expect(allChanges.some((c) => c.type === 'add')).toBe(true);
      expect(allChanges.some((c) => c.type === 'del')).toBe(true);
    });

    it('JSON schema file produces DiffFile with hunks', () => {
      const files = parseDiff(readFixture('rust-go-json.diff'));
      const jsonFile = files.find((f) => f.path === 'schemas/user.schema.json');
      expect(jsonFile).toBeDefined();
      expect(jsonFile!.hunks.length).toBeGreaterThan(0);
    });
  });

  describe('config-only.diff', () => {
    it('produces DiffFiles for YAML, JSON, TOML, and .env files', () => {
      const content = readFixture('config-only.diff');
      const files = parseDiff(content);

      expect(files).toHaveLength(4);
      const paths = files.map((f) => f.path);
      expect(paths).toContain('config/database.yaml');
      expect(paths).toContain('config/features.json');
      expect(paths).toContain('Cargo.toml');
      expect(paths).toContain('.env.example');
    });

    it('all config files have non-empty hunks', () => {
      const files = parseDiff(readFixture('config-only.diff'));
      for (const file of files) {
        expect(file.hunks.length).toBeGreaterThan(0);
        expect(file.hunks[0].changes.length).toBeGreaterThan(0);
      }
    });

    it('YAML file changes are correctly typed', () => {
      const files = parseDiff(readFixture('config-only.diff'));
      const yamlFile = files.find((f) => f.path === 'config/database.yaml');
      expect(yamlFile).toBeDefined();
      const allChanges = yamlFile!.hunks.flatMap((h) => h.changes);
      expect(allChanges.some((c) => c.type === 'add')).toBe(true);
      expect(allChanges.some((c) => c.type === 'del')).toBe(true);
    });

    it('JSON feature flags file parses correctly', () => {
      const files = parseDiff(readFixture('config-only.diff'));
      const jsonFile = files.find((f) => f.path === 'config/features.json');
      expect(jsonFile).toBeDefined();
      const addedLines = jsonFile!.hunks.flatMap((h) => h.changes).filter((c) => c.type === 'add');
      expect(addedLines.length).toBeGreaterThan(0);
    });
  });
});

describe('segmentBlocks — multi-language fixtures', () => {
  describe('typescript-python-yaml.diff', () => {
    it('produces ChangeBlocks for TypeScript file', () => {
      const files = parseDiff(readFixture('typescript-python-yaml.diff'));
      const tsFile = files.find((f) => f.path === 'src/services/payment.ts')!;
      const blocks = segmentBlocks(tsFile);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('produces ChangeBlocks for Python file', () => {
      const files = parseDiff(readFixture('typescript-python-yaml.diff'));
      const pyFile = files.find((f) => f.path === 'scripts/sync_products.py')!;
      const blocks = segmentBlocks(pyFile);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('produces ChangeBlocks for YAML config file', () => {
      const files = parseDiff(readFixture('typescript-python-yaml.diff'));
      const yamlFile = files.find((f) => f.path === 'config/app.yaml')!;
      const blocks = segmentBlocks(yamlFile);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('each ChangeBlock has valid line numbers', () => {
      const files = parseDiff(readFixture('typescript-python-yaml.diff'));
      for (const file of files) {
        const blocks = segmentBlocks(file);
        for (const block of blocks) {
          expect(block.start_line).toBeGreaterThan(0);
          expect(block.end_line).toBeGreaterThanOrEqual(block.start_line);
        }
      }
    });
  });

  describe('config-only.diff — config file segmentation', () => {
    it('YAML database config produces ChangeBlocks with meaningful content', () => {
      const files = parseDiff(readFixture('config-only.diff'));
      const yamlFile = files.find((f) => f.path === 'config/database.yaml')!;
      const blocks = segmentBlocks(yamlFile);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block.content.length).toBeGreaterThan(0);
        expect(block.file_path).toBe('config/database.yaml');
      }
    });

    it('JSON features config produces ChangeBlocks with content', () => {
      const files = parseDiff(readFixture('config-only.diff'));
      const jsonFile = files.find((f) => f.path === 'config/features.json')!;
      const blocks = segmentBlocks(jsonFile);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block.content.length).toBeGreaterThan(0);
      }
    });

    it('TOML Cargo.toml produces ChangeBlocks', () => {
      const files = parseDiff(readFixture('config-only.diff'));
      const tomlFile = files.find((f) => f.path === 'Cargo.toml')!;
      const blocks = segmentBlocks(tomlFile);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('.env file produces ChangeBlocks', () => {
      const files = parseDiff(readFixture('config-only.diff'));
      const envFile = files.find((f) => f.path === '.env.example')!;
      const blocks = segmentBlocks(envFile);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('all config ChangeBlocks have correct block_type', () => {
      const files = parseDiff(readFixture('config-only.diff'));
      for (const file of files) {
        const blocks = segmentBlocks(file);
        for (const block of blocks) {
          expect(['addition', 'deletion', 'modification']).toContain(block.block_type);
        }
      }
    });
  });

  describe('rust-go-json.diff', () => {
    it('Rust LRU cache changes produce ChangeBlocks', () => {
      const files = parseDiff(readFixture('rust-go-json.diff'));
      const rsFile = files.find((f) => f.path === 'src/cache/lru.rs')!;
      const blocks = segmentBlocks(rsFile);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('Go handler changes produce ChangeBlocks', () => {
      const files = parseDiff(readFixture('rust-go-json.diff'));
      const goFile = files.find((f) => f.path === 'handlers/user_handler.go')!;
      const blocks = segmentBlocks(goFile);
      expect(blocks.length).toBeGreaterThan(0);
    });

    it('JSON schema changes are segmented meaningfully', () => {
      const files = parseDiff(readFixture('rust-go-json.diff'));
      const jsonFile = files.find((f) => f.path === 'schemas/user.schema.json')!;
      const blocks = segmentBlocks(jsonFile);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block.content.length).toBeGreaterThan(0);
      }
    });
  });
});
