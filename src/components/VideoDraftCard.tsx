import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { VideoDraft } from "../api/types";
import { useApp, useStoreRevision } from "../store/AppContext";
import { Sheet } from "./Sheet";
import { Markdown } from "./Markdown";
import { friendlyError } from "../api/errors";
import { questionView } from "../lib/questionView";
import { toast } from "./Toast";
import "../styles/video-draft.css";
export function VideoDraftCard({ draft }: { draft: VideoDraft }) {
  const { store } = useApp();
  useStoreRevision();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const job = store?.state.jobs.find((j) => {
    try {
      return JSON.parse(j.snapshot).draftId === draft.id;
    } catch {
      return false;
    }
  });
  async function submit() {
    if (!store || busy) return;
    setBusy(true);
    setError("");
    try {
      await store.submitDraft(draft.id);
      setOpen(false);
      toast("已提交后台制作");
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }
  const label = draft.mode === "method" ? "方法微课" : "单题讲解";
  return (
    <>
      <article className="card video-draft">
        <span className="pill pill--plain">{label}</span>
        <h3>{draft.title}</h3>
        {draft.examples.map((e) => (
          <p className="video-draft__source" key={e.question.id}>
            {questionView(e.question).source} · {e.purpose}
          </p>
        ))}
        <div className="video-draft__actions">
          <button className="btn btn--ghost" onClick={() => setOpen(true)}>
            查看讲解稿
          </button>
          {job ? (
            <button
              className="btn btn--primary"
              onClick={() => navigate(`/videos/${job.id}`)}
            >
              查看视频任务
            </button>
          ) : (
            <button className="btn btn--primary" onClick={() => setOpen(true)}>
              确认制作
            </button>
          )}
        </div>
      </article>
      <Sheet
        open={open}
        title={draft.title}
        onClose={() => setOpen(false)}
        footer={
          <div>
            <p className="video-draft__source">
              {job
                ? "已提交后台制作"
                : "确认后使用 1 次视频额度，制作将在后台进行"}
            </p>
            {error ? <p role="alert">{error}</p> : null}
            <button
              className="btn btn--primary btn--block"
              disabled={busy || !!job}
              onClick={() => void submit()}
            >
              {job ? "已提交" : busy ? "提交中…" : "确认内容，制作视频"}
            </button>
          </div>
        }
      >
        {draft.requirements ? (
          <p className="video-draft__source">{draft.requirements}</p>
        ) : null}
        <Markdown value={draft.script} />
      </Sheet>
    </>
  );
}
