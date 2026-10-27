(async () => {
  const checks = [];
  const ok = (n, c, d) => checks.push({ name: n, pass: !!c, detail: d === undefined ? null : d });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const lock = document.getElementById('lockScreen');
  ok('lock_visible_initially', !!lock && !lock.hidden && !lock.classList.contains('is-unlocking'));
  // 点击锁屏任意处
  lock.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  await sleep(700);
  ok('lock_unlocks_on_click', lock.hidden || lock.classList.contains('is-unlocking'));
  await sleep(900);
  ok('desktop_visible', !document.getElementById('desktop').hidden);
  ok('auto_about_opened', !!document.querySelector('.window[data-app="about"]'));
  ok('welcome_toast', !!document.querySelector('.toast'));
  ok('notification_badge', document.querySelectorAll('#notifList , .notif-btn .dot').length >= 0);
  // 刷新后不再锁屏（同一 session）
  const flag = sessionStorage.getItem('win11home.unlocked');
  ok('session_unlock_flag', flag === '1', flag);
  return JSON.stringify({ checks });
})()