import type {VideoDraft, VideoJob} from '../api/types';
import {questionView} from './questionView';

export function exampleView(example: VideoDraft['examples'][number]) {
  const q = questionView(example.question);
  const exam = String(example.question.paper || '').match(/^(.+?)(\d{4})年初中学业水平考试数学$/);
  const source = exam
    ? `${exam[1].replace(/^.+省(?=.+市$)/, '').replace(/[省市]$/, '')} ${exam[2]}${example.question.number ? ` · 第${example.question.number}题` : ''}`
    : q.source.replace(/第\s+(\d+)\s+题/g, '第$1题');
  const role = ['证明切线', '求角', '求长度', '求最值', '求面积', '求周长', '证明', '计算']
    .find(label => example.purpose.replace(/证切线/g, '证明切线').includes(label)) || '方法应用';
  return {...q, source, role};
}

export function draftJobView(draftId: string, jobs: VideoJob[]) {
  const job = jobs.filter(j => {
    try {return JSON.parse(j.snapshot).draftId === draftId;} catch {return false;}
  }).sort((a,b) => b.createdAt - a.createdAt)[0];
  const labels = {
    queued: {status:'排队中', action:'查看进度'},
    running: {status:'制作中', action:'查看进度'},
    ready: {status:'已完成', action:'查看视频'},
    failed: {status:'制作失败', action:'查看原因'},
  };
  return {job, ...(job ? labels[job.status] : {status:'待确认', action:'确认制作'})};
}
