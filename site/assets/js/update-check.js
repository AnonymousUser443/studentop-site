/* Optional desktop updater. Only probes public same-origin version metadata.
   It never clears storage/caches, touches authentication fields, or reloads automatically. */
(function () {
  'use strict';
  if (window.SiteUpdate) return;

  var POLL_MS = 60000, WAKE_GAP_MS = 15000, REQUEST_TIMEOUT_MS = 12000;
  var currentId = null, pendingId = null, deferredId = null;
  var initialized = false, suspended = false, interval = null, request = null, boundBus = null;
  var lastAttempt = -Infinity, navigationUntil = 0, notice = null, description = null, lastOutsideFocus = null;
  var normalDescription = '更新只会重新载入本页，不会清除浏览器保存的数据。请先保存未完成的便笺。';

  function normalizeId(value) {
    return typeof value === 'string' && /^[a-f0-9]{1,128}$/i.test(value) ? value.toLowerCase() : null;
  }

  function buildRefreshUrl(href, id) {
    id = normalizeId(id);
    if (!id) return null;
    try {
      var url = new URL(href);
      if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return null;
      // 仅从当前页面地址派生；其他参数（含重复键）和 hash 保留，不发送到版本探测端点。
      url.searchParams.set('__siteVersion', id);
      return url.href;
    } catch (e) { return null; }
  }

  function desktopReady() {
    if (suspended || document.visibilityState === 'hidden') return false;
    try {
      if (!window.Win || typeof Win.isLocked !== 'function' || Win.isLocked()) return false;
      var desktop = document.getElementById('desktop');
      if (!desktop || desktop.inert || desktop.getAttribute('aria-hidden') === 'true') return false;
      var lock = document.getElementById('lockScreen'), boot = document.getElementById('gateBoot');
      if ((lock && !lock.hidden) || (boot && !boot.hidden)) return false;
      return true;
    } catch (e) { return false; }
  }

  function hideNotice(returnFocus) {
    if (!notice) return;
    var hadFocus = notice.contains(document.activeElement);
    if (returnFocus && hadFocus && desktopReady()) {
      var target = lastOutsideFocus;
      if (!target || !target.isConnected || target.disabled || target.closest('[inert],[hidden]')) target = document.getElementById('startBtn');
      if (target && target.isConnected && !target.disabled && !target.closest('[inert],[hidden]')) target.focus({ preventScroll: true });
    }
    notice.hidden = true;
  }

  function makeNode(tag, className, text) {
    var node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function ensureNotice() {
    if (notice) return notice;
    var desktop = document.getElementById('desktop');
    if (!desktop) return null;
    notice = makeNode('section', 'site-update');
    notice.id = 'siteUpdateNotice'; notice.hidden = true;
    notice.setAttribute('role', 'region');
    notice.setAttribute('aria-labelledby', 'siteUpdateTitle');
    notice.setAttribute('aria-describedby', 'siteUpdateDescription');
    var copy = makeNode('div', 'site-update__copy');
    var title = makeNode('h2', 'site-update__title', '有可用的新版本'); title.id = 'siteUpdateTitle';
    description = makeNode('p', 'site-update__description', normalDescription); description.id = 'siteUpdateDescription';
    description.setAttribute('role', 'status'); description.setAttribute('aria-live', 'polite'); description.setAttribute('aria-atomic', 'true');
    copy.appendChild(title); copy.appendChild(description); notice.appendChild(copy);
    var actions = makeNode('div', 'site-update__actions');
    var update = makeNode('button', 'site-update__button site-update__button--primary', '立即更新');
    update.type = 'button'; update.dataset.updateAction = 'apply'; update.addEventListener('click', applyUpdate);
    var later = makeNode('button', 'site-update__button site-update__button--secondary', '稍后');
    later.type = 'button'; later.dataset.updateAction = 'later';
    later.addEventListener('click', function () { deferredId = pendingId; hideNotice(true); });
    actions.appendChild(update); actions.appendChild(later); notice.appendChild(actions);
    desktop.appendChild(notice);
    return notice;
  }

  function renderNotice() {
    if (!pendingId || pendingId === currentId || pendingId === deferredId || !desktopReady()) { hideNotice(true); return; }
    var node = ensureNotice();
    if (node) node.hidden = false; // 不调用 focus，也不替换当前输入节点。
  }

  function inspectDrafts() {
    if (!window.WM || typeof WM.list !== 'function') return { unknown: true, dirty: false };
    try {
      var wins = WM.list();
      if (!Array.isArray(wins)) return { unknown: true, dirty: false };
      return { unknown: false, dirty: wins.some(function (win) { return !!(win && typeof win.isDirty === 'function' && win.isDirty()); }) };
    } catch (e) { return { unknown: true, dirty: false }; }
  }

  function applyUpdate() {
    if (!desktopReady() || !pendingId || pendingId === currentId || Date.now() < navigationUntil) return;
    var url = buildRefreshUrl(window.location.href, pendingId);
    if (!url) return;
    var drafts = inspectDrafts();
    if (drafts.unknown) {
      description.textContent = '无法确认便笺是否已保存。请先保存内容，再尝试更新；当前页面保持不变。';
      return;
    }
    if (drafts.dirty) {
      var confirmed = false;
      try { confirmed = window.confirm('有未保存的便笺。立即更新会重新载入页面，未保存内容可能丢失。建议先取消并保存；仍要立即更新吗？'); }
      catch (e) { confirmed = false; }
      if (!confirmed) return;
    }
    if (!desktopReady()) return;
    try {
      navigationUntil = Date.now() + 2000; // 合并重复点击；取消浏览器 beforeunload 后仍能再次操作。
      window.location.replace(url);
    } catch (e) {
      navigationUntil = 0;
      description.textContent = '浏览器未能重新载入页面，当前内容仍保留。请保存后再试。';
    }
  }

  function bindBus() {
    var bus = window.Win && Win.bus;
    if (!bus || typeof bus.on !== 'function' || bus === boundBus) return;
    boundBus = bus;
    bus.on('unlock', function () { renderNotice(); check(); });
    bus.on('lock:request-close-all', function () { hideNotice(false); });
  }

  function cancelRequest() {
    var old = request;
    request = null;
    if (!old) return;
    old.stale = true;
    clearTimeout(old.timeout);
    if (old.controller) old.controller.abort();
  }

  function check() {
    bindBus();
    var now = Date.now(), elapsed = now - lastAttempt;
    if (suspended || document.visibilityState === 'hidden' || navigator.onLine === false || request || typeof window.fetch !== 'function' || (elapsed >= 0 && elapsed < WAKE_GAP_MS)) return Promise.resolve(false);
    lastAttempt = now;
    var mine = { stale: false, controller: typeof window.AbortController === 'function' ? new window.AbortController() : null };
    request = mine;
    mine.timeout = setTimeout(function () { if (request === mine) cancelRequest(); }, REQUEST_TIMEOUT_MS);
    var options = { method: 'GET', cache: 'no-store', mode: 'same-origin', credentials: 'same-origin', redirect: 'error', headers: { Accept: 'application/json' } };
    if (mine.controller) options.signal = mine.controller.signal;
    return Promise.resolve().then(function () {
      if (mine.stale || request !== mine) return null;
      return window.fetch('/version.json', options);
    })
      .then(function (response) {
        if (mine.stale || request !== mine) return null;
        if (!response || !response.ok) return null;
        return response.json();
      })
      .then(function (data) {
        if (mine.stale || request !== mine) return false;
        var id = data && !Array.isArray(data) && normalizeId(data.id);
        if (!id) return false;
        if (!currentId) currentId = id; // 开发环境无 meta 时，首次成功探测仅建立基线。
        var next = id === currentId ? null : id;
        if (next !== pendingId && description) description.textContent = normalDescription;
        pendingId = next;
        renderNotice();
        return true;
      }).catch(function () { return false; }) // 离线/超时/非法响应安静重试，不伪称更新成功。
      .finally(function () { clearTimeout(mine.timeout); if (request === mine) request = null; });
  }

  function startInterval() { if (interval === null) interval = setInterval(check, POLL_MS); }
  function wake() { bindBus(); renderNotice(); check(); }
  function init() {
    if (initialized) return;
    initialized = true;
    var meta = document.querySelector('meta[name="site-version"]');
    currentId = normalizeId(meta && meta.getAttribute('content'));
    var desktop = document.getElementById('desktop');
    if (desktop && desktop.contains(document.activeElement)) lastOutsideFocus = document.activeElement;
    document.addEventListener('focusin', function (e) {
      if (desktop && desktop.contains(e.target) && (!notice || !notice.contains(e.target)) && desktopReady()) lastOutsideFocus = e.target;
    });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') hideNotice(false); else wake(); });
    window.addEventListener('pageshow', function () { suspended = false; startInterval(); wake(); });
    window.addEventListener('pagehide', function () { suspended = true; clearInterval(interval); interval = null; cancelRequest(); hideNotice(false); });
    window.addEventListener('focus', wake);
    window.addEventListener('online', wake);
    bindBus(); startInterval(); check();
  }

  window.SiteUpdate = Object.freeze({ check: check, normalizeId: normalizeId, buildRefreshUrl: buildRefreshUrl,
    getState: function () { return { currentId: currentId, pendingId: pendingId, deferredId: deferredId, checking: !!request }; } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
