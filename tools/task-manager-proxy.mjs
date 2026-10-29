/** Authenticated, read-only bridge to the existing loopback Pi monitor. Never a general proxy. */
import http from 'node:http';

export const TASK_MANAGER_PREFIX = '/__desktop/task-manager/';
export const DEFAULT_TASK_MANAGER_PORT = 8765;
export const TASK_MANAGER_LIMITS = Object.freeze({
  streams: 8, streamsPerSession: 2, requests: 32, requestsPerSession: 4,
  jsonBytes: 2 * 1024 * 1024, streamFrameBytes: 512 * 1024,
  requestTimeoutMs: 4000, authorizationCheckMs: 1000, upstreamIdleMs: 25000,
  heartbeatMs: 15000, writeTimeoutMs: 5000, streamDurationMs: 5 * 60 * 1000,
});
const NAMESPACE = '/__desktop/task-manager';
const ENDPOINTS = new Map(['health', 'snapshot', 'processes', 'events'].map(name => [TASK_MANAGER_PREFIX + name, name]));
const HOST = '127.0.0.1';
const JSON_TYPE = /^application\/json(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i;
const EVENT_TYPE = /^text\/event-stream(?:\s*;\s*charset\s*=\s*utf-8)?\s*$/i;
const HEADERS = Object.freeze({ 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'Vary': 'Cookie', 'Cross-Origin-Resource-Policy': 'same-origin' });

export function taskManagerPort(value = process.env.DESKTOP_TASK_MANAGER_PORT ?? DEFAULT_TASK_MANAGER_PORT) {
  if ((typeof value !== 'number' && typeof value !== 'string') || !/^[1-9][0-9]{0,4}$/.test(String(value))) throw new Error('DESKTOP_TASK_MANAGER_PORT must be an integer TCP port.');
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port > 65535) throw new Error('DESKTOP_TASK_MANAGER_PORT must be an integer TCP port.');
  return port;
}

