export interface DiffChange {
  type: 'add' | 'del' | 'normal';
  content: string;
  old_line?: number;
  new_line?: number;
}

export interface DiffHunk {
  header: string;
  start_line: number;
  end_line: number;
  changes: DiffChange[];
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  old_path?: string;
  hunks: DiffHunk[];
  binary?: boolean;
}

export interface ChangeBlock {
  file_path: string;
  start_line: number;
  end_line: number;
  content: string;
  block_type: 'addition' | 'deletion' | 'modification';
  changes: DiffChange[];
}

export interface ContextSource {
  type: 'commit_message' | 'pr_description' | 'issue_link';
  content: string;
  relevance_score?: number;
}

export interface IntentAnnotation {
  change_block: ChangeBlock;
  body: string;
  source_type: 'context' | 'inferred' | 'conflict';
  confidence: 'high' | 'medium' | 'low';
  context_references: string[];
}

export interface ReviewComment {
  path: string;
  line: number;
  start_line?: number;
  side: 'LEFT' | 'RIGHT';
  body: string;
}

export interface ReviewPayload {
  pr_number: number;
  repo: string;
  commit_sha: string;
  comments: ReviewComment[];
}
