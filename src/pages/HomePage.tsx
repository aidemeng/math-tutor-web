import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendlyError } from '../api/errors';
import { ChatComposer } from '../components/ChatComposer';
import { Icon } from '../components/Icon';
import { toast } from '../components/Toast';
import type { PhotoPayload } from '../lib/photo';
import { formatRelative } from '../lib/time';
import { useApp, useStoreRevision } from '../store/AppContext';
import '../styles/home.css';

const EXAMPLES = [
  { kind: '拍题解析', label: '拍一道题，找相似题或看解析', prompt: '' },
  { kind: '真题检索', label: '找一道用配方法求最值的中考真题', prompt: '找一道用配方法求最值的中考真题' },
  { kind: '方法微课', label: '讲讲“切线连半径”，配一道真题做成视频', prompt: '为九年级学生准备约2分钟的“切线连半径”方法微课：讲清何时连、为什么连和常见误区，配一道题库真题演示方法。先检索并精读题目与解析；没有合适例题就明确说明，不编造。保存讲解稿供我预览，确认后再制作视频。' },
];
const PHOTO_INTENTS = [
  {label: '看解析', prompt: '请识别这道题，先检索原题与参考解析；未匹配到原题时直接求解，给出完整解析。'},
  {label: '找相似题', prompt: '请识别这道题，检索题库中同考点、同方法的相似真题，并展示完整题卡。'},
];

export function HomePage() {
  const { store } = useApp();
  useStoreRevision();
  const navigate = useNavigate();
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<PhotoPayload | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  if (!store) return null;
  const busy = store.state.busy;
  const recent = store.state.conversations.slice(0, 3);

  function start(text: string, withPhoto: PhotoPayload | null) {
    if (!store) return;
    const content = text.trim();
    if (!content && !withPhoto) return;
    setDraft('');
    setPhoto(null);
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
        <h2 className="home__headline">今天准备讲什么？</h2>
        <p className="home__sub">找真题、看解析，也能准备方法微课</p>
      </section>

      <ChatComposer
        autoGrow={false}
        value={draft}
        photo={photo}
        busy={busy}
        onChange={setDraft}
        fileInputRef={photoInputRef}
        onPhotoChange={(next) => {setPhoto(next); if (next && !draft.trim()) setDraft(PHOTO_INTENTS[0].prompt);}}
        onSend={() => start(draft, photo)}
        onError={toast}
      />
      {photo ? <div className="home__photo-intents" role="group" aria-label="拍题用途">
        {PHOTO_INTENTS.map(intent => <button key={intent.label} type="button" disabled={busy} aria-pressed={draft === intent.prompt} onClick={() => setDraft(intent.prompt)}>{intent.label}</button>)}
      </div> : null}

      <section className="home__examples">
        <p className="home__section-label">试试这样问</p>
        <div className="home__chips">
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              className="home__chip"
              disabled={busy}
              onClick={() => example.prompt ? start(example.prompt, null) : photoInputRef.current?.click()}
            >
              <span className="home__chip-kind">{example.kind}</span>
              <span className="home__chip-text">{example.label}</span>
              <Icon name="chevron" size={15} />
            </button>
          ))}
        </div>
      </section>


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
