import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { questionAssetIndex } from '../lib/questionAssets';
import { renderMarkdown } from '../lib/markdown';
import { useApp } from '../store/AppContext';
import '../styles/markdown.css';

interface MarkdownProps {
  value: string;
  /** 题库题卡 key，用于解析相对路径的题目配图。 */
  questionKey?: string;
  /** 流式输出中：未闭合公式先按原文显示，避免闪出渲染错误。 */
  streaming?: boolean;
  className?: string;
}

/**
 * 渲染 Markdown + LaTeX 内容。
 * 题库配图需要鉴权，因此先用 data-asset 占位，挂载后再取回并替换为 object URL。
 */
export function Markdown({ value, questionKey, streaming = false, className }: MarkdownProps) {
  const { store } = useApp();
  const html = useMemo(() => renderMarkdown(value, streaming), [value, streaming]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !store || !questionKey) return;

    const images = Array.from(root.querySelectorAll<HTMLImageElement>('img[data-asset]'));
    if (!images.length) return;

    let cancelled = false;
    for (const image of images) {
      const relative = image.getAttribute('data-asset');
      if (!relative) continue;
      const index = questionAssetIndex(store.question(questionKey), relative);
      if (index < 0) {
        image.classList.add('md-asset--missing');
        continue;
      }
      store
        .assetUrl(questionKey, index)
        .then((url) => {
          if (cancelled) return;
          image.classList.add('md-asset--loading');
          image.addEventListener(
            'load',
            () => {
              image.classList.remove('md-asset--loading');
              image.classList.add('md-asset--ready');
              if (image.naturalWidth <= 170 && image.naturalHeight <= 50) {
                image.classList.add('md-asset--inline');
              }
            },
            { once: true },
          );
          image.src = url;
        })
        .catch(() => {
          if (!cancelled) image.classList.add('md-asset--missing');
        });
    }

    return () => {
      cancelled = true;
    };
  }, [html, store, questionKey]);

  /** 点代码块复制到剪贴板。 */
  const onClick = useCallback(async (event: MouseEvent<HTMLDivElement>) => {
    const pre = (event.target as HTMLElement).closest('pre');
    if (!pre) return;
    const text = pre.innerText;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* 剪贴板不可用时静默忽略 */
    }
  }, []);

  return (
    <>
      <div
        ref={containerRef}
        className={['md', className].filter(Boolean).join(' ')}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {copied ? (
        <span className="md-copy-toast" role="status">
          已复制
        </span>
      ) : null}
    </>
  );
}
