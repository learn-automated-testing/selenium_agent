# TypeScript Migration Plan: Selenium MCP Server

## Goal

Migrate Python Selenium MCP server to TypeScript for simpler distribution (`npx selenium-agent`).

---

## Target Structure

```
selenium-mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Main entry & exports
│   ├── server.ts                # MCP server setup
│   ├── context.ts               # Browser state management
│   ├── types.ts                 # Shared types/interfaces
│   │
│   ├── tools/
│   │   ├── index.ts             # Tool registry
│   │   ├── base.ts              # BaseTool class
│   │   │
│   │   ├── navigation/
│   │   │   ├── index.ts
│   │   │   ├── navigate.ts      # navigate_to
│   │   │   ├── back.ts          # go_back
│   │   │   └── forward.ts       # go_forward
│   │   │
│   │   ├── page/
│   │   │   ├── index.ts
│   │   │   ├── snapshot.ts      # capture_page
│   │   │   ├── screenshot.ts    # take_screenshot
│   │   │   └── pdf.ts           # generate_pdf
│   │   │
│   │   ├── elements/
│   │   │   ├── index.ts
│   │   │   ├── click.ts         # click_element
│   │   │   ├── hover.ts         # hover_element
│   │   │   ├── select.ts        # select_option
│   │   │   └── drag.ts          # drag_drop
│   │   │
│   │   ├── input/
│   │   │   ├── index.ts
│   │   │   ├── type.ts          # input_text
│   │   │   ├── keys.ts          # key_press
│   │   │   └── file.ts          # file_upload
│   │   │
│   │   ├── mouse/
│   │   │   ├── index.ts
│   │   │   ├── move.ts          # mouse_move
│   │   │   ├── click.ts         # mouse_click
│   │   │   └── drag.ts          # mouse_drag
│   │   │
│   │   ├── tabs/
│   │   │   ├── index.ts
│   │   │   ├── list.ts          # tab_list
│   │   │   ├── select.ts        # tab_select
│   │   │   ├── new.ts           # tab_new
│   │   │   └── close.ts         # tab_close
│   │   │
│   │   ├── verification/
│   │   │   ├── index.ts
│   │   │   ├── element.ts       # verify_element_visible
│   │   │   ├── text.ts          # verify_text_visible
│   │   │   ├── value.ts         # verify_value
│   │   │   └── list.ts          # verify_list_visible
│   │   │
│   │   ├── browser/
│   │   │   ├── index.ts
│   │   │   ├── wait.ts          # wait_for
│   │   │   ├── javascript.ts    # execute_javascript
│   │   │   ├── console.ts       # get_console_logs
│   │   │   ├── network.ts       # network_monitor
│   │   │   ├── dialog.ts        # handle_dialog
│   │   │   └── resize.ts        # resize_window
│   │   │
│   │   └── session/
│   │       ├── index.ts
│   │       ├── reset.ts         # reset_session
│   │       ├── close.ts         # close_browser
│   │       └── recording.ts     # start/stop_recording
│   │
│   └── utils/
│       ├── logger.ts            # Logging utility
│       └── locators.ts          # Element locator helpers
│
├── bin/
│   └── cli.ts                   # CLI entry point
│
└── tests/
    └── ...
```

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "selenium-webdriver": "^4.27.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/selenium-webdriver": "^4.1.0",
    "typescript": "^5.7.0"
  }
}
```

---

## Core Types

```typescript
// src/types.ts

import { WebDriver, WebElement } from 'selenium-webdriver';
import { z } from 'zod';

// Element reference from page snapshot
export interface ElementInfo {
  ref: string;           // e1, e2, e3...
  tagName: string;
  text: string;
  ariaLabel?: string;
  isClickable: boolean;
  attributes: Record<string, string>;
}

// Page state snapshot
export interface PageSnapshot {
  url: string;
  title: string;
  elements: Map<string, ElementInfo>;
}

// Tool execution result
export interface ToolResult {
  content: string;
  isError?: boolean;
  captureSnapshot?: boolean;
}

// Tool definition
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}
```

---

## Base Tool Class

```typescript
// src/tools/base.ts

import { z } from 'zod';
import { Context } from '../context';
import { ToolDefinition, ToolResult } from '../types';

