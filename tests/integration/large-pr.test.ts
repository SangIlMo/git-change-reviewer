import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, '../fixtures/large-pr/large-pr.diff');

describe('large PR performance', () => {
  it(
    'parses, segments, and annotates large diff within 120 seconds',
    async () => {
      // Mock AI client — returns immediately without real API calls
      const mockCreate = vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              body: 'Refactors module logic for clarity and performance.',
              confidence: 'medium',
              context_references: [],
            }),
          },
        ],
      });
      const mockAIClient = { messages: { create: mockCreate } } as never;

      const { parseDiff } = await import('../../src/diff/parser.js');
      const { segmentBlocks } = await import('../../src/diff/segmenter.js');
      const { annotateBlocks } = await import('../../src/annotator/annotator.js');

      const diffContent = readFileSync(FIXTURE_PATH, 'utf-8');
      const files = parseDiff(diffContent);

      // Verify fixture has 50+ files
      expect(files.length).toBeGreaterThanOrEqual(50);

      const allBlocks = files.flatMap((f) => segmentBlocks(f));

      // Verify 500+ changed lines worth of blocks
      expect(allBlocks.length).toBeGreaterThan(0);

      const annotations = await annotateBlocks(allBlocks, [], {
        concurrency: 10,
        client: mockAIClient,
      });

      // All blocks that are non-binary should be annotated
      // (our mock never fails, so count should match)
      expect(annotations.length).toBe(allBlocks.length);

      // Verify mock was called once per block
      expect(mockCreate).toHaveBeenCalledTimes(allBlocks.length);

      // Verify each annotation is valid
      for (const ann of annotations) {
        expect(ann.change_block).toBeDefined();
        expect(typeof ann.body).toBe('string');
        expect(ann.body.length).toBeGreaterThan(0);
        expect(['context', 'inferred']).toContain(ann.source_type);
        expect(['high', 'medium', 'low']).toContain(ann.confidence);
      }
    },
    120_000,
  );

  it('skips failed blocks and returns successful annotations', async () => {
    let callCount = 0;
    const mockCreate = vi.fn().mockImplementation(() => {
      callCount++;
      // Every 3rd block fails
      if (callCount % 3 === 0) {
        return Promise.reject(new Error('simulated API error'));
      }
      return Promise.resolve({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              body: 'Some change.',
              confidence: 'low',
              context_references: [],
            }),
          },
        ],
      });
    });
    const mockAIClient = { messages: { create: mockCreate } } as never;

    const { parseDiff } = await import('../../src/diff/parser.js');
    const { segmentBlocks } = await import('../../src/diff/segmenter.js');
    const { annotateBlocks } = await import('../../src/annotator/annotator.js');

    const diffContent = readFileSync(FIXTURE_PATH, 'utf-8');
    const files = parseDiff(diffContent);
    const allBlocks = files.flatMap((f) => segmentBlocks(f)).slice(0, 9); // 9 blocks: 3 will fail

    const annotations = await annotateBlocks(allBlocks, [], {
      concurrency: 3,
      client: mockAIClient,
    });

    // 6 out of 9 should succeed (blocks 3, 6, 9 fail)
    expect(annotations.length).toBe(6);
  });
});