function errorReply(res, status, error, head = false) {
  if (res.destroyed) return;
  if (res.headersSent) { res.destroy(); return; }
  if (status === 405) res.setHeader('Allow', 'GET, HEAD');
  if (status === 429) res.setHeader('Retry-After', '3');
  res.writeHead(status, { ...HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(head ? undefined : JSON.stringify({ ok: false, readonly: true, error, message:
    status === 401 ? '请先解锁桌面后查看任务管理器。' : status === 403 ? '请求来源不匹配。'
      : status === 429 ? '只读监控连接已达上限，请关闭多余窗口后重试。'
        : status === 404 ? '监控接口不存在。' : status === 405 ? '任务管理器仅提供只读查询。'
          : '只读监控数据暂不可用，请检查监控服务或本机安全隧道后重试。' }));
}

// Keep only the documented metric fields. Never forward arbitrary objects, errors or HTTP headers.
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('schema'); return value; }
function number(value, min = 0, max = Number.MAX_SAFE_INTEGER) { if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new Error('schema'); return value; }
function integer(value, min = 0, max = Number.MAX_SAFE_INTEGER) { if (!Number.isSafeInteger(number(value, min, max))) throw new Error('schema'); return value; }
function text(value, length = 512) { if (typeof value !== 'string' || value.length > length || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error('schema'); return value; }
function boolean(value) { if (typeof value !== 'boolean') throw new Error('schema'); return value; }
function nullable(value, read) { return value === null || value === undefined ? null : read(value); }
function array(value, max, read) { if (!Array.isArray(value) || value.length > max) throw new Error('schema'); return value.map(item => read(item)); }
function iso(value) { const result = text(value, 64); if (!Number.isFinite(Date.parse(result))) throw new Error('schema'); return result; }
const percent = value => number(value, 0, 100);
const temperature = value => number(value, -273.15, 500);
function health(value) {
  const source = object(value);
  if (source.app !== 'rpi-task-manager' || source.ok !== true || source.readonly !== true) throw new Error('schema');
  return { app: 'rpi-task-manager', ok: true, ready: boolean(source.ready), version: text(source.version, 32), readonly: true };
}
function snapshot(value) {
  const source = object(value), host = object(source.host), cpu = object(source.cpu), memory = object(source.memory);
  const thermal = object(source.temperature), power = object(source.power), sampling = object(source.sampling);
  if (source.version !== 1) throw new Error('schema');
  const cache = host.cache === null || host.cache === undefined ? {} : object(host.cache);
  const cpuCount = integer(host.cpu_logical_cores, 1, 1024);
  const cores = array(cpu.per_core_percent, 1024, percent);
  if (cores.length !== cpuCount) throw new Error('schema');
  if (sampling.last_error !== null && sampling.last_error !== undefined) text(sampling.last_error, 2048);
  return {
    version: 1, seq: integer(source.seq), sampled_at: iso(source.sampled_at), timestamp_ms: number(source.timestamp_ms), uptime_seconds: number(source.uptime_seconds),
    host: { hostname: text(host.hostname), model: text(host.model), os: text(host.os), kernel: text(host.kernel), architecture: text(host.architecture), cpu_model: text(host.cpu_model),
      cpu_physical_cores: nullable(host.cpu_physical_cores, value => integer(value, 1, 1024)), cpu_logical_cores: cpuCount,
      cpu_sockets: nullable(host.cpu_sockets, value => integer(value, 1, 1024)), cpu_max_mhz: nullable(host.cpu_max_mhz, number),
      cache: { l1_bytes: nullable(cache.l1_bytes, integer), l2_bytes: nullable(cache.l2_bytes, integer), l3_bytes: nullable(cache.l3_bytes, integer) }, gpu_name: nullable(host.gpu_name, text) },
    cpu: { percent: percent(cpu.percent), per_core_percent: cores, current_mhz: nullable(cpu.current_mhz, number), load_average: array(cpu.load_average, 3, number),
      processes: integer(cpu.processes), threads: nullable(cpu.threads, integer), open_files: nullable(cpu.open_files, integer) },
    memory: { total_bytes: integer(memory.total_bytes, 1), available_bytes: integer(memory.available_bytes), used_bytes: integer(memory.used_bytes), free_bytes: integer(memory.free_bytes),
      cached_bytes: nullable(memory.cached_bytes, integer), buffers_bytes: nullable(memory.buffers_bytes, integer), percent: percent(memory.percent),
      swap_total_bytes: integer(memory.swap_total_bytes), swap_used_bytes: integer(memory.swap_used_bytes), swap_percent: percent(memory.swap_percent) },
    disks: array(source.disks, 128, row => { const disk = object(row); return {
      name: text(disk.name), label: text(disk.label), kind: text(disk.kind), mountpoint: text(disk.mountpoint), filesystem: text(disk.filesystem),
      total_bytes: integer(disk.total_bytes), used_bytes: integer(disk.used_bytes), free_bytes: integer(disk.free_bytes), percent: percent(disk.percent),
      active_percent: nullable(disk.active_percent, percent), read_bytes_per_sec: nullable(disk.read_bytes_per_sec, number), write_bytes_per_sec: nullable(disk.write_bytes_per_sec, number), avg_response_ms: nullable(disk.avg_response_ms, number) }; }),
    networks: array(source.networks, 128, row => { const network = object(row); return {
      name: text(network.name), is_up: boolean(network.is_up), addresses: array(network.addresses, 64, value => text(value, 256)), speed_mbps: nullable(network.speed_mbps, number),
      bytes_sent_total: integer(network.bytes_sent_total), bytes_received_total: integer(network.bytes_received_total), send_bytes_per_sec: nullable(network.send_bytes_per_sec, number), receive_bytes_per_sec: nullable(network.receive_bytes_per_sec, number) }; }),
    temperature: { celsius: nullable(thermal.celsius, temperature), high_celsius: nullable(thermal.high_celsius, temperature), critical_celsius: nullable(thermal.critical_celsius, temperature) },
    power: { flags_hex: nullable(power.flags_hex, value => text(value, 64)), current_under_voltage: nullable(power.current_under_voltage, boolean), current_throttled: nullable(power.current_throttled, boolean),
      current_frequency_capped: nullable(power.current_frequency_capped, boolean), current_soft_temp_limit: nullable(power.current_soft_temp_limit, boolean),
      under_voltage_occurred: nullable(power.under_voltage_occurred, boolean), throttling_occurred: nullable(power.throttling_occurred, boolean), updated_at: nullable(power.updated_at, iso) },
    sampling: { interval_seconds: number(sampling.interval_seconds, .1, 60), process_interval_seconds: number(sampling.process_interval_seconds, .1, 60),
      last_error: sampling.last_error ? '只读采样暂时不可用' : null },
  };
}
function processes(value) {
  const source = object(value);
  return { sampled_at: iso(source.sampled_at), total_count: integer(source.total_count), threads_total: nullable(source.threads_total, integer),
    processes: array(source.processes, 10000, row => { const process = object(row); return {
      pid: integer(process.pid), name: text(process.name, 256), user: text(process.user, 256), status: text(process.status, 128), cpu_percent: nullable(process.cpu_percent, percent),
      memory_bytes: nullable(process.memory_bytes, integer), memory_percent: nullable(process.memory_percent, percent), threads: nullable(process.threads, integer) }; }) };
}
const sanitizers = { health, snapshot, processes };

/** Callers validate their public Host before handle(). No caller-selected host, URL or path exists. */
export function createTaskManagerProxy({ auth, port = taskManagerPort() } = {}) {
  port = taskManagerPort(port);
  if (typeof auth?.authorizeRead !== 'function') throw new Error('The existing desktop auth lease is required.');
  const jobs = new Set(), sessionStreams = new Map(), sessionRequests = new Map();
  let closing = false, streams = 0, requests = 0;

  function handle(req, res) {
    if (typeof req.url !== 'string' || !req.url.startsWith(NAMESPACE)) return Promise.resolve(false);
    const endpoint = ENDPOINTS.get(req.url), head = req.method === 'HEAD';
    if (!endpoint) { errorReply(res, 404, 'not_found', head); return Promise.resolve(true); }
    if (!['GET', 'HEAD'].includes(req.method)) { errorReply(res, 405, 'read_only', head); return Promise.resolve(true); }
    if (closing) { errorReply(res, 503, 'monitor_unavailable', head); return Promise.resolve(true); }
    const authorization = auth.authorizeRead(req);
    if (!authorization.ok) { errorReply(res, authorization.status, authorization.error, head); return Promise.resolve(true); }
    const stream = endpoint === 'events' && !head;
    const counts = stream ? sessionStreams : sessionRequests;
    const sessionCount = counts.get(authorization.sessionId) || 0;
    if ((stream && (streams >= TASK_MANAGER_LIMITS.streams || sessionCount >= TASK_MANAGER_LIMITS.streamsPerSession))
      || (!stream && (requests >= TASK_MANAGER_LIMITS.requests || sessionCount >= TASK_MANAGER_LIMITS.requestsPerSession))) {
      errorReply(res, 429, 'connection_limit', head); return Promise.resolve(true);
    }
    counts.set(authorization.sessionId, sessionCount + 1);
    if (stream) streams++; else requests++;
    let disposed = false, upstream, response, deadline, interval, writeTimer, waitingDrain = false;
    let eventBuffer = '', eventDecoder;
    const started = performance.now();
    let lastUpstream = started, lastClient = started;
    const job = { stop: () => fail(503, 'monitor_unavailable') }; jobs.add(job);
    const valid = () => !closing && authorization.isValid();
    function cleanup() {
      if (disposed) return;
      disposed = true;
      clearTimeout(deadline); clearTimeout(writeTimer); clearInterval(interval);
      req.removeListener('aborted', clientClosed); res.removeListener('close', clientClosed); res.removeListener('finish', cleanup); res.removeListener('drain', resume);
      jobs.delete(job);
      const remaining = (counts.get(authorization.sessionId) || 1) - 1;
      if (remaining) counts.set(authorization.sessionId, remaining); else counts.delete(authorization.sessionId);
      if (stream) streams--; else requests--;
      response?.destroy(); upstream?.destroy();
    }
    function clientClosed() { cleanup(); }
    function fail(status, error) {
      if (disposed) return;
      cleanup(); errorReply(res, status, error, head);
    }
    function finishStream(hard = false) { if (!disposed) { cleanup(); if (hard) res.destroy(); else res.end(); } }
    function resume() {
      if (disposed) return;
      clearTimeout(writeTimer); waitingDrain = false;
      if (!valid()) { finishStream(true); return; }
      processFrames();
      if (!waitingDrain && !disposed) response?.resume();
    }
    function writeFrame(frame) {
      if (!valid()) { finishStream(true); return false; }
      lastClient = performance.now();
      if (!res.write(frame)) {
        waitingDrain = true; response.pause();
        writeTimer = setTimeout(() => finishStream(true), TASK_MANAGER_LIMITS.writeTimeoutMs);
        res.once('drain', resume);
      }
      return !waitingDrain;
    }
    function processFrames() {
      if (disposed || waitingDrain) return;
      while (!waitingDrain && !disposed) {
        const separator = eventBuffer.indexOf('\n\n');
        if (separator < 0) break;
        const frame = eventBuffer.slice(0, separator); eventBuffer = eventBuffer.slice(separator + 2);
        const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
        if (!data) continue; // Comments and retry fields cannot inject browser events or headers.
        try {
          const metric = snapshot(JSON.parse(data));
          if (!writeFrame(`id: ${metric.seq}\nretry: 3000\ndata: ${JSON.stringify(metric)}\n\n`)) break;
        } catch { finishStream(true); break; }
      }
    }
    req.once('aborted', clientClosed); res.once('close', clientClosed); res.once('finish', cleanup);
    deadline = setTimeout(() => fail(503, 'monitor_unavailable'), TASK_MANAGER_LIMITS.requestTimeoutMs);
    upstream = http.request({ hostname: HOST, port, method: endpoint === 'events' && head ? 'HEAD' : 'GET', path: '/api/' + endpoint,
      agent: false, headers: { Host: HOST + ':' + port, Accept: endpoint === 'events' ? 'text/event-stream' : 'application/json', 'Accept-Encoding': 'identity', Connection: 'close' } }, incoming => {
      response = incoming;
      if (disposed) { incoming.destroy(); return; }
      if (!valid()) { fail(401, 'authentication_required'); return; }
      if (incoming.statusCode !== 200) { fail(incoming.statusCode === 503 || incoming.statusCode === 429 ? 503 : 502, 'monitor_unavailable'); return; }
      const expectedType = endpoint === 'events' ? EVENT_TYPE : JSON_TYPE;
      if (!expectedType.test(incoming.headers['content-type'] || '') || (incoming.headers['content-encoding'] && incoming.headers['content-encoding'] !== 'identity')) {
        fail(502, 'invalid_monitor_response'); return;
      }
      incoming.on('error', () => fail(502, 'monitor_unavailable'));
      incoming.on('aborted', () => fail(502, 'monitor_unavailable'));
      if (endpoint === 'events') {
        clearTimeout(deadline);
        res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream; charset=utf-8', 'X-Accel-Buffering': 'no' });
        if (head) { res.end(); return; }
        eventDecoder = new TextDecoder('utf-8', { fatal: true });
        if (!writeFrame('retry: 3000\n\n')) return;
        interval = setInterval(() => {
          const time = performance.now();
          if (!valid()) { finishStream(true); return; }
          if (time - started >= TASK_MANAGER_LIMITS.streamDurationMs || time - lastUpstream >= TASK_MANAGER_LIMITS.upstreamIdleMs) { finishStream(); return; }
          if (!waitingDrain && time - lastClient >= TASK_MANAGER_LIMITS.heartbeatMs) writeFrame(': heartbeat\n\n');
        }, TASK_MANAGER_LIMITS.authorizationCheckMs);
        incoming.on('data', chunk => {
          if (!valid()) { finishStream(true); return; }
          lastUpstream = performance.now();
          try {
            eventBuffer = (eventBuffer + eventDecoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n');
            if (Buffer.byteLength(eventBuffer) > TASK_MANAGER_LIMITS.streamFrameBytes) { finishStream(true); return; }
            processFrames();
          } catch { finishStream(true); }
        });
        incoming.once('end', finishStream);
        return;
      }
      if (incoming.headers['content-length'] && Number(incoming.headers['content-length']) > TASK_MANAGER_LIMITS.jsonBytes) { fail(502, 'invalid_monitor_response'); return; }
      let bytes = 0; const chunks = [];
      incoming.on('data', chunk => {
        if (!valid()) { fail(401, 'authentication_required'); return; }
        bytes += chunk.length;
        if (bytes > TASK_MANAGER_LIMITS.jsonBytes) { fail(502, 'invalid_monitor_response'); return; }
        chunks.push(chunk);
      });
      incoming.once('end', () => {
        if (disposed) return;
        if (!valid()) { fail(401, 'authentication_required'); return; }
        let data;
        try { data = sanitizers[endpoint](JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
        catch { fail(502, 'invalid_monitor_response'); return; }
        res.writeHead(200, { ...HEADERS, 'Content-Type': 'application/json; charset=utf-8' });
        res.end(head ? undefined : JSON.stringify(data));
      });
    });
    upstream.once('error', () => fail(503, 'monitor_unavailable'));
    upstream.end();
    return Promise.resolve(true);
  }
  return { handle, async drain() { if (closing) return; closing = true; for (const job of [...jobs]) job.stop(); } };
}
