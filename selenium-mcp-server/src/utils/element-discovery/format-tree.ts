import type { AccessibilityNode, SnapshotMode } from '../../types.js';

/** Options for formatting the accessibility tree. */
export interface FormatTreeOptions {
  maxLength?: number;
  mode?: SnapshotMode;
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
 * All modes: show only best selector, truncate names, drop fragile positional selectors.
 */
function formatNodeLine(node: AccessibilityNode, indent: string, smart: boolean): string {
  let line = `${indent}- ${node.role}`;
  if (node.name) {
    let name = node.name;
    const maxNameLen = smart ? 80 : 60;
    if (name.length > maxNameLen) {
      name = name.slice(0, maxNameLen - 3) + '...';
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

/** Count total ref'd elements in a subtree (memoized per call). */
function countRefs(node: AccessibilityNode, cache: Map<AccessibilityNode, number>): number {
  const cached = cache.get(node);
  if (cached !== undefined) return cached;
  let count = node.ref ? 1 : 0;
  for (const child of node.children) {
    count += countRefs(child, cache);
  }
  cache.set(node, count);
  return count;
}

/** Smart mode constants. */
const MAX_SMART_LINES = 200;
const SMART_REPEAT_SHOW = 2;       // Show first N of repeated siblings
const SMART_COLLAPSE_DEPTH = 3;    // Depth at which to collapse large subtrees
const SMART_COLLAPSE_THRESHOLD = 8; // Min descendant refs to trigger collapse

/**
 * Format an accessibility tree as indented text for snapshot output.
 */
export function formatAccessibilityTree(tree: AccessibilityNode, options?: FormatTreeOptions): string {
  const mode = options?.mode ?? 'full';
  const maxLength = options?.maxLength;
  const smart = mode === 'smart';

  if (mode === 'minimal') {
    return formatMinimal(tree, maxLength);
  }

  const lines: string[] = [];
  const refCache = smart ? new Map<AccessibilityNode, number>() : new Map();

  function walk(node: AccessibilityNode, depth: number): void {
    // Smart: hard line cap
    if (smart && lines.length >= MAX_SMART_LINES) return;

    if (smart) {
      const refs = countRefs(node, refCache);

      // Skip subtrees with zero interactive elements (except root-level landmarks)
      if (refs === 0 && depth > 0) return;

      // Flatten single-child wrappers that have no ref
      if (!node.ref && node.children.length === 1 && depth > 0) {
        walk(node.children[0], depth);
        return;
      }

      // Collapse large subtrees at depth
      if (depth >= SMART_COLLAPSE_DEPTH && refs > SMART_COLLAPSE_THRESHOLD) {
        const indent = '  '.repeat(depth);
        lines.push(formatNodeLine(node, indent, true));
        lines.push(`${indent}  - ... (${refs - (node.ref ? 1 : 0)} interactive elements inside)`);
        return;
      }
    }

    const indent = '  '.repeat(depth);
    lines.push(formatNodeLine(node, indent, smart));

    if (smart) {
      // Collapse repeated similar siblings (e.g., product cards, nav items)
      collapseChildren(node.children, depth + 1);
    } else {
      for (const child of node.children) {
        walk(child, depth + 1);
      }
    }
  }

  /** Group consecutive children with the same role and collapse repeats. */
  function collapseChildren(children: AccessibilityNode[], depth: number): void {
    let i = 0;
    while (i < children.length) {
      if (lines.length >= MAX_SMART_LINES) return;

      // Find run of siblings with same role
      const role = children[i].role;
      let runEnd = i + 1;
      while (runEnd < children.length && children[runEnd].role === role) {
        runEnd++;
      }
      const runLen = runEnd - i;

      if (runLen > SMART_REPEAT_SHOW + 1) {
        // Show first N, summarize rest
        for (let j = i; j < i + SMART_REPEAT_SHOW; j++) {
          walk(children[j], depth);
        }
        const skipped = runLen - SMART_REPEAT_SHOW;
        let skippedRefs = 0;
        for (let j = i + SMART_REPEAT_SHOW; j < runEnd; j++) {
          skippedRefs += countRefs(children[j], refCache);
        }
        const indent = '  '.repeat(depth);
        lines.push(`${indent}- ... (+${skipped} more ${role} items, ${skippedRefs} interactive elements)`);
      } else {
        for (let j = i; j < runEnd; j++) {
          walk(children[j], depth);
        }
      }
      i = runEnd;
    }
  }

  const roots = tree.role !== 'document' ? [tree] : tree.children;
  for (const child of roots) {
    walk(child, 0);
  }

  // Safety cap
  if (smart && lines.length > MAX_SMART_LINES) {
    lines.length = MAX_SMART_LINES;
    lines.push('\n... (truncated, use snapshotOptions.mode: "full" to see all)');
  }

  let text = lines.join('\n');
  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength) + '\n... (truncated)';
  }
  return text;
}

/**
 * Minimal mode: flat list of only ref'd elements with role, name, and selectors.
 */
function formatMinimal(tree: AccessibilityNode, maxLength?: number): string {
  const lines: string[] = [];

  function collect(node: AccessibilityNode): void {
    if (node.ref) {
      lines.push(formatNodeLine(node, '', false));
    }
    for (const child of node.children) {
      collect(child);
    }
  }

  if (tree.role !== 'document') {
    collect(tree);
  } else {
    for (const child of tree.children) {
      collect(child);
    }
  }

  let text = lines.join('\n');

  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength) + '\n... (truncated)';
  }

  return text;
}
