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
import { CloseBrowserTool, ResetSessionTool } from './session/index.js';

// Recording
import { StartRecordingTool, StopRecordingTool, RecordingStatusTool, ClearRecordingTool } from './recording/index.js';

// Generator
import { GenerateScriptTool } from './generator/index.js';

// Agent tools
import {
  PlannerSetupTool,
  PlannerExplorePageTool,
  PlannerSavePlanTool,
  GeneratorSetupTool,
  GeneratorReadLogTool,
  GeneratorWriteTestTool,
  HealerRunTestsTool,
  HealerDebugTestTool,
  HealerFixTestTool,
  BrowserGenerateLocatorTool
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

export function getAllTools(): BaseTool[] {
  return [
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

    // Session (2)
    new CloseBrowserTool(),
    new ResetSessionTool(),

    // Recording (4)
    new StartRecordingTool(),
    new StopRecordingTool(),
    new RecordingStatusTool(),
    new ClearRecordingTool(),

    // Generator (1)
    new GenerateScriptTool(),

    // Planner Agent (3)
    new PlannerSetupTool(),
    new PlannerExplorePageTool(),
    new PlannerSavePlanTool(),

    // Generator Agent (3)
    new GeneratorSetupTool(),
    new GeneratorReadLogTool(),
    new GeneratorWriteTestTool(),

    // Healer Agent (4)
    new HealerRunTestsTool(),
    new HealerDebugTestTool(),
    new HealerFixTestTool(),
    new BrowserGenerateLocatorTool(),

    // Analyzer (6)
    new AnalyzerSetupTool(),
    new AnalyzerImportContextTool(),
    new AnalyzerScanProductTool(),
    new AnalyzerBuildRiskProfileTool(),
    new AnalyzerSaveProfileTool(),
    new AnalyzerGenerateDocumentationTool(),
  ];
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
  // Recording
  StartRecordingTool,
  StopRecordingTool,
  RecordingStatusTool,
  ClearRecordingTool,
  // Generator
  GenerateScriptTool,
  // Planner Agent
  PlannerSetupTool,
  PlannerExplorePageTool,
  PlannerSavePlanTool,
  // Generator Agent
  GeneratorSetupTool,
  GeneratorReadLogTool,
  GeneratorWriteTestTool,
  // Healer Agent
  HealerRunTestsTool,
  HealerDebugTestTool,
  HealerFixTestTool,
  BrowserGenerateLocatorTool,
  // Analyzer
  AnalyzerSetupTool,
  AnalyzerImportContextTool,
  AnalyzerScanProductTool,
  AnalyzerBuildRiskProfileTool,
  AnalyzerSaveProfileTool,
  AnalyzerGenerateDocumentationTool,
};
