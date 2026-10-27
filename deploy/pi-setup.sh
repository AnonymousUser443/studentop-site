#!/usr/bin/env bash
# ==============================================================================
# pi-setup.sh - idempotent bootstrap for win11-home on the Raspberry Pi
# Run from Windows Git Bash:  ssh pi 'bash -s' < deploy/pi-setup.sh
# Requires: passwordless sudo (sudo -n), Debian 13 (trixie) aarch64
# Does NOT touch: sshd, rpi-task-manager (127.0.0.1:8765), other nginx sites
# Does NOT overwrite: /opt/frpc/frpc.ini (the user-supplied frpc config)
# ==============================================================================
set -euo pipefail

HOME_DIR=/opt/win11-home
CERTS=/opt/win11-home/certs
ACME=/opt/win11-home/acme
RELEASES=/opt/win11-home/releases
NGX_SNIPPETS=/etc/nginx/snippets
NGX_SITE=/etc/nginx/sites-available/win11-home
FRPC_DIR=/opt/frpc
FRPC_BIN=$FRPC_DIR/frpc
FRPC_CONF=$FRPC_DIR/frpc.ini
FRPC_VER=0.49.0
FRPC_UNIT=/etc/systemd/system/frpc.service

log() { printf '\n== %s ==\n' "$*"; }

log "1/8 packages"
if ! command -v nginx >/dev/null 2>&1 && [ ! -x /usr/sbin/nginx ]; then
  sudo -n apt-get update -qq
  sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
fi
NGINX_BIN=$(command -v nginx || echo /usr/sbin/nginx)
"$NGINX_BIN" -v

log "2/8 directories"
sudo -n mkdir -p "$RELEASES" "$CERTS" "$ACME/.well-known/acme-challenge" "$FRPC_DIR"
sudo -n chmod 755 "$HOME_DIR" "$RELEASES" "$ACME" "$CERTS"

