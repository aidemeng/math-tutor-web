import { useState, type FormEvent } from 'react';
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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim() || !password) {
      setMessage('请填写账号和密码');
      return;
    }
    if(registering && password!==confirmation){setMessage('两次输入的密码不一致');return;}
    setBusy(true);
    setMessage(null);
    try {
      await login(username, password, registering);
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
        <h2 className="login__form-title">{registering?'注册教师账号':'欢迎回来'}</h2>
        <label className="field-label" htmlFor="username">登录账号</label>
        <input id="username" className="field" value={username} required minLength={4} maxLength={32} pattern="[a-zA-Z0-9][a-zA-Z0-9_.-]*" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="4–32 位字母、数字、下划线或点" onChange={event=>setUsername(event.target.value)} />
        <label className="field-label" htmlFor="password" style={{marginTop:18}}>密码</label>
        <input id="password" className="field" type="password" value={password} required minLength={10} maxLength={128} autoComplete={registering?'new-password':'current-password'} placeholder="至少 10 个字符" onChange={event=>setPassword(event.target.value)} />
        {registering?<>
          <label className="field-label" htmlFor="password-confirm" style={{marginTop:18}}>确认密码</label>
          <input id="password-confirm" className="field" type="password" value={confirmation} required minLength={10} maxLength={128} autoComplete="new-password" placeholder="再次输入密码" onChange={event=>setConfirmation(event.target.value)} />
        </>:null}
        {registering?<p className="field-hint">请记住账号和密码，下次登录后可继续查看备课记录和视频。</p>:null}

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
          {busy ? (registering?'正在注册…':'正在登录…') : (registering?'注册并开始备课':'登录并进入备课')}
        </button>

        <button type="button" className="login__switch" disabled={busy} onClick={()=>{setRegistering(value=>!value);setMessage(null);setPassword('');setConfirmation('');}}>{registering?'已有账号？去登录':'还没有账号？免费注册'}</button>
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
