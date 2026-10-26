/** 后端契约类型 —— 与 math-tutor-service 的 API 返回保持一致。 */

import type { Diagram } from "../lib/questionDiagram";
export interface Question {
  variation?: {
    direction: string;
    invariant: string;
    change: string;
    goal: string;
  };
  diagrams?: Diagram[];
  id: string;
  bankVersion: string;
  title?: string;
  summary?: string;
  stem?: string;
  body?: string;
  explanation?: string;
  answer?: string;
  paper?: string;
  number?: string | number;
  difficulty?: number;
  points?: string[];
  method?: string[];
  source?: string;
  kind?: string;
  review?: string;
  path?: string;
  assets?: string[];
  [key: string]: unknown;
}

/** 题卡渲染用的视图模型（对应小程序 questionView）。 */
export interface QuestionView {
  key: string;
  id: string;
  bankVersion: string;
  title: string;
  source: string;
  kind: string;
  level: string;
  stem: string;
  explanation: string;
  answer: string;
  benefit: string;
  variationNote?: string;
  review?: string;
  raw: Question;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
}

export interface ConversationDetail extends Conversation {
  context?: {
    currentQuestion?: { id: string; bankVersion: string } | null;
  } | null;
  messages: Message[];
}

export type JobStatus = "queued" | "running" | "ready" | "failed";

export interface VideoJob {
  id: string;
  status: JobStatus;
  snapshot: string;
  createdAt: number;
}

export interface SessionInfo {
  token: string;
  expiresAt: number;
  user: { id: string; name: string; role: string };
}

export interface Me {
  id: string;
  name: string;
  role: string;
}

/** SSE 事件协议。 */
export type AgentEvent =
  | { type: "text"; text: string }
  | { type: "status"; text: string; phase?: string }
  | { type: "text_reset"; text: string }
  | { type: "question"; question: Question }
  | { type: "mistake_analysis"; analysis: MistakeAnalysis }
  | { type: "video_draft"; draft: VideoDraft }
  | { type: "video_job"; job: VideoJob }
  | { type: "error"; error: string }
  | { type: "done" };

/** 一轮对话（本地组装，用于渲染）。 */
export interface Turn {
  mistakeAnalysis?: MistakeAnalysis;
  requestText?: string;
  mistakeAnalysisId?: string;
  selectedQuestion?: { id: string; bankVersion: string };
  videoDraft?: VideoDraft;
  prompt: string;
  photoId?: string;
  photo?: string;
  reply: string;
  status?: string;
  startedAt?: number;
  lastActivityAt?: number;
  questions: Question[];
  error: string | null;
}

export interface VideoDraft {
  id: string;
  mode: "question" | "method";
  title: string;
  requirements: string;
  script: string;
  examples: { purpose: string; question: Question }[];
  createdAt: number;
}

export interface QuestionAnnotation {
  section: "question" | "analysis";
  quote: string;
  title: string;
  explanation: string;
}
export interface GuideContent {
  annotations: QuestionAnnotation[];
}
export interface TeachingGuide {
  id: string;
  questionId: string;
  bankVersion: string;
  studentContext: string;
  status: "generating" | "ready" | "failed";
  content: GuideContent | null;
  updatedAt: number;
}

export interface MistakeRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface MistakeInput {
  stem: string;
  studentAnswer: string;
  region: MistakeRegion;
}
export interface MistakeResult {
  topic: string;
  verdict: "incorrect" | "correct" | "uncertain";
  summary: string;
  correctAnswer: string;
  solutionSteps?: { title: string; explanation: string }[];
}
export interface MistakeAnalysis {
  id: string;
  conversationId: string;
  photoId: string;
  request: string;
  status: "ready";
  input: MistakeInput | null;
  result: MistakeResult | null;
  createdAt: number;
  updatedAt: number;
}

export type BookKind = "find" | "solve" | "generate" | "mistake";
export interface BookItem {
  id: string;
  conversationId: string;
  turnId: string;
  kind: BookKind;
  title: string;
  stem: string;
  createdAt: number;
  question?: Question;
  analysis?: MistakeAnalysis;
}