log "3/8 stub release (only if no current)"
if [ ! -e "$HOME_DIR/current" ]; then
  TS=$(date -u +%Y%m%dT%H%M%SZ)
  sudo -n mkdir -p "$RELEASES/$TS"
  sudo -n tee "$RELEASES/$TS/index.html" >/dev/null <<'STUBEOF'
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>studentop.cn - 部署占位页</title>
<style>
  html,body{height:100%;margin:0;font-family:"Segoe UI","Microsoft YaHei",sans-serif;
    background:linear-gradient(135deg,#0a1a3a 0%,#123a6b 45%,#1e5fa0 100%);color:#fff}
  .wrap{height:100%;display:flex;align-items:center;justify-content:center}
  .card{background:rgba(255,255,255,.10);backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.22);
    border-radius:14px;padding:38px 46px;max-width:560px;box-shadow:0 18px 50px rgba(0,0,0,.35)}
  .dot{width:11px;height:11px;border-radius:50%;background:#4cc2ff;display:inline-block;margin-right:9px}
  h1{font-weight:300;letter-spacing:.5px;margin:0 0 10px;font-size:28px}
  p{margin:8px 0;color:#d6e6ff;line-height:1.7;font-size:14px}
  code{background:rgba(0,0,0,.28);padding:2px 7px;border-radius:6px;font-size:13px}
  .foot{margin-top:22px;font-size:12px;color:#9fc0e8}
</style>
</head>
<body>
<div class="wrap"><div class="card">
  <h1><span class="dot"></span>Windows 11 风格个人主页</h1>
  <p>树莓派已就绪：nginx 反向代理 + 发布目录 + 自签 HTTPS 均已配置完成。</p>
  <p>当前为 <b>部署占位页</b>，前端构建产物发布后会自动替换。</p>
  <p>发布命令（Windows 侧）：<code>bash deploy/deploy-site.sh</code></p>
  <div class="foot">studentop.cn &middot; served from Raspberry Pi 4B &middot; placeholder build</div>
</div></div>
</body>
</html>
STUBEOF
  sudo -n ln -sfn "$RELEASES/$TS" "$HOME_DIR/current"
  echo "created stub release $TS"
else
  echo "current already exists -> $(readlink -f "$HOME_DIR/current")"
fi

log "4/8 self-signed TLS cert (placeholder; CN/SAN=studentop.cn)"
if [ ! -s "$CERTS/studentop.cn.crt" ] || [ ! -s "$CERTS/studentop.cn.key" ]; then
  sudo -n openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout "$CERTS/studentop.cn.key" -out "$CERTS/studentop.cn.crt" \
    -subj "/O=win11-home/CN=studentop.cn" \
    -addext "subjectAltName=DNS:studentop.cn,DNS:www.studentop.cn,IP:127.0.0.1" >/dev/null 2>&1
  sudo -n chmod 600 "$CERTS/studentop.cn.key"
  sudo -n chmod 644 "$CERTS/studentop.cn.crt"
fi
openssl x509 -in "$CERTS/studentop.cn.crt" -noout -subject -ext subjectAltName -enddate 2>/dev/null || true

log "5/8 nginx snippets + site config"
sudo -n mkdir -p "$NGX_SNIPPETS"
sudo -n tee "$NGX_SNIPPETS/win11-home-headers.conf" >/dev/null <<'HDREOF'
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
add_header X-XSS-Protection "1; mode=block" always;
# HSTS 暂不启用：当前为自签证书阶段，启用后浏览器会强制 HTTPS 一年
# add_header Strict-Transport-Security "max-age=31536000" always;
HDREOF

sudo -n tee "$NGX_SNIPPETS/win11-home-app.conf" >/dev/null <<'APPEOF'
# --- shared app settings: win11-home static site served from current release ---
root /opt/win11-home/current;
index index.html;
autoindex off;
charset utf-8;

gzip on;
gzip_vary on;
gzip_comp_level 5;
gzip_min_length 1024;
gzip_proxied any;
gzip_types text/plain text/css text/xml application/json application/javascript
           application/xml+rss image/svg+xml application/manifest+json application/wasm;

# ACME webroot placeholder for future certbot / real certificates
location ^~ /.well-known/acme-challenge/ {
    root /opt/win11-home/acme;
    default_type "text/plain";
    try_files $uri =404;
}

# long-cache static assets (hashed filenames are expected from the frontend build)
location ~* \.(?:css|js|mjs|json|map|jpg|jpeg|png|gif|webp|avif|svg|ico|bmp|woff|woff2|ttf|otf|eot|mp4|webm|ogg|mp3)$ {
    try_files $uri =404;
    expires 7d;
    access_log off;
}

# index.html must never be cached (release switch must be visible immediately)
location = /index.html {
    expires -1;
}

# SPA-style fallback
location / {
    try_files $uri $uri/ /index.html;
}

# do not serve dotfiles (.git, .env, ...); /.well-known/ is handled above and unaffected
location ~ /\.(?!well-known/) {
    deny all;
}
APPEOF

sudo -n tee "$NGX_SITE" >/dev/null <<'SITEEOF'
# =============================================================================
# win11-home - Windows 11 style personal homepage (studentop.cn)
# Deliberately bound to LOOPBACK ONLY (127.0.0.1): the public path is
#   Internet -> SakuraFrp node -> frpc -> 127.0.0.1:443 (this nginx)
# 127.0.0.1:80 exists for ACME webroot and local HTTP checks.
# =============================================================================

server {
    listen 127.0.0.1:80;
    server_name studentop.cn www.studentop.cn;

    access_log /var/log/nginx/win11-home.access.log;
    error_log  /var/log/nginx/win11-home.error.log warn;

    include /etc/nginx/snippets/win11-home-app.conf;
    include /etc/nginx/snippets/win11-home-headers.conf;
}

server {
    listen 127.0.0.1:443 ssl;
    http2 on;
    server_name studentop.cn www.studentop.cn;

    access_log /var/log/nginx/win11-home.access.log;
    error_log  /var/log/nginx/win11-home.error.log warn;

    ssl_certificate     /opt/win11-home/certs/studentop.cn.crt;
    ssl_certificate_key /opt/win11-home/certs/studentop.cn.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    include /etc/nginx/snippets/win11-home-app.conf;
    include /etc/nginx/snippets/win11-home-headers.conf;
}
SITEEOF

# enable our site, disable only the stock default site (keeps port 80/443 off 0.0.0.0)
sudo -n ln -sfn "$NGX_SITE" /etc/nginx/sites-enabled/win11-home
if [ -L /etc/nginx/sites-enabled/default ]; then
  sudo -n rm -f /etc/nginx/sites-enabled/default
  echo "disabled stock /etc/nginx/sites-enabled/default (loopback-only policy)"
fi

sudo -n "$NGINX_BIN" -t
sudo -n systemctl enable nginx >/dev/null 2>&1 || true
# NOTE: right after "apt install nginx" the running master may still hold an
# inherited 0.0.0.0:80 socket, and a reload then fails to bind 127.0.0.1:80
# while systemd still exits 0. A restart is the reliable way to apply a new
# listen set; verify the loopback listeners afterwards.
sudo -n systemctl restart nginx
sleep 1
if ! sudo -n ss -ltn 2>/dev/null | grep -q "127.0.0.1:443"; then
  echo "ERROR: nginx did not bind 127.0.0.1:443 (check /var/log/nginx/error.log)" >&2
  exit 1
fi

log "6/8 frpc binary ($FRPC_VER)"
if [ ! -x "$FRPC_BIN" ]; then
  TMP=$(mktemp -d)
  if [ -f /tmp/frp_${FRPC_VER}_linux_arm64.tar.gz ]; then
    cp /tmp/frp_${FRPC_VER}_linux_arm64.tar.gz "$TMP/frp.tar.gz"
  else
    curl -fsSL --max-time 120 -o "$TMP/frp.tar.gz" \
      "https://github.com/fatedier/frp/releases/download/v${FRPC_VER}/frp_${FRPC_VER}_linux_arm64.tar.gz"
  fi
  tar -xzf "$TMP/frp.tar.gz" -C "$TMP"
  sudo -n install -m 0755 "$TMP/frp_${FRPC_VER}_linux_arm64/frpc" "$FRPC_BIN"
  rm -rf "$TMP"
fi
"$FRPC_BIN" -v

log "7/8 frpc config check + systemd unit"
if [ ! -s "$FRPC_CONF" ]; then
  echo "ERROR: $FRPC_CONF is missing." >&2
  echo "       It must be created from the user-supplied frpc config (not overwritten by this script)." >&2
  exit 1
fi
sudo -n chmod 600 "$FRPC_CONF"

sudo -n tee "$FRPC_UNIT" >/dev/null <<'UNITEOF'
[Unit]
Description=SakuraFrp frpc client - win11-home tunnel (studentop.cn)
Documentation=https://doc.natfrp.com/
After=network-online.target nginx.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/opt/frpc/frpc -c /opt/frpc/frpc.ini
Restart=always
RestartSec=30
LimitNOFILE=1048576
# frpc writes its own log to /var/log/frpc.log (log_file in frpc.ini)

[Install]
WantedBy=multi-user.target
UNITEOF

sudo -n systemctl daemon-reload
sudo -n systemctl enable frpc >/dev/null 2>&1 || true
sudo -n systemctl restart frpc || true

log "8/9 acme.sh (installed only, NO certificate is issued)"
ACME_DIR=/opt/acme.sh
if [ ! -x "$ACME_DIR/acme.sh" ]; then
  sudo -n mkdir -p "$ACME_DIR"
  TMP=$(mktemp -d)
  if curl -fsSL --max-time 180 -o "$TMP/acme.tar.gz" \
      https://github.com/acmesh-official/acme.sh/archive/refs/heads/master.tar.gz; then
    tar -xzf "$TMP/acme.tar.gz" -C "$TMP"
    sudo -n cp -a "$TMP/acme.sh-master/." "$ACME_DIR/"
  else
    echo "ERROR: could not download acme.sh" >&2
    exit 1
  fi
  sudo -n chmod +x "$ACME_DIR/acme.sh"
  sudo -n mkdir -p "$ACME_DIR/config" "$ACME_DIR/certs"
  rm -rf "$TMP"
fi
# NOTE: always pass --home/--config-home/--cert-home so nothing lands in ~/.acme.sh
sudo -n "$ACME_DIR/acme.sh" --home "$ACME_DIR" --config-home "$ACME_DIR/config" \
  --cert-home "$ACME_DIR/certs" --version 2>&1 | tail -2 || true

log "9/9 status"
sleep 2
sudo -n systemctl --no-pager --lines=8 status frpc 2>&1 | head -20 || true
echo
ss -ltnp 2>/dev/null | grep -E ':(80|443|8765|22)\b' || true
echo
echo "current -> $(readlink -f "$HOME_DIR/current")"
echo "DONE pi-setup"
