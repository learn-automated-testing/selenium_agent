import { WebDriver } from 'selenium-webdriver';
import type { ElementInfo, AccessibilityNode } from '../../types.js';
import { ACCESSIBILITY_TREE_SCRIPT } from './tree-scripts.js';

const MAX_ELEMENTS = 300;

export interface DiscoveryResult {
  elements: Map<string, ElementInfo>;
  tree: AccessibilityNode;
}

/**
 * Discover elements by walking the DOM accessibility tree.
 * Returns both a flat element map (for ref resolution) and a hierarchical tree.
 */
export async function discoverElements(
  driver: WebDriver,
  scopeSelector?: string,
  verboseAttributes: boolean = false,
  selectorHints: Array<{ css: string; tag: string; text?: string; ariaLabel?: string }> = [],
): Promise<DiscoveryResult> {
  const raw = await driver.executeScript(
    ACCESSIBILITY_TREE_SCRIPT,
    scopeSelector || null,
    MAX_ELEMENTS,
    verboseAttributes,
    selectorHints,
  ) as {
    elements: Array<{
      ref: string;
      tagName: string;
      role: string;
      text: string;
      level?: number;
      ariaLabel: string | null;
      isClickable: boolean;
      isVisible: boolean;
      attributes: Record<string, string>;
      css: string | null;
      xpath: string | null;
      boundingBox: { x: number; y: number; width: number; height: number };
    }>;
    tree: AccessibilityNode;
  };

  const elements = new Map<string, ElementInfo>();
  for (const el of raw.elements) {
    elements.set(el.ref, {
      ref: el.ref,
      tagName: el.tagName,
      role: el.role,
      text: el.text,
      level: el.level,
      ariaLabel: el.ariaLabel || undefined,
      isClickable: el.isClickable,
      isVisible: el.isVisible,
      attributes: el.attributes,
      css: el.css || undefined,
      xpath: el.xpath || undefined,
      boundingBox: el.boundingBox,
    });
  }

  return { elements, tree: raw.tree };
}
