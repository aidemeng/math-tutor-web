import { BrandLogo } from './BrandLogo';
import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp, useStoreRevision } from '../store/AppContext';
import { useInstallPrompt } from '../lib/useInstallPrompt';
import { Icon } from './Icon';
import '../styles/shell.css';

const TAB_ROUTES = ['/', '/videos'];

function useRouteTitle(pathname: string): { title: string; back: boolean } {
  if (pathname === '/') return { title: '数学备课助手', back: false };
  if (pathname === '/videos') return { title: '我的视频', back: false };
  if (pathname === '/admin/growth') return { title: '分享转化', back: true };
  if (pathname === '/history') return { title: '对话记录', back: true };
  if (pathname.startsWith('/videos/')) return { title: '讲解视频', back: true };
  if (pathname.startsWith('/chat')) return { title: '备课对话', back: true };
  return { title: '备课助手', back: true };
}

export function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { store, logout, session } = useApp();
  useStoreRevision();
  const install = useInstallPrompt();
  const [scrolled, setScrolled] = useState(false);

  const pendingJobs =
    store?.state.jobs.filter((job) => job.status === 'queued' || job.status === 'running').length ?? 0;
  const { title, back } = useRouteTitle(location.pathname);
  const showTabs = TAB_ROUTES.includes(location.pathname);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="app">
      <header className={['appbar', scrolled ? 'appbar--scrolled' : ''].join(' ')}>
        {back ? (
          <button type="button" className="iconbtn iconbtn--plain" onClick={() => navigate(-1)} aria-label="返回">
            <Icon name="back" />
          </button>
        ) : (
          <span className="brandmark" aria-hidden="true">
            <BrandLogo size={28} />
          </span>
        )}
        <h1 className={['appbar__title', back ? 'appbar__title--center' : ''].join(' ')}>{title}</h1>
        <div className="appbar__actions">
          {session?.user.role === 'admin' ? (
            <NavLink to="/admin/growth" className="iconbtn iconbtn--plain" aria-label="分享转化统计"><Icon name="chart" /></NavLink>
          ) : null}
          {install.canInstall ? (
            <button type="button" className="iconbtn iconbtn--plain" onClick={() => void install.install()} aria-label="安装到桌面">
              <Icon name="install" />
            </button>
          ) : null}
          {store && store.state.credits !== null ? (
            <span className="credits-pill" title="剩余视频制作额度">
              <Icon name="video" size={14} />
              {store.state.credits}
            </span>
          ) : null}
          {session && location.pathname === '/' ? (
            <button
              type="button"
              className="iconbtn iconbtn--plain"
              onClick={() => void logout()}
              aria-label="退出登录"
            >
              <Icon name="logout" />
            </button>
          ) : null}
        </div>
      </header>

      <Outlet />

      {showTabs ? (
        <nav className="tabbar" aria-label="主导航">
          <NavLink to="/" end className="tabbar__item">
            <span className="tabbar__icon">
              <Icon name="chat" size={20} />
            </span>
            助手
          </NavLink>
          <NavLink to="/videos" className="tabbar__item">
            <span className="tabbar__icon">
              <Icon name="video" size={24} />
            </span>
            我的视频
            {pendingJobs > 0 ? <span className="tabbar__badge">{pendingJobs}</span> : null}
          </NavLink>
        </nav>
      ) : null}
    </div>
  );
}
