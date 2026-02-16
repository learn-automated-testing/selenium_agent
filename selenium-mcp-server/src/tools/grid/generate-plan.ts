import { z } from 'zod';
import { BaseTool } from '../base.js';
import { Context } from '../../context.js';
import { ToolResult, ToolCategory, DiscoveredPageDetail, FormInfo, DiscoveredWorkflow } from '../../types.js';
import { getTestPlansDir, resolveOutputDir } from '../../utils/paths.js';

const schema = z.object({
  explorationIds: z.array(z.string()).min(1).describe('Exploration IDs from parallel_explore results'),
  productName: z.string().optional().describe('Product name (inferred from page titles if omitted)'),
  baseUrl: z.string().optional().describe('Base URL (inferred from exploration targets if omitted)'),
  framework: z.enum(['selenium-python-pytest', 'playwright-js', 'webdriverio-ts', 'generic']).optional()
    .describe('Test framework (default: selenium-python-pytest)'),
  filename: z.string().optional().describe('Output filename (auto-generated if omitted)'),
  outputDir: z.string().optional().describe('Output directory for the test plan (default: test-plans/)'),
});

interface TestCase {
  id: string;
  name: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  steps: string[];
  expectedResults: string[];
}

interface TestSection {
  id: string;
  displayName: string;
  pages: DiscoveredPageDetail[];
  testCases: TestCase[];
}

export class PlannerGeneratePlanTool extends BaseTool {
  readonly name = 'planner_generate_plan';
  readonly description = '[Advanced — Grid] Generate a structured test plan from parallel exploration results. Takes exploration IDs and produces a markdown test plan file. Only relevant after parallel_explore.';
  readonly inputSchema = schema;
  readonly category: ToolCategory = 'grid';

