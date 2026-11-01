#!/usr/bin/env bash
# Owner-authorized publisher for the independent /liyun-moyuan/ static app.
set -Eeuo pipefail

CHECK_ONLY=0
if [ "${1:-}" = --check ]; then CHECK_ONLY=1; shift; fi
PI_HOST="${PI_HOST:-biteraiden-pi}"
SRC="${1:-apps/liyun-moyuan/dist}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
ROOT="$(pwd -P)"
[[ -d "$SRC" && -f "$SRC/index.html" ]] || { echo "Missing built app: $SRC" >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js is required' >&2; exit 1; }
command -v tar >/dev/null || { echo 'tar is required' >&2; exit 1; }
command -v sha256sum >/dev/null || { echo 'sha256sum is required' >&2; exit 1; }

COMMIT="$(git rev-parse HEAD)"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
ID="moyuan-${TS}-${COMMIT:0:10}"
mkdir -p "$ROOT/.release-local"
TMP="$(mktemp -d "$ROOT/.release-local/moyuan-stage.XXXXXX")"; STAGE="$TMP/stage"
# Windows Git Bash cannot impose POSIX modes on every local NTFS temp mount.
# This payload contains only public files; the Linux upload directory is 0700.
mkdir "$STAGE" "$STAGE/payload"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT
# Publish only runtime assets and the two required font licenses. Font audit
# reports and duplicate public font files are development evidence, not payload.
mkdir "$STAGE/payload/fonts"
cp -a "$SRC/index.html" "$SRC/favicon.svg" "$STAGE/payload/"
cp -a "$SRC/assets" "$STAGE/payload/"
cp -a "$SRC/fonts/OFL-NotoSansSC.txt" "$SRC/fonts/OFL-NotoSerifSC.txt" "$STAGE/payload/fonts/"
cp deploy/nginx/win11-home-projects.conf "$STAGE/nginx-projects.conf"

if [ "$CHECK_ONLY" = 1 ]; then
  NGINX_BEFORE="$(printf '%064d' 0)"
else
  NGINX_BEFORE="$(ssh -o BatchMode=yes -o ConnectTimeout=10 "$PI_HOST" 'sha256sum /etc/nginx/snippets/win11-home-projects.conf')"
  NGINX_BEFORE="${NGINX_BEFORE%% *}"
fi
[[ "$NGINX_BEFORE" =~ ^[a-f0-9]{64}$ ]] || { echo 'Could not read nginx baseline hash' >&2; exit 1; }

MOYUAN_NGINX_BEFORE_SHA256="$NGINX_BEFORE" node - "$STAGE" "$SRC" "$ID" "$COMMIT" <<'MANIFEST'
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const [stage, source, id, commit] = process.argv.slice(2);
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const allowed = p => p === 'index.html' || p === 'favicon.svg' || /^assets\/[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(p) || /^fonts\/OFL-Noto(?:Sans|Serif)SC\.txt$/.test(p);
const files = [];
function walk(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const relative = prefix + entry.name, absolute = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) throw Error('Symlink in build: ' + relative);
    if (entry.isDirectory()) walk(absolute, relative + '/');
    else if (entry.isFile()) {
      if (!allowed(relative) || relative.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))) throw Error('Unapproved build path: ' + relative);
      const bytes = fs.readFileSync(absolute); files.push({path: relative, bytes: bytes.length, sha256: sha(bytes)});
    } else throw Error('Unsupported build member: ' + relative);
  }
}
walk(path.join(stage, 'payload')); files.sort((a,b) => a.path.localeCompare(b.path));
if (!files.some(f => f.path === 'index.html') || files.length < 4 || files.length > 1000) throw Error('Unexpected build file set');
const html = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
if (!html.includes('/liyun-moyuan/assets/') || html.includes('/src/main.js')) throw Error('Build does not use /liyun-moyuan/ base');
const nginx = fs.readFileSync(path.join(stage, 'nginx-projects.conf'));
const manifest = {format: 1, id, commit, nginxBeforeSHA256: process.env.MOYUAN_NGINX_BEFORE_SHA256, nginxConfigSHA256: sha(nginx), files};
fs.writeFileSync(path.join(stage, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({id, commit, files: files.length, bytes: files.reduce((n,f) => n + f.bytes, 0)}));
MANIFEST

ARCHIVE="$STAGE/payload.tar.gz"
tar -czf "$ARCHIVE" -C "$STAGE" release.json nginx-projects.conf payload
ARCHIVE_SHA="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
SCRIPT_SHA="$(sha256sum deploy/apply-moyuan-release.sh | awk '{print $1}')"
if [ "$CHECK_ONLY" = 1 ]; then
  echo "Local Moyuan package verified: $ID ($ARCHIVE_SHA). No server contacted."
  exit 0
fi
REMOTE_STAGE="/var/tmp/aiden-$ID"
[[ "$REMOTE_STAGE" =~ ^/var/tmp/aiden-moyuan-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{10}$ ]] || exit 2
ssh -o BatchMode=yes -o ConnectTimeout=10 "$PI_HOST" "test ! -e '$REMOTE_STAGE' && test ! -L '$REMOTE_STAGE' && install -d -m 700 '$REMOTE_STAGE'"
scp -q -o ConnectTimeout=10 "$ARCHIVE" deploy/apply-moyuan-release.sh "$PI_HOST:$REMOTE_STAGE/"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$PI_HOST" "set -eu; chmod 700 '$REMOTE_STAGE/apply-moyuan-release.sh'; printf '%s  %s\\n' '$SCRIPT_SHA' '$REMOTE_STAGE/apply-moyuan-release.sh' | sha256sum -c -; sudo -n bash '$REMOTE_STAGE/apply-moyuan-release.sh' '$REMOTE_STAGE' '$ARCHIVE_SHA' '$NGINX_BEFORE'"
ssh -o BatchMode=yes -o ConnectTimeout=10 "$PI_HOST" "sudo -n rm -rf -- '$REMOTE_STAGE'"
echo "Moyuan deployed: $ID"
