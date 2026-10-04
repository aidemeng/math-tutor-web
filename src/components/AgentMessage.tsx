import { useApp, useStoreRevision } from '../store/AppContext';
import { Markdown } from './Markdown';
import { Icon } from './Icon';
import '../styles/chat.css';

interface AgentMessageProps {
  turnIndex: number;
  conversationId: string;
}

/** 助手回复：跟随对话轮次实时更新，流式输出时展示光标。 */
export function AgentMessage({ turnIndex, conversationId }: AgentMessageProps) {
  const { store } = useApp();
  useStoreRevision();

  if (!store || store.state.activeId !== conversationId) return null;
  const turn = store.state.turns[turnIndex];
  if (!turn) return null;

  const isLast = turnIndex === store.state.turns.length - 1;
  const streaming = store.state.busy && isLast;
  const label = streaming && turn.status ? turn.status : null;

  if (!turn.reply && !streaming) return null;

  return (
    <div className="agent">
      <span className="agent__avatar" aria-hidden="true">
        <Icon name="sparkle" size={15} />
      </span>
      <div className="agent__bubble">
        {turn.reply ? (
          <Markdown value={turn.reply} streaming={streaming} />
        ) : null}
        {streaming ? (
          <div className="agent__typing">
            <span className="agent__dot" />
            <span className="agent__dot" />
            <span className="agent__dot" />
            {label ? <span className="agent__status">{label}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
