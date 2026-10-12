import {expect,it} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {TurnError} from '../src/components/TurnError';
it('keeps failure feedback inline and offers editing only when supplied',()=>{
 const plain=renderToStaticMarkup(createElement(TurnError,{message:'连接中断'}));
 expect(plain).toContain('role="alert"');expect(plain).toContain('连接中断');expect(plain).not.toContain('<button');
 const editable=renderToStaticMarkup(createElement(TurnError,{message:'连接中断',onEdit:()=>{}}));
 expect(editable).toContain('修改提问');expect(editable).not.toContain('notice--danger');
});
