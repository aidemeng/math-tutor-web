import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { QuestionDiagrams } from '../src/components/QuestionDiagram';

it('renders clear compact SVG figures without adding relationship marks', () => {
  const html = renderToStaticMarkup(createElement(QuestionDiagrams, {diagrams:[{
    type:'geometry',bounds:{xmin:0,xmax:4,ymin:0,ymax:4},
    points:[{id:'A',x:0,y:0},{id:'B',x:4,y:0},{id:'C',x:0,y:4}],
    segments:[{from:'A',to:'B'},{from:'A',to:'C'},{from:'B',to:'C'}],
  }]}));
  expect(html).toContain('viewBox="0 0 280 196"');
  expect(html).toContain('max-width:220px');
  expect(html).not.toContain('stroke-dasharray');
  expect(html).not.toContain('<polyline');
  expect(html).not.toContain('<circle');
  expect(html).toContain('paint-order="stroke"');
  expect(html).not.toMatch(/NaN|Infinity/);
});

it('renders an auxiliary segment with a black dashed stroke', () => {
  const html=renderToStaticMarkup(createElement(QuestionDiagrams,{diagrams:[{
    type:'geometry',bounds:{xmin:0,xmax:4,ymin:0,ymax:4},
    points:[{id:'A',x:0,y:0},{id:'B',x:4,y:4}],
    segments:[{from:'A',to:'B',auxiliary:true}],
  }]}));
  expect(html).toContain('stroke-dasharray="5 4"');
  expect(html).toContain('stroke="#000000"');
});


it('shows a solved parabola and its answer labels only in analysis', () => {
  const diagrams = [{ type: 'plot' as const, section: 'analysis' as const,
    title: '解析中求得的曲线', bounds: { xmin: -3, xmax: 3, ymin: -3, ymax: 3 },
    curves: [{ coefficients: [-1, 2, 1], label: 'y=-x²+2x+1' }] }];
  const question = renderToStaticMarkup(createElement(QuestionDiagrams, { diagrams }));
  expect(question).toBe('');
  const analysis = renderToStaticMarkup(createElement(QuestionDiagrams, { diagrams, section: 'analysis' }));
  expect(analysis).toContain('解析中求得的曲线');
  expect(analysis).toContain('y=-x²+2x+1');
  expect(analysis).toContain('<polyline');
});
