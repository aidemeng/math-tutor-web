#!/usr/bin/env node
/**
 * 本地 Mock API —— 只用于前端联调与视觉验收。
 *
 * 真实后端依赖 Cloudflare Workers / D1 / R2 / Agent 容器，本地起全链路成本较高；
 * 这个脚本按 math-tutor-service 的接口契约返回假数据，方便前端独立开发。
 *
 *   node scripts/mock-api.mjs            # 监听 127.0.0.1:8788
 *   VITE_DEV_PROXY_TARGET=http://127.0.0.1:8788 npm run dev
 *
 * 请勿在真实环境使用：它不做任何鉴权与额度控制。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PORT = Number(process.env.MOCK_API_PORT || 8788);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const STEM = `## 题目

已知二次函数 $f(x)=x^{2}-2ax+a+2$，其中 $a\\in\\mathbb{R}$。

1. 若 $f(x)$ 在区间 $[0,2]$ 上的最小值为 $1$，求 $a$ 的值；
2. 讨论 $f(x)$ 在 $[0,2]$ 上的最小值 $g(a)$。

![配图](img/fig1.png)`;

const EXPLANATION = `## 参考解答

配方得

$$f(x)=(x-a)^{2}+a+2-a^{2}$$

对称轴为 $x=a$，需按 $a$ 与区间 $[0,2]$ 的位置关系分类讨论。

### 情形一：$a<0$

此时 $f(x)$ 在 $[0,2]$ 上单调递增，最小值在 $x=0$ 处取得：

$$g(a)=f(0)=a+2$$

### 情形二：$0\\le a\\le 2$

最小值在顶点处取得：$g(a)=a+2-a^{2}$。

### 情形三：$a>2$

$f(x)$ 在 $[0,2]$ 上单调递减，最小值在 $x=2$ 处取得：

$$g(a)=f(2)=6-3a$$

综合上述讨论，

$$g(a)=\\begin{cases}a+2,&a<0\\\\ a+2-a^{2},&0\\le a\\le 2\\\\ 6-3a,&a>2\\end{cases}$$

由第一问 $g(a)=1$，分别代入三段可得 $a=-1$（舍去）、$a=\\dfrac{1+\\sqrt{5}}{2}\\approx1.618$、$a=\\dfrac{5}{3}$。

> 注意：$a=\\dfrac{5}{3}<2$ 与情形二矛盾，最终只保留 $a=\\dfrac{1+\\sqrt{5}}{2}$。`;

const QUESTIONS = [
  {
    id: 'q_1001',
    bankVersion: 'bank_dev_1',
    title: '二次函数在闭区间上的最值',
    paper: '2024 学年高一数学·期中试卷',
    number: 18,
    difficulty: 2,
    points: ['二次函数', '分类讨论'],
    method: ['换元法', '分类讨论'],
    review: 'human',
    stem: STEM,
    explanation: EXPLANATION,
    answer: 'a=\\dfrac{1+\\sqrt{5}}{2}',
    path: 'bank/2024/期中/18.md',
    assets: ['bank/2024/期中/18.md', 'img/fig1.png'],
    body: `## 题目\n\n${STEM}\n\n## 参考解答\n\n${EXPLANATION}`,
  },
  {
    id: 'q_1002',
    bankVersion: 'bank_dev_1',
    title: '含参数的二次函数最值',
    paper: '2024 学年高一数学·月考试卷',
    number: 21,
    difficulty: 3,
    points: ['二次函数', '含参讨论'],
    method: ['分类讨论'],
    review: 'auto',
    stem: '## 题目\n\n设函数 $f(x)=x^{2}-2x+a$，求 $f(x)$ 在 $[t,t+1]$ 上的最小值 $h(t)$，并画出 $y=h(t)$ 的图象。',
    explanation:
      '## 参考解答\n\n对称轴 $x=1$。按 $t+1\\le 1$、$t\\le 1<t+1$、$t>1$ 三段讨论：\n\n$$h(t)=\\begin{cases}t^{2}+a-1,&t>1\\\\ a-1,&0\\le t\\le 1\\\\ t^{2}+2t+a,&t<0\\end{cases}$$',
    answer: 'h(t) 见解析',
    path: 'bank/2024/月考/21.md',
    assets: ['bank/2024/月考/21.md'],
    body: '',
  },
];

const state = {
  tokens: new Map(),
  conversations: new Map(),
  jobs: new Map(),
  photos: new Map(),
  keys: new Map(),
};

function seed() {
  const id = 'conv_demo_0001';
  const now = Date.now();
  state.conversations.set(id, {
    id,
    title: '找一道二次函数最值题',
    createdAt: now - 3 * 3600_000,
    updatedAt: now - 2 * 3600_000,
    context: { currentQuestion: { id: QUESTIONS[0].id, bankVersion: QUESTIONS[0].bankVersion } },
    messages: [
      { id: randomUUID(), role: 'user', content: '找一道二次函数最值题', created_at: now - 3 * 3600_000 },
      {
        id: randomUUID(),
        role: 'assistant',
        content: [
          JSON.stringify({ type: 'status', text: '正在检索题库…' }),
          JSON.stringify({ type: 'text', text: '在题库里找到一道**二次函数在闭区间上的最值**，含参分类讨论，适合作为例题。' }),
          JSON.stringify({ type: 'question', question: QUESTIONS[0] }),
          JSON.stringify({ type: 'text_reset', text: '题目已找到，解析和后续操作见题卡。' }),
          JSON.stringify({ type: 'done' }),
        ].join('\n'),
        created_at: now - 2 * 3600_000,
      },
    ],
  });

  const jobId = 'job_demo_0001';
  state.jobs.set(jobId, {
    id: jobId,
    status: 'ready',
    createdAt: now - 5 * 3600_000,
    snapshot: JSON.stringify({ question: QUESTIONS[0], requirements: '' }),
  });
  state.jobs.set('job_demo_0002', {
    id: 'job_demo_0002',
    status: 'running',
    createdAt: now - 60_000,
    snapshot: JSON.stringify({ question: QUESTIONS[1], requirements: '多用几何直观' }),
  });
}
seed();

const json = (res, body, status = 200) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(payload);
};

const fail = (res, status, error) => json(res, { error }, status);

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

const conversationView = (conversation) => ({
  id: conversation.id,
  title: conversation.title,
  createdAt: conversation.createdAt,
  updatedAt: conversation.updatedAt,
});

async function serveAsset(res) {
  const file = await readFile(join(ROOT, 'public/icons/icon-512.png'));
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(file);
}

function streamReply(res, text, photoId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store, no-transform',
    'X-Accel-Buffering': 'no',
    Connection: 'keep-alive',
  });
  const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  let closed = false;
  res.on('close', () => {
    closed = true;
  });

  const lines = [
    { delay: 120, event: { type: 'status', text: '正在理解这道题…' } },
    { delay: 420, event: { type: 'status', text: '正在检索题库…' } },
    { delay: 360, event: { type: 'text', text: photoId ? '已识别照片中的题目，' : '' } },
    { delay: 260, event: { type: 'text', text: '在题库里找到一道匹配的**含参二次函数最值**问题，来源为 2024 学年高一期中试卷第 18 题。' } },
    { delay: 320, event: { type: 'text', text: '\n\n这道题的关键是对对称轴 $x=a$ 与区间 $[0,2]$ 的位置关系分类讨论。' } },
    { delay: 180, event: { type: 'question', question: QUESTIONS[0] } },
    { delay: 160, event: { type: 'text_reset', text: '题目已找到，解析和后续操作见题卡。' } },
    { delay: 120, event: { type: 'done' } },
  ];

  let index = 0;
  const tick = () => {
    if (closed) return;
    const item = lines[index++];
    if (!item) {
      res.end();
      return;
    }
    send(item.event);
    setTimeout(tick, item.delay);
  };
  setTimeout(tick, 160);
  return text;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/\/$/, '') || '/';
  const method = req.method || 'GET';

  if (path === '/health') return json(res, { ok: true, mock: true });

  if (path === '/v1/auth/dev' && method === 'POST') {
    const body = await readBody(req);
    const token = `mock.${randomUUID()}`;
    const user = { id: 'user_demo', name: body.name || '数学老师', role: 'teacher' };
    state.tokens.set(token, user);
    return json(res, { token, expiresAt: Date.now() + 7 * 86_400_000, user });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const user = state.tokens.get(token);
  if (path.startsWith('/v1/') && !user) return fail(res, 401, 'SESSION_INVALID');

  if (path === '/v1/auth/session' && method === 'DELETE') {
    state.tokens.delete(token);
    res.writeHead(204);
    return res.end();
  }
  if (path === '/v1/me') return json(res, user);
  if (path === '/v1/credits') return json(res, { available: 6 });

  if (path === '/v1/conversations' && method === 'GET') {
    const list = [...state.conversations.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(conversationView);
    return json(res, { conversations: list });
  }
  if (path === '/v1/conversations' && method === 'POST') {
    const body = await readBody(req);
    const id = `conv_${randomUUID().slice(0, 8)}`;
    const conversation = {
      id,
      title: body.title || '新的备课',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      context: { currentQuestion: null },
      messages: [],
    };
    state.conversations.set(id, conversation);
    return json(res, conversationView(conversation), 201);
  }

  let match = /^\/v1\/conversations\/([^/]+)$/.exec(path);
  if (match && method === 'GET') {
    const conversation = state.conversations.get(match[1]);
    if (!conversation) return fail(res, 404, 'CONVERSATION_NOT_FOUND');
    return json(res, { ...conversationView(conversation), context: conversation.context, messages: conversation.messages });
  }

  match = /^\/v1\/conversations\/([^/]+)\/messages$/.exec(path);
  if (match && method === 'POST') {
    const conversation = state.conversations.get(match[1]);
    if (!conversation) return fail(res, 404, 'CONVERSATION_NOT_FOUND');
    const body = await readBody(req);
    conversation.messages.push({
      id: randomUUID(),
      role: 'user',
      content: body.photoId
        ? JSON.stringify({ type: 'teacher_input', text: body.text, photoId: body.photoId })
        : body.text,
      created_at: Date.now(),
    });
    conversation.updatedAt = Date.now();
    conversation.context = { currentQuestion: { id: QUESTIONS[0].id, bankVersion: QUESTIONS[0].bankVersion } };
    return streamReply(res, body.text, body.photoId);
  }

  match = /^\/v1\/conversations\/([^/]+)\/photos$/.exec(path);
  if (match && method === 'POST') {
    const body = await readBody(req);
    const id = randomUUID();
    state.photos.set(id, body);
    return json(res, { id, mimeType: body.mimeType, bytes: 1024 }, 201);
  }

  match = /^\/v1\/conversations\/([^/]+)\/photos\/([^/]+)$/.exec(path);
  if (match) return serveAsset(res);

  if (path === '/v1/questions' && method === 'GET') return json(res, { questions: QUESTIONS });
  match = /^\/v1\/questions\/([^/]+)\/similar$/.exec(path);
  if (match) return json(res, { bankVersion: 'bank_dev_1', questions: [QUESTIONS[1], QUESTIONS[0]] });
  match = /^\/v1\/questions\/([^/]+)\/assets\/(\d+)$/.exec(path);
  if (match) return serveAsset(res);
  match = /^\/v1\/questions\/([^/]+)$/.exec(path);
  if (match) {
    const question = QUESTIONS.find((item) => item.id === match[1]) ?? QUESTIONS[0];
    return json(res, question);
  }

  if (path === '/v1/video-jobs' && method === 'GET') {
    return json(res, { jobs: [...state.jobs.values()].sort((a, b) => b.createdAt - a.createdAt) });
  }
  if (path === '/v1/video-jobs' && method === 'POST') {
    const body = await readBody(req);
    const key = req.headers['idempotency-key'] || randomUUID();
    const existing = state.keys.get(key);
    if (existing) {
      const job = state.jobs.get(existing);
      if (job) return json(res, { job });
    }
    const question = QUESTIONS.find((item) => item.id === body.questionId) ?? QUESTIONS[0];
    const job = {
      id: `job_${randomUUID().slice(0, 8)}`,
      status: 'queued',
      createdAt: Date.now(),
      snapshot: JSON.stringify({ question, requirements: body.requirements || '' }),
    };
    state.jobs.set(job.id, job);
    state.keys.set(key, job.id);
    setTimeout(() => {
      job.status = 'running';
    }, 4000);
    setTimeout(() => {
      job.status = 'ready';
    }, 12000);
    return json(res, { job }, 201);
  }
  match = /^\/v1\/video-jobs\/([^/]+)\/video$/.exec(path);
  if (match) return fail(res, 409, 'VIDEO_NOT_READY');
  match = /^\/v1\/video-jobs\/([^/]+)$/.exec(path);
  if (match) {
    const job = state.jobs.get(match[1]);
    if (!job) return fail(res, 404, 'VIDEO_NOT_FOUND');
    return json(res, { job });
  }

  return fail(res, 404, 'NOT_FOUND');
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[mock-api] http://127.0.0.1:${PORT}`);
  console.log('[mock-api] 用法：VITE_DEV_PROXY_TARGET=http://127.0.0.1:' + PORT + ' npm run dev');
});
