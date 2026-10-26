import type { TutorClient } from "../api/client";
import { ApiError } from "../api/errors";
import type {
  AgentEvent,
  Conversation,
  Me,
  Question,
  Turn,
  VideoJob,
} from "../api/types";
import { MediaCache } from "../lib/media";
import { displayPrompt, questionView } from "../lib/questionView";

export interface StoreState {
  user: Me | null;
  credits: number | null;
  conversations: Conversation[];
  activeId: string | null;
  turns: Turn[];
  jobs: VideoJob[];
  busy: boolean;
  error: string | null;
}

export interface SendSettings {
  photoId?: string;
  photoPreview?: string;
  photo?: { mimeType: string; data: string; preview?: string };
  newConversation?: boolean;
  selectedQuestion?: { id: string; bankVersion: string };
}

export interface TeacherStore {
  state: StoreState;
  /** 单调递增版本号，供 React 订阅使用。 */
  revision: number;
  subscribe(listener: () => void): () => void;

  initialize(): Promise<void>;
  refreshConversations(): Promise<void>;
  openConversation(id: string): Promise<void>;
  send(text: string, settings?: SendSettings): Promise<void>;
  readonly canStop: boolean;
  stopReply(): boolean;
  retryTurn(index: number): Promise<void>;
  similar(question: Question): Promise<void>;
  refreshJobs(): Promise<void>;
  redeemCredits(code: string): Promise<number>;
  enqueue(
    question: Question,
    requirements?: string,
    intent?: string,
  ): Promise<VideoJob>;
  retry(id: string): Promise<VideoJob>;
  submitDraft(id: string, retryOf?: string): Promise<VideoJob>;

  /** 按题卡 key 取原始题目。 */
  question(key: string): Question | undefined;

  assetUrl(key: string, index: number): Promise<string>;
  photoUrl(conversationId: string, photoId: string): Promise<string>;
  videoUrl(jobId: string): Promise<string>;
  downloadVideo(jobId: string): Promise<string>;
  /** 为历史对话补齐照片地址。 */
  hydratePhotos(): Promise<void>;

  dispose(): void;
}

function stateError(code: string): ApiError {
  return new ApiError(code, 0);
}