export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: z.ZodType;

  get definition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      inputSchema: this.inputSchema
    };
  }

  abstract execute(context: Context, params: unknown): Promise<ToolResult>;

  protected parseParams<T>(schema: z.ZodType<T>, params: unknown): T {
    return schema.parse(params);
  }

  protected success(content: string, captureSnapshot = false): ToolResult {
    return { content, captureSnapshot };
  }

  protected error(message: string): ToolResult {
    return { content: message, isError: true };
  }
}
```

---

## Context (Browser Manager)

```typescript
// src/context.ts

import { Builder, WebDriver, By, until } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome';
import { PageSnapshot, ElementInfo } from './types';

export class Context {
  private driver: WebDriver | null = null;
  private snapshot: PageSnapshot | null = null;

  async ensureBrowser(): Promise<WebDriver> {
    if (!this.driver) {
      const options = new chrome.Options();
      options.addArguments('--no-sandbox');
      options.addArguments('--disable-dev-shm-usage');

      this.driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    }
    return this.driver;
  }

  async getDriver(): Promise<WebDriver> {
    if (!this.driver) {
      throw new Error('Browser not started. Call ensureBrowser() first.');
    }
    return this.driver;
  }

  async captureSnapshot(): Promise<PageSnapshot> {
    const driver = await this.getDriver();

    const url = await driver.getCurrentUrl();
    const title = await driver.getTitle();
    const elements = await this.discoverElements(driver);

    this.snapshot = { url, title, elements };
    return this.snapshot;
  }

  async getSnapshot(): Promise<PageSnapshot> {
    if (!this.snapshot) {
      return this.captureSnapshot();
    }
    return this.snapshot;
  }

  async getElementByRef(ref: string): Promise<WebElement> {
    const snapshot = await this.getSnapshot();
    const info = snapshot.elements.get(ref);

    if (!info) {
      throw new Error(`Element ref not found: ${ref}`);
    }

    const driver = await this.getDriver();
    // Use stored locator strategy to find element
    return this.findElement(driver, info);
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.quit();
      this.driver = null;
      this.snapshot = null;
    }
  }

  private async discoverElements(driver: WebDriver): Promise<Map<string, ElementInfo>> {
    // Discover interactive elements on page
    const elements = new Map<string, ElementInfo>();

    const interactiveElements = await driver.findElements(
      By.css('a, button, input, select, textarea, [role="button"], [onclick]')
    );

    let refCount = 1;
    for (const el of interactiveElements.slice(0, 100)) {
      const ref = `e${refCount++}`;
      const info = await this.extractElementInfo(el, ref);
      elements.set(ref, info);
    }

    return elements;
  }

  private async extractElementInfo(el: WebElement, ref: string): Promise<ElementInfo> {
    const tagName = await el.getTagName();
    const text = await el.getText();
    const ariaLabel = await el.getAttribute('aria-label');

    return {
      ref,
      tagName,
      text: text.slice(0, 100),
      ariaLabel: ariaLabel || undefined,
      isClickable: ['a', 'button', 'input'].includes(tagName.toLowerCase()),
      attributes: {}
    };
  }

  private async findElement(driver: WebDriver, info: ElementInfo): Promise<WebElement> {
    // Multiple strategies to find element
    // ...implementation
  }
}
```

---

## Example Tool: Navigate

```typescript
// src/tools/navigation/navigate.ts

import { z } from 'zod';
import { BaseTool } from '../base';
import { Context } from '../../context';
import { ToolResult } from '../../types';

const schema = z.object({
  url: z.string().url().describe('URL to navigate to')
});

export class NavigateTool extends BaseTool {
  readonly name = 'navigate_to';
  readonly description = 'Navigate the browser to a URL';
  readonly inputSchema = schema;

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const { url } = this.parseParams(schema, params);

    const driver = await context.ensureBrowser();
    await driver.get(url);

    return this.success(`Navigated to ${url}`, true);
  }
}
```

---

## Tool Registry

```typescript
// src/tools/index.ts

import { BaseTool } from './base';

// Navigation
import { NavigateTool } from './navigation/navigate';
import { GoBackTool } from './navigation/back';
import { GoForwardTool } from './navigation/forward';

// Page
import { SnapshotTool } from './page/snapshot';
import { ScreenshotTool } from './page/screenshot';

// Elements
import { ClickTool } from './elements/click';
import { HoverTool } from './elements/hover';

// ... more imports

