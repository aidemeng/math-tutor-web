import { useEffect, useState } from "react";
import type { TutorClient } from "../../api/client";
import type { MistakeAnalysis } from "../../api/types";
import { Markdown } from "../Markdown";
import { PhotoViewer } from "../PhotoViewer";

export function MistakeSource({
  analysis,
  client,
}: {
  analysis: MistakeAnalysis;
  client: TutorClient;
}) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    if (!analysis.photoId) return;
    let current = true,
      url = "";
    setSrc("");
    setFailed(false);
    void client
      .fetchPhoto(analysis.conversationId, analysis.photoId)
      .then((blob) => {
        if (!current) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [client, analysis.conversationId, analysis.photoId, revision]);
  return (
    <div className="report-source-content">
      {src && (
        <button
          className="report-original"
          aria-label="放大原图"
          onClick={() => setPreview(true)}
        >
          <img src={src} alt="原题与作答" />
        </button>
      )}
      {failed && (
        <button
          className="btn btn--quiet"
          onClick={() => setRevision((value) => value + 1)}
        >
          重新加载原图
        </button>
      )}
      <h3>题目</h3>
      <Markdown value={analysis.input?.stem || ""} />
      <h3>你的作答</h3>
      <Markdown value={analysis.input?.studentAnswer || "未提供作答"} />
      {preview && src && (
        <PhotoViewer src={src} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}
