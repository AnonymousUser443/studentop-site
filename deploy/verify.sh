#!/usr/bin/env bash
# ==============================================================================
# verify.sh - end-to-end health check of win11-home on the Raspberry Pi
#
# Usage (from Windows Git Bash, at the repo root):
#   bash deploy/verify.sh
#   EXPECT_TITLE="Windows 11" bash deploy/verify.sh   # optional title assertion
#
# Checks: nginx active + loopback-only listeners, current release readable,
#         HTTP 200 (Host studentop.cn), HTTPS 200 (-k, SNI studentop.cn),
#         <title> present/identical, security headers, dotfile deny,
#         ACME webroot path, frpc service + tunnel login state, public URL.
# Exit code: 0 = all required checks passed; 1 = at least one failed.
# The frpc/public checks are reported separately: the tunnel node is currently
# unreachable (see deploy/DIAGNOSIS.md), so they do NOT fail the script.
# ==============================================================================
set -euo pipefail

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
EXPECT_TITLE="${EXPECT_TITLE:-}"

printf '==== win11-home verify (%s) ====\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"

set +e
"${SSH_CMD[@]}" -o ConnectTimeout=10 -o BatchMode=yes "$PI_HOST" "EXPECT_TITLE='$EXPECT_TITLE' bash -s" <<'REMOTE_SCRIPT'
set -uo pipefail
FAIL=0
ok()   { printf '  [ OK ] %s\n' "$*"; }
bad()  { printf '  [FAIL] %s\n' "$*"; FAIL=1; }
info() { printf '  [ .. ] %s\n' "$*"; }

ROOT=/opt/win11-home
S="sudo -n"

echo "-- nginx"
if [ "$(systemctl is-active nginx)" = "active" ]; then ok "nginx.service active"; else bad "nginx.service not active"; fi
LISTEN_RAW="$($S ss -ltn 2>/dev/null)"
if grep -q '127.0.0.1:80' <<<"$LISTEN_RAW"; then ok "listening 127.0.0.1:80"; else bad "missing 127.0.0.1:80"; fi
if grep -q '127.0.0.1:443' <<<"$LISTEN_RAW"; then ok "listening 127.0.0.1:443"; else bad "missing 127.0.0.1:443"; fi
if $S ss -ltnp 2>/dev/null | grep nginx | grep -qE '0\.0\.0\.0:(80|443)|\[::\]:(80|443)'; then
  bad "nginx is exposed on a non-loopback address"
else
  ok "nginx loopback-only (no 0.0.0.0:80/443)"
fi

echo "-- release"
CUR="$(readlink -f "$ROOT/current" 2>/dev/null || true)"
if [ -n "$CUR" ] && [ -f "$CUR/index.html" ]; then ok "current -> $CUR"; else bad "current symlink/index.html missing"; fi
if [ -d "$ROOT/releases" ]; then info "releases: $(ls -1 "$ROOT/releases" | wc -l)"; fi
if [ -s "$ROOT/certs/studentop.cn.crt" ]; then
  info "TLS cert: $(openssl x509 -in "$ROOT/certs/studentop.cn.crt" -noout -subject -enddate 2>/dev/null | tr '\n' ' ')"
else
  bad "TLS cert missing"
fi

echo "-- HTTP / HTTPS"
C_HTTP="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 -H 'Host: studentop.cn' http://127.0.0.1/ || true)"
C_HTTPS="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 --resolve studentop.cn:443:127.0.0.1 https://studentop.cn:14355/ || true)"
[ "$C_HTTP" = "200" ] && ok "http://127.0.0.1/ -> 200 (Host: studentop.cn)" || bad "http://127.0.0.1/ -> $C_HTTP"
[ "$C_HTTPS" = "200" ] && ok "https://127.0.0.1/ -> 200 (-k, SNI studentop.cn)" || bad "https://127.0.0.1/ -> $C_HTTPS"

BODY_HTTPS="$(curl -sk --max-time 8 --resolve studentop.cn:443:127.0.0.1 https://studentop.cn:14355/ 2>/dev/null | tr -d '\n' || true)"
TITLE="$(grep -o '<title>[^<]*</title>' <<<"$BODY_HTTPS" | head -1 || true)"
TITLE_TXT="$(sed -e 's/<[^>]*>//g' <<<"$TITLE" 2>/dev/null || true)"
if [ -n "$TITLE" ]; then ok "title: $TITLE_TXT"; else bad "no <title> in response body"; fi
if [ -n "${EXPECT_TITLE:-}" ]; then
  if grep -qiF -- "$EXPECT_TITLE" <<<"$BODY_HTTPS"; then ok "title matches EXPECT_TITLE ('$EXPECT_TITLE')"; else bad "EXPECT_TITLE ('$EXPECT_TITLE') not found in page"; fi
