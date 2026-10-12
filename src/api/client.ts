import { ApiError } from './errors';
import type {
  AgentEvent,
  Conversation,
  ConversationDetail,
  Me,
  Question,
  SessionInfo,
  VideoJob,
} from './types';

/** 后端基地址：留空则使用同源相对路径（开发态由 Vite 代理到本地服务）。 */
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export interface StreamHandle {
  /** 流正常结束（收到 done）时 resolve，否则 reject。 */
  done: Promise<void>;
  cancel: () => void;
}

export interface MessageOptions {
  text: string;
  photoId?: string;
  selectedQuestion?: { id: string; bankVersion: string };
}

export interface TutorClient {
  transcribeSpeech(audio: ArrayBuffer, signal?: AbortSignal): Promise<{ text: string }>;
  loginPassword(username: string, password: string): Promise<SessionInfo>;
  register(username: string, password: string): Promise<SessionInfo>;
  me(): Promise<Me>;
  logout(): Promise<void>;

  searchQuestions(filters: Record<string, string | number | undefined>): Promise<{ questions: Question[] }>;
  getQuestion(id: string, version?: string): Promise<Question>;
  findSimilar(id: string, version?: string): Promise<{ questions: Question[]; bankVersion: string }>;
  getGeneratedQuestion(id: string): Promise<Question>;

  createConversation(title: string): Promise<Conversation>;
  listConversations(): Promise<{ conversations: Conversation[] }>;
  getConversation(id: string): Promise<ConversationDetail>;
  sendMessage(id: string, options: MessageOptions, onEvent: (event: AgentEvent) => void): StreamHandle;

  uploadPhoto(conversationId: string, input: { mimeType: string; data: string }): Promise<{ id: string }>;
  fetchPhoto(conversationId: string, photoId: string): Promise<Blob>;
  fetchAsset(questionId: string, index: number, version: string): Promise<Blob>;

  credits(): Promise<{ available: number }>;
  createVideoJob(
    input: { questionId: string; bankVersion: string; requirements?: string },
    idempotencyKey: string,
  ): Promise<{ job: VideoJob }>;
  submitVideoDraft(id:string,retryOf?:string): Promise<{job:VideoJob}>;
  listVideoJobs(): Promise<{ jobs: VideoJob[] }>;
  getVideoJob(id: string): Promise<{ job: VideoJob }>;
  fetchVideo(id: string): Promise<Blob>;
  videoPlayback(id: string): Promise<{url: string; expiresAt: number}>;
}

