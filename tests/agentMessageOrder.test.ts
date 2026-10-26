import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
const { store } = vi.hoisted(() => ({ store: { state: {
  activeId: 'c', busy: true,
  turns: [{ reply: '适合练习配方法。', status: '', startedAt: 0, lastActivityAt: 0 }],
} } }));
vi.mock('../src/store/AppContext', () => ({ useApp: () => ({ store }), useStoreRevision() {} }));
vi.mock('../src/components/Markdown', () => ({ Markdown: ({ value }: { value: string }) => createElement('p', null, value) }));
import { AgentMessage } from '../src/components/AgentMessage';
it('streams the reply before revealing its result card and preserves the final visual order', () => {
  const render = () => renderToStaticMarkup(createElement(AgentMessage,
    { turnIndex: 0, conversationId: 'c' }, createElement('div', null, '题卡内容')));
  store.state.busy = true;
  const streaming = render();
  expect(streaming).toContain('适合练习配方法');
  expect(streaming).not.toContain('题卡内容');
  store.state.busy = false;
  const finished = render();
  expect(finished).toContain('题卡内容');
  expect(finished.indexOf('适合练习配方法')).toBeLessThan(finished.indexOf('题卡内容'));
});
