import { useMemo } from "react";
import { questionView } from "../lib/questionView";
import { useApp, useStoreRevision } from "../store/AppContext";
import { QuestionDiagrams } from "./QuestionDiagram";
import { Markdown } from "./Markdown";
import "../styles/card.css";

export type DeriveKind = "similar" | "variant" | "easy";

interface QuestionCardProps {
  questionKey: string;
  onDerive(kind: DeriveKind, key: string): void;
  disabled?: boolean;
}

const DERIVE_ACTIONS: { kind: DeriveKind; label: string }[] = [
  { kind: "similar", label: "找相似" },
  { kind: "variant", label: "出变式" },
  { kind: "easy", label: "降难度" },
];

export function QuestionCard({
  questionKey,
  onDerive,
  disabled,
}: QuestionCardProps) {
  const { store } = useApp();
  useStoreRevision();

  const raw = store?.question(questionKey);
  const question = useMemo(() => {
    if (!raw) return null;
    try {
      return questionView(raw);
    } catch {
      return null;
    }
  }, [raw]);

  if (!question) {
    return (
      <article className="qcard qcard--loading">
        <div className="skeleton" style={{ height: 18, width: "42%" }} />
        <div
          className="skeleton"
          style={{ height: 14, width: "76%", marginTop: 12 }}
        />
        <div
          className="skeleton"
          style={{ height: 14, width: "90%", marginTop: 8 }}
        />
        <div className="skeleton" style={{ height: 40, marginTop: 18 }} />
      </article>
    );
  }

  const heading = (
    <>
      <header className="qcard__head">
        <span className="pill pill--plain qcard__source">
          {question.source}
        </span>
        {question.review === "human" ? (
          <span className="pill pill--plain">已复核</span>
        ) : null}
      </header>

      <h3 className="qcard__title">{question.title}</h3>

      <div className="qcard__tags">
        <span className="pill pill--plain">{question.kind}</span>
        {question.level ? (
          <span className="pill pill--plain">{question.level}</span>
        ) : null}
      </div>
    </>
  );
  const content = (
    <>
      <div className="qcard__stem">
        <Markdown value={question.stem} questionKey={questionKey} />
      </div>

      <QuestionDiagrams diagrams={raw?.diagrams} />

      <div className="qcard__derive" role="group" aria-label="派生新题">
        {DERIVE_ACTIONS.map((action) => (
          <button
            key={action.kind}
            type="button"
            className="qcard__derive-btn"
            onClick={() => onDerive(action.kind, questionKey)}
            disabled={disabled}
          >
            {action.label}
          </button>
        ))}
      </div>
    </>
  );
  return (
    <article className="qcard">
      {heading}
      {content}
    </article>
  );
}
