const normalized = (text: string) =>
  text.normalize("NFKC").replace(/[\s\u200b-\u200d\ufeff]/g, "");
/** Skip missing/ambiguous anchors rather than attach an explanation to the wrong step. */
export function annotationTarget(blocks: string[], quote: string): number {
  const needle = normalized(quote);
  if (!needle) return -1;
  const candidates = blocks
    .map((text, index) => ({ text: normalized(text), index }))
    .filter((b) => b.text.includes(needle))
    .sort((a, b) => a.text.length - b.text.length);
  if (
    !candidates.length ||
    candidates[1]?.text.length === candidates[0].text.length
  )
    return -1;
  return candidates[0].index;
}

/** Mark the quoted content itself; formulas remain an indivisible unit. */
export function wrapAnnotationQuote(block: HTMLElement, quote: string): HTMLElement | null {
  const needle = normalized(quote);
  if (!needle) return null;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.parentElement?.closest(".katex-mathml,.annotation-slot")
      ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const positions: {node: Text; start: number; end: number}[] = [];
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    let offset = 0;
    for (const char of node.textContent ?? "") {
      const begin = offset;
      offset += char.length;
      const part = normalized(char);
      text += part;
      for (let i = 0; i < part.length; i++) positions.push({node: node as Text, start: begin, end: offset});
    }
  }
  const start = text.indexOf(needle);
  if (start < 0 || text.indexOf(needle, start + 1) >= 0) return null;
  const first = positions[start], last = positions[start + needle.length - 1];
  if (!first || !last) return null;
  const range = document.createRange();
  const firstMath = first.node.parentElement?.closest(".md-inline-math,.md-block-math");
  const lastMath = last.node.parentElement?.closest(".md-inline-math,.md-block-math");
  if (firstMath && firstMath !== block && block.contains(firstMath)) range.setStartBefore(firstMath);
  else range.setStart(first.node, first.start);
  if (lastMath && lastMath !== block && block.contains(lastMath)) range.setEndAfter(lastMath);
  else range.setEnd(last.node, last.end);
  if (firstMath === block || lastMath === block) range.selectNodeContents(block);
  // Merge overlapping highlights, including quotes expanded to a whole formula.
  // Keep the full existing range so neither annotation loses its original text.
  const overlaps = Array.from(block.querySelectorAll(".annotation-anchor"))
    .filter(node => range.intersectsNode(node));
  for (const node of overlaps) {
    const existing = document.createRange();
    existing.selectNode(node);
    if (range.compareBoundaryPoints(Range.START_TO_START, existing) > 0)
      range.setStartBefore(node);
    if (range.compareBoundaryPoints(Range.END_TO_END, existing) < 0)
      range.setEndAfter(node);
  }
  // Unwrap first to avoid nesting interactive spans inside the merged anchor.
  for (const node of overlaps)
    node.replaceWith(...Array.from(node.childNodes));
  const anchor = document.createElement("span");
  anchor.className = "annotation-anchor";
  anchor.append(range.extractContents());
  range.insertNode(anchor);
  return anchor;
}