  async execute(context: Context, params: unknown): Promise<ToolResult> {
    const parsed = this.parseParams(schema, params);
    const explorationIds = parsed.explorationIds;
    const framework = parsed.framework ?? 'selenium-python-pytest';

    const { coordinator } = await context.ensureGrid();

    // Validate exploration IDs
    for (const id of explorationIds) {
      const result = coordinator.getResult(id);
      if (!result) {
        return this.error(`Exploration not found: ${id}`);
      }
    }

    // Gather data
    const mergeResult = coordinator.merge(explorationIds);

    // Build deduplicated page list from individual results (has full FormInfo[])
    const allPages = this.collectDeduplicatedPages(explorationIds, coordinator);

    // Infer product name and base URL
    const productName = parsed.productName ?? this.inferProductName(allPages);
    const baseUrl = parsed.baseUrl ?? this.inferBaseUrl(explorationIds, coordinator);

    // Group pages into sections
    const sections = this.groupIntoSections(allPages);

    // Generate test cases per section
    for (const section of sections) {
      section.testCases = this.generateTestCases(section, mergeResult.allWorkflows);
    }

    // Sort: sections with forms first, then by page count descending
    sections.sort((a, b) => {
      const aForms = a.pages.reduce((sum, p) => sum + p.forms.length, 0);
      const bForms = b.pages.reduce((sum, p) => sum + p.forms.length, 0);
      if (aForms > 0 && bForms === 0) return -1;
      if (bForms > 0 && aForms === 0) return 1;
      return b.pages.length - a.pages.length;
    });

    // Count totals
    const totalTestCases = sections.reduce((sum, s) => sum + s.testCases.length, 0);
    const totalForms = allPages.reduce((sum, p) => sum + p.forms.length, 0);

    // Assemble markdown
    const markdown = this.assembleMarkdown({
      productName,
      baseUrl,
      framework,
      explorationIds,
      sections,
      allPages,
      workflows: mergeResult.allWorkflows,
      totalTestCases,
      totalForms,
      mergeResult,
    });

    // Save file
    const fs = await import('fs/promises');
    const path = await import('path');

    const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const finalFilename = parsed.filename ?? `${slug}_test_plan.md`;
    const plansDir = resolveOutputDir(parsed.outputDir, getTestPlansDir());

    try {
      await fs.mkdir(plansDir, { recursive: true });
      const planPath = path.join(plansDir, finalFilename);
      await fs.writeFile(planPath, markdown);

      const summary = [
        `Test plan saved to test-plans/${finalFilename}`,
        `  Pages: ${allPages.length}, Forms: ${totalForms}, Workflows: ${mergeResult.allWorkflows.length}`,
        `  Test cases: ${totalTestCases}, Sections: ${sections.length}`,
      ].join('\n');

      return this.success(summary, false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return this.error(`Failed to save test plan: ${message}`);
    }
  }

  private collectDeduplicatedPages(
    explorationIds: string[],
    coordinator: { getResult(id: string): { pages: DiscoveredPageDetail[] } | undefined }
  ): DiscoveredPageDetail[] {
    const seen = new Set<string>();
    const pages: DiscoveredPageDetail[] = [];

    for (const id of explorationIds) {
      const result = coordinator.getResult(id);
      if (!result) continue;
      for (const page of result.pages) {
        const normalized = this.normalizeUrl(page.url);
        if (!seen.has(normalized)) {
          seen.add(normalized);
          pages.push(page);
        }
      }
    }

    return pages;
  }

  private inferProductName(pages: DiscoveredPageDetail[]): string {
    // Try to extract from the first page's title (usually the home page)
    for (const page of pages) {
      if (page.title && page.title.trim()) {
        // Strip common suffixes like " - Home", " | Dashboard"
        const cleaned = page.title.split(/\s*[-|]\s*/)[0].trim();
        if (cleaned) return cleaned;
      }
    }
    return 'Web Application';
  }

  private inferBaseUrl(
    explorationIds: string[],
    coordinator: { getResult(id: string): { target: { url: string } } | undefined }
  ): string {
    for (const id of explorationIds) {
      const result = coordinator.getResult(id);
      if (result?.target?.url) {
        try {
          const u = new URL(result.target.url);
          return `${u.protocol}//${u.host}`;
        } catch { /* skip */ }
      }
    }
    return 'unknown';
  }

  private groupIntoSections(pages: DiscoveredPageDetail[]): TestSection[] {
    const groups = new Map<string, DiscoveredPageDetail[]>();

    for (const page of pages) {
      const segment = this.getFirstPathSegment(page.url);
      const existing = groups.get(segment);
      if (existing) {
        existing.push(page);
      } else {
        groups.set(segment, [page]);
      }
    }

    const sections: TestSection[] = [];
    for (const [segment, sectionPages] of groups) {
      const id = this.segmentToSectionId(segment);
      const displayName = this.segmentToDisplayName(segment);
      sections.push({ id, displayName, pages: sectionPages, testCases: [] });
    }

    return sections;
  }

  private getFirstPathSegment(url: string): string {
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[0] || '/';
    } catch {
      return '/';
    }
  }

  private segmentToSectionId(segment: string): string {
    if (segment === '/') return 'HOME';
    const cleaned = segment.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    return cleaned.slice(0, 4) || 'MISC';
  }

