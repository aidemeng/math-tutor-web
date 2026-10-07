import {diagramPrimitives,type Diagram} from '../lib/questionDiagram';
export function QuestionDiagrams({diagrams}:{diagrams?:Diagram[]}){
 return <>{(diagrams||[]).map((d,index)=><figure key={index} style={{margin:'16px 0'}}>
  {d.title?<figcaption>{d.title}</figcaption>:null}
  <svg viewBox="0 0 400 280" role="img" aria-label={d.title||'题目配图'} style={{width:'100%',maxHeight:300,background:'#fafcfb'}}>
   {diagramPrimitives(d).map((p,i)=>p.kind==='line'?<line key={i} x1={p.x} y1={p.y} x2={p.x2} y2={p.y2} stroke={p.color} strokeWidth={1.8}/>:p.kind==='circle'?<circle key={i} cx={p.x} cy={p.y} r={p.r} stroke={p.color} fill={p.r===2.5?p.color:'none'}/>:p.kind==='ellipse'?<ellipse key={i} cx={p.x} cy={p.y} rx={p.r} ry={p.ry} stroke={p.color} fill="none"/>:p.kind==='path'?<polyline key={i} points={p.points!.map(a=>a.join(',')).join(' ')} fill="none" stroke={p.color} strokeWidth={2}/>:<text key={i} x={p.x} y={p.y} fill={p.color} fontSize={14}>{p.text}</text>)}
  </svg>
 </figure>)}</>;
}
