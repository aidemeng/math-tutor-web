import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import "../styles/photo-viewer.css";

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

function PhotoViewer({ src, onClose }: { src: string; onClose(): void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, []);

  function toggleZoom() {
    setZoomed((value) => !value);
    stageRef.current?.scrollTo(0, 0);
  }

  return (
    <dialog
      ref={dialogRef}
      className="photo-viewer"
      aria-label="图片预览"
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
    >
      <header className="photo-viewer__header">
        <span>题目照片</span>
        <div className="photo-viewer__actions">
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭图片预览"
            autoFocus
          >
            <Icon name="close" size={22} />
          </button>
        </div>
      </header>
      <div
        ref={stageRef}
        className={`photo-viewer__stage${zoomed ? " photo-viewer__stage--zoomed" : ""}`}
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <button
          type="button"
          className="photo-viewer__image"
          onClick={toggleZoom}
          aria-label={zoomed ? "缩小题目照片" : "放大题目照片"}
        >
          <img src={src} alt="题目照片原图" draggable={false} />
        </button>
      </div>
    </dialog>
  );
}
