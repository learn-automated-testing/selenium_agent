/**
 * Test reports per framework. Selenium itself has no reporting: the test runner writes the results. Every generated
 * test suite writes JUnit XML (read by every CI system, ReportPortal and Allure); Allure is the richer option, used
 * when the user asks for it or the project already uses it.
 */
import fs from 'node:fs';
import path from 'node:path';

export type ReportFormat = 'junit' | 'allure';

export interface ReportSetup {
  /** Arguments added to the run command. */
  args: string[];
  /** Where the results land, relative to the project root: files, or folders with *.xml / *-result.json. */
  results: string[];
  /** What the project needs once: a package, a dependency or a line of config. Empty when nothing is needed. */
  setup: string[];
}

export interface FrameworkReporting { junit: ReportSetup; allure: ReportSetup }

const ALLURE_VIEW = 'View it with Allure Report 3 (no install or Java needed): npx allure generate allure-results && npx allure open allure-report. ' +
  'The plan is the epic, the suite the feature and the scenario the story; healer_run_tests writes an allurerc.mjs that shows that tree ' +
  '(when the project has no Allure config yet). Allure 2 shows it in its Behaviors tab.';

const PYTEST: FrameworkReporting = {
  junit: { args: ['--junitxml=reports/junit.xml'], results: ['reports/junit.xml'], setup: [] },
  allure: {
    args: ['--junitxml=reports/junit.xml', '--alluredir=allure-results'],
    results: ['allure-results'],
    setup: ['pip install allure-pytest', ALLURE_VIEW],
  },
};

const DOTNET = (adapter: string): FrameworkReporting => ({
  junit: {
    args: ['--logger', 'junit;LogFilePath=TestResults/junit.xml'],
    results: ['TestResults/junit.xml'],
    setup: ['dotnet add package JunitXml.TestLogger'],
  },
  allure: {
    args: ['--logger', 'junit;LogFilePath=TestResults/junit.xml'],
    results: ['allure-results'],
    setup: ['dotnet add package JunitXml.TestLogger', `dotnet add package ${adapter}`,
      'allureConfig.json in the test project: { "allure": { "directory": "../../../../allure-results" } } (relative to bin/<config>/<tfm>)', ALLURE_VIEW],
  },
});

export const REPORTING: Record<string, FrameworkReporting> = {
  'selenium-python-pytest': PYTEST,
  'pytest': PYTEST,
  'playwright-python': PYTEST,
  // unittest writes no JUnit XML; pytest runs unittest tests unchanged and does.
  'selenium-python-unittest': {
    junit: { args: ['--junitxml=reports/junit.xml'], results: ['reports/junit.xml'], setup: ['pip install pytest (it runs unittest tests as they are): python -m pytest --junitxml=reports/junit.xml'] },
    allure: { args: ['--junitxml=reports/junit.xml', '--alluredir=allure-results'], results: ['allure-results'], setup: ['pip install pytest allure-pytest', ALLURE_VIEW] },
  },
  'selenium-java-maven': {
    junit: { args: [], results: ['target/surefire-reports'], setup: [] },
    allure: {
      args: [], results: ['target/allure-results', 'allure-results'],
      setup: ['pom.xml: io.qameta.allure:allure-junit5 (or allure-testng) as a test dependency',
        'surefire systemPropertyVariables: <allure.results.directory>${project.build.directory}/allure-results</allure.results.directory>', ALLURE_VIEW.replace(/allure-results/g, 'target/allure-results')],
    },
  },
  'selenium-java-gradle': {
    junit: { args: [], results: ['build/test-results/test'], setup: [] },
    allure: { args: [], results: ['build/allure-results'], setup: ['build.gradle: plugins { id "io.qameta.allure" version "2.12.0" }', 'then: gradle allureReport'] },
  },
  'selenium-csharp-nunit': DOTNET('Allure.NUnit'),
  'selenium-csharp-xunit': DOTNET('Allure.Xunit'),
  'selenium-csharp-mstest': DOTNET('Allure.MSTest'),
  'selenium-js-mocha': {
    junit: {
      args: ['--reporter', 'mocha-junit-reporter', '--reporter-options', 'mochaFile=reports/junit.xml'],
      results: ['reports/junit.xml'], setup: ['npm install -D mocha-junit-reporter'],
    },
    allure: { args: ['--reporter', 'allure-mocha'], results: ['allure-results'], setup: ['npm install -D allure-mocha', ALLURE_VIEW] },
  },
  'selenium-js-jest': {
    junit: { args: ['--reporters=default', '--reporters=jest-junit'], results: ['junit.xml', 'reports/junit.xml'], setup: ['npm install -D jest-junit'] },
    allure: { args: [], results: ['allure-results'], setup: ['npm install -D allure-jest', 'jest.config: testEnvironment: "allure-jest/node"', ALLURE_VIEW] },
  },
  'webdriverio-ts': {
    junit: { args: [], results: ['reports/junit'], setup: ['npm install -D @wdio/junit-reporter', "wdio.conf: reporters: ['spec', ['junit', { outputDir: './reports/junit' }]]"] },
    allure: { args: [], results: ['allure-results'], setup: ['npm install -D @wdio/allure-reporter', "wdio.conf: reporters: ['spec', ['allure', { outputDir: 'allure-results' }]]", ALLURE_VIEW] },
  },
  'playwright-js': {
    junit: { args: [], results: ['reports/junit.xml'], setup: ["playwright.config: reporter: [['list'], ['junit', { outputFile: 'reports/junit.xml' }]]"] },
    allure: { args: [], results: ['allure-results'], setup: ['npm install -D allure-playwright', "playwright.config: reporter: [['list'], ['allure-playwright']]", ALLURE_VIEW] },
  },
  'robot-framework': {
    junit: { args: ['--xunit', 'junit.xml'], results: ['results/junit.xml'], setup: [] },
    allure: {
      args: ['--xunit', 'junit.xml', '--listener', 'allure_robotframework:allure-results'], results: ['allure-results'],
      setup: ['pip install allure-robotframework', ALLURE_VIEW],
    },
  },
};
REPORTING['webdriverio-js'] = REPORTING['webdriverio-ts'];

