#!/usr/bin/env bash
set -Eeuo pipefail

STAGE="${1:?stage}"
EXPECTED_SHA="${2:?archive sha256}"
EXPECTED_NGINX_SHA="${3:?nginx baseline sha256}"
[[ "$STAGE" =~ ^/var/tmp/aiden-moyuan-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{10}$ ]] || exit 2
[[ "$EXPECTED_SHA" =~ ^[a-f0-9]{64}$ && "$EXPECTED_NGINX_SHA" =~ ^[a-f0-9]{64}$ ]] || exit 2
[ -d "$STAGE" ] && [ ! -L "$STAGE" ] && [ "$(stat -c %a "$STAGE")" = 700 ] || exit 2

exec 9>/run/lock/aiden-desktop-release.lock
flock -n 9 || { echo 'Another desktop release is active' >&2; exit 3; }
printf '%s  %s\n' "$EXPECTED_SHA" "$STAGE/payload.tar.gz" | sha256sum -c -
WORK="$STAGE/unpacked"
mkdir -m 700 "$WORK"
tar -xzf "$STAGE/payload.tar.gz" --no-same-owner -C "$WORK"
NODE=/opt/node24/bin/node

"$NODE" - "$WORK" "$EXPECTED_NGINX_SHA" <<'VERIFY'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = process.argv[2];
const expectedNginx = process.argv[3];
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release.json'), 'utf8'));
if (manifest.format !== 1 || !/^moyuan-\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(manifest.id) ||
    !/^[a-f0-9]{40}$/.test(manifest.commit) || !manifest.id.endsWith('-' + manifest.commit.slice(0, 10))) fail('Bad release identity');
if (manifest.nginxBeforeSHA256 !== expectedNginx || !/^[a-f0-9]{64}$/.test(manifest.nginxConfigSHA256)) fail('Nginx checksum mismatch');
const files = Array.isArray(manifest.files) ? manifest.files : [];
if (files.length < 4 || files.length > 1000) fail('Unexpected file count');
const listed = new Map();
for (const file of files) {
  if (!file || typeof file.path !== 'string' || !(file.path === 'index.html' || file.path === 'favicon.svg' || /^assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(file.path) || /^fonts\/OFL-Noto(?:Sans|Serif)SC\.txt$/.test(file.path)) ||
      file.path.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.') || /[\\:\x00-\x1f]/.test(part)) ||
      !Number.isSafeInteger(file.bytes) || file.bytes <= 0 || !/^[a-f0-9]{64}$/.test(file.sha256) || listed.has(file.path)) fail('Bad manifest file');
  listed.set(file.path, file);
}
if (!listed.has('index.html')) fail('index.html missing');
const html = fs.readFileSync(path.join(root, 'payload/index.html'), 'utf8');
if (!html.includes('/liyun-moyuan/assets/') || html.includes('/src/main.js')) fail('Wrong production base');
if (sha(fs.readFileSync(path.join(root, 'nginx-projects.conf'))) !== manifest.nginxConfigSHA256) fail('Nginx config mismatch');
const seen = new Set();
function walk(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const relative = prefix + entry.name, absolute = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) fail('Symlink in payload');
    if (entry.isDirectory()) walk(absolute, relative + '/');
    else if (entry.isFile()) {
      const expected = listed.get(relative); if (!expected) fail('Unlisted payload file');
      const bytes = fs.readFileSync(absolute); if (bytes.length !== expected.bytes || sha(bytes) !== expected.sha256) fail('Payload checksum mismatch');
      seen.add(relative);
    } else fail('Unsupported payload member');
  }
}
walk(path.join(root, 'payload')); if (seen.size !== listed.size) fail('Manifest missing payload files');
console.log(JSON.stringify({verified:true,id:manifest.id,commit:manifest.commit,files:files.length}));
VERIFY

