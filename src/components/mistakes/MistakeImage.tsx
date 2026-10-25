import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { MistakeRegion, MistakeResult } from "../../api/types";
import { Markdown } from "../Markdown";
const whole: MistakeRegion = { x: 0, y: 0, width: 1, height: 1 };
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function MistakeImage({
  src,
  region = whole,
  annotations = [],
  active,
  onSelect,
  editing = false,
  onRegionChange,
}: {
  src: string;
  region?: MistakeRegion;
  annotations?: MistakeResult["annotations"];
  active?: number | null;
  onSelect?(index: number): void;
  editing?: boolean;
  onRegionChange?(region: MistakeRegion): void;
}) {
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [drag, setDrag] = useState<MistakeRegion | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let alive = true;
    const image = new Image();
    image.onload = () => {
      if (alive)
        setSize({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.src = src;
    return () => {
      alive = false;
    };
  }, [src]);
  const shown = editing ? whole : region;
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  };
  const rectOf = (r: MistakeRegion) => ({
    x: r.x * size.width,
    y: r.y * size.height,
    width: r.width * size.width,
    height: r.height * size.height,
  });
  const selection = drag || region;
  function end(event: PointerEvent<SVGSVGElement>) {
    if (!start.current) return;
    const to = point(event),
      from = start.current;
    const next = {
      x: Math.min(from.x, to.x),
      y: Math.min(from.y, to.y),
      width: Math.abs(from.x - to.x),
      height: Math.abs(from.y - to.y),
    };
    start.current = null;
    setDrag(null);
    if (next.width >= 0.01 && next.height >= 0.01) onRegionChange?.(next);
  }
  return (
    <div
      className={`mistake-image${editing ? " mistake-image--editing" : ""}`}
      onTouchStart={(event) => {
        if (editing) event.stopPropagation();
      }}
      onTouchMove={(event) => {
        if (editing) event.stopPropagation();
      }}
    >
      <svg
        viewBox={`${shown.x * size.width} ${shown.y * size.height} ${shown.width * size.width} ${shown.height * size.height}`}
        style={{
          aspectRatio:
            (shown.width * size.width) / (shown.height * size.height),
        }}
        role="img"
        aria-label={
          editing ? "拖动框选需要分析的题目区域" : "错题原图，批注位置可点击"
        }
        onPointerDown={(event) => {
          if (!editing) return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          start.current = point(event);
        }}
        onPointerMove={(event) => {
          if (!editing || !start.current) return;
          const to = point(event),
            from = start.current;
          setDrag({
            x: Math.min(from.x, to.x),
            y: Math.min(from.y, to.y),
            width: Math.abs(from.x - to.x),
            height: Math.abs(from.y - to.y),
          });
        }}
        onPointerUp={end}
        onPointerCancel={() => {
          start.current = null;
          setDrag(null);
        }}
      >
        <image href={src} width={size.width} height={size.height} />
        {editing && (
          <rect {...rectOf(selection)} className="mistake-image__region" />
        )}
        {!editing &&
          annotations.map((note, i) =>
            note.region ? (
              <rect
                key={i}
                {...rectOf(note.region)}
                className={`mistake-image__mark${active === i ? " is-active" : ""}`}
              />
            ) : null,
          )}
      </svg>
      {!editing &&
        annotations.map((note, i) => {
          const r = note.region;
          if (!r) return null;
          return (
            <button
              key={i}
              type="button"
              className="mistake-image__pin"
              aria-label={`查看批注：${note.title}`}
              aria-pressed={active === i}
              onClick={() => onSelect?.(i)}
              style={{
                left: `${Math.max(3, Math.min(94, ((r.x + r.width - shown.x) / shown.width) * 100))}%`,
                top: `${Math.max(4, Math.min(94, ((r.y - shown.y) / shown.height) * 100))}%`,
              }}
            >
              {i + 1}
            </button>
          );
        })}
      {!editing &&
        active !== null &&
        active !== undefined &&
        annotations[active]?.region && (
          <div
            className="mistake-image__bubble"
            role="region"
            aria-label="原图批注"
          >
            <div className="mistake-section-title">
              <strong>{annotations[active].title}</strong>
              <button
                type="button"
                aria-label="收起批注"
                onClick={() => onSelect?.(active)}
              >
                收起
              </button>
            </div>
            <Markdown value={annotations[active].explanation} />
          </div>
        )}
    </div>
  );
}
