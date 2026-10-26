// Generated from math-tutor-service/shared/mistake-content.ts
/** Repair common model formatting artifacts in mistake reports, including old records. */
export function normalizeMistakeText(value: string): string {
  return value
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, index) => {
      if (index % 2) return part;
      const text = part.replace(
        /\\{2,}(?=[()[\]]|(?:pi|frac|dfrac|tfrac|times|cdot|approx|sqrt|left|right|text|mathrm|mathbf|operatorname|par)\b)/g,
        '\\',
      );
      // A TeX paragraph command is prose markup, not a printable escape sequence.
      return text.replace(
        /(\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\])|\\par\b/g,
        (_match, math) => math || '\n\n',
      );
    })
    .join('');
}

export function normalizeMistakeContent<T>(value: T): T {
  if (typeof value === 'string') return normalizeMistakeText(value) as T;
  if (Array.isArray(value)) return value.map(normalizeMistakeContent) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeMistakeContent(item)]),
    ) as T;
  return value;
}
