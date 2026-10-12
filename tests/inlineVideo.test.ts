import {createElement} from 'react';
import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {InlineVideo} from '../src/components/InlineVideo';

it('shows a play cover without loading media before the teacher clicks',()=>{
 let requests=0;
 const html=renderToStaticMarkup(createElement(InlineVideo,{title:'切线连半径',loadPlayback:async()=>{requests++;return 'https://example.com/video.mp4';}}));
 expect(html).toContain('播放视频：切线连半径');
 expect(html).not.toContain('<video');
 expect(requests).toBe(0);
});

it('native playback waits for a click, prevents duplicate requests and can retry a failed URL',async()=>{
 let definition:any,requests=0,resolve:any;
 const notices:string[]=[];
 runInNewContext(readFileSync('../math-tutor-miniapp/components/inline-video/index.js','utf8'),{
  Component:(value:any)=>definition=value,
  getApp:()=>({runtime:{videoPlayback:()=>{requests++;return new Promise(r=>resolve=r);}}}),
  wx:{createVideoContext:()=>({pause(){}}),showToast:({title}:{title:string})=>notices.push(title)}
 });
 const instance:any={data:{...definition.data,jobId:'j1'},setData(next:any){Object.assign(this.data,next);}};
 Object.assign(instance,definition.methods);
 expect(requests).toBe(0);
 const playing=instance.play();
 await instance.play();
 expect(requests).toBe(1);
 resolve({url:'https://example.com/one.mp4'});await playing;
 expect(instance.data.src).toBe('https://example.com/one.mp4');
 instance.failed();
 expect(instance.data.src).toBe('');
 expect(notices).toEqual(['视频暂时无法播放，请重试']);
 const retry=instance.play();
 resolve({url:'https://example.com/two.mp4'});await retry;
 expect(instance.data.src).toBe('https://example.com/two.mp4');
 expect(requests).toBe(2);
});
