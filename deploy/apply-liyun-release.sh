#!/usr/bin/env bash
# Owner-authorized single-static-app transaction. No nginx config/restart or private-data writes.
set -Eeuo pipefail
STAGE="${1:?stage}"; DIGEST="${2:?archive sha256}"
[[ "$STAGE" =~ ^/var/tmp/aiden-liyun-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{10}$ ]] || exit 2
[[ "$DIGEST" =~ ^[a-f0-9]{64}$ && -d "$STAGE" && ! -L "$STAGE" ]] || exit 2
[[ "$(stat -c %a "$STAGE")" = 700 ]] || exit 2
exec 9>/run/lock/aiden-desktop-release.lock
flock -n 9 || { echo 'Another release is running' >&2; exit 3; }
printf '%s  %s\n' "$DIGEST" "$STAGE/payload.tar.gz" | sha256sum -c -
mkdir -m 700 "$STAGE/unpack"
python3 - "$STAGE/payload.tar.gz" "$STAGE/unpack" <<'PY'
import sys,tarfile,pathlib
with tarfile.open(sys.argv[1],'r:gz') as t:
 members=t.getmembers()
 if len(members)>100 or sum(x.size for x in members)>5000000: raise RuntimeError('Unexpected archive size')
 for m in members:
  p=pathlib.PurePosixPath(m.name)
  if p.is_absolute() or '..' in p.parts or chr(92) in m.name or not(m.isfile() or m.isdir()): raise RuntimeError('Unsafe archive member')
  if not(m.name in ('manifest.json','payload','payload/') or m.name.startswith('payload/')): raise RuntimeError('Archive scope rejected')
 t.extractall(sys.argv[2],filter='data')
PY
NODE=/opt/node24/bin/node
MANIFEST="$STAGE/unpack/manifest.json"
ID="$($NODE -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).id)' "$MANIFEST")"
[[ "$ID" =~ ^liyun-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{10}$ ]] || exit 2
ROOT=/opt/projects/liyun; REL="$ROOT/releases/$ID"
[[ -L "$ROOT/current" && -d "$ROOT/current" ]] || exit 2
PREV="$(readlink -f "$ROOT/current")"; RAW="$(readlink "$ROOT/current")"
[[ "$PREV" = /opt/projects/liyun/releases/20261027T0656Z ]] || exit 2
COMMITTED=0; SWITCHED=0
rollback(){
 rc=$?; trap - ERR INT TERM HUP EXIT
 if [[ "$COMMITTED" != 1 ]]; then
  echo 'Liyun release failed; retaining immutable files and restoring previous pointer if needed.' >&2
  if [[ "$SWITCHED" = 1 && "$(readlink -f "$ROOT/current")" = "$REL" ]]; then
   ln -s -- "$RAW" "$ROOT/.rollback-$ID" && mv -Tf -- "$ROOT/.rollback-$ID" "$ROOT/current"
   "$NODE" "$STAGE/operator.mjs" check "$MANIFEST" previous || true
  fi
  [[ "$rc" != 0 ]] || rc=1
 fi
 exit "$rc"
}
trap rollback ERR INT TERM HUP EXIT
nginx -t
"$NODE" "$STAGE/operator.mjs" install "$MANIFEST"
ln -s -- "$REL" "$ROOT/.activate-$ID"
SWITCHED=1
mv -Tf -- "$ROOT/.activate-$ID" "$ROOT/current"
"$NODE" "$STAGE/operator.mjs" check "$MANIFEST"
"$NODE" "$STAGE/operator.mjs" record "$MANIFEST" > "$STAGE/receipt.json"
COMMITTED=1
trap - ERR INT TERM HUP EXIT
"$NODE" "$STAGE/operator.mjs" receipt "$MANIFEST"