  private segmentToDisplayName(segment: string): string {
    if (segment === '/') return 'Home';

    const knownNames: Record<string, string> = {
      api: 'API',
      auth: 'Authentication',
      login: 'Authentication',
      signup: 'Registration',
      register: 'Registration',
      admin: 'Administration',
      dashboard: 'Dashboard',
      settings: 'Settings',
      profile: 'User Profile',
      users: 'Users',
      docs: 'Documentation',
    };

    const lower = segment.toLowerCase();
    if (knownNames[lower]) return knownNames[lower];

    // Capitalize and replace separators
    return segment
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  private generateTestCases(section: TestSection, workflows: DiscoveredWorkflow[]): TestCase[] {
    const cases: TestCase[] = [];
    let counter = 1;

    for (const page of section.pages) {
      const hasForms = page.forms.length > 0;
      const hasInternalLinks = page.links.some(l => l.isInternal);
      const hasInteractive = page.interactiveElements.length > 0;

      // Page load verification
      cases.push({
        id: `TC-${section.id}-${String(counter++).padStart(3, '0')}`,
        name: `Verify ${this.pageDisplayName(page)} loads correctly`,
        priority: hasForms ? 'High' : 'Low',
        description: `Verify that ${page.url} loads successfully and displays expected content.`,
        steps: [
          `Navigate to ${page.url}`,
          'Wait for page to fully load',
          'Verify page title is displayed',
        ],
        expectedResults: [
          `Page loads without errors`,
          `Page title contains "${page.title}"`,
          `Key content elements are visible`,
        ],
      });

      // Form test cases
      for (const form of page.forms) {
        const formName = this.inferFormName(form);
        const hasRequired = form.fields.some(f => f.required);

        // Happy path
        cases.push({
          id: `TC-${section.id}-${String(counter++).padStart(3, '0')}`,
          name: `Submit ${formName} with valid data`,
          priority: hasRequired ? 'Critical' : 'High',
          description: `Verify successful submission of ${formName} on ${page.url}.`,
          steps: [
            `Navigate to ${page.url}`,
            ...form.fields.map(f => `Enter valid data in "${f.name || f.type}" field${f.required ? ' (required)' : ''}`),
            `Submit the form`,
          ],
          expectedResults: [
            'Form submits successfully',
            'User receives confirmation or is redirected',
            'No error messages are displayed',
          ],
        });

        // Required field validation
        if (hasRequired) {
          cases.push({
            id: `TC-${section.id}-${String(counter++).padStart(3, '0')}`,
            name: `Validate required fields on ${formName}`,
            priority: 'High',
            description: `Verify validation errors when required fields are empty on ${formName}.`,
            steps: [
              `Navigate to ${page.url}`,
              'Leave all required fields empty',
              'Attempt to submit the form',
            ],
            expectedResults: [
              'Form does not submit',
              ...form.fields.filter(f => f.required).map(f =>
                `Validation error shown for "${f.name || f.type}" field`
              ),
            ],
          });
        }
      }

      // Navigation link verification
      if (hasInternalLinks) {
        const internalLinks = page.links.filter(l => l.isInternal);
        cases.push({
          id: `TC-${section.id}-${String(counter++).padStart(3, '0')}`,
          name: `Verify navigation links on ${this.pageDisplayName(page)}`,
          priority: 'Medium',
          description: `Verify all internal navigation links on ${page.url} are functional.`,
          steps: [
            `Navigate to ${page.url}`,
            ...internalLinks.slice(0, 5).map(l => `Click link "${l.text || l.href}"`),
          ],
          expectedResults: [
            ...internalLinks.slice(0, 5).map(l =>
              `Link "${l.text || l.href}" navigates to correct page`
            ),
            'No broken links encountered',
          ],
        });
      }

      // Interactive element verification
      if (hasInteractive && page.interactiveElements.length > 2) {
        cases.push({
          id: `TC-${section.id}-${String(counter++).padStart(3, '0')}`,
          name: `Verify interactive elements on ${this.pageDisplayName(page)}`,
          priority: 'Medium',
          description: `Verify interactive elements on ${page.url} respond correctly to user input.`,
          steps: [
            `Navigate to ${page.url}`,
            'Identify all interactive elements (buttons, inputs, dropdowns)',
            'Interact with each element',
          ],
          expectedResults: [
            `All ${page.interactiveElements.length} interactive elements are visible and enabled`,
            'Elements respond to click/input events',
            'No JavaScript errors in console',
          ],
        });
      }
    }

    // Workflow test cases
    const sectionUrls = new Set(section.pages.map(p => p.url));
    for (const workflow of workflows) {
      const isRelevant = workflow.steps.some(s => sectionUrls.has(s.url));
      if (isRelevant) {
        cases.push({
          id: `TC-${section.id}-${String(counter++).padStart(3, '0')}`,
          name: `End-to-end: ${workflow.name}`,
          priority: 'Critical',
          description: `Verify the complete workflow: ${workflow.name}`,
          steps: workflow.steps.map((s, i) => `Step ${i + 1}: ${s.action} at ${s.url}`),
          expectedResults: [
            'Workflow completes successfully end-to-end',
            'Each step transitions correctly to the next',
            'Final state is as expected',
          ],
        });
      }
    }

    return cases;
  }

  private pageDisplayName(page: DiscoveredPageDetail): string {
    if (page.title && page.title.trim()) return `"${page.title.trim()}"`;
    try {
      return `"${new URL(page.url).pathname}"`;
    } catch {
      return `"${page.url}"`;
    }
  }

  private inferFormName(form: FormInfo): string {
    const fieldNames = form.fields.map(f => f.name.toLowerCase());

    if (fieldNames.includes('username') && fieldNames.includes('password')) return 'Login Form';
    if (fieldNames.includes('email') && fieldNames.includes('password') && fieldNames.includes('confirm')) return 'Registration Form';
    if (fieldNames.length === 1 && (fieldNames[0] === 'search' || fieldNames[0] === 'q' || fieldNames[0] === 'query')) return 'Search Form';
    if (fieldNames.some(n => n.includes('email')) && fieldNames.length <= 2) return 'Email Form';
    if (fieldNames.some(n => n.includes('contact') || n.includes('message'))) return 'Contact Form';

    const action = form.action ? ` at ${form.action}` : '';
    return `${form.method.toUpperCase()} form${action}`;
  }

  private assembleMarkdown(data: {
    productName: string;
    baseUrl: string;
    framework: string;
    explorationIds: string[];
    sections: TestSection[];
    allPages: DiscoveredPageDetail[];
    workflows: DiscoveredWorkflow[];
    totalTestCases: number;
    totalForms: number;
    mergeResult: { totalPages: number; uniquePages: number; duplicatesRemoved: number };
  }): string {
    const lines: string[] = [];
    const date = new Date().toISOString().split('T')[0];

    // Header
    lines.push(`# Test Plan: ${data.productName}`);
    lines.push('');
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| **Product** | ${data.productName} |`);
    lines.push(`| **Base URL** | ${data.baseUrl} |`);
    lines.push(`| **Generated** | ${date} |`);
    lines.push(`| **Framework** | ${data.framework} |`);
    lines.push(`| **Exploration IDs** | ${data.explorationIds.join(', ')} |`);
    lines.push('');

    // Overview
    lines.push('## Overview');
    lines.push('');
    lines.push(`This test plan was auto-generated from ${data.explorationIds.length} parallel exploration(s) covering ${data.allPages.length} unique pages.`);
    lines.push('');
    lines.push('| Section | Pages | Forms | Test Cases |');
    lines.push('|---------|-------|-------|------------|');
    for (const section of data.sections) {
      const forms = section.pages.reduce((sum, p) => sum + p.forms.length, 0);
      lines.push(`| ${section.displayName} | ${section.pages.length} | ${forms} | ${section.testCases.length} |`);
    }
    lines.push(`| **Total** | **${data.allPages.length}** | **${data.totalForms}** | **${data.totalTestCases}** |`);
    lines.push('');

    // Environment Setup
    lines.push('## Environment Setup');
    lines.push('');
    lines.push(this.getFrameworkSetup(data.framework));
    lines.push('');

    // Test Scenarios
    lines.push('## Test Scenarios');
    lines.push('');

    for (const section of data.sections) {
      lines.push(`### ${section.displayName}`);
      lines.push('');
      lines.push(`Pages: ${section.pages.map(p => p.url).join(', ')}`);
      lines.push('');

      for (const tc of section.testCases) {
        lines.push(`#### ${tc.id}: ${tc.name}`);
        lines.push(`**Priority**: ${tc.priority}`);
        lines.push(`**Description**: ${tc.description}`);
        lines.push('');
        lines.push('**Steps**:');
        for (let i = 0; i < tc.steps.length; i++) {
          lines.push(`${i + 1}. ${tc.steps[i]}`);
        }
        lines.push('');
        lines.push('**Expected Results**:');
        for (const r of tc.expectedResults) {
          lines.push(`- ${r}`);
        }
        lines.push('');
      }
    }

    // Test Data Requirements
    const allFormFields = data.allPages.flatMap(p => p.forms.flatMap(f => f.fields));
    if (allFormFields.length > 0) {
      lines.push('## Test Data Requirements');
      lines.push('');
      lines.push('Based on discovered form fields, the following test data is suggested:');
      lines.push('');
      lines.push('| Field Name | Type | Required | Suggested Test Value |');
      lines.push('|------------|------|----------|---------------------|');

      const seenFields = new Set<string>();
      for (const field of allFormFields) {
        const key = `${field.name}|${field.type}`;
        if (seenFields.has(key) || !field.name) continue;
        seenFields.add(key);
        const suggested = this.suggestTestValue(field);
        lines.push(`| ${field.name} | ${field.type} | ${field.required ? 'Yes' : 'No'} | ${suggested} |`);
      }
      lines.push('');
    }

    // Exploration Summary
    lines.push('## Exploration Summary');
    lines.push('');
    lines.push(`- **Total pages scanned**: ${data.mergeResult.totalPages}`);
    lines.push(`- **Unique pages**: ${data.mergeResult.uniquePages}`);
    lines.push(`- **Duplicates removed**: ${data.mergeResult.duplicatesRemoved}`);
    lines.push(`- **Forms discovered**: ${data.totalForms}`);
    lines.push(`- **Workflows detected**: ${data.workflows.length}`);

    if (data.workflows.length > 0) {
      lines.push('');
      lines.push('### Detected Workflows');
      lines.push('');
      for (const wf of data.workflows) {
        lines.push(`- **${wf.name}** (${wf.steps.length} steps)`);
      }
    }

    lines.push('');

    return lines.join('\n');
  }

