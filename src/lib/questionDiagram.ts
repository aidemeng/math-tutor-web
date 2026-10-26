// Generated from math-tutor-service/shared/question-diagram.ts
// Trusted mathematical drawing primitives. No model-authored code or markup is executed.
type Point2 = readonly [number, number];

export type Diagram = {
  type: 'geometry' | 'plot';
  section?: 'question' | 'analysis';
  title?: string;
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  points?: { id: string; x: number; y: number; label?: string }[];
  segments?: { from: string; to: string; auxiliary?: boolean }[];
  circles?: { center: string; radius: number }[];
  curves?: { coefficients: number[]; label?: string }[];
};
// Legacy figures have no section and remain visible. New solution figures are analysis-only.
export function diagramsForSection(
  diagrams: Diagram[] = [],
  section: 'question' | 'analysis' = 'question',
): Diagram[] {
  return diagrams.filter((d) => section === 'analysis' || !d.section || d.section === 'question');
}

export type Primitive = {
  kind: 'line' | 'circle' | 'ellipse' | 'path' | 'text';
  x?: number;
  y?: number;
  x2?: number;
  y2?: number;
  r?: number;
  ry?: number;
  text?: string;
  points?: number[][];
  color: string;
  dash?: number[];
  strokeWidth?: number;
  halo?: boolean;
};

type Box = { x: number; y: number; w: number; h: number };
const overlaps = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

function crossesBox(a: Point2, b: Point2, box: Box) {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [a[0], b[0] - a[0], box.x, box.x + box.w],
    [a[1], b[1] - a[1], box.y, box.y + box.h],
  ]) {
    if (Math.abs(delta) < 1e-8) {
      if (start < min || start > max) return false;
    } else {
      const t1 = (min - start) / delta,
        t2 = (max - start) / delta;
      lo = Math.max(lo, Math.min(t1, t2));
      hi = Math.min(hi, Math.max(t1, t2));
      if (lo > hi) return false;
    }
  }
  return true;
}

