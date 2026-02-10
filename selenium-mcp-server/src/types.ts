import { WebDriver, WebElement } from 'selenium-webdriver';
import { z } from 'zod';

// Element reference from page snapshot
export interface ElementInfo {
  ref: string;           // e1, e2, e3...
  tagName: string;
  text: string;
  ariaLabel?: string;
  isClickable: boolean;
  isVisible: boolean;
  attributes: Record<string, string>;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Page state snapshot
export interface PageSnapshot {
  url: string;
  title: string;
  elements: Map<string, ElementInfo>;
  timestamp: number;
}

// Tool execution result
export interface ToolResult {
  content: string;
  isError?: boolean;
  captureSnapshot?: boolean;
  base64Image?: string;
}

// Expectation types for controlling tool response content
export interface SnapshotOptions {
  selector?: string;     // CSS selector to scope element discovery
  maxLength?: number;    // Max characters for snapshot text
}

export interface ConsoleOptions {
  levels?: ('error' | 'warn' | 'info' | 'log')[];
  maxMessages?: number;
}

export interface DiffOptions {
  enabled?: boolean;
  format?: 'minimal' | 'unified';
}

export interface Expectation {
  includeSnapshot?: boolean;
  includeConsole?: boolean;
  snapshotOptions?: SnapshotOptions;
  consoleOptions?: ConsoleOptions;
  diffOptions?: DiffOptions;
}

export type ToolCategory =
  | 'navigation' | 'interaction' | 'input' | 'page'
  | 'verification' | 'browser' | 'wait' | 'recording'
  | 'session' | 'agent' | 'analyzer' | 'generator' | 'batch'
  | 'grid';

export const DEFAULT_EXPECTATIONS: Record<ToolCategory, Expectation> = {
  navigation:   { includeSnapshot: true,  includeConsole: false },
  interaction:  { includeSnapshot: true,  includeConsole: false },
  input:        { includeSnapshot: true,  includeConsole: false },
  page:         { includeSnapshot: false, includeConsole: false },
  verification: { includeSnapshot: false, includeConsole: false },
  browser:      { includeSnapshot: false, includeConsole: false },
  wait:         { includeSnapshot: true,  includeConsole: false },
  recording:    { includeSnapshot: false, includeConsole: false },
  session:      { includeSnapshot: false, includeConsole: false },
  agent:        { includeSnapshot: true,  includeConsole: false },
  analyzer:     { includeSnapshot: false, includeConsole: false },
  generator:    { includeSnapshot: false, includeConsole: false },
  batch:        { includeSnapshot: false, includeConsole: false },
  grid:         { includeSnapshot: false, includeConsole: false },
};

// Tool definition for MCP
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
}

// Browser configuration
export interface BrowserConfig {
  headless?: boolean;
  windowSize?: {
    width: number;
    height: number;
  };
  userAgent?: string;
  proxy?: string;
}

// Console log entry
export interface ConsoleLogEntry {
  level: string;
  message: string;
  timestamp: number;
  source?: string;
}

// Network request entry
export interface NetworkEntry {
  url: string;
  method: string;
  status?: number;
  responseTime?: number;
  contentType?: string;
}

// Tab information
export interface TabInfo {
  handle: string;
  title: string;
  url: string;
  isActive: boolean;
}

// --- Selenium Grid types ---

export interface GridNodeInfo {
  id: string;
  uri: string;
  status: string;
  maxSessions: number;
  activeSessions: number;
  browsers: { browserName: string; browserVersion: string; platformName: string }[];
}

export interface GridStatus {
  ready: boolean;
  message: string;
  nodes: GridNodeInfo[];
  totalSlots: number;
  usedSlots: number;
  availableSlots: number;
}

export interface GridSessionInfo {
  sessionId: string;
  browser: string;
  tags: string[];
  createdAt: number;
  url?: string;
  title?: string;
}

export interface GridSessionCapabilities {
  browserName?: string;
  browserVersion?: string;
  platformName?: string;
  [key: string]: unknown;
}

// --- Exploration types ---

export interface ExplorationTarget {
  url: string;
  label?: string;
  maxDepth?: number;
  maxPages?: number;
  auth?: { username: string; password: string; loginUrl?: string; usernameSelector?: string; passwordSelector?: string; submitSelector?: string };
}

export interface DiscoveredPageDetail {
  url: string;
  title: string;
  depth: number;
  elements: number;
  forms: FormInfo[];
  links: LinkInfo[];
  interactiveElements: string[];
}

export interface FormInfo {
  action: string;
  method: string;
  fields: { name: string; type: string; required: boolean; label?: string }[];
}

export interface LinkInfo {
  href: string;
  text: string;
  isInternal: boolean;
}

export interface DiscoveredWorkflow {
  name: string;
  steps: { url: string; action: string; elementRef?: string }[];
}

export interface ExplorationResult {
  explorationId: string;
  target: ExplorationTarget;
  sessionId: string;
  status: 'completed' | 'failed' | 'partial';
  error?: string;
  pages: DiscoveredPageDetail[];
  workflows: DiscoveredWorkflow[];
  startedAt: number;
  completedAt: number;
  duration: number;
}

export interface ExplorationMergeResult {
  mergedAt: number;
  explorationIds: string[];
  totalPages: number;
  uniquePages: number;
  duplicatesRemoved: number;
  siteMap: SiteMapEntry[];
  allForms: FormInfo[];
  allWorkflows: DiscoveredWorkflow[];
}

export interface SiteMapEntry {
  url: string;
  title: string;
  depth: number;
  discoveredBy: string[];
  forms: number;
  links: number;
  interactiveElements: number;
}

// --- Parallel execution types ---

export interface ParallelTask {
  sessionId?: string;
  browser?: string;
  tags?: string[];
  steps: { tool: string; arguments: Record<string, unknown> }[];
}

export interface ParallelTaskResult {
  taskIndex: number;
  sessionId: string;
  status: 'completed' | 'failed';
  error?: string;
  stepResults: { step: number; tool: string; status: 'success' | 'error' | 'skipped'; content: string }[];
}
