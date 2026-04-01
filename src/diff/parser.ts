import parseDiffLib from 'parse-diff';
import type { DiffFile, DiffHunk, DiffChange } from '../types.js';

// Collect binary file paths from raw diff content
function detectBinaryPaths(diffContent: string): Set<string> {
  const binaryPaths = new Set<string>();
  // Matches: "Binary files a/path and b/path differ" or "Binary files /dev/null and b/path differ"
  const binaryLineRegex = /^Binary files\s+(.+)\s+and\s+(.+)\s+differ$/gm;
  for (const match of diffContent.matchAll(binaryLineRegex)) {
    // Extract file paths from "a/..." or "b/..." or "/dev/null"
    const fromRaw = match[1].trim();
    const toRaw = match[2].trim();
    const extractPath = (p: string): string =>
      p === '/dev/null' ? p : p.replace(/^[ab]\//, '');
    const fromPath = extractPath(fromRaw);
    const toPath = extractPath(toRaw);
    if (toPath !== '/dev/null') binaryPaths.add(toPath);
    if (fromPath !== '/dev/null') binaryPaths.add(fromPath);
  }
  return binaryPaths;
}

export function parseDiff(diffContent: string): DiffFile[] {
  if (!diffContent || diffContent.trim() === '') {
    return [];
  }

  const binaryPaths = detectBinaryPaths(diffContent);
  const parsed = parseDiffLib(diffContent);

  return parsed.map((file): DiffFile => {
    // Determine status - order matters: check new/deleted flags before from/to mismatch
    let status: DiffFile['status'] = 'modified';
    if (file.deleted === true || file.to === '/dev/null') {
      status = 'deleted';
    } else if (file.new === true || file.from === '/dev/null') {
      status = 'added';
    } else if (file.from && file.to && file.from !== file.to) {
      status = 'renamed';
    }

    // Determine path (current path = new file path when not deleted)
    const path = file.to && file.to !== '/dev/null' ? file.to : (file.from ?? '');

    const isBinary = binaryPaths.has(path);

    const hunks: DiffHunk[] = isBinary
      ? []
      : (file.chunks ?? []).map((chunk): DiffHunk => {
          const changes: DiffChange[] = chunk.changes.map((change): DiffChange => {
            if (change.type === 'add') {
              return {
                type: 'add',
                content: change.content.replace(/^\+/, ''),
                new_line: change.ln,
              };
            } else if (change.type === 'del') {
              return {
                type: 'del',
                content: change.content.replace(/^-/, ''),
                old_line: change.ln,
              };
            } else {
              // normal/context
              const normal = change as { type: 'normal'; content: string; ln1?: number; ln2?: number };
              return {
                type: 'normal',
                content: normal.content.replace(/^ /, ''),
                old_line: normal.ln1,
                new_line: normal.ln2,
              };
            }
          });

          // Calculate start_line and end_line from new file line numbers
          const newLines = changes
            .filter((c) => c.type === 'add' || c.type === 'normal')
            .map((c) => c.new_line)
            .filter((n): n is number => n !== undefined);

          const start_line = newLines.length > 0 ? newLines[0] : chunk.newStart;
          const end_line = newLines.length > 0 ? newLines[newLines.length - 1] : chunk.newStart + chunk.newLines - 1;

          return {
            header: chunk.content,
            start_line,
            end_line,
            changes,
          };
        });

    const result: DiffFile = {
      path,
      status,
      hunks,
    };

    if (isBinary) {
      result.binary = true;
    }

    if (status === 'renamed' && file.from) {
      result.old_path = file.from;
    }

    return result;
  });
}
