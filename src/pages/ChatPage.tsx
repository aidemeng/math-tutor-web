import { QuestionAnnotations } from '../components/QuestionAnnotations';
import { UserMessage } from "../components/UserMessage";
import {TurnError} from "../components/TurnError";
import { VideoDraftCard } from "../components/VideoDraftCard";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { friendlyError } from "../api/errors";
import { AgentMessage } from "../components/AgentMessage";
import { ChatComposer } from "../components/ChatComposer";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Icon } from "../components/Icon";
import { QuestionDiagrams } from "../components/QuestionDiagram";
import { Markdown } from "../components/Markdown";
import { QuestionCard, type DeriveKind } from "../components/QuestionCard";
import { QuestionResults } from "../components/QuestionResults";
import { Sheet } from "../components/Sheet";
import { toast, useErrorToast } from "../components/Toast";
import { derivePrompt, questionView } from "../lib/questionView";
import type { PhotoPayload } from "../lib/photo";
import { quotedQuestionMessage, type QuestionQuote } from "../lib/questionQuote";
import { COMPOSER_INTENTS, type ComposerIntentId } from "../lib/composerIntents";
import { useApp, useStoreRevision } from "../store/AppContext";
import "../styles/chat.css";
import { startMistakeAnalysis } from '../lib/startMistakeAnalysis';
import { MistakeAnalyses } from '../components/mistakes/MistakeAnalyses';

const EMPTY_HINT = "发来一道题，我们一起备课";

