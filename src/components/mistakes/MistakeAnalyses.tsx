import { Fragment, type ReactNode, useEffect, useState } from "react";
import type { TutorClient } from "../../api/client";
import type { Turn, MistakeAnalysis } from "../../api/types";
import { chatTimeline } from "../../lib/chatTimeline";
import { Sheet } from "../Sheet";
import { Icon } from "../Icon";
import { Markdown } from "../Markdown";
import { MistakeSource } from "./MistakeSource";
import { MistakeAnalysisDetail } from "./MistakeAnalysisDetail";
import { MistakeTurn } from "./MistakeTurn";
import "../../styles/mistakes.css";

export function MistakeAnalyses({
  client,
  conversationId,
  initialOpenId = null,
  onRecordsChange,
  onExpand,
  turns = [],
  renderTurn,
  busy = false,
}: {
  busy?: boolean;
  turns?: Turn[];
  renderTurn?(turn: Turn, index: number, reportCard?: ReactNode): ReactNode;
  client: TutorClient;
  conversationId: string;
  initialOpenId?: string | null;
  onExpand?(analysis: MistakeAnalysis): void;
  onRecordsChange?(hasRecords: boolean): void;
}) {
  const [saved, setSaved] = useState<MistakeAnalysis[]>([]);
  const [open, setOpen] = useState<string | null>(initialOpenId);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (initialOpenId) setOpen(initialOpenId);
  }, [initialOpenId]);
  useEffect(() => {
    let current = true;
    void client
      .listMistakeAnalyses(conversationId)
      .then(({ analyses }) => {
        if (current) {
          setSaved(analyses);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (current) setLoadFailed(true);
      });
    return () => {
      current = false;
    };
  }, [client, conversationId, revision]);
  const reports = [
    ...new Map(
      [
        ...saved,
        ...turns.flatMap((turn) =>
          turn.mistakeAnalysis ? [turn.mistakeAnalysis] : [],
        ),
      ].map((report) => [report.id, report]),
    ).values(),
  ];
  const hasRecords = reports.length > 0;
  useEffect(() => {
    onRecordsChange?.(hasRecords);
  }, [hasRecords, onRecordsChange]);
  const selected = reports.find((row) => row.id === open);
  function card(row: MistakeAnalysis) {
    return (
      <button
        type="button"
        className="mistake-card"
        onClick={() => {
          setSourceOpen(false);
          setOpen(row.id);
        }}
      >
        <div className="mistake-card__heading">
          <span>
            <Icon name="chart" size={16} />
            错题分析
          </span>
        </div>
        <strong>{row.result?.topic}</strong>
        <div className="mistake-card__summary">
          <Markdown value={row.result?.summary || ""} />
        </div>
        <div className="mistake-card__footer">
          <span>
            查看分析
            <Icon name="chevron" size={15} />
          </span>
        </div>
      </button>
    );
  }
  return (
    <>
      {chatTimeline(
        turns.map((turn, index) => ({
          index,
          startedAt: turn.startedAt,
          mistakeAnalysisId: turn.mistakeAnalysisId,
          mistakeAnalysis: turn.mistakeAnalysis,
        })),
        reports,
      ).map((entry) =>
        entry.kind === "turn" ? (
          <Fragment key={entry.key}>
            {renderTurn?.(
              turns[entry.index],
              entry.index,
              turns[entry.index].mistakeAnalysis
                ? card(turns[entry.index].mistakeAnalysis!)
                : undefined,
            )}
          </Fragment>
        ) : (
          <MistakeTurn
            key={entry.key}
            client={client}
            analysis={entry.analysis}
          >
            {card(entry.analysis)}
          </MistakeTurn>
        ),
      )}
      {loadFailed && (
        <button
          type="button"
          className="mistake-text-button"
          onClick={() => setRevision((n) => n + 1)}
        >
          重新加载错题记录
        </button>
      )}
      <Sheet
        open={!!selected}
        title={sourceOpen ? "原题与作答" : "错题分析"}
        onClose={() => (sourceOpen ? setSourceOpen(false) : setOpen(null))}
      >
        {selected &&
          (sourceOpen ? (
            <MistakeSource analysis={selected} client={client} />
          ) : (
            <MistakeAnalysisDetail
              analysis={selected}
              busy={busy}
              onOriginal={() => setSourceOpen(true)}
              onExpand={
                onExpand
                  ? () => {
                      setOpen(null);
                      onExpand(selected);
                    }
                  : undefined
              }
            />
          ))}
      </Sheet>
    </>
  );
}