export function reportingFor(framework: string): FrameworkReporting | undefined {
  return REPORTING[framework];
}

/** Does the project already use Allure? A mention of allure in its build or dependency files, or allure-results/. */
export function projectUsesAllure(projectRoot: string): boolean {
  const files = ['requirements.txt', 'pyproject.toml', 'setup.cfg', 'Pipfile', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'package.json'];
  for (const f of files) {
    try {
      if (/allure/i.test(fs.readFileSync(path.join(projectRoot, f), 'utf8'))) return true;
    } catch { /* not there */ }
  }
  try {
    for (const f of fs.readdirSync(projectRoot)) {
      if (f.endsWith('.csproj') && /Allure\./.test(fs.readFileSync(path.join(projectRoot, f), 'utf8'))) return true;
    }
  } catch { /* unreadable */ }
  return fs.existsSync(path.join(projectRoot, 'allure-results'));
}

/** junit, or allure when asked for or already in use. */
export function chooseReportFormat(requested: ReportFormat | undefined, projectRoot: string): { format: ReportFormat; why: string } {
  if (requested) return { format: requested, why: 'asked for' };
  if (projectUsesAllure(projectRoot)) return { format: 'allure', why: 'the project already uses Allure' };
  return { format: 'junit', why: 'default: JUnit XML, read by every CI system, ReportPortal and Allure' };
}

/** The run command's arguments with the report arguments added (each only once). */
export function withReportArgs(args: string[], framework: string, format: ReportFormat): string[] {
  const extra = reportingFor(framework)?.[format].args ?? [];
  const out = [...args];
  for (let i = 0; i < extra.length; i++) {
    const a = extra[i];
    const flagWithValue = a.startsWith('-') && !a.includes('=') && extra[i + 1] !== undefined && !extra[i + 1].startsWith('-');
    const key = a.includes('=') ? a.slice(0, a.indexOf('=') + 1) : a;
    if (flagWithValue) {
      const value = extra[++i];
      const at = out.findIndex((x, j) => x === a && out[j + 1] === value);
      // A repeatable flag (--reporter, --logger) is added unless this exact pair is there.
      if (at === -1 && !(a === '--reporter' && out.includes('--reporter'))) out.push(a, value);
    } else if (!out.some(x => x === a || (key.endsWith('=') && x.startsWith(key)))) {
      out.push(a);
    }
  }
  return out;
}

/**
 * How to run one test file with a framework's runner (the healer's manifest mode). WebdriverIO takes --spec;
 * most runners take the file itself; Maven and Gradle take a test class name.
 */
export function singleFileArgs(framework: string, testPath: string, projectRoot: string): string[] {
  // Forward slashes: every runner takes them, also on Windows.
  const rel = (path.relative(projectRoot, testPath) || testPath).split(path.sep).join('/');
  if (framework.startsWith('webdriverio')) return ['--spec', rel];
  if (framework === 'selenium-java-maven') return [`-Dtest=${path.basename(testPath).replace(/\.\w+$/, '')}`];
  if (framework === 'selenium-java-gradle') return ['--tests', path.basename(testPath).replace(/\.\w+$/, '')];
  if (framework.startsWith('selenium-csharp')) return ['--filter', `FullyQualifiedName~${path.basename(testPath).replace(/\.\w+$/, '')}`];
  return [rel];
}

/**
 * Is this the project's own test runner? ".venv/bin/pytest" and "python -m pytest" are pytest; "./mvnw" is mvn,
 * "gradlew" is gradle. Used to add the report arguments to a command the AI chose itself.
 */
export function sameRunner(command: string, args: string[], projectCommand: string): boolean {
  const name = (c: string) => path.basename(c).replace(/\.(exe|cmd|bat)$/i, '').replace(/^mvnw$/, 'mvn').replace(/^gradlew$/, 'gradle');
  const runner = (c: string, a: string[]) => /^python[\d.]*$|^py$/.test(name(c)) && a[0] === '-m' && a[1] ? a[1] : name(c);
  return runner(command, args) === runner(projectCommand, []);
}
