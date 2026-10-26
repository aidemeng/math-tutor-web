import type { MistakeAnalysis } from "../../api/types";
import { normalizeMistakeContent } from "../../lib/mistakeContent";
import { Icon } from "../Icon";
import { Markdown } from "../Markdown";

export function MistakeAnalysisDetail({
  analysis,
  busy,
  onExpand,
  onOriginal,
}: {
  analysis: MistakeAnalysis;
  busy: boolean;
  onExpand?(): void;
  onOriginal?(): void;
}) {
  const result = normalizeMistakeContent(analysis.result);
  if (!result) return null;
  return (
    <div className="mistake-report-view">
      {result.verdict !== "incorrect" && (
        <span className={`report-verdict report-verdict--${result.verdict}`}>
          {result.verdict === "correct" ? "作答正确" : "信息待补充"}
        </span>
      )}
      <h2 className="report-topic">{result.topic}</h2>
      <div className="answer-comparison">
        <div className="answer-cell answer-cell--correct">
          <span className="answer-label">
            {result.verdict === "uncertain" ? "目前能确定的" : "正确答案"}
          </span>
          <Markdown value={result.correctAnswer} />
        </div>
      </div>
      <section className="report-section report-causes">
        <h3>
          {result.verdict === "correct"
            ? "这次做对了什么"
            : result.verdict === "incorrect"
              ? "错误原因"
              : "判断依据"}
        </h3>
        <Markdown value={result.summary} />
      </section>
      {!!result.solutionSteps?.length && (
        <section className="report-section">
          <h3>正确思路</h3>
          {result.solutionSteps.map((step, i) => (
            <div className="solution-step" key={i}>
              <span className="step-number">{i + 1}</span>
              <div className="step-copy">
                <h4>{step.title}</h4>
                <Markdown value={step.explanation} />
              </div>
            </div>
          ))}
        </section>
      )}
      <div className="report-links">
        <button className="report-source-button" onClick={onOriginal}>
          <span className="source-button-body">
            <span>查看原题与作答</span>
            <Icon name="chevron" size={14} aria-hidden="true" />
          </span>
        </button>
        {onExpand && (
          <button
            className="report-expand-button"
            disabled={busy}
            onClick={onExpand}
          >
            查看完整解析与推导
          </button>
        )}
      </div>
    </div>
  );
}
