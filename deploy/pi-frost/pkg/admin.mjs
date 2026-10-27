// Local maintenance only. No network or public unseal endpoint.
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { PROJECT_ROOT } from '../servers/app.mjs';
import { openStore, readDefaultPins, loadAdminToken, sha256 } from '../servers/store.mjs';
import { validateStudentId } from '../servers/security.mjs';

const action = process.argv[2];
if (!['status', 'token', 'seal', 'unseal', 'reset'].includes(action)) {
  console.error('Usage: node scripts/admin.mjs status|token|seal|unseal|reset [studentId]');
  process.exitCode = 1;
} else {
  const dataDir = path.resolve(process.env.FROST_DATA_DIR || path.join(PROJECT_ROOT, 'server-data'));
  const store = openStore({ dataDir, defaultPins: readDefaultPins(PROJECT_ROOT) });
  try {
    if (action === 'token') console.log(loadAdminToken(dataDir, process.env.FROST_ADMIN_TOKEN));
    else if (action === 'status') console.log(JSON.stringify(store.config(), null, 2));
    else if (action === 'seal' || action === 'unseal') {
      store.transaction(() => {
        store.db.prepare('UPDATE config SET sealed=?,version=version+1 WHERE id=1').run(action === 'seal' ? 1 : 0);
        store.audit(null, 'maintenance.' + action);
      });
      console.log(JSON.stringify(store.config(), null, 2));
    } else {
      const studentId = validateStudentId(process.argv[3]);
      const user = store.db.prepare('SELECT id FROM users WHERE student_id=?').get(studentId);
      if (!user) throw new Error('Student not registered');
      const resetToken = randomBytes(24).toString('base64url');
      store.transaction(() => {
        store.db.prepare('UPDATE users SET reset_hash=?,reset_expires=? WHERE id=?').run(sha256(resetToken), Date.now() + 30 * 60_000, user.id);
        store.audit(user.id, 'admin.reset.issue');
      });
      console.log(JSON.stringify({ studentId, resetToken }));
    }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { store.close(); }
}
