import { expect, it } from "vitest";
import { annotationTarget } from "../src/lib/questionAnnotations";
it("matches whitespace differences without moving a note onto unrelated text", () => {
  expect(annotationTarget(["解：y = x2 + 1。", "其他推导"], "y=x2+1")).toBe(0);
  expect(annotationTarget(["不同的段落"], "不存在的公式")).toBe(-1);
});
it("prefers the smallest matching block and refuses ambiguous matches", () => {
  expect(
    annotationTarget(["前文，配方求最值，后文", "配方求最值"], "配方求最值"),
  ).toBe(1);
  expect(annotationTarget(["配方求最值", "配方求最值"], "配方求最值")).toBe(-1);
});
