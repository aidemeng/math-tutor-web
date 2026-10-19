import { useState } from "react";
import { questionView } from "../lib/questionView";
import { useApp, useStoreRevision } from "../store/AppContext";
import { Icon } from "./Icon";

/** 多题先比较摘要，完整题目在抽屉中阅读，不改变对话高度。 */
export function QuestionResults({
  questionKeys,
  onOpen,
}: {
  questionKeys: string[];
  onOpen(key: string): void;
}) {
  const { store } = useApp();
  useStoreRevision();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? questionKeys : questionKeys.slice(0, 2);
  return (
    <section
      className="question-list"
      aria-label={questionKeys.length === 1 ? "题目结果" : "可选题目"}
    >
      <header className="question-list__header">
        <strong>
          {questionKeys.length === 1 ? "题目结果" : "可选题目"}{" "}
          <span>{questionKeys.length} 道</span>
        </strong>
        <span>点击查看题目与解析</span>
      </header>
      <ul className="question-list__items">
        {visible.map((key) => {
          const raw = store?.question(key);
          if (!raw)
            return (
              <li key={key} className="question-list__loading">
                正在加载题目…
              </li>
            );
          const question = questionView(raw);
          return (
            <li key={key}>
              <button
                type="button"
                className="question-list__item"
                onClick={() => onOpen(key)}
              >
                <span className="question-list__info">
                  <span className="question-list__source">
                    {question.source}
                  </span>
                  <span className="question-list__title">{question.title}</span>
                  {question.variationNote ? (
                    <span className="question-list__variation">
                      {question.variationNote}
                    </span>
                  ) : null}
                  {!question.source.includes(question.kind) || question.level || question.review === "human" ? (
                    <span className="question-list__meta">
                      {!question.source.includes(question.kind) ? <span>{question.kind}</span> : null}
                      {question.level ? <span>{question.level}</span> : null}
                      {question.review === "human" ? <span>已复核</span> : null}
                    </span>
                  ) : null}
                </span>
                <Icon name="chevron" size={16} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      {questionKeys.length > 2 ? (
        <button
          type="button"
          className="question-list__more"
          aria-expanded={showAll}
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? "收起列表" : `查看其余 ${questionKeys.length - 2} 道题`}
          <Icon name={showAll ? "chevron-up" : "chevron-down"} size={16} />
        </button>
      ) : null}
    </section>
  );
}
