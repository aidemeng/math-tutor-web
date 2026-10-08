import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE_URL } from "../api/client";
import { sharing, type PublicQuestion } from "../api/sharing";
import { friendlyError } from "../api/errors";
import { BrandLogo } from "../components/BrandLogo";
import { QuestionDiagrams } from "../components/QuestionDiagram";
import { renderMarkdown } from "../lib/markdown";
import { questionAssetIndex } from "../lib/questionAssets";
import type { Question } from "../api/types";
import "../styles/sharing.css";
import "../styles/markdown.css";
function PublicStem({
  question,
  code,
}: {
  question: PublicQuestion;
  code: string;
}) {
  const html = useMemo(() => {
    const doc = new DOMParser().parseFromString(
      renderMarkdown(question.stem),
      "text/html",
    );
    // Publish only declared question assets; never fetch arbitrary links or uploaded photos.
    doc.querySelectorAll("img").forEach((img) => {
      const index = questionAssetIndex(
        question as Question,
        img.getAttribute("data-asset") || "",
      );
      if (index < 0) {
        img.remove();
        return;
      }
      img.src = `${API_BASE_URL}/v1/public/shares/${encodeURIComponent(code)}/assets/${index}`;
      img.className = "md-img";
      img.removeAttribute("data-asset");
    });
    doc
      .querySelectorAll("image,video,audio,source,iframe")
      .forEach((el) => el.remove());
    doc
      .querySelectorAll("[srcset]")
      .forEach((el) => el.removeAttribute("srcset"));
    doc.querySelectorAll("a").forEach((a) => a.replaceWith(...a.childNodes));
    return doc.body.innerHTML;
  }, [question, code]);
  return (
    <>
      <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
      <QuestionDiagrams diagrams={question.diagrams} />
    </>
  );
}
export function SharePage() {
  const { code = "" } = useParams(),
    [data, setData] = useState<Awaited<ReturnType<typeof sharing.read>> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [videoError, setVideoError] = useState(false),
    [retry, setRetry] = useState(0);
  const visit = useRef<Promise<void> | null>(null),
    played = useRef(false);
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    setVideoError(false);
    played.current = false;
    sharing
      .read(code)
      .then((r) => {
        if (!live) return;
        setData(r);
        visit.current = sharing.event(code, "visit").catch(() => {});
      })
      .catch((e) => {
        if (live) setError(friendlyError(e));
      });
    return () => {
      live = false;
    };
  }, [code, retry]);
  async function track(event: "play" | "cta") {
    await visit.current;
    await sharing.event(code, event).catch(() => {});
  }
  return (
    <main className="public-share">
      <header className="public-share__brand">
        <BrandLogo size={32} />
        <strong>数学备课助手</strong>
      </header>
      {error ? (
        <section className="card share-controls">
          <h1>暂时无法观看</h1>
          <p>{error}</p>
          <button
            className="btn btn--quiet"
            onClick={() => setRetry((v) => v + 1)}
          >
            重试
          </button>
          <Link to="/">去制作我的讲解视频</Link>
        </section>
      ) : data ? (
        <>
          <section className="card share-controls">
            <h1>{data.question.title}</h1>
            <video
              key={retry}
              className="task__player"
              src={API_BASE_URL + data.videoPath}
              controls
              playsInline
              preload="metadata"
              onPlay={() => {
                if (!played.current) {
                  played.current = true;
                  void track("play");
                }
              }}
              onError={() => setVideoError(true)}
            />
            {videoError ? (
              <p role="alert">
                视频暂时无法播放，
                <button
                  className="share-inline"
                  onClick={() => setRetry((v) => v + 1)}
                >
                  重新加载
                </button>
              </p>
            ) : null}
            <p className="muted">这段视频由数学备课助手制作。</p>
            <Link
              className="btn btn--primary btn--block"
              to="/?register=1"
              onClick={() => void track("cta")}
            >
              制作我的讲解视频
            </Link>
            <p className="public-share__hint">
              面向数学老师 · 找真题、出变式、生成讲解视频
            </p>
          </section>
          <section className="card share-controls">
            <h2>题目</h2>
            {data.question.source ? (
              <span className="muted">{data.question.source}</span>
            ) : null}
            <PublicStem question={data.question} code={code} />
          </section>
        </>
      ) : (
        <p role="status">正在加载讲解视频…</p>
      )}
    </main>
  );
}
