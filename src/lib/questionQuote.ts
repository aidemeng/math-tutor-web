export type QuestionQuote = {
  questionId: string;
  bankVersion: string;
  source: string;
  section: "question" | "analysis";
  text: string;
};

export function quotedQuestionMessage(quote: QuestionQuote, question: string) {
  return `引用${quote.section === "question" ? "题目" : "解析"}（${quote.source}）：\n${quote.text.split("\n").map((line) => `> ${line}`).join("\n")}\n\n${question}`;
}

/** Read the original DOM so partial KaTeX selections still carry one complete formula. */
export function selectedQuestionText(source: HTMLElement, selection: Selection | null) {
  if (!selection || selection.isCollapsed || !selection.rangeCount) return "";
  const range = selection.getRangeAt(0);
  if (!source.contains(range.startContainer) || !source.contains(range.endContainer)) return "";
  function read(node: Node): string {
    if (!range.intersectsNode(node)) return "";
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      return text.slice(node === range.startContainer ? range.startOffset : 0,
        node === range.endContainer ? range.endOffset : text.length);
    }
    if (!(node instanceof Element)) return "";
    if (node.matches(".annotation-slot,button,.katex-mathml")) return "";
    const originalMath = node.getAttribute("data-math-tex");
    if (originalMath !== null) return `$${originalMath}$`;
    if (node.matches(".katex")) {
      const tex = node.querySelector('annotation[encoding="application/x-tex"]')?.textContent;
      return tex ? `$${tex}$` : node.textContent || "";
    }
    if (node.tagName === "BR") return "\n";
    const text = Array.from(node.childNodes).map(read).join("");
    return /^(P|LI|H[1-6]|DIV)$/.test(node.tagName) ? `${text}\n` : text;
  }
  return read(source).replace(/\n{3,}/g, "\n\n").trim();
}
