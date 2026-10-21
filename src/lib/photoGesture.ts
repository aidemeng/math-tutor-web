export type PhotoPoint = { x: number; y: number };
export type PhotoSize = { width: number; height: number };
export type PhotoView = PhotoPoint & { scale: number };

export const initialPhotoView: PhotoView = { scale: 1, x: 0, y: 0 };
const clamp = (value: number, limit: number) =>
  Math.max(-limit, Math.min(limit, value));

export function constrainPhotoView(
  view: PhotoView,
  photo: PhotoSize,
  viewport: PhotoSize,
): PhotoView {
  const scale = Math.max(1, Math.min(6, view.scale));
  return {
    scale,
    x: clamp(view.x, Math.max(0, (photo.width * scale - viewport.width) / 2)),
    y: clamp(view.y, Math.max(0, (photo.height * scale - viewport.height) / 2)),
  };
}

/** Coordinates are relative to the viewport center; preserve the content under the pinch midpoint. */
export function movePhotoView(
  view: PhotoView,
  from: PhotoPoint[],
  to: PhotoPoint[],
  photo: PhotoSize,
  viewport: PhotoSize,
): PhotoView {
  if (!from.length || from.length !== to.length) return view;
  if (from.length === 1)
    return constrainPhotoView(
      {
        ...view,
        x: view.x + to[0].x - from[0].x,
        y: view.y + to[0].y - from[0].y,
      },
      photo,
      viewport,
    );
  const midpoint = (p: PhotoPoint[]) => ({
    x: (p[0].x + p[1].x) / 2,
    y: (p[0].y + p[1].y) / 2,
  });
  const distance = (p: PhotoPoint[]) =>
    Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  const before = midpoint(from),
    after = midpoint(to);
  const scale = Math.max(
    1,
    Math.min(6, (view.scale * distance(to)) / Math.max(1, distance(from))),
  );
  const ratio = scale / view.scale;
  return constrainPhotoView(
    {
      scale,
      x: after.x - (before.x - view.x) * ratio,
      y: after.y - (before.y - view.y) * ratio,
    },
    photo,
    viewport,
  );
}
