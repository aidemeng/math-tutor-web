import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { friendlyError } from '../api/errors';
import { Icon } from '../components/Icon';
import { toast } from '../components/Toast';
import { clock, dayLabel } from '../lib/time';
import { useApp, useStoreRevision } from '../store/AppContext';
import '../styles/history.css';

export function HistoryPage() {
  const { store } = useApp();
  const revision = useStoreRevision();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!store) return;
    setRefreshing(true);
    store
      .refreshConversations()
      .catch((caught) => toast(friendlyError(caught)))
      .finally(() => setRefreshing(false));
  }, [store]);

  const groups = useMemo(() => {
    if (!store) return [];
    const result: { label: string; items: { id: string; title: string; time: string }[] }[] = [];
    const index = new Map<string, (typeof result)[number]>();
    for (const conversation of store.state.conversations) {
      const stamp = conversation.updatedAt || conversation.createdAt;
      const label = dayLabel(stamp) || '更早';
      let group = index.get(label);
      if (!group) {
        group = { label, items: [] };
        index.set(label, group);
        result.push(group);
      }
      group.items.push({
        id: conversation.id,
        title: conversation.title || '备课对话',
        time: clock(stamp),
      });
    }
    return result;
  }, [store, revision, refreshing]);

  return (
    <main className="page history">
      {refreshing && !groups.length ? (
        <div className="history__skeleton">
          {[0, 1, 2, 3].map((key) => (
            <div key={key} className="skeleton" style={{ height: 54, borderRadius: 18 }} />
          ))}
        </div>
      ) : null}

      {!refreshing && !groups.length ? (
        <div className="empty">
          <span className="empty__icon">
            <Icon name="history" size={28} />
          </span>
          <p className="empty__title">还没有备课记录</p>
          <p className="empty__text">从首页发起一次对话，记录会出现在这里。</p>
          <button type="button" className="btn btn--quiet" style={{ marginTop: 14 }} onClick={() => navigate('/')}>
            去发起对话
          </button>
        </div>
      ) : null}

      {groups.map((group) => (
        <section className="history__group" key={group.label}>
          <p className="history__label">{group.label}</p>
          <ul className="history__list">
            {group.items.map((item) => (
              <li key={item.id}>
                <button type="button" className="history__item" onClick={() => navigate(`/chat/${item.id}`)}>
                  <span className="history__icon">
                    <Icon name="chat" size={16} />
                  </span>
                  <span className="history__title">{item.title}</span>
                  <span className="history__time">{item.time}</span>
                  <Icon name="chevron" size={15} className="history__arrow" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
