import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendlyError } from '../api/errors';
import { ChatComposer } from '../components/ChatComposer';
import { Icon } from '../components/Icon';
import { COMPOSER_INTENTS as INTENTS, type ComposerIntentId as IntentId } from '../lib/composerIntents';
import { toast } from '../components/Toast';
import type { PhotoPayload } from '../lib/photo';
import { formatRelative } from '../lib/time';
import { useApp, useStoreRevision } from '../store/AppContext';
import '../styles/home.css';

const ENTRIES: {intent: IntentId; title: string}[] = [
  {intent: 'search', title: '智能找题'},
  {intent: 'diagnosis', title: '错题分析'},
  {intent: 'analysis', title: '解题讲解'},
  {intent: 'method', title: '方法微课'},
];

export function HomePage() {
  const { store } = useApp();
  useStoreRevision();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<PhotoPayload | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedIntent, setSelectedIntent] = useState<IntentId | null>(null);
  const preset = useRef('');

  if (!store) return null;
  const busy = store.state.busy;
  const recent = store.state.conversations.slice(0, 3);

  function selectIntent(intent: IntentId) {
    // Replace only the preset we inserted, preserving the teacher's additions.
    const supplement = preset.current && draft.startsWith(preset.current)
      ? draft.slice(preset.current.length).trimStart()
      : draft.trim();
    const prompt = INTENTS[intent].prompt;
    const next = [prompt, supplement].filter(Boolean).join('\n');
    if (next.length > 4000) {
      toast('输入内容较长，请先精简一些文字再切换用途');
      return;
    }
    preset.current = prompt;
    setSelectedIntent(intent);
    setDraft(next);
    requestAnimationFrame(() => composerInputRef.current?.focus());
  }

  function start(text: string, withPhoto: PhotoPayload | null) {
    if (!store) return;
    const content = text.trim();
    if (!content && !withPhoto) return;
    setDraft('');
    setPhoto(null);
    setSelectedIntent(null);
    preset.current = '';
    const running = store
      .send(content, {
        newConversation: true,
        ...(withPhoto ? { photo: withPhoto } : {}),
      })
      .catch((caught) => {
        const message = friendlyError(caught);
        toast(message);
      });
    navigate('/chat');
    void running;
  }

  return (
    <main className="page page--tabbed home">
      <section className="home__hero">
        <h2 className="home__headline">今天想准备什么？</h2>
        <p className="home__sub">找题练习、分析错题，理解解题思路</p>
      </section>

      <div className="home__input">
      <ChatComposer
        inputRef={composerInputRef}
        autoGrow={false}
        fixedRows={2}
        value={draft}
        photo={photo}
        busy={busy}
        onChange={(value) => {
          setDraft(value);
          if (!value.trim()) {
            preset.current = '';
            setSelectedIntent(null);
          }
        }}
        fileInputRef={photoInputRef}
        placeholder="输入需求，或上传题目与学生作答"
        onPhotoChange={(next) => {
          setPhoto(next);
          if (next && !draft.trim()) selectIntent(selectedIntent ?? 'analysis');
        }}
        onSend={() => start(draft, photo)}
        onError={toast}
      />
        <div className="home__intents" role="group" aria-label="备课用途">
          {ENTRIES.map(entry => (
            <button key={entry.intent} type="button" disabled={busy}
              aria-pressed={selectedIntent === entry.intent} onClick={() => selectIntent(entry.intent)}>
              {entry.title}
            </button>
          ))}
        </div>
      </div>

      {recent.length ? (
        <section className="home__recent">
          <div className="home__section-head">
            <p className="home__section-label" style={{ margin: 0 }}>
              最近备课
            </p>
            <button type="button" className="home__more" onClick={() => navigate('/history')}>
              全部记录
              <Icon name="chevron" size={14} />
            </button>
          </div>
          <ul className="home__recent-list">
            {recent.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  className="home__recent-item"
                  onClick={() => navigate(`/chat/${conversation.id}`)}
                >
                  <span className="home__recent-icon">
                    <Icon name="chat" size={16} />
                  </span>
                  <span className="home__recent-title">{conversation.title || '备课对话'}</span>
                  <span className="home__recent-time">
                    {formatRelative(conversation.updatedAt || conversation.createdAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
