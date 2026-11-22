/**
 * JUnit XML: the result format every test runner can write (pytest --junitxml, Maven Surefire, Gradle, dotnet test
 * with the JUnit logger, mocha-junit-reporter, jest-junit, WebdriverIO's junit reporter, Robot Framework --xunit,
 * Playwright's junit reporter) and every CI system, ReportPortal and Allure can read.
 *
 * A small, dependency-free reader: it only needs the test cases, their outcome, time and failure message.
 */

export type CaseStatus = 'passed' | 'failed' | 'skipped';

export interface TestCaseResult {
  name: string;
  classname: string;
  /** The test file, when the runner writes it (pytest xunit1, mocha-junit-reporter, jest-junit with addFileAttribute). */
  file?: string;
  time: number;
  status: CaseStatus;
  /** First line of the failure or error message. */
  message?: string;
  /** <property name value> pairs of the test case (pytest record_property, ...). */
  properties?: Record<string, string>;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    if (e[0] !== '#') return ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : m;
  });
}

export function encodeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function attributes(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1]] = decodeXml(m[2] ?? m[3] ?? '');
  return out;
}

function firstLine(text: string | undefined): string | undefined {
  const line = text?.split('\n').map(l => l.trim()).find(Boolean);
  return line ? line.slice(0, 300) : undefined;
}

/** All test cases in a JUnit XML document (testsuites, nested testsuites or a single testsuite). */
export function parseJUnitXml(xml: string): TestCaseResult[] {
  // Comments out, until none is left (a removed comment can join the halves of another); then CDATA as escaped text.
  let body = xml;
  for (let before = ''; before !== body;) {
    before = body;
    body = body.replace(/<!--[\s\S]*?-->/g, '');
  }
  body = body.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, c: string) => encodeXml(c));
  const cases: TestCaseResult[] = [];
  // The file attribute of the enclosing <testsuite>, for runners that only put it there (mocha-junit-reporter).
  const suiteFiles: Array<{ at: number; file?: string }> = [];
  for (const m of body.matchAll(/<testsuite\b([^>]*)>/g)) suiteFiles.push({ at: m.index ?? 0, file: attributes(m[1]).file });
  const suiteFileAt = (at: number) => [...suiteFiles].reverse().find(s => s.at < at)?.file;

  for (const m of body.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const a = attributes(m[1]);
    const inner = m[3] ?? '';
    const problem = /<(failure|error)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/.exec(inner);
    const skipped = /<skipped\b/.test(inner);
    const properties: Record<string, string> = {};
    for (const p of inner.matchAll(/<property\b([^>]*)\/?>/g)) {
      const pa = attributes(p[1]);
      if (pa.name) properties[pa.name] = pa.value ?? '';
    }
    const file = a.file || suiteFileAt(m.index ?? 0);
    cases.push({
      name: a.name ?? '',
      classname: a.classname ?? '',
      ...(file ? { file } : {}),
      time: parseFloat(a.time ?? '0') || 0,
      status: problem ? 'failed' : skipped ? 'skipped' : 'passed',
      ...(problem ? { message: firstLine(attributes(problem[2]).message) ?? firstLine(decodeXml(problem[3] ?? '')) } : {}),
      ...(Object.keys(properties).length ? { properties } : {}),
    });
  }
  return cases;
}

export interface ResultSummary { total: number; passed: number; failed: number; skipped: number; time: number }

export function summarize(cases: TestCaseResult[]): ResultSummary {
  return {
    total: cases.length,
    passed: cases.filter(c => c.status === 'passed').length,
    failed: cases.filter(c => c.status === 'failed').length,
    skipped: cases.filter(c => c.status === 'skipped').length,
    time: Math.round(cases.reduce((t, c) => t + c.time, 0) * 100) / 100,
  };
}
