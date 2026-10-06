import type { TutorClient } from '../api/client';
import { ApiError } from '../api/errors';
import type { AgentEvent, Conversation, Me, Question, Turn, VideoJob } from '../api/types';
import { MediaCache } from '../lib/media';
import { displayPrompt, questionView } from '../lib/questionView';

export interface StoreState {
  user: Me | null;
  credits: number | null;
  conversations: Conversation[];
  activeId: string | null;
  currentQuestion: { id: string; bankVersion: string } | null;
  turns: Turn[];
  jobs: VideoJob[];
  busy: boolean;
  error: string | null;
}

export interface SendSettings {
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
  selectQuestion(question: Question): void;
  similar(question: Question): Promise<void>;
  refreshJobs(): Promise<void>;
  enqueue(question: Question, requirements?: string, intent?: string): Promise<VideoJob>;
  retry(id: string): Promise<VideoJob>;

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
    currentQuestion: null,
    turns: [],
    jobs: [],
    busy: false,
    error: null,
  };

  let activeRequest: { done: Promise<void>; cancel: () => void } | null = null;
  let loadingJobs: Promise<void> | null = null;
  let selection = 0;
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
      for (const raw of turn.questions) questions.set(questionView(raw).key, raw);
    }
    for (const job of state.jobs) {
      try {
        const snapshot = JSON.parse(job.snapshot) as { question: Question };
        questions.set(questionView(snapshot.question).key, snapshot.question);
      } catch {
        /* 快照损坏时忽略这一条 */
      }
    }
  }

  function applyEvent(turn: Turn, event: AgentEvent): void {
    if (event.type === 'text' && typeof event.text === 'string') turn.reply += event.text;
    if (event.type === 'status' && typeof event.text === 'string') turn.status = event.text;
    if (event.type === 'text_reset' && typeof event.text === 'string') turn.reply = event.text;
    if (event.type === 'question') {
      questionView(event.question);
      const exists = turn.questions.some(
        (item) => item.id === event.question.id && item.bankVersion === event.question.bankVersion,
      );
      if (!exists) turn.questions.push(event.question);
    }
    if (event.type === 'error') turn.error = String(event.error || 'AGENT_FAILED');
  }

  function rememberKey(fingerprint: string): string {
    if (!keys.has(fingerprint)) {
      if (keys.size >= 100) {
        const oldest = keys.keys().next().value;
        if (oldest !== undefined) keys.delete(oldest);
      }
      keys.set(fingerprint, createId());
      if (options.saveKeys && state.user) options.saveKeys(state.user.id, [...keys]);
    }
    return keys.get(fingerprint) as string;
  }

  async function initialize(): Promise<void> {
    state.user = await client.me();
    if (options.loadKeys) {
      for (const item of options.loadKeys(state.user.id) ?? []) keys.set(item[0], item[1]);
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
    if (state.busy) throw stateError('MESSAGE_IN_PROGRESS');
    const token = ++selection;
    const value = await client.getConversation(id);
    if (token !== selection || disposed) return;

    const turns: Turn[] = [];
    for (const message of value.messages) {
      if (message.role === 'user') {
        let prompt = message.content;
        let photoId: string | undefined;
        try {
          const saved = JSON.parse(message.content) as {
            type?: string;
            text?: string;
            photoId?: string;
          };
          if (saved.type === 'teacher_input' && typeof saved.text === 'string' && typeof saved.photoId === 'string') {
            prompt = saved.text || '请识别这道题并检索匹配真题。';
            photoId = saved.photoId;
          }
        } catch {
          /* 纯文本输入 */
        }
        turns.push({ prompt: displayPrompt(prompt), photoId, reply: '', questions: [], error: null });
      } else if (message.role === 'assistant') {
        const turn = turns[turns.length - 1];
        if (!turn) continue;
        for (const line of message.content.split('\n').filter(Boolean)) {
          try {
            applyEvent(turn, JSON.parse(line) as AgentEvent);
          } catch {
            turn.error = 'INVALID_SAVED_MESSAGE';
          }
        }
      }
    }

    for (const turn of turns) {
      if (turn.questions.length && turn.reply.length > 160) {
        turn.reply = '题目已找到，解析和后续操作见题卡。';
      }
    }

    state.activeId = id;
    state.turns = turns;
    state.currentQuestion = value.context?.currentQuestion ?? null;
    if (!state.currentQuestion) {
      outer: for (const turn of turns) {
        for (const item of turn.questions) {
          state.currentQuestion = { id: item.id, bankVersion: item.bankVersion };
          break outer;
        }
      }
    }
    emit();
  }

  async function send(text: string, settings: SendSettings = {}): Promise<void> {
    if (state.busy) throw stateError('MESSAGE_IN_PROGRESS');
    let content = String(text ?? '').trim();
    if (!content && !settings.photo) throw stateError('MESSAGE_REQUIRED');
    if (!content) content = '请识别这道题并检索匹配真题。';

    state.busy = true;
    state.error = null;
    emit();

    let turn: Turn | undefined;
    try {
      if (!state.activeId || settings.newConversation) {
        const created = await client.createConversation(content.slice(0, 50));
        state.activeId = created.id;
        state.turns = [];
        state.currentQuestion = null;
        state.conversations.unshift(created);
      }

      let photoId: string | undefined;
      if (settings.photo) {
        const uploaded = await client.uploadPhoto(state.activeId, {
          mimeType: settings.photo.mimeType,
          data: settings.photo.data,
        });
        photoId = uploaded.id;
      }

      turn = {
        prompt: displayPrompt(content),
        photoId,
        photo: settings.photo?.preview,
        reply: '',
        questions: [],
        error: null,
      };
      state.turns.push(turn);
      emit();

      const current = turn;
      activeRequest = client.sendMessage(
        state.activeId,
        {
          text: content,
          ...(photoId ? { photoId } : {}),
          ...(settings.selectedQuestion || state.currentQuestion
            ? { selectedQuestion: settings.selectedQuestion ?? state.currentQuestion! }
            : {}),
        },
        (event) => {
          applyEvent(current, event);
          if (event.type === 'question') {
            state.currentQuestion = {
              id: event.question.id,
              bankVersion: event.question.bankVersion,
            };
          }
          emit();
        },
      );

      await activeRequest.done;
      if (turn.error) throw stateError(turn.error);
    } catch (error) {
      const code = (error as ApiError).code ?? 'NETWORK_ERROR';
      state.error = code;
      if (turn) turn.error = code;
      throw error;
    } finally {
      activeRequest = null;
      state.busy = false;
      emit();
    }
  }

  function selectQuestion(question: Question): void {
    questionView(question);
    const known = state.turns.some((turn) =>
      turn.questions.some((item) => item.id === question.id && item.bankVersion === question.bankVersion),
    );
    if (!known) throw stateError('QUESTION_NOT_FOUND');
    state.currentQuestion = { id: question.id, bankVersion: question.bankVersion };
    emit();
  }

  async function similar(question: Question): Promise<void> {
    if (state.busy) throw stateError('MESSAGE_IN_PROGRESS');
    const turn: Turn = { prompt: '找一道相似题', reply: '', questions: [], error: null };
    state.turns.push(turn);
    state.busy = true;
    emit();
    try {
      const parentId = (question as Question & { parentId?: string }).parentId || question.id;
      const result = await client.findSimilar(parentId, question.bankVersion);
      turn.questions = await Promise.all(
        result.questions.slice(0, 5).map((item) => client.getQuestion(item.id, result.bankVersion)),
      );
      turn.reply = turn.questions.length ? '可以对比这几道题。' : '暂时没有找到可用的相似题。';
    } catch (error) {
      turn.error = (error as ApiError).code ?? 'NETWORK_ERROR';
      throw error;
    } finally {
      state.busy = false;
      emit();
    }
  }

  async function refreshJobs(): Promise<void> {
    if (loadingJobs) return loadingJobs;
    loadingJobs = (async () => {
      const [jobs, credits] = await Promise.all([client.listVideoJobs(), client.credits()]);
      state.jobs = jobs.jobs;
      state.credits = credits.available;
      emit();
    })();
    try {
      await loadingJobs;
    } finally {
      loadingJobs = null;
    }
  }

  async function enqueue(question: Question, requirements = '', intent = 'new'): Promise<VideoJob> {
    if (!state.user) throw stateError('AUTH_REQUIRED');
    const input = {
      questionId: question.id,
      bankVersion: question.bankVersion,
      requirements: String(requirements).trim(),
    };
    const fingerprint = JSON.stringify({ intent, ...input });
    const key = rememberKey(fingerprint);
    const result = await client.createVideoJob(input, key);
    const index = state.jobs.findIndex((job) => job.id === result.job.id);
    if (index < 0) state.jobs.unshift(result.job);
    else state.jobs[index] = result.job;
    emit();
    return result.job;
  }

  async function retry(id: string): Promise<VideoJob> {
    const job = state.jobs.find((item) => item.id === id);
    if (!job || job.status !== 'failed') throw stateError('JOB_NOT_FAILED');
    const snapshot = JSON.parse(job.snapshot) as { question: Question; requirements?: string };
    return enqueue(snapshot.question, snapshot.requirements || '', `retry:${id}`);
  }

  function question(key: string): Question | undefined {
    return questions.get(key);
  }

  function assetUrl(key: string, index: number): Promise<string> {
    const raw = questions.get(key);
    const asset = raw?.assets?.[index];
    if (!raw || !asset) return Promise.reject(stateError('ASSET_NOT_FOUND'));
    return media.get(`asset:${key}:${index}`, () => client.fetchAsset(raw.id, index, raw.bankVersion));
  }

  function photoUrl(conversationId: string, photoId: string): Promise<string> {
    return media.get(`photo:${conversationId}:${photoId}`, () => client.fetchPhoto(conversationId, photoId));
  }

  function videoUrl(jobId: string): Promise<string> {
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job || job.status !== 'ready') return Promise.reject(stateError('VIDEO_NOT_READY'));
    return client.videoPlayback(jobId).then(result => result.url);
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
    selectQuestion,
    similar,
    refreshJobs,
    enqueue,
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
