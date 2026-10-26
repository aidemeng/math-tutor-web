import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { MistakeAnalysisDetail } from '../src/components/mistakes/MistakeAnalysisDetail';
import type { MistakeAnalysis } from '../src/api/types';

vi.mock('../src/components/Markdown', () => ({
  Markdown: ({ value }: { value: string }) => createElement('p', null, value),
}));

it('renders a concise report with one cause and the key approach', () => {
  const analysis: MistakeAnalysis = {
    id: 'report-A', conversationId: 'conversation-A', photoId: 'photo-A', request: '分析这题',
    status: 'ready', input: null, createdAt: 1, updatedAt: 1,
    result: { topic: '加法', verdict: 'incorrect', correctAnswer: '2',
      summary: '多算了一个1。',
      solutionSteps: [{ title: '合并数量', explanation: '把两个1合起来。' }] },
  };
  const html = renderToStaticMarkup(createElement(MistakeAnalysisDetail, {
    analysis, busy: false, onOriginal() {}, onExpand() {},
  }));
  expect(html.split('多算了一个1。')).toHaveLength(2);
  expect(html).toContain('正确答案');
  expect(html).toContain('把两个1合起来。');
  expect(html).toContain('查看完整解析与推导');
});
