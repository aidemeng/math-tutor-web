import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VideoDraft } from "../api/types";
import { useApp, useStoreRevision } from "../store/AppContext";
import {InlineVideo} from "./InlineVideo";
import { Sheet } from "./Sheet";
import { Markdown } from "./Markdown";
import { friendlyError } from "../api/errors";
import { questionView } from "../lib/questionView";
import {exampleView, draftJobView} from '../lib/videoDraftView';
import {Icon} from './Icon';
import {QuestionDiagrams} from './QuestionDiagram';
import { toast } from "./Toast";
import "../styles/video-draft.css";
export function VideoDraftCard({ draft }: { draft: VideoDraft }) {
  const { store } = useApp();
  useStoreRevision();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const [exampleIndex, setExampleIndex] = useState<number | null>(null);
  const example = exampleIndex === null ? null : draft.examples[exampleIndex];
  const question = example ? questionView(example.question) : null;
  function close() {setOpen(false); setExampleIndex(null);}
  const {job, status, action} = draftJobView(draft.id, store?.state.jobs || []);
  async function submit() {
    if (!store || busy) return;
    setBusy(true);
    try {
      await store.submitDraft(draft.id);
      setOpen(false);
      toast("已提交后台制作");
    } catch (e) {
      toast(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const label = draft.mode === "method" ? "方法微课" : "单题讲解";
  return (
    <>
      <article className="card video-draft">
        <div className="video-draft__header"><span className="video-draft__kind"><Icon name="video" size={14}/>{label}</span><span className={`video-draft__status video-draft__status--${job?.status || "draft"}`}>{status}</span></div>
        <h3>{draft.title}</h3>
        {job?.status === 'ready' && store ? <InlineVideo key={job.id} title={draft.title} loadPlayback={() => store.videoUrl(job.id)}/> : null}
        {draft.examples.length ? <div className="video-draft__examples">
          <div className="video-draft__examples-label">例题 <span>{draft.examples.length} 道</span></div>
          {draft.examples.map((e,index) => {const view=exampleView(e); return <button className="video-draft__example" key={view.key} onClick={() => setExampleIndex(index)} aria-label={`查看例题：${view.source}`}>
            <span className="video-draft__number">{String(index+1).padStart(2,'0')}</span><span className="video-draft__exam">{view.source}</span><span className="video-draft__role">{view.role}</span><Icon name="chevron" size={14}/>
          </button>;})}
        </div> : null}
        {job?.status === 'ready' ? <div className="video-draft__actions video-draft__actions--ready">
          <button onClick={() => setOpen(true)}>预览讲稿</button>
          <button onClick={() => navigate(`/videos/${job.id}`)}>更多操作<Icon name="chevron" size={13}/></button>
        </div> : <div className="video-draft__actions">
          <button className="btn btn--ghost" onClick={() => setOpen(true)}>
            预览讲稿
          </button>
          {job ? (
            <button
              className="btn btn--primary"
              onClick={() => navigate(`/videos/${job.id}`)}
            >
              {action}
            </button>
          ) : (
            <button className="btn btn--primary" onClick={() => setOpen(true)}>
              确认制作
            </button>
          )}
        </div>}
      </article>
      <Sheet
        open={open || !!question}
        title={question ? '例题与解析' : '讲解稿'}
        onClose={close}
        footer={
          question ? <button className="btn btn--ghost btn--block" onClick={() => {setExampleIndex(null); setOpen(true);}}>返回讲解稿</button> :
          <div>
            <p className="video-draft__source">
              {job
                ? status
                : "确认后使用 1 次视频额度，制作将在后台进行"}
            </p>
            <button
              className="btn btn--primary btn--block"
              disabled={busy}
              onClick={() => job ? navigate(`/videos/${job.id}`) : void submit()}
            >
              {job ? action : busy ? "提交中…" : "确认内容，制作视频"}
            </button>
          </div>
        }
      >
        {question && example ? <div className="video-draft__reader">
          <p className="video-draft__source">{question.source}</p>
          <h3>{exampleView(example).role}</h3>
          <Markdown value={question.stem} questionKey={question.key}/>
          <QuestionDiagrams diagrams={example.question.diagrams}/>
          <h3 className="video-draft__answer-heading">参考解析</h3>
          <Markdown value={question.explanation || question.answer || '暂无解析'} questionKey={question.key}/>
        </div> : <>
        <h3 className="video-draft__preview-title">{draft.title}</h3>
        {draft.requirements ? (
          <p className="video-draft__source">{draft.requirements}</p>
        ) : null}
        <Markdown value={draft.script} />
        </>}
      </Sheet>
    </>
  );
}
