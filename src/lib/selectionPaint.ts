export type SelectionRect = {left: number; top: number; width: number; height: number};

/** Join text fragments on the same line, without joining adjacent lines. */
export function mergeSelectionRects(rects: SelectionRect[]): SelectionRect[] {
  const lines: SelectionRect[] = [];
  for (const rect of rects.filter(r => r.width > 0 && r.height > 0).sort((a, b) => a.top - b.top || a.left - b.left)) {
    const line = lines.find(r => Math.min(r.top + r.height, rect.top + rect.height) - Math.max(r.top, rect.top) >= Math.min(r.height, rect.height) * .5);
    if (!line) {lines.push({...rect}); continue;}
    const right = Math.max(line.left + line.width, rect.left + rect.width);
    const bottom = Math.max(line.top + line.height, rect.top + rect.height);
    line.left = Math.min(line.left, rect.left);
    line.top = Math.min(line.top, rect.top);
    line.width = right - line.left;
    line.height = bottom - line.top;
  }
  return lines;
}

export function selectionPaint(source: HTMLElement, selection: Selection): SelectionRect[] {
  const range = selection.getRangeAt(0);
  const rects: SelectionRect[] = [];
  const bounds = new WeakMap<Element, {left: number; right: number; top: number; bottom: number}>();
  const clippingBounds = (owner: Element) => {
    const cached = bounds.get(owner);
    if (cached) return cached;
    let left = 0, right = window.innerWidth, top = 0, bottom = window.innerHeight;
    // Formula scrollers can be narrower than the sheet; intersect every clipping
    // ancestor, not just the outer reader's vertical bounds.
    for (let element: Element | null = owner; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      const clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX);
      const clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
      if (!clipX && !clipY) continue;
      const box = element.getBoundingClientRect();
      const innerLeft = box.left + element.clientLeft;
      const innerTop = box.top + element.clientTop;
      if (clipX) {left = Math.max(left, innerLeft); right = Math.min(right, innerLeft + element.clientWidth);}
      if (clipY) {top = Math.max(top, innerTop); bottom = Math.min(bottom, innerTop + element.clientHeight);}
    }
    const result = {left, right, top, bottom};
    bounds.set(owner, result);
    return result;
  };
  const add = (rect: DOMRect, owner: Element) => {
    if (!rect.width || !rect.height) return;
    const clip = clippingBounds(owner);
    const left = Math.max(rect.left, clip.left), right = Math.min(rect.right, clip.right);
    const top = Math.max(rect.top - 2, clip.top), bottom = Math.min(rect.bottom + 2, clip.bottom);
    if (right > left && bottom > top) rects.push({left, top, width: right - left, height: bottom - top});
  };
  function visit(node: Node) {
    if (!range.intersectsNode(node)) return;
    if (node instanceof Element) {
      if (node.matches(".annotation-slot,button,.katex-mathml")) return;
      if (node.hasAttribute("data-math-tex")) {
        // Use the full formula box, rather than KaTeX's individual glyph boxes.
        const parts = node.querySelectorAll(".katex-html > .katex-base, .katex-html > .base");
        if (parts.length) parts.forEach(part => Array.from(part.getClientRects()).forEach(rect => add(rect, node)));
        else Array.from((node.querySelector(".katex-html") ?? node).getClientRects()).forEach(rect => add(rect, node));
        return;
      }
      node.childNodes.forEach(visit);
    } else if (node.nodeType === Node.TEXT_NODE) {
      const part = document.createRange();
      part.setStart(node, node === range.startContainer ? range.startOffset : 0);
      part.setEnd(node, node === range.endContainer ? range.endOffset : (node.textContent?.length ?? 0));
      if (node.parentElement) Array.from(part.getClientRects()).forEach(rect => add(rect, node.parentElement!));
    }
  }
  visit(source);
  return mergeSelectionRects(rects);
}
