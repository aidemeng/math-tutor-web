import {Icon} from './Icon';
export function TurnError({message,onEdit,disabled=false}:{message:string;onEdit?:()=>void;disabled?:boolean}) {
  return <div className="turn__failure" role="alert">
    <Icon name="alert" size={14}/><span>{message}</span>
    {onEdit ? <button type="button" disabled={disabled} onClick={onEdit}>修改提问</button> : null}
  </div>;
}
