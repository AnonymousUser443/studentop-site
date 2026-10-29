#!/usr/bin/env bash
# ==============================================================================
# deploy-site.sh - atomically publish the local frontend build to the Raspberry Pi
#
# Usage (from Windows Git Bash, run at the repo root):
#   bash deploy/deploy-site.sh [SOURCE_DIR]
#
#   SOURCE_DIR  default: dist-site (verified output of node tools/build-site.mjs)
#               Raw site/ source and unrelated app builds are rejected locally.
#
# Environment overrides:
#   PI_HOST=pi      ssh alias of the Pi
#   REMOTE_ROOT=/opt/win11-home
#   FORCE_FAIL_AFTER_SWITCH=1  test hook: force the rollback path (smoke test only)
#
# Flow: local tar -> scp -> remote extract to releases/<UTC-ts>/ -> chown root
#       -> nginx -t -> atomic symlink swap (current) -> reload -> self-check
#       -> on self-check failure: switch back to the previous release.
# Nothing outside /opt/win11-home/releases, /opt/win11-home/current and
# /tmp/win11-home-*.tar.gz is touched. Idempotent (every run = new release).
# ==============================================================================
set -euo pipefail

# 约定：树莓派部署只能由仓库所有者发起（见 DEPLOYMENT-POLICY.md）
printf '\n!! 部署权限：树莓派只能由仓库所有者发起部署（见 DEPLOYMENT-POLICY.md）\n\n'

PI_HOST="${PI_HOST:-pi}"

# --- 传输层参数（CI 用）：SSH_OPTS 透传 -i/-F/-o，PI_SSH_PORT 指定非 22 端口 ---
PI_SSH_PORT="${PI_SSH_PORT-}"
SSH_OPTS="${SSH_OPTS-}"
SSH_CMD=(ssh)
SCP_CMD=(scp)
if [ -n "$PI_SSH_PORT" ]; then
  SSH_CMD+=(-p "$PI_SSH_PORT")
  SCP_CMD+=(-P "$PI_SSH_PORT")
fi
if [ -n "$SSH_OPTS" ]; then
  # shellcheck disable=SC2206
  __SSH_OPTS_ARR=($SSH_OPTS)
  SSH_CMD+=("${__SSH_OPTS_ARR[@]}")
  SCP_CMD+=("${__SSH_OPTS_ARR[@]}")
fi
REMOTE_ROOT="${REMOTE_ROOT:-/opt/win11-home}"
SRC="${1:-dist-site}"
FORCE_FAIL_AFTER_SWITCH="${FORCE_FAIL_AFTER_SWITCH:-0}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
say() { printf '== %s\n' "$*"; }

# ---- 0. resolve source -------------------------------------------------------
[ -d "$SRC" ] || die "source directory not found: $SRC (run from the repo root, or pass a path)"
[ -f "$SRC/index.html" ] || die "no index.html in $SRC - run node tools/build-site.mjs first"
[ -f "$SRC/version.json" ] && [ -f "$SRC/site-build.json" ] || die "not a versioned site build: $SRC"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null 2>&1 || die "Node.js is required for the local release integrity guard"
# This guard performs only local reads/checksums, before tar, SSH, SCP or any remote operation.
node "$SCRIPT_DIR/../tools/build-site.mjs" --check "$SRC" || die "local site release verification failed"

EXPECTED_VERSION="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).id)' "$SRC/version.json")"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
TMP_DIR="$(mktemp -d)"
ARCHIVE="$TMP_DIR/site.tar.gz"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# ---- 1. pack (exclude VCS / dependency noise) --------------------------------
say "packing $SRC"
tar -czf "$ARCHIVE" -C "$SRC" \
  --exclude='./.git' --exclude='./.git/*' \
  --exclude='./node_modules' --exclude='./node_modules/*' \
  --exclude='./.DS_Store' --exclude='./Thumbs.db' \
  --exclude='./.vscode' --exclude='./.idea' \
  . 2>/dev/null || die "tar failed"
[ -s "$ARCHIVE" ] || die "archive is empty"
say "archive: $(du -h "$ARCHIVE" | cut -f1)"

# ---- 2. preflight ------------------------------------------------------------
"${SSH_CMD[@]}" -o ConnectTimeout=10 -o BatchMode=yes "$PI_HOST" true \
  || die "cannot ssh to $PI_HOST"
PREV="$("${SSH_CMD[@]}" -o ConnectTimeout=10 "$PI_HOST" 'readlink -f /opt/win11-home/current 2>/dev/null || true')"
say "previous current: ${PREV:-<none>}"

# make the release timestamp unique on the remote side
EXISTS="$("${SSH_CMD[@]}" -o ConnectTimeout=10 "$PI_HOST" "test -e $REMOTE_ROOT/releases/$TS && echo yes || echo no")"
if [ "$EXISTS" = "yes" ]; then
  TS="${TS}-$(date -u +%s)"
  say "timestamp collision, using $TS"
fi
REMOTE_ARCH="/tmp/win11-home-${TS}.tar.gz"

