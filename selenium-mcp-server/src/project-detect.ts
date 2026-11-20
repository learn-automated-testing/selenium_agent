/**
 * What language and test runner a project already uses, from its build files, so the generator writes tests
 * in the team's own stack: Java (JUnit 5 or TestNG), Python (pytest or unittest), C# (NUnit, xUnit or MSTest),
 * JavaScript/TypeScript (Mocha, Jest or WebdriverIO) or Robot Framework. Returns null for an empty project:
 * then the generator's default (Python with pytest) applies.
 */
import fs from 'fs';
import path from 'path';

export interface DetectedProject {
  /** A generator framework id, e.g. "selenium-java-maven". */
  framework: string;
  language: 'Java' | 'Python' | 'C#' | 'JavaScript' | 'TypeScript' | 'Robot Framework';
  /** The test runner the project uses, e.g. "JUnit 5", "TestNG", "pytest". */
  testRunner: string;
  /** The file the decision is based on, e.g. "pom.xml". */
  evidence: string;
}

const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', 'venv', 'target', 'build', 'dist', 'bin', 'obj', '.idea']);

/** Files in the project root and one level down (where C# test projects and Maven modules often sit). */
function listFiles(root: string): string[] {
  const out: string[] = [];
  let top: fs.Dirent[] = [];
  try { top = fs.readdirSync(root, { withFileTypes: true }); } catch { return out; }
  for (const e of top) {
    if (e.isFile()) out.push(e.name);
    else if (e.isDirectory() && !SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) {
      try {
        for (const f of fs.readdirSync(path.join(root, e.name), { withFileTypes: true })) {
          if (f.isFile()) out.push(path.join(e.name, f.name));
        }
      } catch { /* unreadable folder */ }
    }
  }
  return out;
}

export function detectProject(root: string): DetectedProject | null {
  const files = listFiles(root);
  const read = (f: string) => { try { return fs.readFileSync(path.join(root, f), 'utf8'); } catch { return ''; } };
  const has = (name: string) => files.includes(name);

  // JavaScript / TypeScript
  if (has('package.json')) {
    const pkg = read('package.json');
    const ts = has('tsconfig.json') || /"typescript"/.test(pkg);
    if (/"(@wdio\/cli|webdriverio)"/.test(pkg)) {
      return { framework: ts ? 'webdriverio-ts' : 'webdriverio-js', language: ts ? 'TypeScript' : 'JavaScript', testRunner: 'WebdriverIO', evidence: 'package.json' };
    }
    if (/"selenium-webdriver"/.test(pkg)) {
      const jest = /"jest"/.test(pkg);
      return {
        framework: jest ? 'selenium-js-jest' : 'selenium-js-mocha', language: ts ? 'TypeScript' : 'JavaScript',
        testRunner: jest ? 'Jest' : 'Mocha', evidence: 'package.json',
      };
    }
  }

  // Java: Maven or Gradle, JUnit 5 or TestNG
  const maven = has('pom.xml') ? 'pom.xml' : files.find(f => f.endsWith('/pom.xml'));
  const gradle = ['build.gradle', 'build.gradle.kts'].find(has) ?? files.find(f => /\/build\.gradle(\.kts)?$/.test(f));
  if (maven || gradle) {
    const build = read((maven ?? gradle)!);
    const testng = /testng/i.test(build);
    return {
      framework: maven ? 'selenium-java-maven' : 'selenium-java-gradle', language: 'Java',
      testRunner: testng ? 'TestNG' : 'JUnit 5', evidence: (maven ?? gradle)!,
    };
  }

  // C#: the test framework from the .csproj
  const csproj = files.find(f => f.endsWith('.csproj'));
  if (csproj || files.some(f => f.endsWith('.sln'))) {
    const proj = csproj ? read(csproj) : '';
    if (/xunit/i.test(proj)) return { framework: 'selenium-csharp-xunit', language: 'C#', testRunner: 'xUnit', evidence: csproj! };
    if (/MSTest/i.test(proj)) return { framework: 'selenium-csharp-mstest', language: 'C#', testRunner: 'MSTest', evidence: csproj! };
    return { framework: 'selenium-csharp-nunit', language: 'C#', testRunner: 'NUnit', evidence: csproj ?? files.find(f => f.endsWith('.sln'))! };
  }

  // Robot Framework
  const pyDeps = ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml', 'setup.cfg', 'Pipfile'].filter(has);
  const deps = pyDeps.map(read).join('\n');
  const robotFile = files.find(f => f.endsWith('.robot'));
  if (/robotframework/i.test(deps) || robotFile) {
    return { framework: 'robot-framework', language: 'Robot Framework', testRunner: 'Robot Framework', evidence: robotFile ?? pyDeps[0] };
  }

  // Python: pytest or unittest
  const pytestMarker = ['pytest.ini', 'conftest.py', 'tox.ini'].find(has) ?? files.find(f => f.endsWith('/conftest.py'));
  if (pyDeps.length || pytestMarker || files.some(f => f.endsWith('.py'))) {
    const usesPytest = Boolean(pytestMarker) || /\bpytest\b/i.test(deps);
    const usesUnittest = !usesPytest && files.some(f => f.endsWith('.py') && /import unittest|unittest\.TestCase/.test(read(f)));
    if (usesUnittest) {
      return { framework: 'selenium-python-unittest', language: 'Python', testRunner: 'unittest', evidence: files.find(f => f.endsWith('.py') && /unittest/.test(read(f)))! };
    }
    return { framework: 'selenium-python-pytest', language: 'Python', testRunner: 'pytest', evidence: pytestMarker ?? pyDeps[0] ?? 'Python files' };
  }

  return null;
}
