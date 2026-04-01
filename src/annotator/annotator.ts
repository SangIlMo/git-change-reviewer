import Anthropic from '@anthropic-ai/sdk';
import type { ChangeBlock, ContextSource, IntentAnnotation } from '../types.js';

interface AIResponse {
  body: string;
  confidence: 'high' | 'medium' | 'low';
  context_references: string[];
  conflict?: boolean;
}

function buildPrompt(block: ChangeBlock, context: ContextSource[]): string {
  const contextSection =
    context.length > 0
      ? `\n\nContext sources:\n${context.map((c) => `- [${c.type}]: ${c.content}`).join('\n')}`
      : '\n\nNo context sources available.';

  return `You are a code reviewer. Analyze the following code change and explain the intent behind it.

File: ${block.file_path} (lines ${block.start_line}–${block.end_line})
Change type: ${block.block_type}

Diff:
\`\`\`
${block.content}
\`\`\`
${contextSection}

Respond with a JSON object (no markdown fences) with these fields:
- body: string — a 1–3 sentence explanation of why this change was made
- confidence: "high" | "medium" | "low"
- context_references: string[] — list of context source types used (e.g. ["commit_message", "pr_description"])
- conflict: boolean — true if the commit message or PR description does not match what the code actually does

If context sources were provided and are relevant, set confidence to "high". Otherwise set it to "medium".
If conflict is true, set confidence to "low" and describe the mismatch in the body using the format: "The commit message states \\"...\\" but the code change appears to ..."`;

}

function parseResponse(text: string): AIResponse {
  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(cleaned) as Partial<AIResponse>;
  return {
    body: typeof parsed.body === 'string' ? parsed.body : 'No explanation provided.',
    confidence: (['high', 'medium', 'low'] as const).includes(parsed.confidence as never)
      ? (parsed.confidence as 'high' | 'medium' | 'low')
      : 'medium',
    context_references: Array.isArray(parsed.context_references) ? parsed.context_references : [],
    conflict: parsed.conflict === true,
  };
}

export async function annotateBlocks(
  blocks: ChangeBlock[],
  context: ContextSource[],
  options?: { concurrency?: number; client?: Pick<Anthropic, 'messages'> },
): Promise<IntentAnnotation[]> {
  const concurrency = options?.concurrency ?? 5;
  const client = options?.client;
  const results: (IntentAnnotation | null)[] = new Array(blocks.length).fill(null);

  // Simple semaphore-based concurrency limiter
  let active = 0;
  let index = 0;

  await new Promise<void>((resolve, reject) => {
    let settled = 0;
    let hasError = false;

    function next(): void {
      while (active < concurrency && index < blocks.length) {
        const i = index++;
        active++;
        const block = blocks[i];
        annotateBlock(block, context, client)
          .then((annotation) => {
            results[i] = annotation;
          })
          .catch((err) => {
            console.warn(`[annotateBlocks] skipping block ${i} (${block.file_path}): ${err instanceof Error ? err.message : String(err)}`);
          })
          .finally(() => {
            active--;
            settled++;
            if (settled === blocks.length) {
              if (hasError) reject(new Error('annotateBlocks failed'));
              else resolve();
            } else {
              next();
            }
          });
      }
    }

    if (blocks.length === 0) {
      resolve();
      return;
    }

    next();
    void hasError;
  });

  return results.filter((r): r is IntentAnnotation => r !== null);
}

export async function annotateBlock(
  block: ChangeBlock,
  context: ContextSource[],
  client?: Pick<Anthropic, 'messages'>,
): Promise<IntentAnnotation> {
  const ai = client ?? new Anthropic();
  const prompt = buildPrompt(block, context);

  const response = await ai.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((c) => c.type === 'text');
  const rawText = textBlock && textBlock.type === 'text' ? textBlock.text : '{}';
  const parsed = parseResponse(rawText);

  let source_type: 'context' | 'inferred' | 'conflict';
  if (parsed.conflict) {
    source_type = 'conflict';
  } else if (context.length > 0) {
    source_type = 'context';
  } else {
    source_type = 'inferred';
  }

  return {
    change_block: block,
    body: parsed.body,
    source_type,
    confidence: parsed.conflict ? 'low' : parsed.confidence,
    context_references: parsed.context_references,
  };
}
