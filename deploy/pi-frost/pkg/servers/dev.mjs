// Unified static site and private SQLite API. Importing does not bind a port.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from './app.mjs';
export { createApp, createServer } from './app.mjs';

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PORT || 4173);
  const host = process.env.HOST || '127.0.0.1';
  const server = createServer({root:process.env.FROST_RELEASE_ROOT || undefined});
  server.listen(port, host, () => {
    const address = server.address();
    const shownHost = host.includes(':') ? `[${host}]` : host;
    console.log(`地图及 API  http://${shownHost}:${address.port}/`);
    console.log(`动态画框    http://${shownHost}:${address.port}/scene/`);
    console.log(`经纬标定    http://${shownHost}:${address.port}/calibration/`);
    console.log('管理机关使用独立本机入口：npm run office。');
    console.log('私人数据目录：' + server.app.dataDir);
    console.log('管理凭据来自 FROST_ADMIN_TOKEN 或私人数据目录 admin-token.txt；不在访问日志显示。');
  });
  server.on('error', error => {
    console.error(error.message);
    if (error.code === 'EADDRINUSE') console.error(`端口 ${port} 被占用，请设置 PORT 使用其他端口。`);
    server.app.close();
    process.exitCode = 1;
  });
  const stop = () => {
    server.close();
    server.closeIdleConnections();
    const timer = setTimeout(() => server.closeAllConnections(), 5000);
    timer.unref();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
