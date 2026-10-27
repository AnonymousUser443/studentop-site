#!/usr/bin/env bash
# ==============================================================================
# preflight-public.sh - one-command public-entry self-check for studentop.cn
#
# Usage (Windows Git Bash, repo root):
#   bash deploy/preflight-public.sh
#
# Run AFTER the user (1) replaced the SakuraFrp node/config and (2) added the
# DNS record. Checks, in order:
#   (a) frpc.service active AND /var/log/frpc.log has a recent "login to server success"
#   (b) TCP from the Pi to the frp node  <server_addr>:<server_port>
#   (c) public DNS for studentop.cn resolves and matches the node IP
#   (d) TLS cert on 127.0.0.1:443 mentions studentop.cn and is NOT self-signed
#   (e) public https://studentop.cn/ returns 200 and the expected <title>
#   (f) 项目「北湖霜降雅集」 https://frost.studentop.cn:14355/ 200 + /api/health ok
#   (g) 项目「理韵寻踪」 https://liyun.studentop.cn:14355/ 200 且入口 JS 可取
#   (h) 项目「原神启动」 https://genshin.studentop.cn:14355/ 200 且入口 JS 可取（开门后跳转理韵寻踪）
#
# Prints one [PASS]/[FAIL] line per check with the reason; failing probes never
# crash the script. Exit code 0 = all passed, 1 = at least one failed.
# ==============================================================================
set -uo pipefail

PI_HOST="${PI_HOST:-pi}"
EXPECT_TITLE="${EXPECT_TITLE:-Aiden 的个人主页}"
PUBLIC_URL="${PUBLIC_URL:-https://studentop.cn:14355/}"

ssh -o ConnectTimeout=10 -o BatchMode=yes "$PI_HOST" "EXPECT_TITLE='$EXPECT_TITLE' PUBLIC_URL='$PUBLIC_URL' FROST_URL='${FROST_URL:-}' LIYUN_URL='${LIYUN_URL:-}' GENSHIN_URL='${GENSHIN_URL:-}' bash -s" <<'REMOTE_SCRIPT'
set -uo pipefail

PASS_N=0
FAIL_N=0
pass() { PASS_N=$((PASS_N+1)); printf '[PASS] %s\n' "$*"; }
fail() { FAIL_N=$((FAIL_N+1)); printf '[FAIL] %s\n' "$*"; }
note() { printf '        -> %s\n' "$*"; }

PUBLIC_URL="${PUBLIC_URL:-https://studentop.cn/}"
CONF=/opt/frpc/frpc.ini
# frpc.ini is 600 root -> read via sudo, fall back to plain grep
conf_get() {
  local key="$1" line
  line="$(sudo -n grep -E "^[[:space:]]*$key[[:space:]]*=" "$CONF" 2>/dev/null | head -1)"
  [ -n "$line" ] || line="$(grep -E "^[[:space:]]*$key[[:space:]]*=" "$CONF" 2>/dev/null | head -1)"
  printf '%s' "$line" | cut -d= -f2- | tr -d '[:space:]'
}
NODE_IP="$(conf_get server_addr)"
NODE_PORT="$(conf_get server_port)"
[ -n "$NODE_IP" ] || NODE_IP='<unreadable>'
[ -n "$NODE_PORT" ] || NODE_PORT=7000
NODE_IP_RESOLVED="$(python3 -c 'import socket,sys
try: print(socket.gethostbyname(sys.argv[1]))
except Exception: pass' "$NODE_IP" 2>/dev/null || true)"

echo "==== studentop.cn public-entry preflight ===="
echo "frpc config : $CONF"
echo "frp node    : $NODE_IP:$NODE_PORT"
echo

# ---------------------------------------------------------------- (a) frpc ----
SVC="$(systemctl is-active frpc 2>/dev/null || true)"
LOG_OK=0
LAST_LINE=''
if sudo -n test -r /var/log/frpc.log 2>/dev/null; then
  if sudo -n tail -300 /var/log/frpc.log 2>/dev/null | grep -q 'login to server success'; then LOG_OK=1; fi
  LAST_LINE="$(sudo -n tail -1 /var/log/frpc.log 2>/dev/null | tr -d '\r' || true)"
fi
if [ "$SVC" = "active" ] && [ "$LOG_OK" = "1" ]; then
  pass "(a) frpc.service active 且日志出现 login success"
else
  fail "(a) frpc 未成功登录节点（is-active=$SVC, login_success_in_log=$LOG_OK）"
  [ -n "$LAST_LINE" ] && note "最后一行日志: $LAST_LINE"
fi

