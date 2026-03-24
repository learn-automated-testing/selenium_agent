import type { AccessibilityNode } from '../../types.js';

/** Options for formatting the accessibility tree. */
export interface FormatTreeOptions {
  maxLength?: number;
}

/**
 * Get the best non-positional selector for a node.
 * Drops fragile positional (idx) selectors — they break on any DOM change.
 */
function getBestSelector(node: AccessibilityNode): { type: 'css' | 'xpath'; value: string } | null {
  // Prefer CSS, but skip positional /*idx*/ selectors
  if (node.css && !node.css.startsWith('/*idx*/')) {
    return { type: 'css', value: node.css };
  }
  if (node.xpath) {
    return { type: 'xpath', value: node.xpath };
  }
  // Fall back to positional CSS if nothing else exists
  if (node.css) {
    return { type: 'css', value: node.css };
  }
  return null;
}

/**
 * Format a single node line.
 * Truncates long names, shows best selector.
 */
function formatNodeLine(node: AccessibilityNode, indent: string): string {
  let line = `${indent}- ${node.role}`;
  if (node.name) {
    let name = node.name;
    if (name.length > 60) {
      name = name.slice(0, 57) + '...';
    }
    line += ` "${name}"`;
  }
  if (node.level !== undefined) line += ` [level=${node.level}]`;
  if (node.ref) {
    const sel = getBestSelector(node);
    line += sel ? ` [ref=${node.ref}, ${sel.type}=${sel.value}]` : ` [ref=${node.ref}]`;
  }
  return line;
}

/**
 * Format an accessibility tree as indented text for snapshot output.
 * Always outputs the full tree — no collapsing or filtering.
 */
export function formatAccessibilityTree(tree: AccessibilityNode, options?: FormatTreeOptions): string {
  const maxLength = options?.maxLength;
  const lines: string[] = [];

  function walk(node: AccessibilityNode, depth: number): void {
    const indent = '  '.repeat(depth);
    lines.push(formatNodeLine(node, indent));

    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  const roots = tree.role !== 'document' ? [tree] : tree.children;
  for (const child of roots) {
    walk(child, 0);
  }

  let text = lines.join('\n');
  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength) + '\n... (truncated)';
  }
  return text;
}
