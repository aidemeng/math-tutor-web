import { expect, it } from "vitest";
import { constrainPhotoView, movePhotoView } from "../src/lib/photoGesture";

const photo = { width: 300, height: 500 };
const viewport = { width: 320, height: 600 };
const view = { scale: 1, x: 0, y: 0 };

it("zooms continuously around the fingers rather than the image center", () => {
  const next = movePhotoView(
    view,
    [
      { x: -50, y: 50 },
      { x: 50, y: 50 },
    ],
    [
      { x: -100, y: 50 },
      { x: 100, y: 50 },
    ],
    photo,
    viewport,
  );
  expect(next).toEqual({ scale: 2, x: 0, y: -50 });
});
it("combines a pinch with midpoint movement", () => {
  const next = movePhotoView(
    view,
    [
      { x: -50, y: 0 },
      { x: 50, y: 0 },
    ],
    [
      { x: -60, y: 40 },
      { x: 140, y: 40 },
    ],
    photo,
    viewport,
  );
  expect(next).toEqual({ scale: 2, x: 40, y: 40 });
});
it("allows single finger panning after zooming and prevents dragging the image away", () => {
  expect(
    movePhotoView(
      { scale: 2, x: 0, y: 0 },
      [{ x: 0, y: 0 }],
      [{ x: 500, y: -500 }],
      photo,
      viewport,
    ),
  ).toEqual({ scale: 2, x: 140, y: -200 });
});
it("returns to a centered full image when pinching back to minimum scale", () => {
  expect(
    movePhotoView(
      { scale: 2, x: 50, y: 100 },
      [
        { x: -100, y: 0 },
        { x: 100, y: 0 },
      ],
      [
        { x: -10, y: 0 },
        { x: 10, y: 0 },
      ],
      photo,
      viewport,
    ),
  ).toEqual(view);
});
it("caps extreme enlargement and ignores accidental empty gestures", () => {
  expect(
    movePhotoView(
      view,
      [
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: -100, y: 0 },
        { x: 100, y: 0 },
      ],
      photo,
      viewport,
    ).scale,
  ).toBe(6);
  expect(movePhotoView(view, [], [], photo, viewport)).toEqual(view);
});
it("reclamps translation when viewport dimensions change", () => {
  expect(
    constrainPhotoView({ scale: 2, x: 120, y: 120 }, photo, {
      width: 580,
      height: 980,
    }),
  ).toEqual({ scale: 2, x: 10, y: 10 });
});