  private getFrameworkSetup(framework: string): string {
    switch (framework) {
      case 'selenium-python-pytest':
        return [
          '```bash',
          'pip install selenium pytest pytest-html',
          '```',
          '',
          'Prerequisites:',
          '- Python 3.8+',
          '- ChromeDriver or GeckoDriver in PATH',
          '- Selenium Grid (optional, for parallel execution)',
        ].join('\n');
      case 'playwright-js':
        return [
          '```bash',
          'npm install @playwright/test',
          'npx playwright install',
          '```',
          '',
          'Prerequisites:',
          '- Node.js 16+',
          '- Playwright browsers installed',
        ].join('\n');
      case 'webdriverio-ts':
        return [
          '```bash',
          'npm install @wdio/cli typescript',
          'npx wdio config',
          '```',
          '',
          'Prerequisites:',
          '- Node.js 16+',
          '- TypeScript configured',
          '- WebDriver service running',
        ].join('\n');
      default:
        return 'Configure your preferred test framework and browser drivers.';
    }
  }

  private suggestTestValue(field: { name: string; type: string }): string {
    const name = field.name.toLowerCase();
    const type = field.type.toLowerCase();

    if (name.includes('email') || type === 'email') return '`test@example.com`';
    if (name.includes('password') || type === 'password') return '`TestPass123!`';
    if (name.includes('phone') || type === 'tel') return '`+1-555-0100`';
    if (name.includes('name') && name.includes('first')) return '`John`';
    if (name.includes('name') && name.includes('last')) return '`Doe`';
    if (name.includes('name')) return '`Test User`';
    if (name.includes('url') || type === 'url') return '`https://example.com`';
    if (name.includes('date') || type === 'date') return '`2024-01-15`';
    if (name.includes('search') || name === 'q' || name === 'query') return '`test search term`';
    if (type === 'number') return '`42`';
    if (type === 'checkbox') return '`checked`';
    if (type === 'text') return '`Sample text`';

    return '`test_value`';
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hash = '';
      const path = u.pathname.replace(/\/+$/, '') || '/';
      u.pathname = path;
      u.searchParams.sort();
      return u.toString();
    } catch {
      return url;
    }
  }
}
