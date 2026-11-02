import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Providers from './app/providers';
// 样式加载顺序：令牌 → 画质 → 基线 → 旧全局（逐步被替代）
import './styles/tokens.css';
import './styles/quality.css';
import './styles/base.css';
import './global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <App />
    </Providers>
  </React.StrictMode>,
);
