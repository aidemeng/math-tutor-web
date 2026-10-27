import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BookItem, BookKind } from "../api/types";
import { friendlyError } from "../api/errors";
import { useApp } from "../store/AppContext";
import { QuestionReader } from "../components/QuestionReader";
import { Sheet } from "../components/Sheet";
import { MistakeAnalysisDetail } from "../components/mistakes/MistakeAnalysisDetail";
import { MistakeSource } from "../components/mistakes/MistakeSource";
import { toast } from "../components/Toast";
import { questionView } from "../lib/questionView";
import { Markdown } from "../components/Markdown";
import "../styles/question-book.css";
import "../styles/mistakes.css";
import "../styles/card.css";

const categories: { kind: BookKind | ""; label: string }[] = [
  { kind: "", label: "全部" },
  { kind: "find", label: "找题练习" },
  { kind: "solve", label: "解题答疑" },
  { kind: "generate", label: "AI 出题" },
  { kind: "mistake", label: "错题分析" },
];
export function QuestionBookPage() {
  const { client, store } = useApp();
  const navigate = useNavigate();
  const [kind, setKind] = useState<BookKind | "">("");
  const [items, setItems] = useState<BookItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<BookItem | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [source, setSource] = useState(false);
  const [tab, setTab] = useState<"question" | "analysis">("question");
  const generation = useRef(0),
    detailGeneration = useRef(0),
    pending = useRef(false);
  useEffect(() => {
    const token = ++generation.current;
    detailGeneration.current++;
    setItems([]);
    setCursor(null);
    setSelected(null);
    setOpening(null);
    setLoading(true);
    setFailed(false);
    pending.current = true;
    client
      .listBookItems({ kind: kind || undefined })
      .then((result) => {
        if (token !== generation.current) return;
        setItems(result.items);
        setCursor(result.nextCursor);
      })
      .catch((error) => {
        if (token === generation.current) {
          setFailed(true);
          toast(friendlyError(error));
        }
      })
      .finally(() => {
        if (token === generation.current) {
          setLoading(false);
          pending.current = false;
        }
      });
    return () => {
      generation.current++;
      detailGeneration.current++;
    };
  }, [client, kind, retry]);
  async function more() {
    if (!cursor || pending.current) return;
    const token = generation.current;
    pending.current = true;
    setLoading(true);
    try {
      const result = await client.listBookItems({
        kind: kind || undefined,
        cursor,
      });
      if (token === generation.current) {
        setItems((current) => [
          ...current,
          ...result.items.filter(
            (row) => !current.some((item) => item.id === row.id),
          ),
        ]);
        setCursor(result.nextCursor);
      }
    } catch (error) {
      if (token === generation.current) toast(friendlyError(error));
    } finally {
      if (token === generation.current) {
        pending.current = false;
        setLoading(false);
      }
    }
  }
  async function open(item: BookItem) {
    const token = ++detailGeneration.current;
    setOpening(item.id);
    try {
      const value = await client.getBookItem(item.id);
      if (token !== detailGeneration.current) return;
      if (value.question) store?.rememberQuestion(value.question);
      setSelected(value);
      setSource(false);
      setTab("question");
    } catch (error) {
      if (token === detailGeneration.current) toast(friendlyError(error));
    } finally {
      if (token === detailGeneration.current) setOpening(null);
    }
  }
  function expandSolution() {
    if (!selected?.analysis) return;
    if (store?.state.busy) {
      toast("请等当前回复完成后再试");
      return;
    }
    const params = new URLSearchParams({
      bookItem: selected.id,
      mistakeAnalysisId: selected.analysis.id,
      mistakeAction: "expand",
    });
    navigate(`/chat/${selected.conversationId}?${params}`);
  }
  const q = selected?.question ? questionView(selected.question) : null;
  return (
    <main className="page question-book">
      <nav className="book-filters" aria-label="题目类型">
        {categories.map((item) => (
          <button
            type="button"
            key={item.kind}
            aria-pressed={kind === item.kind}
            onClick={() => setKind(item.kind)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="book-list" aria-busy={loading}>
        {items.map((item) => (
          <button
            type="button"
            className="book-row"
            key={item.id}
            onClick={() => void open(item)}
            disabled={opening === item.id}
          >
            <div className="book-row-heading">
              <h2>{item.title}</h2>
              <span className={`book-type book-type--${item.kind}`}>
                {
                  categories.find((category) => category.kind === item.kind)
                    ?.label
                }
              </span>
            </div>
            <div className="book-excerpt">
              <Markdown
                value={item.stem.replace(/!\[[^\]]*\]\([^)]*\)/g, "")}
              />
            </div>
          </button>
        ))}
      </div>
      {loading && !items.length && (
        <div className="book-loading" role="status">
          正在加载题目…
        </div>
      )}
      {!loading && !failed && !items.length && (
        <div className="empty">
          <p className="empty__title">
            {kind ? "还没有这类题目" : "题目本里还没有题目"}
          </p>
          <p className="empty__text">对话中展示的题目，会自动收录在这里。</p>
        </div>
      )}
      {failed && (
        <button
          className="book-text-button"
          onClick={() => setRetry((value) => value + 1)}
        >
          重新加载
        </button>
      )}
      {cursor && (
        <button
          className="book-text-button book-more"
          disabled={loading}
          onClick={() => void more()}
        >
          {loading ? "正在加载…" : "加载更多"}
        </button>
      )}
      <Sheet
        open={!!selected?.analysis}
        title={
          source ? "原题与作答" : selected?.analysis ? "错题分析" : "题目与解析"
        }
        onClose={() => {
          if (source) setSource(false);
          else setSelected(null);
        }}
      >
        {selected && (
          <div className="book-detail">
            {selected.analysis ? (
              source ? (
                <MistakeSource analysis={selected.analysis} client={client} />
              ) : (
                <MistakeAnalysisDetail
                  analysis={selected.analysis}
                  busy={!!store?.state.busy}
                  onOriginal={() => setSource(true)}
                  onExpand={expandSolution}
                />
              )
            ) : null}
          </div>
        )}
      </Sheet>
      <QuestionReader
        detail={q}
        readerTab={tab}
        setReaderTab={setTab}
        onClose={() => setSelected(null)}
      />
    </main>
  );
}
