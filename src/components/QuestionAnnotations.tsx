import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { TutorClient } from "../api/client";
import type {
  QuestionView,
  QuestionAnnotation,
  TeachingGuide,
} from "../api/types";
import { friendlyError } from "../api/errors";
import { annotationTarget, wrapAnnotationQuote } from "../lib/questionAnnotations";
import { selectedQuestionText } from "../lib/questionQuote";
import { selectionPaint, type SelectionRect } from "../lib/selectionPaint";
import { renderMarkdown } from "../lib/markdown";
import { Markdown } from "./Markdown";
import { Icon } from "./Icon";
import { toast } from "./Toast";
import "../styles/question-annotations.css";

type Marker = {
  element: HTMLElement;
  notes: QuestionAnnotation[];
};
function visibleText(node: HTMLElement) {
  const copy = node.cloneNode(true) as HTMLElement;
  copy
    .querySelectorAll(".katex-mathml,.annotation-slot")
    .forEach((e) => e.remove());
  return copy.textContent || "";
}
function quoteText(quote: string, source?: string) {
  const node = document.createElement("div");
  // Render in the original Markdown context: an isolated clause may contain
  // only half of a **bold** or *italic* pair.
  const start = source?.indexOf(quote) ?? -1;
  if (source && start >= 0 && source.indexOf(quote, start + 1) < 0) {
    const end = start + quote.length;
    const boundary = crypto.randomUUID();
    node.innerHTML = renderMarkdown(
      source.slice(0, start) + `<span data-annotation-boundary="start-${boundary}"></span>` +
      source.slice(start, end) + `<span data-annotation-boundary="end-${boundary}"></span>` + source.slice(end),
    );
    const from = node.querySelector(`[data-annotation-boundary="start-${boundary}"]`);
    const to = node.querySelector(`[data-annotation-boundary="end-${boundary}"]`);
    if (from && to && (from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      const range = document.createRange();
      range.setStartAfter(from);
      range.setEndBefore(to);
      const fragment = document.createElement("div");
      fragment.append(range.cloneContents());
      return visibleText(fragment);
    }
  }
  node.innerHTML = renderMarkdown(quote);
  return visibleText(node);
}

export function QuestionAnnotations({
  question,
  section,
  client,
  actionsTarget,
  onQuote,
  children,
}: {
  question: QuestionView;
  section: "question" | "analysis";
  client: TutorClient;
  actionsTarget: HTMLElement | null;
  onQuote(text: string): void;
  children: ReactNode;
}) {
  const [guide, setGuide] = useState<TeachingGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [active, setActive] = useState<Marker | null>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [selectionAction, setSelectionAction] = useState<{text: string; rects: SelectionRect[]} | null>(null);
  const root = useRef<HTMLDivElement>(null),
    popover = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLElement | null>(null),
    alive = useRef(true);
  const working = submitting || guide?.status === "generating";
  useEffect(() => {
    const update = () => {
      const source = root.current?.querySelector<HTMLElement>(
        section === "question" ? ".qcard__stem .md" : ".question-reader__analysis .md",
      );
      const selection = window.getSelection();
      const text = source ? selectedQuestionText(source, selection) : "";
      if (!text || text.length > 1500 || !selection || !source) {setSelectionAction(null); return;}
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      if (!rect.width && !rect.height) {setSelectionAction(null); return;}
      setActive(null);
      setSelectionAction({text, rects: selectionPaint(source, selection)});
    };
    let timer: ReturnType<typeof setTimeout>;
    const changed = () => {clearTimeout(timer); timer = setTimeout(update, 160);};
    const clear = () => setSelectionAction(null);
    document.addEventListener("selectionchange", changed);
    window.addEventListener("scroll", clear, true);
    window.addEventListener("resize", clear);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", changed);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
      setSelectionAction(null);
    };
  }, [section, question.key]);
  useEffect(() => {
    alive.current = true;
    let current = true;
    void client
      .getTeachingGuide(question.id, question.bankVersion, "")
      .then(({ guide }) => {
        if (current) setGuide(guide);
      })
      .catch((e) => {
        if (current) toast(friendlyError(e));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      alive.current = false;
    };
  }, [client, question.id, question.bankVersion]);
  useEffect(() => {
    if (guide?.status !== "generating") return;
    let stopped = false,
      timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const { guide: next } = await client.getTeachingGuide(
          question.id,
          question.bankVersion,
          "",
        );
        if (stopped) return;
        if (next) {
          setGuide(next);
          if (next.status === "failed") toast("批注未完成，可以重试");
          if (next.status !== "generating") return;
        }
      } catch {
        /* Keep the background job when a polling request fails. */
      }
      if (!stopped) timer = setTimeout(poll, 2500);
    };
    timer = setTimeout(poll, 1500);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [client, question.id, question.bankVersion, guide?.id, guide?.status]);
  useLayoutEffect(() => {
    setActive(null);
    const region = root.current;
    if (!region) return;
    const source =
      section === "question"
        ? region.querySelector(".qcard__stem .md")
        : region.querySelector(".question-reader__analysis .md");
    const blocks = Array.from(
      source?.querySelectorAll<HTMLElement>("p,li,.md-block-math,h2,h3") ?? [],
    );
    const texts = blocks.map(visibleText);
    const grouped = new Map<string, {element: HTMLElement; quote: string; notes: QuestionAnnotation[]}>();
    for (const note of guide?.content?.annotations ?? []) {
      if (note.section !== section) continue;
      let quote = quoteText(note.quote, section === "question" ? question.stem : question.explanation || question.answer);
      let index = annotationTarget(texts, quote);
      // List prefixes or HTML boundaries can make inserted markers alter parsing.
      // Keep the original rendering as a fallback when it has an exact match.
      if (index < 0) {
        quote = quoteText(note.quote);
        index = annotationTarget(texts, quote);
      }
      if (index < 0) continue;
      const block = blocks[index];
      const key = `${index}:${quote}`;
      const entry = grouped.get(key);
      if (entry) entry.notes.push(note);
      else grouped.set(key, {element: block, quote, notes: [note]});
    }
    const next: Marker[] = [];
    for (const {element, quote, notes} of grouped.values()) {
      const anchor = wrapAnnotationQuote(element, quote);
      if (!anchor) continue;
      // The wrapper replaces overlapping anchors. Transfer every explanation to
      // the merged marker instead of leaving notes on detached DOM elements.
      const replaced = next.filter(marker => !region.contains(marker.element));
      const mergedNotes = [...replaced.flatMap(marker => marker.notes), ...notes];
      for (let i = next.length - 1; i >= 0; i--)
        if (!region.contains(next[i].element)) next.splice(i, 1);
      anchor.setAttribute("role", "button");
      anchor.tabIndex = 0;
      anchor.setAttribute("aria-label", `查看批注：${mergedNotes[0].title}`);
      anchor.setAttribute("aria-haspopup", "dialog");
      anchor.setAttribute("aria-expanded", "false");
      next.push({ element: anchor, notes: mergedNotes });
    }
    next.sort((a, b) => a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    setMarkers(next);
    return () => {
      next.forEach((m) => {
        m.element.replaceWith(...Array.from(m.element.childNodes));
      });
      blocks.forEach(element => element.normalize());
    };
  }, [
    guide?.content,
    section,
    question.key,
    question.stem,
    question.explanation,
  ]);
  function close(restore = false) {
    setActive(null);
    if (restore) trigger.current?.focus();
  }
  useEffect(() => {
    const disposers = markers.map(marker => {
      const click = () => {
        // Dragging to quote annotated text should not also open its explanation.
        if (window.getSelection()?.isCollapsed === false) return;
        open(marker, marker.element);
      };
      const key = (event: KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(marker, marker.element);
        }
      };
      marker.element.addEventListener("click", click);
      marker.element.addEventListener("keydown", key);
      return () => {
        marker.element.removeEventListener("click", click);
        marker.element.removeEventListener("keydown", key);
      };
    });
    return () => disposers.forEach(dispose => dispose());
  }, [markers, active]);
  useEffect(() => {
    if (!active) return;
    active.element.classList.add("annotation-anchor--active");
    active.element.setAttribute("aria-expanded", "true");
    popover.current?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => {
      if (
        !popover.current?.contains(event.target as Node) &&
        !active.element.contains(event.target as Node)
      )
        close();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    const scroll = (event: Event) => {
      if (!popover.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", closeOnResize);
    function closeOnResize() {
      close();
    }
    return () => {
      active.element.classList.remove("annotation-anchor--active");
      active.element.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", closeOnResize);
    };
  }, [active]);
  function open(marker: Marker, button: HTMLElement) {
    if (active === marker) {
      close();
      return;
    }
    trigger.current = button;
    const rect = button.getBoundingClientRect();
    const sheet = button.closest(".sheet")?.getBoundingClientRect();
    const leftEdge = Math.max(16, (sheet?.left ?? 0) + 12);
    const rightEdge = Math.min(
      window.innerWidth - 16,
      (sheet?.right ?? window.innerWidth) - 12,
    );
    const width = Math.min(340, rightEdge - leftEdge);
    setPosition({
      left: Math.max(leftEdge, Math.min(rect.right - width, rightEdge - width)),
      top: Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - 300)),
    });
    setActive(marker);
  }
  async function generate() {
    if (working) return;
    setSubmitting(true);
    try {
      const { guide } = await client.generateTeachingGuide({
        questionId: question.id,
        bankVersion: question.bankVersion,
        studentContext: "",
        regenerate: true,
      });
      if (alive.current) setGuide(guide);
    } catch (e) {
      if (alive.current) toast(friendlyError(e));
    } finally {
      if (alive.current) setSubmitting(false);
    }
  }
  const notes = guide?.content?.annotations ?? [];
  const ready = notes.length > 0;
  const quoteTarget = root.current?.closest('.sheet')?.querySelector('.sheet__footer');
  return (
    <div className={`annotation-reader${selectionAction?.rects.length ? " annotation-reader--selecting" : ""}${active ? " annotation-reader--has-active" : ""}`}>
      {actionsTarget && createPortal(
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading || working}
          className="annotation-reader__generate"
          aria-label={working ? "正在生成批注" : ready ? "重新生成批注" : "生成 AI 批注"}
          title={ready ? "重新生成批注" : "解释原文中的关键步骤"}
          aria-busy={working}
        >
          {working
            ? "生成中"
            : "AI 批注"}
        </button>
      , actionsTarget)}
      <div ref={root}>{children}</div>
      {selectionAction && createPortal(
        <div className="question-selection-paint" aria-hidden="true">
          {selectionAction.rects.map((rect, index) => <span key={index} style={rect} />)}
        </div>, document.body)}
      {selectionAction && quoteTarget && createPortal(
        <button type="button" className="btn btn--primary qcard__video question-selection-action"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            onQuote(selectionAction.text);
            window.getSelection()?.removeAllRanges();
            setSelectionAction(null);
          }}>
          <Icon name="chat" size={20} />引用提问
        </button>, quoteTarget)}
      {active
        ? createPortal(
            <div
              ref={popover}
              className="annotation-popover"
              role="dialog"
              aria-label="思路批注"
              tabIndex={-1}
              style={{
                ...position,
                maxHeight: Math.min(
                  360,
                  window.innerHeight - position.top - 16,
                ),
              }}
            >
              <div className="annotation-popover__header">
                <span>思路批注</span>
                <button
                  type="button"
                  onClick={() => close(true)}
                  aria-label="关闭批注"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              {active.notes.map((note, index) => (
                <section key={index}>
                  <div className="annotation-popover__title" role="heading" aria-level={4}>
                    <Markdown value={note.title} />
                  </div>
                  <Markdown value={note.explanation} />
                </section>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