# ---- 3. upload ---------------------------------------------------------------
say "uploading to $PI_HOST:$REMOTE_ARCH"
"${SCP_CMD[@]}" -o ConnectTimeout=10 -q "$ARCHIVE" "$PI_HOST:$REMOTE_ARCH" \
  || die "scp failed"

# ---- 4. remote activate + self-check (rollback on failure) -------------------
say "activating release $TS on $PI_HOST"
set +e
"${SSH_CMD[@]}" -o ConnectTimeout=10 "$PI_HOST" "sudo -n env EXPECTED_VERSION='$EXPECTED_VERSION' TS='$TS' PREV='$PREV' REMOTE_ROOT='$REMOTE_ROOT' REMOTE_ARCH='$REMOTE_ARCH' FORCE_FAIL_AFTER_SWITCH='$FORCE_FAIL_AFTER_SWITCH' bash -s" <<'REMOTE_SCRIPT'
set -euo pipefail
exec 9>/run/lock/aiden-desktop-release.lock
flock -n 9 || { echo 'Another desktop release is active' >&2; exit 1; }
# Do not put a fail-closed frontend online until its private companion is really reachable.
curl -fsS --resolve studentop.cn:443:127.0.0.1 -H 'Host: studentop.cn:14355' https://studentop.cn/__desktop/auth | /opt/node24/bin/node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{if(JSON.parse(s).configured!==true)process.exitCode=1;}catch{process.exitCode=1;}});'

ROOT="${REMOTE_ROOT}"
REL="$ROOT/releases/$TS"
ARCH="${REMOTE_ARCH}"
S="sudo -n"
log() { printf '[remote] %s\n' "$*"; }

[ -f "$ARCH" ] || { echo "[remote] ERROR: archive missing: $ARCH" >&2; exit 1; }

$S mkdir -p "$REL"
if ! $S tar -xzf "$ARCH" -C "$REL" --no-same-owner; then
  echo "[remote] ERROR: extract failed" >&2
  $S rm -rf "$REL"
  exit 1
fi
if [ ! -f "$REL/index.html" ]; then
  echo "[remote] ERROR: release has no index.html, aborting" >&2
  $S rm -rf "$REL"
  exit 1
fi
$S chown -R root:root "$REL"
$S find "$REL" -type d -exec chmod 755 {} +
$S find "$REL" -type f -exec chmod 644 {} +

# Preserve immutable namespaces outside current, including clean-checkout CI releases.
$S mkdir -p "$ROOT/shared/assets/releases"
$S cp -an "$REL/assets/releases/." "$ROOT/shared/assets/releases/"

# nginx config is unchanged by a release, but test before switching anyway
if ! $S nginx -t >/dev/null 2>&1; then
  echo "[remote] ERROR: nginx -t failed, current release left untouched" >&2
  exit 1
fi

# atomic symlink swap: create next to it, then rename(2) over
$S ln -sfn "$REL" "$ROOT/.current.new"
$S mv -Tf "$ROOT/.current.new" "$ROOT/current"
if ! $S systemctl reload nginx; then
  $S systemctl restart nginx || true
fi
sleep 0.6

code_http=$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 -H 'Host: studentop.cn' http://127.0.0.1/ || true)
code_https=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 --resolve studentop.cn:443:127.0.0.1 https://studentop.cn/ || true)
title=$(curl -sk --max-time 8 --resolve studentop.cn:443:127.0.0.1 https://studentop.cn/ 2>/dev/null | tr -d '\n' | grep -o '<title>[^<]*</title>' | head -1 || true)
log "self-check: http=$code_http https=$code_https title=${title:-<none>}"

actual_version=$(curl -fsS --max-time 8 --resolve studentop.cn:443:127.0.0.1 https://studentop.cn/version.json | /opt/node24/bin/node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{console.log(JSON.parse(s).id)}catch{process.exitCode=1}});' || true)
if [ "$code_http" != "200" ] || [ "$code_https" != "200" ] || [ "$actual_version" != "$EXPECTED_VERSION" ] || [ "${FORCE_FAIL_AFTER_SWITCH:-0}" = "1" ]; then
  if [ "${FORCE_FAIL_AFTER_SWITCH:-0}" = "1" ]; then
    echo "[remote] TEST HOOK: forcing failure to exercise the rollback path" >&2
  fi
  echo "[remote] SELF-CHECK FAILED, rolling back to ${PREV:-<none>}" >&2
  if [ -n "${PREV:-}" ] && [ -e "$PREV" ]; then
    $S ln -sfn "$PREV" "$ROOT/.current.new"
    $S mv -Tf "$ROOT/.current.new" "$ROOT/current"
    $S systemctl reload nginx || $S systemctl restart nginx || true
    echo "[remote] rolled back to $PREV" >&2
  else
    echo "[remote] no previous release available, current now points at the failed release" >&2
  fi
  exit 4
fi

$S rm -f "$ARCH"
log "release OK: $REL"
log "current -> $(readlink -f "$ROOT/current")"
echo "TITLE=${title}"
REMOTE_SCRIPT
RC=$?
set -e

if [ "$RC" -ne 0 ]; then
  die "remote deployment failed (exit $RC) - see [remote] lines above; previous release preserved when possible"
fi
say "deployed successfully: $REMOTE_ROOT/releases/$TS -> current"
