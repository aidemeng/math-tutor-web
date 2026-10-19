import { describe, expect, it } from "vitest";
import {
  derivePrompt,
  displayPrompt,
  questionView,
} from "../src/lib/questionView";

const question = {
  id: "gen_example",
  bankVersion: "v1",
  kind: "variant",
  stem: "题干",
};
describe("variant presentation and request", () => {
  it("keeps historical cards readable and shows a new variant rationale", () => {
    expect(questionView(question).variationNote).toBeUndefined();
    const variation = {
      direction: "逆向设问",
      invariant: "函数最值",
      change: "从求最值改为反求区间。",
      goal: "训练逆向判断。",
    };
    expect(questionView({ ...question, variation }).variationNote).toBe(
      "从求最值改为反求区间。 训练逆向判断。",
    );
    expect(
      questionView({ ...question, kind: "easier", variation }).variationNote,
    ).toBe("从求最值改为反求区间。 训练逆向判断。");
    expect(
      questionView({ ...question, kind: "easier" }).variationNote,
    ).toBeUndefined();
  });
  it("sends useful generation instructions without exposing them in the chat label", () => {
    const prompt = derivePrompt(question, "variant");
    expect(prompt).toContain("不要只换数值");
    expect(displayPrompt(prompt)).toBe("给这道题出一道变式");
    expect(derivePrompt(question, "easy")).toContain("保留原题核心方法");
    expect(displayPrompt(derivePrompt(question, "easy"))).toBe(
      "把这道题的难度降低一点",
    );
    expect(displayPrompt(derivePrompt(question, "similar"))).toBe(
      "找一道相似真题",
    );
    expect(displayPrompt("这道题还能怎么改？")).toBe("这道题还能怎么改？");
  });
});

it('distinguishes solutions, variants and easier questions', () => {
  expect(questionView({ ...question, kind: 'solution', source: '教师提供 · AI 解析' }).kind).toBe('AI 解析');
  expect(questionView({ ...question, kind: 'variant' }).kind).toBe('AI 变式');
  expect(questionView({ ...question, kind: 'easier' }).kind).toBe('AI 降难度');
  expect(questionView({ ...question, kind: undefined }).kind).toBe('AI 生成');
});
