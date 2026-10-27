// 管理凭据只存在此模块内存；不持久化，不附于 URL。
const $ = selector => document.querySelector(selector);
const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const count = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('zh-CN') : '—';
const arts = { poetry:['诗','寻霜'], leaves:['拾','藏秋'], writing:['书','题秋'], tea:['茶','问茶'], incense:['香','闻香'], flowers:['花','寻芳'] };
const pinNames = { entry:'投递口 · entry', ending:'落款处 · ending' };
const eventNames = { 'screen.open':'打开活动窗口', 'screen.letter':'查阅霜信', 'screen.help':'查看游园指引', 'photo.collected':'收录六艺照片', 'postcard.download':'下载明信片', 'auth.register':'登记入册', 'auth.login':'登录档案', 'auth.logout':'退出登录', 'auth.reset':'重新选择词牌', 'checkin.collect':'首次收录六艺', 'checkin.replace':'替换六艺照片', 'inscription.save':'保存题签', 'postcard.save':'保存明信片', 'config.pins.save':'保存点位', 'admin.inscription':'管理题签', 'admin.inscription.save':'管理员修改题签', 'admin.reset':'签发词牌重置凭据', 'admin.reset.issue':'签发词牌重置凭据', 'admin.sessions.revoke':'撤销用户会话', 'admin.seal':'点位封箱' };
function eventLabel(type) { return eventNames[type] || (String(type).startsWith('admin.') ? '管理操作' : '活动记录'); }
const titles = { overview:['总览 · 秋事总簿','一湖秋事，逐笔有据。'], users:['名籍 · 参与者档案','归档的是经历，维护的是每一封秋信。'], logs:['纪事 · 往来日志','事件有时，入簿有据。'], storage:['典藏 · 库房与点位','核对落盘，审慎封箱。'] };
let credential = '', authGeneration = 0, currentView = 'overview', overview = null, pollTimer = null, polling = true;
let userPage = 1, logPage = 1, logUser = '', logUserName = '', userRequest = 0, logRequest = 0, drawerRequest = 0, storageRequest = 0, overviewBusy = false;
let drawerUser = null, resetHideTimer = null, storageConfig = null;
const controllers = new Set(), mediaUrls = new Set();
const drawer = $('#user-drawer');

function time(value, dateOnly = false) {
  if (!value) return '—';
  const date = new Date(value); if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', { timeZone:'Asia/Shanghai', month:'2-digit', day:'2-digit', ...(dateOnly ? {} : { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false }) }).format(date);
}
function bytes(value) { const n = Number(value); if (!Number.isFinite(n)) return '—'; return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`; }
function status(message = '', error = false) { $('#status').textContent = message; $('#status').dataset.error = String(error); }
function drawerStatus(message = '', error = false) { const node = $('#drawer-status'); if (node) { node.textContent = message; node.dataset.error = String(error); } }
function empty(message) { return `<p class="empty-state">${html(message)}</p>`; }
function errorPanel(message) { return `<p class="error-panel">${html(message)}</p>`; }
function isCurrent(generation) { return credential && generation === authGeneration; }

async function api(path, { method = 'GET', data, binary = false } = {}) {
  if (!credential) throw new Error('请先核验管理凭据。');
  const generation = authGeneration, controller = new AbortController(); controllers.add(controller);
  try {
    const response = await fetch(path, { method, cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer', signal:controller.signal, headers:{ Authorization:`Bearer ${credential}`, ...(data !== undefined ? { 'Content-Type':'application/json' } : {}) }, ...(data !== undefined ? { body:JSON.stringify(data) } : {}) });
    if (!isCurrent(generation)) throw new DOMException('请求已失效', 'AbortError');
    if (response.status === 401 || response.status === 403) { logout(false); throw new Error('管理凭据无效或访问被拒绝，请重新核验。'); }
    if (!response.ok) { const value = await response.json().catch(() => null); throw new Error(value?.error?.message || value?.message || `读取失败（${response.status}）。`); }
    const value = binary ? await response.blob() : await response.json();
    if (!isCurrent(generation)) throw new DOMException('请求已失效', 'AbortError');
    return value;
  } finally { controllers.delete(controller); }
}

function releaseMedia() { for (const url of mediaUrls) URL.revokeObjectURL(url); mediaUrls.clear(); }
function hideReset() { clearTimeout(resetHideTimer); const output = $('#reset-token'); if (output) output.textContent = ''; const panel = $('#reset-result'); if (panel) panel.hidden = true; }
function closeFile() { drawerRequest++; drawerUser = null; hideReset(); releaseMedia(); if (drawer.open) drawer.close(); $('#drawer-content').replaceChildren(); }
function logout(focus = true) {
  credential = ''; authGeneration++; clearTimeout(pollTimer); pollTimer = null; overview = null; overviewBusy = false; storageConfig = null;
  for (const controller of controllers) controller.abort(); controllers.clear();
  $('#admin-token').value = ''; closeFile(); $('#authenticated').hidden = true; $('#login-section').hidden = false;
  for (const id of ['overview-content','users-content','logs-content','storage-content','users-pagination','logs-pagination']) $(`#${id}`).replaceChildren();
  userPage = 1; logPage = 1; logUser = ''; logUserName = ''; currentView = 'overview';
  for (const id of ['user-query','log-query','log-type','log-source']) $(`#${id}`).value = '';
  $('#users-count').textContent = '尚未读取';
  $('#log-scope').textContent = '客户端行为与服务端审计分别记载';
  $('#drawer-title').textContent = '参与者档案';
  $('#sync-message').textContent = '正在读取簿册';
  $('#page-title').textContent = titles.overview[0]; $('#page-intro').textContent = titles.overview[1];
  for (const button of document.querySelectorAll('[data-view]')) { button.removeAttribute('aria-current'); if (button.dataset.view === 'overview') button.setAttribute('aria-current','page'); }
  for (const section of document.querySelectorAll('.chapter-view')) section.hidden = section.id !== 'view-overview';
  $('#connection-state').textContent = '尚未开簿'; status('');
  if (focus) $('#admin-token').focus();
}

