#!/usr/bin/env node
import { parseArgs, formatDryRunText } from './args.js';
import type { DryRunAnnotation } from './args.js';
import { parseDiff } from '../diff/parser.js';
import { segmentBlocks, isGeneratedFile } from '../diff/segmenter.js';
import { extractContext } from '../context/extractor.js';
import { annotateBlocks } from '../annotator/annotator.js';
import { formatAnnotation } from '../annotator/formatter.js';
import { publishReview, fetchPRDiff, fetchPRDetails } from '../publisher/github.js';
import type { ReviewPayload, ReviewComment, IntentAnnotation } from '../types.js';

function exitWithError(code: number, message: string): never {
  process.stderr.write(`Error [${code}]: ${message}\n`);
  process.exit(code);
}

async function main(): Promise<void> {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    exitWithError(1, msg);
  }

  const token = args.token ?? process.env['GITHUB_TOKEN'];
  if (!token) {
    exitWithError(2, 'GitHub authentication failed. Check --token or GITHUB_TOKEN.');
  }

  process.stdout.write(`Fetching PR #${args.pr} from ${args.repo}...\n`);

  let diffContent: string;
  let prDetails: { description: string; commitMessages: string[] };

  try {
    [diffContent, prDetails] = await Promise.all([
      fetchPRDiff(args.repo, args.pr, token),
      fetchPRDetails(args.repo, args.pr, token),
    ]);
  } catch (err) {
    const e = err as { code?: number; message?: string };
    exitWithError(e.code ?? 1, e.message ?? 'Failed to fetch PR data.');
  }

  const files = parseDiff(diffContent);
  const totalLines = files.reduce(
    (sum, f) => sum + f.hunks.reduce((s, h) => s + h.changes.length, 0),
    0,
  );
  process.stdout.write(`Parsing diff: ${files.length} files, ${totalLines} changed lines\n`);

  const context = extractContext({
    commitMessages: prDetails.commitMessages,
    prDescription: prDetails.description,
  });

  process.stdout.write(`Analyzing ${files.length} files with concurrency ${args.concurrency}...\n`);

  let skippedBinary = 0;
  let skippedGenerated = 0;
  for (const f of files) {
    if (f.binary) skippedBinary++;
    else if (isGeneratedFile(f.path)) skippedGenerated++;
  }

  const allBlocks = files.flatMap((f) => segmentBlocks(f));
  const allAnnotations: IntentAnnotation[] = await annotateBlocks(allBlocks, context, {
    concurrency: args.concurrency,
  });

  const dryRunAnnotations: DryRunAnnotation[] = allAnnotations.map((ann) => ({
    file: ann.change_block.file_path,
    start_line: ann.change_block.start_line,
    end_line: ann.change_block.end_line,
    body: formatAnnotation(ann),
    source_type: ann.source_type,
    confidence: ann.confidence,
    context_refs: ann.context_references,
  }));

  const totalBlocks = allBlocks.length + skippedBinary + skippedGenerated;
  const skippedTotal = skippedBinary + skippedGenerated;
  const skippedReasons: Record<string, number> = {};
  if (skippedBinary > 0) skippedReasons['binary'] = skippedBinary;
  if (skippedGenerated > 0) skippedReasons['generated'] = skippedGenerated;

  if (args.dryRun) {
    if (args.format === 'json') {
      const output = {
        annotations: dryRunAnnotations,
        summary: {
          total_blocks: totalBlocks,
          annotated: allAnnotations.length,
          skipped: skippedTotal,
          skipped_reasons: skippedReasons,
        },
      };
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    } else {
      process.stdout.write(formatDryRunText(dryRunAnnotations) + '\n');
    }
    process.stdout.write(`${allAnnotations.length} annotations generated for ${files.length} files\n`);
    return;
  }

  // Get commit SHA for review (use first commit's sha from PR)
  // For simplicity, use a placeholder; in production would come from PR head commit
  const commitSha = 'HEAD';

  const comments: ReviewComment[] = allAnnotations
    .slice(0, args.maxComments)
    .map((ann): ReviewComment => ({
      path: ann.change_block.file_path,
      line: ann.change_block.end_line,
      start_line:
        ann.change_block.start_line !== ann.change_block.end_line
          ? ann.change_block.start_line
          : undefined,
      side: 'RIGHT',
      body: formatAnnotation(ann),
    }));

  const payload: ReviewPayload = {
    pr_number: args.pr,
    repo: args.repo,
    commit_sha: commitSha,
    comments,
  };

  process.stdout.write(`Posting review with ${comments.length} annotations...\n`);

  try {
    await publishReview(payload, token);
  } catch (err) {
    const e = err as { code?: number; message?: string };
    exitWithError(e.code ?? 1, e.message ?? 'Failed to post review.');
  }

  process.stdout.write(`Done. ${comments.length} annotations posted to PR #${args.pr}.\n`);
  process.stdout.write(`${allAnnotations.length} annotations generated for ${files.length} files\n`);
}

main().catch((err) => {
  const e = err as { code?: number; message?: string };
  exitWithError(e.code ?? 1, e.message ?? String(err));
});
