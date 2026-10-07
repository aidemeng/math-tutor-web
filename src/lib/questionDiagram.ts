// Generated from math-tutor-service/shared/question-diagram.ts
// Trusted mathematical drawing primitives. No model-authored code or markup is executed.
export type Diagram={type:'geometry'|'plot';title?:string;bounds:{xmin:number;xmax:number;ymin:number;ymax:number};points?:{id:string;x:number;y:number;label?:string}[];segments?:{from:string;to:string}[];circles?:{center:string;radius:number}[];curves?:{coefficients:number[];label?:string}[]};
export type Primitive={kind:'line'|'circle'|'ellipse'|'path'|'text';x?:number;y?:number;x2?:number;y2?:number;r?:number;ry?:number;text?:string;points?:number[][];color:string};
export function diagramPrimitives(d:Diagram,width=400,height=280):Primitive[]{
 const out:Primitive[]=[],b=d.bounds,pad=d.type==='plot'?52:32;
 if(!b||![b.xmin,b.xmax,b.ymin,b.ymax].every(Number.isFinite)||b.xmax<=b.xmin||b.ymax<=b.ymin)return out;
 let sx=(width-2*pad)/(b.xmax-b.xmin),sy=(height-2*pad)/(b.ymax-b.ymin);
 if(d.type==='geometry')sx=sy=Math.min(sx,sy);
 const ox=(width-sx*(b.xmax-b.xmin))/2,oy=(height-sy*(b.ymax-b.ymin))/2;
 const pos=(x:number,y:number)=>[ox+(x-b.xmin)*sx,height-oy-(y-b.ymin)*sy];
 const line=(a:number[],c:number[],color='#365b50')=>out.push({kind:'line',x:a[0],y:a[1],x2:c[0],y2:c[1],color});
 if(d.type==='plot'){
  if(b.ymin<=0&&b.ymax>=0){line(pos(b.xmin,0),pos(b.xmax,0),'#9baaa5');const p=pos(b.xmax,0);out.push({kind:'text',x:p[0]+8,y:p[1]-6,text:'x',color:'#687f75'});}
  if(b.xmin<=0&&b.xmax>=0){line(pos(0,b.ymin),pos(0,b.ymax),'#9baaa5');const p=pos(0,b.ymax);out.push({kind:'text',x:p[0]+7,y:p[1]-8,text:'y',color:'#687f75'});}
  (d.curves||[]).forEach((curve,i)=>{if(curve.label)out.push({kind:'text',x:pad+8,y:18+i*18,text:curve.label,color:'#10966f'});});
  for(const curve of d.curves||[]){let path:number[][]=[];const flush=()=>{if(path.length>1)out.push({kind:'path',points:path,color:'#10966f'});path=[];};
   for(let i=0;i<=240;i++){const x=b.xmin+(b.xmax-b.xmin)*i/240,y=curve.coefficients.reduce((v,c)=>v*x+c,0);if(Number.isFinite(y)&&y>=b.ymin&&y<=b.ymax)path.push(pos(x,y));else flush();}flush();
  }
 }
 const points=new Map((d.points||[]).map(p=>[p.id,p]));
 for(const s of d.segments||[]){const a=points.get(s.from),c=points.get(s.to);if(a&&c)line(pos(a.x,a.y),pos(c.x,c.y));}
 for(const circle of d.circles||[]){const c=points.get(circle.center);if(c&&Number.isFinite(circle.radius)&&circle.radius>0){const p=pos(c.x,c.y);out.push({kind:'ellipse',x:p[0],y:p[1],r:circle.radius*sx,ry:circle.radius*sy,color:'#365b50'});}}
 for(const p of d.points||[]){if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;const xy=pos(p.x,p.y);out.push({kind:'circle',x:xy[0],y:xy[1],r:2.5,color:'#365b50'});if(p.label||p.id)out.push({kind:'text',x:xy[0]+6,y:xy[1]-7,text:p.label||p.id,color:'#243e35'});}
 return out;
}
