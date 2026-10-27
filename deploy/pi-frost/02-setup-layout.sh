#!/usr/bin/env bash
# Prepare frost-atlas layout: system user, releases dir, unpack, current symlink, private data dir.
set -euo pipefail

REL=/opt/projects/frost/releases/v4.0.8
PKG=/tmp/frost-v4.0.8.zip

echo "== system user frost =="
if ! getent group frost >/dev/null; then sudo -n groupadd --system frost; fi
if ! id frost >/dev/null 2>&1; then
  sudo -n useradd --system --gid frost --home-dir /var/lib/frost-atlas --no-create-home --shell /usr/sbin/nologin frost
fi
id frost
getent passwd frost

echo "== releases dir =="
sudo -n install -d -o root -g root -m 0755 /opt/projects/frost
sudo -n install -d -o root -g root -m 0755 /opt/projects/frost/releases
sudo -n install -d -o root -g root -m 0755 "$REL"

echo "== unpack =="
sudo -n unzip -q -o "$PKG" -d "$REL"
sudo -n chown -R root:root /opt/projects/frost
sudo -n chmod -R go-w /opt/projects/frost
sudo -n chmod -R a+rX "$REL"

echo "== current symlink =="
sudo -n ln -sfn "$REL" /opt/projects/frost/current
readlink -f /opt/projects/frost/current

echo "== private data dir =="
sudo -n install -d -o root -g frost -m 0750 /var/lib/frost-atlas
sudo -n install -d -o frost -g frost -m 0700 /var/lib/frost-atlas/data

echo "== layout =="
ls -ld /opt/projects/frost /opt/projects/frost/releases /opt/projects/frost/releases/v4.0.8 /opt/projects/frost/current /var/lib/frost-atlas /var/lib/frost-atlas/data
echo "files: $(find "$REL" -type f | wc -l), size: $(du -sh "$REL" | cut -f1)"
echo "root files: $(find "$REL" ! -user root | wc -l) (expect 0)"

echo "== key files =="
ls -l "$REL/servers/" | head -20
ls -l "$REL/apps/map/resource-manifest.json" "$REL/package.json" "$REL/deployment-manifest.json"
echo "-- package.json version --"
grep -E '"version"|"name"|"type"' "$REL/package.json" | head -5