ID="$($NODE -p "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).id" "$WORK/release.json")"
ROOT=/opt/projects/liyun-moyuan
REL="$ROOT/releases/$ID"
HISTORY="/var/lib/aiden-release-history/$ID"
NGINX_SNIPPET=/etc/nginx/snippets/win11-home-projects.conf
PREV=''
if [ -e "$ROOT/current" ] || [ -L "$ROOT/current" ]; then
  [ -L "$ROOT/current" ] || { echo 'Refusing non-symlink current' >&2; exit 4; }
  PREV="$(readlink -f "$ROOT/current")"
  [[ "$PREV" == /opt/projects/liyun-moyuan/releases/* ]] && [ -d "$PREV" ] || exit 4
fi
CURRENT_NGINX_SHA="$(sha256sum "$NGINX_SNIPPET" | awk '{print $1}')"
[ "$CURRENT_NGINX_SHA" = "$EXPECTED_NGINX_SHA" ] || { echo 'Nginx snippet changed after preflight' >&2; exit 4; }
[ ! -e "$REL" ] && [ ! -L "$REL" ] && [ ! -e "$HISTORY" ] || { echo 'Release identity already exists' >&2; exit 4; }
install -d -m 700 "$HISTORY"
cp -p "$NGINX_SNIPPET" "$HISTORY/win11-home-projects.conf.before"
printf '%s\n' "$PREV" > "$HISTORY/previous-current"
COMMITTED=0
rollback() {
  local rc=$?; trap - ERR INT TERM EXIT
  if [ "$COMMITTED" = 0 ]; then
    if [ -n "$PREV" ] && [ -d "$PREV" ]; then ln -sfn "$PREV" "$ROOT/.rollback-$ID"; mv -Tf "$ROOT/.rollback-$ID" "$ROOT/current"; elif [ -L "$ROOT/current" ]; then rm -f "$ROOT/current"; fi
    cp -p "$HISTORY/win11-home-projects.conf.before" "$NGINX_SNIPPET"
    /usr/sbin/nginx -t && systemctl reload nginx || true
  fi
  exit "$rc"
}
trap rollback ERR INT TERM EXIT

install -d -m 755 "$REL"
cp -a "$WORK/payload/." "$REL/"
chown -R root:root "$REL"
find "$REL" -type d -exec chmod 755 {} +
find "$REL" -type f -exec chmod 644 {} +
# Keep every fingerprinted URL readable for tabs opened before a future update.
"$NODE" - "$WORK/release.json" "$REL" "$ROOT/shared-assets" <<'ASSETS'
const fs = require('fs'), path = require('path');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const source = process.argv[3], shared = process.argv[4];
fs.mkdirSync(shared, {recursive:true, mode:0o755});
for (const file of manifest.files.filter(f => f.path.startsWith('assets/'))) {
  const bytes = fs.readFileSync(path.join(source, file.path));
  const target = path.join(shared, file.path.slice(7));
  if (fs.existsSync(target)) {
    if (fs.lstatSync(target).isSymbolicLink() || !fs.readFileSync(target).equals(bytes)) throw Error('Immutable asset differs: ' + file.path);
  } else fs.writeFileSync(target, bytes, {flag:'wx', mode:0o644});
}
ASSETS
install -o root -g root -m 644 "$WORK/nginx-projects.conf" "$NGINX_SNIPPET.$ID.new"
mv -Tf "$NGINX_SNIPPET.$ID.new" "$NGINX_SNIPPET"
/usr/sbin/nginx -t
ln -s "$REL" "$ROOT/.current-$ID"
mv -Tf "$ROOT/.current-$ID" "$ROOT/current"
systemctl reload nginx
sleep .5

LIVE_INDEX="$WORK/live-index.html"
curl -fsS --resolve studentop.cn:443:127.0.0.1 -H 'Host: studentop.cn:14355' --max-time 12 https://studentop.cn/liyun-moyuan/ -o "$LIVE_INDEX"
grep -q '理韵墨苑' "$LIVE_INDEX"
grep -q '/liyun-moyuan/assets/' "$LIVE_INDEX"
"$NODE" - "$WORK/release.json" > "$WORK/live-files.tsv" <<'LIST'
const fs = require('fs'); const m = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
for (const f of m.files) console.log(f.path + '\t' + f.sha256 + '\t' + f.bytes);
LIST
while IFS=$'\t' read -r relative expected bytes; do
  [ -n "$relative" ] || continue
  target="$WORK/live-$RANDOM"
  curl -fsS --resolve studentop.cn:443:127.0.0.1 -H 'Host: studentop.cn:14355' --max-time 20 "https://studentop.cn/liyun-moyuan/$relative" -o "$target"
  actual_bytes="$(stat -c %s "$target")"; actual_sha="$(sha256sum "$target" | awk '{print $1}')"; rm -f "$target"
  [ "$actual_bytes" = "$bytes" ] && [ "$actual_sha" = "$expected" ] || { echo "Public checksum mismatch: $relative" >&2; exit 4; }
done < "$WORK/live-files.tsv"

for pair in \
  'studentop.cn|https://studentop.cn/' \
  'studentop.cn|https://studentop.cn/voxel-campus/' \
  'studentop.cn|https://studentop.cn/campus-entry/' \
  'liyun.studentop.cn|https://liyun.studentop.cn/' \
  'frost.studentop.cn|https://frost.studentop.cn/' \
  'genshin.studentop.cn|https://genshin.studentop.cn/'; do
  host="${pair%%|*}"; URL="${pair#*|}"
  code="$(curl -sS --max-time 12 -o /dev/null -w '%{http_code}' --resolve "$host:443:127.0.0.1" -H "Host: $host:14355" "$URL" 2>/dev/null || true)"
  [ "$code" = 200 ] || { echo "Neighbor check failed: $URL ($code)" >&2; exit 4; }
done

cat > "$HISTORY/receipt.json" <<EOF
{"ok":true,"id":"$ID","current":"$(readlink -f "$ROOT/current")","previous":"${PREV:-none}","nginxConfigChanged":true,"completedAt":"$(date -u +%Y-%m-%dT%H:%M:%SZ)"}
EOF
cp "$WORK/release.json" "$HISTORY/release.json"
COMMITTED=1; trap - ERR INT TERM EXIT
cat "$HISTORY/receipt.json"
