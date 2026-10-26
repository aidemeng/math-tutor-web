import { diagramPrimitives, diagramsForSection, type Diagram } from '../lib/questionDiagram';

export function QuestionDiagrams({ diagrams, section = 'question' }: { diagrams?: Diagram[]; section?: 'question' | 'analysis' }) {
  return <>{diagramsForSection(diagrams, section).map((diagram, index) => (
    <figure key={index} style={{ margin: '8px 0', maxWidth: 220 }}>
      {diagram.title ? <figcaption>{diagram.title}</figcaption> : null}
      <svg viewBox="0 0 280 196" role="img" aria-label={diagram.title || '题目配图'}
        style={{ display: 'block', width: '100%', maxWidth: 220, height: 'auto' }}>
        {diagramPrimitives(diagram, 280, 196).map((p, i) => {
          const stroke = {
            stroke: p.color,
            strokeWidth: p.strokeWidth || 1.6,
            strokeDasharray: p.dash?.join(' '),
            strokeLinecap: 'round' as const,
            strokeLinejoin: 'round' as const,
          };
          if (p.kind === 'line') return <line key={i} x1={p.x} y1={p.y} x2={p.x2} y2={p.y2} {...stroke} />;
          if (p.kind === 'circle') return <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={p.color} />;
          if (p.kind === 'ellipse') return <ellipse key={i} cx={p.x} cy={p.y} rx={p.r} ry={p.ry} {...stroke} fill="none" />;
          if (p.kind === 'path') return <polyline key={i} points={p.points!.map(a => a.join(',')).join(' ')} {...stroke} fill="none" />;
          return <text key={i} x={p.x} y={p.y} fill={p.color} fontSize={14} fontFamily="Georgia, Times New Roman, serif"
            stroke={p.halo ? 'white' : undefined} strokeWidth={p.halo ? 3 : undefined} strokeLinejoin="round" paintOrder="stroke">{p.text}</text>;
        })}
      </svg>
    </figure>
  ))}</>;
}
