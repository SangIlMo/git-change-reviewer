import { describe, it, expect, vi } from 'vitest';
import type { ChangeBlock, ContextSource } from '../../../src/types.js';

function makeConfigBlock(overrides: Partial<ChangeBlock> = {}): ChangeBlock {
  return {
    file_path: 'config/app.yaml',
    start_line: 5,
    end_line: 10,
    content: '-  pool_size: 5\n+  pool_size: 10\n+  idle_timeout_seconds: 600',
    block_type: 'modification',
    changes: [
      { type: 'del', content: '  pool_size: 5', old_line: 5 },
      { type: 'add', content: '  pool_size: 10', new_line: 5 },
      { type: 'add', content: '  idle_timeout_seconds: 600', new_line: 6 },
    ],
    ...overrides,
  };
}

function makeJsonBlock(overrides: Partial<ChangeBlock> = {}): ChangeBlock {
  return {
    file_path: 'config/features.json',
    start_line: 3,
    end_line: 8,
    content: '-    "new_dashboard": false,\n+    "new_dashboard": true,',
    block_type: 'modification',
    changes: [
      { type: 'del', content: '    "new_dashboard": false,', old_line: 3 },
      { type: 'add', content: '    "new_dashboard": true,', new_line: 3 },
    ],
    ...overrides,
  };
}

function makeTomlBlock(overrides: Partial<ChangeBlock> = {}): ChangeBlock {
  return {
    file_path: 'Cargo.toml',
    start_line: 7,
    end_line: 12,
    content: '-tokio = { version = "1", features = ["full"] }\n+tokio = { version = "1.35", features = ["full"] }\n+axum = "0.7"',
    block_type: 'modification',
    changes: [
      { type: 'del', content: 'tokio = { version = "1", features = ["full"] }', old_line: 7 },
      { type: 'add', content: 'tokio = { version = "1.35", features = ["full"] }', new_line: 7 },
      { type: 'add', content: 'axum = "0.7"', new_line: 8 },
    ],
    ...overrides,
  };
}

function makeEnvBlock(overrides: Partial<ChangeBlock> = {}): ChangeBlock {
  return {
    file_path: '.env.example',
    start_line: 4,
    end_line: 7,
    content: '-PORT=3000\n+PORT=8080\n+LOG_LEVEL=info\n+LOG_FORMAT=json',
    block_type: 'modification',
    changes: [
      { type: 'del', content: 'PORT=3000', old_line: 4 },
      { type: 'add', content: 'PORT=8080', new_line: 4 },
      { type: 'add', content: 'LOG_LEVEL=info', new_line: 5 },
      { type: 'add', content: 'LOG_FORMAT=json', new_line: 6 },
    ],
    ...overrides,
  };
}

function makeMockClient(responseBody: string, confidence: 'high' | 'medium' | 'low' = 'medium') {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          body: responseBody,
          confidence,
          context_references: [],
        }),
      },
    ],
  });
  return { client: { messages: { create: mockCreate } } as never, mockCreate };
}

describe('annotateBlock — non-code (config) files', () => {
  it('produces a valid IntentAnnotation for a YAML config block', async () => {
    const { client, mockCreate } = makeMockClient(
      'Increases database connection pool size to handle higher traffic load and adds idle timeout.',
      'medium',
    );
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeConfigBlock();
    const result = await annotateBlock(block, [], client);

    expect(result.change_block).toBe(block);
    expect(typeof result.body).toBe('string');
    expect(result.body.length).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(result.confidence);
    expect(result.source_type).toBe('inferred');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('produces a valid IntentAnnotation for a JSON config block', async () => {
    const { client, mockCreate } = makeMockClient(
      'Enables the new dashboard feature flag for all users.',
      'high',
    );
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeJsonBlock();
    const context: ContextSource[] = [
      { type: 'pr_description', content: 'Enable new dashboard for production rollout.' },
    ];
    const result = await annotateBlock(block, context, client);

    expect(result.change_block).toBe(block);
    expect(result.source_type).toBe('context');
    expect(result.confidence).toBe('high');
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it('produces a valid IntentAnnotation for a TOML config block', async () => {
    const { client } = makeMockClient(
      'Pins tokio to an exact minor version and adds axum web framework dependency.',
      'medium',
    );
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeTomlBlock();
    const result = await annotateBlock(block, [], client);

    expect(result.change_block).toBe(block);
    expect(typeof result.body).toBe('string');
    expect(result.body.length).toBeGreaterThan(0);
  });

  it('produces a valid IntentAnnotation for a .env config block', async () => {
    const { client } = makeMockClient(
      'Updates default port and adds structured logging configuration.',
      'low',
    );
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeEnvBlock();
    const result = await annotateBlock(block, [], client);

    expect(result.change_block).toBe(block);
    expect(result.confidence).toBe('low');
    expect(result.source_type).toBe('inferred');
  });

  it('prompt includes file path for YAML config block', async () => {
    const { client, mockCreate } = makeMockClient('Some config change explanation.');
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeConfigBlock();
    await annotateBlock(block, [], client);

    const callArgs = mockCreate.mock.calls[0][0];
    const prompt: string = callArgs.messages[0].content;
    expect(prompt).toContain('config/app.yaml');
  });

  it('prompt includes file path for JSON config block', async () => {
    const { client, mockCreate } = makeMockClient('Feature flag change.');
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeJsonBlock();
    await annotateBlock(block, [], client);

    const callArgs = mockCreate.mock.calls[0][0];
    const prompt: string = callArgs.messages[0].content;
    expect(prompt).toContain('config/features.json');
  });

  it('prompt includes file path for TOML block', async () => {
    const { client, mockCreate } = makeMockClient('Dependency version update.');
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeTomlBlock();
    await annotateBlock(block, [], client);

    const callArgs = mockCreate.mock.calls[0][0];
    const prompt: string = callArgs.messages[0].content;
    expect(prompt).toContain('Cargo.toml');
  });

  it('prompt includes diff content for config files', async () => {
    const { client, mockCreate } = makeMockClient('Pool size increase.');
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeConfigBlock();
    await annotateBlock(block, [], client);

    const callArgs = mockCreate.mock.calls[0][0];
    const prompt: string = callArgs.messages[0].content;
    // Verify the diff content is included in prompt
    expect(prompt).toContain('pool_size');
  });

  it('prompt includes context sources when provided for config files', async () => {
    const { client, mockCreate } = makeMockClient('Config change based on context.');
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeConfigBlock();
    const context: ContextSource[] = [
      { type: 'commit_message', content: 'perf: increase db pool for load test' },
    ];
    await annotateBlock(block, context, client);

    const callArgs = mockCreate.mock.calls[0][0];
    const prompt: string = callArgs.messages[0].content;
    expect(prompt).toContain('perf: increase db pool for load test');
    expect(prompt).toContain('commit_message');
  });

  it('config annotations have same structural quality as code annotations', async () => {
    const { client } = makeMockClient(
      'Enables new dashboard feature flag for 100% rollout to all users, indicating the feature is ready for production.',
      'high',
    );
    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const blocks = [makeConfigBlock(), makeJsonBlock(), makeTomlBlock(), makeEnvBlock()];

    for (const block of blocks) {
      const result = await annotateBlock(block, [], client);
      expect(result.change_block).toBeDefined();
      expect(typeof result.body).toBe('string');
      expect(result.body.length).toBeGreaterThan(0);
      expect(['high', 'medium', 'low']).toContain(result.confidence);
      expect(['context', 'inferred']).toContain(result.source_type);
      expect(Array.isArray(result.context_references)).toBe(true);
    }
  });
});
