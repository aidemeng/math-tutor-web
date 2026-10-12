import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TurnError} from '../src/components/TurnError';
it('offers direct retry without asking the teacher to edit the question',()=>{
 const html=renderToStaticMarkup(createElement(TurnError,{onRetry:()=>{},disabled:true}));
 expect(html).toContain('重试');expect(html).toContain('disabled');
 expect(html).not.toContain('修改');expect(html).not.toContain('role="alert"');
});
