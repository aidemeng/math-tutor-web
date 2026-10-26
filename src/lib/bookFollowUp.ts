import type { BookItem, Question } from "../api/types";

/** Reading another card changes the follow-up target; simply rereading it never clears it. */
export function selectBookQuestion(
  current: BookItem | null,
  question: Question | undefined,
): BookItem | null {
  if (!current || !question) return current;
  return { ...current, question, analysis: undefined };
}

/** Remove the one-shot command before starting a paid model request. */
export function consumeBookExpansion(search: URLSearchParams) {
  const params = new URLSearchParams(search);
  const expand = params.get("mistakeAction") === "expand";
  if (expand) {
    params.delete("mistakeAction");
    params.delete("mistakeAnalysisId");
  }
  return { expand, params };
}
