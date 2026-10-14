import { useMemo, useState, type FormEvent } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
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
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const jobs = store?.state.jobs ?? [];

  async function redeem(event?: FormEvent) {
    event?.preventDefault();
    if (!store || redeeming || !code.trim()) return;
    setRedeeming(true);
    try {
      const added = await store.redeemCredits(code.trim());
      setRedeemOpen(false);
      setCode('');
      toast(`兑换成功，已增加 ${added} 次视频额度`);
    } catch (caught) {
      toast(friendlyError(caught));
    } finally {
      setRedeeming(false);
    }
  }

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
            <button type="button" className="credits-link" onClick={() => setRedeemOpen(true)}>兑换额度</button>
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
          <p className="empty__text">告诉助手想讲什么，或从题卡生成视频，制作进度会出现在这里。</p>
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
      <ConfirmDialog open={redeemOpen} title="兑换视频额度" confirmText="兑换 3 次额度"
        busy={redeeming} confirmDisabled={!code.trim()} onConfirm={() => void redeem()}
        onCancel={() => { if (!redeeming) setRedeemOpen(false); }} description={
        <form className="credits-form" onSubmit={redeem}>
          <p className="credits-form__hint">输入兑换码领取 3 次视频制作额度，每个码在同一账号仅可兑换一次。</p>
          <label className="field-label" htmlFor="credit-code">兑换码</label>
          <input id="credit-code" className="field" value={code} onChange={event => setCode(event.target.value)}
            placeholder="8 位兑换码，如 K7TM-4R9X" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck={false}
            required maxLength={64} disabled={redeeming} />
        </form>
      } />
    </main>
  );
}

function JobRow({ job, onOpen }: { job: VideoJob; onOpen(): void }) {
  const view = useMemo(() => {
    try {
      const snapshot = JSON.parse(job.snapshot) as { question: Parameters<typeof questionView>[0] };
      if((snapshot as any).mode==='method')return {title:(snapshot as any).title,source:'方法微课'};
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
