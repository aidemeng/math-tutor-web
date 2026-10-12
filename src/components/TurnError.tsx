export function TurnError({onRetry,disabled=false}:{onRetry:()=>void;disabled?:boolean}) {
  return <div className="turn__failure">
    <button type="button" disabled={disabled} onClick={onRetry}>重试</button>
  </div>;
}
