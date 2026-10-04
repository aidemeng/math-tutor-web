import type { SessionInfo } from '../api/types';

const STORAGE_KEY = 'tutor-session-v1';
const ID_KEYS_PREFIX = 'tutor-submissions:';

export interface StoredSession {
  token: string;
  expiresAt: number;
  user: { id: string; name: string; role: string };
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readSession(): StoredSession | null {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: SessionInfo): StoredSession {
  const stored: StoredSession = {
    token: session.token,
    expiresAt: session.expiresAt,
    user: session.user,
  };
  safeStorage()?.setItem(STORAGE_KEY, JSON.stringify(stored));
  return stored;
}

export function clearSession(): void {
  safeStorage()?.removeItem(STORAGE_KEY);
}

/** 令牌尚在有效期内才可使用；留出 30 秒余量避免临界失效。 */
export function isUsable(session: StoredSession | null): session is StoredSession {
  return !!session && session.expiresAt - 30_000 > Date.now();
}

/** 视频提交的幂等键按账号保存在本地，避免同一操作重复扣额度。 */
export function loadKeys(userId: string): [string, string][] {
  const storage = safeStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(ID_KEYS_PREFIX + userId);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is [string, string] =>
            Array.isArray(item) && typeof item[0] === 'string' && typeof item[1] === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

export function saveKeys(userId: string, keys: [string, string][]): void {
  try {
    safeStorage()?.setItem(ID_KEYS_PREFIX + userId, JSON.stringify(keys));
  } catch {
    /* 本地存储不可用时不阻塞业务 */
  }
}