export function getAllTools(): BaseTool[] {
  return [
    // Navigation
    new NavigateTool(),
    new GoBackTool(),
    new GoForwardTool(),

    // Page
    new SnapshotTool(),
    new ScreenshotTool(),

    // Elements
    new ClickTool(),
    new HoverTool(),

    // ... more tools
  ];
}
```

---

## MCP Server

```typescript
// src/server.ts

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getAllTools } from './tools';
import { Context } from './context';

export async function createServer() {
  const server = new Server(
    { name: 'selenium-agent', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );

  const context = new Context();
  const tools = getAllTools();

  // List tools
  server.setRequestHandler('tools/list', async () => ({
    tools: tools.map(t => ({
      name: t.definition.name,
      description: t.definition.description,
      inputSchema: t.definition.inputSchema
    }))
  }));

  // Execute tool
  server.setRequestHandler('tools/call', async (request) => {
    const { name, arguments: args } = request.params;
    const tool = tools.find(t => t.name === name);

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const result = await tool.execute(context, args);

    if (result.captureSnapshot) {
      await context.captureSnapshot();
    }

    return {
      content: [{ type: 'text', text: result.content }],
      isError: result.isError
    };
  });

  return server;
}

export async function runServer() {
  const server = await createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

---

## CLI

```typescript
// bin/cli.ts

#!/usr/bin/env node

import { runServer } from '../src/server';

runServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
```

---

## Migration Order

### Phase 1: Setup
- [ ] Initialize npm package
- [ ] Configure TypeScript
- [ ] Create folder structure

### Phase 2: Core
- [ ] types.ts
- [ ] context.ts (browser management)
- [ ] tools/base.ts
- [ ] server.ts

### Phase 3: Essential Tools
- [ ] navigation/ (navigate, back, forward)
- [ ] page/ (snapshot, screenshot)
- [ ] elements/ (click, hover, select)
- [ ] input/ (type, keys)

### Phase 4: Additional Tools
- [ ] mouse/ (move, click, drag)
- [ ] tabs/ (list, select, new, close)
- [ ] verification/ (element, text, value)
- [ ] browser/ (wait, javascript, dialog)
- [ ] session/ (reset, close, recording)

### Phase 5: Finalize
- [ ] CLI setup
- [ ] Tests
- [ ] Documentation
- [ ] Publish to npm

---

## Tool Migration Checklist

| Python Tool | TypeScript Location | Status |
|-------------|--------------------| -------|
| navigate_to | navigation/navigate.ts | [ ] |
| go_back | navigation/back.ts | [ ] |
| go_forward | navigation/forward.ts | [ ] |
| capture_page | page/snapshot.ts | [ ] |
| take_screenshot | page/screenshot.ts | [ ] |
| generate_pdf | page/pdf.ts | [ ] |
| click_element | elements/click.ts | [ ] |
| hover_element | elements/hover.ts | [ ] |
| select_option | elements/select.ts | [ ] |
| drag_drop | elements/drag.ts | [ ] |
| input_text | input/type.ts | [ ] |
| key_press | input/keys.ts | [ ] |
| file_upload | input/file.ts | [ ] |
| mouse_move | mouse/move.ts | [ ] |
| mouse_click | mouse/click.ts | [ ] |
| mouse_drag | mouse/drag.ts | [ ] |
| tab_list | tabs/list.ts | [ ] |
| tab_select | tabs/select.ts | [ ] |
| tab_new | tabs/new.ts | [ ] |
| tab_close | tabs/close.ts | [ ] |
| verify_element | verification/element.ts | [ ] |
| verify_text | verification/text.ts | [ ] |
| verify_value | verification/value.ts | [ ] |
| verify_list | verification/list.ts | [ ] |
| wait_for | browser/wait.ts | [ ] |
| execute_js | browser/javascript.ts | [ ] |
| console_logs | browser/console.ts | [ ] |
| network_monitor | browser/network.ts | [ ] |
| handle_dialog | browser/dialog.ts | [ ] |
| resize_window | browser/resize.ts | [ ] |
| reset_session | session/reset.ts | [ ] |
| close_browser | session/close.ts | [ ] |
| start_recording | session/recording.ts | [ ] |
| stop_recording | session/recording.ts | [ ] |

---

## Result

```bash
# Simple installation
npm install -g selenium-agent

# Or run directly
npx selenium-agent

# MCP config
{
  "mcpServers": {
    "selenium": {
      "command": "npx",
      "args": ["selenium-agent"]
    }
  }
}
```

No Python. No venv. Just works.