export function createTeacherStore(options: {
  client: TutorClient;
  createId?: () => string;
  loadKeys?: (userId: string) => [string, string][];
  saveKeys?: (userId: string, keys: [string, string][]) => void;
}): TeacherStore {
  const { client } = options;
  const createId = options.createId ?? (() => crypto.randomUUID());

  const listeners = new Set<() => void>();
  const keys = new Map<string, string>();
  const questions = new Map<string, Question>();
  const media = new MediaCache();

  const state: StoreState = {
    user: null,
    credits: null,
    conversations: [],
    activeId: null,
    turns: [],
    jobs: [],
    busy: false,
    error: null,
  };

  let activeRequest: { done: Promise<void>; cancel: () => void } | null = null;
  let loadingJobs: Promise<void> | null = null;
  let selection = 0;
  let loadingConversation = false;
  let jobsVersion = 0;
  let disposed = false;
  let revision = 0;

  function emit(): void {
    if (disposed) return;
    indexQuestions();
    revision += 1;
    for (const listener of listeners) listener();
  }

  function indexQuestions(): void {
    for (const turn of state.turns) {
      for (const raw of turn.questions)
        questions.set(questionView(raw).key, raw);
      for (const example of turn.videoDraft?.examples || [])
        questions.set(questionView(example.question).key, example.question);
    }
    for (const job of state.jobs) {
      try {
        const snapshot = JSON.parse(job.snapshot) as { question?: Question; examples?: {question: Question}[] };
        if (snapshot.question) questions.set(questionView(snapshot.question).key, snapshot.question);
        for (const example of snapshot.examples || [])
          questions.set(questionView(example.question).key, example.question);
      } catch {
        /* 快照损坏时忽略这一条 */
      }
    }
  }

  function applyEvent(turn: Turn, event: AgentEvent): void {
    turn.lastActivityAt = Date.now();
    if (event.type === "video_draft") turn.videoDraft = event.draft;
    if (event.type === "video_job") {
      const i = state.jobs.findIndex((j) => j.id === event.job.id);
      if (i < 0) state.jobs.unshift(event.job);
      else state.jobs[i] = event.job;
      jobsVersion++;
      void refreshJobs().catch(() => {});
    }

    if (event.type === "text" && typeof event.text === "string")
      turn.reply += event.text;
    if (event.type === "status" && typeof event.text === "string")
      turn.status = event.text;
    if (event.type === "text_reset" && typeof event.text === "string")
      turn.reply = event.text;
    if (event.type === "question") {
      questionView(event.question);
      const existing = turn.questions.findIndex(
        (item) =>
          item.id === event.question.id &&
          item.bankVersion === event.question.bankVersion ||
          (item.kind === "solution" && event.question.kind === "solution" &&
            !!item.photoId && item.photoId === event.question.photoId &&
            item.stem === event.question.stem),
      );
      if (existing < 0) turn.questions.push(event.question);
      else turn.questions[existing] = event.question;
    }
    if (event.type === "error")
      turn.error = String(event.error || "AGENT_FAILED");
  }

  function rememberKey(fingerprint: string): string {
    if (!keys.has(fingerprint)) {
      if (keys.size >= 100) {
        const oldest = keys.keys().next().value;
        if (oldest !== undefined) keys.delete(oldest);
      }
      keys.set(fingerprint, createId());
      if (options.saveKeys && state.user)
        options.saveKeys(state.user.id, [...keys]);
    }
    return keys.get(fingerprint) as string;
  }

  async function initialize(): Promise<void> {
    state.user = await client.me();
    if (options.loadKeys) {
      for (const item of options.loadKeys(state.user.id) ?? [])
        keys.set(item[0], item[1]);
    }
    const [conversations, jobs, credits] = await Promise.all([
      client.listConversations(),
      client.listVideoJobs(),
      client.credits(),
    ]);
    state.conversations = conversations.conversations;
    state.jobs = jobs.jobs;
    state.credits = credits.available;
    state.error = null;
    emit();
  }

  async function refreshConversations(): Promise<void> {
    state.conversations = (await client.listConversations()).conversations;
    emit();
  }

  async function openConversation(id: string): Promise<void> {
    if (state.busy && !loadingConversation)
      throw stateError("MESSAGE_IN_PROGRESS");
    const token = ++selection;
    loadingConversation = true;
    state.busy = true;
    emit();
    try {
      const value = await client.getConversation(id);
      if (token !== selection || disposed) return;

      const turns: Turn[] = [];
      for (const message of value.messages) {
        if (message.role === "user") {
          let prompt = message.content;
          let photoId: string | undefined;
          let selectedQuestion: Turn["selectedQuestion"];
          try {
            const saved = JSON.parse(message.content) as {
              type?: string;
              text?: string;
              photoId?: string;
              selectedQuestion?: {id?: unknown; bankVersion?: unknown};
            };
            if (
              saved.type === "teacher_input" &&
              typeof saved.text === "string"
            ) {
              prompt = saved.text || "请识别这道题并检索匹配真题。";
              photoId = typeof saved.photoId === "string" ? saved.photoId : undefined;
              if (typeof saved.selectedQuestion?.id === "string" && typeof saved.selectedQuestion.bankVersion === "string") {
                selectedQuestion = {id:saved.selectedQuestion.id,bankVersion:saved.selectedQuestion.bankVersion};
              }
            }
          } catch {
            /* 纯文本输入 */
          }
          turns.push({
            prompt: displayPrompt(prompt),
            requestText: prompt,
            selectedQuestion,
            photoId,
            reply: "",
            questions: [],
            error: null,
          });
        } else if (message.role === "assistant") {
          const turn = turns[turns.length - 1];
          if (!turn) continue;
          for (const line of message.content.split("\n").filter(Boolean)) {
            try {
              applyEvent(turn, JSON.parse(line) as AgentEvent);
            } catch {
              turn.error = "INVALID_SAVED_MESSAGE";
            }
          }
        }
      }

      state.activeId = id;
      state.turns = turns;
      emit();
    } finally {
      if (token === selection && !disposed) {
        loadingConversation = false;
        state.busy = false;
        emit();
      }
    }
  }

  async function retryTurn(index: number): Promise<void> {
    const turn = state.turns[index];
    if (!turn?.error) return;
    await send(turn.requestText ?? turn.prompt, {
      photoId: turn.photoId,
      photoPreview: turn.photo,
      selectedQuestion: turn.selectedQuestion,
    });
  }

  async function send(
    text: string,
    settings: SendSettings = {},
  ): Promise<void> {
    if (state.busy) throw stateError("MESSAGE_IN_PROGRESS");
    let content = String(text ?? "").trim();
    if (!content && !settings.photo && !settings.photoId) throw stateError("MESSAGE_REQUIRED");
    if (!content) content = "请识别这道题并检索匹配真题。";

    state.busy = true;
    state.error = null;
    emit();

    let turn: Turn | undefined;
    let cancelled = false;
    let stopped!: () => void;
    const cancellation = new Promise<void>((resolve) => { stopped = resolve; });
    try {
      if (!state.activeId || settings.newConversation) {
        const created = await client.createConversation(content.slice(0, 50));
        state.activeId = created.id;
        state.turns = [];
        state.conversations.unshift(created);
      }

      let photoId = settings.photoId;
      if (settings.photo) {
        const uploaded = await client.uploadPhoto(state.activeId, {
          mimeType: settings.photo.mimeType,
          data: settings.photo.data,
        });
        photoId = uploaded.id;
      }

      turn = {
        startedAt: Date.now(),
        lastActivityAt: Date.now(),
        prompt: displayPrompt(content),
        requestText: content,
        selectedQuestion: settings.selectedQuestion,
        photoId,
        photo: settings.photo?.preview ?? settings.photoPreview,
        reply: "",
        questions: [],
        error: null,
      };
      state.turns.push(turn);
      emit();

      const current = turn;
      const transport = client.sendMessage(
        state.activeId,
        {
          text: content,
          ...(photoId ? { photoId } : {}),
          ...(settings.selectedQuestion
            ? { selectedQuestion: settings.selectedQuestion }
            : {}),
        },
        (event) => {
          if (cancelled) return;
          applyEvent(current, event);
          emit();
        },
      );

      activeRequest = {
        done: Promise.race([transport.done, cancellation]),
        cancel() {
          if (cancelled) return;
          cancelled = true;
          void Promise.resolve(transport.cancel()).catch(() => {}).finally(stopped);
        },
      };
      emit();
      await activeRequest.done;
      if (turn.error) throw stateError(turn.error);
    } catch (error) {
      if (cancelled) return;
      const code = (error as ApiError).code ?? "NETWORK_ERROR";
      state.error = code;
      if (turn) turn.error = code;
      throw error;
    } finally {
      activeRequest = null;
      state.busy = false;
      emit();
    }
  }

  async function similar(question: Question): Promise<void> {
    if (state.busy) throw stateError("MESSAGE_IN_PROGRESS");
    const turn: Turn = {
      prompt: "找一道相似题",
      reply: "",
      questions: [],
      error: null,
    };
    state.turns.push(turn);
    state.busy = true;
    emit();
    try {
      const parentId =
        (question as Question & { parentId?: string }).parentId || question.id;
      const result = await client.findSimilar(parentId, question.bankVersion);
      turn.questions = await Promise.all(
        result.questions
          .slice(0, 5)
          .map((item) => client.getQuestion(item.id, result.bankVersion)),
      );
      turn.reply = turn.questions.length
        ? "可以对比这几道题。"
        : "暂时没有找到可用的相似题。";
    } catch (error) {
      turn.error = (error as ApiError).code ?? "NETWORK_ERROR";
      throw error;
    } finally {
      state.busy = false;
      emit();
    }
  }

  async function redeemCredits(code: string): Promise<number> {
    const result = await client.redeemCredits(code).catch(async (error: unknown) => {
      if (!disposed && error instanceof ApiError && error.code === 'CREDIT_CODE_REDEEMED') {
        // The first response may have been lost after the grant committed.
        // Invalidate pending reads before reconciling the authoritative balance.
        jobsVersion++;
        await refreshJobs();
      }
      throw error;
    });
    if (!disposed) {
      jobsVersion++;
      state.credits = result.available;
      emit();
      void refreshJobs().catch(() => {});
    }
    return result.added;
  }

  async function refreshJobs(): Promise<void> {
    if (loadingJobs) return loadingJobs;
    loadingJobs = (async () => {
      // A submission can finish while an older list/balance request is in flight.
      // Read both again before publishing so neither jobs nor credits regress.
      while (!disposed) {
        const version = jobsVersion;
        const [jobs, credits] = await Promise.all([
          client.listVideoJobs(),
          client.credits(),
        ]);
        if (disposed) return;
        if (version !== jobsVersion) continue;
        state.jobs = jobs.jobs;
        state.credits = credits.available;
        emit();
        return;
      }
    })();
    try {
      await loadingJobs;
    } finally {
      loadingJobs = null;
    }
  }

  async function enqueue(
    question: Question,
    requirements = "",
    intent = "new",
  ): Promise<VideoJob> {
    if (!state.user) throw stateError("AUTH_REQUIRED");
    const input = {
      questionId: question.id,
      bankVersion: question.bankVersion,
      requirements: String(requirements).trim(),
    };
    const fingerprint = JSON.stringify({ intent, ...input });
    const key = rememberKey(fingerprint);
    const result = await client.createVideoJob(input, key);
    jobsVersion += 1;
    const index = state.jobs.findIndex((job) => job.id === result.job.id);
    if (index < 0) state.jobs.unshift(result.job);
    else state.jobs[index] = result.job;
    emit();
    void refreshJobs().catch(() => {});
    return result.job;
  }

  async function submitDraft(id: string, retryOf?: string): Promise<VideoJob> {
    if (!state.user) throw stateError("AUTH_REQUIRED");
    const result = await client.submitVideoDraft(id, retryOf);
    jobsVersion++;
    const index = state.jobs.findIndex((j) => j.id === result.job.id);
    if (index < 0) state.jobs.unshift(result.job);
    else state.jobs[index] = result.job;
    emit();
    void refreshJobs().catch(() => {});
    return result.job;
  }
  async function retry(id: string): Promise<VideoJob> {
    const job = state.jobs.find((item) => item.id === id);
    if (!job || job.status !== "failed") throw stateError("JOB_NOT_FAILED");
    const snapshot = JSON.parse(job.snapshot) as {
      question: Question;
      requirements?: string;
      draftId?: string;
    };
    if (snapshot.draftId) return submitDraft(snapshot.draftId, id);
    return enqueue(
      snapshot.question,
      snapshot.requirements || "",
      `retry:${id}`,
    );
  }

  function question(key: string): Question | undefined {
    return questions.get(key);
  }

  function assetUrl(key: string, index: number): Promise<string> {
    const raw = questions.get(key);
    const asset = raw?.assets?.[index];
    if (!raw || !asset) return Promise.reject(stateError("ASSET_NOT_FOUND"));
    return media.get(`asset:${key}:${index}`, () =>
      client.fetchAsset(raw.id, index, raw.bankVersion),
    );
  }

  function photoUrl(conversationId: string, photoId: string): Promise<string> {
    return media.get(`photo:${conversationId}:${photoId}`, () =>
      client.fetchPhoto(conversationId, photoId),
    );
  }

  function videoUrl(jobId: string): Promise<string> {
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job || job.status !== "ready")
      return Promise.reject(stateError("VIDEO_NOT_READY"));
    return client.videoPlayback(jobId).then((result) => result.url);
  }

  function downloadVideo(jobId: string): Promise<string> {
    return media.get(`video:${jobId}`, () => client.fetchVideo(jobId));
  }

  async function hydratePhotos(): Promise<void> {
    if (!state.activeId) return;
    const conversationId = state.activeId;
    await Promise.all(
      state.turns.map(async (turn) => {
        if (!turn.photoId || turn.photo) return;
        try {
          turn.photo = await photoUrl(conversationId, turn.photoId);
        } catch {
          /* 照片缺失不影响正文 */
        }
      }),
    );
    emit();
  }

  return {
    state,
    get revision() {
      return revision;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    initialize,
    refreshConversations,
    openConversation,
    send,
    retryTurn,
    get canStop() { return !!activeRequest && state.busy; },
    stopReply() {
      if (!activeRequest || !state.busy) return false;
      activeRequest.cancel();
      return true;
    },
    similar,
    refreshJobs,
    redeemCredits,
    enqueue,
    submitDraft,
    retry,
    question,
    assetUrl,
    photoUrl,
    videoUrl,
    downloadVideo,
    hydratePhotos,
    dispose() {
      disposed = true;
      selection += 1;
      activeRequest?.cancel();
      listeners.clear();
      media.dispose();
      questions.clear();
    },
  };
}