function labelPosition(
  anchor: Point2,
  text: string,
  width: number,
  height: number,
  ink: Primitive[],
  boxes: Box[],
  center: Point2,
): Point2 {
  const w = Math.min(width - 16, Array.from(text).length * 14),
    h = 16;
  let best: Box | undefined,
    bestScore = Infinity;
  // Try close positions first, then give crowded labels a second ring.
  for (const gap of [8, 22, 36])
    for (const [dx, dy] of [
      [gap, -h - gap],
      [-w - gap, -h - gap],
      [gap, gap],
      [-w - gap, gap],
      [-w / 2, -h - gap],
      [-w / 2, gap],
      [gap, -h / 2],
      [-w - gap, -h / 2],
    ]) {
      const box = {
        x: Math.max(8, Math.min(width - w - 8, anchor[0] + dx)),
        y: Math.max(4, Math.min(height - h - 4, anchor[1] + dy)),
        w,
        h,
      };
      let score = (gap - 8) * 0.2;
      for (const existing of boxes) score += overlaps(box, existing) * 100;
      for (const p of ink) {
        if (p.kind === 'circle')
          score += overlaps(box, { x: p.x! - 4, y: p.y! - 4, w: 8, h: 8 }) * 30;
        else if (p.kind === 'line' && crossesBox([p.x!, p.y!], [p.x2!, p.y2!], box)) score += 200;
        else if (p.kind === 'path') {
          const points = p.points || [];
          for (let i = 1; i < points.length; i++)
            if (
              crossesBox(points[i - 1] as unknown as Point2, points[i] as unknown as Point2, box)
            ) {
              score += 200;
              break;
            }
        } else if (p.kind === 'ellipse') {
          const nx = (box.x + w / 2 - p.x!) / p.r!,
            ny = (box.y + h / 2 - p.y!) / p.ry!;
          if (Math.abs(Math.hypot(nx, ny) - 1) * Math.min(p.r!, p.ry!) < Math.max(w, h) / 2)
            score += 100;
        }
      }
      // Prefer the outside of the figure rather than putting vertex names in it.
      const vx = box.x + w / 2 - anchor[0],
        vy = box.y + h / 2 - anchor[1];
      const distance = Math.hypot(vx, vy) || 1;
      score +=
        Math.max(
          -1,
          Math.min(
            1,
            (vx * (center[0] - anchor[0]) + vy * (center[1] - anchor[1])) /
              distance /
              (Math.hypot(center[0] - anchor[0], center[1] - anchor[1]) || 1),
          ),
        ) * 8;
      if (score < bestScore) {
        best = box;
        bestScore = score;
      }
    }
  boxes.push(best!);
  return [best!.x, best!.y + 12];
}
export function diagramPrimitives(d: Diagram, width = 400, height = 280): Primitive[] {
  const out: Primitive[] = [],
    pad = d.type === 'plot' ? 28 : 20;
  let b = d.bounds;
  if (
    !b ||
    ![b.xmin, b.xmax, b.ymin, b.ymax].every(Number.isFinite) ||
    b.xmax <= b.xmin ||
    b.ymax <= b.ymin
  )
    return out;
  // Geometry bounds from the model often contain large empty margins. Derive
  // its viewport from the actual drawing; plot bounds retain their math meaning.
  if (d.type === 'geometry') {
    const points = (d.points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
    if (points.length) {
      const xs = points.map((p) => p.x),
        ys = points.map((p) => p.y);
      for (const circle of d.circles || []) {
        const center = points.find((p) => p.id === circle.center);
        if (center && Number.isFinite(circle.radius) && circle.radius > 0) {
          xs.push(center.x - circle.radius, center.x + circle.radius);
          ys.push(center.y - circle.radius, center.y + circle.radius);
        }
      }
      b = {
        xmin: Math.min(...xs),
        xmax: Math.max(...xs),
        ymin: Math.min(...ys),
        ymax: Math.max(...ys),
      };
      const span = Math.max(b.xmax - b.xmin, b.ymax - b.ymin, 1);
      if (b.xmin === b.xmax) {
        b.xmin -= span / 2;
        b.xmax += span / 2;
      }
      if (b.ymin === b.ymax) {
        b.ymin -= span / 2;
        b.ymax += span / 2;
      }
    }
  }
  const left = pad,
    right = pad;
  const top = d.type === 'geometry' ? 24 : pad,
    bottom = d.type === 'geometry' ? 16 : pad;
  let sx = (width - left - right) / (b.xmax - b.xmin),
    sy = (height - top - bottom) / (b.ymax - b.ymin);
  if (d.type === 'geometry') sx = sy = Math.min(sx, sy);
  const ox = left + (width - left - right - sx * (b.xmax - b.xmin)) / 2,
    oy = top + (height - top - bottom - sy * (b.ymax - b.ymin)) / 2;
  const pos = (x: number, y: number): Point2 => [ox + (x - b.xmin) * sx, oy + (b.ymax - y) * sy];
  const line = (a: Point2, c: Point2, color = '#000000') =>
    out.push({ kind: 'line', x: a[0], y: a[1], x2: c[0], y2: c[1], color });
  if (d.type === 'plot') {
    if (b.ymin <= 0 && b.ymax >= 0) {
      line(pos(b.xmin, 0), pos(b.xmax, 0), '#000000');
      const p = pos(b.xmax, 0);
      line([p[0] - 6, p[1] - 3], p, '#000000');
      line(p, [p[0] - 6, p[1] + 3], '#000000');
      out.push({
        kind: 'text',
        x: p[0] + 8,
        y: Math.max(14, p[1] - 6),
        text: 'x',
        color: '#000000',
      });
    }
    if (b.xmin <= 0 && b.xmax >= 0) {
      line(pos(0, b.ymin), pos(0, b.ymax), '#000000');
      const p = pos(0, b.ymax);
      line([p[0] - 3, p[1] + 6], p, '#000000');
      line(p, [p[0] + 3, p[1] + 6], '#000000');
      out.push({ kind: 'text', x: p[0] + 7, y: p[1] + 16, text: 'y', color: '#000000' });
    }
    (d.curves || []).forEach((curve, i) => {
      if (curve.label)
        out.push({ kind: 'text', x: pad + 8, y: 18 + i * 18, text: curve.label, color: '#000000' });
    });
    for (const curve of d.curves || []) {
      let path: number[][] = [];
      const flush = () => {
        if (path.length > 1) out.push({ kind: 'path', points: path, color: '#000000' });
        path = [];
      };
      for (let i = 0; i <= 240; i++) {
        const x = b.xmin + ((b.xmax - b.xmin) * i) / 240,
          y = curve.coefficients.reduce((v, c) => v * x + c, 0);
        if (Number.isFinite(y) && y >= b.ymin && y <= b.ymax) path.push([...pos(x, y)]);
        else flush();
      }
      flush();
    }
  }
  const points = new Map((d.points || []).map((p) => [p.id, p]));
  for (const s of d.segments || []) {
    const a = points.get(s.from),
      c = points.get(s.to);
    if (a && c) {
      line(pos(a.x, a.y), pos(c.x, c.y), '#000000');
      if (s.auxiliary) out[out.length - 1].dash = [5, 4];
    }
  }
  for (const circle of d.circles || []) {
    const c = points.get(circle.center);
    if (c && Number.isFinite(circle.radius) && circle.radius > 0) {
      const p = pos(c.x, c.y);
      out.push({
        kind: 'ellipse',
        x: p[0],
        y: p[1],
        r: circle.radius * sx,
        ry: circle.radius * sy,
        color: '#000000',
      });
    }
  }
  const centers = new Set((d.circles || []).map((c) => c.center));
  const anchors: Primitive[] = [];
  for (const p of d.points || []) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const xy = pos(p.x, p.y);
    const anchor: Primitive = { kind: 'circle', x: xy[0], y: xy[1], r: 2.5, color: '#000000' };
    anchors.push(anchor);
    if (centers.has(p.id)) out.push(anchor);
  }
  const ink = [...out.filter((p) => p.kind !== 'circle'), ...anchors],
    boxes: Box[] = out
      .filter((p) => p.kind === 'text')
      .map((p) => ({ x: p.x!, y: p.y! - 12, w: Array.from(p.text || '').length * 14, h: 16 }));
  const coords = (d.points || [])
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => pos(p.x, p.y));
  const center: Point2 = coords.length
    ? [
        coords.reduce((n, p) => n + p[0], 0) / coords.length,
        coords.reduce((n, p) => n + p[1], 0) / coords.length,
      ]
    : [width / 2, height / 2];
  for (const p of d.points || []) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    if (p.label !== '' && (p.label || p.id)) {
      const anchor = pos(p.x, p.y);
      const xy = labelPosition(anchor, p.label || p.id, width, height, ink, boxes, center);
      const box = boxes[boxes.length - 1];
      const nearest: Point2 = [
        Math.max(box.x, Math.min(box.x + box.w, anchor[0])),
        Math.max(box.y, Math.min(box.y + box.h, anchor[1])),
      ];
      const distance = Math.hypot(nearest[0] - anchor[0], nearest[1] - anchor[1]);
      // Crowded labels may move farther away: retain an unambiguous connection.
      if (distance > 18) {
        const dx = (nearest[0] - anchor[0]) / distance;
        const dy = (nearest[1] - anchor[1]) / distance;
        const start: Point2 = [anchor[0] + dx * 4, anchor[1] + dy * 4];
        const end: Point2 = [nearest[0] - dx * 2, nearest[1] - dy * 2];
        out.push({
          kind: 'line',
          x: start[0],
          y: start[1],
          x2: end[0],
          y2: end[1],
          color: '#000000',
          strokeWidth: 0.8,
        });
      }
      out.push({
        kind: 'text',
        x: xy[0],
        y: xy[1],
        text: p.label || p.id,
        color: '#000000',
        halo: true,
      });
    }
  }
  return out;
}
