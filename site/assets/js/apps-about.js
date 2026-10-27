/* =====================================================================
   内容类应用：关于我 / 项目作品 / 技能 / 联系我 / 简历
   ===================================================================== */
(function () {
  'use strict';
  var defs = window.__APP_DEFS = window.__APP_DEFS || [];
  var esc = function (s) { return Win.esc(s); };

  function linkIcon(name) { return '<span class="btn-ico">' + ICONS.glyph(name) + '</span>'; }

  /* ======================= 关于我 ======================= */
  defs.push({
    id: 'about',
    title: '关于我',
    desktopLabel: '关于我',
    icon: 'about',
    keywords: 'about 个人 简介 自我介绍 关于',
    width: 940,
    height: 712,
    minWidth: 620,
    minHeight: 420,
    render: function (body) {
      var p = window.SITE.profile;
      var bio = (p.bio || []).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
      var facts = (p.facts || []).map(function (f) {
        return '<div class="fact-card"><span class="fact-icon">' + ICONS.app('skills') + '</span>' +
          '<div class="fact-text"><span class="fact-label">' + esc(f.label) + '</span>' +
          '<span class="fact-value">' + esc(f.value) + '</span></div></div>';
      }).join('');
      var links = (p.links || []).filter(function (l) { return l.url; }).map(function (l) {
        var inner = '<span class="link-icon">' + ICONS.glyph(l.icon) + '</span>' +
          '<span class="link-text"><span class="link-label">' + esc(l.label) + '</span>' +
          '<span class="link-display">' + esc(l.display || l.url) + '</span></span>' +
          '<span class="link-arrow">' + ICONS.glyph('external') + '</span>';
        if (l.url.indexOf('mailto:') === 0) {
          return '<button type="button" class="link-row" data-copy="' + esc(l.display) + '">' + inner + '</button>';
        }
        return '<a class="link-row" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>';
      }).join('');

      body.innerHTML =
        '<div class="app about-app">' +
          '<header class="about-hero">' +
            '<div class="about-hero-left">' +
              '<span class="avatar xl">' + esc(p.avatarText || 'A') + '</span>' +
              '<div class="about-id">' +
                '<h1>' + esc(p.name) + '<span class="about-handle">' + esc(p.handle) + '</span></h1>' +
                '<p class="about-role">' + esc(p.role) + '</p>' +
                '<p class="about-status"><span class="status-dot"></span>' + esc(p.status) + '</p>' +
              '</div>' +
            '</div>' +
            '<div class="about-hero-right">' +
              '<div class="about-loc">' + ICONS.glyph('home') + '<span>' + esc(p.school) + '</span></div>' +
              '<div class="about-loc">' + ICONS.glyph('globe') + '<span>' + esc(p.domain) + '</span></div>' +
            '</div>' +
          '</header>' +
          '<div class="about-quote">' + esc(p.tagline) + '</div>' +
          '<section class="about-section"><h2>关于我</h2><div class="about-bio">' + bio + '</div></section>' +
          '<section class="about-section"><h2>一些事实</h2><div class="about-facts">' + facts + '</div></section>' +
          '<section class="about-section"><h2>找到我</h2><div class="about-links">' + links + '</div></section>' +
          '<footer class="app-footer">' + esc(window.SITE.footer) + '</footer>' +
        '</div>';

      body.querySelectorAll('[data-copy]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var text = btn.getAttribute('data-copy');
          copyText(text, btn);
        });
      });
    }
  });

  function copyText(text, btn) {
    function done() {
      Win.notify({ icon: 'check', title: '已复制', body: text });
      if (btn) {
        btn.classList.add('is-copied');
        setTimeout(function () { btn.classList.remove('is-copied'); }, 900);
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) {}
      document.body.removeChild(ta);
    }
  }

  /* ======================= 项目作品 ======================= */
  defs.push({
    id: 'projects',
    title: '项目作品',
    desktopLabel: '项目作品',
    icon: 'projects',
    keywords: 'projects 项目 作品 代码 开源',
    width: 1000,
    height: 680,
    minWidth: 640,
    minHeight: 440,
    render: function (body) {
      var projects = window.SITE.projects || [];
      var tags = ['全部'];
      projects.forEach(function (p) {
        (p.tags || []).forEach(function (t) { if (tags.indexOf(t) === -1) tags.push(t); });
      });

      body.innerHTML =
        '<div class="app projects-app">' +
          '<div class="app-toolbar">' +
            '<div class="filter-chips" id="projectFilters">' +
              tags.map(function (t, i) {
                return '<button type="button" class="chip' + (i === 0 ? ' is-active' : '') + '" data-filter="' + esc(t) + '">' + esc(t) + '</button>';
              }).join('') +
            '</div>' +
            '<div class="toolbar-meta">' + projects.length + ' 个项目</div>' +
          '</div>' +
          '<div class="project-grid" id="projectGrid"></div>' +
        '</div>';

      var grid = body.querySelector('#projectGrid');

      function render(filter) {
        grid.innerHTML = '';
        var list = projects.filter(function (p) {
          return filter === '全部' || (p.tags || []).indexOf(filter) > -1;
        });
        if (!list.length) {
          grid.innerHTML = '<div class="empty-state">这个分类下还没有项目。</div>';
          return;
        }
        list.forEach(function (p) {
          var card = document.createElement('article');
          card.className = 'project-card';
          card.innerHTML =
            '<div class="pc-head">' +
              '<span class="pc-icon">' + ICONS.app(p.icon || 'projects') + '</span>' +
              '<span class="pc-year">' + esc(p.year || '') + '</span>' +
            '</div>' +
            '<h3 class="pc-title">' + esc(p.title) + '</h3>' +
            '<p class="pc-sub">' + esc(p.subtitle) + '</p>' +
            '<p class="pc-desc">' + esc(p.desc) + '</p>' +
            '<div class="pc-tags">' + (p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>' +
            '<div class="pc-foot">' +
              '<span class="pc-id">#' + esc(p.id) + '</span>' +
              (p.link ? '<a class="btn btn-small" href="' + esc(p.link) + '" target="_blank" rel="noopener noreferrer">' + linkIcon('external') + '打开</a>' : '<span class="pc-muted">私下维护</span>') +
            '</div>';
          grid.appendChild(card);
        });
      }
      render('全部');

      body.querySelector('#projectFilters').addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        body.querySelectorAll('#projectFilters .chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        render(chip.getAttribute('data-filter'));
      });
    }
  });

  /* ======================= 技能 ======================= */
  defs.push({
    id: 'skills',
    title: '技能',
    desktopLabel: '技能',
    icon: 'skills',
    keywords: 'skills 技能 能力 技术栈 熟悉',
    width: 900,
    height: 620,
    minWidth: 600,
    minHeight: 400,
    render: function (body) {
      var groups = window.SITE.skills || [];
      body.innerHTML =
        '<div class="app skills-app">' +
          '<div class="app-hero-text">' +
            '<h2>我会些什么</h2>' +
            '<p>百分比只是给自己的一个模糊坐标，真正的东西都在项目里。</p>' +
          '</div>' +
          '<div class="skill-grid">' +
            groups.map(function (g, gi) {
              return '<section class="skill-card" style="animation-delay:' + (gi * 60) + 'ms">' +
                '<header class="skill-head"><span class="skill-icon">' + ICONS.app(g.icon || 'skills') + '</span>' +
                '<h3>' + esc(g.group) + '</h3></header>' +
                '<ul class="skill-list">' +
                  (g.items || []).map(function (s) {
                    return '<li><div class="sk-top"><span>' + esc(s.name) + '</span><span class="sk-num">' + s.level + '%</span></div>' +
                      '<div class="sk-bar"><i data-level="' + s.level + '"></i></div></li>';
                  }).join('') +
                '</ul>' +
              '</section>';
            }).join('') +
          '</div>' +
          '<div class="app-hint">' + ICONS.glyph('info') + ' <span>想聊某个方向？在「联系我」里写信给我。</span></div>' +
        '</div>';

      // 入场动画
      requestAnimationFrame(function () {
        setTimeout(function () {
          body.querySelectorAll('.sk-bar i').forEach(function (bar) {
            var level = parseFloat(bar.getAttribute('data-level')) || 0;
            bar.style.width = Math.max(2, Math.min(100, level)) + '%';
          });
        }, 120);
      });
    }
  });

  /* ======================= 联系我 ======================= */
  defs.push({
    id: 'contact',
    title: '联系我',
    desktopLabel: '联系我',
    icon: 'contact',
    keywords: 'contact 联系 邮件 邮箱 找我 微信',
    width: 900,
    height: 640,
    minWidth: 600,
    minHeight: 440,
    render: function (body) {
      var p = window.SITE.profile;
      var c = window.SITE.contact || {};
      body.innerHTML =
        '<div class="app contact-app">' +
          '<div class="contact-hero">' +
            '<div class="contact-hero-text">' +
              '<h2>' + esc(c.title || '来聊点什么吧') + '</h2>' +
              '<p>' + esc(c.desc) + '</p>' +
            '</div>' +
            '<button type="button" class="mail-pill" id="copyMail">' + ICONS.glyph('mail') +
              '<span>' + esc(p.email) + '</span>' + ICONS.glyph('copy') + '</button>' +
          '</div>' +
          '<div class="contact-topics">' +
            (c.topics || []).map(function (t) {
              return '<div class="topic-card"><span class="topic-icon">' + ICONS.app('skills') + '</span>' +
                '<h3>' + esc(t.title) + '</h3><p>' + esc(t.desc) + '</p></div>';
            }).join('') +
          '</div>' +
          '<form class="contact-form" id="contactForm" novalidate>' +
            '<div class="form-title">' + ICONS.glyph('pencil') + '<span>写一封邮件</span></div>' +
            '<div class="form-row">' +
              '<label class="field"><span>你的名字</span><input type="text" name="name" placeholder="怎么称呼你？" autocomplete="name" required></label>' +
              '<label class="field"><span>你的邮箱</span><input type="email" name="email" placeholder="you@example.com" autocomplete="email" required></label>' +
            '</div>' +
            '<label class="field"><span>想说的话</span><textarea name="message" rows="5" placeholder="写点什么…" required></textarea></label>' +
            '<div class="form-foot">' +
              '<span class="form-note">' + ICONS.glyph('info') + esc(c.formNote) + '</span>' +
              '<button type="submit" class="btn btn-primary">' + ICONS.glyph('send') + '发送邮件</button>' +
            '</div>' +
          '</form>' +
        '</div>';

      body.querySelector('#copyMail').addEventListener('click', function () { copyText(p.email, null); });
      body.querySelector('#contactForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var form = e.currentTarget;
        var name = form.elements.name.value.trim();
        var from = form.elements.email.value.trim();
        var message = form.elements.message.value.trim();
        if (!message) { Win.notify({ icon: 'info', title: '还差一点点', body: '至少写一句想说的话吧。' }); form.elements.message.focus(); return; }
        var subject = encodeURIComponent('[个人主页] 来自 ' + (name || '一位访客') + ' 的消息');
        var bodyText = encodeURIComponent(message + '\n\n—— ' + (name || '匿名') + (from ? '（' + from + '）' : ''));
        window.location.href = 'mailto:' + p.email + '?subject=' + subject + '&body=' + bodyText;
        Win.notify({ icon: 'send', title: '邮件已准备好', body: '如果没弹出邮件应用，可以直接复制邮箱联系我。' });
      });
    }
  });

  /* ======================= 简历 ======================= */
  defs.push({
    id: 'cv',
    title: '简历',
    desktopLabel: '简历',
    icon: 'cv',
    keywords: 'resume cv 简历 经历 教育',
    width: 860,
    height: 700,
    minWidth: 620,
    minHeight: 480,
    render: function (body) {
      var p = window.SITE.profile;
      var skills = window.SITE.skills || [];
      var projects = window.SITE.projects || [];
      body.innerHTML =
        '<div class="app cv-app">' +
          '<header class="cv-head">' +
            '<div class="cv-id"><span class="avatar lg">' + esc(p.avatarText || 'A') + '</span>' +
              '<div><h1>' + esc(p.name) + '</h1><p>' + esc(p.role) + '</p></div></div>' +
            '<div class="cv-contact">' +
              '<span>' + ICONS.glyph('mail') + esc(p.email) + '</span>' +
              '<span>' + ICONS.glyph('home') + esc(p.school) + '</span>' +
              '<span>' + ICONS.glyph('globe') + esc(p.domain) + '</span>' +
            '</div>' +
          '</header>' +
          '<section class="cv-section"><h2>个人简介</h2><p class="cv-text">' + esc((p.bio || [])[0] || '') + '</p></section>' +
          '<section class="cv-section"><h2>教育经历</h2>' +
            '<div class="cv-item"><div class="cv-item-head"><h3>' + esc(p.school) + '</h3><span>本科在读</span></div>' +
            '<p class="cv-text">在校期间主要在做 Web 前端、Python 后端与树莓派相关的个人项目，喜欢把学到的东西做成能跑起来的东西。</p></div>' +
          '</section>' +
          '<section class="cv-section"><h2>技能</h2><div class="cv-skill-tags">' +
            skills.map(function (g) {
              return g.items.map(function (s) { return '<span class="tag">' + esc(s.name) + '</span>'; }).join('');
            }).join('') +
          '</div></section>' +
          '<section class="cv-section"><h2>项目经历</h2>' +
            projects.map(function (pr) {
              return '<div class="cv-item"><div class="cv-item-head"><h3>' + esc(pr.title) + '</h3><span>' + esc(pr.year || '') + '</span></div>' +
                '<p class="cv-text">' + esc(pr.desc) + '</p></div>';
            }).join('') +
          '</section>' +
          '<footer class="app-footer">这份简历由主页自动生成 · ' + esc(p.domain) + '</footer>' +
        '</div>';
    }
  });

  /* ======================= 外部项目快捷方式 =======================
     这两项不是站内窗口，而是「快捷方式」：双击桌面图标、开始菜单或搜索命中后，
     由窗口管理器（wm.js）直接在新标签页打开对应项目站点。
     ============================================================== */
  defs.push({
    id: 'frost-atlas',
    title: '北湖霜降雅集',
    desktopLabel: '北湖霜降雅集',
    icon: 'frost',
    external: 'https://frost.studentop.cn:14355/',
    shortcutHint: '理韵文化协会 2026 霜降雅集 · 北湖交互游园图（Node 24 + SQLite，跑在树莓派上）',
    keywords: 'frost shuangjiang 霜降 北湖 雅集 游园 地图 明信片 理韵 快捷方式'
  });

  defs.push({
    id: 'genshin-start',
    title: '原神启动',
    desktopLabel: '原神启动',
    icon: 'genshin',
    external: 'https://genshin.studentop.cn:14355/',
    shortcutHint: '3D 开场：点开始 → 沿路前行 → 点击开门 → 白光过场后进入理韵寻踪',
    keywords: 'genshin 原神 启动 开场 开门 three.js webgl 理韵寻踪 快捷方式'
  });

  defs.push({
    id: 'liyun-explorer',
    title: '理韵寻踪',
    desktopLabel: '理韵寻踪',
    icon: 'liyun',
    external: 'https://liyun.studentop.cn:14355/',
    shortcutHint: '软件工程导论研究型课程 · 北理校园探索 HUD（React + p5.js）',
    keywords: 'liyun xunzong 理韵 寻踪 校园 探索 HUD react p5 快捷方式'
  });

})();
