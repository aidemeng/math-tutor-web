import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { QuestionView } from "../api/types";
import { useApp } from "../store/AppContext";
import { Sheet } from "./Sheet";
import { QuestionCard, type DeriveKind } from "./QuestionCard";
import { QuestionAnnotations } from "./QuestionAnnotations";
import { QuestionDiagrams } from "./QuestionDiagram";
import { Markdown } from "./Markdown";
import "../styles/question-reader.css";

type ReaderTab = "question" | "analysis";
export function QuestionReader({
  detail,
  readerTab,
  setReaderTab,
  onClose,
  onDerive,
  onQuote,
  busy,
  footer,
}: {
  detail: QuestionView | null;
  readerTab: ReaderTab;
  setReaderTab(tab: ReaderTab): void;
  onClose(): void;
  onDerive?: (kind: DeriveKind, key: string) => void;
  onQuote?: (text: string) => void;
  busy?: boolean;
  footer?: ReactNode;
}) {
  const { client } = useApp();
  const detailKey = detail?.key || null;
  const [annotationActions, setAnnotationActions] =
    useState<HTMLDivElement | null>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const readerPositions = useRef<Record<string, number>>({});
  useLayoutEffect(() => {
    const scroller = readerRef.current?.parentElement;
    const key = `${detailKey}:${readerTab}`;
    scroller?.scrollTo({ top: readerPositions.current[key] ?? 0 });
    return () => {
      if (scroller) readerPositions.current[key] = scroller.scrollTop;
    };
  }, [detailKey, readerTab]);
  const content = (
    <>
      {detailKey && readerTab === "question" ? (
        <QuestionCard
          questionKey={detailKey}
          disabled={busy}
          onDerive={onDerive}
        />
      ) : detail ? (
        <div className="question-reader__analysis">
          <div className="sheet__meta">
            <span className="pill pill--plain">{detail.source}</span>
          </div>
          <h3 className="sheet__heading">{detail.title}</h3>
          <QuestionDiagrams diagrams={detail.raw.diagrams} section="analysis" />
          <Markdown
            value={detail.explanation || detail.answer || "暂无解析"}
            questionKey={detailKey ?? undefined}
          />
        </div>
      ) : null}
    </>
  );
  return (
    <Sheet
      open={!!detail}
      title="题目与解析"
      onClose={onClose}
      navigation={
        <div className="question-reader__navigation">
          <div
            className="question-reader__tabs"
            role="tablist"
            aria-label="题目阅读内容"
          >
            {(["question", "analysis"] as const).map((tab, index) => (
              <button
                key={tab}
                type="button"
                role="tab"
                id={`reader-tab-${tab}`}
                aria-selected={readerTab === tab}
                aria-controls={`reader-panel-${tab}`}
                tabIndex={readerTab === tab ? 0 : -1}
                onClick={() => setReaderTab(tab)}
                onKeyDown={(event) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  ) {
                    event.preventDefault();
                    const tabs = ["question", "analysis"] as const;
                    const next =
                      tabs[
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 1
                            : (index + 1) % 2
                      ];
                    setReaderTab(next);
                    document.getElementById(`reader-tab-${next}`)?.focus();
                  }
                }}
              >
                {tab === "question" ? "题目" : "解析"}
              </button>
            ))}
          </div>
          <div
            className="question-reader__actions"
            ref={setAnnotationActions}
          />
        </div>
      }
      footer={footer}
    >
      <div ref={readerRef} className="question-reader">
        <div
          role="tabpanel"
          id={`reader-panel-${readerTab}`}
          aria-labelledby={`reader-tab-${readerTab}`}
        >
          {detail &&
            (onQuote ? (
              <QuestionAnnotations
                key={detail.key}
                question={detail}
                section={readerTab}
                client={client}
                actionsTarget={annotationActions}
                onQuote={onQuote}
              >
                {content}
              </QuestionAnnotations>
            ) : (
              content
            ))}
        </div>
      </div>
    </Sheet>
  );
}
