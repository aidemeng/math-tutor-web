import {useErrorToast} from "./Toast";
import {useRef, useState} from 'react';
import '../styles/inline-video.css';

export function InlineVideo({title, loadPlayback}: {title:string; loadPlayback:()=>Promise<string>}) {
  const [src,setSrc]=useState(''),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const pending=useRef(false);
  useErrorToast(error);
  async function play() {
    if(pending.current)return;
    pending.current=true;setLoading(true);setError('');
    try {setSrc(await loadPlayback());}
    catch {setError('视频加载失败，点击重试');}
    finally {pending.current=false;setLoading(false);}
  }
  return <div className={`inline-video${src ? "" : " inline-video--idle"}`}>
    {src ? <video src={src} controls playsInline autoPlay preload="metadata" aria-label={title}
      onError={()=>{setSrc('');setError('视频暂时无法播放，点击重试');}}/>
    : <button className="inline-video__cover" disabled={loading} onClick={()=>void play()} aria-label={`播放视频：${title}`}>
      <span className="inline-video__eyebrow">数学微课</span>
      <span className="inline-video__title">{title}</span>
      <span className="inline-video__play" aria-hidden="true">▶</span>
      <span className="inline-video__hint">{error ? '重新播放' : (loading?'正在加载视频…':'点击播放')}</span>
    </button>}
  </div>;
}
