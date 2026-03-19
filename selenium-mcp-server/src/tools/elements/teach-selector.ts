import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory } from '../../types.js';
import { loadHints, saveHints } from '../../utils/selector-hints.js';

const schema = z.object({
  description: z.string().describe('Description of the element (e.g., "the NL language link", "the search button")'),
  css: z.string().describe('The preferred CSS selector for this element'),
  scope: z.string().optional().describe('Scope: "*" for site-wide, or path pattern like "/blog/*". Auto-determined if omitted.'),
});

/**
 * Browser-side script that validates a CSS selector and extracts element metadata.
 * Returns { count, tag, text, ariaLabel, inHeader } or null.
 */
const VALIDATE_SCRIPT = `
  var selector = arguments[0];
  try {
    var els = document.querySelectorAll(selector);
    // Count visible matches
    var visible = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      var s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') continue;
      visible.push(el);
    }
    if (visible.length === 0) return { count: 0 };
    if (visible.length > 1) return { count: visible.length };

    var el = visible[0];
    var tag = el.tagName.toLowerCase();
    var text = (el.textContent || '').trim().slice(0, 100);
    var ariaLabel = el.getAttribute('aria-label') || null;

    // Determine if element is in header/nav/footer (site-wide) or main content (page-specific)
    var inHeader = !!(el.closest('header') || el.closest('nav') || el.closest('footer') ||
      el.closest('[role="banner"]') || el.closest('[role="navigation"]') || el.closest('[role="contentinfo"]'));

    return { count: 1, tag: tag, text: text, ariaLabel: ariaLabel, inHeader: inHeader };
  } catch (e) {
    return { error: e.message };
  }
`;

export class TeachSelectorTool extends BaseTool {
  readonly name = 'teach_selector';
  readonly description = 'Teach the system a preferred CSS selector for an element. The selector is saved and used as Phase 0 (highest priority) in future element discovery on this domain.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'browser';

  getAnnotations() {
    return {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    };
  }

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { description, css, scope: scopeOverride } = this.parseParams(schema, params);

    const driver = await context.getDriver();
    const currentUrl = new URL(await driver.getCurrentUrl());
    const domain = currentUrl.hostname;
    const pathname = currentUrl.pathname;

    // Validate the selector in-browser
    const result = await driver.executeScript(VALIDATE_SCRIPT, css) as {
      count: number;
      tag?: string;
      text?: string;
      ariaLabel?: string;
      inHeader?: boolean;
      error?: string;
    };

    if (result.error) {
      return this.error(`Invalid CSS selector: ${result.error}`);
    }
    if (result.count === 0) {
      return this.error(`Selector "${css}" matches no visible elements on this page`);
    }
    if (result.count > 1) {
      return this.error(`Selector "${css}" matches ${result.count} visible elements — must be unique (1 match)`);
    }

    // Auto-determine scope
    const scope = scopeOverride ?? (result.inHeader ? '*' : pathname.replace(/\/[^/]*$/, '/*'));

    // Build hint entry
    const hint = {
      css,
      tag: result.tag!,
      ...(result.text && { text: result.text }),
      ...(result.ariaLabel && { ariaLabel: result.ariaLabel }),
    };

    // Load, merge, save
    const hints = await loadHints();
    if (!hints[domain]) hints[domain] = {};
    if (!hints[domain][scope]) hints[domain][scope] = [];

    // Replace existing hint with same CSS selector, or add new
    const existing = hints[domain][scope];
    const idx = existing.findIndex(h => h.css === css);
    if (idx >= 0) {
      existing[idx] = hint;
    } else {
      existing.push(hint);
    }

    await saveHints(hints);

    return this.success(
      `Saved selector hint for ${domain}:\n` +
      `  Element: ${description}\n` +
      `  Selector: ${css}\n` +
      `  Scope: ${scope}\n` +
      `  Tag: ${result.tag}, Text: "${result.text || ''}"`,
      false,
    );
  }
}
