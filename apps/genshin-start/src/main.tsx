import './index.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import { EXIT_LABEL, exitUrl, goExit } from './core/exit'

/* 用 ?skip=1（或 #skip）打开：不播开场，直接去目标站点。慢网 / 分享兜底用。 */
if (/[?&#]skip\b/.test(window.location.search + window.location.hash)) {
  goExit('skip-param')
}

function resizeWindow(){
  var width = document.documentElement.clientWidth;
  var height = document.documentElement.clientHeight;
  const root = document.getElementById('root');
  if (width > height) {
    root.style.transform = "rotate(0deg)";
    root.style.width = `${width}px`
    root.style.height = `${height}px`
    root.style.top = `0px`
    root.style.left = `0px`
  }
  else {
    root.style.transform = "rotate(90deg)";
    root.style.width = `${height}px`
    root.style.height = `${width}px`
    root.style.top = `${(height - width) / 2}px`
    root.style.left = `${0 - (height - width) / 2}px`
  }
}
resizeWindow()

var evt = "resize";//"onorientationchange" in window ? "orientationchange" : "resize";
window.addEventListener(evt, resizeWindow, false);

/* 没有 WebGL 的浏览器/设备：给一张能走人的降级页，别卡在「正在启动」 */
function hasWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch (e) {
    return false;
  }
}

function renderNoWebGL() {
  const root = document.getElementById('root')!;
  const url = exitUrl();
  const autoTimer = window.setTimeout(() => goExit('no-webgl-auto'), 9000);
  root.innerHTML = `
    <div class="nogl">
      <div class="nogl-card">
        <p class="nogl-kicker">原神启动 · 开场</p>
        <h1>这台设备跳过 3D 开场</h1>
        <p class="nogl-text">当前浏览器没有启用 WebGL，播不了这段三维开场动画。<br>点下面的按钮直接进入目标站点，或等 <b id="nogl-count">9</b> 秒自动跳转。</p>
        <a class="nogl-btn" href="${url}">进入 ${EXIT_LABEL} →</a>
        <p class="nogl-url">${url}</p>
      </div>
    </div>`;
  const btn = root.querySelector('.nogl-btn');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.clearTimeout(autoTimer);
      goExit('no-webgl-button');
    });
  }
  let left = 9;
  const countEl = document.getElementById('nogl-count');
  const tick = window.setInterval(() => {
    left -= 1;
    if (countEl) countEl.textContent = String(Math.max(left, 0));
    if (left <= 0) window.clearInterval(tick);
  }, 1000);
}

if (hasWebGL()) {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} else {
  renderNoWebGL()
}
