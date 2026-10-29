'use strict';
const { randomInt } = require('node:crypto');
// Windows can have a 1024..60000 ephemeral range; listen(0) is not a safe-port allocator.
// Bind a random browser-safe port atomically instead of changing system settings or touching other listeners.
exports.listenBrowserSafe = async function(server, choose = () => randomInt(20000, 40000)) {
  for (let attempt = 0; attempt < 64; attempt++) {
    const port = choose();
    if (!Number.isInteger(port) || port < 20000 || port >= 40000) throw new Error('Unsafe test port candidate');
    const ready = await new Promise((resolve, reject) => {
      const cleanup = () => { server.removeListener('listening', listening); server.removeListener('error', error); };
      const listening = () => { cleanup(); resolve(true); };
      const error = e => { cleanup(); if (e.code === 'EADDRINUSE' || e.code === 'EACCES') resolve(false); else reject(e); };
      server.once('listening', listening); server.once('error', error);
      server.listen({ port, host: '127.0.0.1', exclusive: true });
    });
    if (ready) return server.address().port;
  }
  throw new Error('No browser-safe test port available after bounded attempts');
};
