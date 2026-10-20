import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AgentProgress } from "../src/components/AgentProgress";

afterEach(() => vi.useRealTimers());
it("shows elapsed time and a neutral notice for a long silent model call", () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const html = renderToStaticMarkup(
    createElement(AgentProgress, {
      status: "正在分析与整理…",
      startedAt: 10_000,
      lastActivityAt: 20_000,
    }),
  );
  expect(html).toContain("1:30");
  expect(html).toContain("正在分析与整理");
  expect(html).toContain("处理时间较长");
  expect(html).not.toContain("%");
});
it("removes the silent-wait notice when actual output has just arrived", () => {
  vi.useFakeTimers();
  vi.setSystemTime(100_000);
  const html = renderToStaticMarkup(
    createElement(AgentProgress, {
      status: "正在生成回复…",
      startedAt: 10_000,
      lastActivityAt: 99_000,
    }),
  );
  expect(html).toContain("1:30");
  expect(html).not.toContain("处理时间较长");
});
