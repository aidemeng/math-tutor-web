import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { friendlyError } from '../api/errors';
import { Icon } from '../components/Icon';
import { Markdown } from '../components/Markdown';
import { toast } from '../components/Toast';
import { questionView, statusText } from '../lib/questionView';
import { useApp, useStoreRevision } from '../store/AppContext';
import '../styles/task.css';

const STATUS_CLASS: Record<string, string> = {
  ready: 'status--ready',
  queued: 'status--queued',
  running: 'status--running',
  failed: 'status--failed',
};

export function TaskPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { store } = useApp();
  useStoreRevision();

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  const job = store?.state.jobs.find((item) => item.id === id) ?? null;
  const question = useMemo(() => {
    if (!job) return null;
    try {
      const snapshot = JSON.parse(job.snapshot) as { question: Parameters<typeof questionView>[0] };
      return questionView(snapshot.question);
    } catch {
      return null;
    }
  }, [job]);

  // 打开页面时拉一次最新状态，并在制作完成后取回视频
  useEffect(() => {
    if (!store || !id) return;
    void store.refreshJobs().catch(() => {});
  }, [store, id]);

  useEffect(() => {
    if (!store || !id || !job || job.status !== 'ready' || videoSrc || loadingVideo) return;
    setLoadingVideo(true);
    store
      .videoUrl(id)
      .then(setVideoSrc)
      .catch((caught) => setError(friendlyError(caught)))
      .finally(() => setLoadingVideo(false));
  }, [store, id, job, videoSrc, loadingVideo]);

  async function retry() {
    if (!store || !id || retrying) return;
    setRetrying(true);
    setError('');
    try {
      const created = await store.retry(id);
      toast('已重新提交制作');
      navigate(`/videos/${created.id}`, { replace: true });
    } catch (caught) {
      setError(friendlyError(caught));
    } finally {
      setRetrying(false);
    }
  }

  if (!job) {
    return (
      <main className="page task">
        <div className="empty">
          <span className="empty__icon">
            <Icon name="alert" size={28} />
          </span>
          <p className="empty__title">任务不存在</p>
          <p className="empty__text">这个视频任务可能已被清理，回到列表看看其他任务。</p>
          <button type="button" className="btn btn--quiet" style={{ marginTop: 14 }} onClick={() => navigate('/videos')}>
            返回我的视频
          </button>
        </div>
      </main>
    );
  }

  const status = job.status;

  return (
    <main className="page task">
      <section className="card task__card">
        <header className="task__head">
          <h2 className="task__title">讲解视频</h2>
          <span className={`task__status ${STATUS_CLASS[status] ?? ''}`}>
            <i className={status === 'running' ? 'dot-live' : undefined} />
            {statusText(status)}
          </span>
        </header>

        {status === 'ready' ? (
          videoSrc ? (
            <video className="task__player" src={videoSrc} controls playsInline preload="metadata" />
          ) : (
            <div className="task__player task__player--placeholder">
              <div className="skeleton" style={{ width: '100%', height: '100%' }} />
              <span className="task__player-hint">正在加载视频…</span>
            </div>
          )
        ) : null}

        {status === 'queued' ? (
          <p className="task__note">视频将按提交顺序制作，可以稍后回来查看。</p>
        ) : null}
        {status === 'running' ? (
          <p className="task__note">正在后台制作，可继续备课，稍后在「我的视频」查看。</p>
        ) : null}
        {status === 'failed' ? (
          <p className="task__note">本次制作未完成，额度已退回，可以直接重新生成。</p>
        ) : null}

        {status === 'ready' ? (
          <p className="task__review">
            <Icon name="alert" size={14} />
            待老师复核 · 分享前请完整预览并核对讲解
          </p>
        ) : null}

        <div className="task__actions">
          {status === 'ready' && videoSrc ? (
            <a className="btn btn--primary btn--block" href={videoSrc} download={`讲解视频-${id.slice(0, 8)}.mp4`}>
              <Icon name="download" size={17} />
              保存到相册
            </a>
          ) : null}
          {status === 'failed' ? (
            <button type="button" className="btn btn--primary btn--block" onClick={() => void retry()} disabled={retrying}>
              <Icon name="refresh" size={17} />
              {retrying ? '提交中…' : '重新生成'}
            </button>
          ) : null}
          {status === 'queued' || status === 'running' ? (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => navigate('/')}>
              继续备课
            </button>
          ) : null}
        </div>
      </section>

      {question ? (
        <section className="card task__question">
          <span className="pill">{question.source}</span>
          <Markdown value={question.stem} questionKey={question.key} />
        </section>
      ) : null}

      {error ? (
        <div className="notice notice--danger" role="alert">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </div>
      ) : null}
    </main>
  );
}
