import type { IntentAnnotation } from '../types.js';

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatAnnotation(annotation: IntentAnnotation): string {
  const { body, source_type, confidence, context_references } = annotation;
  const confidenceLabel = capitalize(confidence);

  if (source_type === 'conflict') {
    return `> **Intent** [Conflict]: ${body}\n>\n> **Confidence**: ${confidenceLabel}`;
  } else if (source_type === 'context') {
    const refs = context_references.join(', ');
    return `> **Intent**: ${body}\n>\n> **Source**: ${refs}\n> **Confidence**: ${confidenceLabel}`;
  } else {
    // inferred
    return `> **Intent** [Inferred]: ${body}\n>\n> **Confidence**: ${confidenceLabel}\n>\n> _This annotation was inferred from code analysis. The change context did not provide explicit reasoning._`;
  }
}
