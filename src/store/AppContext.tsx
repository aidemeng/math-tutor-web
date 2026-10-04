import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createClient, type TutorClient } from '../api/client';
import { ApiError, friendlyError } from '../api/errors';
import {
  clearSession,
  isUsable,
  loadKeys,
  readSession,
  saveKeys,
  writeSession,
  type StoredSession,
} from '../auth/session';
import { createTeacherStore, type TeacherStore } from './teacherStore';

type Status = 'loading' | 'anonymous' | 'ready' | 'error';

interface AppValue {
  status: Status;
  error: string | null;
  session: StoredSession | null;
  client: TutorClient;
  store: TeacherStore | null;
  login(name: string, secret: string): Promise<void>;
  logout(): Promise<void>;
  retry(): void;
}

const AppContext = createContext<AppValue | null>(null);

const DEV_SECRET = String(import.meta.env.VITE_DEV_LOGIN_SECRET || '');

export function AppProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef<TutorClient | null>(null);
  const tokenRef = useRef<string | null>(null);
  const storeRef = useRef<TeacherStore | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<StoredSession | null>(null);
  const [attempt, setAttempt] = useState(0);

  if (!clientRef.current) {
    clientRef.current = createClient({ getToken: () => tokenRef.current });
  }
  const client = clientRef.current;

  // 启动：用本地令牌拉账号数据；失败或过期则回到登录页。
  // 每次 attempt 变化都会重新执行，因此登录成功后在副作用里重新初始化。
  useEffect(() => {
    let cancelled = false;
    let created: TeacherStore | null = null;

    const fail = (code: string) => {
      if (cancelled) return;
      setError(friendlyError(code));
      setStatus('error');
    };

    (async () => {
      const saved = readSession();
      if (!isUsable(saved)) {
        if (saved) clearSession();
        tokenRef.current = null;
        storeRef.current = null;
        setSession(null);
        setError(null);
        setStatus('anonymous');
        return;
      }

      tokenRef.current = saved.token;
      setSession(saved);
      setError(null);
      setStatus('loading');

      try {
        const store = createTeacherStore({
          client,
          createId: () => crypto.randomUUID(),
          loadKeys,
          saveKeys,
        });
        created = store;
        if (cancelled) {
          store.dispose();
          return;
        }
        await store.initialize();
        if (cancelled) {
          store.dispose();
          return;
        }
        storeRef.current = store;
        setStatus('ready');
      } catch (caught) {
        const code = (caught as ApiError).code ?? 'NETWORK_ERROR';
        if (code === 'SESSION_INVALID' || code === 'AUTH_REQUIRED' || code === 'ACCOUNT_DISABLED') {
          clearSession();
          tokenRef.current = null;
          if (cancelled) return;
          setSession(null);
          setStatus('anonymous');
          setError(code === 'ACCOUNT_DISABLED' ? friendlyError(caught) : null);
          return;
        }
        fail(code);
      }
    })();

    return () => {
      cancelled = true;
      created?.dispose();
    };
  }, [client, attempt]);

  // 有任务在排队或制作中时轮询状态；页面隐藏时暂停，省电省流量。
  useEffect(() => {
    if (status !== 'ready') return;
    const tick = () => {
      const store = storeRef.current;
      if (!store) return;
      const pending = store.state.jobs.some(
        (job) => job.status === 'queued' || job.status === 'running',
      );
      if (document.visibilityState === 'visible' && pending) {
        void store.refreshJobs().catch(() => {});
      }
    };
    const timer = window.setInterval(tick, 5000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [status]);

  const login = useCallback(
    async (name: string, secret: string) => {
      const result = await client.loginDev(name.trim(), secret.trim() || DEV_SECRET);
      const stored = writeSession(result);
      tokenRef.current = stored.token;
      setSession(stored);
      setError(null);
      setStatus('loading');
      setAttempt((value) => value + 1);
    },
    [client],
  );

  const logout = useCallback(async () => {
    try {
      await client.logout();
    } catch {
      /* 令牌可能已失效，本地清理即可 */
    }
    clearSession();
    tokenRef.current = null;
    storeRef.current = null;
    setSession(null);
    setError(null);
    setStatus('anonymous');
  }, [client]);

  const value = useMemo<AppValue>(
    () => ({
      status,
      error,
      session,
      client,
      store: storeRef.current,
      login,
      logout,
      retry: () => setAttempt((current) => current + 1),
    }),
    [status, error, session, client, login, logout],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}

/** 订阅 store 版本号；配合 useApp().store 读取最新状态。 */
export function useStoreRevision(): number {
  const { store } = useApp();
  const subscribe = useCallback(
    (onChange: () => void) => (store ? store.subscribe(onChange) : () => {}),
    [store],
  );
  const getSnapshot = useCallback(() => store?.revision ?? 0, [store]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
