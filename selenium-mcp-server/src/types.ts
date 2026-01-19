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
