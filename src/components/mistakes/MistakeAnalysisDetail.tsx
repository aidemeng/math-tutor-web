import { useEffect, useState } from "react";
import type { TutorClient } from "../../api/client";
import type { MistakeAnalysis } from "../../api/types";
import { Markdown } from "../Markdown";
import { PhotoViewer } from "../PhotoViewer";
import { MistakeImage } from "./MistakeImage";

export function MistakeAnalysisDetail({
  analysis,
  client,
  busy,
  onRetry,
}: {
  analysis: MistakeAnalysis;
  client: TutorClient;
  busy: boolean;
  onRetry(): void;
}) {
  const [src, setSrc] = useState("");
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(0);
  const [preview, setPreview] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false),
    [tab, setTab] = useState<"diagnosis" | "question" | "solution">(
      "diagnosis",
    );
  useEffect(() => {
    let current = true,
      url = "";
    setSrc("");
    setPhotoFailed(false);
    void client
      .fetchPhoto(analysis.conversationId, analysis.photoId)
      .then((blob) => {
        if (!current) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {
        if (current) setPhotoFailed(true);
      });
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, analysis.conversationId, analysis.photoId, photoRevision]);
  const result = analysis.result;
  if (analysis.status === "recognizing")
    return (
      <p className="mistake-wait" role="status">
        正在识别题目、学生作答和批改痕迹…
      </p>
    );
  if (analysis.status === "analyzing")
    return (
      <p className="mistake-wait" role="status">
        正在核算答案并整理证据和验证题…
      </p>
    );
  if (analysis.status === "failed")
    return (
      <div className="mistake-wait">
        <p>本次分析未完成，已保留图片和补充信息。</p>
        <button className="btn btn--quiet" disabled={busy} onClick={onRetry}>
          重试
        </button>
      </div>
    );
  return (
    <div className="mistake-detail">
      {result && (
        <div className="mistake-tabs" role="tablist" aria-label="错题阅读内容">
          {(
            [
              ["diagnosis", "错题分析"],
              ["question", "题目"],
              ["solution", "解析"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === "diagnosis" && (
        <>
          {src && (
            <MistakeImage
              src={src}
              region={analysis.input?.region}
              annotations={result?.annotations}
              active={active}
              onSelect={(i) => setActive(active === i ? null : i)}
            />
          )}
          {photoFailed && (
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setPhotoRevision((n) => n + 1)}
            >
              原图加载失败，点击重试
            </button>
          )}
          <div className="mistake-image-actions">
            {src && (
              <button type="button" onClick={() => setPreview(true)}>
                查看整张原图
              </button>
            )}
          </div>
        </>
      )}
      {result && (
        <>
          {tab === "question" && (
            <Markdown value={analysis.input?.stem || ""} />
          )}
          {tab === "solution" && (
            <>
              <p className="muted">AI 解析，请结合原题核对</p>
              <Markdown value={result.correctAnswer} />
              <Markdown value={result.explanation} />
            </>
          )}
          {tab === "diagnosis" && (
            <>
              {active !== null &&
                result.annotations[active] &&
                !result.annotations[active].region && (
                  <div
                    className="mistake-note"
                    role="region"
                    aria-label="原图批注"
                  >
                    <div className="mistake-section-title">
                      <strong>{result.annotations[active].title}</strong>
                      <button
                        type="button"
                        aria-label="收起批注"
                        onClick={() => setActive(null)}
                      >
                        收起
                      </button>
                    </div>
                    <Markdown value={result.annotations[active].explanation} />
                  </div>
                )}
              {result.annotations.some((item) => !item.region) && (
                <div className="mistake-evidence-links">
                  {result.annotations.map((item, i) =>
                    !item.region ? (
                      <button
                        type="button"
                        key={i}
                        aria-pressed={active === i}
                        onClick={() => setActive(active === i ? null : i)}
                      >
                        {i + 1}. {item.title}
                      </button>
                    ) : null,
                  )}
                </div>
              )}
              {result.hypotheses.length > 0 && (
                <section>
                  <h3>
                    可能卡在这里 <span className="mistake-label">待验证</span>
                  </h3>
                  {result.hypotheses.slice(0, 1).map((hypothesis, i) => (
                    <Markdown key={i} value={hypothesis} />
                  ))}
                </section>
              )}
              {result.missingEvidence && (
                <p className="mistake-caution">
                  {result.verdict === "uncertain"
                    ? "信息不足，暂不能确定作答是否有误。"
                    : "错因尚待验证，判断依据见完整报告。"}
                </p>
              )}
              {result.verification && (
                <details className="mistake-verification">
                  <summary>用一道题验证</summary>
                  <div className="mistake-verification__body">
                    <Markdown value={result.verification.question} />
                    <button
                      type="button"
                      className="mistake-text-button"
                      aria-expanded={showAnswer}
                      onClick={() => setShowAnswer(!showAnswer)}
                    >
                      {showAnswer ? "收起参考答案" : "展开参考答案"}
                    </button>
                    {showAnswer && (
                      <Markdown value={result.verification.answer} />
                    )}
                  </div>
                </details>
              )}
              <details className="mistake-report">
                <summary>查看完整报告</summary>
                <h3>题目与作答</h3>
                <Markdown value={analysis.input?.stem || ""} />
                <p>学生作答：{analysis.input?.studentAnswer || "未提供"}</p>
                {analysis.input?.teacherNote && (
                  <>
                    <h3>教师补充</h3>
                    <Markdown value={analysis.input.teacherNote} />
                  </>
                )}
                <h3>参考答案与解析</h3>
                <Markdown value={result.correctAnswer} />
                <Markdown value={result.explanation} />
                {result.annotations.length > 0 && (
                  <>
                    <h3>原图批注</h3>
                    {result.annotations.map((item, i) => (
                      <div key={i}>
                        <strong>{item.title}</strong>
                        <Markdown value={item.explanation} />
                      </div>
                    ))}
                  </>
                )}
                <h3>证据与假设</h3>
                {result.facts.map((item, i) => (
                  <Markdown key={`f${i}`} value={item} />
                ))}
                {result.hypotheses.map((item, i) => (
                  <Markdown key={`h${i}`} value={`待验证：${item}`} />
                ))}
                {result.missingEvidence && (
                  <Markdown value={result.missingEvidence} />
                )}
                {result.verification && (
                  <>
                    <h3>验证题与参考答案</h3>
                    <Markdown value={result.verification.question} />
                    <Markdown value={result.verification.answer} />
                  </>
                )}
              </details>
            </>
          )}
        </>
      )}
      {preview && src && (
        <PhotoViewer src={src} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}
