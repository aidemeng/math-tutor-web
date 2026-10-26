// Generated from math-tutor-service/shared/question-diagram.ts
// Trusted mathematical drawing primitives. No model-authored code or markup is executed.
export type Diagram = {
  type: 'geometry' | 'plot';
  title?: string;
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number };
  points?: { id: string; x: number; y: number; label?: string }[];
  segments?: { from: string; to: string }[];
  circles?: { center: string; radius: number }[];
  curves?: { coefficients: number[]; label?: string }[];
};
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
};
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
  // Reserve label space separately instead of shrinking every side equally.
  const labelWidth = Math.max(
    0,
    ...(d.points || []).map((p) => Array.from(p.label || p.id).length * 14),
  );
  const left = pad,
    right = d.type === 'geometry' ? Math.min(width * 0.45, Math.max(pad, labelWidth + 14)) : pad;
  const top = d.type === 'geometry' ? 24 : pad,
    bottom = d.type === 'geometry' ? 16 : pad;
  let sx = (width - left - right) / (b.xmax - b.xmin),
    sy = (height - top - bottom) / (b.ymax - b.ymin);
  if (d.type === 'geometry') sx = sy = Math.min(sx, sy);
  const ox = left + (width - left - right - sx * (b.xmax - b.xmin)) / 2,
    oy = top + (height - top - bottom - sy * (b.ymax - b.ymin)) / 2;
  const pos = (x: number, y: number) => [ox + (x - b.xmin) * sx, oy + (b.ymax - y) * sy];
  const line = (a: number[], c: number[], color = '#365b50') =>
    out.push({ kind: 'line', x: a[0], y: a[1], x2: c[0], y2: c[1], color });
  if (d.type === 'plot') {
    if (b.ymin <= 0 && b.ymax >= 0) {
      line(pos(b.xmin, 0), pos(b.xmax, 0), '#9baaa5');
      const p = pos(b.xmax, 0);
      out.push({ kind: 'text', x: p[0] + 8, y: p[1] - 6, text: 'x', color: '#687f75' });
    }
    if (b.xmin <= 0 && b.xmax >= 0) {
      line(pos(0, b.ymin), pos(0, b.ymax), '#9baaa5');
      const p = pos(0, b.ymax);
      out.push({ kind: 'text', x: p[0] + 7, y: p[1] - 8, text: 'y', color: '#687f75' });
    }
    (d.curves || []).forEach((curve, i) => {
      if (curve.label)
        out.push({ kind: 'text', x: pad + 8, y: 18 + i * 18, text: curve.label, color: '#10966f' });
    });
    for (const curve of d.curves || []) {
      let path: number[][] = [];
      const flush = () => {
        if (path.length > 1) out.push({ kind: 'path', points: path, color: '#10966f' });
        path = [];
      };
      for (let i = 0; i <= 240; i++) {
        const x = b.xmin + ((b.xmax - b.xmin) * i) / 240,
          y = curve.coefficients.reduce((v, c) => v * x + c, 0);
        if (Number.isFinite(y) && y >= b.ymin && y <= b.ymax) path.push(pos(x, y));
        else flush();
      }
      flush();
    }
  }
  const points = new Map((d.points || []).map((p) => [p.id, p]));
  for (const s of d.segments || []) {
    const a = points.get(s.from),
      c = points.get(s.to);
    if (a && c) line(pos(a.x, a.y), pos(c.x, c.y));
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
        color: '#365b50',
      });
    }
  }
  for (const p of d.points || []) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const xy = pos(p.x, p.y);
    out.push({ kind: 'circle', x: xy[0], y: xy[1], r: 2.5, color: '#365b50' });
    if (p.label || p.id)
      out.push({
        kind: 'text',
        x: xy[0] + 6,
        y: xy[1] - 7,
        text: p.label || p.id,
        color: '#243e35',
      });
  }
  return out;
}
