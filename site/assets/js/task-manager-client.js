'use strict';
(() => {
  // Adapted from the user's existing rpi-task-manager; API remains real and read-only.
  const $ = (id) => document.getElementById(id);
  const API = '/__desktop/task-manager/';
  let disposed = false, hostVisible = window.parent === window, reconnectTimer;
  const pending = new Set();
  function active() { return !disposed && hostVisible && !document.hidden; }
  async function readJSON(endpoint) {
    const controller=new AbortController();pending.add(controller);
    const timer=setTimeout(()=>controller.abort(),6000);
    try {
      const response=await fetch(API+endpoint,{signal:controller.signal,cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error(response.status===401||response.status===403?'桌面会话已失效，请重新解锁桌面':response.status===503||response.status===502?'监控服务暂不可用，请稍后刷新':'读取失败（HTTP '+response.status+'）');
      return await response.json();
    } finally { clearTimeout(timer);pending.delete(controller); }
  }
  function abortPending() { pending.forEach(controller=>controller.abort());pending.clear(); }
  function syncVisibility() {
    if(!active()) { disconnect();abortPending();if(!state.paused)state.connection='background';status(); }
    else if(!state.paused) { connect();if(state.view==='processes')void fetchProcesses(true); }
  }
  const n = (v) => typeof v === 'number' && Number.isFinite(v);
  const dash = '—';
  const number = (v, d = 0) => n(v) ? v.toLocaleString('zh-CN', {minimumFractionDigits:d, maximumFractionDigits:d}) : dash;
  const pct = (v, d = 0) => n(v) ? number(Math.min(100, Math.max(0,v)),d) + '%' : dash;
  const bytes = (v, d = 1) => {
    if (!n(v)) return dash;
    const units = ['B','KiB','MiB','GiB','TiB'];
    const i = v > 0 ? Math.min(4, Math.max(0, Math.floor(Math.log(v) / Math.log(1024)))) : 0;
    return number(v / Math.pow(1024,i),i ? d : 0) + ' ' + units[i];
  };
  const byteRate = (v) => n(v) ? bytes(v) + '/s' : dash;
  const netRate = (v) => !n(v) ? dash : v*8 >= 1e6 ? number(v*8/1e6,1)+' Mbps' : v*8 >= 1000 ? number(v*8/1000,1)+' Kbps' : number(v*8)+' bps';
  const freq = (v) => n(v) ? number(v/1000,2)+' GHz' : dash;
  const temp = (v) => n(v) ? number(v,1)+' °C' : dash;
  const up = (seconds) => {
    if (!n(seconds)) return dash;
    const s = Math.floor(seconds), p = (v) => String(v).padStart(2,'0');
    return Math.floor(s/86400)+':'+p(Math.floor(s/3600)%24)+':'+p(Math.floor(s/60)%60)+':'+p(s%60);
  };
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function icon(name, cls = '') {
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('class','icon '+cls); svg.setAttribute('aria-hidden','true');
    const use = document.createElementNS(svg.namespaceURI,'use');
    use.setAttribute('href','#i-'+name); svg.append(use); return svg;
  }
  const defaults = {theme:'dark', refresh:1, cpuMode:'cores'};
  let settings;
  try { settings = Object.assign({},defaults,JSON.parse(localStorage.getItem('rpi-task-manager.settings.v1')||'{}')); }
  catch (_) { settings = Object.assign({},defaults); }
  if (!['dark','light','auto'].includes(settings.theme)) settings.theme='dark';
  if (![1,2,5].includes(Number(settings.refresh))) settings.refresh=1;
  if (!['cores','total'].includes(settings.cpuMode)) settings.cpuMode='cores';
  const state = {view:'performance',selected:'cpu',snapshot:null,history:[],stream:null,paused:false,connection:'connecting',lastPaint:0,lastSampleReceived:0,resources:[],nodes:new Map(),charts:[],bodySignature:'',processes:null,sort:'cpu_percent',direction:-1,query:'',selectedPid:null,processBusy:false,systemSignature:''};
  const viewTitles = {performance:'性能',processes:'进程',system:'系统信息',settings:'设置'};
  let toastTimer;
  function toast(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500); }
  function save() { try { localStorage.setItem('rpi-task-manager.settings.v1',JSON.stringify(settings)); } catch (_) {} }
  function theme() {
    document.documentElement.dataset.theme = settings.theme==='auto' ? (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light') : settings.theme;
    $('themeSelect').value=settings.theme; drawAll();
  }
  const themeMedia=matchMedia('(prefers-color-scheme: dark)');
  function themeChange(){if(!disposed&&settings.theme==='auto')theme();}
  themeMedia.addEventListener('change',themeChange);
  function color(type) { return getComputedStyle(document.documentElement).getPropertyValue('--'+type).trim() || '#4cc2ff'; }
  const diskFor = (s,r) => s.disks.find(d=>d.name===r.device);
  const netFor = (s,r) => s.networks.find(d=>d.name===r.device);
  function resources(s) {
    const list=[{key:'cpu',type:'cpu',title:'CPU',detail:s.host.cpu_model||s.host.architecture,value:pct(s.cpu.percent)+'  '+freq(s.cpu.current_mhz),mini:x=>x.cpu.percent},
      {key:'memory',type:'memory',title:'内存',detail:bytes(s.memory.total_bytes)+' 物理内存',value:number(s.memory.used_bytes/1073741824,1)+' / '+number(s.memory.total_bytes/1073741824,1)+' GiB ('+pct(s.memory.percent)+')',mini:x=>x.memory.percent}];
    s.disks.forEach((d,i)=>list.push({key:'disk:'+d.name,type:'disk',title:'磁盘 '+i+' ('+d.mountpoint+')',detail:d.kind+' · '+d.name,value:pct(d.active_percent),device:d.name,mini:x=>x.disks.find(v=>v.name===d.name)?.active_percent}));
    s.networks.filter(d=>d.name!=='lo').forEach(d=>list.push({key:'network:'+d.name,type:'network',title:/^(wl|wifi)/.test(d.name)?'Wi-Fi':'以太网',detail:d.name+(d.is_up?'':' · 未连接'),value:d.is_up?'发送 '+netRate(d.send_bytes_per_sec)+'  接收 '+netRate(d.receive_bytes_per_sec):'未连接',device:d.name,mini:x=>{const v=x.networks.find(v=>v.name===d.name);return v&&n(v.send_bytes_per_sec)&&n(v.receive_bytes_per_sec)?v.send_bytes_per_sec+v.receive_bytes_per_sec:null;}}));
    list.push({key:'temperature',type:'temperature',title:'温度',detail:'CPU / SoC',value:temp(s.temperature.celsius),mini:x=>x.temperature.celsius});
    if(s.host.gpu_name)list.push({key:'gpu',type:'gpu',title:'GPU',detail:s.host.gpu_name,value:'利用率不可用',mini:()=>null});
    return list;
  }
  function renderResources() {
    const list=state.resources;
    const signature=list.map(r=>r.key).join('|');
    if($('resourceList').dataset.signature!==signature){
      state.nodes.clear(); $('resourceList').replaceChildren();
      list.forEach(r=>{
        const card=el('button','resource-card'); card.type='button'; card.dataset.resource=r.type; card.setAttribute('role','tab'); card.setAttribute('aria-controls','resourceBody');
        const canvas=el('canvas','resource-mini-chart'); canvas.setAttribute('aria-hidden','true');
        const summary=el('span','resource-summary'); const name=el('span','resource-name',r.title), detail=el('span','resource-detail',r.detail), value=el('span','resource-value',r.value);
        summary.append(name,detail,value); card.append(canvas,summary);
        card.addEventListener('click',()=>navigate('performance',r.key));
        $('resourceList').append(card); state.nodes.set(r.key,{card,canvas,name,detail,value});
      });
      $('resourceList').dataset.signature=signature;
    }
    list.forEach(r=>{const node=state.nodes.get(r.key);node.name.textContent=r.title;node.detail.textContent=r.detail;node.value.textContent=r.value;node.value.title=r.value;node.card.classList.toggle('is-selected',state.selected===r.key);node.card.setAttribute('aria-selected',String(state.selected===r.key));node.card.title=r.title+' · '+r.detail;});
  }
  function stat(parent,label,key,extra='') {
    const box=el('div','stat'); box.append(el('div','stat-label',label));
    const value=el('div','stat-value'); value.dataset.value=key; value.textContent=dash; box.append(value);
    if(extra)box.append(el('div','stat-subvalue',extra));parent.append(box);
  }
  function spec(parent,label,key) { const row=el('div','spec-row');row.append(el('span','',label));const value=el('span');value.dataset.value=key;value.textContent=dash;row.append(value);parent.append(row); }
  function set(key,value) { const node=$('resourceBody').querySelector('[data-value="'+key+'"]');if(node)node.textContent=value; }
  function chart(parent,label,series,options={}) {
    const section=el('div','chart-section'),caption=el('div','chart-caption');caption.append(el('span','',label));
    const axis=el('span','chart-axis');caption.append(axis);const box=el('div','chart-card');const canvas=el('canvas','chart');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',label+'，最近60秒');box.append(canvas);
    const x=el('div','chart-x-axis');x.append(el('span','','60 秒'),el('span','','0'));
    section.append(caption,box,x);parent.append(section);state.charts.push({canvas,series,axis,...options});return section;
  }
  function legend(parent,items) {const bar=el('div','composition-legend');items.forEach(([label,type,dashed])=>{const item=el('span','legend-item'),dot=el('i','legend-dot'+(dashed?' is-dashed':''));dot.style.setProperty('--legend-color',color(type));item.append(dot,document.createTextNode(label));bar.append(item);});parent.append(bar);}
  function buildBody(r) {
    const body=$('resourceBody');body.replaceChildren();state.charts=[];
    const s=state.snapshot;
    $('resourceTitle').textContent=r.type==='cpu'?'CPU':r.type==='memory'?'内存':r.type==='disk'?r.title:r.type==='network'?r.title:r.type==='temperature'?'温度':'GPU';
    $('resourceSubtitle').textContent=r.type==='gpu'?'可靠性优先，不推算未知指标':'最近 60 秒 · 实时采样';
    $('resourceHardware').textContent=r.type==='cpu'?(s.host.cpu_model||s.host.model):r.type==='memory'?bytes(s.memory.total_bytes):r.type==='disk'?((diskFor(s,r)?.kind||'磁盘')+' · '+r.device):r.type==='network'?r.device:r.type==='temperature'?s.host.model:s.host.gpu_name;
    $('cpuGraphMode').hidden=r.type!=='cpu';$('cpuGraphMode').value=settings.cpuMode;
    const bottom=el('div','metrics-bottom'),grid=el('div','stats-grid'),specs=el('div','spec-list');
    if(r.type==='cpu'){
      const section=el('div','chart-section'),caption=el('div','chart-caption');caption.append(el('span','','60 秒内的利用率 %'),el('span','chart-axis','100%'));section.append(caption);
      const cpuGrid=el('div','cpu-graphs'+(settings.cpuMode==='total'?' single':''));
      const count=settings.cpuMode==='total'?1:s.cpu.per_core_percent.length;
      for(let i=0;i<count;i++){const card=el('div','chart-card'),canvas=el('canvas','chart');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',settings.cpuMode==='total'?'CPU总体利用率':'CPU '+i+' 利用率');card.append(canvas,el('span','chart-label',settings.cpuMode==='total'?'总体利用率':'CPU '+i));cpuGrid.append(card);state.charts.push({canvas,series:[{get:settings.cpuMode==='total'?x=>x.cpu.percent:x=>x.cpu.per_core_percent[i],type:'cpu'}],max:100});}
      const x=el('div','chart-x-axis');x.append(el('span','','60 秒'),el('span','','0'));section.append(cpuGrid,x);body.append(section);
      [['利用率','cpu-percent'],['速度','cpu-speed'],['进程（可见）','cpu-processes'],['线程（可见）','cpu-threads'],['打开文件数','cpu-files'],['正常运行时间','uptime']].forEach(a=>stat(grid,...a));
      [['基准上限','cpu-max'],['插槽','cpu-sockets'],['内核','cpu-physical'],['逻辑处理器','cpu-logical'],['体系结构','cpu-arch'],['L1 缓存','cpu-l1'],['L2 缓存','cpu-l2'],['L3 缓存','cpu-l3']].forEach(a=>spec(specs,...a));
      bottom.append(grid,specs);body.append(bottom);const note=el('div','info-note');note.dataset.value='cpu-load';body.append(note);
    }else if(r.type==='memory'){
      chart(body,'内存使用量',[{get:x=>x.memory.used_bytes,type:'memory'}],{max:x=>x.memory.total_bytes,formatMax:bytes});
      body.append(el('div','section-label','内存组成'));const comp=el('div','composition-bar');['used','cache','free'].forEach(part=>{const seg=el('div','composition-segment '+part);seg.dataset.composition=part;comp.append(seg);});body.append(comp);legend(body,[['使用中','memory'],['可回收 / 待命（估计）','memory',true],['空闲','cpu']]);
      [['使用中','mem-used'],['可用','mem-available'],['缓存','mem-cache'],['缓冲区','mem-buffers'],['交换空间已用','mem-swap'],['内存利用率','mem-percent']].forEach(a=>stat(grid,...a));
      [['总内存','mem-total'],['空闲','mem-free'],['交换空间总量','mem-swap-total'],['交换空间使用率','mem-swap-percent']].forEach(a=>spec(specs,...a));bottom.append(grid,specs);body.append(bottom,el('p','info-note','内存使用量按“总量 − 可用量”计算；可回收部分为 Linux 可用内存估计，不是 Windows 的内存分页统计。'));
    }else if(r.type==='disk'){
      chart(body,'活动时间',[{get:x=>diskFor(x,r)?.active_percent,type:'disk'}],{max:100});
      [['活动时间','disk-active'],['平均响应时间','disk-response'],['读取速度','disk-read'],['写入速度','disk-write'],['已用空间','disk-used'],['可用空间','disk-free']].forEach(a=>stat(grid,...a));
      [['设备','disk-name'],['类型','disk-kind'],['文件系统','disk-fs'],['挂载点','disk-mount'],['容量','disk-total'],['空间使用率','disk-percent']].forEach(a=>spec(specs,...a));bottom.append(grid,specs);body.append(bottom,el('p','info-note','I/O 速率来自物理块设备计数器，避免分区重复累计。内核不提供的活动时间或延迟会显示为“—”。'));
    }else if(r.type==='network'){
      chart(body,'吞吐量',[{get:x=>netFor(x,r)?.send_bytes_per_sec,type:'network'},{get:x=>netFor(x,r)?.receive_bytes_per_sec,type:'network',dashed:true}],{floor:125000,formatMax:netRate});legend(body,[['发送','network'],['接收','network',true]]);
      [['发送','net-send'],['接收','net-receive'],['累计发送','net-sent-total'],['累计接收','net-received-total']].forEach(a=>stat(grid,...a));
      [['接口','net-name'],['连接状态','net-state'],['协商速度','net-speed'],['IP 地址','net-address']].forEach(a=>spec(specs,...a));bottom.append(grid,specs);body.append(bottom,el('p','info-note','吞吐量包含监控连接本身产生的真实流量；单位为 bit/s，累计量为接口计数器读数。'));
    }else if(r.type==='temperature'){
      chart(body,'CPU / SoC 温度',[{get:x=>x.temperature.celsius,type:'temperature'}],{max:100,formatMax:temp});
      [['当前温度','temp-current'],['高温阈值','temp-high'],['临界温度','temp-critical'],['电源 / 降频标志','power-flags']].forEach(a=>stat(grid,...a));
      [['当前欠压','power-under'],['当前降频','power-throttle'],['频率限制','power-cap'],['软温度限制','power-soft'],['曾发生欠压','power-history-under'],['曾发生降频','power-history-throttle']].forEach(a=>spec(specs,...a));bottom.append(grid,specs);body.append(bottom,el('p','info-note','历史电源状态由固件提供，通常自本次开机累计。权限不足时明确显示“不可读取”，不会以 0 代替。'));
    }else{
      const empty=el('div','unavailable-state');empty.append(icon('gpu'),el('h3','','GPU 利用率不可用'),el('p','','当前 Linux 驱动未公开可靠的 GPU 使用率计数器。本页不会用 CPU 占用、随机值或固定 0% 代替。'));body.append(empty);
      spec(specs,'GPU','gpu-name');spec(specs,'采样策略','gpu-policy');body.append(specs);
    }
  }
  function bool(v,yes='是',no='否') {return v===true?yes:v===false?no:'不可读取';}
  function updateBody(r) {
    const s=state.snapshot,m=s.memory,c=s.cpu,p=s.power,t=s.temperature;
    if(r.type==='cpu'){
      set('cpu-percent',pct(c.percent));set('cpu-speed',freq(c.current_mhz));set('cpu-processes',number(c.processes));set('cpu-threads',number(c.threads));set('cpu-files',number(c.open_files));set('uptime',up(s.uptime_seconds));
      set('cpu-max',freq(s.host.cpu_max_mhz));set('cpu-sockets',number(s.host.cpu_sockets));set('cpu-physical',number(s.host.cpu_physical_cores));set('cpu-logical',number(s.host.cpu_logical_cores));set('cpu-arch',s.host.architecture);
      ['l1','l2','l3'].forEach(k=>set('cpu-'+k,bytes(s.host.cache?.[k+'_bytes'])));set('cpu-load','平均负载（1 / 5 / 15 分钟）：'+c.load_average.map(v=>number(v,2)).join(' / '));
    }else if(r.type==='memory'){
      set('mem-used',bytes(m.used_bytes));set('mem-available',bytes(m.available_bytes));set('mem-cache',bytes(m.cached_bytes));set('mem-buffers',bytes(m.buffers_bytes));set('mem-swap',bytes(m.swap_used_bytes));set('mem-percent',pct(m.percent));set('mem-total',bytes(m.total_bytes));set('mem-free',bytes(m.free_bytes));set('mem-swap-total',bytes(m.swap_total_bytes));set('mem-swap-percent',pct(m.swap_percent));
      const free=Math.min(m.free_bytes,m.available_bytes),cache=Math.max(0,m.available_bytes-free),values={used:m.used_bytes,cache,free};Object.entries(values).forEach(([k,v])=>{const node=$('resourceBody').querySelector('[data-composition="'+k+'"]');if(node){node.style.width=(m.total_bytes?v/m.total_bytes*100:0)+'%';node.title=bytes(v);}});
    }else if(r.type==='disk'){
      const d=diskFor(s,r);if(!d)return;set('disk-active',pct(d.active_percent));set('disk-response',n(d.avg_response_ms)?number(d.avg_response_ms,1)+' ms':dash);set('disk-read',byteRate(d.read_bytes_per_sec));set('disk-write',byteRate(d.write_bytes_per_sec));set('disk-used',bytes(d.used_bytes));set('disk-free',bytes(d.free_bytes));set('disk-name',d.name);set('disk-kind',d.kind);set('disk-fs',d.filesystem);set('disk-mount',d.mountpoint);set('disk-total',bytes(d.total_bytes));set('disk-percent',pct(d.percent));
    }else if(r.type==='network'){
      const d=netFor(s,r);if(!d)return;set('net-send',netRate(d.send_bytes_per_sec));set('net-receive',netRate(d.receive_bytes_per_sec));set('net-sent-total',bytes(d.bytes_sent_total));set('net-received-total',bytes(d.bytes_received_total));set('net-name',d.name);set('net-state',d.is_up?'已连接':'未连接');set('net-speed',n(d.speed_mbps)?number(d.speed_mbps)+' Mbps':dash);set('net-address',d.addresses.join(' / ')||dash);
    }else if(r.type==='temperature'){
      set('temp-current',temp(t.celsius));set('temp-high',temp(t.high_celsius));set('temp-critical',temp(t.critical_celsius));set('power-flags',p.flags_hex||'不可读取');set('power-under',bool(p.current_under_voltage,'欠压','正常'));set('power-throttle',bool(p.current_throttled,'正在降频','正常'));set('power-cap',bool(p.current_frequency_capped,'受限','正常'));set('power-soft',bool(p.current_soft_temp_limit,'已触发','未触发'));set('power-history-under',bool(p.under_voltage_occurred,'曾发生','未发生'));set('power-history-throttle',bool(p.throttling_occurred,'曾发生','未发生'));
    }else {set('gpu-name',s.host.gpu_name);set('gpu-policy','不推算未知值');}
  }
  function niceMax(value,floor=1) {
    const v=Math.max(value*1.1,floor), p=Math.pow(10,Math.floor(Math.log10(v)));
    for(const m of [1,2,5,10])if(m*p>=v)return m*p;return v;
  }
  function plot(canvas,series,max,mini=false) {
    const rect=canvas.getBoundingClientRect();if(rect.width<2||rect.height<2)return;
    const dpr=Math.min(3,devicePixelRatio||1),w=rect.width,h=rect.height;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    if(!mini){ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--grid').trim()||'#343434';ctx.lineWidth=.65;ctx.beginPath();for(let i=1;i<8;i++){const x=Math.round(w*i/8)+.5;ctx.moveTo(x,0);ctx.lineTo(x,h);}for(let i=1;i<4;i++){const y=Math.round(h*i/4)+.5;ctx.moveTo(0,y);ctx.lineTo(w,y);}ctx.stroke();}
    if(!state.history.length)return;
    const end=state.history[state.history.length-1].timestamp_ms,start=end-60000,pad=mini?2:1;
    series.forEach(serie=>{
      const segments=[];let segment=[],last=0;
      state.history.forEach(sample=>{
        const value=serie.get(sample),time=sample.timestamp_ms;
        if(time<start||!n(value)){if(segment.length)segments.push(segment);segment=[];last=0;return;}
        if(last&&time-last>3500){if(segment.length)segments.push(segment);segment=[];}
        segment.push([pad+(time-start)/60000*(w-pad*2),h-pad-Math.min(max,Math.max(0,value))/Math.max(1,max)*(h-pad*2)]);last=time;
      });if(segment.length)segments.push(segment);
      ctx.strokeStyle=color(serie.type);ctx.fillStyle=color(serie.type);ctx.lineWidth=mini?1:1.25;ctx.setLineDash(serie.dashed?[4,3]:[]);
      segments.forEach(points=>{
        if(!serie.dashed&&points.length>1){ctx.globalAlpha=mini?.1:.12;ctx.beginPath();ctx.moveTo(points[0][0],h-pad);points.forEach(p=>ctx.lineTo(p[0],p[1]));ctx.lineTo(points[points.length-1][0],h-pad);ctx.closePath();ctx.fill();ctx.globalAlpha=1;}
        ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));ctx.stroke();
      });ctx.setLineDash([]);
    });
  }
  function drawAll() {
    if(!state.snapshot||state.view!=='performance')return;
    state.resources.forEach(r=>{
      const node=state.nodes.get(r.key);if(!node)return;
      const max=r.type==='network'?niceMax(Math.max(...state.history.map(s=>r.mini(s)||0)),125000):r.type==='temperature'?100:100;
      plot(node.canvas,[{get:r.mini,type:r.type}],max,true);
    });
    state.charts.forEach(desc=>{
      const maximum=typeof desc.max==='function'?desc.max(state.snapshot):desc.max||niceMax(Math.max(0,...state.history.flatMap(s=>desc.series.map(serie=>serie.get(s)||0))),desc.floor||1);
      if(desc.axis)desc.axis.textContent=desc.formatMax?desc.formatMax(maximum):number(maximum)+'%';
      plot(desc.canvas,desc.series,maximum);
    });
  }
  function renderPerformance() {
    if(!state.snapshot)return;
    renderResources();let r=state.resources.find(r=>r.key===state.selected);
    if(!r){state.selected='cpu';r=state.resources[0];state.bodySignature='';}
    const signature=r.key+'|'+settings.cpuMode+'|'+state.snapshot.cpu.per_core_percent.length;
    if(signature!==state.bodySignature){buildBody(r);state.bodySignature=signature;renderResources();}
    updateBody(r);drawAll();
  }
  function makeSystemCard(title,rows) {
    const card=el('section','system-card');card.append(el('h3','system-card-title',title));rows.forEach(([label,value])=>{const row=el('div','system-info-row');row.append(el('span','',label),el('strong','',value));card.append(row);});return card;
  }
  function renderSystem() {
    const s=state.snapshot;if(!s)return;
    const cards=$('systemCards');cards.replaceChildren();
    cards.append(makeSystemCard('设备',[['主机名',s.host.hostname],['板型',s.host.model],['处理器',s.host.cpu_model],['架构',s.host.architecture],['逻辑处理器',number(s.host.cpu_logical_cores)],['CPU 温度',temp(s.temperature.celsius)]]));
    cards.append(makeSystemCard('操作系统',[['系统',s.host.os],['内核',s.host.kernel],['正常运行时间',up(s.uptime_seconds)],['进程',number(s.cpu.processes)],['线程',number(s.cpu.threads)],['采样间隔',s.sampling.interval_seconds+' 秒']]));
    cards.append(makeSystemCard('内存与存储',[['内存总量',bytes(s.memory.total_bytes)],['内存可用',bytes(s.memory.available_bytes)],['交换空间',bytes(s.memory.swap_total_bytes)],...s.disks.map(d=>[d.name+' · '+d.mountpoint,bytes(d.free_bytes)+' 可用 / '+bytes(d.total_bytes)])]));
    cards.append(makeSystemCard('网络接口',s.networks.filter(i=>i.name!=='lo').flatMap(i=>[[i.name,i.is_up?'已连接':'未连接'],[i.name+' 地址',i.addresses.join(' / ')||dash]])));
    cards.append(makeSystemCard('固件状态',[['当前欠压',bool(s.power.current_under_voltage,'欠压','正常')],['当前降频',bool(s.power.current_throttled,'正在降频','正常')],['历史欠压',bool(s.power.under_voltage_occurred,'曾发生','未发生')],['历史降频',bool(s.power.throttling_occurred,'曾发生','未发生')],['原始标志',s.power.flags_hex||'不可读取']]));
    cards.append(makeSystemCard('采集边界',[['访问模式','只读'],['进程命令行','不采集'],['进程数据间隔','3 秒'],['GPU 利用率','无可靠计数器时不可用'],['数据来源','Linux / psutil']]));
  }
  const statuses={running:'运行中',sleeping:'睡眠',disk_sleep:'等待磁盘',stopped:'已暂停',tracing_stop:'跟踪暂停',zombie:'僵尸',dead:'已退出',idle:'空闲',waking:'唤醒中',parked:'已停放',locked:'已锁定'};
  function renderProcesses() {
    if(!state.processes)return;
    const query=state.query.trim().toLowerCase();let list=state.processes.processes.filter(p=>!query||[p.name,p.pid,p.user].some(v=>String(v??'').toLowerCase().includes(query)));
    list.sort((a,b)=>{
      const av=a[state.sort],bv=b[state.sort];if(av==null&&bv!=null)return 1;if(bv==null&&av!=null)return-1;if(av==null&&bv==null)return a.pid-b.pid;
      const cmp=typeof av==='string'?av.localeCompare(String(bv),'zh-CN',{numeric:true}):av-bv;
      return cmp*state.direction||a.pid-b.pid;
    });
    const fragment=document.createDocumentFragment();
    if(!list.length){const row=el('tr'),cell=el('td','table-empty',query?'没有匹配的进程':'没有可读取的进程');cell.colSpan=7;row.append(cell);fragment.append(row);}
    list.forEach(p=>{
      const row=el('tr','process-row');row.dataset.pid=String(p.pid);row.classList.toggle('is-selected',p.pid===state.selectedPid);row.tabIndex=0;
      const select=()=>{state.selectedPid=p.pid;document.querySelectorAll('.process-row').forEach(r=>r.classList.toggle('is-selected',r.dataset.pid===String(p.pid)));};row.addEventListener('click',select);row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}});
      const name=el('td','process-name-cell');name.append(icon('processes','process-icon'),el('span','process-name',p.name||'名称不可读'));name.title=p.name||'';
      const cpu=el('td','heat-cell',pct(p.cpu_percent,1)),memory=el('td','heat-cell',bytes(p.memory_bytes));
      if(n(p.cpu_percent))cpu.style.backgroundColor='rgba(76,194,255,'+(0.025+Math.min(1,p.cpu_percent/60)*.22)+')';
      if(n(p.memory_percent))memory.style.backgroundColor='rgba(76,194,255,'+(0.025+Math.min(1,p.memory_percent/30)*.22)+')';
      row.append(name,el('td','',number(p.pid)),cpu,memory,el('td','',p.user||dash),el('td','',number(p.threads)),el('td','',statuses[p.status]||p.status||dash));fragment.append(row);
    });
    $('processTableBody').replaceChildren(fragment);
    $('processCount').textContent='显示 '+list.length+' 个进程 / 可见 '+state.processes.total_count+' 个 · 不采集命令行和环境变量 · 点击列标题排序';
    document.querySelectorAll('[data-sort]').forEach(button=>{const active=button.dataset.sort===state.sort;button.classList.toggle('is-sorted',active);button.closest('th').setAttribute('aria-sort',active?(state.direction===1?'ascending':'descending'):'none');button.dataset.direction=active?(state.direction===1?'↑':'↓'):'';});
  }
  async function fetchProcesses(force=false) {
    if(state.processBusy||state.paused||!active()||(!force&&state.view!=='processes'))return;
    state.processBusy=true;
    try {const data=await readJSON('processes');if(!active())return;if(!Array.isArray(data.processes))throw new Error('进程数据格式异常');state.processes=data;renderProcesses();}
    catch(e){if(active()&&state.view==='processes')$('processCount').textContent=e.message+'。已有内容可能不是最新数据。';}
    finally{state.processBusy=false;}
  }
  function processSummary() {
    const s=state.snapshot;if(!s)return;
    $('processCpuTotal').textContent=pct(s.cpu.percent);$('processMemoryTotal').textContent=pct(s.memory.percent);
    const node=$('processSummary');node.replaceChildren();[['CPU',pct(s.cpu.percent)],['内存',pct(s.memory.percent)],['进程',number(s.cpu.processes)],['线程',number(s.cpu.threads)]].forEach(([label,value])=>{const item=el('div','process-summary-item');item.append(el('span','',label),el('strong','',value));node.append(item);});
  }
  function render(force=false) {
    if(!state.snapshot)return;
    const now=performance.now();if(!force&&now-state.lastPaint<Number(settings.refresh)*1000-40)return;state.lastPaint=now;
    $('hostTag').textContent=state.snapshot.host.hostname;
    if(state.view==='performance')renderPerformance();if(state.view==='system')renderSystem();if(state.view==='processes')processSummary();status();
  }
  function status() {
    const live=state.connection==='live'&&!state.paused;
    const label=state.paused?'已暂停':state.connection==='live'?'已连接':state.connection==='stale'?'数据已过期':state.connection==='sampling-error'?'采样异常':state.connection==='offline'?'连接中断':state.connection==='background'?'后台已暂停':'正在连接';
    const conn=$('connectionState');const visualState=state.paused?'paused':(['stale','sampling-error'].includes(state.connection)?'offline':state.connection);conn.dataset.state=visualState;conn.dataset.reason=state.connection;conn.lastElementChild.textContent=label;
    const footer=$('footerStatus');footer.replaceChildren(el('i','status-dot'));
    footer.append(document.createTextNode(state.paused?'已暂停 · 显示最后一次采样':live?'实时采样 · 每 1 秒 · 只读':state.connection==='stale'?'采样已中断 · 显示最后一次数据':state.connection==='sampling-error'?'采样异常 · 显示最后一次可用数据':state.connection==='offline'?(state.connectionHint||'连接中断 · 自动重连中，数值可能已过期'):'等待实时采样'));
    footer.dataset.state=live?'live':visualState;
    const s=state.snapshot;$('footerTime').textContent=s?'更新于 '+new Date(s.timestamp_ms).toLocaleTimeString('zh-CN',{hour12:false}):'尚未收到采样';
  }
  function ingest(data) {
    if(!active())return;
    const firstSample=!state.snapshot;
    if(!data||!data.host||!data.cpu||!Array.isArray(data.cpu.per_core_percent)||!data.memory||!Array.isArray(data.disks)||!Array.isArray(data.networks)||!n(data.timestamp_ms))throw new Error('实时数据格式异常');
    const last=state.history[state.history.length-1];if(last&&data.timestamp_ms<last.timestamp_ms)state.history=[];
    if(!last||last.timestamp_ms!==data.timestamp_ms){state.lastSampleReceived=performance.now();state.history.push(data);state.history=state.history.filter(s=>s.timestamp_ms>=data.timestamp_ms-61000).slice(-70);}
    state.connectionHint='';state.snapshot=data;state.resources=resources(data);state.connection=data.sampling?.last_error?'sampling-error':(performance.now()-state.lastSampleReceived>5000?'stale':'live');render(firstSample);status();
  }
  function connect() {
    if(state.stream||state.paused||!active())return;
    clearTimeout(reconnectTimer);
    const stream=new EventSource(API+'events');state.stream=stream;state.connection='connecting';status();
    stream.onmessage=(event)=>{if(state.stream!==stream)return;try{ingest(JSON.parse(event.data));}catch(e){state.connection='offline';status();console.error('监控数据处理失败',e);}};
    stream.onerror=()=>{
      if(state.stream!==stream)return;state.connection='offline';status();
      if(stream.readyState===EventSource.CLOSED){
        clearTimeout(reconnectTimer);
        reconnectTimer=setTimeout(()=>{if(state.stream===stream){disconnect();connect();}},3000);
      }
      void readJSON('health').then(()=>{if(active()&&state.stream===stream){state.connectionHint='数据流中断，正在重连';status();}}).catch(error=>{if(active()&&state.stream===stream){state.connectionHint=error.message;status();}});
    };
  }
  function disconnect() {clearTimeout(reconnectTimer);if(state.stream){state.stream.close();state.stream=null;}}
  async function refresh() {
    const button=$('refreshButton');if(button.disabled||!active())return;button.disabled=true;
    try{const data=await readJSON('snapshot');if(!active())return;ingest(data);render(true);if(!state.paused){if(state.stream?.readyState===EventSource.CLOSED)disconnect();connect();}if(state.view==='processes')await fetchProcesses(true);toast(state.paused?'已手动更新一次采样':'已获取最新采样');}
    catch(e){if(active()){state.connection='offline';state.connectionHint=e.message;status();toast(e.message);}}finally{if(!disposed)button.disabled=false;}
  }
  function showView(view,selected) {
    state.view=viewTitles[view]?view:'performance';if(selected)state.selected=selected;
    Object.keys(viewTitles).forEach(key=>$('view-'+key).hidden=key!==state.view);
    document.querySelectorAll('[data-view]').forEach(node=>{const active=node.dataset.view===state.view;node.classList.toggle('is-active',active);if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});
    $('viewTitle').textContent=viewTitles[state.view];state.lastPaint=0;render(true);if(state.view==='processes'){renderProcesses();fetchProcesses(true);}
  }
  function navigate(view,selected) {const hash=view==='performance'?'performance/'+encodeURIComponent(selected||state.selected):view;if(location.hash.slice(1)===hash)showView(view,selected);else location.hash=hash;}
  function route() {let [view,...parts]=location.hash.slice(1).split('/');let selected='cpu';try{selected=decodeURIComponent(parts.join('/'))||'cpu';}catch(_){}showView(view||'performance',view==='performance'||!view?selected:undefined);}
  document.querySelectorAll('[data-view]').forEach(node=>node.addEventListener('click',()=>navigate(node.dataset.view)));
  let menuTimer;
  $('menuButton').addEventListener('click',()=>{const expanded=document.body.classList.toggle('rail-expanded');$('menuButton').setAttribute('aria-pressed',String(expanded));clearTimeout(menuTimer);menuTimer=setTimeout(()=>{if(active())drawAll();},180);});
  $('pauseButton').addEventListener('click',()=>{state.paused=!state.paused;const button=$('pauseButton');button.replaceChildren(icon(state.paused?'play':'pause'),el('span','',state.paused?'恢复':'暂停'));button.title=state.paused?'恢复实时采样':'暂停界面刷新';if(state.paused){disconnect();abortPending();}else syncVisibility();status();});
  $('refreshButton').addEventListener('click',refresh);
  $('fullscreenButton').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch(_){toast('当前浏览器不允许切换全屏');}});
  $('themeSelect').addEventListener('change',e=>{settings.theme=e.target.value;save();theme();});
  $('refreshInterval').value=String(settings.refresh);$('refreshInterval').addEventListener('change',e=>{settings.refresh=Number(e.target.value);save();render(true);});
  function setCpuMode(mode){settings.cpuMode=mode;$('cpuGraphMode').value=mode;$('settingsCpuMode').value=mode;state.bodySignature='';save();render(true);}
  $('settingsCpuMode').value=settings.cpuMode;$('cpuGraphMode').value=settings.cpuMode;
  $('cpuGraphMode').addEventListener('change',e=>setCpuMode(e.target.value));$('settingsCpuMode').addEventListener('change',e=>setCpuMode(e.target.value));
  $('processSearch').addEventListener('input',e=>{state.query=e.target.value;renderProcesses();});
  document.querySelectorAll('[data-sort]').forEach(button=>button.addEventListener('click',()=>{if(state.sort===button.dataset.sort)state.direction*=-1;else{state.sort=button.dataset.sort;state.direction=['name','user','status','pid'].includes(state.sort)?1:-1;}renderProcesses();}));
  document.addEventListener('visibilitychange',syncVisibility);
  window.addEventListener('hashchange',route);
  function hostMessage(event) {
    if(event.source!==window.parent||event.origin!==location.origin)return;
    if(event.data?.type==='aiden-task-manager:dispose') { dispose();return; }
    if(event.data?.type!=='aiden-task-manager:visibility'||typeof event.data.visible!=='boolean')return;
    hostVisible=event.data.visible;syncVisibility();
  }
  window.addEventListener('message',hostMessage);
  window.addEventListener('pagehide',dispose,{once:true});
  let resizeTimer;const observer=new ResizeObserver(()=>{clearTimeout(resizeTimer);if(active())resizeTimer=setTimeout(drawAll,70);});observer.observe($('resourceBody'));
  const processTimer=setInterval(()=>{if(active()&&state.view==='processes')void fetchProcesses();},3000);
  const staleTimer=setInterval(()=>{if(!state.paused&&active()&&state.snapshot&&state.lastSampleReceived&&['live','connecting'].includes(state.connection)&&performance.now()-state.lastSampleReceived>5000){state.connection='stale';status();}},1000);
  function dispose() {
    if(disposed)return;disposed=true;disconnect();abortPending();
    clearTimeout(toastTimer);clearTimeout(resizeTimer);clearTimeout(menuTimer);clearInterval(processTimer);clearInterval(staleTimer);observer.disconnect();themeMedia.removeEventListener('change',themeChange);
    document.removeEventListener('visibilitychange',syncVisibility);window.removeEventListener('message',hostMessage);window.removeEventListener('hashchange',route);window.removeEventListener('pagehide',dispose);
    state.snapshot=null;state.history=[];state.processes=null;
  }
  theme();route();connect();
  if(window.parent!==window)window.parent.postMessage({type:'aiden-task-manager:ready'},location.origin);
})();
