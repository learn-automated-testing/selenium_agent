import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { Builder } from 'selenium-webdriver';

import { Context } from './context.js';
import { isSessionLostError, withTimeout } from './session-recovery.js';

/**
 * Locks in recovery from a dead local browser session. Before this, a closed
 * window, crashed browser or idle-killed chromedriver left a stale driver in
 * the Context and every later call failed with "invalid session id" until the
 * user called reset_session by hand.
 *
 * Builder.build() is stubbed, so no real browser is needed.
 */
describe('session recovery', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    sinon.restore();
    process.env = { ...originalEnv };
  });

  const liveDriver = () =>
    ({
      getAllWindowHandles: sinon.stub().resolves(['w1']),
      getWindowHandle: sinon.stub().resolves('w1'),
      quit: sinon.stub().resolves(),
    }) as any;

  const deadDriver = () =>
    ({
      getAllWindowHandles: sinon.stub().rejects(Object.assign(new Error('invalid session id'), { name: 'NoSuchSessionError' })),
      getWindowHandle: sinon.stub().rejects(new Error('invalid session id')),
      quit: sinon.stub().rejects(new Error('invalid session id')),
    }) as any;

  function localContext(): Context {
    delete process.env.SELENIUM_GRID_URL;
    delete process.env.SELENIUM_ATTACH_CDP;
    process.env.SELENIUM_AI_AGENT_SKIP_PROVISION = '1';
    return new Context();
  }

  describe('isSessionLostError', () => {
    it('recognises lost-session errors', () => {
      expect(isSessionLostError(Object.assign(new Error('x'), { name: 'NoSuchSessionError' }))).to.equal(true);
      expect(isSessionLostError(new Error('invalid session id'))).to.equal(true);
      expect(isSessionLostError(new Error('chrome not reachable'))).to.equal(true);
      expect(isSessionLostError(new Error('no such session'))).to.equal(true);
    });

    it('ignores ordinary command failures', () => {
      expect(isSessionLostError(new Error('no such element: Unable to locate element'))).to.equal(false);
      expect(isSessionLostError(new Error('element click intercepted'))).to.equal(false);
      expect(isSessionLostError(undefined)).to.equal(false);
    });
  });

  describe('withTimeout', () => {
    it('rejects a promise that never settles', async () => {
      const never = new Promise<void>(() => {});
      let error: Error | null = null;
      try { await withTimeout(never, 20, 'probe'); } catch (err) { error = err as Error; }
      expect(error?.message).to.match(/probe timed out/);
    });
  });

  describe('Context.ensureBrowser — local session', () => {
    it('reuses a live local driver without relaunching', async () => {
      const ctx = localContext();
      const driver = liveDriver();
      (ctx as any).driver = driver;
      const build = sinon.stub(Builder.prototype, 'build');

      const result = await ctx.ensureBrowser();

      expect(result).to.equal(driver);
      expect(build.called, 'should not launch a new browser').to.equal(false);
    });

    it('relaunches when the cached local session is dead', async () => {
      const ctx = localContext();
      const dead = deadDriver();
      (ctx as any).driver = dead;
      const fresh = liveDriver();
      const build = sinon.stub(Builder.prototype, 'build').resolves(fresh);

      const result = await ctx.ensureBrowser();

      expect(build.calledOnce, 'should launch a fresh browser').to.equal(true);
      expect(result).to.equal(fresh);
      expect(dead.quit.calledOnce, 'should try to stop the dead driver').to.equal(true);
    });

    it('switches to a remaining window when only the current one was closed', async () => {
      const ctx = localContext();
      const window = sinon.stub().resolves();
      const driver = {
        getAllWindowHandles: sinon.stub().resolves(['w2']),
        getWindowHandle: sinon.stub().rejects(new Error('no such window: target window already closed')),
        switchTo: () => ({ window }),
        quit: sinon.stub().resolves(),
      } as any;
      (ctx as any).driver = driver;
      const build = sinon.stub(Builder.prototype, 'build');

      const result = await ctx.ensureBrowser();

      expect(result).to.equal(driver);
      expect(window.calledWith('w2')).to.equal(true);
      expect(build.called, 'session is still alive, no relaunch').to.equal(false);
    });

    it('keeps recording state across a recovered session', async () => {
      const ctx = localContext();
      ctx.startRecording();
      ctx.recordAction('navigate_to', { url: 'https://example.com' });
      (ctx as any).driver = deadDriver();
      sinon.stub(Builder.prototype, 'build').resolves(liveDriver());

      await ctx.ensureBrowser();

      expect(ctx.getRecordingStatus()).to.deep.equal({ enabled: true, actionCount: 1 });
    });
  });

  describe('Context.discardDeadSession', () => {
    it('drops a dead local driver so the next call relaunches', async () => {
      const ctx = localContext();
      (ctx as any).driver = deadDriver();

      await ctx.discardDeadSession();

      expect(ctx.isBrowserRunning()).to.equal(false);
    });

    it('drops a dead grid session', async () => {
      const ctx = localContext();
      (ctx as any).activeGridSession = { sessionId: 'g1', getDriver: () => deadDriver() };
      (ctx as any).activeSessionId = 'g1';

      await ctx.discardDeadSession();

      expect((ctx as any).activeGridSession).to.equal(null);
      expect((ctx as any).activeSessionId).to.equal(null);
    });
  });
});
