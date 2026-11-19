import { describe, it } from 'mocha';
import { expect } from 'chai';
import { ResizeTool } from './resize.js';

/** A fake WebDriver window that records what the tool asks for. */
function fakeContext(start = { x: 63, y: 61, width: 1280, height: 720 }, failFullscreenOnce = false) {
  const calls: string[] = [];
  let failNext = failFullscreenOnce;
  let rect = { ...start };
  const win = {
    getRect: async () => ({ ...rect }),
    setRect: async (r: Partial<typeof rect>) => { calls.push(`setRect ${JSON.stringify(r)}`); rect = { ...rect, ...r }; },
    fullscreen: async () => {
      if (failNext) { failNext = false; calls.push('fullscreen failed'); throw new Error("unknown error: failed to change window state to 'fullscreen', current state is 'normal'"); }
      calls.push('fullscreen'); rect = { x: 0, y: 0, width: 1800, height: 1169 }; },
    maximize: async () => { calls.push('maximize'); rect = { x: 0, y: 39, width: 1800, height: 1130 }; },
    minimize: async () => { calls.push('minimize'); },
  };
  const driver = { manage: () => ({ window: () => win }) };
  const context = { getDriver: async () => driver } as never;
  return { context, calls, rect: () => rect };
}

const text = (r: { content: string }) => r.content;

describe('resize_window', () => {
  it('keeps resizing to a size or preset as before', async () => {
    const { context, calls } = fakeContext();
    const tool = new ResizeTool();
    await tool.execute(context, { preset: 'desktop' });
    expect(calls).to.deep.equal(['setRect {"width":1280,"height":800}']);
  });

  it('moves the window to a position', async () => {
    const { context, calls } = fakeContext();
    const res = await new ResizeTool().execute(context, { x: 940, y: 39 });
    expect(calls).to.deep.equal(['setRect {"x":940,"y":39}']);
    expect(text(res as never)).to.contain('moved to 1280x720 at 940,39');
  });

  it('goes fullscreen and back to the exact previous size and position', async () => {
    const { context, calls, rect } = fakeContext();
    const tool = new ResizeTool();
    await tool.execute(context, { state: 'fullscreen' });
    await tool.execute(context, { state: 'normal' });
    expect(calls).to.deep.equal(['fullscreen', 'setRect {"x":63,"y":61,"width":1280,"height":720}']);
    expect(rect()).to.deep.equal({ x: 63, y: 61, width: 1280, height: 720 });
  });

  it('remembers the original rect across fullscreen → minimize → normal', async () => {
    const { context, rect } = fakeContext();
    const tool = new ResizeTool();
    await tool.execute(context, { state: 'fullscreen' });
    await tool.execute(context, { state: 'minimize' });
    await tool.execute(context, { state: 'normal' });
    expect(rect()).to.deep.equal({ x: 63, y: 61, width: 1280, height: 720 });
  });

  it('goes fullscreen from minimized by restoring the window first', async () => {
    const { context, calls } = fakeContext(undefined, true);
    await new ResizeTool().execute(context, { state: 'fullscreen' });
    expect(calls).to.deep.equal(['fullscreen failed', 'setRect {"x":63,"y":61,"width":1280,"height":720}', 'fullscreen']);
  });

  it('rejects a call without anything to do', () => {
    const tool = new ResizeTool();
    return tool.execute(fakeContext().context, { width: 100 }).then(
      r => expect(text(r as never)).to.match(/state|preset|width/),
      e => expect(String(e)).to.match(/state|preset|width/)
    );
  });
});
