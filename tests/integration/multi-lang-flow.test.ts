import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, '../fixtures/multi-lang');

function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf-8');
}

describe('multi-language end-to-end flow', () => {
  it('annotates >90% of change blocks from typescript-python-yaml.diff', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Refactors the implementation to improve reliability and maintainability.',
            confidence: 'medium',
            context_references: [],
          }),
        },
      ],
    });
    const mockAIClient = { messages: { create: mockCreate } } as never;

    const { parseDiff } = await import('../../src/diff/parser.js');
    const { segmentBlocks } = await import('../../src/diff/segmenter.js');
    const { extractContext } = await import('../../src/context/extractor.js');
    const { annotateBlock } = await import('../../src/annotator/annotator.js');
    const { formatAnnotation } = await import('../../src/annotator/formatter.js');

    const diffContent = readFixture('typescript-python-yaml.diff');
    const files = parseDiff(diffContent);

    // Verify all three languages are present
    expect(files).toHaveLength(3);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('src/services/payment.ts');
    expect(paths).toContain('scripts/sync_products.py');
    expect(paths).toContain('config/app.yaml');

    const context = extractContext({
      commitMessages: ['feat: add idempotency support to payment service and batch product sync'],
      prDescription: 'Improves payment reliability with idempotency keys and adds batching to product sync.',
    });
    expect(context.length).toBeGreaterThan(0);

    const allBlocks = files.flatMap((f) => segmentBlocks(f));
    expect(allBlocks.length).toBeGreaterThan(0);

    // Annotate all blocks
    const annotations = await Promise.all(
      allBlocks.map((block) => annotateBlock(block, context, mockAIClient)),
    );

    // >90% annotated — all must succeed
    const successRate = annotations.length / allBlocks.length;
    expect(successRate).toBeGreaterThanOrEqual(0.9);
    expect(annotations.length).toBe(allBlocks.length);

    // Verify each annotation has content
    for (const ann of annotations) {
      expect(ann.change_block).toBeDefined();
      expect(typeof ann.body).toBe('string');
      expect(ann.body.length).toBeGreaterThan(0);
      expect(['context', 'inferred']).toContain(ann.source_type);
      expect(['high', 'medium', 'low']).toContain(ann.confidence);
      expect(Array.isArray(ann.context_references)).toBe(true);
    }

    // Annotations cover all three languages
    const annotatedPaths = new Set(annotations.map((a) => a.change_block.file_path));
    expect(annotatedPaths.has('src/services/payment.ts')).toBe(true);
    expect(annotatedPaths.has('scripts/sync_products.py')).toBe(true);
    expect(annotatedPaths.has('config/app.yaml')).toBe(true);

    // Format annotations
    const formatted = annotations.map((ann) => formatAnnotation(ann));
    for (const f of formatted) {
      expect(f).toContain('**Intent');
      expect(f.startsWith('>')).toBe(true);
    }

    // Mock was called for each block
    expect(mockCreate).toHaveBeenCalledTimes(allBlocks.length);
  });

  it('annotates >90% of change blocks from rust-go-json.diff', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Updates the implementation to add generic type support and proper error handling.',
            confidence: 'medium',
            context_references: [],
          }),
        },
      ],
    });
    const mockAIClient = { messages: { create: mockCreate } } as never;

    const { parseDiff } = await import('../../src/diff/parser.js');
    const { segmentBlocks } = await import('../../src/diff/segmenter.js');
    const { extractContext } = await import('../../src/context/extractor.js');
    const { annotateBlock } = await import('../../src/annotator/annotator.js');

    const diffContent = readFixture('rust-go-json.diff');
    const files = parseDiff(diffContent);

    expect(files).toHaveLength(3);

    const context = extractContext({
      commitMessages: ['feat: make LRU cache generic and add request context to Go handler'],
    });

    const allBlocks = files.flatMap((f) => segmentBlocks(f));
    expect(allBlocks.length).toBeGreaterThan(0);

    const annotations = await Promise.all(
      allBlocks.map((block) => annotateBlock(block, context, mockAIClient)),
    );

    const successRate = annotations.length / allBlocks.length;
    expect(successRate).toBeGreaterThanOrEqual(0.9);

    // All annotations should have non-empty bodies
    for (const ann of annotations) {
      expect(ann.body.length).toBeGreaterThan(0);
    }

    expect(mockCreate).toHaveBeenCalledTimes(allBlocks.length);
  });

  it('annotates >90% of change blocks from config-only.diff', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Updates configuration values to improve performance and add new service integrations.',
            confidence: 'medium',
            context_references: [],
          }),
        },
      ],
    });
    const mockAIClient = { messages: { create: mockCreate } } as never;

    const { parseDiff } = await import('../../src/diff/parser.js');
    const { segmentBlocks } = await import('../../src/diff/segmenter.js');
    const { extractContext } = await import('../../src/context/extractor.js');
    const { annotateBlock } = await import('../../src/annotator/annotator.js');

    const diffContent = readFixture('config-only.diff');
    const files = parseDiff(diffContent);

    expect(files).toHaveLength(4);
    const paths = files.map((f) => f.path);
    expect(paths).toContain('config/database.yaml');
    expect(paths).toContain('config/features.json');
    expect(paths).toContain('Cargo.toml');
    expect(paths).toContain('.env.example');

    const context = extractContext({
      commitMessages: ['chore: update config for production deployment'],
      prDescription: 'Increases DB pool size, enables feature flags, and adds Stripe/Redis config.',
    });

    const allBlocks = files.flatMap((f) => segmentBlocks(f));
    expect(allBlocks.length).toBeGreaterThan(0);

    const annotations = await Promise.all(
      allBlocks.map((block) => annotateBlock(block, context, mockAIClient)),
    );

    // >90% annotation coverage
    const successRate = annotations.length / allBlocks.length;
    expect(successRate).toBeGreaterThanOrEqual(0.9);
    expect(annotations.length).toBe(allBlocks.length);

    // Config files get properly annotated
    const configAnnotations = annotations.filter((a) =>
      a.change_block.file_path.endsWith('.yaml') ||
      a.change_block.file_path.endsWith('.json') ||
      a.change_block.file_path.endsWith('.toml') ||
      a.change_block.file_path.endsWith('.example'),
    );
    expect(configAnnotations.length).toBe(allBlocks.length);

    // All config annotations have valid structure
    for (const ann of configAnnotations) {
      expect(ann.change_block).toBeDefined();
      expect(typeof ann.body).toBe('string');
      expect(ann.body.length).toBeGreaterThan(0);
      expect(['context', 'inferred']).toContain(ann.source_type);
      expect(['high', 'medium', 'low']).toContain(ann.confidence);
    }

    // Build ReviewPayload
    const { buildReviewComments } = await import('../../src/publisher/github.js');
    const { formatAnnotation } = await import('../../src/annotator/formatter.js');

    const comments = annotations.map((ann) => ({
      path: ann.change_block.file_path,
      line: ann.change_block.end_line,
      start_line:
        ann.change_block.start_line !== ann.change_block.end_line
          ? ann.change_block.start_line
          : undefined,
      side: 'RIGHT' as const,
      body: formatAnnotation(ann),
    }));

    const payload = {
      pr_number: 99,
      repo: 'owner/config-repo',
      commit_sha: 'cfg123',
      comments,
    };

    const reviewComments = buildReviewComments(payload);
    expect(reviewComments.length).toBe(annotations.length);
    for (const c of reviewComments) {
      expect(c.path).toBeTruthy();
      expect(c.line).toBeGreaterThan(0);
      expect(c.side).toBe('RIGHT');
      expect(c.body).toContain('**Intent');
    }

    expect(mockCreate).toHaveBeenCalledTimes(allBlocks.length);
  });
});
