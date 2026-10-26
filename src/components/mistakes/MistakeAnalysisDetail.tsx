import type { MistakeAnalysis } from "../../api/types";
import { normalizeMistakeContent } from "../../lib/mistakeContent";
import { Icon } from "../Icon";
import { Markdown } from "../Markdown";

export function MistakeAnalysisDetail({
  analysis,
  busy,
  onRetry,
  onExpand,
  onOriginal,
}: {
  analysis: MistakeAnalysis;
  busy: boolean;
  onRetry(): void;
  onExpand?(): void;
  onOriginal?(): void;
}) {
  const result = normalizeMistakeContent(analysis.result);
  if (analysis.status === "failed")
    return (
      <div className="mistake-wait">
        <p>本次分析未完成，图片和补充信息已保留。</p>
        <button className="btn btn--quiet" disabled={busy} onClick={onRetry}>
          重新尝试
        </button>
      </div>
    );
  if (!result)
    return (
      <p className="mistake-wait" role="status">
        正在核算答案，整理错因依据…
      </p>
    );
  const causes = result.hypotheses.length
    ? result.hypotheses
    : result.facts.slice(0, 2);
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
        {causes.map((cause, i) => (
          <Markdown key={i} value={cause} />
        ))}
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
