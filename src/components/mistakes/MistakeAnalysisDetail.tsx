import { useEffect, useRef, useState } from "react";
import type { TutorClient } from "../../api/client";
import type {
  MistakeAnalysis,
  MistakeInput,
  MistakeRegion,
} from "../../api/types";
import { Markdown } from "../Markdown";
import { PhotoViewer } from "../PhotoViewer";
import { MistakeImage } from "./MistakeImage";

export function MistakeAnalysisDetail({
  analysis,
  client,
  busy,
  onConfirm,
  onRetry,
}: {
  analysis: MistakeAnalysis;
  client: TutorClient;
  busy: boolean;
  onConfirm(input: MistakeInput): void;
  onRetry(): void;
}) {
  const [src, setSrc] = useState("");
  const initialized = useRef(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [photoRevision, setPhotoRevision] = useState(0);
  const [candidateIndex, setCandidateIndex] = useState(
    analysis.input?.candidateIndex ?? 0,
  );
  const [stem, setStem] = useState(""),
    [answer, setAnswer] = useState(""),
    [note, setNote] = useState("");
  const [region, setRegion] = useState<MistakeRegion>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });
  const [editing, setEditing] = useState(false),
    [preview, setPreview] = useState(false);
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
  useEffect(() => {
    if (!initialized.current && analysis.candidates.length) {
      initialized.current = true;
      if (!analysis.input) {
        const suggested = analysis.candidates.findIndex(
          (item) => item.complete && item.studentAnswer.trim(),
        );
        if (suggested >= 0 && suggested !== candidateIndex) {
          setCandidateIndex(suggested);
          return;
        }
      }
    }
    const candidate = analysis.candidates[candidateIndex];
    if (!candidate) return;
    const input = analysis.input;
    setStem(input?.stem ?? candidate.stem);
    setAnswer(input?.studentAnswer ?? candidate.studentAnswer);
    setNote(input?.teacherNote ?? "");
    setRegion(input?.region ?? candidate.region);
    setEditing(false);
  }, [analysis.id, analysis.candidates, analysis.input, candidateIndex]);
  // Candidate objects come from polling; parent only replaces an unchanged record
  // when updatedAt changes, preserving edits while a teacher is confirming it.
  const result = analysis.result;
  const confirmable = analysis.status === "confirmation";
  const candidate = analysis.candidates[candidateIndex];
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
        <p>本次分析未完成，已保留图片和确认信息。</p>
        <button className="btn btn--quiet" disabled={busy} onClick={onRetry}>
          重试
        </button>
      </div>
    );
  return (
    <div className="mistake-detail">
      {!confirmable && result && (
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
      {confirmable && (
        <>
          <p className="muted">先核对题目范围与学生作答，确认后再分析错因。</p>
          <div className="mistake-options" role="group" aria-label="选择题目">
            {analysis.candidates.map((q, i) => (
              <button
                type="button"
                key={i}
                aria-pressed={candidateIndex === i}
                onClick={() => setCandidateIndex(i)}
              >
                {q.label}
                {!q.complete ? "（不完整）" : ""}
              </button>
            ))}
          </div>
        </>
      )}
      {(confirmable || tab === "diagnosis") && (
        <>
          {src && (
            <MistakeImage
              src={src}
              region={confirmable ? region : analysis.input?.region}
              editing={editing}
              onRegionChange={setRegion}
              annotations={confirmable ? [] : result?.annotations}
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
            {confirmable && (
              <button
                type="button"
                aria-pressed={editing}
                onClick={() => setEditing(!editing)}
              >
                {editing ? "完成范围调整" : "调整题目范围"}
              </button>
            )}
          </div>
          {editing && (
            <p className="muted">
              在原图上拖动框选题目；也可以使用下面的比例输入精确调整。
            </p>
          )}
          {editing && (
            <div className="mistake-region-fields">
              {(["x", "y", "width", "height"] as const).map((key, i) => (
                <label key={key}>
                  {["左侧", "顶部", "宽度", "高度"][i]} %
                  <input
                    type="number"
                    min={key === "width" || key === "height" ? 1 : 0}
                    max={100}
                    value={Math.round(region[key] * 100)}
                    onChange={(e) => {
                      const value = Math.max(
                        key === "width" || key === "height" ? 0.01 : 0,
                        Math.min(
                          key === "x" || key === "y" ? 0.99 : 1,
                          Number(e.target.value) / 100,
                        ),
                      );
                      const next = { ...region, [key]: value };
                      next.width = Math.min(next.width, 1 - next.x);
                      next.height = Math.min(next.height, 1 - next.y);
                      setRegion(next);
                    }}
                  />
                </label>
              ))}
            </div>
          )}
        </>
      )}
      {confirmable && (
        <>
          {candidate && !candidate.complete && (
            <p className="mistake-caution">
              题目可能缺少内容：
              {candidate.missingInformation ||
                "请补充完整条件或重新上传清晰图片。"}
            </p>
          )}
          <label className="mistake-field">
            确认题干
            <textarea
              value={stem}
              maxLength={10000}
              rows={5}
              onChange={(e) => setStem(e.target.value)}
            />
          </label>
          <label className="mistake-field">
            学生作答
            <input
              value={answer}
              maxLength={2000}
              placeholder="未看到作答可留空"
              onChange={(e) => setAnswer(e.target.value)}
            />
          </label>
          {candidate?.gradingEvidence && (
            <p className="muted">
              识别到的批改痕迹：{candidate.gradingEvidence}（请核对）
            </p>
          )}
          <label className="mistake-field">
            补充说明（选填）
            <textarea
              value={note}
              maxLength={2000}
              rows={2}
              placeholder="例如学生的口头解释、补充条件或具体疑问"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={
              busy ||
              !stem.trim() ||
              region.width < 0.01 ||
              region.height < 0.01
            }
            onClick={() =>
              onConfirm({
                candidateIndex,
                stem,
                studentAnswer: answer,
                teacherNote: note,
                region,
              })
            }
          >
            确认并分析
          </button>
        </>
      )}
      {!confirmable && result && (
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
