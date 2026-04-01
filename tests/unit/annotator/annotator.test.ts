import { describe, it, expect, vi } from 'vitest';
import type { ChangeBlock, ContextSource } from '../../../src/types.js';

const makeBlock = (overrides: Partial<ChangeBlock> = {}): ChangeBlock => ({
  file_path: 'src/auth/login.ts',
  start_line: 10,
  end_line: 15,
  content: '+const token = user.token ?? null;',
  block_type: 'addition',
  changes: [{ type: 'add', content: 'const token = user.token ?? null;', new_line: 10 }],
  ...overrides,
});

const makeContextSources = (): ContextSource[] => [
  { type: 'commit_message', content: 'fix: handle null token from OAuth provider' },
  { type: 'pr_description', content: 'Adds null safety for the token field.' },
];

describe('annotateBlock', () => {
  it('returns IntentAnnotation given a ChangeBlock and ContextSource[]', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Adds null check before accessing user.token to prevent runtime errors.',
            confidence: 'high',
            context_references: ['commit_message', 'pr_description'],
          }),
        },
      ],
    });
    const mockClient = { messages: { create: mockCreate } } as never;

    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const block = makeBlock();
    const context = makeContextSources();

    const result = await annotateBlock(block, context, mockClient);

    expect(result.change_block).toBe(block);
    expect(typeof result.body).toBe('string');
    expect(result.body.length).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(result.confidence);
    expect(['context', 'inferred']).toContain(result.source_type);
    expect(Array.isArray(result.context_references)).toBe(true);
  });

  it('sets sourceType to context when context sources are present', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Adds null check.',
            confidence: 'high',
            context_references: ['commit_message'],
          }),
        },
      ],
    });
    const mockClient = { messages: { create: mockCreate } } as never;

    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const result = await annotateBlock(makeBlock(), makeContextSources(), mockClient);

    expect(result.source_type).toBe('context');
    expect(result.confidence).toBe('high');
  });

  it('sets sourceType to inferred when no context sources provided', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Extracts retry logic into helper.',
            confidence: 'medium',
            context_references: [],
          }),
        },
      ],
    });
    const mockClient = { messages: { create: mockCreate } } as never;

    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const result = await annotateBlock(makeBlock(), [], mockClient);

    expect(result.source_type).toBe('inferred');
    expect(result.confidence).toBe('medium');
  });

  it('sets sourceType to conflict and confidence to low when AI detects mismatch', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'The commit message states "fix: typo" but the code change appears to add a new authentication module.',
            confidence: 'high',
            context_references: ['commit_message'],
            conflict: true,
          }),
        },
      ],
    });
    const mockClient = { messages: { create: mockCreate } } as never;

    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    const result = await annotateBlock(makeBlock(), makeContextSources(), mockClient);

    expect(result.source_type).toBe('conflict');
    expect(result.confidence).toBe('low');
    expect(result.body).toContain('commit message');
  });

  it('includes conflict detection instruction in prompt when context is provided', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Adds null check.',
            confidence: 'high',
            context_references: ['commit_message'],
            conflict: false,
          }),
        },
      ],
    });
    const mockClient = { messages: { create: mockCreate } } as never;

    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    await annotateBlock(makeBlock(), makeContextSources(), mockClient);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain('conflict');
  });

  it('does not make real API calls when mock client is provided', async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            body: 'Test body.',
            confidence: 'high',
            context_references: [],
          }),
        },
      ],
    });
    const mockClient = { messages: { create: mockCreate } } as never;

    const { annotateBlock } = await import('../../../src/annotator/annotator.js');
    await annotateBlock(makeBlock(), makeContextSources(), mockClient);

    expect(mockCreate).toHaveBeenCalledOnce();
    // Verify prompt contains block content
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain('user.token');
  });
});
