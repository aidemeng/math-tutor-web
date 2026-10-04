import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import 'katex/dist/katex.min.css';
import './styles/tokens.css';
import './styles/base.css';
import { App } from './App';
import { AppProvider } from './store/AppContext';

const container = document.getElementById('root');
if (!container) throw new Error('#root not found');

createRoot(container).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);

// 注册 Service Worker：有新版本时自动接管，下次进入即为最新。
registerSW({ immediate: true });
