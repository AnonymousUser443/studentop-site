// Offline only: filesystem access to the private DB and out-of-band ownership verification required.
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { AccountError, openStore, validatePassword } from './store.mjs';

async function main() {
  const [flag, userId, ...extra] = process.argv.slice(2);
  if (flag !== '--verified-owner' || !/^[a-f0-9-]{36}$/i.test(userId ?? '') || extra.length || !process.env.LIYUN_DATA_DIR) throw new Error('usage');
  if (!process.stdin.isTTY || !process.stderr.isTTY) throw new Error('TTY required');
  // A terminal readline input with a muted output disables terminal echo; no history is kept.
  const output = new Writable({ write(_chunk, _encoding, done) { done(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  rl.on('SIGINT', () => rl.close());
  const askSecret = prompt => new Promise((resolve, reject) => {
    const cancelled = () => reject(new Error('cancelled'));
    rl.once('close', cancelled);
    process.stderr.write(prompt);
    rl.question('', answer => { rl.removeListener('close', cancelled); process.stderr.write('\n'); resolve(answer); });
  });
  let store;
  let password = '';
  let confirm = '';
  try {
    password = await askSecret('新的访问口令（不回显）：');
    confirm = await askSecret('再次输入：');
    validatePassword(password);
    if (password !== confirm) throw new AccountError(400, '两次口令不一致，未修改');
    store = openStore({ dataDir: process.env.LIYUN_DATA_DIR });
    store.migrateLegacyPassword(userId, password);
    process.stderr.write('已迁移此已核验的旧账号；旧会话已撤销。\n');
  } finally { password = ''; confirm = ''; rl.close(); store?.close(); }
}
main().catch(error => {
  console.error(error instanceof AccountError ? error.message : '迁移未完成：须管理员停服核验，在本机TTY设置LIYUN_DATA_DIR并运行 migrate-legacy.mjs --verified-owner <内部UUID>');
  process.exitCode = 1;
});
