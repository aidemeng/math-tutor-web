import { useState, type FormEvent } from 'react';
import { API_BASE_URL } from '../api/client';
import { friendlyError } from '../api/errors';
import { Icon } from '../components/Icon';
import { useApp } from '../store/AppContext';
import '../styles/login.css';

const PREVIEW_ITEMS = [
  { icon: 'book' as const, title: '找真题与相似题', text: '输入题干或拍下题目，检索题库里的匹配真题。' },
  { icon: 'sparkle' as const, title: '出变式 · 降难度', text: '在题卡上直接派生新题，保留完整题干与解析。' },
  { icon: 'video' as const, title: '生成讲解视频', text: '一键排入后台制作队列，回到对话继续备课。' },
];

export function LoginPage() {
  const { login, error } = useApp();
  const [name, setName] = useState('');
  const [secret, setSecret] = useState(String(import.meta.env.VITE_DEV_LOGIN_SECRET || ''));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setMessage('请先填写老师称呼');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await login(name, secret);
    } catch (caught) {
      setMessage(friendlyError(caught));
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login__hero">
        <span className="login__logo">
          <Icon name="sparkle" size={26} />
        </span>
        <h1 className="login__title">数学备课助手</h1>
        <p className="login__subtitle">找真题 · 出变式 · 降难度 · 生成讲解视频</p>
      </div>

      <form className="login__card" onSubmit={submit}>
        <label className="field-label" htmlFor="teacher-name">
          老师称呼
        </label>
        <input
          id="teacher-name"
          className="field"
          value={name}
          maxLength={60}
          autoComplete="nickname"
          placeholder="例如：高二数学 · 王老师"
          onChange={(event) => setName(event.target.value)}
        />

        <label className="field-label" htmlFor="dev-secret" style={{ marginTop: 18 }}>
          开发登录密钥
        </label>
        <input
          id="dev-secret"
          className="field"
          type="password"
          value={secret}
          autoComplete="off"
          placeholder="后端 .dev.vars 中的 DEV_LOGIN_SECRET"
          onChange={(event) => setSecret(event.target.value)}
        />
        <p className="field-hint">
          当前后端只开放微信小程序登录与开发登录。开发登录仅在服务端 <code>APP_ENV=development</code>{' '}
          时可用，正式环境请由运营方接入网页登录。
        </p>

        {message ? (
          <div className="notice notice--danger login__notice" role="alert">
            <Icon name="alert" size={17} />
            <span>{message}</span>
          </div>
        ) : null}
        {error && !message ? (
          <div className="notice notice--danger login__notice" role="alert">
            <Icon name="alert" size={17} />
            <span>{error}</span>
          </div>
        ) : null}

        <button type="submit" className="btn btn--primary btn--block login__submit" disabled={busy}>
          {busy ? '正在登录…' : '进入备课'}
        </button>

        <p className="login__endpoint">
          服务地址：<code>{API_BASE_URL || '同源（/v1 由当前站点代理）'}</code>
        </p>
      </form>

      <ul className="login__features">
        {PREVIEW_ITEMS.map((item) => (
          <li key={item.title} className="login__feature">
            <span className="login__feature-icon">
              <Icon name={item.icon} size={17} />
            </span>
            <div>
              <p className="login__feature-title">{item.title}</p>
              <p className="login__feature-text">{item.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
