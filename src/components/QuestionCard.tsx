import { useMemo } from 'react';
import { questionView } from '../lib/questionView';
import { useApp, useStoreRevision } from '../store/AppContext';
import { Markdown } from './Markdown';
import { Icon } from './Icon';
import '../styles/card.css';

export type DeriveKind = 'similar' | 'variant' | 'easy';

interface QuestionCardProps {
  questionKey: string;
  onAnalysis(key: string): void;
  onDerive(kind: DeriveKind, key: string): void;
  onVideo(key: string): void;
  disabled?: boolean;
}

const DERIVE_ACTIONS: { kind: DeriveKind; label: string }[] = [
  { kind: 'similar', label: '相似题' },
  { kind: 'variant', label: '出变式' },
  { kind: 'easy', label: '降难度' },
];

export function QuestionCard({ questionKey, onAnalysis, onDerive, onVideo, disabled }: QuestionCardProps) {
  const { store } = useApp();
  useStoreRevision();

  const raw = store?.question(questionKey);
  const question = useMemo(() => {
    if (!raw) return null;
    try {
      return questionView(raw);
    } catch {
      return null;
    }
  }, [raw]);

  const isCurrent =
    !!question &&
    store?.state.currentQuestion?.id === question.id &&
    store.state.currentQuestion?.bankVersion === question.bankVersion;

  if (!question) {
    return (
      <article className="qcard qcard--loading">
        <div className="skeleton" style={{ height: 18, width: '42%' }} />
        <div className="skeleton" style={{ height: 14, width: '76%', marginTop: 12 }} />
        <div className="skeleton" style={{ height: 14, width: '90%', marginTop: 8 }} />
        <div className="skeleton" style={{ height: 40, marginTop: 18 }} />
      </article>
    );
  }

  const needsReview = question.review !== 'human';

  return (
    <article className={['qcard', isCurrent ? 'qcard--current' : ''].join(' ')}>
      <header className="qcard__head">
        <span className="pill pill--plain qcard__source">{question.source}</span>
        <span className={['pill', needsReview ? 'pill--warn' : 'pill--plain'].join(' ')}>
          {needsReview ? '待复核' : '已复核'}
        </span>
      </header>

      <h3 className="qcard__title">{question.title}</h3>

      <div className="qcard__tags">
        <span className="pill pill--plain">{question.kind}</span>
        <span className="pill pill--plain">{question.level}</span>
        {isCurrent ? <span className="pill">当前题目</span> : null}
      </div>

      <div className="qcard__stem">
        <Markdown value={question.stem} questionKey={questionKey} />
      </div>

      <div className="qcard__derive" role="group" aria-label="派生新题">
        {DERIVE_ACTIONS.map((action) => (
          <button
            key={action.kind}
            type="button"
            className="qcard__derive-btn"
            onClick={() => onDerive(action.kind, questionKey)}
            disabled={disabled}
          >
            {action.label}
          </button>
        ))}
      </div>

      <footer className="qcard__footer">
        <button
          type="button"
          className="btn btn--primary qcard__video"
          onClick={() => onVideo(questionKey)}
          disabled={disabled}
        >
          <Icon name="play" size={17} />
          生成讲解视频
        </button>
        <button
          type="button"
          className="btn btn--quiet qcard__analysis"
          onClick={() => onAnalysis(questionKey)}
        >
          查看解析
        </button>
      </footer>
    </article>
  );
}
