import { useApp, useStoreRevision } from "../store/AppContext";
import { Markdown } from "./Markdown";
import { BrandLogo } from "./BrandLogo";
import "../styles/chat.css";
import {Children, type ReactNode} from "react";

interface AgentMessageProps {
  turnIndex: number;
  conversationId: string;
  children?: ReactNode;
}

/** 助手回复：跟随对话轮次实时更新，流式输出时展示光标。 */
export function AgentMessage({
  turnIndex,
  conversationId,
  children,
}: AgentMessageProps) {
  const { store } = useApp();
  useStoreRevision();

  if (!store || store.state.activeId !== conversationId) return null;
  const turn = store.state.turns[turnIndex];
  if (!turn) return null;

  const isLast = turnIndex === store.state.turns.length - 1;
  const streaming = store.state.busy && isLast;
  const label = streaming && turn.status ? turn.status : null;

  const hasContent = Children.toArray(children).length > 0;
  const redundantReply =
    hasContent &&
    /^题目已找到[，,]\s*解析和后续操作见题卡[。.]?$/.test(turn.reply.trim());
  const reply = redundantReply ? "" : turn.reply;
  if (!reply && !streaming && !hasContent) return null;

  return (
    <div className="agent">
      <span className="agent__avatar" aria-hidden="true">
        <BrandLogo size={26} />
      </span>
      <div className="agent__content">
        {reply || streaming ? (
          <div className="agent__bubble">
            {reply ? <Markdown value={reply} streaming={streaming} /> : null}
            {streaming ? (
              <div className="agent__typing">
                <span className="agent__dot" />
                <span className="agent__dot" />
                <span className="agent__dot" />
                {label ? <span className="agent__status">{label}</span> : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
