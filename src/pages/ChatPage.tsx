import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { friendlyError } from '../api/errors';
import { AgentMessage } from '../components/AgentMessage';
import { ChatComposer } from '../components/ChatComposer';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Icon } from '../components/Icon';
import {QuestionDiagrams} from '../components/QuestionDiagram';
import { Markdown } from '../components/Markdown';
import { QuestionCard, type DeriveKind } from '../components/QuestionCard';
import { Sheet } from '../components/Sheet';
import { toast } from '../components/Toast';
import { derivePrompt, questionView } from '../lib/questionView';
import type { PhotoPayload } from '../lib/photo';
import { useApp, useStoreRevision } from '../store/AppContext';
import '../styles/chat.css';

const EMPTY_HINT = '发来一道题，我们一起备课';

export function ChatPage() {
  const { store } = useApp();
  const revision = useStoreRevision();
  const { id } = useParams();
  const navigate = useNavigate();

  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<PhotoPayload | null>(null);
  const [analysisKey, setAnalysisKey] = useState<string | null>(null);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [conversationError, setConversationError] = useState('');

  const openedRef = useRef<string | null>(null);
  const followRef = useRef(true);
  const hydratedRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const activeId = store?.state.activeId ?? null;
  const waitingForConversation = !!id && activeId !== id;
  const turns = waitingForConversation ? [] : store?.state.turns ?? [];
  const storeBusy = store?.state.busy ?? false;
  const busy = storeBusy || waitingForConversation;
  const pendingVideos =
    store?.state.jobs.filter((job) => job.status === 'queued' || job.status === 'running').length ?? 0;

  // A changed route gets its own load attempt. Failed loads wait for explicit retry.
  useEffect(() => {
    openedRef.current = null;
    setConversationError('');
  }, [id, store]);

  // Wait for an existing reply/history request, then load the conversation in the URL.
  useEffect(() => {
    if (!store || !id || storeBusy || conversationError || openedRef.current === id) return;
    openedRef.current = id;
    store.openConversation(id).catch((caught) => {
      if (openedRef.current !== id) return;
      openedRef.current = null;
      setConversationError(friendlyError(caught));
    });
  }, [id, store, storeBusy, conversationError]);

  // 历史对话里的照片需要带鉴权重新取回
  useEffect(() => {
    if (!store || !activeId || hydratedRef.current === activeId) return;
    hydratedRef.current = activeId;
    void store.hydratePhotos();
  }, [store, activeId]);

  // 新内容到达时，若用户仍在底部则自动跟随
  useEffect(() => {
    if (!followRef.current) return;
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
  }, [revision]);

  useEffect(() => {
    const onScroll = () => {
      const distance =
        document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      followRef.current = distance < 140;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // 公式与配图渲染完成后高度会变化，内容尺寸一变就重新跟随到底部
  useEffect(() => {
    const target = mainRef.current;
    if (!target || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      if (followRef.current) window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' });
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const report = useCallback((message: string) => {
    setError(message);
    toast(message);
  }, []);

  if (!store) return null;

  async function send() {
    if (!store) return;
    const text = draft.trim();
    if (!text && !photo) return;
    setDraft('');
    setError('');
    followRef.current = true;
    const payload = photo;
    setPhoto(null);
    try {
      await store.send(text, payload ? { photo: payload } : {});
    } catch (caught) {
      report(friendlyError(caught));
    }
  }

  async function derive(kind: DeriveKind, key: string) {
    if (!store) return;
    const raw = store.question(key);
    if (!raw) return;
    setError('');
    followRef.current = true;
    try {
      await store.send(derivePrompt(raw, kind), {
        selectedQuestion: { id: raw.id, bankVersion: raw.bankVersion },
      });
    } catch (caught) {
      report(friendlyError(caught));
    }
  }

  function openAnalysis(key: string) {
    if (!store) return;
    const raw = store.question(key);
    if (!raw) return;
    try {
      store.selectQuestion(raw);
    } catch {
      /* 题目尚未收录时忽略选中 */
    }
    setAnalysisKey(key);
  }

  async function confirmVideo() {
    if (!store || !videoKey) return;
    const raw = store.question(videoKey);
    if (!raw) return;
    setSubmitting(true);
    try {
      await store.enqueue(raw, '');
      toast('已提交，可在「我的视频」查看');
      setVideoKey(null);
    } catch (caught) {
      report(friendlyError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const analysisRaw = analysisKey ? store.question(analysisKey) : null;
  const analysis = analysisRaw ? safeView(analysisRaw) : null;
  const videoRaw = videoKey ? store.question(videoKey) : null;
  const videoQuestion = videoRaw ? safeView(videoRaw) : null;

  return (
    <>
      <main className="page page--composer chat" ref={mainRef}>
        {conversationError ? (
          <div className="notice notice--danger" role="alert">
            <span>{conversationError}</span>
            <button type="button" className="btn btn--quiet" onClick={() => setConversationError('')}>重新加载对话</button>
          </div>
        ) : waitingForConversation ? <p className="muted">正在加载对话…</p> : null}
        {pendingVideos > 0 ? (
          <button type="button" className="chat__notice" onClick={() => navigate('/videos')}>
            <span className="chat__notice-text">
              <strong>{pendingVideos}</strong> 个视频后台制作中
            </span>
            <span className="chat__notice-link">
              我的视频
              <Icon name="chevron" size={14} />
            </span>
          </button>
        ) : null}

        {!turns.length && !busy && !error ? (
          <div className="empty">
            <span className="empty__icon">
              <Icon name="book" size={30} />
            </span>
            <p className="empty__title">开始一次备课</p>
            <p className="empty__text">{EMPTY_HINT}</p>
          </div>
        ) : null}

        {turns.map((turn, index) => {
          const keys = turn.questions.map((item) => questionView(item).key);
          return (
            <section className="turn" key={`${index}-${turn.prompt}`}>
              <div className="turn__user">
                {turn.photo ? (
                  <img className="turn__photo" src={turn.photo} alt="题目照片" />
                ) : null}
                <p className="turn__prompt">{turn.prompt}</p>
              </div>

              <AgentMessage turnIndex={index} conversationId={activeId ?? ''} />

              {keys.length ? (
                <div className={['carousel', keys.length === 1 ? 'carousel--single' : ''].join(' ')}>
                  <div className="carousel__row">
                    {keys.map((key) => (
                      <div className="carousel__slot" key={key}>
                        <QuestionCard
                          questionKey={key}
                          disabled={busy}
                          onAnalysis={openAnalysis}
                          onDerive={derive}
                          onVideo={setVideoKey}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {turn.error ? (
                <div className="notice notice--danger turn__error" role="alert">
                  <Icon name="alert" size={17} />
                  <span>{friendlyError(turn.error)}</span>
                </div>
              ) : null}
            </section>
          );
        })}

        {error ? (
          <div className="notice notice--danger chat__error" role="alert">
            <Icon name="alert" size={17} />
            <span>{error}</span>
          </div>
        ) : null}
      </main>

      <div className="composer-dock">
        <ChatComposer
          value={draft}
          photo={photo}
          busy={busy}
          placeholder="继续说说这道题，或补充要求"
          onChange={setDraft}
          onPhotoChange={setPhoto}
          onSend={() => void send()}
          onError={report}
        />
      </div>

      <Sheet
        open={!!analysis}
        title="题目解析"
        onClose={() => setAnalysisKey(null)}
        footer={
          <button
            type="button"
            className="btn btn--primary btn--block"
            onClick={() => {
              const key = analysisKey;
              setAnalysisKey(null);
              if (key) setVideoKey(key);
            }}
          >
            <Icon name="play" size={17} />
            生成讲解视频
          </button>
        }
      >
        {analysis ? (
          <>
            <div className="sheet__meta">
              <span className="pill pill--plain">{analysis.source}</span>
              <span className="pill pill--plain">{analysis.kind}</span>
              <span className="pill pill--plain">{analysis.level}</span>
            </div>
            <h3 className="sheet__heading">{analysis.title}</h3>
            <QuestionDiagrams diagrams={analysis.raw.diagrams} />
            <Markdown
              value={analysis.explanation || analysis.answer || '暂无解析'}
              questionKey={analysisKey ?? undefined}
            />
          </>
        ) : null}
      </Sheet>

      <ConfirmDialog
        open={!!videoQuestion}
        title="制作讲解视频？"
        busy={submitting}
        confirmText="确认制作"
        onCancel={() => setVideoKey(null)}
        onConfirm={() => void confirmVideo()}
        description={
          videoQuestion ? (
            <>
              <p style={{ margin: '0 0 8px' }}>{videoQuestion.source}</p>
              <p style={{ margin: 0 }}>
                将使用 <strong>1 次</strong>视频额度，提交后在「我的视频」查看进度。
              </p>
            </>
          ) : null
        }
      />
    </>
  );
}

function safeView(raw: Parameters<typeof questionView>[0]) {
  try {
    return questionView(raw);
  } catch {
    return null;
  }
}
