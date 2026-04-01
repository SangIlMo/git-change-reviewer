import { Octokit } from '@octokit/rest';
import type { ReviewPayload, ReviewComment } from '../types.js';

const BATCH_SIZE = 100;
const MAX_RETRIES = 3;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  const e = err as { status?: number; response?: { headers?: Record<string, string> } };
  if (e.status === 429) return true;
  if (e.status === 403) {
    const headers = e.response?.headers ?? {};
    return 'x-ratelimit-remaining' in headers && headers['x-ratelimit-remaining'] === '0';
  }
  return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isRateLimitError(err) && attempt < MAX_RETRIES) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`[github] rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export class GitHubError extends Error {
  code: number;
  constructor(message: string, code: number) {
    super(message);
    this.code = code;
    this.name = 'GitHubError';
  }
}

function statusToCode(status: number): number {
  if (status === 401 || status === 403) return 2;
  if (status === 404) return 3;
  if (status === 429) return 4;
  return 1;
}

function handleOctokitError(err: unknown): never {
  const e = err as { status?: number; message?: string };
  const status = e.status ?? 0;
  const code = statusToCode(status);
  throw new GitHubError(e.message ?? 'GitHub API error', code);
}

export interface OctokitComment {
  path: string;
  line: number;
  start_line?: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
}

export function buildReviewComments(payload: ReviewPayload): OctokitComment[] {
  return payload.comments.map((c: ReviewComment): OctokitComment => {
    const comment: OctokitComment = {
      path: c.path,
      line: c.line,
      side: c.side,
      body: c.body,
    };
    if (c.start_line !== undefined && c.start_line !== c.line) {
      comment.start_line = c.start_line;
    }
    return comment;
  });
}

export async function publishReview(
  payload: ReviewPayload,
  token: string,
  octokit?: Pick<Octokit, 'pulls'>,
): Promise<void> {
  const client = octokit ?? new Octokit({ auth: token });
  const [owner, repo] = payload.repo.split('/');
  const comments = buildReviewComments(payload);

  // Split into batches of BATCH_SIZE
  for (let i = 0; i < comments.length; i += BATCH_SIZE) {
    const batch = comments.slice(i, i + BATCH_SIZE);
    try {
      await withRetry(() =>
        client.pulls.createReview({
          owner,
          repo,
          pull_number: payload.pr_number,
          commit_id: payload.commit_sha,
          event: 'COMMENT',
          comments: batch,
        }),
      );
    } catch (err) {
      handleOctokitError(err);
    }
  }
}

export async function fetchPRDiff(
  repoFullName: string,
  prNumber: number,
  token: string,
  octokit?: Pick<Octokit, 'request'>,
): Promise<string> {
  const client = octokit ?? new Octokit({ auth: token });
  const [owner, repo] = repoFullName.split('/');

  try {
    const response = await (client as Octokit).request(
      'GET /repos/{owner}/{repo}/pulls/{pull_number}',
      {
        owner,
        repo,
        pull_number: prNumber,
        headers: {
          accept: 'application/vnd.github.v3.diff',
        },
      },
    );
    return response.data as unknown as string;
  } catch (err) {
    handleOctokitError(err);
  }
}

export async function fetchPRDetails(
  repoFullName: string,
  prNumber: number,
  token: string,
  octokit?: Pick<Octokit, 'pulls'>,
): Promise<{ description: string; commitMessages: string[] }> {
  const client = octokit ?? new Octokit({ auth: token });
  const [owner, repo] = repoFullName.split('/');

  try {
    const [prResponse, commitsResponse] = await Promise.all([
      client.pulls.get({ owner, repo, pull_number: prNumber }),
      client.pulls.listCommits({ owner, repo, pull_number: prNumber }),
    ]);

    return {
      description: prResponse.data.body ?? '',
      commitMessages: commitsResponse.data.map((c: { commit: { message: string } }) => c.commit.message),
    };
  } catch (err) {
    handleOctokitError(err);
  }
}
