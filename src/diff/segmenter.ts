import type { DiffFile, DiffChange, ChangeBlock } from '../types.js';

const CONTEXT_BOUNDARY = 3;

const GENERATED_FILE_PATTERNS: Array<string | RegExp> = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'go.sum',
  'Cargo.lock',
  'poetry.lock',
  'Gemfile.lock',
  'composer.lock',
  /\.min\.js$/,
  /\.min\.css$/,
  /\.map$/,
  /\.generated\./,
];

export function isGeneratedFile(filePath: string): boolean {
  const basename = filePath.split('/').pop() ?? filePath;
  for (const pattern of GENERATED_FILE_PATTERNS) {
    if (typeof pattern === 'string') {
      if (basename === pattern) return true;
    } else {
      if (pattern.test(filePath)) return true;
    }
  }
  return false;
}

function determineBlockType(changes: DiffChange[]): ChangeBlock['block_type'] {
  const hasAdds = changes.some((c) => c.type === 'add');
  const hasDels = changes.some((c) => c.type === 'del');
  if (hasAdds && hasDels) return 'modification';
  if (hasAdds) return 'addition';
  return 'deletion';
}

function formatChanges(changes: DiffChange[]): string {
  return changes
    .map((c) => {
      if (c.type === 'add') return `+${c.content}`;
      if (c.type === 'del') return `-${c.content}`;
      return ` ${c.content}`;
    })
    .join('\n');
}

function getLineNumber(change: DiffChange): number {
  return change.new_line ?? change.old_line ?? 0;
}

export function segmentBlocks(file: DiffFile): ChangeBlock[] {
  if (!file.hunks || file.hunks.length === 0) {
    return [];
  }

  if (isGeneratedFile(file.path)) {
    return [];
  }

  const blocks: ChangeBlock[] = [];

  for (const hunk of file.hunks) {
    const changes = hunk.changes;
    if (changes.length === 0) continue;

    // Split hunk into segments separated by >= CONTEXT_BOUNDARY consecutive context lines
    let currentSegment: DiffChange[] = [];
    let consecutiveContext = 0;
    let pendingContext: DiffChange[] = [];

    for (const change of changes) {
      if (change.type === 'normal') {
        consecutiveContext++;
        pendingContext.push(change);

        if (consecutiveContext >= CONTEXT_BOUNDARY && currentSegment.length > 0) {
          // Check if currentSegment has any non-context changes
          const hasChanges = currentSegment.some((c) => c.type !== 'normal');
          if (hasChanges) {
            // Emit block for currentSegment (without the trailing context that triggered split)
            const blockChanges = currentSegment;
            const changedLines = blockChanges
              .filter((c) => c.type === 'add' || (c.type === 'normal'))
              .map(getLineNumber)
              .filter((n) => n > 0);

            const start_line = changedLines.length > 0 ? changedLines[0] : getLineNumber(blockChanges[0]);
            const end_line = changedLines.length > 0 ? changedLines[changedLines.length - 1] : getLineNumber(blockChanges[blockChanges.length - 1]);

            blocks.push({
              file_path: file.path,
              start_line,
              end_line,
              content: formatChanges(blockChanges),
              block_type: determineBlockType(blockChanges),
              changes: blockChanges,
            });
          }
          currentSegment = [];
          pendingContext = [];
          consecutiveContext = 0;
        }
      } else {
        // Non-context change: flush pending context into current segment first
        if (pendingContext.length > 0) {
          currentSegment.push(...pendingContext);
          pendingContext = [];
        }
        consecutiveContext = 0;
        currentSegment.push(change);
      }
    }

    // Emit remaining segment
    if (currentSegment.length > 0) {
      const hasChanges = currentSegment.some((c) => c.type !== 'normal');
      if (hasChanges) {
        const changedLines = currentSegment
          .filter((c) => c.type === 'add' || c.type === 'normal')
          .map(getLineNumber)
          .filter((n) => n > 0);

        const start_line = changedLines.length > 0 ? changedLines[0] : getLineNumber(currentSegment[0]);
        const end_line = changedLines.length > 0 ? changedLines[changedLines.length - 1] : getLineNumber(currentSegment[currentSegment.length - 1]);

        blocks.push({
          file_path: file.path,
          start_line,
          end_line,
          content: formatChanges(currentSegment),
          block_type: determineBlockType(currentSegment),
          changes: currentSegment,
        });
      }
    }
  }

  return blocks;
}
