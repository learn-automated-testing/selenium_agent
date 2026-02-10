// Main exports
export { createServer, runServer } from './server.js';
export { Context } from './context.js';
export { BaseTool, ExpectationSchema } from './tools/base.js';
export { getAllTools } from './tools/index.js';

// Grid exports
export { GridClient, GridSession, SessionPool, SessionContext, ExplorationCoordinator } from './grid/index.js';

// Type exports
export type {
  ElementInfo,
  PageSnapshot,
  ToolResult,
  ToolDefinition,
  BrowserConfig,
  ConsoleLogEntry,
  NetworkEntry,
  TabInfo,
  Expectation,
  SnapshotOptions,
  ConsoleOptions,
  DiffOptions,
  ToolCategory,
  GridNodeInfo,
  GridStatus,
  GridSessionInfo,
  GridSessionCapabilities,
  ExplorationTarget,
  ExplorationResult,
  ExplorationMergeResult,
  DiscoveredPageDetail,
  FormInfo,
  LinkInfo,
  DiscoveredWorkflow,
  SiteMapEntry,
  ParallelTask,
  ParallelTaskResult,
} from './types.js';

export { DEFAULT_EXPECTATIONS } from './types.js';

// Utility exports
export { discoverElements, extractElementInfo, findElementByInfo } from './utils/element-discovery.js';
