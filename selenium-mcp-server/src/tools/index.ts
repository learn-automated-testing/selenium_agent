import { BaseTool } from './base.js';

// Navigation
import { NavigateTool, GoBackTool, GoForwardTool, RefreshTool } from './navigation/index.js';

// Page
import { SnapshotTool, ScreenshotTool } from './page/index.js';

// Elements
import { ClickTool, HoverTool, SelectTool, DragDropTool } from './elements/index.js';

// Input
import { TypeTool, KeyPressTool, FileUploadTool } from './input/index.js';

// Mouse
import { MouseMoveTool, MouseClickTool, MouseDragTool } from './mouse/index.js';

// Tabs
import { TabListTool, TabSelectTool, TabNewTool, TabCloseTool } from './tabs/index.js';

// Verification
import { VerifyElementVisibleTool, VerifyTextVisibleTool, VerifyValueTool, VerifyListVisibleTool } from './verification/index.js';

// Browser
import { WaitTool, JavaScriptTool, ResizeTool, DialogTool, ConsoleTool, NetworkTool, PDFTool } from './browser/index.js';

// Session
import { CloseBrowserTool, ResetSessionTool, SetStealthModeTool } from './session/index.js';

// Recording
import { StartRecordingTool, StopRecordingTool, RecordingStatusTool, ClearRecordingTool } from './recording/index.js';

// Agent tools
import {
  PlannerSetupTool,
  PlannerExplorePageTool,
  PlannerSavePlanTool,
  GeneratorSetupTool,
  GeneratorReadLogTool,
  GeneratorWriteTestTool,
  GeneratorWriteSeedTestTool,
  HealerRunTestsTool,
  HealerDebugTestTool,
  HealerFixTestTool,
  BrowserGenerateLocatorTool,
  HealerInspectPageTool,
  GeneratorSaveSpecTool,
  GeneratorReadSpecTool,
} from './agents/index.js';

// Analyzer tools
import {
  AnalyzerSetupTool,
  AnalyzerImportContextTool,
  AnalyzerScanProductTool,
  AnalyzerBuildRiskProfileTool,
  AnalyzerSaveProfileTool,
  AnalyzerGenerateDocumentationTool
} from './analyzer/index.js';

// Batch
import { BatchExecuteTool } from './batch/index.js';

// Grid
import {
  GridStatusTool,
  GridStartTool,
  GridStopTool,
  GridScaleTool,
  SessionCreateTool,
  SessionSelectTool,
  SessionListTool,
  SessionDestroyTool,
  SessionDestroyAllTool,
  ParallelExploreTool,
  ParallelExecuteTool,
  ExplorationMergeTool,
  ExplorationDiffTool,
  PlannerGeneratePlanTool,
} from './grid/index.js';

