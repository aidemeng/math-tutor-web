import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendlyError } from '../api/errors';
import { Icon } from '../components/Icon';
import { toast } from '../components/Toast';
import { formatDate } from '../lib/time';
import { questionView, statusText } from '../lib/questionView';
import type { VideoJob } from '../api/types';
import { useApp, useStoreRevision } from '../store/AppContext';
import '../styles/videos.css';

const STATUS_CLASS: Record<string, string> = {
  ready: 'pill',
  queued: 'pill pill--warn',
  running: 'pill pill--info',
  failed: 'pill pill--danger',
};

export function VideosPage() {
  const { store } = useApp();
  useStoreRevision();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const jobs = store?.state.jobs ?? [];

  async function refresh() {
    if (!store || busy) return;
    setBusy(true);
    try {
      await store.refreshJobs();
    } catch (caught) {
      toast(friendlyError(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page page--tabbed videos">
      <div className="page-head">
        <div>
          <h2 className="page-head__title">讲解视频</h2>
          <p className="page-head__sub">
            剩余 <strong>{store?.state.credits ?? '—'}</strong> 次制作额度
          </p>
        </div>
        <button type="button" className="iconbtn" onClick={() => void refresh()} disabled={busy} aria-label="刷新">
          <Icon name="refresh" size={18} className={busy ? 'spin' : undefined} />
        </button>
      </div>

      {!jobs.length ? (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="video" size={30} />
          </span>
          <p className="empty__title">还没有视频</p>
          <p className="empty__text">在对话的题卡上点「生成讲解视频」，制作进度会出现在这里。</p>
        </div>
      ) : (
        <ul className="job-list">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobRow job={job} onOpen={() => navigate(`/videos/${job.id}`)} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function JobRow({ job, onOpen }: { job: VideoJob; onOpen(): void }) {
  const view = useMemo(() => {
    try {
      const snapshot = JSON.parse(job.snapshot) as { question: Parameters<typeof questionView>[0] };
      return questionView(snapshot.question);
    } catch {
      return null;
    }
  }, [job.snapshot]);

  return (
    <button type="button" className="job" onClick={onOpen}>
      <span className={`job__thumb job__thumb--${job.status}`}>
        {job.status === 'ready' ? (
          <Icon name="play" size={20} />
        ) : job.status === 'failed' ? (
          <Icon name="alert" size={20} />
        ) : (
          <Icon name="clock" size={20} className="dot-live" />
        )}
      </span>
      <span className="job__main">
        <span className="job__head">
          <span className="job__title">{view?.title ?? '讲解视频'}</span>
          <span className={STATUS_CLASS[job.status] ?? 'pill'}>{statusText(job.status)}</span>
        </span>
        <span className="job__source">{view?.source ?? '题目来源待更新'}</span>
        <span className="job__date">{formatDate(job.createdAt)}</span>
      </span>
      <Icon name="chevron" size={16} className="job__arrow" />
    </button>
  );
}
