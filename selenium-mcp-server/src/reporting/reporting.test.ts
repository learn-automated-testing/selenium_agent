import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseJUnitXml, summarize } from './junit.js';
import { chooseReportFormat, sameRunner, singleFileArgs, withReportArgs } from './frameworks.js';
import { ALLURE_VIEW_COMMAND, caseMatchesFile, collectRunReport, JUNIT_PLANS_FILE } from './results.js';
import { runCommandWithReport } from '../tools/agents/generator.js';
import { readTestRuns, recordTestRun } from '../utils/test-runs.js';
import type { TestManifest } from '../types/manifest.js';

const PYTEST_XML = `<?xml version="1.0" encoding="utf-8"?><testsuites name="pytest tests"><testsuite name="pytest" errors="0" failures="1" skipped="1" tests="4" time="3.2">
<testcase classname="tests.checkboxes.test_initial_state" name="test_initial_state" time="1.1" />
<testcase classname="tests.checkboxes.test_toggle_checkbox_1_on" name="test_toggle_checkbox_1_on" time="1.0"><failure message="AssertionError: checkbox 1 is not checked&#10;assert False">tests/checkboxes/test_toggle_checkbox_1_on.py:12: AssertionError</failure></testcase>
<testcase classname="tests.checkboxes.test_toggle_checkbox_2_off" name="test_toggle_checkbox_2_off" time="1.1"><skipped type="pytest.skip" message="later" /></testcase>
<testcase classname="tests.test_other" name="test_without_plan" time="0.0"><properties><property name="owner" value="ralph" /></properties></testcase>
</testsuite></testsuites>`;

const SUREFIRE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.LoginTest" tests="2" failures="0" errors="1" skipped="0" time="4.5">
  <testcase name="logsIn" classname="com.example.LoginTest" time="2.1"/>
  <testcase name="showsError" classname="com.example.LoginTest" time="2.4">
    <error message="no such element: #flash" type="org.openqa.selenium.NoSuchElementException"><![CDATA[org.openqa.selenium.NoSuchElementException: no such element: <#flash>
    at com.example.LoginTest.showsError(LoginTest.java:31)]]></error>
  </testcase>
</testsuite>`;

const ROBOT_XUNIT = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="Tests" tests="1" errors="0" failures="0" skipped="0" time="1.9">
<testcase classname="Tests.Login" name="Valid Login" time="1.9"></testcase>
</testsuite>`;

const PLAN = `# Checkboxes page

**Status:** approved — approved by the user in the review page on 2026-11-22 17:39 UTC

## Test Scenarios

### 1. Checkboxes

#### 1.1. Initial state of both checkboxes

**File:** \`tests/checkboxes/test_initial_state.py\`

**Steps:**
  1. Open /checkboxes
    - expect: Checkbox 1 is unchecked

#### 1.2. Toggle checkbox 1 on

**File:** \`tests/checkboxes/test_toggle_checkbox_1_on.py\`

**Steps:**
  1. Click checkbox 1
    - expect: Checkbox 1 is checked

#### 1.3. Toggle checkbox 2 off

**File:** \`tests/checkboxes/test_toggle_checkbox_2_off.py\`

**Steps:**
  1. Click checkbox 2
    - expect: Checkbox 2 is unchecked
`;

