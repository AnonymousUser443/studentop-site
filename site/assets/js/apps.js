/* =====================================================================
   应用注册表
   ===================================================================== */
(function () {
  'use strict';
  var defs = window.__APP_DEFS || [];
  // Deployment destinations live at registry assembly: retain the existing original
  // subdomain; campus and voxel are independent paths on the main site.
  var projectUrls = {
    'genshin-start': 'https://studentop.cn:14355/campus-entry/',
    'genshin-original': 'https://genshin.studentop.cn:14355/',
    'voxel-campus': 'https://studentop.cn:14355/voxel-campus/',
    'liyun-moyuan': 'https://studentop.cn:14355/liyun-moyuan/'
  };
  // Separate from the retained genshin-start campus shortcut; core resolves loopback development URLs.
  if (!defs.some(function (def) { return def.id === 'genshin-original'; })) {
    defs.push({
      id: 'genshin-original',
      title: '原神启动 · 原版',
      desktopLabel: '原神启动（原版）',
      icon: 'genshin-original',
      external: projectUrls['genshin-original'],
      shortcutHint: '原版天空与开门动画 · 新标签页 · 本地恢复，尚未部署',
      keywords: 'genshin original legacy 原神 原版 启动 天空 开门 独立 快捷方式'
    });
  }
  if (!defs.some(function (def) { return def.id === 'voxel-campus'; })) {
    defs.push({
      id: 'voxel-campus',
      title: '体素校园',
      desktopLabel: '体素校园',
      icon: 'voxel-campus',
      external: projectUrls['voxel-campus'],
      shortcutHint: '独立体素校园应用 · 在新标签页打开',
      keywords: 'voxel campus 体素 校园 良乡 方块 漫游 独立 快捷方式'
    });
  }
  if (!defs.some(function (def) { return def.id === 'liyun-moyuan'; })) {
    defs.push({
      id: 'liyun-moyuan',
      title: '理韵墨苑',
      desktopLabel: '理韵墨苑',
      icon: 'liyun-moyuan',
      external: projectUrls['liyun-moyuan'],
      shortcutHint: '理韵文化协会活动室 · 体素复原 · 在新标签页打开',
      keywords: 'liyun moyuan 理韵 墨苑 文化 协会 活动室 体素 书法 国画 漫游 独立 快捷方式'
    });
  }

  if (!defs.some(function (def) { return def.id === 'zhuiguang'; })) {
    defs.push({
      id: 'zhuiguang',
      title: '追光者 · 正式演讲',
      desktopLabel: '追光者',
      icon: 'zhuiguang',
      external: 'https://studentop.cn:14355/zhuiguang/?role=display&motion=on',
      shortcutHint: '打开大屏并准备离线资源',
      keywords: '追光者 睿信之星 演讲 主舞台 zhuiguang'
    });
  }
  defs.forEach(function (def) {
    if (Object.prototype.hasOwnProperty.call(projectUrls, def.id)) def.external = projectUrls[def.id];
  });
  window.Win = window.Win || {};
  var map = Object.create(null);
  defs.forEach(function (d) { map[d.id] = d; });
  window.Win.apps = map;
  window.Win.appList = function () {
    var ids = (window.SITE.startPinned || []).slice();
    Object.keys(map).forEach(function (id) { if (ids.indexOf(id) === -1) ids.push(id); });
    return ids.map(function (id) { return map[id]; }).filter(Boolean);
  };
})();
