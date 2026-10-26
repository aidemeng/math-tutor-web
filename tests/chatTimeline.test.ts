import { expect, it } from "vitest";
import { chatTimeline } from "../src/lib/chatTimeline";
it("interleaves original reports and later replies without changing conversation turn indexes", () => {
  const rows = chatTimeline(
    [
      { index: 0, startedAt: 10 },
      { index: 1, startedAt: 30, mistakeAnalysisId: "A" },
      { index: 2, startedAt: 40 },
    ],
    [{ id: "A", createdAt: 20 }],
  );
  expect(rows.map((row) => row.key)).toEqual([
    "turn-0",
    "mistake-A",
    "turn-1",
    "turn-2",
  ]);
});
it("keeps subsequent free-text replies after a report even when the client clock is behind", () => {
  const rows = chatTimeline(
    [
      { index: 0, startedAt: 90, mistakeAnalysisId: "A" },
      { index: 1, startedAt: 95 },
      { index: 2, startedAt: 80 },
    ],
    [{ id: "A", createdAt: 100 }],
  );
  expect(rows.map((row) => row.key)).toEqual([
    "mistake-A",
    "turn-0",
    "turn-1",
    "turn-2",
  ]);
});


it('keeps an attached report inside its original reply without a duplicate timeline entry', () => {
  const report={id:'report-A',createdAt:100};
  const rows=chatTimeline([{index:0,startedAt:90,mistakeAnalysis:report}], [report]);
  expect(rows.map(row=>row.key)).toEqual(['turn-0']);
});
