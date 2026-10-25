import { useCallback, useEffect, useRef, useState } from "react";
import type { TutorClient } from "../../api/client";
import type { MistakeAnalysis, MistakeInput } from "../../api/types";
import { friendlyError } from "../../api/errors";
import { toast } from "../Toast";
import { Sheet } from "../Sheet";
import { Icon } from "../Icon";
import { Markdown } from "../Markdown";
import { MistakeAnalysisDetail } from "./MistakeAnalysisDetail";
import "../../styles/mistakes.css";

export function MistakeAnalyses({
  client,
  conversationId,
  refresh = 0,
  initialOpenId = null,
  onRecordsChange,
}: {
  client: TutorClient;
  conversationId: string;
  refresh?: number;
  initialOpenId?: string | null;
  onRecordsChange?(hasRecords: boolean): void;
}) {
  const [rows, setRows] = useState<MistakeAnalysis[]>([]),
    [open, setOpen] = useState<string | null>(initialOpenId);
  const [saving, setSaving] = useState(false),
    [loadFailed, setLoadFailed] = useState(false),
    [retry, setRetry] = useState(0);
  const alive = useRef(true);
  useEffect(() => {
    if (initialOpenId) setOpen(initialOpenId);
  }, [initialOpenId]);
  const close = useCallback(() => setOpen(null), []);
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
  }, [client, conversationId, refresh, retry, onRecordsChange]);
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
  const selected = rows.find((row) => row.id === open);
  return (
    <>
      {rows.length > 0 && (
        <div className="mistake-cards">
          {rows.map((row) => {
            const result = row.result;
            const suggested = row.candidates.findIndex(
              (item) => item.complete && item.studentAnswer.trim(),
            );
            const label =
              row.status === "recognizing"
                ? "正在识别题目"
                : row.status === "confirmation"
                  ? "确认题目与作答"
                  : row.status === "analyzing"
                    ? "正在分析错题"
                    : row.status === "failed"
                      ? "分析未完成"
                      : "查看分析";
            return (
              <button
                key={row.id}
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
            );
          })}
        </div>
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
      <Sheet open={!!selected} title="错题分析" onClose={close}>
        {selected && (
          <MistakeAnalysisDetail
            key={selected.id}
            analysis={selected}
            client={client}
            busy={saving}
            onConfirm={(input: MistakeInput) =>
              void mutate(() =>
                client.confirmMistakeAnalysis(selected.id, input),
              )
            }
            onRetry={() =>
              void mutate(() => client.retryMistakeAnalysis(selected.id))
            }
          />
        )}
      </Sheet>
    </>
  );
}
