# Changelog

## [3.0.0] - 2026-03-19

### Breaking Changes

- **Element discovery module refactored** — the monolithic `src/utils/element-discovery.ts` (1339 lines) has been split into a modular `src/utils/element-discovery/` directory with dedicated files for selector computation, tree scripts, formatting, and element resolution. Import paths have changed from `./utils/element-discovery.js` to `./utils/element-discovery/index.js`. Public API remains identical.
- **Max discoverable elements increased** from 200 to 300, improving coverage on complex pages.

### New Features

- **`teach_selector` tool** — Teach the system a preferred CSS selector for any element. The selector is validated in-browser (must match exactly 1 visible element), then saved to a per-domain hints file (`selector-hints.json`). Taught selectors are used as Phase 0 (highest priority) in future element discovery, ensuring stable, user-chosen selectors take precedence over auto-computed ones.
  - Auto-determines scope: elements in `<header>`, `<nav>`, or `<footer>` default to site-wide (`*`), while content elements default to the current path pattern.
  - Supports manual scope override (e.g., `"/blog/*"`, `"*"`).
  - Idempotent: re-teaching the same CSS selector updates the existing hint.

- **Selector hints system** (`src/utils/selector-hints.ts`) — A persistent, domain-scoped hint storage system:
  - Hints are stored as JSON keyed by domain and path pattern.
  - On every page snapshot, hints for the current domain+path are loaded and passed to element discovery as Phase 0 candidates.
  - Simple glob matching for path scopes (e.g., `/blog/*` matches `/blog/my-post`).
  - Non-critical: hint loading failures are silently ignored to avoid breaking snapshots.

### Semantic Element Recognition Improvements

- **Visibility-aware uniqueness** — Selector uniqueness now checks only *visible* elements. Previously `querySelectorAll().length === 1` counted hidden elements, causing valid selectors to be skipped and falling back to fragile XPath text matchers. Now `cssUnique()` and `xpathUnique()` filter by visibility (non-zero size, not `display:none`/`visibility:hidden`/`opacity:0`), producing more accurate and human-readable CSS selectors.

- **Ancestor scope fallback** — New `findAncestorScope()` walks up the DOM to find the nearest scoping ancestor (by `#id`, semantic attributes like `data-testid`, landmark with `aria-label`, or positional landmark). All selector phases now try unscoped first, then scoped. This means duplicate elements (e.g., "Home" link in both header nav and footer) now get proper scoped selectors like `nav[aria-label="Main navigation"] a[href="/"]` instead of falling through to fragile XPath `normalize-space()` matchers.

- **Shadow DOM support** — The accessibility tree walker now traverses open shadow roots, discovering elements inside web components. `computeSelector()` detects shadow DOM context, scopes CSS queries within the shadow root, uses `>>>` notation for cross-boundary selectors, and disables XPath (which cannot cross shadow boundaries).

- **Two-pass ref assignment** — Semantic elements (links, buttons, headings, landmarks) get refs first in pass 1. Generic elements discovered via test attributes (`data-testid`, `data-test`, `data-cy`, `data-qa`) or custom elements (tags with hyphens) are deferred to pass 2, filling remaining ref budget without stealing slots from higher-priority semantic elements.

- **Generic element discovery** — Elements with test-anchor attributes (`data-testid`, `data-test`, `data-cy`, `data-qa`) or custom HTML elements (web components with hyphenated tags) are now discovered with role `generic`, even without an ARIA role or interactivity. Fallback naming uses the test attribute value, then any meaningful attribute.

- **Phase 2b: byDescendantTestId** — When an element itself lacks a test ID but a direct child has one, uses CSS `:has(> child[data-testid="..."])` selector for modern browsers, with XPath fallback.

- **Phase 16: byPositionalIndex** — New last-resort fallback when all 15 phases fail. Finds the element's position among all matches of a good base selector (test ID, text match) and produces `(xpath)[N]` positional selectors.

- **Deeper positional chain** — Phase 14 (byIndex) now walks up to 5 ancestor levels (was 2) and adds `nth-of-type` to ancestor nodes that have same-tag siblings, producing more precise positional selectors.

- **Explicit role handling in Phase 3** — Elements with explicit `role` attributes (e.g., `div[role="button"]`) are now handled in the byRole+name phase even when the tag has no implicit role mapping.

- **`hreflang` attribute support** — Added to attribute priority list, enabling CSS selectors like `a[hreflang="nl"]` for language switcher links instead of falling back to XPath text matching.

### Architecture

- **Element discovery split into modules:**
  - `element-discovery/index.ts` — barrel exports (public API unchanged)
  - `element-discovery/discover.ts` — `discoverElements()` with selector hints support
  - `element-discovery/selector-scripts.ts` — browser-side `computeSelector()` (16-phase selector computation)
  - `element-discovery/tree-scripts.ts` — browser-side accessibility tree walker with two-pass ref assignment
  - `element-discovery/format-tree.ts` — `formatAccessibilityTree()` with full/smart/minimal modes
  - `element-discovery/element-scripts.ts` — `extractElementInfo()` and `findElementByInfo()`

### Tool Count

- Total tools: **75** (was 74) — added `teach_selector` in the Elements category.

## [2.9.0] - 2025-xx-xx

- Added snapshot mode (full/smart/minimal) and improved selector computation.

## [2.8.0] - 2025-xx-xx

- Coerced string-encoded numeric params in all tools.

## [2.7.0] - 2025-xx-xx

- Version bump and maintenance release.