async function isGridReachable(gridUrl: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${gridUrl.replace(/\/+$/, '')}/status`, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

export async function getAllTools(): Promise<BaseTool[]> {
  const batchTool = new BatchExecuteTool();

  const tools: BaseTool[] = [
    // Navigation (4)
    new NavigateTool(),
    new GoBackTool(),
    new GoForwardTool(),
    new RefreshTool(),

    // Page (2)
    new SnapshotTool(),
    new ScreenshotTool(),

    // Elements (4)
    new ClickTool(),
    new HoverTool(),
    new SelectTool(),
    new DragDropTool(),

    // Input (3)
    new TypeTool(),
    new KeyPressTool(),
    new FileUploadTool(),

    // Mouse (3)
    new MouseMoveTool(),
    new MouseClickTool(),
    new MouseDragTool(),

    // Tabs (4)
    new TabListTool(),
    new TabSelectTool(),
    new TabNewTool(),
    new TabCloseTool(),

    // Verification (4)
    new VerifyElementVisibleTool(),
    new VerifyTextVisibleTool(),
    new VerifyValueTool(),
    new VerifyListVisibleTool(),

    // Browser (7)
    new WaitTool(),
    new JavaScriptTool(),
    new ResizeTool(),
    new DialogTool(),
    new ConsoleTool(),
    new NetworkTool(),
    new PDFTool(),

    // Session (3)
    new CloseBrowserTool(),
    new ResetSessionTool(),
    new SetStealthModeTool(),

    // Recording (4)
    new StartRecordingTool(),
    new StopRecordingTool(),
    new RecordingStatusTool(),
    new ClearRecordingTool(),

    // Planner Agent (3)
    new PlannerSetupTool(),
    new PlannerExplorePageTool(),
    new PlannerSavePlanTool(),

    // Generator Agent (6)
    new GeneratorSetupTool(),
    new GeneratorReadLogTool(),
    new GeneratorWriteTestTool(),
    new GeneratorWriteSeedTestTool(),
    new GeneratorSaveSpecTool(),
    new GeneratorReadSpecTool(),

    // Healer Agent (5)
    new HealerRunTestsTool(),
    new HealerDebugTestTool(),
    new HealerFixTestTool(),
    new BrowserGenerateLocatorTool(),
    new HealerInspectPageTool(),

    // Analyzer (6)
    new AnalyzerSetupTool(),
    new AnalyzerImportContextTool(),
    new AnalyzerScanProductTool(),
    new AnalyzerBuildRiskProfileTool(),
    new AnalyzerSaveProfileTool(),
    new AnalyzerGenerateDocumentationTool(),

    // Batch (1)
    batchTool,
  ];

  // Always expose grid_start and grid_status so users can start/diagnose the grid
  const gridUrl = process.env.SELENIUM_GRID_URL;
  if (gridUrl) {
    tools.push(new GridStatusTool(), new GridStartTool(), new GridStopTool(), new GridScaleTool());

    // Only expose session/parallel tools when the grid is actually reachable
    if (await isGridReachable(gridUrl)) {
      const parallelExecuteTool = new ParallelExecuteTool();

      tools.push(
        new SessionCreateTool(),
        new SessionSelectTool(),
        new SessionListTool(),
        new SessionDestroyTool(),
        new SessionDestroyAllTool(),
        new ParallelExploreTool(),
        parallelExecuteTool,
        new ExplorationMergeTool(),
        new ExplorationDiffTool(),
        new PlannerGeneratePlanTool(),
      );

      parallelExecuteTool.setToolRegistry(tools);
      console.error('[selenium-mcp] Grid reachable at %s — all grid tools enabled (%d tools total)', gridUrl, tools.length);
    } else {
      console.error('[selenium-mcp] Grid not reachable at %s — only grid_start/grid_status/grid_stop/grid_scale available. Start the grid and restart the MCP server to enable session and parallel tools.', gridUrl);
    }
  } else {
    console.error('[selenium-mcp] SELENIUM_GRID_URL not set — grid tools disabled. Set the env var and start the grid to enable them.');
  }

  // Inject tool registry into batch tool
  batchTool.setToolRegistry(tools);

  return tools;
}

// Re-export all tools for direct access
export {
  // Navigation
  NavigateTool,
  GoBackTool,
  GoForwardTool,
  RefreshTool,
  // Page
  SnapshotTool,
  ScreenshotTool,
  // Elements
  ClickTool,
  HoverTool,
  SelectTool,
  DragDropTool,
  // Input
  TypeTool,
  KeyPressTool,
  FileUploadTool,
  // Mouse
  MouseMoveTool,
  MouseClickTool,
  MouseDragTool,
  // Tabs
  TabListTool,
  TabSelectTool,
  TabNewTool,
  TabCloseTool,
  // Verification
  VerifyElementVisibleTool,
  VerifyTextVisibleTool,
  VerifyValueTool,
  VerifyListVisibleTool,
  // Browser
  WaitTool,
  JavaScriptTool,
  ResizeTool,
  DialogTool,
  ConsoleTool,
  NetworkTool,
  PDFTool,
  // Session
  CloseBrowserTool,
  ResetSessionTool,
  SetStealthModeTool,
  // Recording
  StartRecordingTool,
  StopRecordingTool,
  RecordingStatusTool,
  ClearRecordingTool,
  // Planner Agent
  PlannerSetupTool,
  PlannerExplorePageTool,
  PlannerSavePlanTool,
  // Generator Agent
  GeneratorSetupTool,
  GeneratorReadLogTool,
  GeneratorWriteTestTool,
  GeneratorWriteSeedTestTool,
  GeneratorSaveSpecTool,
  GeneratorReadSpecTool,
  // Healer Agent
  HealerRunTestsTool,
  HealerDebugTestTool,
  HealerFixTestTool,
  BrowserGenerateLocatorTool,
  HealerInspectPageTool,
  // Analyzer
  AnalyzerSetupTool,
  AnalyzerImportContextTool,
  AnalyzerScanProductTool,
  AnalyzerBuildRiskProfileTool,
  AnalyzerSaveProfileTool,
  AnalyzerGenerateDocumentationTool,
  // Batch
  BatchExecuteTool,
  // Grid
  GridStatusTool,
  GridStartTool,
  GridStopTool,
  GridScaleTool,
  SessionCreateTool,
  SessionSelectTool,
  SessionListTool,
  SessionDestroyTool,
  SessionDestroyAllTool,
  ParallelExploreTool,
  ParallelExecuteTool,
  ExplorationMergeTool,
  ExplorationDiffTool,
  PlannerGeneratePlanTool,
};
