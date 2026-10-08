import { BrandLogo } from './components/BrandLogo';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Icon } from './components/Icon';
import { Shell } from './components/Shell';
import { ToastHost } from './components/Toast';
import { ChatPage } from './pages/ChatPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { TaskPage } from './pages/TaskPage';
import { VideosPage } from './pages/VideosPage';
import { useApp } from './store/AppContext';
import './styles/app.css';

/** 切换页面回到顶部；对话页自行跟随到底部，不在此处理。 */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith('/chat')) return;
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

function Splash() {
  return (
    <div className="splash">
      <span className="splash__logo">
        <BrandLogo size={48} />
      </span>
      <p className="splash__text">正在准备备课环境…</p>
    </div>
  );
}

function ErrorScreen({ message, onRetry }: { message: string | null; onRetry(): void }) {
  return (
    <div className="splash">
      <span className="splash__logo splash__logo--warn">
        <Icon name="alert" size={24} />
      </span>
      <p className="splash__title">没能连上服务</p>
      <p className="splash__text">{message ?? '请检查网络或服务地址后重试。'}</p>
      <button type="button" className="btn btn--primary" onClick={onRetry}>
        <Icon name="refresh" size={17} />
        重新连接
      </button>
    </div>
  );
}

export function App() {
  const { status, error, retry } = useApp();

  if (status === 'loading') return <Splash />;
  if (status === 'error') return <ErrorScreen message={error} onRetry={retry} />;
  if (status === 'anonymous') {
    return (
      <>
        <LoginPage />
        <ToastHost />
      </>
    );
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route element={<Shell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/videos/:id" element={<TaskPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/chat/:id" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastHost />
    </BrowserRouter>
  );
}
