import {expect,it,vi} from 'vitest';
import {createTeacherStore} from '../src/store/TeacherStore';
import type {TutorClient} from '../src/api/client';
it('retries the original request, photo and selected question without uploading again',async()=>{
 const sendMessage=vi.fn().mockReturnValueOnce({done:Promise.reject(new Error('MODEL_UNAVAILABLE')),cancel(){}}).mockReturnValue({done:Promise.resolve(),cancel(){}});
 const uploadPhoto=vi.fn().mockResolvedValue({id:'photo-1'});
 const store=createTeacherStore({client:{sendMessage,uploadPhoto} as unknown as TutorClient});
 store.state.activeId='conversation-1';
 const text='请针对题目 Q1（题库版本 v1）生成一道变式题，保留完整题干并给出解析。';
 await expect(store.send(text,{photo:{mimeType:'image/png',data:'original',preview:'preview-url'},selectedQuestion:{id:'Q1',bankVersion:'v1'}})).rejects.toThrow();
 expect(store.state.turns[0].prompt).not.toBe(text);
 await store.retryTurn(0);
 expect(sendMessage.mock.calls[1][1]).toEqual({text,photoId:'photo-1',selectedQuestion:{id:'Q1',bankVersion:'v1'}});
 expect(uploadPhoto).toHaveBeenCalledTimes(1);
 expect(store.state.turns[1].photo).toBe('preview-url');
});
it('restores each saved question reference before retrying a historical turn',async()=>{
 const selectedQuestion={id:'earlier-A',bankVersion:'v1'};
 const sendMessage=vi.fn().mockReturnValue({done:Promise.resolve(),cancel(){}});
 const getConversation=vi.fn().mockResolvedValue({messages:[{role:'user',content:JSON.stringify({type:'teacher_input',text:'换一种解法',selectedQuestion})},{role:'assistant',content:JSON.stringify({type:'error',error:'MODEL_UNAVAILABLE'})}]});
 const store=createTeacherStore({client:{sendMessage,getConversation} as unknown as TutorClient});
 await store.openConversation('history');await store.retryTurn(0);
 expect(sendMessage.mock.calls[0][1]).toEqual({text:'换一种解法',selectedQuestion});
});
