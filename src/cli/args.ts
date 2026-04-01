export interface CliArgs {
  repo: string;
  pr: number;
  token?: string;
  dryRun: boolean;
  format: 'text' | 'json';
  maxComments: number;
  model: string;
  concurrency: number;
}

export interface DryRunAnnotation {
  file: string;
  start_line: number;
  end_line: number;
  body: string;
  source_type: string;
  confidence: string;
  context_refs: string[];
}

export function parseArgs(argv: string[]): CliArgs {
  const args: Record<string, string> = {};
  const flags = new Set<string>();

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        flags.add(key);
      }
    }
  }

  if (!args['repo']) {
    throw new Error('Missing required argument: --repo');
  }
  if (!args['pr']) {
    throw new Error('Missing required argument: --pr');
  }
  const prNum = parseInt(args['pr'], 10);
  if (isNaN(prNum)) {
    throw new Error(`Invalid --pr value: ${args['pr']}`);
  }

  const format = args['format'] === 'json' ? 'json' : 'text';
  const maxComments = args['max-comments'] !== undefined ? parseInt(args['max-comments'], 10) : 50;
  const concurrency = args['concurrency'] !== undefined ? parseInt(args['concurrency'], 10) : 5;

  return {
    repo: args['repo'],
    pr: prNum,
    token: args['token'],
    dryRun: flags.has('dry-run'),
    format,
    maxComments: isNaN(maxComments) ? 50 : maxComments,
    model: args['model'] ?? process.env['GCR_MODEL'] ?? 'claude-haiku-3-5',
    concurrency: isNaN(concurrency) ? 5 : concurrency,
  };
}

export function formatDryRunText(annotations: DryRunAnnotation[]): string {
  const sections: string[] = [];
  for (const ann of annotations) {
    sections.push(`=== ${ann.file} (lines ${ann.start_line}–${ann.end_line}) ===`);
    sections.push(ann.body);
    sections.push('---');
  }
  return sections.join('\n');
}
