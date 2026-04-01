import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, '../fixtures/single-file.diff');

describe('end-to-end annotate flow', () => {
  it('produces valid ReviewPayload from fixture diff with mocked AI and GitHub', async () => {
    // Mock AI SDK
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Updates logger to include timestamps and JSON format for structured logging.',
            confidence: 'high',
            context_references: ['commit_message'],
          }),
        },
      ],
    });
    const mockAIClient = { messages: { create: mockCreate } } as never;

    // Import pipeline modules
    const { parseDiff } = await import('../../src/diff/parser.js');
    const { segmentBlocks } = await import('../../src/diff/segmenter.js');
    const { extractContext } = await import('../../src/context/extractor.js');
    const { annotateBlock } = await import('../../src/annotator/annotator.js');
    const { formatAnnotation } = await import('../../src/annotator/formatter.js');

    // Read fixture
    const diffContent = readFileSync(FIXTURE_PATH, 'utf-8');

    // Parse
    const files = parseDiff(diffContent);
    expect(files.length).toBeGreaterThan(0);

    // Extract context
    const context = extractContext({
      commitMessages: ['feat: update logger configuration with timestamps'],
      prDescription: 'Improves log output for better observability.',
    });
    expect(context.length).toBeGreaterThan(0);

    // Segment blocks
    const allBlocks = files.flatMap((f) => segmentBlocks(f));
    expect(allBlocks.length).toBeGreaterThan(0);

    // Annotate all blocks
    const annotations = await Promise.all(
      allBlocks.map((block) => annotateBlock(block, context, mockAIClient)),
    );
    expect(annotations.length).toBe(allBlocks.length);

    // Each annotation should be valid
    for (const ann of annotations) {
      expect(ann.change_block).toBeDefined();
      expect(typeof ann.body).toBe('string');
      expect(['context', 'inferred']).toContain(ann.source_type);
      expect(['high', 'medium', 'low']).toContain(ann.confidence);
      expect(Array.isArray(ann.context_references)).toBe(true);
    }

    // Format annotations
    const formatted = annotations.map((ann) => formatAnnotation(ann));
    for (const f of formatted) {
      expect(f).toContain('**Intent');
      expect(f.startsWith('>')).toBe(true);
    }

    // Build ReviewPayload
    const { buildReviewComments } = await import('../../src/publisher/github.js');
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
      pr_number: 42,
      repo: 'owner/repo',
      commit_sha: 'abc123',
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

    // Verify mock was called for each block
    expect(mockCreate).toHaveBeenCalledTimes(allBlocks.length);
  });
});
