import type { Question } from '../api/types';

/**
 * 在题目的配图清单里定位 Markdown 里的相对图片路径。
 * 绝对路径（含协议或前导斜杠）不属于题库配图，直接跳过。
 */
export function questionAssetIndex(raw: Question | undefined, target: string): number {
  if (!raw || !Array.isArray(raw.assets) || typeof target !== 'string' || /^(?:[a-z]+:|\/)/i.test(target)) {
    return -1;
  }
  const normalize = (value: string) => {
    const parts: string[] = [];
    for (const part of value.split('/')) {
      if (part === '.' || !part) continue;
      if (part === '..') parts.pop();
      else parts.push(part);
    }
    return parts.join('/');
  };
  const path = typeof raw.path === 'string' ? raw.path : '';
  const directory = path.slice(0, path.lastIndexOf('/') + 1);
  const resolved = normalize(directory + target);
  return (raw.assets as string[]).findIndex(
    (asset) => typeof asset === 'string' && (asset === resolved || asset === target),
  );
}
