import { useState } from "react";
import { PhotoViewer } from "./PhotoViewer";

/** Keep the photo separate from the text bubble, including hydrated history photos. */
export function UserMessage({
  photo,
  prompt,
}: {
  photo?: string;
  prompt: string;
}) {
  const [previewing, setPreviewing] = useState(false);
  return (
    <>
      {photo ? (
        <button
          type="button"
          className="turn__photo-link"
          onClick={() => setPreviewing(true)}
          aria-label="查看题目照片"
        >
          <img className="turn__photo" src={photo} alt="题目照片" />
        </button>
      ) : null}
      {prompt ? (
        <div className="turn__user">
          <p className="turn__prompt">{prompt}</p>
        </div>
      ) : null}
      {photo && previewing ? (
        <PhotoViewer src={photo} onClose={() => setPreviewing(false)} />
      ) : null}
    </>
  );
}
