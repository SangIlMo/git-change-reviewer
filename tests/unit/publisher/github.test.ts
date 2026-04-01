import { describe, it, expect, vi } from 'vitest';
import type { ReviewPayload } from '../../../src/types.js';

const makePayload = (commentCount = 3): ReviewPayload => ({
  pr_number: 42,
  repo: 'owner/repo',
  commit_sha: 'abc123def456',
  comments: Array.from({ length: commentCount }, (_, i) => ({
    path: `src/file${i}.ts`,
    line: 10 + i,
    side: 'RIGHT' as const,
    body: `> **Intent**: Change ${i}`,
  })),
});

describe('buildReviewComments', () => {
  it('builds correct comment structure from ReviewPayload', async () => {
    const { buildReviewComments } = await import('../../../src/publisher/github.js');
    const payload = makePayload(2);
    const comments = buildReviewComments(payload);

    expect(comments).toHaveLength(2);
    expect(comments[0]).toMatchObject({
      path: 'src/file0.ts',
      line: 10,
      side: 'RIGHT',
      body: '> **Intent**: Change 0',
    });
  });

  it('omits start_line when equal to line', async () => {
    const { buildReviewComments } = await import('../../../src/publisher/github.js');
    const payload: ReviewPayload = {
      pr_number: 1,
      repo: 'owner/repo',
      commit_sha: 'sha',
      comments: [{ path: 'f.ts', line: 5, side: 'RIGHT', body: 'body' }],
    };
    const comments = buildReviewComments(payload);
    expect(comments[0].start_line).toBeUndefined();
  });

  it('includes start_line when different from line', async () => {
    const { buildReviewComments } = await import('../../../src/publisher/github.js');
    const payload: ReviewPayload = {
      pr_number: 1,
      repo: 'owner/repo',
      commit_sha: 'sha',
      comments: [{ path: 'f.ts', line: 10, start_line: 5, side: 'RIGHT', body: 'body' }],
    };
    const comments = buildReviewComments(payload);
    expect(comments[0].start_line).toBe(5);
  });
});

describe('publishReview', () => {
  it('calls octokit createReview with correct parameters', async () => {
    const mockCreateReview = vi.fn().mockResolvedValue({ data: { id: 1 } });
    const mockOctokit = {
      pulls: { createReview: mockCreateReview },
    } as never;

    const { publishReview } = await import('../../../src/publisher/github.js');
    const payload = makePayload(2);

    await publishReview(payload, 'token123', mockOctokit);

    expect(mockCreateReview).toHaveBeenCalledOnce();
    const callArgs = mockCreateReview.mock.calls[0][0];
    expect(callArgs.owner).toBe('owner');
    expect(callArgs.repo).toBe('repo');
    expect(callArgs.pull_number).toBe(42);
    expect(callArgs.commit_id).toBe('abc123def456');
    expect(callArgs.event).toBe('COMMENT');
    expect(Array.isArray(callArgs.comments)).toBe(true);
  });

  it('splits into multiple reviews when comments exceed 100', async () => {
    const mockCreateReview = vi.fn().mockResolvedValue({ data: { id: 1 } });
    const mockOctokit = {
      pulls: { createReview: mockCreateReview },
    } as never;

    const { publishReview } = await import('../../../src/publisher/github.js');
    const payload = makePayload(150);

    await publishReview(payload, 'token123', mockOctokit);

    expect(mockCreateReview).toHaveBeenCalledTimes(2);
  });

  it('throws with proper error code on 401 API error', async () => {
    const mockCreateReview = vi.fn().mockRejectedValue(
      Object.assign(new Error('Bad credentials'), { status: 401 }),
    );
    const mockOctokit = {
      pulls: { createReview: mockCreateReview },
    } as never;

    const { publishReview } = await import('../../../src/publisher/github.js');
    const payload = makePayload(1);

    await expect(publishReview(payload, 'bad-token', mockOctokit)).rejects.toMatchObject({
      code: 2,
    });
  });

  it('throws with proper error code on 404 API error', async () => {
    const mockCreateReview = vi.fn().mockRejectedValue(
      Object.assign(new Error('Not found'), { status: 404 }),
    );
    const mockOctokit = {
      pulls: { createReview: mockCreateReview },
    } as never;

    const { publishReview } = await import('../../../src/publisher/github.js');
    const payload = makePayload(1);

    await expect(publishReview(payload, 'token', mockOctokit)).rejects.toMatchObject({
      code: 3,
    });
  });

  it('throws with proper error code on 429 rate limit error', async () => {
    // Use real timers but override the internal sleep via the module's exported sleepFn
    // Instead, we simply verify that after exhausting retries, the error code is 4.
    // We mock createReview to always throw 429, then use fake timers to skip waits.
    const originalSetTimeout = globalThis.setTimeout;
    // Patch setTimeout globally to resolve immediately during this test
    globalThis.setTimeout = ((fn: () => void, _delay?: number) => {
      return originalSetTimeout(fn, 0);
    }) as typeof globalThis.setTimeout;

    try {
      const mockCreateReview = vi.fn().mockRejectedValue(
        Object.assign(new Error('Rate limited'), { status: 429 }),
      );
      const mockOctokit = {
        pulls: { createReview: mockCreateReview },
      } as never;

      const { publishReview } = await import('../../../src/publisher/github.js');
      const payload = makePayload(1);

      await expect(publishReview(payload, 'token', mockOctokit)).rejects.toMatchObject({
        code: 4,
      });
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
  });
});

describe('fetchPRDiff', () => {
  it('calls octokit with diff accept header and returns diff string', async () => {
    const mockRequest = vi.fn().mockResolvedValue({ data: 'diff --git a/f.ts b/f.ts\n' });
    const mockOctokit = { request: mockRequest } as never;

    const { fetchPRDiff } = await import('../../../src/publisher/github.js');
    const result = await fetchPRDiff('owner/repo', 42, 'token', mockOctokit);

    expect(result).toBe('diff --git a/f.ts b/f.ts\n');
    expect(mockRequest).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      expect.objectContaining({
        owner: 'owner',
        repo: 'repo',
        pull_number: 42,
        headers: expect.objectContaining({
          accept: 'application/vnd.github.v3.diff',
        }),
      }),
    );
  });
});

describe('fetchPRDetails', () => {
  it('returns description and commit messages', async () => {
    const mockGetPR = vi.fn().mockResolvedValue({
      data: { body: 'PR description here' },
    });
    const mockListCommits = vi.fn().mockResolvedValue({
      data: [
        { commit: { message: 'feat: add feature' } },
        { commit: { message: 'fix: fix bug' } },
      ],
    });
    const mockOctokit = {
      pulls: { get: mockGetPR, listCommits: mockListCommits },
    } as never;

    const { fetchPRDetails } = await import('../../../src/publisher/github.js');
    const result = await fetchPRDetails('owner/repo', 42, 'token', mockOctokit);

    expect(result.description).toBe('PR description here');
    expect(result.commitMessages).toEqual(['feat: add feature', 'fix: fix bug']);
  });
});
