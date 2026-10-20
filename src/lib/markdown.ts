import DOMPurify, { type Config } from 'dompurify';
import katex, { type KatexOptions } from 'katex';
import { Marked, type Tokens } from 'marked';

/**
 * Markdown + LaTeX 渲染。
 *
 * - 公式交给 KaTeX（行内 `$...$` / `\(...\)`，独行 `$$...$$` / `\[...\]`）。
 * - Markdown 交给 marked，用自定义扩展直接产出公式 HTML，避免占位符二次替换的坑。
 * - 输出经 DOMPurify 净化，允许 MathML 与 SVG（KaTeX 的伸缩符号需要）。
 * - 题库配图保持相对路径，由组件在挂载后按需带上鉴权头取回。
 */

const katexOptions: KatexOptions = { throwOnError: false, strict: false, output: 'htmlAndMathml' };

function renderMath(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { ...katexOptions, displayMode });
  } catch (error) {
    const message = error instanceof Error ? error.message : '公式渲染失败';
    return `<span class="md-math-error" title="${message.replace(/"/g, '&quot;')}">${tex}</span>`;
  }
}

const isRelativeSrc = (href: string): boolean => !/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(href);

function createMarked(): Marked {
  const instance = new Marked();

  instance.use({
    gfm: true,
    breaks: true,
    extensions: [
      {
        name: 'blockMath',
        level: 'block',
        start(src: string) {
          const index = src.search(/\$\$|\\\[/);
          return index < 0 ? undefined : index;
        },
        tokenizer(src: string) {
          const match = /^(?:\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\])/.exec(src);
          if (!match) return undefined;
          return { type: 'blockMath', raw: match[0], text: (match[1] ?? match[2] ?? '').trim() } as never;
        },
        renderer(token: Tokens.Generic) {
          return `<div class="md-block-math">${renderMath(String(token.text), true)}</div>`;
        },
      },
      {
        name: 'inlineMath',
        level: 'inline',
        start(src: string) {
          const index = src.search(/\$|\\\(/);
          return index < 0 ? undefined : index;
        },
        tokenizer(src: string) {
          const match = /^(?:\$([^\n$]+?)\$|\\\(([\s\S]+?)\\\))/.exec(src);
          if (!match) return undefined;
          return { type: 'inlineMath', raw: match[0], text: (match[1] ?? match[2] ?? '').trim() } as never;
        },
        renderer(token: Tokens.Generic) {
          return `<span class="md-inline-math">${renderMath(String(token.text), false)}</span>`;
        },
      },
    ],
  });

  instance.use({
    renderer: {
      image(tokenOrHref: unknown, title?: string | null, text?: string) {
        const token =
          typeof tokenOrHref === 'string'
            ? { href: tokenOrHref, title: title ?? null, text: text ?? '' }
            : (tokenOrHref as { href?: string; title?: string | null; text?: string });
        const href = token.href ?? '';
        const alt = (token.text ?? '').replace(/"/g, '&quot;');
        const caption = token.title ? ` title="${String(token.title).replace(/"/g, '&quot;')}"` : '';
        if (isRelativeSrc(href)) {
          return `<img class="md-asset" data-asset="${href.replace(/"/g, '&quot;')}" alt="${alt}"${caption} />`;
        }
        return `<img class="md-img" src="${href}" alt="${alt}"${caption} loading="lazy" decoding="async" />`;
      },
      link(tokenOrHref: unknown, title?: string | null, text?: string) {
        const token =
          typeof tokenOrHref === 'string'
            ? { href: tokenOrHref, title: title ?? null, text: text ?? '' }
            : (tokenOrHref as { href?: string; title?: string | null; text?: string });
        const href = token.href ?? '';
        const label = token.text ?? href;
        const caption = token.title ? ` title="${String(token.title).replace(/"/g, '&quot;')}"` : '';
        const external = /^https?:/i.test(href);
        const attrs = external ? ' target="_blank" rel="noreferrer noopener"' : '';
        return `<a href="${href}"${caption}${attrs}>${label}</a>`;
      },
    },
  });

  return instance;
}

const marked = createMarked();

const PURIFY_CONFIG: Config = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
  ADD_ATTR: ['data-asset', 'aria-hidden'],
  FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick'],
};

/** 把 `\[..\]` / `\(..\)` 归一成 `$$..$$` / `$..$`。 */
function normalizeMathDelimiters(text: string): string {
  return text.replace(/\\\[([\s\S]*?)\\\]/g, (_match, tex: string) => `$$${tex}$$`).replace(
    /\\\(([\s\S]*?)\\\)/g,
    (_match, tex: string) => `$${tex}$`,
  );
}

/**
 * 渲染 Markdown 为可安全插入的 HTML。
 * @param streaming 流式输出中：未闭合的 `$$` 先按原文显示，避免闪出渲染错误。
 */
export function renderMarkdown(source: string, streaming = false): string {
  if (!source) return '';
  let text = normalizeMathDelimiters(source);
  if (streaming) {
    const fenceCount = (text.match(/\$\$/g) || []).length;
    if (fenceCount % 2 === 1) {
      const index = text.lastIndexOf('$$');
      text = `${text.slice(0, index)}${text.slice(index).replace(/\$\$/g, '\\$\\$')}`;
    }
  }
  const html = marked.parse(text, { async: false }) as string;
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

/** 从渲染结果中取出所有待鉴权加载的题库配图路径。 */
export function collectAssets(html: string): string[] {
  const found = new Set<string>();
  const pattern = /data-asset="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) found.add(match[1]);
  return [...found];
}
