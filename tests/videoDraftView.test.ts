import {expect,it} from 'vitest';
import {exampleView, draftJobView} from '../src/lib/videoDraftView';
it('shortens standard exam metadata while retaining the question number and a useful role',()=>{
 const example={question:{id:'q1',bankVersion:'v1',paper:'安徽省2025年初中学业水平考试数学',number:12,stem:'完整题干'},purpose:'基础应用：已知切线，连半径得垂直，再结合圆周角定理求角'};
 expect(exampleView(example)).toMatchObject({source:'安徽 2025 · 第12题',role:'求角',key:'q1@v1'});
});
it('preserves a nonstandard source and does not clip arbitrary educational text into a label',()=>{
 expect(exampleView({question:{id:'q2',bankVersion:'v1',paper:'工作室专题卷',number:3},purpose:'把多个条件串联起来'})).toMatchObject({source:'工作室专题卷 · 第3题',role:'方法应用'});
 expect(exampleView({question:{id:'q3',bankVersion:'v1'},purpose:'证明应用：证明切线'}).role).toBe('证明切线');
});

it('uses the latest retry and shows the correct action for every production state',()=>{
 const job=(id:string,status:'ready'|'failed'|'running'|'queued',createdAt:number)=>({id,status,createdAt,snapshot:JSON.stringify({draftId:'d1'})});
 expect(draftJobView('d1',[job('old','failed',1),job('new','ready',2)])).toMatchObject({job:{id:'new'},status:'已完成',action:'查看视频'});
 for(const [state,status,action] of [['queued','排队中','查看进度'],['running','制作中','查看进度'],['failed','制作失败','查看原因']] as const)
  expect(draftJobView('d1',[job('j',state,1)])).toMatchObject({status,action});
 expect(draftJobView('other',[job('j','ready',1)])).toMatchObject({job:undefined,status:'待确认',action:'确认制作'});
});