export function ChatPage() {
  const { store, client } = useApp();
  const revision = useStoreRevision();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [startingMistake, setStartingMistake] = useState(false);
  const [hasMistakes, setHasMistakes] = useState(false);
  const [mistakeRevision, setMistakeRevision] = useState(0);
  const [composerIntent, setComposerIntent] = useState<ComposerIntentId | null>(null);

  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<PhotoPayload | null>(null);
  const [quote, setQuote] = useState<QuestionQuote | null>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const [annotationActions, setAnnotationActions] = useState<HTMLDivElement | null>(null);
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [readerTab, setReaderTab] = useState<"question" | "analysis">(
    "question",
  );
  const readerRef = useRef<HTMLDivElement>(null);
  const readerPositions = useRef<Record<string, number>>({});
  useLayoutEffect(() => {
    const scroller = readerRef.current?.parentElement;
    const key = `${detailKey}:${readerTab}`;
    scroller?.scrollTo({top: readerPositions.current[key] ?? 0});
    return () => {if (scroller) readerPositions.current[key] = scroller.scrollTop;};
  }, [detailKey, readerTab]);
  const [videoKey, setVideoKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [conversationError, setConversationError] = useState("");
  useErrorToast(conversationError);

  const openedRef = useRef<string | null>(null);
  const followRef = useRef(true);
  const hydratedRef = useRef<string | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  // Mobile keyboards can shrink only the visual viewport, leaving fixed
  // elements and the document's layout viewport behind the keyboard.
  useLayoutEffect(() => {
    const main = mainRef.current;
    const dock = dockRef.current;
    const input = composerInputRef.current;
    if (!main || !dock || !input) return;
    const viewport = window.visualViewport;
    const previousBottom = dock.style.bottom;
    const previousPadding = main.style.paddingBottom;
    let frame = 0;
    const update = () => {
      frame = 0;
      // Pinch zoom changes the visual viewport too; it is not a keyboard inset.
      const inset = viewport && Math.abs(viewport.scale - 1) < 0.01
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      dock.style.bottom = `${inset}px`;
      // Include attachments, quoted text and an expanded draft in the reserved
      // space so the last message can always scroll above the whole composer.
      main.style.paddingBottom = `${inset + dock.getBoundingClientRect().height + 12}px`;
      if (followRef.current)
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'auto' });
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const focus = () => {
      followRef.current = true;
      schedule();
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    observer?.observe(dock);
    viewport?.addEventListener('resize', schedule);
    viewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    input.addEventListener('focus', focus);
    input.addEventListener('blur', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      viewport?.removeEventListener('resize', schedule);
      viewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      input.removeEventListener('focus', focus);
      input.removeEventListener('blur', schedule);
      dock.style.bottom = previousBottom;
      main.style.paddingBottom = previousPadding;
    };
  }, [!!store]);

  const activeId = store?.state.activeId ?? null;
  const waitingForConversation = !!id && activeId !== id;
  const turns = waitingForConversation ? [] : (store?.state.turns ?? []);
  const storeBusy = store?.state.busy ?? false;
  const busy = storeBusy || waitingForConversation || startingMistake;
  const pendingVideos =
    store?.state.jobs.filter(
      (job) => job.status === "queued" || job.status === "running",
    ).length ?? 0;

  // A changed route gets its own load attempt. Failed loads wait for explicit retry.
  useEffect(() => {
    openedRef.current = null;
    setConversationError("");
    setQuote(null);
    setHasMistakes(false);
    setComposerIntent(null);
  }, [id, store]);

  // Bind completed new conversations to their saved URL so refreshing can restore them.
  useEffect(() => {
    if (!id && activeId && !storeBusy) navigate(`/chat/${activeId}`, { replace: true });
  }, [id, activeId, storeBusy, navigate]);

  // Wait for an existing reply/history request, then load the conversation in the URL.
  useEffect(() => {
    if (
      !store ||
      !id ||
      storeBusy ||
      conversationError ||
      openedRef.current === id
    )
      return;
    openedRef.current = id;
    if (store.state.activeId === id && store.state.turns.length > 0) return;
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
    window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" });
  }, [revision]);

  useEffect(() => {
    const onScroll = () => {
      const distance =
        document.documentElement.scrollHeight -
        window.scrollY -
        window.innerHeight;
      followRef.current = distance < 140;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // 公式与配图渲染完成后高度会变化，内容尺寸一变就重新跟随到底部
  useEffect(() => {
    const target = mainRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (followRef.current)
        window.scrollTo({ top: document.body.scrollHeight, behavior: "auto" });
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const report = useCallback((message: string) => {
    toast(message);
  }, []);

  if (!store) return null;

  function selectComposerIntent(intent: ComposerIntentId) {
    const previous = Object.values(COMPOSER_INTENTS).find(item => draft.startsWith(item.prompt));
    const supplement = previous ? draft.slice(previous.prompt.length).trimStart() : draft.trim();
    const next = [COMPOSER_INTENTS[intent].prompt, supplement].filter(Boolean).join('\n');
    if (next.length > 4000) {
      report('输入内容较长，请先精简一些文字再切换用途');
      return;
    }
    setDraft(next);
    setComposerIntent(intent);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }

  async function send() {
    if (!store || busy) return;
    const text = draft.trim();
    if (!text && !photo) return;
    const message = quote ? quotedQuestionMessage(quote, text) : text;
    if (message.length > 4000) {
      report("引用和问题合计过长，请缩短问题或重新选取较短片段");
      return;
    }
    if (!quote && (composerIntent === 'diagnosis' || draft.startsWith(COMPOSER_INTENTS.diagnosis.prompt))) {
      if (!photo) { report('请上传包含题目和学生作答的图片'); return; }
      setStartingMistake(true);
      composerInputRef.current?.blur();
      try {
        const created = await startMistakeAnalysis(client, photo, message, activeId ?? undefined);
        setDraft(''); setPhoto(null); setQuote(null); setComposerIntent(null);
        followRef.current = true;
        setMistakeRevision(value => value + 1);
        void store.refreshConversations().catch(() => {});
        navigate(`/chat/${created.conversationId}?analysis=${created.analysis.id}`);
      } catch (error) { report(friendlyError(error)); }
      finally { setStartingMistake(false); }
      return;
    }
    composerInputRef.current?.blur();
    setComposerIntent(null);
    setDraft("");
    followRef.current = true;
    const payload = photo;
    const quoted = quote;
    setPhoto(null);
    setQuote(null);
    try {
      await store.send(message, {
        ...(payload ? { photo: payload } : {}),
        ...(quoted ? { selectedQuestion: {id: quoted.questionId, bankVersion: quoted.bankVersion} } : {}),
      });
    } catch (caught) {
      report(friendlyError(caught));
    }
  }

  async function retryTurn(index: number) {
    if (!store || busy) return;
    followRef.current = true;
    try {await store.retryTurn(index);}
    catch (caught) {report(friendlyError(caught));}
  }

  async function derive(kind: DeriveKind, key: string) {
    if (!store) return;
    const raw = store.question(key);
    if (!raw) return;
    followRef.current = true;
    try {
      await store.send(derivePrompt(raw, kind), {
        selectedQuestion: { id: raw.id, bankVersion: raw.bankVersion },
      });
    } catch (caught) {
      report(friendlyError(caught));
    }
  }

  function openQuestion(
    key: string,
    tab: "question" | "analysis" = "question",
  ) {
    setReaderTab(tab);
    setDetailKey(key);
  }

  async function confirmVideo() {
    if (!store || !videoKey) return;
    const raw = store.question(videoKey);
    if (!raw) return;
    setSubmitting(true);
    try {
      await store.enqueue(raw, "");
      toast("已提交，可在「我的视频」查看");
      setVideoKey(null);
    } catch (caught) {
      report(friendlyError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  const detailRaw = detailKey ? store.question(detailKey) : null;
  const detail = detailRaw ? safeView(detailRaw) : null;
  const videoRaw = videoKey ? store.question(videoKey) : null;
  const videoQuestion = videoRaw ? safeView(videoRaw) : null;
  const composerIntents: ComposerIntentId[] = ['search', 'diagnosis', 'analysis', 'method'];

  return (
    <>
      <main className="page page--composer chat" ref={mainRef}>
        {conversationError ? (
          <div>
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setConversationError("")}
            >
              重新加载对话
            </button>
          </div>
        ) : waitingForConversation ? (
          <p className="muted">正在加载对话…</p>
        ) : null}
        {pendingVideos > 0 ? (
          <button
            type="button"
            className="chat__notice"
            onClick={() => navigate("/videos")}
          >
            <span className="chat__notice-text">
              <strong>{pendingVideos}</strong> 个视频后台制作中
            </span>
            <span className="chat__notice-link">
              我的视频
              <Icon name="chevron" size={14} />
            </span>
          </button>
        ) : null}

        {!turns.length && !busy && !hasMistakes && !searchParams.get('analysis') ? (
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
              <UserMessage photo={turn.photo} prompt={turn.prompt} />
              <AgentMessage turnIndex={index} conversationId={activeId ?? ""}>
                {keys.length ? (
                  <div
                    className="question-results"
                    onPointerDownCapture={() => {
                      followRef.current = false;
                    }}
                    onFocusCapture={() => {
                      followRef.current = false;
                    }}
                  >
                    <QuestionResults
                      questionKeys={keys}
                      onOpen={openQuestion}
                    />
                  </div>
                ) : null}
                {turn.videoDraft ? (
                  <VideoDraftCard draft={turn.videoDraft} />
                ) : null}
              </AgentMessage>

              {turn.error ? (
                <TurnError disabled={busy} onRetry={() => void retryTurn(index)}/>
              ) : null}
            </section>
          );
        })}

        {activeId && !waitingForConversation && <MistakeAnalyses
          key={activeId} client={client} conversationId={activeId} refresh={mistakeRevision}
          initialOpenId={searchParams.get('analysis')} onRecordsChange={setHasMistakes}/>}
      </main>

      <div className="composer-dock" ref={dockRef}>
        {!quote && <div className="chat__composer-intents" role="group" aria-label="提问用途">
          {composerIntents.map(intent => (
            <button key={intent} type="button" disabled={busy}
              aria-pressed={composerIntent === intent || (!composerIntent && draft.startsWith(COMPOSER_INTENTS[intent].prompt))}
              onClick={() => selectComposerIntent(intent)}>
              {COMPOSER_INTENTS[intent].label}
            </button>
          ))}
        </div>}
        {quote && <div className="question-quote" role="group" aria-label="待发送的引用">
          <div><span className="question-quote__source">引用{quote.section === "question" ? "题目" : "解析"} · {quote.source}</span>
            <div className="question-quote__text"><Markdown value={quote.text} /></div>
          </div>
          <button type="button" className="iconbtn iconbtn--plain" aria-label="移除引用" onClick={() => setQuote(null)}><Icon name="close" size={16} /></button>
        </div>}
        <ChatComposer
          inputRef={composerInputRef}
          maxRows={4}
          value={draft}
          photo={photo}
          busy={busy}
          placeholder={quote ? "问问这一步" : "继续提问或补充"}
          onChange={value => {setDraft(value); if (!value.trim()) setComposerIntent(null);}}
          onPhotoChange={setPhoto}
          onSend={() => void send()}
          onError={report}
        />
      </div>

      <Sheet
        open={!!detail}
        title="题目与解析"
        onClose={() => setDetailKey(null)}
        navigation={
          <div className="question-reader__navigation">
          <div
            className="question-reader__tabs"
            role="tablist"
            aria-label="题目阅读内容"
          >
            {(["question", "analysis"] as const).map((tab, index) => (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`reader-tab-${tab}`}
                aria-selected={readerTab === tab}
                aria-controls={`reader-panel-${tab}`}
                tabIndex={readerTab === tab ? 0 : -1}
                onClick={() => setReaderTab(tab)}
                onKeyDown={(event) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    const tabs = ["question", "analysis"] as const;
                    const next = tabs[event.key === "Home" ? 0 : event.key === "End" ? 1 : (index + 1) % 2];
                    setReaderTab(next);
                    document.getElementById(`reader-tab-${next}`)?.focus();
                  }
                }}
              >
                {tab === "question" ? "题目" : "解析"}
              </button>
            ))}
          </div>
          <div className="question-reader__actions" ref={setAnnotationActions} />
          </div>
        }
        footer={
          detailKey ? (
            <button
              type="button"
              className="btn btn--primary qcard__video"
              disabled={busy}
              onClick={() => {
                setDetailKey(null);
                if (detailKey) setVideoKey(detailKey);
              }}
            >
              <Icon name="square-play" size={22} />
              生成讲解视频
            </button>
          ) : undefined
        }
      >
        <div ref={readerRef} className="question-reader">
          <div
            role="tabpanel"
            id={`reader-panel-${readerTab}`}
            aria-labelledby={`reader-tab-${readerTab}`}
          >
            {detail && <QuestionAnnotations key={detail.key} question={detail} section={readerTab} client={client}
              actionsTarget={annotationActions}
              onQuote={(text) => {
                setQuote({questionId: detail.id, bankVersion: detail.bankVersion, source: detail.source,
                  section: readerTab, text});
                setDetailKey(null);
                requestAnimationFrame(() => composerInputRef.current?.focus());
              }}>
            {detailKey && readerTab === "question" ? (
              <QuestionCard
                questionKey={detailKey}
                disabled={busy}
                onDerive={(kind, key) => {
                  setDetailKey(null);
                  void derive(kind, key);
                }}
              />
            ) : detail ? (
              <div className="question-reader__analysis">
                <div className="sheet__meta">
                  <span className="pill pill--plain">{detail.source}</span>
                </div>
                <h3 className="sheet__heading">{detail.title}</h3>
                <QuestionDiagrams diagrams={detail.raw.diagrams} />
                <Markdown
                  value={detail.explanation || detail.answer || "暂无解析"}
                  questionKey={detailKey ?? undefined}
                />
              </div>
            ) : null}
            </QuestionAnnotations>}
          </div>
        </div>
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
              <p style={{ margin: "0 0 8px" }}>{videoQuestion.source}</p>
              <p style={{ margin: 0 }}>
                将使用 <strong>1 次</strong>
                视频额度，提交后在「我的视频」查看进度。
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
