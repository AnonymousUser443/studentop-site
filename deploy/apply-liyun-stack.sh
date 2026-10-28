#!/usr/bin/env bash
# First same-origin account API + static release; all existing application data is retained.
set -Eeuo pipefail
STAGE="${1:?stage}"; DIGEST="${2:?archive SHA256}"; NODE=/opt/node24/bin/node
[[ "$STAGE" =~ ^/var/tmp/aiden-liyun-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{10}$ && "$DIGEST" =~ ^[a-f0-9]{64}$ && -d "$STAGE" && ! -L "$STAGE" ]] || exit 2
[[ "$(stat -c %a "$STAGE")" = 700 ]] || exit 2
exec 9>/run/lock/aiden-desktop-release.lock; flock -n 9 || exit 3
printf '%s  %s\n' "$DIGEST" "$STAGE/payload.tar.gz" | sha256sum -c -
[[ ! -e /etc/systemd/system/liyun-account.service && ! -e /opt/projects/liyun-api/current ]] || { echo 'API baseline moved' >&2; exit 4; }
[[ ! -e /var/lib/liyun-account ]] || { echo 'Unexpected existing account data; review before migration' >&2; exit 4; }
ss -ltnH 'sport = :8787' | grep -q . && { echo 'API port occupied' >&2; exit 4; }
mkdir -m 700 "$STAGE/unpack"
python3 - "$STAGE/payload.tar.gz" "$STAGE/unpack" <<'PY'
import sys,tarfile,pathlib
with tarfile.open(sys.argv[1],'r:gz') as t:
 members=t.getmembers()
 if len(members)>160 or sum(x.size for x in members)>64000000: raise RuntimeError('Archive exceeds bounds')
 for m in members:
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or chr(92) in m.name or not(m.isfile() or m.isdir()): raise RuntimeError('Unsafe member')
  if not(m.name in ('manifest.json','unit.service','projects.conf','payload','payload/','api','api/') or m.name.startswith(('payload/','api/'))): raise RuntimeError('Archive scope rejected')
 t.extractall(sys.argv[2],filter='data')
PY
MANIFEST="$STAGE/unpack/manifest.json"
ID="$($NODE -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).id)' "$MANIFEST")"
[[ "$ID" =~ ^liyun-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{10}$ ]] || exit 2
ROOT=/opt/projects/liyun; API=/opt/projects/liyun-api; REL="$ROOT/releases/$ID"; APIREL="$API/releases/$ID"; HISTORY="/var/lib/aiden-release-history/$ID"
[[ -L "$ROOT/current" ]] || exit 2
PREV="$(readlink -f "$ROOT/current")"; RAW="$(readlink "$ROOT/current")"
[[ "$PREV" = /opt/projects/liyun/releases/liyun-20261028T125837Z-d42554f163 ]] || exit 4
COMMITTED=0; FRONT=0; API_SWITCHED=0; UNIT=0; CONFIG=0
rollback(){
 rc=$?; trap - ERR HUP INT TERM EXIT
 if [[ "$COMMITTED" != 1 ]]; then
  echo 'Restoring the previous Liyun stack; database and release files are retained.' >&2
  if [[ "$FRONT" = 1 && "$(readlink -f "$ROOT/current")" = "$REL" ]]; then ln -s -- "$RAW" "$ROOT/.rollback-$ID" && mv -Tf -- "$ROOT/.rollback-$ID" "$ROOT/current"; fi
  if [[ "$CONFIG" = 1 ]]; then
   cp -- "$HISTORY/projects.before" /etc/nginx/sites-available/projects; chmod 644 /etc/nginx/sites-available/projects
   nginx -t && systemctl reload nginx
  fi
  if [[ "$UNIT" = 1 ]]; then systemctl disable --now liyun-account || true; fi
  if [[ "$API_SWITCHED" = 1 && -L "$API/current" && "$(readlink -f "$API/current")" = "$APIREL" ]]; then unlink "$API/current"; fi
  [[ "$rc" != 0 ]] || rc=1
 fi
 exit "$rc"
}
trap rollback ERR HUP INT TERM EXIT
nginx -t
"$NODE" "$STAGE/operator.mjs" install "$MANIFEST"
if ! id -u liyun-account >/dev/null 2>&1; then useradd --system --user-group --no-create-home --home-dir /var/lib/liyun-account --shell /usr/sbin/nologin liyun-account; fi
[[ "$(id -u liyun-account)" != 0 && "$(id -G liyun-account | wc -w)" = 1 ]] || exit 4
install -d -o liyun-account -g liyun-account -m 700 /var/lib/liyun-account
ln -s -- "$APIREL" "$API/.activate-$ID"; API_SWITCHED=1; mv -Tf -- "$API/.activate-$ID" "$API/current"
UNIT=1; install -o root -g root -m 644 "$STAGE/unpack/unit.service" /etc/systemd/system/liyun-account.service
systemctl daemon-reload; systemctl enable --now liyun-account
for attempt in $(seq 1 40); do if curl --fail --silent http://127.0.0.1:8787/api/health >/dev/null; then break; fi; sleep .25; done
curl --fail --silent http://127.0.0.1:8787/api/health >/dev/null
CONFIG=1; install -o root -g root -m 644 "$STAGE/unpack/projects.conf" /etc/nginx/sites-available/projects
nginx -t; systemctl reload nginx
ln -s -- "$REL" "$ROOT/.activate-$ID"; FRONT=1; mv -Tf -- "$ROOT/.activate-$ID" "$ROOT/current"
"$NODE" "$STAGE/operator.mjs" check "$MANIFEST"
"$NODE" "$STAGE/operator.mjs" record "$MANIFEST" > "$STAGE/receipt.json"
COMMITTED=1; trap - ERR HUP INT TERM EXIT
"$NODE" "$STAGE/operator.mjs" receipt "$MANIFEST"
