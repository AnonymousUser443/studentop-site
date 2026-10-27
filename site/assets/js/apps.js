/* =====================================================================
   应用注册表
   ===================================================================== */
(function () {
  'use strict';
  var defs = window.__APP_DEFS || [];
  window.Win = window.Win || {};
  var map = {};
  defs.forEach(function (d) { map[d.id] = d; });
  window.Win.apps = map;
  window.Win.appList = function () {
    return (window.SITE.startPinned || []).map(function (id) { return map[id]; }).filter(Boolean);
  };
})();
