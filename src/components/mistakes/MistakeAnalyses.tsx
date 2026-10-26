import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { TutorClient } from "../../api/client";
import { chatTimeline } from "../../lib/chatTimeline";
import type { Turn } from "../../api/types";
import type { MistakeAnalysis } from "../../api/types";
import { friendlyError } from "../../api/errors";
import { toast } from "../Toast";
import { Sheet } from "../Sheet";
import { Icon } from "../Icon";
import { Markdown } from "../Markdown";
import { MistakeSource } from "./MistakeSource";
import { MistakeAnalysisDetail } from "./MistakeAnalysisDetail";
import { normalizeMistakeContent } from "../../lib/mistakeContent";
import { MistakeTurn } from "./MistakeTurn";
import "../../styles/mistakes.css";

export function MistakeAnalyses({
  client,
  conversationId,
  refresh = 0,
  initialOpenId = null,
  onRecordsChange,
  onPendingChange,
  onExpand,
  turns = [],
  renderTurn,
}: {
  turns?: Turn[];
  renderTurn?(turn: Turn, index: number): ReactNode;
  client: TutorClient;
  conversationId: string;
  refresh?: number;
  initialOpenId?: string | null;
  onExpand?(analysis: MistakeAnalysis): void;
  onRecordsChange?(hasRecords: boolean): void;
  onPendingChange?(id: string | null): void;
}) {
  const [rows, setRows] = useState<MistakeAnalysis[]>([]),
    [open, setOpen] = useState<string | null>(initialOpenId);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [saving, setSaving] = useState(false),
    [loadFailed, setLoadFailed] = useState(false),
    [retry, setRetry] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    if (initialOpenId) setOpen(initialOpenId);
  }, [initialOpenId]);
  const close = useCallback(() => {
    setOpen(null);
    setSourceOpen(false);
  }, []);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    let current = true,
      timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const { analyses } = await client.listMistakeAnalyses(conversationId);
        if (!current) return;
        setLoadFailed(false);
        onRecordsChange?.(analyses.length > 0);
        onPendingChange?.(
          analyses.find((row) => row.status === "confirmation")?.id ?? null,
        );
        setRows((previous) =>
          analyses.map((row) => {
            const old = previous.find((item) => item.id === row.id);
            return old &&
              old.updatedAt === row.updatedAt &&
              old.status === row.status
              ? old
              : row;
          }),
        );
        if (
          analyses.some(
            (row) => row.status === "recognizing" || row.status === "analyzing",
          )
        )
          timer = setTimeout(load, 2500);
      } catch {
        if (!current) return;
        setLoadFailed(true);
        // A transient list failure must not discard or strand background work.
        timer = setTimeout(load, 6000);
      }
    };
    void load();
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [
    client,
    conversationId,
    refresh,
    retry,
    onRecordsChange,
    onPendingChange,
  ]);
  async function mutate(request: () => Promise<{ analysis: MistakeAnalysis }>) {
    if (saving) return;
    setSaving(true);
    try {
      const { analysis } = await request();
      if (!alive.current) return;
      setRows((previous) =>
        previous.map((row) => (row.id === analysis.id ? analysis : row)),
      );
      setRetry((n) => n + 1);
    } catch (error) {
      if (alive.current) toast(friendlyError(error));
    } finally {
      if (alive.current) setSaving(false);
    }
  }
  const selected = rows.find(
    (row) => row.id === open && row.status === "ready",
  );
  function renderAnalysis(row: MistakeAnalysis) {
    const result = normalizeMistakeContent(row.result);
    const suggested = row.candidates.findIndex(
      (item) => item.complete && item.studentAnswer.trim(),
    );
    if (row.status !== "ready")
      return (
        <MistakeTurn key={row.id} client={client} analysis={row}>
          <div className="mistake-card">
            <p>
              {row.status === "confirmation"
                ? row.clarification ||
                  "你想分析图片中的哪一道题？请告诉我题号或具体位置。"
                : row.status === "failed"
                  ? "这次没能完成分析，图片已保留。"
                  : "正在查看题目与作答，整理错题分析…"}
            </p>
            {row.status === "failed" && (
              <button
                className="btn btn--quiet"
                disabled={saving}
                onClick={() =>
                  void mutate(() => client.retryMistakeAnalysis(row.id))
                }
              >
                重新尝试
              </button>
            )}
          </div>
        </MistakeTurn>
      );
    const label = "查看分析";
    return (
      <MistakeTurn key={row.id} client={client} analysis={row}>
        <button
          type="button"
          className="mistake-card"
          onClick={() => setOpen(row.id)}
        >
          <div className="mistake-card__heading">
            <span>
              <Icon name="chart" size={16} />
              错题分析
            </span>
            <span className="mistake-label">
              {row.status === "ready"
                ? result?.verdict === "incorrect"
                  ? "答案有误"
                  : result?.verdict === "correct"
                    ? "作答正确"
                    : "待核对"
                : label}
            </span>
          </div>
          <strong>
            {result?.topic ||
              row.candidates[
                row.input?.candidateIndex ?? Math.max(0, suggested)
              ]?.label ||
              "识别题目与学生作答"}
          </strong>
          {result && (
            <div className="mistake-card__summary">
              <Markdown
                value={
                  result.hypotheses[0]
                    ? `可能原因：${result.hypotheses[0]}`
                    : result.summary
                }
              />
            </div>
          )}
          <div className="mistake-card__footer">
            <span>
              {result?.hypotheses.length ? "错因待验证" : "核对原图证据"}
            </span>
            <span>
              {label}
              <Icon name="chevron" size={15} />
            </span>
          </div>
        </button>
      </MistakeTurn>
    );
  }
  return (
    <>
      {chatTimeline(
        turns.map((turn, index) => ({
          index,
          startedAt: turn.startedAt,
          mistakeAnalysisId: turn.mistakeAnalysisId,
        })),
        rows,
      ).map((entry) =>
        entry.kind === "turn" ? (
          <Fragment key={entry.key}>
            {renderTurn?.(turns[entry.index], entry.index)}
          </Fragment>
        ) : (
          <div className="mistake-cards" key={entry.key}>
            {renderAnalysis(entry.analysis)}
          </div>
        ),
      )}
      {loadFailed && (
        <button
          type="button"
          className="mistake-text-button"
          onClick={() => setRetry((n) => n + 1)}
        >
          重新加载错题记录
        </button>
      )}
      <Sheet
        open={!!selected}
        title={sourceOpen ? "原题与作答" : "错题分析"}
        onClose={sourceOpen ? () => setSourceOpen(false) : close}
      >
        {selected &&
          (sourceOpen ? (
            <MistakeSource analysis={selected} client={client} />
          ) : (
            <MistakeAnalysisDetail
              key={selected.id}
              analysis={selected}
              onOriginal={() => setSourceOpen(true)}
              busy={saving}
              onExpand={
                onExpand
                  ? () => {
                      setOpen(null);
                      onExpand(selected);
                    }
                  : undefined
              }
              onRetry={() =>
                void mutate(() => client.retryMistakeAnalysis(selected.id))
              }
            />
          ))}
      </Sheet>
    </>
  );
}
