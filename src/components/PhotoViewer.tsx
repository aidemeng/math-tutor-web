import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Icon } from "./Icon";
import {
  initialPhotoView,
  movePhotoView,
  type PhotoPoint,
  type PhotoSize,
  type PhotoView,
} from "../lib/photoGesture";
import "../styles/sheet.css";
import "../styles/photo-viewer.css";

export function PhotoViewer({
  src,
  onClose,
}: {
  src: string;
  onClose(): void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [size, setSize] = useState<PhotoSize>({ width: 0, height: 0 });
  const [view, setView] = useState(initialPhotoView);
  const current = useRef(initialPhotoView);
  const pointers = useRef(new Map<number, PhotoPoint>());
  const gesture = useRef<{ view: PhotoView; points: PhotoPoint[] }>({
    view: initialPhotoView,
    points: [],
  });
  const update = (next: PhotoView) => {
    current.current = next;
    setView(next);
  };
  const rebase = () => {
    gesture.current = {
      view: current.current,
      points: [...pointers.current.values()],
    };
  };

  function fit() {
    const stage = stageRef.current,
      image = imageRef.current;
    if (
      !stage ||
      !image?.naturalWidth ||
      stage.clientWidth <= 24 ||
      stage.clientHeight <= 24
    )
      return;
    const ratio = Math.min(
      (stage.clientWidth - 24) / image.naturalWidth,
      (stage.clientHeight - 24) / image.naturalHeight,
    );
    setSize({
      width: image.naturalWidth * ratio,
      height: image.naturalHeight * ratio,
    });
    pointers.current.clear();
    update(initialPhotoView);
    rebase();
  }
  useEffect(() => {
    const dialog = dialogRef.current!;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    const resize = new ResizeObserver(fit);
    resize.observe(stageRef.current!);
    return () => {
      resize.disconnect();
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, []);

  function point(event: PointerEvent): PhotoPoint {
    const rect = stageRef.current!.getBoundingClientRect();
    return {
      x: event.clientX - rect.left - rect.width / 2,
      y: event.clientY - rect.top - rect.height / 2,
    };
  }
  function start(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point(event));
    rebase();
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, point(event));
    const stage = stageRef.current!;
    update(
      movePhotoView(
        gesture.current.view,
        gesture.current.points,
        [...pointers.current.values()],
        size,
        { width: stage.clientWidth, height: stage.clientHeight },
      ),
    );
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    rebase();
  }
  return (
    <dialog
      ref={dialogRef}
      className="photo-viewer"
      aria-label="题目照片"
      onClose={(event) => {
        if (!event.currentTarget.open) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="photo-viewer__panel">
        <header className="sheet__header">
          <h2 className="sheet__title">题目照片</h2>
          <button
            type="button"
            className="iconbtn iconbtn--plain"
            aria-label="关闭图片预览"
            onClick={onClose}
            autoFocus
          >
            <Icon name="close" size={18} />
          </button>
        </header>
        <div
          ref={stageRef}
          className={`photo-viewer__stage${view.scale > 1 ? " photo-viewer__stage--zoomed" : ""}`}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onLostPointerCapture={end}
          onDoubleClick={() => {
            update(initialPhotoView);
            rebase();
          }}
        >
          <img
            ref={imageRef}
            src={src}
            alt="题目照片原图"
            draggable={false}
            onLoad={fit}
            style={{
              width: size.width,
              height: size.height,
              visibility: size.width ? "visible" : "hidden",
              transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
            }}
          />
        </div>
      </div>
    </dialog>
  );
}
