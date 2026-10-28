import './style.css';

export function initUI(actions = {}) {
  const $ = (id) => document.getElementById(id);
  const root = document.body;
  const dialog = $('about-dialog');
  const soundButton = $('sound-button');
  const pauseButton = $('pause-button');
  const timeControl = $('time-control');
  const timeButton = $('time-button');
  const timePanel = $('time-panel');
  let toastTimer;
  let loadingFinished = false;
  let chapterVersion = 0;
  let activeChapter = 0;
  let pendingChapter = null;

  const timeExplanation = document.createElement('div');
  timeExplanation.className = 'dialog-section';
  timeExplanation.innerHTML = `<h3>一日的光景</h3><dl class="daily-periods"><div><dt>清晨 <span>06:00 — 09:00</span></dt><dd>金色斜照，光束穿过云雾。</dd></div><div><dt>白昼 <span>09:00 — 17:00</span></dt><dd>晴朗蓝天，白云缓缓漂移。</dd></div><div><dt>黄昏 <span>17:00 — 19:00</span></dt><dd>夕阳西下，染暖石阶与天空。</dd></div><div><dt>月夜 <span>19:00 — 次日 06:00</span></dt><dd>一轮明月，银蓝月光洒满校园。</dd></div></dl><p class="dialog-footnote">默认跟随北京时间。右上角可以预览其他时段，再选择「跟随时间」回到此刻。</p>`;
  dialog.querySelector('.dialog-signature').before(timeExplanation);

  $('start-button').addEventListener('click', () => {
    actions.start?.();
    setJourney(true);
  });
  $('home-button').addEventListener('click', (event) => {
    event.preventDefault();
    actions.home?.();
    setJourney(false);
  });
  pauseButton.addEventListener('click', () => actions.togglePause?.());
  soundButton.addEventListener('click', () => actions.toggleSound?.());
  $('fullscreen-button').addEventListener('click', () => actions.toggleFullscreen?.());
  $('info-button').addEventListener('click', () => { setTimePanel(false); dialog.showModal(); });
  $('close-info-button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  timeButton.addEventListener('click', () => setTimePanel(timePanel.hidden));
  timeButton.addEventListener('keydown', (event) => {
    if (event.code === 'ArrowDown') {
      event.preventDefault();
      setTimePanel(true);
      timePanel.querySelector('.time-option.is-active')?.focus();
    }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!timeControl.contains(event.target)) setTimePanel(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Escape' && !timePanel.hidden) {
      setTimePanel(false);
      timeButton.focus();
    }
  });
  timePanel.addEventListener('keydown', (event) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.code)) return;
    event.preventDefault();
    const options = [...timePanel.querySelectorAll('[data-time-mode]')];
    const current = options.indexOf(document.activeElement);
    const next = event.code === 'Home' ? 0 : event.code === 'End' ? options.length - 1 : (current + (event.code === 'ArrowUp' ? -1 : 1) + options.length) % options.length;
    options[next].focus();
  });
  timePanel.querySelectorAll('[data-time-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      actions.setTimeMode?.(button.dataset.timeMode);
      setTimePanel(false);
      timeButton.focus();
    });
  });
  document.querySelectorAll('[data-speed]').forEach((button) => {
    button.addEventListener('click', () => {
      const speed = Number(button.dataset.speed);
      actions.setSpeed?.(speed);
      setSpeed(speed);
    });
  });
  document.querySelector('.chapter-dots').addEventListener('click', (event) => {
    const button = event.target.closest('[data-landmark]');
    if (button && actions.jumpToLandmark) {
      actions.jumpToLandmark(Number(button.dataset.landmark));
      setJourney(true);
    }
  });

  function setJourney(active) {
    root.classList.toggle('journey-active', Boolean(active));
    $('start-button').tabIndex = active ? -1 : 0;
  }

  function setPaused(paused) {
    pauseButton.classList.toggle('is-paused', Boolean(paused));
    pauseButton.setAttribute('aria-pressed', String(Boolean(paused)));
    pauseButton.setAttribute('aria-label', paused ? '继续漫游' : '暂停漫游');
    $('journey-status').lastChild.textContent = paused ? ' 风景暂歇中' : ' 云端漫游中';
  }

  function setSound(enabled, { loading = false, label = '环境音乐', track = '' } = {}) {
    soundButton.classList.toggle('sound-on', Boolean(enabled));
    soundButton.setAttribute('aria-pressed', String(Boolean(enabled)));
    soundButton.setAttribute('aria-busy', String(loading));
    soundButton.setAttribute('aria-label', enabled ? `关闭${label}` : '开启环境音乐');
    soundButton.title = loading ? `正在开启${label}` : `${enabled ? label : '环境音乐'} · M`;
    soundButton.dataset.track = track;
  }

  function setSpeed(value) {
    document.querySelectorAll('[data-speed]').forEach((button) => {
      const active = Number(button.dataset.speed) === value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function setDistance(meters) {
    $('distance-value').textContent = Math.max(0, Math.floor(meters)).toLocaleString('en-US');
  }

  function setLandmark({ title, description, index = 0 }) {
    if (pendingChapter === index) return;
    const currentVersion = ++chapterVersion;
    const card = document.querySelector('.landmark-card');
    const update = () => {
      if (currentVersion !== chapterVersion) return;
      $('landmark-title').textContent = title;
      $('landmark-description').textContent = description;
      $('landmark-index').textContent = String(index + 1).padStart(2, '0');
      document.querySelectorAll('[data-landmark]').forEach((button) => {
        const active = Number(button.dataset.landmark) === index;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      card.style.opacity = '';
      card.style.transform = '';
      activeChapter = index;
      pendingChapter = null;
    };
    if (activeChapter !== index) {
      pendingChapter = index;
      card.style.opacity = '0';
      card.style.transform = 'translateY(5px)';
      setTimeout(update, 320);
    } else update();
  }

  function setLoading(progress) {
    const safeProgress = Math.max(0, Math.min(1, progress));
    $('startup-progress').style.width = `${safeProgress * 100}%`;
    if (safeProgress >= 1 && !loadingFinished) {
      loadingFinished = true;
      requestAnimationFrame(() => $('startup').classList.add('is-complete'));
    }
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').classList.add('is-visible');
    toastTimer = setTimeout(() => $('toast').classList.remove('is-visible'), 2600);
  }

  function setVisible(visible) {
    root.classList.toggle('ui-hidden', !visible);
    if (!visible) setTimePanel(false);
  }

  function setTimePanel(open) {
    timePanel.hidden = !open;
    timeButton.setAttribute('aria-expanded', String(open));
  }

  function setTimeState({ mode = 'auto', hour, period = 'day', label, timeText } = {}) {
    const labels = { morning: '清晨', day: '白昼', evening: '黄昏', night: '月夜' };
    const safePeriod = Object.hasOwn(labels, period) ? period : 'day';
    root.dataset.period = safePeriod;
    root.dataset.timeMode = mode;
    let clock = timeText;
    if (!clock && Number.isFinite(hour)) {
      const minutes = Math.floor(((hour % 24 + 24) % 24) * 60 + 0.000001);
      clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    }
    if (!clock) clock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
    const phaseLabel = label || labels[safePeriod];
    $('time-value').textContent = clock;
    $('time-value').dateTime = clock;
    $('time-label').textContent = phaseLabel;
    timeButton.setAttribute('aria-label', `${mode === 'auto' ? '北京时间' : '光景预览'} ${clock}，${phaseLabel}，选择光景`);
    timeButton.title = mode === 'auto' ? '正在跟随北京时间' : `${phaseLabel}预览，点击可返回实时时间`;
    $('time-auto-dot').hidden = mode !== 'auto';
    timePanel.querySelectorAll('[data-time-mode]').forEach((button) => {
      const active = button.dataset.timeMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function setSources(sources) {
    const container = $('source-links');
    container.replaceChildren(...sources.map(({ title, url }) => {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = title;
      const arrow = document.createElement('span');
      arrow.textContent = '↗';
      link.append(arrow);
      return link;
    }));
  }

  function setLandmarks(landmarks) {
    document.querySelector('.chapter-dots').replaceChildren(...landmarks.map((landmark, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `chapter-dot${index === 0 ? ' is-active' : ''}`;
      button.dataset.landmark = index;
      button.dataset.landmarkId = landmark.id;
      button.title = landmark.title;
      button.setAttribute('aria-label', `前往${landmark.title}`);
      button.setAttribute('aria-pressed', String(index === 0));
      button.disabled = !actions.jumpToLandmark;
      return button;
    }));
  }

  return { setJourney, setPaused, setSound, setDistance, setLandmark, setLoading, toast, setSpeed, setVisible, setSources, setLandmarks, setTimeState, isDialogOpen: () => dialog.open };
}
