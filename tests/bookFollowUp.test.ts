import { expect, it } from "vitest";
import {
  selectBookQuestion,
  consumeBookExpansion,
} from "../src/lib/bookFollowUp";
import type { BookItem, Question } from "../src/api/types";
const a = { id: "A", bankVersion: "v", stem: "题目A" } as Question;
const b = { id: "B", bankVersion: "v", stem: "题目B" } as Question;
const entry = {
  id: "book-A",
  conversationId: "chat",
  question: a,
  kind: "solve",
} as BookItem;
it("rereading the selected card preserves the follow-up question", () => {
  expect(selectBookQuestion(entry, a)?.question?.id).toBe("A");
});
it("opening a different card replaces the selected question instead of losing all context", () => {
  expect(selectBookQuestion(entry, b)?.question?.id).toBe("B");
  expect(
    selectBookQuestion({ ...entry, analysis: { id: "report" } as any }, b)
      ?.analysis,
  ).toBeUndefined();
});
it("consumes expansion once and preserves the book entry when refreshing the resulting URL", () => {
  const first = consumeBookExpansion(
    new URLSearchParams(
      "bookItem=book-A&mistakeAction=expand&mistakeAnalysisId=report",
    ),
  );
  expect(first.expand).toBe(true);
  expect(first.params.get("bookItem")).toBe("book-A");
  expect(first.params.has("mistakeAction")).toBe(false);
  expect(first.params.has("mistakeAnalysisId")).toBe(false);
  expect(consumeBookExpansion(first.params).expand).toBe(false);
});
