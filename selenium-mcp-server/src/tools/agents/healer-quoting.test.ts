import { describe, it } from 'mocha';
import { expect } from 'chai';
import { quoteShellArg, commandLine, runCommand } from './healer.js';

describe('healer_run_tests passes arguments exactly as given', () => {
  it('quotes arguments with spaces, quotes and shell operators; leaves plain ones alone', () => {
    expect(quoteShellArg('tests/test_login.py', 'linux')).to.equal('tests/test_login.py');
    expect(quoteShellArg('--tb=short', 'linux')).to.equal('--tb=short');
    expect(quoteShellArg('cd tests && pytest -q', 'linux')).to.equal("'cd tests && pytest -q'");
    expect(quoteShellArg("it's", 'linux')).to.equal("'it'\\''s'");
    expect(quoteShellArg('', 'linux')).to.equal("''");
    expect(quoteShellArg('a b', 'win32')).to.equal('"a b"');
    expect(quoteShellArg('say "hi"', 'win32')).to.equal('"say \\"hi\\""');
    expect(commandLine('sh', ['-c', 'cd x && ls'], 'linux')).to.equal("sh -c 'cd x && ls'");
  });

  it('runs sh -c with a compound command as one argument (the bug: it got only "cd")', async function () {
    if (process.platform === 'win32') this.skip();
    const r = await runCommand('sh', ['-c', 'cd / && echo "in $(pwd)" && echo two words'], undefined, 10000);
    expect(r.stdout).to.equal('in /\ntwo words\n');
  });

  it('keeps an argument with spaces together, and a one-string command still works', async function () {
    if (process.platform === 'win32') this.skip();
    expect((await runCommand('printf', ['%s|', 'a b', "c'd"], undefined, 10000)).stdout).to.equal("a b|c'd|");
    expect((await runCommand('echo one two', [], undefined, 10000)).stdout).to.equal('one two\n');
  });
});
