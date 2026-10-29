/* Real read-only Pi monitor, hosted in an ordinary singleton desktop window. */
(function () {
  'use strict';
  var defs = window.__APP_DEFS = window.__APP_DEFS || [];
  defs.push({
    id: 'rpi-task-manager', title: '任务管理器', desktopLabel: '任务管理器',
    icon: 'task-manager', keywords: 'task manager taskmgr 任务 管理器 树莓派 CPU 内存 进程 性能 实时',
    single: true, width: 1180, height: 760, minWidth: 660, minHeight: 440,
    render: function (body, ctx) {
      body.classList.add('task-manager-host');
      var frame = document.createElement('iframe');
      frame.className = 'task-manager-frame';
      frame.title = '树莓派任务管理器 · 只读实时监控';
      frame.referrerPolicy = 'no-referrer';
      frame.allowFullscreen = true;
      frame.src = '/task-manager/';
      var stopped = false;
      function send(type, value) {
        if (!frame.contentWindow) return;
        frame.contentWindow.postMessage({type: type, visible: value}, location.origin);
      }
      function visibility() {
        if (stopped) return;
        send('aiden-task-manager:visibility', !Win.isLocked() && !document.hidden && ctx.win.state !== 'min' && ctx.win.state !== 'closed');
      }
      function ready(event) {
        if (event.source === frame.contentWindow && event.origin === location.origin && event.data && event.data.type === 'aiden-task-manager:ready') visibility();
      }
      var off = Win.bus.on('wm:change', visibility);
      var offLock = Win.bus.on('lock:request-close-all', function () { send('aiden-task-manager:visibility', false); ctx.close(); });
      document.addEventListener('visibilitychange', visibility);
      window.addEventListener('message', ready);
      frame.addEventListener('load', visibility);
      body.appendChild(frame);
      ctx.win.dispose = function () {
        if (stopped) return;
        stopped = true;
        send('aiden-task-manager:dispose', false);
        off(); offLock();
        document.removeEventListener('visibilitychange', visibility);
        window.removeEventListener('message', ready);
        frame.removeEventListener('load', visibility);
        // Destroy the owned document immediately, including SSE and pending fetches.
        frame.remove();
      };
    }
  });
})();