describe('reporting', () => {
  describe('JUnit XML', () => {
    it('reads pytest results: passed, failed with its message, skipped, and properties', () => {
      const cases = parseJUnitXml(PYTEST_XML);
      expect(cases.map(c => c.status)).to.deep.equal(['passed', 'failed', 'skipped', 'passed']);
      expect(cases[1].message).to.equal('AssertionError: checkbox 1 is not checked');
      expect(cases[3].properties).to.deep.equal({ owner: 'ralph' });
      expect(summarize(cases)).to.deep.equal({ total: 4, passed: 2, failed: 1, skipped: 1, time: 3.2 });
    });

    it('reads Maven Surefire results with an error in CDATA, and Robot Framework xunit', () => {
      const cases = parseJUnitXml(SUREFIRE_XML);
      expect(cases.map(c => `${c.classname}.${c.name}:${c.status}`)).to.deep.equal(['com.example.LoginTest.logsIn:passed', 'com.example.LoginTest.showsError:failed']);
      expect(cases[1].message).to.equal('no such element: #flash');
      expect(parseJUnitXml(ROBOT_XUNIT)[0]).to.include({ classname: 'Tests.Login', name: 'Valid Login', status: 'passed' });
    });

    it('ignores test cases inside comments, also a comment that only appears once another is removed', () => {
      const xml = '<testsuite><!-- <testcase name="hidden" classname="a"/> --><!<!-- x -->-- <testcase name="joined" classname="a"/> --><testcase name="real" classname="a"/></testsuite>';
      expect(parseJUnitXml(xml).map(c => c.name)).to.deep.equal(['real']);
    });

    it('takes the file from the enclosing testsuite when the case has none (mocha-junit-reporter)', () => {
      const xml = '<testsuites><testsuite name="Root Suite" file="test/cart.test.js"><testcase name="adds" classname="cart adds"/></testsuite></testsuites>';
      expect(parseJUnitXml(xml)[0].file).to.equal('test/cart.test.js');
    });
  });

  describe('run commands', () => {
    it('JUnit XML by default, Allure when asked or already in the project', () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rep-'));
      expect(chooseReportFormat(undefined, dir).format).to.equal('junit');
      expect(chooseReportFormat('allure', dir).format).to.equal('allure');
      fs.writeFileSync(path.join(dir, 'requirements.txt'), 'selenium\nallure-pytest\n');
      expect(chooseReportFormat(undefined, dir)).to.include({ format: 'allure', why: 'the project already uses Allure' });
    });

    it('adds the report arguments once, per framework', () => {
      expect(withReportArgs(['-v'], 'selenium-python-pytest', 'junit')).to.deep.equal(['-v', '--junitxml=reports/junit.xml']);
      expect(withReportArgs(['-v', '--junitxml=out.xml'], 'selenium-python-pytest', 'junit')).to.deep.equal(['-v', '--junitxml=out.xml']);
      expect(withReportArgs([], 'selenium-python-pytest', 'allure')).to.deep.equal(['--junitxml=reports/junit.xml', '--alluredir=allure-results']);
      expect(withReportArgs(['test'], 'selenium-java-maven', 'junit')).to.deep.equal(['test']);
      expect(withReportArgs(['test'], 'selenium-csharp-nunit', 'junit')).to.deep.equal(['test', '--logger', 'junit;LogFilePath=TestResults/junit.xml']);
      expect(withReportArgs(['--outputdir', 'results'], 'robot-framework', 'junit')).to.deep.equal(['--outputdir', 'results', '--xunit', 'junit.xml']);
      const mocha = withReportArgs(['--reporter', 'spec'], 'selenium-js-mocha', 'junit');
      expect(mocha.filter(a => a === '--reporter')).to.have.length(1);
    });

    it('recognises the project runner in a command the AI chose', () => {
      expect(sameRunner('.venv/bin/pytest', ['tests'], 'pytest')).to.equal(true);
      expect(sameRunner('python3', ['-m', 'pytest', 'tests'], 'pytest')).to.equal(true);
      expect(sameRunner('./mvnw', ['test'], 'mvn')).to.equal(true);
      expect(sameRunner('npx', ['wdio'], 'npx')).to.equal(true);
      expect(sameRunner('robot', ['tests'], 'pytest')).to.equal(false);
    });

    it('tells the generator how to write Allure steps and a screenshot on failure, per framework', async () => {
      const { reportingFor } = await import('./frameworks.js');
      expect(reportingFor('selenium-python-pytest')!.allure.testCode!.join('\n')).to.include('with allure.step(').and.include('get_screenshot_as_png');
      for (const f of ['selenium-java-maven', 'selenium-csharp-nunit', 'selenium-js-mocha', 'webdriverio-ts', 'robot-framework']) {
        expect(reportingFor(f)!.allure.testCode, f).to.have.length(2);
      }
      expect(reportingFor('selenium-python-pytest')!.junit.testCode).to.equal(undefined);
    });

    it('runs unittest tests under pytest, which writes JUnit XML', () => {
      expect(runCommandWithReport('selenium-python-unittest', { command: 'python', args: ['-m', 'unittest', '-v'] }, 'junit'))
        .to.deep.equal({ command: 'python', args: ['-m', 'pytest', '-v', '--junitxml=reports/junit.xml'] });
    });

    it('runs one file the way each runner takes it (not --spec for every runner)', () => {
      expect(singleFileArgs('selenium-python-pytest', '/p/tests/test_a.py', '/p')).to.deep.equal(['tests/test_a.py']);
      expect(singleFileArgs('webdriverio-ts', '/p/test/specs/a.spec.ts', '/p')).to.deep.equal(['--spec', 'test/specs/a.spec.ts']);
      expect(singleFileArgs('selenium-java-maven', '/p/src/test/java/LoginTest.java', '/p')).to.deep.equal(['-Dtest=LoginTest']);
      expect(singleFileArgs('selenium-csharp-nunit', '/p/Tests/LoginTests.cs', '/p')).to.deep.equal(['--filter', 'FullyQualifiedName~LoginTests']);
    });
  });

  describe('linking results to the approved plan', () => {
    let root: string;
    const since = () => Date.now() - 500;
    beforeEach(() => {
      root = fs.mkdtempSync(path.join(os.tmpdir(), 'rep-'));
      fs.mkdirSync(path.join(root, 'specs'));
      fs.writeFileSync(path.join(root, 'specs', 'checkboxes.md'), PLAN);
      fs.mkdirSync(path.join(root, 'reports'));
    });

    it('matches results to test files by classname or file, in Python, Java, C# and Robot', () => {
      expect(caseMatchesFile({ classname: 'tests.checkboxes.test_initial_state' }, '/p/tests/checkboxes/test_initial_state.py', '/p')).to.equal(true);
      expect(caseMatchesFile({ classname: 'tests.test_login.TestLogin' }, '/p/tests/test_login.py', '/p')).to.equal(true);
      expect(caseMatchesFile({ classname: 'com.example.LoginTest' }, '/p/src/test/java/com/example/LoginTest.java', '/p')).to.equal(true);
      expect(caseMatchesFile({ classname: 'Shop.Tests.LoginTests' }, '/p/Tests/LoginTests.cs', '/p')).to.equal(true);
      expect(caseMatchesFile({ classname: 'Tests.Login' }, '/p/tests/login.robot', '/p')).to.equal(true);
      expect(caseMatchesFile({ classname: 'x', file: 'test/cart.test.js' }, '/p/test/cart.test.js', '/p')).to.equal(true);
      expect(caseMatchesFile({ classname: 'tests.test_other' }, '/p/tests/checkboxes/test_initial_state.py', '/p')).to.equal(false);
    });

    it('links every case to its plan scenario, writes reports/junit-plans.xml and counts tests without a plan', async () => {
      const start = since();
      fs.writeFileSync(path.join(root, 'reports', 'junit.xml'), PYTEST_XML);
      const report = await collectRunReport({ projectRoot: root, framework: 'selenium-python-pytest', since: start, manifest: null, specsDir: path.join(root, 'specs') });
      expect(report!.summary).to.include({ total: 4, passed: 2, failed: 1, skipped: 1 });
      expect(report!.cases.map(c => c.link?.scenario ?? '-')).to.deep.equal(['1.1', '1.2', '1.3', '-']);
      expect(report!.cases[1].link).to.include({ plan: 'checkboxes.md', planTitle: 'Checkboxes page', scenarioName: 'Toggle checkbox 1 on', suite: 'Checkboxes' });
      expect(report!.cases[1].link!.review).to.match(/^approved \(by the user in the review page on 2026-11-22/);
      expect(report!.unlinked).to.equal(1);
      const out = fs.readFileSync(path.join(root, 'reports', JUNIT_PLANS_FILE), 'utf8');
      expect(out).to.include('<property name="scenario" value="1.2 Toggle checkbox 1 on"/>')
        .and.include('<property name="plan" value="none: no approved plan behind this test"/>')
        .and.include('<failure message="AssertionError: checkbox 1 is not checked"/>');
      // The written file is not read back as a result of the next run.
      const again = await collectRunReport({ projectRoot: root, framework: 'selenium-python-pytest', since: start, manifest: null, specsDir: path.join(root, 'specs') });
      expect(again!.summary.total).to.equal(4);
    });

    it('uses the scenario recorded by generator_write_test when the file is not the one the plan names', async () => {
      const manifest: TestManifest = {
        version: 1, projectRoot: root, baseUrl: '', framework: 'selenium-python-pytest', runCommand: null, configFile: null,
        tests: [{ file: path.join(root, 'tests', 'test_other.py'), framework: 'selenium-python-pytest', createdAt: '', specFile: 'checkboxes.md', scenario: '1.3' }],
        updatedAt: '',
      };
      fs.writeFileSync(path.join(root, 'reports', 'junit.xml'), PYTEST_XML);
      const report = await collectRunReport({ projectRoot: root, framework: 'selenium-python-pytest', since: since(), manifest, specsDir: path.join(root, 'specs') });
      expect(report!.cases[3].link).to.include({ plan: 'checkboxes.md', scenario: '1.3' });
      expect(report!.unlinked).to.equal(0);
    });

    it('ignores results from an earlier run', async () => {
      fs.writeFileSync(path.join(root, 'reports', 'junit.xml'), PYTEST_XML);
      const old = new Date(Date.now() - 60_000);
      fs.utimesSync(path.join(root, 'reports', 'junit.xml'), old, old);
      expect(await collectRunReport({ projectRoot: root, framework: 'selenium-python-pytest', since: since(), manifest: null, specsDir: path.join(root, 'specs') })).to.equal(null);
    });

    it('labels Allure results with the plan: epic, feature, story', async () => {
      fs.mkdirSync(path.join(root, 'allure-results'));
      const file = path.join(root, 'allure-results', 'abc-result.json');
      fs.writeFileSync(file, JSON.stringify({
        name: 'test_toggle_checkbox_1_on', fullName: 'tests.checkboxes.test_toggle_checkbox_1_on#test_toggle_checkbox_1_on', status: 'passed',
        description: 'Scenario 1.2 docstring',
        labels: [{ name: 'package', value: 'tests.checkboxes.test_toggle_checkbox_1_on' }, { name: 'framework', value: 'pytest' }],
      }));
      const report = await collectRunReport({ projectRoot: root, framework: 'selenium-python-pytest', since: since(), manifest: null, specsDir: path.join(root, 'specs') });
      expect(report!.written[0]).to.equal('1 Allure result(s) labelled with their plan');
      // Allure 3 shows the plan tree: allurerc.mjs is written once, never over an existing config.
      expect(report!.written[1]).to.include('allurerc.mjs');
      expect(fs.readFileSync(path.join(root, 'allurerc.mjs'), 'utf8')).to.include('groupBy: ["epic", "feature", "story"]');
      expect(report!.view).to.include(ALLURE_VIEW_COMMAND).and.not.match(/^allure serve/);
      const labels = JSON.parse(fs.readFileSync(file, 'utf8')).labels as Array<{ name: string; value: string }>;
      const get = (n: string) => labels.filter(l => l.name === n).map(l => l.value);
      expect(get('epic')).to.deep.equal(['Checkboxes page']);
      expect(get('feature')).to.deep.equal(['Checkboxes']);
      expect(get('story')).to.deep.equal(['1.2 Toggle checkbox 1 on']);
      expect(get('plan')).to.deep.equal(['checkboxes.md']);
      expect(get('tag')).to.deep.equal(['approved-plan']);
      expect(get('framework')).to.deep.equal(['pytest']);
      // Readable for testers: the scenario as the name, the plan steps as the description, a link to the plan.
      const result = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(result.name).to.equal('1.2 Toggle checkbox 1 on');
      expect(get('testMethod')).to.deep.equal(['test_toggle_checkbox_1_on']);
      expect(result.descriptionHtml).to.include('<b>Test plan:</b> Checkboxes page').and.include('<li>Click checkbox 1<ul><li>✓ Checkbox 1 is checked</li></ul></li>')
        .and.include('approved (by the user in the review page');
      expect(result.links).to.have.length(1);
      expect(result.links[0].url).to.match(/^file:\/\/\/.*specs\/checkboxes\.md$/);
      // A second pass (the next run) does not add the plan twice.
      fs.utimesSync(file, new Date(), new Date());
      await collectRunReport({ projectRoot: root, framework: 'selenium-python-pytest', since: since(), manifest: null, specsDir: path.join(root, 'specs') });
      const again = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(again.descriptionHtml.match(/Test plan:/g)).to.have.length(1);
      expect(again.links).to.have.length(1);
      expect(again.labels.filter((l: { name: string }) => l.name === 'testMethod')).to.have.length(1);
    });

    it('leaves an existing Allure config alone', async () => {
      fs.writeFileSync(path.join(root, 'allurerc.json'), '{"name":"ours"}');
      fs.mkdirSync(path.join(root, 'allure-results'));
      fs.writeFileSync(path.join(root, 'allure-results', 'x-result.json'), JSON.stringify({ fullName: 'tests.checkboxes.test_initial_state#t', labels: [] }));
      const report = await collectRunReport({ projectRoot: root, framework: 'selenium-python-pytest', since: since(), manifest: null, specsDir: path.join(root, 'specs') });
      expect(fs.existsSync(path.join(root, 'allurerc.mjs'))).to.equal(false);
      expect(report!.written).to.deep.equal(['1 Allure result(s) labelled with their plan']);
      expect(report!.view).to.include('npx allure generate');
    });

    it('keeps the latest result per test file and per plan scenario, also for a whole-suite run', async () => {
      fs.writeFileSync(path.join(root, 'reports', 'junit.xml'), PYTEST_XML);
      const report = await collectRunReport({ projectRoot: root, framework: 'selenium-python-pytest', since: since(), manifest: null, specsDir: path.join(root, 'specs') });
      await recordTestRun({ command: 'pytest', exitCode: 1, output: '', results: report }, root);
      const runs = await readTestRuns(root);
      expect(runs.suite?.summary).to.equal('2 passed, 1 failed, 1 skipped in 3.2s');
      expect(runs.scenarios['checkboxes.md#1.1'].status).to.equal('passed');
      expect(runs.scenarios['checkboxes.md#1.2']).to.include({ status: 'failed', message: 'AssertionError: checkbox 1 is not checked' });
      expect(runs.files[path.join(root, 'tests', 'checkboxes', 'test_toggle_checkbox_1_on.py')]).to.include({ passed: false, total: 1, failed: 1 });
    });
  });
});
