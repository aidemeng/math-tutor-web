import { expect, it } from "vitest";
import { quotedQuestionMessage } from "../src/lib/questionQuote";

it("keeps the source, selected math and the teacher's follow-up in distinct parts", () => {
  expect(quotedQuestionMessage({questionId:"q1", bankVersion:"v1", source:"甘肃 2025 · 第9题",
    section:"analysis", text:"先配方\n$y=-(x-1)^2+1$"}, "为什么要配方？"))
    .toBe("引用解析（甘肃 2025 · 第9题）：\n> 先配方\n> $y=-(x-1)^2+1$\n\n为什么要配方？");
});
