import type { Question, QuestionView } from "../api/types";

function section(body: string, name: string): string {
  const match = body.match(
    new RegExp(`(?:^|\\n)## ${name}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`),
  );
  return match ? match[1].trim() : "";
}

const LEVELS: Record<number, string> = { 1: "基础", 2: "中等", 3: "进阶" };

/** 把题库原始题目映射为卡片所需的展示字段。 */
export function questionView(question: Question): QuestionView {
  if (
    !question ||
    typeof question.id !== "string" ||
    typeof question.bankVersion !== "string"
  ) {
    throw new Error("INVALID_QUESTION");
  }
  const generated = question.id.startsWith("gen_");
  const body = question.body ?? "";
  const stem = question.stem || section(body, "题目") || body || "";
  const explanation =
    question.explanation || section(body, "参考解答") || question.answer || "";
  const method = question.method ?? [];
  const points = question.points ?? [];

  return {
    key: `${question.id}@${question.bankVersion}`,
    id: question.id,
    bankVersion: question.bankVersion,
    title:
      question.title ||
      points.slice(0, 2).join(" · ") ||
      question.summary ||
      "数学题",
    source: generated
      ? question.source || "AI 生成"
      : [question.paper, question.number ? `第 ${question.number} 题` : ""]
          .filter(Boolean)
          .join(" · ") || question.id,
    kind: generated
      ? question.kind === "easier"
        ? "AI 降难度"
        : "AI 变式"
      : "真题",
    level: LEVELS[question.difficulty ?? 0] ?? "",
    stem,
    explanation,
    answer: question.answer || explanation,
    benefit: method.join(" · "),
    variationNote:
      ["variant", "easier"].includes(question.kind ?? "") && question.variation
        ? [question.variation.change, question.variation.goal]
            .filter(Boolean)
            .join(" ")
        : undefined,
    review: question.review,
    raw: question,
  };
}

const VARIANT_GUIDANCE =
  " 请围绕原题的数学核心设计有教学价值的变化，改变条件、结论或提问方式；不要只换数值。说明变在哪里和训练目的，独立求解检查后保存。";

const EASIER_GUIDANCE =
  " 请保留原题核心方法，针对实际难点降低一个层级，可补充中间条件、拆分目标或减少分类讨论；不要只把数字改小，也不要直接给出最终答案。简短说明降低了哪一步门槛，完整题干与解析放进题卡，不叙述生成过程。";

const DERIVE_PROMPTS: Record<string, string> = {
  similar: "找相似真题",
  variant: "生成一道变式题",
  easy: "降低难度，生成更基础的题",
};

const DERIVE_LABELS: Record<string, string> = {
  找相似真题: "找一道相似真题",
  生成一道变式题: "给这道题出一道变式",
  "降低难度，生成更基础的题": "把这道题的难度降低一点",
};

/** 把服务端约定格式的长提示词还原成老师看到的自然语言。 */
export function displayPrompt(text: string): string {
  const guidance = [VARIANT_GUIDANCE, EASIER_GUIDANCE].find((suffix) =>
    text.endsWith(suffix),
  );
  const display = guidance ? text.slice(0, -guidance.length) : text;
  const match = String(display).match(
    /^请针对题目 .+（题库版本 [^)）]+）(找相似真题|生成一道变式题|降低难度，生成更基础的题)，保留完整题干并给出解析。$/,
  );
  return match ? (DERIVE_LABELS[match[1]] ?? text) : text;
}

/** 生成派生题请求的服务端提示词。 */
export function derivePrompt(
  question: Question,
  kind: keyof typeof DERIVE_PROMPTS,
): string {
  return (
    `请针对题目 ${question.id}（题库版本 ${question.bankVersion}）${DERIVE_PROMPTS[kind]}，保留完整题干并给出解析。` +
    (kind === "variant"
      ? VARIANT_GUIDANCE
      : kind === "easy"
        ? EASIER_GUIDANCE
        : "")
  );
}

export const JOB_STATUS_TEXT: Record<string, string> = {
  queued: "排队中",
  running: "制作中",
  ready: "已生成",
  failed: "制作失败",
};

export function statusText(status: string): string {
  return JOB_STATUS_TEXT[status] ?? "状态待更新";
}
