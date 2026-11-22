#!/usr/bin/env node

import { runServer, runHttpServer } from '../src/server.js';
import { getOutputDir } from '../src/utils/paths.js';

// Parse CLI flags and set corresponding env vars
const args = process.argv.slice(2);

if (args[0] === 'install') {
  const { handleInstall } = await import('./install.js');
  handleInstall(args.slice(1));
  process.exit(0);
}

if (args[0] === 'init-agents') {
  const { initAgents, LOOPS } = await import('../src/init-agents.js');
  const value = (flag: string) => args.find(a => a.startsWith(`--${flag}=`))?.slice(flag.length + 3);
  const loop = value('loop') ?? 'claude';
  if (!(LOOPS as readonly string[]).includes(loop)) {
    console.error(`Unknown --loop=${loop}. Use one of: ${LOOPS.join(', ')}`);
    process.exit(1);
  }
  const result = initAgents({ loop: loop as (typeof LOOPS)[number], server: value('server') });
  console.log(`Selenium AI Agent: test agents for ${loop} (MCP server "${result.server}")\n`);
  for (const file of result.written) console.log(`  wrote ${file}`);
  if (result.mcpConfig) console.log(`  added the "${result.server}" server to ${result.mcpConfig}`);
  // --with-rules: Selenium's rules for AI agents in the loop's instruction file (or the files named)
  const { parseWithRules, printRulesResult } = await import('./install.js');
  const { writeProjectRules } = await import('../src/project-rules.js');
  const loopRules = { claude: 'claude', vscode: 'copilot', copilot: 'copilot', cursor: 'cursor' } as const;
  let targets;
  try {
    targets = parseWithRules(args, loopRules[loop as keyof typeof loopRules]);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
  if (targets?.length) printRulesResult(writeProjectRules({ targets, framework: value('framework') }));
  console.log('\nAsk your AI assistant to use the selenium-test-planner, -generator or -healer agent.');
  console.log('Run this again after updating selenium-ai-agent to pick up new tools and instructions.');
  process.exit(0);
}

if (args[0] === 'review') {
  // Review test plans yourself, without asking the AI: the overview of all plans with Approve / Request changes per plan.
  for (const arg of args.slice(1)) {
    if (arg.startsWith('--output-dir=')) process.env.SELENIUM_MCP_OUTPUT_DIR = arg.slice('--output-dir='.length);
    if (arg.startsWith('--specs-dir=')) process.env.SELENIUM_MCP_SPECS_DIR = arg.slice('--specs-dir='.length);
  }
  const portArg = args.find(a => a.startsWith('--port='));
  // A folder argument is the project (or output) folder with specs/; anything else is a plan name.
  const { existsSync, statSync } = await import('node:fs');
  const { resolve: resolvePath } = await import('node:path');
  const positional = args.slice(1).filter(a => !a.startsWith('--'));
  const folder = positional.find(a => existsSync(a) && statSync(a).isDirectory());
  const plan = positional.find(a => a !== folder);
  const { ensureReviewServer, reviewUrls, writeStaticPages, listPlans, openInBrowser, sharedFolderNote } = await import('../src/plan-review-server.js');
  const { getSpecsDir, specsDirFor } = await import('../src/utils/paths.js');
  if (folder) {
    const dir = resolvePath(folder);
    const { dirname } = await import('node:path');
    // The project folder (with specs/ or the configured plans folder in it), or the plans folder itself.
    if (!(await listPlans(specsDirFor(dir))).length && (await listPlans(dir)).length) {
      process.env.SELENIUM_MCP_OUTPUT_DIR = dirname(dir);
      process.env.SELENIUM_MCP_SPECS_DIR = dir;
    } else {
      process.env.SELENIUM_MCP_OUTPUT_DIR = dir;
    }
  }
  const plans = await listPlans();
  if (!plans.length) {
    const { findPlanFolders } = await import('../src/plan-review-server.js');
    const elsewhere = (await findPlanFolders()).filter(f => specsDirFor(f.dir) !== getSpecsDir());
    console.log(`No test plans in ${getSpecsDir()}.`);
    if (elsewhere.length) {
      console.log('Plans in other folders:');
      for (const f of elsewhere) console.log(`  npx selenium-ai-agent review ${f.dir}   (${f.plans} plan${f.plans === 1 ? '' : 's'})`);
    }
    console.log('');
  }
  if (plan && !plans.includes(plan.endsWith('.md') ? plan : `${plan}.md`)) {
    console.error(`No plan "${plan}" in ${getSpecsDir()}. Plans there: ${plans.join(', ') || 'none'}`);
    process.exit(1);
  }
  await ensureReviewServer({ keepAlive: true, port: portArg ? parseInt(portArg.slice('--port='.length), 10) : undefined });
  await writeStaticPages();
  const url = plan ? reviewUrls.plan(plan.endsWith('.md') ? plan : `${plan}.md`) : reviewUrls.overview();
  console.log(`Selenium AI Agent: test plan review for ${getSpecsDir()} (${plans.length} plan(s))`);
  const note = (await sharedFolderNote()).trim();
  console.log(note ? `${note}\n` : '');
  console.log(`  ${url}\n`);
  const opened = args.includes('--no-open') ? false : await openInBrowser(url);
  console.log(opened ? 'Opened in your browser. ' : 'Open the link above in your browser. ');
  console.log('Approve plans or request changes there; your AI assistant reads the decision from the plan.');
  console.log('The page only works on this computer. Press Ctrl+C to stop.');
  await new Promise(() => undefined);
}

if (args[0] === 'doctor') {
  const { runDoctor, formatDoctorReport } = await import('../src/doctor.js');
  const report = await runDoctor();
  console.log(formatDoctorReport(report));
  process.exit(report.ok ? 0 : 1);
}

let transport = 'stdio';
let port = 3000;

for (const arg of args) {
  switch (arg) {
    case '--allow-unrestricted-file-access':
      process.env.SELENIUM_MCP_UNRESTRICTED_FILES = 'true';
      break;
    case '--save-trace':
      process.env.SELENIUM_MCP_SAVE_TRACE = 'true';
      break;
    case '--stealth':
      process.env.SELENIUM_STEALTH = 'true';
      break;
    case '--headless':
      process.env.SELENIUM_HEADLESS = 'true';
      break;
    case '--no-plan-review':
      process.env.SELENIUM_MCP_PLAN_REVIEW = 'off';
      break;
    case '--verbose-attributes':
      process.env.SELENIUM_MCP_VERBOSE_ATTRIBUTES = 'true';
      break;
    case '--output-mode=file':
      process.env.SELENIUM_MCP_OUTPUT_MODE = 'file';
      break;
    case '--output-mode=stdout':
      process.env.SELENIUM_MCP_OUTPUT_MODE = 'stdout';
      break;
    default:
      if (arg.startsWith('--specs-dir=')) {
        process.env.SELENIUM_MCP_SPECS_DIR = arg.slice('--specs-dir='.length);
        break;
      }
      if (arg.startsWith('--output-dir=')) {
        process.env.SELENIUM_MCP_OUTPUT_DIR = arg.slice('--output-dir='.length);
      } else if (arg.startsWith('--toolsets=')) {
        process.env.SELENIUM_MCP_TOOLSETS = arg.slice('--toolsets='.length);
      } else if (arg.startsWith('--grid-url=')) {
        process.env.SELENIUM_GRID_URL = arg.slice('--grid-url='.length);
      } else if (arg.startsWith('--transport=')) {
        transport = arg.slice('--transport='.length);
      } else if (arg.startsWith('--port=')) {
        port = parseInt(arg.slice('--port='.length), 10);
      }
      break;
  }
}

if (transport === 'http') {
  runHttpServer(port).catch(err => {
    console.error('Failed to start Selenium MCP HTTP server:', err);
    process.exit(1);
  });
} else {
  console.error(`[selenium-mcp] Output folder for test plans, tests and reports: ${getOutputDir()}`);
  runServer().catch(err => {
    console.error('Failed to start Selenium MCP server:', err);
    process.exit(1);
  });
}
