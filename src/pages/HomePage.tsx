import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendlyError } from '../api/errors';
import { ChatComposer } from '../components/ChatComposer';
import { Icon } from '../components/Icon';
import { toast } from '../components/Toast';
import type { PhotoPayload } from '../lib/photo';
import { formatRelative } from '../lib/time';
import { useApp, useStoreRevision } from '../store/AppContext';
import '../styles/home.css';

const EXAMPLES: { label: string; prompt: string; send: boolean }[] = [
  { label: '找一道二次函数最值题', prompt: '找一道二次函数最值题', send: true },
  { label: '给这道题出一道变式', prompt: '给这道题出一道变式：', send: false },
  { label: '把这道题讲得简单一点', prompt: '把这道题讲得简单一点：', send: false },
];

export function HomePage() {
  const { store } = useApp();
  useStoreRevision();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<PhotoPayload | null>(null);
  const [error, setError] = useState('');

  if (!store) return null;
  const busy = store.state.busy;
  const recent = store.state.conversations.slice(0, 3);

  function start(text: string, withPhoto: PhotoPayload | null) {
    if (!store) return;
    const content = text.trim();
    if (!content && !withPhoto) return;
    setDraft('');
    setPhoto(null);
    setError('');
    const running = store
      .send(content, {
        newConversation: true,
        ...(withPhoto ? { photo: withPhoto } : {}),
      })
      .catch((caught) => {
        const message = friendlyError(caught);
        setError(message);
        toast(message);
      });
    navigate('/chat');
    void running;
  }

  return (
    <main className="page page--tabbed home">
      <section className="home__hero">
        <h2 className="home__headline">今天准备讲哪道题？</h2>
        <p className="home__sub">输入题干或上传题目照片，一起备课</p>
      </section>

      <ChatComposer
        value={draft}
        photo={photo}
        busy={busy}
        onChange={setDraft}
        onPhotoChange={setPhoto}
        onSend={() => start(draft, photo)}
        onError={(message) => {
          setError(message);
          toast(message);
        }}
      />

      <section className="home__examples">
        <p className="home__section-label">试试这样问</p>
        <div className="home__chips">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              className="home__chip"
              disabled={busy}
              onClick={() => (example.send ? start(example.prompt, null) : setDraft(example.prompt))}
            >
              <span className="home__chip-text">{example.label}</span>
              <Icon name="chevron" size={15} />
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="notice notice--danger home__error" role="alert">
          <Icon name="alert" size={17} />
          <span>{error}</span>
        </div>
      ) : null}

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
