import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { detectProject } from './project-detect.js';
import { GeneratorSetupTool } from './tools/agents/generator.js';

describe('project detection (language and test runner)', () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-')); });
  const write = (f: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  };
  const detect = () => detectProject(dir);

  it('returns null for an empty project', () => {
    expect(detect()).to.equal(null);
  });

  it('Java with Maven: JUnit 5 by default, TestNG when the pom uses it', () => {
    write('pom.xml', '<dependency><artifactId>junit-jupiter</artifactId></dependency>');
    expect(detect()).to.include({ framework: 'selenium-java-maven', language: 'Java', testRunner: 'JUnit 5', evidence: 'pom.xml' });
    write('pom.xml', '<dependency><groupId>org.testng</groupId><artifactId>testng</artifactId></dependency>');
    expect(detect()).to.include({ testRunner: 'TestNG' });
  });

  it('Java with Gradle, also in a sub-module', () => {
    write('e2e/build.gradle.kts', 'testImplementation("org.seleniumhq.selenium:selenium-java:4.53.0")');
    expect(detect()).to.include({ framework: 'selenium-java-gradle', testRunner: 'JUnit 5', evidence: 'e2e/build.gradle.kts' });
  });

  it('Python: pytest from pytest.ini or requirements, unittest from the tests', () => {
    write('requirements.txt', 'selenium==4.53.0\npytest\n');
    expect(detect()).to.include({ framework: 'selenium-python-pytest', testRunner: 'pytest', evidence: 'requirements.txt' });
    fs.writeFileSync(path.join(dir, 'requirements.txt'), 'selenium==4.53.0\n');
    write('tests/test_login.py', 'import unittest\nclass LoginTest(unittest.TestCase):\n    pass\n');
    expect(detect()).to.include({ framework: 'selenium-python-unittest', testRunner: 'unittest' });
    write('pytest.ini', '[pytest]\n');
    expect(detect()).to.include({ framework: 'selenium-python-pytest', evidence: 'pytest.ini' });
  });

  it('C#: NUnit, xUnit or MSTest from the .csproj', () => {
    write('Tests/Tests.csproj', '<PackageReference Include="xunit" />');
    expect(detect()).to.include({ framework: 'selenium-csharp-xunit', language: 'C#', testRunner: 'xUnit', evidence: 'Tests/Tests.csproj' });
    fs.writeFileSync(path.join(dir, 'Tests/Tests.csproj'), '<PackageReference Include="MSTest.TestFramework" />');
    expect(detect()).to.include({ framework: 'selenium-csharp-mstest' });
    fs.writeFileSync(path.join(dir, 'Tests/Tests.csproj'), '<PackageReference Include="NUnit" />');
    expect(detect()).to.include({ framework: 'selenium-csharp-nunit' });
  });

  it('JavaScript / TypeScript: selenium-webdriver with Mocha or Jest, and WebdriverIO', () => {
    write('package.json', '{"devDependencies":{"selenium-webdriver":"^4.38.0","mocha":"^11.0.0"}}');
    expect(detect()).to.include({ framework: 'selenium-js-mocha', testRunner: 'Mocha' });
    write('package.json', '{"devDependencies":{"selenium-webdriver":"^4.38.0","jest":"^30.0.0"}}');
    expect(detect()).to.include({ framework: 'selenium-js-jest', testRunner: 'Jest' });
    write('package.json', '{"devDependencies":{"@wdio/cli":"^9.20.0","typescript":"^5.9.0"}}');
    expect(detect()).to.include({ framework: 'webdriverio-ts', language: 'TypeScript', testRunner: 'WebdriverIO' });
  });

  it('Robot Framework from .robot files or requirements', () => {
    write('tests/login.robot', '*** Test Cases ***\n');
    expect(detect()).to.include({ framework: 'robot-framework', evidence: 'tests/login.robot' });
  });

  describe('generator_setup_page', () => {
    const ctx = () => ({
      generatorFramework: undefined, startRecording: () => undefined, captureSnapshot: async () => undefined,
      ensureBrowser: async () => ({ get: async () => undefined }),
    }) as never;
    const setup = async (args: Record<string, unknown>) =>
      JSON.parse((await new GeneratorSetupTool().execute(ctx(), { url: 'https://example.com', testPlan: 'p', ...args })).content.split('\n\n#')[0]);

    it("uses the project's own stack when no framework is named, and says why", async () => {
      write('pom.xml', '<artifactId>testng</artifactId>');
      const r = await setup({ projectRoot: dir });
      expect(r.framework).to.equal('selenium-java-maven');
      expect(r.testRunner).to.equal('TestNG');
      expect(r.frameworkSource).to.equal('detected: Java with TestNG (pom.xml)');
    });

    it('uses Python with pytest in an empty project, and a named framework over the project', async () => {
      expect((await setup({ projectRoot: dir })).frameworkSource).to.equal('default: no build files found, so Python with pytest');
      write('pom.xml', '<project/>');
      const named = await setup({ projectRoot: dir, framework: 'robot-framework' });
      expect(named.framework).to.equal('robot-framework');
      expect(named.frameworkSource).to.equal('named by the user');
    });
  });
});