# ---------------------------------------------------------------- (b) TCP -----
TCP_RES="$(python3 -c '
import socket, sys
host, port = sys.argv[1], int(sys.argv[2])
try:
    socket.create_connection((host, port), timeout=6).close()
    print("OK")
except Exception as e:
    print(type(e).__name__ + ": " + str(e))
' "$NODE_IP" "$NODE_PORT" 2>&1 || true)"
if [ "$TCP_RES" = "OK" ]; then
  pass "(b) Pi -> 节点 TCP $NODE_IP:$NODE_PORT 连接成功"
else
  fail "(b) Pi -> 节点 TCP $NODE_IP:$NODE_PORT 失败: $TCP_RES"
fi

# ---------------------------------------------------------------- (c) DNS -----
DNS_JSON="$(curl -s --max-time 10 'https://dns.alidns.com/resolve?name=studentop.cn&type=A' 2>/dev/null || true)"
DNS_RAW="$(printf '%s' "$DNS_JSON" | python3 -c '
import json, sys
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
for a in (d.get("Answer") or []):
    t = a.get("type")
    if t == 5:
        print("CNAME " + a.get("data", ""))
    elif t == 1:
        print(a.get("data", ""))
' 2>/dev/null | tr '\n' ' ' || true)"
DNS_SRC='DoH dns.alidns.com'
if [ -z "$(echo "$DNS_RAW" | tr -d ' ')" ]; then
  DIG_OUT="$(dig +short @223.5.5.5 studentop.cn A 2>/dev/null | tr '\n' ' ' || true)"
  if [ -n "$(echo "$DIG_OUT" | tr -d ' ')" ] && ! echo "$DIG_OUT" | grep -q 'timed out'; then
    DNS_RAW="$DIG_OUT"
    DNS_SRC='dig @223.5.5.5'
  fi
fi
IPS="$(echo "$DNS_RAW" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | sort -u | tr '\n' ' ' || true)"
if [ -n "$(echo "$IPS" | tr -d ' ')" ] && { { [ "$NODE_IP" != "<unreadable>" ] && echo " $IPS " | grep -q " $NODE_IP "; } || { [ -n "$NODE_IP_RESOLVED" ] && echo " $IPS " | grep -q " $NODE_IP_RESOLVED "; }; }; then
  pass "(c) DNS studentop.cn -> $IPS（与节点 IP 一致）  [$DNS_SRC]"
else
  fail "(c) DNS 未正确指向节点 [$DNS_SRC]"
  if [ -n "$(echo "$DNS_RAW" | tr -d ' ')" ]; then
    note "解析结果: $DNS_RAW"
  else
    note "studentop.cn 没有 A/CNAME 记录（需在阿里云 DNS 添加）"
  fi
fi

# ---------------------------------------------------------------- (d) TLS -----
CERT_INFO="$(echo | openssl s_client -connect 127.0.0.1:443 -servername studentop.cn 2>/dev/null | openssl x509 -noout -subject -issuer -ext subjectAltName 2>/dev/null || true)"
CERT_SUBJ="$(echo "$CERT_INFO" | grep -i '^subject=' || true)"
CERT_ISSUER="$(echo "$CERT_INFO" | grep -i '^issuer=' || true)"
CERT_SAN="$(echo "$CERT_INFO" | grep -i 'DNS:' || true)"
SAN_OK=0; echo "$CERT_SAN" | grep -q 'studentop.cn' && SAN_OK=1
SELF_SIGNED=0
[ -n "$CERT_SUBJ" ] && [ "$CERT_SUBJ" = "$(echo "$CERT_ISSUER" | sed 's/^issuer=/subject=/')" ] && SELF_SIGNED=1
if [ -z "$CERT_SUBJ" ]; then
  fail "(d) 无法从 127.0.0.1:443 读取证书"
elif [ "$SAN_OK" = "1" ] && [ "$SELF_SIGNED" = "0" ]; then
  pass "(d) 本地证书含 studentop.cn 且非自签（$CERT_SUBJ | $CERT_ISSUER）"
else
  fail "(d) 本地证书待替换（SAN含studentop.cn=$SAN_OK, 自签=$SELF_SIGNED）"
  note "$CERT_SUBJ"
  note "$CERT_ISSUER"
  note "正式证书方案见 deploy/ACME.md（当前为自签占位）"
fi

# ---------------------------------------------------------------- (e) public --
HTTP_CODE="$(curl -sI -o /dev/null -w '%{http_code}' --max-time 12 "$PUBLIC_URL" 2>/dev/null || true)"
BODY="$(curl -s --max-time 12 "$PUBLIC_URL" 2>/dev/null || true)"
TITLE="$(echo "$BODY" | tr -d '\n' | grep -o '<title>[^<]*</title>' | head -1 || true)"
TITLE_TXT="$(echo "$TITLE" | sed -e 's/<[^>]*>//g' || true)"
if [ "$HTTP_CODE" = "200" ] && [ -n "$TITLE_TXT" ] && echo "$BODY" | grep -qF -- "$EXPECT_TITLE"; then
  pass "(e) 公网 $PUBLIC_URL -> 200，标题: $TITLE_TXT"
