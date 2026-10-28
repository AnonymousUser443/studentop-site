/* Server-backed desktop gate. This file contains no answer or answer verifier.
   Only a fresh same-origin server response can release the inert desktop.
   Startup/replay/view changes are presentation only. */
(function () {
  'use strict';
  var API = '/__desktop/auth';
  var BOOT_KEY = 'aiden.desktop.bootSeen';
  var REVOKE_KEY = '__desktopGateRevokePending';
  var refs = {}, wired = false, initPromise = null;
  var locked = true, epoch = 0, view = 'pending', busy = false, composing = false;
  var csrf = '', remaining = null, deadline = 0, kind = 'checking';
  var message = '正在确认服务状态…';
  var postPending = false, revokePromise = null, syncPromise = null, syncEpoch = -1;
  var queue = Promise.resolve(), bootActive = false, finishBoot = null;
  var returnFocus = null, suspended = false;
  var needsRevoke = readRevokeIntent();

  function readRevokeIntent() {
    try { return !!(history.state && history.state[REVOKE_KEY] === true); }
    catch (_) { return false; }
  }
  function persistRevokeIntent(on) {
    // A denial-only marker survives refresh. It can never authorize anything.
    try {
      var old = history.state;
      var next = old && typeof old === 'object' && !Array.isArray(old) ? Object.assign({}, old) : {};
      if (on) next[REVOKE_KEY] = true;
      else delete next[REVOKE_KEY];
      history.replaceState(next, '', location.href);
    } catch (_) { /* Current document remains locked even if history is unavailable. */ }
  }
  function reduced() { return Win.reduceMotion(); }
  function nowMono() { return performance.now(); }
  function secondsLeft() { return Math.max(0, Math.ceil((deadline - nowMono()) / 1000)); }
  function enqueue(work) {
    var result = queue.then(work, work);
    queue = result.catch(function () {});
    return result;
  }
  function setText(node, value) { if (node && node.textContent !== value) node.textContent = value; }
  function clearInput() {
    composing = false;
    if (!refs.gateAnswer) return;
    refs.gateAnswer.value = '';
    refs.gateAnswer.type = 'password';
    refs.gateReveal.setAttribute('aria-pressed', 'false');
    refs.gateReveal.setAttribute('aria-label', '显示答案');
    setText(refs.gateReveal, '显示');
  }
  function setView(next) {
    view = next;
    refs.lockScreen.dataset.gateView = next;
    refs.lockScreen.dataset.gatePhase = next;
    refs.gatePending.hidden = next !== 'pending';
    refs.gateBoot.hidden = next !== 'boot';
    refs.gateClockView.hidden = next !== 'clock';
    refs.gateQuestionView.hidden = next !== 'question';
  }
  function focusPrimary() {
    if (suspended || document.visibilityState === 'hidden') return;
    var node = view === 'boot' ? refs.gateSkip : view === 'question' ? (refs.gateAnswer.disabled ? refs.gateBack : refs.gateAnswer) : refs.gateLogin;
    if (!node || node.disabled) node = refs.lockScreen;
    node.focus({ preventScroll: true });
  }
  function maskDesktop() {
    if (!locked) returnFocus = document.activeElement;
    locked = true;
    refs.desktop.inert = true;
    refs.desktop.setAttribute('aria-hidden', 'true');
    document.body.classList.add('is-locked');
    refs.lockScreen.hidden = false;
    refs.lockScreen.classList.remove('is-unlocking');
    Win.bus.emit('lock:request-close-all');
  }
  function setStatus(next, text) { kind = next; message = text; render(); }
  function render() {
    if (!wired) return;
    var cooling = kind === 'cooldown';
    var sec = secondsLeft();
    var ready = (kind === 'ready' || kind === 'denied') && !needsRevoke && !!csrf && remaining > 0;
    refs.lockScreen.dataset.gateStatus = kind;
    refs.gateForm.setAttribute('aria-busy', String(busy));
    refs.gateSubmit.disabled = busy || !ready;
    refs.gateAnswer.disabled = busy || !ready;
    refs.gateReveal.disabled = busy || !ready;
    refs.gateLogin.disabled = busy || needsRevoke;
    refs.gateReplay.disabled = busy || needsRevoke;
    refs.gateRetry.disabled = busy;
    refs.gateClockRetry.disabled = busy;
    var retry = needsRevoke || kind === 'unavailable' || kind === 'unconfigured' || cooling;
    refs.gateRetry.hidden = !retry;
    refs.gateClockRetry.hidden = !retry;
    setText(refs.gateRetry, needsRevoke ? '重新注销并检查状态' : '重新检查服务状态');
    setText(refs.gateClockRetry, needsRevoke ? '重试安全锁定' : '重新连接');
    setText(refs.gateSubmit, postPending ? '正在验证…' : '验证并进入 →');
    setText(refs.gateStatus, message);
    setText(refs.gateClockStatus, message);
    setText(refs.gateAttempts, remaining !== null && (ready || cooling) ? '服务端剩余尝试：' + remaining + ' 次' : '');
    refs.gateCountdown.hidden = !cooling;
    if (cooling) {
      var minutes = String(Math.floor(sec / 60)).padStart(2, '0');
      var seconds = String(sec % 60).padStart(2, '0');
      setText(refs.gateCountdown, sec ? minutes + ':' + seconds + ' 后可重新检查' : '倒计时结束，请重新检查服务状态');
    }
  }
  function updateClock(date) {
    var d = date instanceof Date ? date : new Date();
    setText(refs.lockClock, Win.fmtTime(d));
    setText(refs.lockDate, Win.fmtDateCN(d));
    setText(refs.lockWeekday, Win.WEEK[d.getDay()]);
    if (kind === 'cooldown') render();
  }
  function updateAppearance() {
    var url = Win.safeUrl(Win.wallpaperUrl(Win.prefs.wall));
    if (url) refs.lockWall.style.backgroundImage = 'url(' + JSON.stringify(url) + ')';
  }
  function snapshot(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid auth response');
    if (typeof raw.configured !== 'boolean' || typeof raw.authenticated !== 'boolean') throw new Error('Invalid auth response');
    if (!Number.isInteger(raw.attemptsRemaining) || raw.attemptsRemaining < 0 || raw.attemptsRemaining > 3) throw new Error('Invalid auth response');
    if (!Number.isInteger(raw.retryAfterSeconds) || raw.retryAfterSeconds < 0 || raw.retryAfterSeconds > 86400) throw new Error('Invalid auth response');
    if (!Number.isFinite(raw.serverTime) || raw.serverTime <= 0) throw new Error('Invalid auth response');
    if (raw.lockedUntil !== null && (!Number.isFinite(raw.lockedUntil) || raw.lockedUntil < 0)) throw new Error('Invalid auth response');
    if (raw.csrfToken !== null && typeof raw.csrfToken !== 'string') throw new Error('Invalid auth response');
    if (raw.configured && (typeof raw.csrfToken !== 'string' || !raw.csrfToken || raw.csrfToken.length > 2048)) throw new Error('Invalid auth response');
    if (!raw.configured && raw.authenticated) throw new Error('Invalid auth response');
    return { configured: raw.configured, authenticated: raw.authenticated, csrfToken: raw.csrfToken || '', attemptsRemaining: raw.attemptsRemaining, retryAfterSeconds: raw.retryAfterSeconds, lockedUntil: raw.lockedUntil, serverTime: raw.serverTime };
  }
  async function request(method, token, answer) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 12000);
    var headers = { Accept: 'application/json' };
    var options = { method: method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: headers, signal: controller.signal };
    if (method !== 'GET') headers['X-Desktop-CSRF'] = token;
    if (method === 'POST') { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify({ answer: answer }); }
    try {
      var response = await fetch(API, options);
      if (!/application\/json/i.test(response.headers.get('content-type') || '')) throw new Error('Invalid auth response');
      var text = await response.text();
      if (text.length > 16384) throw new Error('Invalid auth response');
      return { status: response.status, data: snapshot(JSON.parse(text)) };
    } finally {
      clearTimeout(timer);
      options.body = undefined;
      answer = '';
    }
  }
  function applySnapshot(data) {
    csrf = data.csrfToken;
    remaining = data.attemptsRemaining;
    var seconds = Math.max(data.retryAfterSeconds, data.lockedUntil ? Math.ceil((data.lockedUntil - data.serverTime) / 1000) : 0, 0);
    deadline = nowMono() + seconds * 1000;
  }
  function interpret(result, wrongAnswer) {
    applySnapshot(result.data);
    if (!result.data.configured) { setStatus('unconfigured', '登录服务尚未配置。桌面保持锁定，请稍后重试。'); return; }
    if (result.status === 429 || secondsLeft() > 0 || remaining === 0) { setStatus('cooldown', '暂时无法继续尝试，请等待服务端允许重试。'); return; }
    if ((result.status === 200 || (result.status === 401 && wrongAnswer)) && !result.data.authenticated) {
      setStatus(wrongAnswer ? 'denied' : 'ready', wrongAnswer ? '答案不正确，请重新输入。' : '请回答问题后进入桌面。');
      return;
    }
    setStatus('unavailable', '验证状态无法确认，请重新检查。桌面保持锁定。');
  }
  async function release(myEpoch, instant) {
    if (myEpoch !== epoch || needsRevoke || suspended || bootActive) return false;
    refs.lockScreen.classList.add('is-unlocking');
    if (!instant && !reduced()) await new Promise(function (resolve) { setTimeout(resolve, 180); });
    if (myEpoch !== epoch || needsRevoke || suspended || bootActive) return false;
    clearInput();
    setView('desktop');
    locked = false;
    refs.lockScreen.hidden = true;
    refs.lockScreen.classList.remove('is-unlocking');
    document.body.classList.remove('is-locked');
    refs.desktop.inert = false;
    refs.desktop.removeAttribute('aria-hidden');
    var target = returnFocus && returnFocus.isConnected && !refs.lockScreen.contains(returnFocus) ? returnFocus : document.getElementById('startBtn');
    if (target && !target.closest('[inert]')) target.focus({ preventScroll: true });
    Win.bus.emit('unlock', { instant: !!instant });
    return true;
  }
  function synchronize(instant) {
    if (needsRevoke) return lock();
    if (suspended || bootActive) return Promise.resolve(false);
    if (syncPromise && syncEpoch === epoch) return syncPromise;
    var myEpoch = epoch;
    syncEpoch = myEpoch;
    maskDesktop();
    busy = true;
    setStatus('checking', '正在确认服务状态…');
    var operation = enqueue(async function () {
      try {
        var result = await request('GET');
        if (myEpoch !== epoch || needsRevoke || suspended) return false;
        applySnapshot(result.data);
        busy = false;
        if (result.status === 200 && result.data.configured && result.data.authenticated) return await release(myEpoch, instant);
        interpret(result, false);
        return false;
      } catch (_) {
        if (myEpoch === epoch) { busy = false; csrf = ''; setStatus('unavailable', '无法连接登录服务。桌面保持锁定，可以重新连接。'); }
        return false;
      } finally {
        if (myEpoch === epoch) { busy = false; render(); }
      }
    });
    syncPromise = operation;
    operation.finally(function () { if (syncPromise === operation) syncPromise = null; });
    return operation;
  }
  function lock() {
    wire();
    maskDesktop();
    clearInput();
    if (finishBoot) finishBoot();
    setView('clock');
    if (revokePromise) { render(); focusPrimary(); return revokePromise; }
    epoch += 1;
    var myEpoch = epoch;
    needsRevoke = true;
    persistRevokeIntent(true);
    busy = true;
    setStatus('revoking', '正在安全锁定并注销会话…');
    focusPrimary();
    // Never abort an in-flight POST and race DELETE ahead of it. The queue drains first.
    var operation = enqueue(async function () {
      try {
        var fresh = await request('GET');
        if (myEpoch !== epoch) return false;
        if (!fresh.data.csrfToken) throw new Error('Cannot revoke');
        var result = await request('DELETE', fresh.data.csrfToken);
        if (myEpoch !== epoch) return false;
        if (result.status !== 200 || result.data.authenticated) throw new Error('Cannot revoke');
        needsRevoke = false;
        persistRevokeIntent(false);
        busy = false;
        interpret(result, false);
        return true;
      } catch (_) {
        if (myEpoch === epoch) { busy = false; csrf = ''; setStatus('unavailable', '注销尚未确认，桌面仍被锁定。请重试安全锁定。'); }
        return false;
      } finally {
        if (myEpoch === epoch) { busy = false; render(); }
      }
    });
    revokePromise = operation;
    operation.finally(function () { if (revokePromise === operation) revokePromise = null; });
    return operation;
  }
  async function submit(event) {
    event.preventDefault();
    if (composing || busy || needsRevoke || (kind !== 'ready' && kind !== 'denied') || !csrf || remaining <= 0) return;
    var answer = refs.gateAnswer.value;
    clearInput();
    if (!answer.trim()) { setStatus('ready', '请先输入答案。'); focusPrimary(); return; }
    var myEpoch = epoch;
    postPending = true;
    busy = true;
    setStatus('checking', '正在验证，请稍候…');
    await enqueue(async function () {
      try {
        var result = await request('POST', csrf, answer);
        answer = '';
        if (myEpoch !== epoch || needsRevoke || suspended) return false;
        applySnapshot(result.data);
        busy = false;
        postPending = false;
        if (result.status === 200 && result.data.configured && result.data.authenticated) return await release(myEpoch, false);
        interpret(result, result.status === 401);
        focusPrimary();
        return false;
      } catch (_) {
        if (myEpoch === epoch) { busy = false; csrf = ''; setStatus('unavailable', '验证结果无法确认。桌面保持锁定，请重新检查。'); }
        return false;
      } finally {
        answer = '';
        postPending = false;
        if (myEpoch === epoch) { busy = false; render(); }
      }
    });
  }
  function showQuestion() {
    if (!locked || busy || needsRevoke || bootActive) return;
    clearInput();
    setView('question');
    render();
    focusPrimary();
  }
  function backToClock() {
    clearInput();
    if (postPending) { void lock(); return; }
    setView('clock');
    render();
    focusPrimary();
  }
  function shouldPlayFirstBoot() {
    try {
      var seen = localStorage.getItem(BOOT_KEY) === '1';
      if (!seen) localStorage.setItem(BOOT_KEY, '1');
      return !seen;
    } catch (_) { return false; }
  }
  function playBoot() {
    if (!locked || bootActive) return Promise.resolve();
    clearInput();
    bootActive = true;
    setView('boot');
    refs.gateBios.hidden = reduced();
    refs.gateLogoStage.hidden = !reduced();
    refs.lockScreen.dataset.gatePhase = reduced() ? 'logo' : 'bios';
    return new Promise(function (resolve) {
      var timer = null, settled = false;
      function finish() {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        finishBoot = null;
        bootActive = false;
        setView('clock');
        render();
        focusPrimary();
        resolve();
      }
      finishBoot = finish;
      focusPrimary();
      if (reduced()) { timer = setTimeout(finish, 160); return; }
      timer = setTimeout(function () {
        refs.gateBios.hidden = true;
        refs.gateLogoStage.hidden = false;
        refs.lockScreen.dataset.gatePhase = 'logo';
        timer = setTimeout(finish, 2000);
      }, 1500);
    });
  }
  function visibleFocusables() {
    return Array.prototype.slice.call(refs.lockScreen.querySelectorAll('button,input,[tabindex="0"]')).filter(function (node) {
      return !node.disabled && !node.closest('[hidden]') && node.getClientRects().length > 0;
    });
  }
  function keydown(event) {
    if (!locked) return;
    if (event.isComposing || composing || event.keyCode === 229) {
      if (event.key === 'Enter') event.preventDefault();
      return;
    }
    if (event.key === 'Tab') {
      var items = visibleFocusables();
      if (!items.length) { event.preventDefault(); refs.lockScreen.focus(); return; }
      var first = items[0], last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === refs.lockScreen)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === refs.lockScreen)) { event.preventDefault(); first.focus(); }
      return;
    }
    if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation();
      if (bootActive && finishBoot) finishBoot();
      else if (view === 'question') backToClock();
      return;
    }
    if (event.key === 'Enter' && view === 'clock' && !event.target.closest('button')) {
      event.preventDefault(); event.stopPropagation(); showQuestion();
    }
  }
  function suspend() {
    if (!wired) return;
    suspended = true;
    epoch += 1;
    clearInput();
    maskDesktop();
    if (!bootActive) setView('clock');
  }
  function resume() {
    if (!wired) return;
    suspended = false;
    if (bootActive) return;
    epoch += 1;
    maskDesktop();
    if (needsRevoke) {
      // A stale revoke job will finish without releasing. Retry after its queue slot.
      var pending = revokePromise;
      if (pending) pending.finally(function () { if (needsRevoke && !suspended) void lock(); });
      else void lock();
    } else void synchronize(true);
  }
  function wire() {
    if (wired) return;
    var names = ['lockScreen','lockWall','lockClock','lockDate','lockWeekday','lockAvatar','lockUser','desktop','gatePending','gateBoot','gateBios','gateLogoStage','gateSkip','gateClockView','gateLogin','gateReplay','gateClockRetry','gateClockStatus','gateQuestionView','gateForm','gateFormAvatar','gateAnswer','gateReveal','gateSubmit','gateStatus','gateAttempts','gateCountdown','gateBack','gateRetry'];
    names.forEach(function (id) { refs[id] = document.getElementById(id); if (!refs[id]) throw new Error('Gate markup unavailable'); });
    wired = true;
    refs.lockAvatar.innerHTML = Win.avatarMarkup();
    refs.gateFormAvatar.innerHTML = Win.avatarMarkup();
    refs.lockScreen.querySelectorAll('.profile-avatar').forEach(function (image) { image.alt = 'Aiden 的头像'; });
    setText(refs.lockUser, 'Aiden');
    maskDesktop();
    updateClock(new Date());
    updateAppearance();
    Win.bus.on('clock', updateClock);
    Win.bus.on('prefs', function () { updateAppearance(); if (reduced() && finishBoot) finishBoot(); });
    var reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceQuery.addEventListener) reduceQuery.addEventListener('change', function () { if (reduced() && finishBoot) finishBoot(); });
    Win.startClock();
    refs.gateLogin.addEventListener('click', showQuestion);
    refs.gateBack.addEventListener('click', backToClock);
    refs.gateSkip.addEventListener('click', function () { if (finishBoot) finishBoot(); });
    refs.gateReplay.addEventListener('click', function () { if (!busy && !needsRevoke) void playBoot(); });
    refs.gateForm.addEventListener('submit', function (event) { void submit(event); });
    refs.gateAnswer.addEventListener('compositionstart', function () { composing = true; });
    refs.gateAnswer.addEventListener('compositionend', function () { composing = false; });
    refs.gateReveal.addEventListener('click', function () {
      var show = refs.gateAnswer.type === 'password';
      refs.gateAnswer.type = show ? 'text' : 'password';
      refs.gateReveal.setAttribute('aria-pressed', String(show));
      refs.gateReveal.setAttribute('aria-label', show ? '隐藏答案' : '显示答案');
      setText(refs.gateReveal, show ? '隐藏' : '显示');
      refs.gateAnswer.focus({ preventScroll: true });
    });
    [refs.gateRetry, refs.gateClockRetry].forEach(function (button) {
      button.addEventListener('click', function () { if (!busy) { if (needsRevoke) void lock(); else void synchronize(false); } });
    });
    refs.lockScreen.addEventListener('keydown', keydown, true);
    document.addEventListener('focusin', function (event) { if (locked && !suspended && !refs.lockScreen.contains(event.target)) focusPrimary(); });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') suspend(); else resume(); });
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', function (event) { if (event.persisted) resume(); });
  }
  function init() {
    if (initPromise) return initPromise;
    wire();
    initPromise = (async function () {
      setView('clock');
      render();
      if (needsRevoke) { await lock(); return; }
      if (shouldPlayFirstBoot()) await playBoot();
      if (needsRevoke) { if (revokePromise) await revokePromise; else await lock(); return; }
      await synchronize(true);
      if (locked) focusPrimary();
    })();
    return initPromise;
  }
  async function unlock(instant) {
    if (!initPromise) await init();
    if (needsRevoke || bootActive || postPending || suspended) return false;
    return synchronize(!!instant);
  }
  window.DesktopGate = Object.freeze({ init: init, lock: lock, unlock: unlock, isLocked: function () { return locked || needsRevoke; } });
})();