fi
BODY_HTTP="$(curl -s --max-time 8 -H 'Host: studentop.cn' http://127.0.0.1/ 2>/dev/null | tr -d '\n' || true)"
TITLE_HTTP="$(grep -o '<title>[^<]*</title>' <<<"$BODY_HTTP" | head -1 || true)"
[ "$TITLE_HTTP" = "$TITLE" ] && ok "HTTP and HTTPS serve the same title" || bad "HTTP/HTTPS title mismatch"

echo "-- headers / policy"
HDR="$(curl -sk -D - -o /dev/null --max-time 8 --resolve studentop.cn:443:127.0.0.1 https://studentop.cn:14355/ 2>/dev/null | tr -d '\r' || true)"
for h in 'X-Content-Type-Options' 'X-Frame-Options' 'Referrer-Policy'; do
  if grep -qi "^$h:" <<<"$HDR"; then ok "header $h present"; else bad "header $h missing"; fi
done
if grep -qi '^Server: nginx/[0-9]' <<<"$HDR"; then bad "nginx version is exposed in Server header"; else ok "server_tokens hidden"; fi
CODE_DOT="$(curl -sk -o /dev/null -w '%{http_code}' --max-time 8 --resolve studentop.cn:443:127.0.0.1 https://studentop.cn:14355/.git/config || true)"
case "$CODE_DOT" in 403|404) ok "dotfiles denied (/.git/config -> $CODE_DOT)";; *) bad "dotfile request returned $CODE_DOT";; esac

echo "-- ACME webroot"
TESTF="$ROOT/acme/.well-known/acme-challenge/verify-$$.txt"
$S mkdir -p "$ROOT/acme/.well-known/acme-challenge"
if $S sh -c "echo verify-$$ > '$TESTF'"; then
  C_ACME="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 -H 'Host: studentop.cn' "http://127.0.0.1/.well-known/acme-challenge/verify-$$.txt" || true)"
  BODY_ACME="$(curl -s --max-time 8 -H 'Host: studentop.cn' "http://127.0.0.1/.well-known/acme-challenge/verify-$$.txt" || true)"
  [ "$C_ACME" = "200" ] && [ "$BODY_ACME" = "verify-$$" ] && ok "ACME challenge path serves plain text" || bad "ACME path returned $C_ACME (body: $BODY_ACME)"
  $S rm -f "$TESTF"
else
  bad "cannot write test file into ACME webroot"
fi

echo "-- frpc tunnel (informational: frp node is an external dependency)"
if [ "$(systemctl is-enabled frpc 2>/dev/null)" = "enabled" ]; then ok "frpc.service enabled"; else bad "frpc.service not enabled"; fi
FRPC_STATE="$(systemctl is-active frpc 2>/dev/null || true)"
info "frpc.service state: $FRPC_STATE (auto-restarts every 30s until the node returns)"
if [ -f /var/log/frpc.log ]; then
  LAST_LOG="$($S tail -3 /var/log/frpc.log 2>/dev/null | tr '\n' ' | ' || true)"
  info "frpc log tail: ${LAST_LOG:-none}"
  if $S grep -q 'login to server success' /var/log/frpc.log 2>/dev/null; then ok "frpc logged in successfully at least once"; fi
  if $S grep -q 'i/o timeout' /var/log/frpc.log 2>/dev/null; then info "frpc node reachability: informational (external dependency)"; fi
else
  bad "/var/log/frpc.log missing"
fi

echo "-- public URL"
PUB="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 https://studentop.cn:14355/ 2>/dev/null || true)"
if [ "$PUB" = "200" ]; then ok "public https://studentop.cn:14355/ -> 200"; else info "public https://studentop.cn:14355/ -> ${PUB:-failed} "; fi

echo "-- disk"
info "root filesystem: $(df -h / | awk 'NR==2{print $4" free of "$2}')"

echo
if [ "$FAIL" -eq 0 ]; then echo "RESULT: PASS (required checks)"; else echo "RESULT: FAIL"; fi
exit "$FAIL"
REMOTE_SCRIPT
RC=$?
set -e
printf '==== verify finished (remote exit %s) ====\n' "$RC"
exit "$RC"