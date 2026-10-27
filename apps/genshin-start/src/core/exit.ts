/* ============================================================================
   开门之后的去向（本部署的唯一业务改动）
   ----------------------------------------------------------------------------
   原项目在「开门」白光过场后会把页面跳到作者自己的 B 站视频；这里改为进入
   「理韵寻踪」站点：https://liyun.studentop.cn:14355/

   想让开场导向别处，有两种方式，都不用改代码逻辑：
     1) 在 index.html 里加 <script>window.__EXIT_URL__='https://…/'</script>
     2) 直接改下面的 DEFAULT_EXIT_URL
   ========================================================================== */
export const DEFAULT_EXIT_URL = 'https://liyun.studentop.cn:14355/';
export const EXIT_LABEL = '理韵寻踪';

declare global {
  interface Window { __EXIT_URL__?: string }
}

/** 实际跳转地址：允许页面在加载前用 window.__EXIT_URL__ 覆盖（只接受 http/https） */
export function exitUrl(): string {
  const override = typeof window !== 'undefined' ? window.__EXIT_URL__ : '';
  return override && /^https?:\/\//i.test(override) ? override : DEFAULT_EXIT_URL;
}

let leaving = false;

/** 离开开场、进入目标站点。用 href 而非 replace：用户按返回键还能再看一遍开场。 */
export function goExit(reason: string = 'door'): void {
  if (leaving) return;
  leaving = true;
  const target = exitUrl();
  try { console.info('[开门] → ' + target + '  (' + reason + ')'); } catch (e) { /* ignore */ }
  window.location.href = target;
}