else
  fail "(e) 公网访问未通过（$PUBLIC_URL，HTTP=$HTTP_CODE，标题=${TITLE_TXT:-<none>}）"
  note "期望标题包含: $EXPECT_TITLE"
fi

# ------------------------------------------------- (f) 项目：北湖霜降雅集 ----
FROST_URL="${FROST_URL:-https://frost.studentop.cn:14355/}"
FROST_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$FROST_URL" 2>/dev/null || true)"
FROST_HEALTH="$(curl -s --max-time 12 "${FROST_URL%/}/api/health" 2>/dev/null || true)"
FROST_SVC="$(systemctl is-active frost-atlas 2>/dev/null || true)"
if [ "$FROST_CODE" = "200" ] && echo "$FROST_HEALTH" | grep -q '"ok":true' && [ "$FROST_SVC" = "active" ]; then
  pass "(f) $FROST_URL -> 200 且 /api/health ok（frost-atlas.service $FROST_SVC）"
else
  fail "(f) 北湖霜降雅集未通过（HTTP=$FROST_CODE, systemd=$FROST_SVC）"
  note "health: ${FROST_HEALTH:-<none>}"
  note "排查: systemctl status frost-atlas / journalctl -u frost-atlas -n 50"
fi

# ---------------------------------------------------- (g) 项目：理韵寻踪 ----
LIYUN_URL="${LIYUN_URL:-https://liyun.studentop.cn:14355/}"
LIYUN_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$LIYUN_URL" 2>/dev/null || true)"
LIYUN_BODY="$(curl -s --max-time 12 "$LIYUN_URL" 2>/dev/null || true)"
LIYUN_ASSET="$(echo "$LIYUN_BODY" | tr -d '\n' | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | head -1 || true)"
LIYUN_ASSET_CODE=''
[ -n "$LIYUN_ASSET" ] && LIYUN_ASSET_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${LIYUN_URL%/}${LIYUN_ASSET}" 2>/dev/null || true)"
if [ "$LIYUN_CODE" = "200" ] && [ "$LIYUN_ASSET_CODE" = "200" ]; then
  pass "(g) $LIYUN_URL -> 200，入口 JS 可取（$LIYUN_ASSET）"
else
  fail "(g) 理韵寻踪未通过（HTTP=$LIYUN_CODE, asset=$LIYUN_ASSET -> ${LIYUN_ASSET_CODE:-<none>}）"
  note "排查: readlink -f /opt/projects/liyun/current / nginx -t / 日志 projects-liyun.error.log"
fi

# ------------------------------------------------ (h) 项目：原神启动 ----
GENSHIN_URL="${GENSHIN_URL:-https://genshin.studentop.cn:14355/}"
GENSHIN_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 12 "$GENSHIN_URL" 2>/dev/null || true)"
GENSHIN_BODY="$(curl -s --max-time 12 "$GENSHIN_URL" 2>/dev/null || true)"
GENSHIN_ASSET="$(echo "$GENSHIN_BODY" | tr -d '\n' | grep -o '/assets/index-[A-Za-z0-9_-]*\.js' | head -1 || true)"
GENSHIN_ASSET_CODE=''
[ -n "$GENSHIN_ASSET" ] && GENSHIN_ASSET_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "${GENSHIN_URL%/}${GENSHIN_ASSET}" 2>/dev/null || true)"
if [ "$GENSHIN_CODE" = "200" ] && [ "$GENSHIN_ASSET_CODE" = "200" ]; then
  pass "(h) $GENSHIN_URL -> 200，入口 JS 可取（$GENSHIN_ASSET）"
else
  fail "(h) 原神启动未通过（HTTP=$GENSHIN_CODE, asset=$GENSHIN_ASSET -> ${GENSHIN_ASSET_CODE:-<none>}）"
  note "排查: readlink -f /opt/projects/genshin/current / 日志 projects-genshin.error.log"
fi

echo
printf 'SUMMARY: %d PASS / %d FAIL\n' "$PASS_N" "$FAIL_N"
if [ "$FAIL_N" -eq 0 ]; then
  echo "RESULT: PASS - 公网入口已打通（主站 + 三个项目），可以交付"
  exit 0
fi
echo "RESULT: FAIL - 按 deploy/SAKURA.md 的步骤修复后重新运行本脚本"
exit 1
REMOTE_SCRIPT