function query(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

function parseFrame(frame: string): unknown | null {
  const data = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).replace(/^ /, ''))
    .join('\n');
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function createClient(options: { getToken: () => string | null }): TutorClient {
  const getToken = options.getToken;

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    let response: Response;
    try {
      response = await fetch(API_BASE_URL + path, {
        ...init,
        headers: {
          Accept: 'application/json',
          ...(init.body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...((init.headers as Record<string, string>) ?? {}),
        },
      });
    } catch (error) {
      throw new ApiError(/TimeoutError|timed out/i.test(String(error)) ? 'REQUEST_TIMEOUT' : /AbortError/.test(String(error)) ? 'ABORTED' : 'NETWORK_ERROR', 0);
    }
    if (response.status === 204) return undefined as T;
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const code =
        (body as { error?: string } | null)?.error ??
        (response.status === 401 ? 'SESSION_INVALID' : 'INTERNAL_ERROR');
      throw new ApiError(code, response.status);
    }
    if (body === null) throw new ApiError('INVALID_RESPONSE', response.status);
    return body as T;
  }

  async function binary(path: string, expected: RegExp, scoped = false): Promise<Blob> {
    const token = getToken();
    let response: Response;
    try {
      response = await fetch(scoped ? path : API_BASE_URL + path, {
        credentials: scoped ? 'omit' : 'same-origin',
        headers: !scoped && token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      throw new ApiError('MEDIA_DOWNLOAD_FAILED', 0);
    }
    if (!response.ok) {
      let code = 'MEDIA_DOWNLOAD_FAILED';
      try {
        code = ((await response.json()) as { error?: string }).error ?? code;
      } catch {
        /* 保持默认 */
      }
      throw new ApiError(code, response.status);
    }
    const blob = await response.blob();
    if (!expected.test(blob.type || response.headers.get('Content-Type') || '')) {
      throw new ApiError('INVALID_RESPONSE', response.status);
    }
    return blob;
  }

  function streamMessage(path: string, data: MessageOptions, onEvent: (event: AgentEvent) => void): StreamHandle {
    const controller = new AbortController();
    const token = getToken();

    const done = (async () => {
      let response: Response;
      try {
        response = await fetch(API_BASE_URL + path, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(data),
          signal: controller.signal,
        });
      } catch (error) {
        throw new ApiError(/TimeoutError|timed out/i.test(String(error)) ? 'REQUEST_TIMEOUT' : /AbortError/.test(String(error)) ? 'ABORTED' : 'NETWORK_ERROR', 0);
      }

      if (!response.ok) {
        let code = 'INTERNAL_ERROR';
        try {
          code = ((await response.json()) as { error?: string }).error ?? code;
        } catch {
          /* 保持默认 */
        }
        throw new ApiError(code, response.status);
      }
      if (!response.body) throw new ApiError('NETWORK_ERROR', 0);

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let completed = false;
      let agentError: ApiError | null = null;

      const handleFrame = (frame: string) => {
        const event = parseFrame(frame) as AgentEvent | null;
        if (!event || typeof event !== 'object') return;
        if (event.type === 'done') completed = true;
        if (event.type === 'error') agentError = new ApiError(event.error || 'AGENT_FAILED', 0);
        onEvent(event);
      };

      try {
        for (;;) {
          const { value, done: finished } = await reader.read();
          if (finished) break;
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, '\n');
          let index: number;
          while ((index = buffer.indexOf('\n\n')) !== -1) {
            handleFrame(buffer.slice(0, index));
            buffer = buffer.slice(index + 2);
          }
        }
        buffer = (buffer + decoder.decode()).replace(/\r\n/g, '\n');
        if (buffer.trim()) handleFrame(buffer);
      } catch (error) {
        if (/AbortError/.test(String(error))) throw new ApiError('ABORTED', 0);
        if (agentError) throw agentError;
        throw new ApiError('AGENT_STREAM_INTERRUPTED', 0);
      }

      if (agentError) throw agentError;
      if (!completed) throw new ApiError('AGENT_STREAM_INTERRUPTED', 0);
    })();

    return { done, cancel: () => controller.abort() };
  }

  return {
    transcribeSpeech: (audio, signal) => request('/v1/speech/transcribe', {
      method: 'POST', body: audio,
      signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])]),
      headers: { 'Content-Type': 'audio/wav' },
    }),
    loginPassword: async (username, password) => ({...await request<Omit<SessionInfo,'token'>>('/v1/auth/password', {method:'POST',body:JSON.stringify({username,password})}),token:'cookie'}),
    register: async (username, password) => ({...await request<Omit<SessionInfo,'token'>>('/v1/auth/register', {method:'POST',body:JSON.stringify({username,password})}),token:'cookie'}),
    me: () => request<Me>('/v1/me'),
    logout: () => request<void>('/v1/auth/session', { method: 'DELETE' }),

    searchQuestions: (filters) => request(`/v1/questions${query(filters)}`),
    getQuestion: (id, version) => request(`/v1/questions/${encodeURIComponent(id)}${query({ version })}`),
    findSimilar: (id, version) =>
      request(`/v1/questions/${encodeURIComponent(id)}/similar${query({ version })}`),
    getGeneratedQuestion: (id) => request(`/v1/generated-questions/${encodeURIComponent(id)}`),

    createConversation: (title) =>
      request<Conversation>('/v1/conversations', { method: 'POST', body: JSON.stringify({ title }) }),
    listConversations: () => request('/v1/conversations'),
    getConversation: (id) => request(`/v1/conversations/${encodeURIComponent(id)}`),
    sendMessage: (id, options, onEvent) =>
      streamMessage(`/v1/conversations/${encodeURIComponent(id)}/messages`, options, onEvent),

    uploadPhoto: (conversationId, input) =>
      request(`/v1/conversations/${encodeURIComponent(conversationId)}/photos`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    fetchPhoto: (conversationId, photoId) =>
      binary(
        `/v1/conversations/${encodeURIComponent(conversationId)}/photos/${encodeURIComponent(photoId)}`,
        /^image\/(?:png|jpeg)/i,
      ),
    fetchAsset: (questionId, index, version) =>
      binary(
        `/v1/questions/${encodeURIComponent(questionId)}/assets/${index}${query({ version })}`,
        /^image\//i,
      ),

    credits: () => request('/v1/credits'),
    createVideoJob: (input, key) =>
      request('/v1/video-jobs', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'Idempotency-Key': key },
      }),
    submitVideoDraft: (id,retryOf) => request(`/v1/video-drafts/${encodeURIComponent(id)}/submit`, {method:'POST',body:JSON.stringify({confirmed:true,retryOf})}),
    listVideoJobs: () => request('/v1/video-jobs'),
    getVideoJob: (id) => request(`/v1/video-jobs/${encodeURIComponent(id)}`),
    videoPlayback: (id) => request(`/v1/video-jobs/${encodeURIComponent(id)}/playback`, {method: 'POST', signal: AbortSignal.timeout(15000)}),
    fetchVideo: async (id) => {
      const playback = await request<{url: string}>(`/v1/video-jobs/${encodeURIComponent(id)}/playback`, {method: 'POST', signal: AbortSignal.timeout(15000)});
      return binary(playback.url, /^video\/mp4/i, true);
    },
  };
}
