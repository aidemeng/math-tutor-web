import { useEffect, useState, type ReactNode } from "react";
import type { TutorClient } from "../../api/client";
import type { MistakeAnalysis } from "../../api/types";
import { PhotoViewer } from "../PhotoViewer";

export function MistakeTurn({
  client,
  analysis,
  children,
}: {
  client: TutorClient;
  analysis: MistakeAnalysis;
  children: ReactNode;
}) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [preview, setPreview] = useState(false);
  useEffect(() => {
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
    <div className="mistake-turn">
      {src && (
        <button
          className="mistake-turn__photo"
          type="button"
          aria-label="查看上传的错题图片"
          onClick={() => setPreview(true)}
        >
          <img src={src} alt="上传的错题" />
        </button>
      )}
      {failed && (
        <button
          className="mistake-text-button"
          onClick={() => setRevision((value) => value + 1)}
        >
          重新加载图片
        </button>
      )}
      {children}
      {preview && src && (
        <PhotoViewer src={src} onClose={() => setPreview(false)} />
      )}
    </div>
  );
}