function sourceLabel(source) { return source === 'audit' ? '服务端审计' : '客户端交互'; }
function eventDetail(detail, key = '') { let value; try { value = typeof detail === 'string' ? detail : JSON.stringify(detail ?? {}, null, 2); } catch { value = '无法展示记录详情'; } return `<details data-record-key="${html(key)}"><summary>查看记录详情</summary><pre>${html(value)}</pre></details>`; }
function eventRows(items, names = true) {
  return items.map(item => `<tr><td class="time-cell">${html(time(item.at))}<small>入簿 ${html(time(item.recordedAt))}</small></td>${names ? `<td>${item.userId ? `<button class="text-button person-name" data-user="${html(item.userId)}">${html(item.name || '未命名')}</button><span class="person-id">${html(item.studentId || item.userId)}</span>` : '<span class="muted">系统记录</span>'}</td>` : ''}<td><span class="source-mark ${item.source === 'audit' ? 'audit' : ''}">${sourceLabel(item.source)}</span></td><td class="event-detail"><span class="event-type">${html(eventLabel(item.type))}</span><span class="person-id">${html(item.type)}</span>${eventDetail(item.detail, `${item.source}:${item.id}`)}</td></tr>`).join('');
}
function logTable(items) { return items.length ? `<div class="ledger-table-wrap"><table class="ledger-table"><thead><tr><th scope="col">事件时间 / 入簿时间 · 北京时间</th><th scope="col">参与者</th><th scope="col">记录来源</th><th scope="col">事件与详情</th></tr></thead><tbody>${eventRows(items)}</tbody></table></div>` : empty('此页尚无符合条件的记录。'); }
function trend(daily) {
  if (!daily?.length) return empty('暂无每日统计记录。');
  const width = 600, height = 150, pad = 25, max = Math.max(1, ...daily.flatMap(row => [Number(row.events) || 0, Number(row.checkins) || 0, Number(row.registrations) || 0]));
  const x = index => pad + index * (width - pad * 2) / Math.max(1, daily.length - 1), y = value => height - 22 - (Number(value) || 0) / max * (height - 40);
  const lines = [['events','#234c3e','交互记录'],['checkins','#a48946','六艺收录'],['registrations','#a74732','登记入册']].map(([key,color,label]) => `<polyline points="${daily.map((row,index) => `${x(index)},${y(row[key])}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.8"/>${daily.map((row,index) => `<circle cx="${x(index)}" cy="${y(row[key])}" r="2" fill="${color}"><title>${html(row.day)} ${label} ${count(row[key])}</title></circle>`).join('')}`).join('');
  return `<div class="chart-wrap"><svg class="trend-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="最近十四日 UTC 统计。详细数值见后方展开表格。">${[0, .5, 1].map(fraction => `<path d="M${pad},${y(max * fraction)}H${width-pad}" stroke="#b8b195" stroke-width=".6" stroke-dasharray="3 5"/><text x="5" y="${y(max*fraction)+3}">${Math.round(max*fraction)}</text>`).join('')}${lines}${daily.map((row,index) => index % 3 === 0 || index === daily.length-1 ? `<text x="${x(index)}" y="148" text-anchor="middle">${html(String(row.day).slice(5))}</text>` : '').join('')}</svg></div><div class="chart-legend"><span><i></i>交互记录</span><span><i class="gold"></i>六艺收录</span><span><i class="red"></i>登记入册</span></div><details class="fine-print"><summary>查看逐日数值 · UTC</summary><div class="ledger-table-wrap"><table class="ledger-table"><thead><tr><th>日期 · UTC</th><th>交互</th><th>六艺收录</th><th>登记</th></tr></thead><tbody>${daily.map(row => `<tr><td>${html(row.day)}</td><td>${count(row.events)}</td><td>${count(row.checkins)}</td><td>${count(row.registrations)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function renderOverview(value) {
  const total = value.totals || {}, artRows = value.arts || [];
  if (!$('#overview-metrics')) {
    $('#overview-content').innerHTML = `<dl class="ledger-summary" id="overview-metrics">${[['users','已登记参与者','人','名籍已写入数据库'],['checkins','六艺照片收录','份','按已保存点位照片计'],['postcards','生成明信片','封','已保存的明信片记录'],['activeUsers24h','近 24 小时有记录','人','有活动记录，非在线人数']].map(([key,label,unit,note]) => `<div class="ledger-number"><dt>${label}</dt><dd><span data-total="${key}">${count(total[key])}</span><small>${unit}</small></dd><p>${note}</p></div>`).join('')}</dl>
      <div class="overview-columns"><section><div class="subheading"><h3>十四日秋事</h3><span>按 UTC 自然日归档</span></div><div id="trend-content"></div><p class="fine-print" id="trend-hold" hidden>逐日明细正在查阅，图表保留展开时的状态；收起后更新。上方总数仍正常同步。</p></section>
      <section><div class="subheading"><h3>六艺收录簿</h3><span>已保存照片</span></div><div class="arts-ledger">${Object.entries(arts).map(([id,[character,name]]) => `<div class="art-stat"><span class="art-character">${character}</span><div><strong data-art-count="${id}">0</strong><small>${name}</small></div></div>`).join('')}</div><p class="rule-note">每 5 秒同步已落盘记录；不代表在线人数或未提交行为。页面切到后台时暂停自动同步。</p><div class="overview-meta"><span>未过期会话 <b data-total="activeSessions">0</b></span><span>交互 <b data-total="events">0</b></span><span>审计 <b data-total="audit">0</b></span></div><p class="fine-print">未过期会话只表示凭据仍有效，不表示设备正在使用。</p></section></div>
      <div class="section-heading"><div><span class="section-index">新 近 入 簿</span><h2>来往一览</h2></div><button class="text-button" data-go="logs">查阅全部纪事 ↗</button></div><p class="fine-print" id="recent-hold" hidden>为保留当前焦点和展开内容，此列表暂保留查阅时的记录；收起详情并离开列表后更新。</p><div id="recent-content"></div>`;
  }
  for (const node of document.querySelectorAll('[data-total]')) node.textContent = count(total[node.dataset.total]);
  for (const node of document.querySelectorAll('[data-art-count]')) node.textContent = count(artRows.find(row => row.artId === node.dataset.artCount)?.count || 0);
  updateOverviewSections(value);
}
function updateOverviewSections(value) {
  // A polling response must not replace the focused button or an open disclosure.
  for (const [id, holdId, payload, render] of [['trend-content','trend-hold',value.daily,trend],['recent-content','recent-hold',value.recent || [],logTable]]) {
    const node = $(`#${id}`); if (!node) continue;
    const signature = JSON.stringify(payload), busy = node.contains(document.activeElement) || Boolean(node.querySelector('details[open]'));
    if (node.dataset.signature !== signature && busy) { $(`#${holdId}`).hidden = false; continue; }
    if (node.dataset.signature !== signature) { node.innerHTML = render(payload); node.dataset.signature = signature; }
    $(`#${holdId}`).hidden = true;
  }
}

async function refreshOverview({ silent = false } = {}) {
  if (!credential || overviewBusy) return;
  const generation = authGeneration; overviewBusy = true;
  try {
    const value = await api('/api/admin/overview'); if (!isCurrent(generation)) return; overview = value;
    $('#connection-state').textContent = `已开簿 · ${time(value.generatedAt)}`;
    $('#sync-message').textContent = `最近核对 ${time(value.generatedAt)} · 每 5 秒同步已落盘记录`;
    $('#sync-lamp').dataset.error = 'false';
    if (currentView === 'overview') renderOverview(value);
    if (!silent) status('已与服务端簿册核对。');
  } catch (error) { if (error.name !== 'AbortError') { $('#sync-message').textContent = '同步未完成，保留上次核对结果'; $('#sync-lamp').dataset.error = 'true'; status(error.message, true); } }
  finally { if (generation === authGeneration) overviewBusy = false; }
}
function schedulePoll() { clearTimeout(pollTimer); if (!credential || !polling || document.hidden) return; pollTimer = setTimeout(async () => { await refreshOverview({silent:true}); schedulePoll(); }, 5000); }
function pagination(container, value, action) {
  const page = Number(value.page) || 1, size = Number(value.pageSize) || 30, total = Number(value.total) || 0, pages = Math.max(1, Math.ceil(total/size));
  container.innerHTML = `<span>共 ${count(total)} 条 · 第 ${page} / ${pages} 页</span><button type="button" data-page="${page-1}" data-list="${action}" ${page<=1?'disabled':''}>上一页</button><button type="button" data-page="${page+1}" data-list="${action}" ${page>=pages?'disabled':''}>下一页</button>`;
}
async function loadUsers() {
  const seq = ++userRequest, generation = authGeneration, q = $('#user-query').value.trim();
  $('#users-content').setAttribute('aria-busy','true');
  try {
    const value = await api(`/api/admin/users?${new URLSearchParams({q,page:String(userPage),pageSize:'30'})}`); if (!isCurrent(generation) || seq !== userRequest) return;
    $('#users-count').textContent = `${count(value.total)} 份档案 · 按最近记录排序`;
    $('#users-content').innerHTML = value.items?.length ? `<div class="ledger-table-wrap"><table class="ledger-table"><thead><tr><th scope="col">姓名 / 学号</th><th scope="col">入册时间</th><th scope="col">六艺收录</th><th scope="col">明信片</th><th scope="col">最近记录</th><th scope="col">有效会话</th><th scope="col">档案</th></tr></thead><tbody>${value.items.map(user => `<tr><td><span class="person-name">${html(user.name)}</span><span class="person-id">${html(user.studentId)}</span></td><td class="time-cell">${html(time(user.createdAt))}</td><td>${count(user.checkinCount)} / 6</td><td>${user.postcard ? '已归档' : '<span class="muted">未生成</span>'}</td><td class="time-cell">${html(time(user.lastActivity))}</td><td>${count(user.sessionCount)}<span class="person-id">非在线人数</span></td><td><button class="text-button" data-user="${html(user.id)}">调卷 ↗</button></td></tr>`).join('')}</tbody></table></div>` : empty(q ? '没有找到符合姓名或学号的档案。' : '尚无参与者登记。');
    pagination($('#users-pagination'), value, 'users');
  } catch (error) { if (error.name !== 'AbortError' && seq === userRequest && isCurrent(generation)) $('#users-content').innerHTML = errorPanel(error.message); }
  finally { if (seq === userRequest) $('#users-content').removeAttribute('aria-busy'); }
}
async function loadLogs() {
  const seq = ++logRequest, generation = authGeneration;
  const params = new URLSearchParams({q:$('#log-query').value.trim(),type:$('#log-type').value.trim(),source:$('#log-source').value,userId:logUser,page:String(logPage),pageSize:'30'});
  $('#logs-content').setAttribute('aria-busy','true');
  try { const value = await api(`/api/admin/logs?${params}`); if (!isCurrent(generation) || seq !== logRequest) return; $('#logs-content').innerHTML = logTable(value.items || []); pagination($('#logs-pagination'),value,'logs'); }
  catch (error) { if (error.name !== 'AbortError' && seq === logRequest && isCurrent(generation)) $('#logs-content').innerHTML = errorPanel(error.message); }
  finally { if (seq === logRequest) $('#logs-content').removeAttribute('aria-busy'); }
}
function renderLogScope() { const node = $('#log-scope'); node.replaceChildren(); if (logUser) { node.append(document.createTextNode(`正在查阅 ${logUserName || '此参与者'} 的全部日志 `)); const button = document.createElement('button'); button.type='button'; button.className='text-button'; button.dataset.clearScope='true'; button.textContent='清除此人筛选'; node.append(button); } else node.textContent='客户端行为与服务端审计分别记载'; }
function switchView(view, focus = true) {
  if (!titles[view]) return; currentView = view;
  for (const button of document.querySelectorAll('[data-view]')) button.toggleAttribute('aria-current',button.dataset.view === view), button.dataset.view === view && button.setAttribute('aria-current','page');
  for (const section of document.querySelectorAll('.chapter-view')) section.hidden = section.id !== `view-${view}`;
  $('#page-title').textContent = titles[view][0]; $('#page-intro').textContent=titles[view][1]; status('');
  if (!credential) { status('请先核验管理凭据。'); $('#admin-token').focus(); return; }
  if (view === 'overview' && overview) renderOverview(overview);
  else if (view === 'users') loadUsers(); else if (view === 'logs') { renderLogScope(); loadLogs(); } else if (view === 'storage') loadStorage();
  if (focus) { window.scrollTo({top:0,left:0,behavior:'instant'}); $('#page-title').focus({preventScroll:true}); }
}

function renderStorage(value) {
  const config = overview?.config || {}, runtime = overview?.runtime || {};
  // Seal the version actually shown to the administrator, never a newer polled version.
  storageConfig = { version:config.version, sealed:config.sealed };
  const entries = [['SQLite 主库',bytes(value.databaseBytes)],['WAL 日志',bytes(value.walBytes)],['共享内存 SHM',bytes(value.shmBytes)],['照片 BLOB',bytes(value.photoBytes)],['明信片 BLOB',bytes(value.postcardBytes)],['数据库页数',count(value.pageCount)],['空闲页数',count(value.freePages)],['日志模式',value.journalMode || '—'],['同步级别',value.synchronous || '—']];
  $('#storage-content').innerHTML = `<div class="section-heading"><div><span class="section-index">库 房</span><h2>已入库，仍须有据</h2></div><p class="annotation">读取真实文件大小与 SQLite 状态</p></div><div class="storage-grid"><section><dl class="storage-ledger">${entries.map(([label,value])=>`<div><dt>${html(label)}</dt><dd class="${String(value).length>11?'small-value':''}">${html(value)}</dd></div>`).join('')}</dl><p class="storage-note">照片与明信片字节为数据库中 BLOB 的合计，与主库文件体积有重叠，不应再次相加。WAL 尚未检查点合并不代表记录未提交。已提交也不等于断电、磁盘或设备故障下的绝对保证。</p><div class="integrity-box"><h3>落盘核对</h3><button class="ink-button" type="button" id="quick-check">执行 SQLite quick_check</button><output id="integrity-output">${value.integrityCheck ? html(`${time(value.checkedAt)} · ${(value.integrityCheck || []).join('；')}`) : '尚未执行本次手动检查。'}</output></div><p class="fine-print">Node ${html(runtime.nodeVersion || '—')} · 服务运行 ${count(Math.floor((runtime.uptimeSeconds || 0)/60))} 分钟 · 访问范围：本机回环</p></section><section><div class="subheading"><h3>点位封箱</h3><span>配置版本 ${html(config.version ?? '—')}</span></div><p class="seal-state">${config.sealed ? '已封箱 · 点位编辑关闭' : '内测开放 · 测试者可调整点位'}</p><dl class="pin-ledger">${(config.pins || []).map(pin=>`<dt>${html(pinNames[pin.id] || arts[pin.id]?.[1] || pin.id)}</dt><dd>${html(pin.x)}, ${html(pin.y)}</dd>`).join('') || '<dt>暂无点位记录</dt><dd>—</dd>'}</dl><div class="seal-actions"><button class="danger-button" type="button" id="seal-begin" ${config.sealed?'disabled':''}>核对并封箱</button><form id="seal-confirm" class="seal-confirm" hidden><p>封箱将全站关闭点位编辑。照片上传、活动收录与明信片仍可使用。网页不提供解封；确需恢复须由维护人员在本机处理。</p><label for="seal-word">确认所有点位后，输入「封箱」</label><input id="seal-word" autocomplete="off" required pattern="封箱" placeholder="封箱"><div class="button-row"><button class="danger-button" type="submit">确认关闭全站点位编辑</button><button class="text-button" type="button" id="seal-cancel">暂不封箱</button></div></form><p class="seal-footnote">请在完成全体点位复核后操作。封箱记录将写入服务端审计日志。</p></div></section></div>`;
}
async function loadStorage(check = false) {
  const seq = ++storageRequest, generation = authGeneration;
  if (!overview) await refreshOverview({silent:true});
  if (!isCurrent(generation)) return;
  if (!check) { renderStorage(overview?.storage || {}); return; }
  const button = $('#quick-check'); if (button) button.disabled=true;
  try { const value = await api('/api/admin/storage'); if (!isCurrent(generation) || seq !== storageRequest || currentView !== 'storage') return; const output = $('#integrity-output'); if (output) output.textContent = `${time(value.checkedAt)} · ${(value.integrityCheck || []).join('；')}`; status('数据库快速检查已完成；结果仅反映本次检查。'); }
  catch(error) { if (error.name !== 'AbortError' && isCurrent(generation)) status(error.message,true); }
  finally { if(button?.isConnected)button.disabled=false; }
}

async function loadMedia(kind, id, target, seq, generation) {
  try {
    const blob = await api(`/api/admin/media/${kind}/${encodeURIComponent(id)}`, {binary:true});
    if (!isCurrent(generation) || seq !== drawerRequest || !drawer.open || !target.isConnected) return;
    if (!blob.type.startsWith('image/')) throw new Error('此归档文件不是可显示的图片。');
    const url = URL.createObjectURL(blob); mediaUrls.add(url);
    const link = document.createElement('a'); link.href=url; link.target='_blank'; link.rel='noopener noreferrer'; link.setAttribute('aria-label','在新页查看此归档图片');
    const image = document.createElement('img'); image.src=url; image.alt=kind==='photos'?'参与者已上传的六艺照片':'参与者已保存的明信片'; image.loading='lazy'; image.decoding='async'; link.append(image); target.replaceChildren(link);
  } catch(error) { if(error.name!=='AbortError' && seq===drawerRequest && target.isConnected) target.textContent=error.message; }
}
async function openFile(id) {
  closeFile(); const seq=++drawerRequest, generation=authGeneration; $('#drawer-title').textContent='正在调卷'; $('#drawer-content').innerHTML='<p class="loading-text">正在读取已归档资料……</p>'; drawer.showModal();
  try {
    const value=await api(`/api/admin/users/${encodeURIComponent(id)}`); if(!isCurrent(generation)||seq!==drawerRequest||!drawer.open)return; drawerUser=value.user;
    $('#drawer-title').textContent=value.user.name || '参与者档案';
    const checkins=value.checkins||[];
    $('#drawer-content').innerHTML=`<dl class="file-meta"><div><dt>学号</dt><dd>${html(value.user.studentId)}</dd></div><div><dt>档案编号</dt><dd>${html(value.user.id)}</dd></div><div><dt>登记入册 · 北京时间</dt><dd>${html(time(value.user.createdAt))}</dd></div><div><dt>未过期会话</dt><dd>${count(value.sessionCount)} 份 · 非在线人数</dd></div></dl><section class="drawer-section"><h3>六艺照片 · ${checkins.length} / 6</h3><div class="photo-grid">${Object.entries(arts).map(([id,[character,name]])=>{const row=checkins.find(item=>item.artId===id);return `<figure class="photo-evidence"><div class="photo-well" ${row ? `data-photo="${html(row.photoId)}"` : ''}>${row?'正在读取归档图片':'尚未收录'}</div><figcaption><strong>${character} · ${name}</strong>${row?`<br>入簿 ${html(time(row.createdAt))}<br>拍摄 ${html(time(row.capturedAt))} · ${bytes(row.bytes)}`:''}</figcaption></figure>`;}).join('')}</div><p class="file-warning">拍摄时间由客户端提供；收录记录和照片本身不等于现场定位核验。</p><p class="view-photo-note">点击照片可在新页查看原归档图。图片经授权读取，不在链接中携带凭据。</p></section><section class="drawer-section"><h3>明信片</h3>${value.postcard?`<figure class="photo-evidence postcard-well"><div class="photo-well" data-postcard="${html(value.postcard.id)}">正在读取归档明信片</div><figcaption>${html(time(value.postcard.createdAt))} · ${bytes(value.postcard.bytes)}</figcaption></figure>`:'<p class="fine-print">尚无已保存的明信片。</p>'}</section><section class="drawer-section"><h3>题签维护</h3><form id="inscription-form" class="inscription-form"><label for="inscription-text">参与者题签 · 最多 60 字</label><textarea id="inscription-text" maxlength="120" rows="3">${html(value.user.inscription || '')}</textarea><button class="ink-button" type="submit">保存题签并留档</button></form></section><section class="drawer-section"><h3>词牌与会话</h3><p class="fine-print">核对本人身份后才可重置。原词牌不显示；一次性凭据仅用于本人重新选择词牌。</p><div class="button-row"><button type="button" class="danger-button" id="reset-user">生成词牌重置凭据</button><button type="button" class="text-button" id="revoke-user">撤销此人全部会话</button></div><div id="reset-result" class="reset-panel" hidden><p>请私下交给本人，30 分钟内仅可使用一次。离开档案即清除显示。</p><output id="reset-token"></output><button class="text-button" type="button" id="hide-reset">隐藏凭据</button></div><p class="drawer-status" id="drawer-status" role="status" aria-live="polite"></p></section><section class="drawer-section"><div class="subheading"><h3>最近往来</h3><button class="text-button" type="button" id="user-all-logs">查看此人全部日志 ↗</button></div>${(value.events||[]).length?`<ol class="event-list">${value.events.map(item=>`<li><time class="time-cell">${html(time(item.at))}<small>入簿 ${html(time(item.recordedAt))}</small></time><div><span class="source-mark ${item.source==='audit'?'audit':''}">${sourceLabel(item.source)}</span><p class="event-type">${html(eventLabel(item.type))}</p><span class="person-id">${html(item.type)}</span><div class="event-detail">${eventDetail(item.detail)}</div></div></li>`).join('')}</ol>`:empty('此档案暂无活动记录。')}</section>`;
    for(const target of drawer.querySelectorAll('[data-photo]')) loadMedia('photos',target.dataset.photo,target,seq,generation);
    for(const target of drawer.querySelectorAll('[data-postcard]')) loadMedia('postcards',target.dataset.postcard,target,seq,generation);
  } catch(error) { if(error.name!=='AbortError' && isCurrent(generation) && seq===drawerRequest) $('#drawer-content').innerHTML=errorPanel(error.message); }
}

async function mutateUser(button, action, success) {
  const user=drawerUser, seq=drawerRequest, generation=authGeneration; if(!user||button.disabled)return; button.disabled=true; hideReset();
  try { const value=await action(user); if(!isCurrent(generation)||seq!==drawerRequest)return; success?.(value); drawerStatus('操作已记录。'); await refreshOverview({silent:true}); }
  catch(error) { if(error.name!=='AbortError' && seq===drawerRequest)drawerStatus(error.message,true); }
  finally { if(button.isConnected)button.disabled=false; }
}

$('#credential-form').addEventListener('submit', async event=>{
  event.preventDefault(); const button=event.submitter; if(button.disabled)return; button.disabled=true; credential=$('#admin-token').value.trim(); $('#admin-token').value=''; authGeneration++; const generation=authGeneration;
  try { const value=await api('/api/admin/overview'); if(!isCurrent(generation))return; overview=value; $('#login-section').hidden=true; $('#authenticated').hidden=false; switchView(currentView,false); window.scrollTo({top:0,left:0,behavior:'instant'}); $('#connection-state').textContent=`已开簿 · ${time(value.generatedAt)}`; $('#sync-message').textContent=`最近核对 ${time(value.generatedAt)} · 每 5 秒同步已落盘记录`; status('凭据核验通过，已开簿。'); schedulePoll(); $('#page-title').focus({preventScroll:true}); }
  catch(error) { if(error.name!=='AbortError'){ if(generation===authGeneration)logout(false); status(error.message,true); } }
  finally {button.disabled=false;}
});
$('#chapter-nav').addEventListener('click', event=>{const button=event.target.closest('[data-view]');if(button)switchView(button.dataset.view);});
$('#logout-button').addEventListener('click',()=>logout());
$('#refresh-button').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{await refreshOverview(); if(credential){if(currentView==='users')await loadUsers();else if(currentView==='logs')await loadLogs();else if(currentView==='storage')await loadStorage();}}finally{button.disabled=false;schedulePoll();}});
$('#user-search-form').addEventListener('submit',event=>{event.preventDefault();userPage=1;loadUsers();});
$('#log-search-form').addEventListener('submit',event=>{event.preventDefault();logPage=1;loadLogs();});
$('#log-source').addEventListener('change',()=>{logPage=1;loadLogs();});
document.addEventListener('click',event=>{
  const target=event.target.closest('button'); if(!target)return;
  if(target.dataset.user)openFile(target.dataset.user);
  if(target.dataset.go)switchView(target.dataset.go);
  if(target.dataset.page){if(target.dataset.list==='users'){userPage=Number(target.dataset.page);loadUsers();}else{logPage=Number(target.dataset.page);loadLogs();}}
  if(target.dataset.clearScope){logUser='';logUserName='';logPage=1;renderLogScope();loadLogs();}
  if(target.id==='quick-check')loadStorage(true);
  if(target.id==='seal-begin'){$('#seal-confirm').hidden=false;$('#seal-word').focus();}
  if(target.id==='seal-cancel'){$('#seal-confirm').hidden=true;$('#seal-word').value='';$('#seal-begin').focus();}
  if(target.id==='hide-reset')hideReset();
  if(target.id==='user-all-logs' && drawerUser){logUser=drawerUser.id;logUserName=drawerUser.name;logPage=1;$('#log-query').value='';$('#log-type').value='';$('#log-source').value='';closeFile();switchView('logs');}
  if(target.id==='reset-user' && drawerUser && confirm(`已核对 ${drawerUser.name}（${drawerUser.studentId}）本人身份？生成新凭据会替换旧的重置凭据。`))mutateUser(target,user=>api('/api/admin/reset',{method:'POST',data:{studentId:user.studentId}}),value=>{$('#reset-token').textContent=value.resetToken;$('#reset-result').hidden=false;resetHideTimer=setTimeout(hideReset,120000);});
  if(target.id==='revoke-user' && drawerUser && confirm(`确认撤销 ${drawerUser.name} 的全部未过期会话？其设备下次请求需重新登录，已有照片和档案保留。`))mutateUser(target,user=>api(`/api/admin/users/${encodeURIComponent(user.id)}/revoke-sessions`,{method:'POST',data:{}}),()=>{drawerStatus('已撤销此人全部会话。');});
});
document.addEventListener('submit',async event=>{
  if(event.target.id==='inscription-form'){event.preventDefault();const text=$('#inscription-text').value;if(Array.from(text).length>60){drawerStatus('题签最多 60 字，请缩短后再保存。',true);return;}mutateUser(event.submitter,user=>api(`/api/admin/users/${encodeURIComponent(user.id)}/inscription`,{method:'PUT',data:{text}}),()=>{if(drawerUser)drawerUser.inscription=text;});}
  if(event.target.id==='seal-confirm'){
    event.preventDefault();if($('#seal-word').value!=='封箱'||!storageConfig||storageConfig.sealed)return;const button=event.submitter,generation=authGeneration;baseSeal(button,generation,storageConfig.version);
  }
});
async function baseSeal(button,generation,baseVersion){button.disabled=true;try{await api('/api/admin/seal',{method:'POST',data:{baseVersion}});if(!isCurrent(generation))return;await refreshOverview({silent:true});if(currentView==='storage')await loadStorage();status('已封箱：全站点位编辑关闭，照片和明信片继续开放。');}catch(error){if(error.name!=='AbortError')status(error.message,true);}finally{if(button.isConnected)button.disabled=false;}}
$('#close-drawer').addEventListener('click',closeFile);
drawer.addEventListener('cancel',event=>{event.preventDefault();closeFile();});
drawer.addEventListener('close',()=>{if(drawerUser)closeFile();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(pollTimer);hideReset();}else if(credential){refreshOverview({silent:true}).finally(schedulePoll);}});
$('#overview-content').addEventListener('focusout',()=>requestAnimationFrame(()=>{if(credential&&overview&&currentView==='overview')updateOverviewSections(overview);}));
$('#overview-content').addEventListener('toggle',()=>{if(credential&&overview&&currentView==='overview')updateOverviewSections(overview);},true);
window.addEventListener('pagehide',()=>logout(false));
$('#office-date').textContent=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric'}).format(new Date());
