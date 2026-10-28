#!/usr/bin/env bash
# Run only through an explicitly authorized owner release, with a private 0700 upload directory.
set -Eeuo pipefail
STAGE="${1:?private upload directory}"; EXPECTED_SHA="${2:?archive checksum}"
[[ "$STAGE" =~ ^/var/tmp/aiden-upload-[0-9A-Za-z-]+$ ]] || { echo 'Unsafe upload directory' >&2; exit 1; }
[[ "$EXPECTED_SHA" =~ ^[a-f0-9]{64}$ ]] || exit 1
[ -d "$STAGE" ] && [ ! -L "$STAGE" ] && [ "$(stat -c %a "$STAGE")" = 700 ] || exit 1
exec 9>/run/lock/aiden-desktop-release.lock
flock -n 9 || { echo 'Another desktop release is active' >&2; exit 1; }
printf '%s  %s\n' "$EXPECTED_SHA" "$STAGE/bundle.tar.gz" | sha256sum -c - >/dev/null
WORK="$STAGE/unpacked"; mkdir -m 700 "$WORK"
tar -xzf "$STAGE/bundle.tar.gz" --no-same-owner -C "$WORK"
NODE=/opt/node24/bin/node
"$NODE" - "$WORK" <<'VERIFY'
const fs=require('fs'),path=require('path'),crypto=require('crypto');const root=process.argv[2],m=JSON.parse(fs.readFileSync(path.join(root,'release.json'),'utf8'));if(m.format!==1||!/^\d{8}T\d{6}Z-[a-f0-9]{10}$/.test(m.id)||!/^([a-f0-9]{40})$/.test(m.commit)||!Array.isArray(m.files))throw Error('Bad manifest');const expected=new Set(['release.json']);for(const e of m.files){if(!/^(home|voxel|campus|auth|nginx|systemd|checks)\//.test(e.path)||e.path.split('/').some(x=>!x||x==='..'||x==='.'||x.startsWith('.')||/[\\:\x00-\x1f]/.test(x))||expected.has(e.path))throw Error('Bad path');expected.add(e.path);const p=path.join(root,e.path),s=fs.lstatSync(p),b=fs.readFileSync(p);if(!s.isFile()||s.isSymbolicLink()||b.length!==e.bytes||crypto.createHash('sha256').update(b).digest('hex')!==e.sha256)throw Error('Checksum failed');}function walk(dir,prefix=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const n=prefix+e.name;if(e.isSymbolicLink())throw Error('Symlink');if(e.isDirectory())walk(path.join(dir,e.name),n+'/');else if(!expected.has(n))throw Error('Unexpected file');}}walk(root);if(JSON.parse(fs.readFileSync(path.join(root,'home/version.json'),'utf8')).id!==m.nativeVersion)throw Error('Version mismatch');console.log(JSON.stringify({verified:true,id:m.id,commit:m.commit,files:m.files.length,nativeVersion:m.nativeVersion}));
VERIFY
ID="$("$NODE" -p "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).id" "$WORK/release.json")"
VERSION="$("$NODE" -p "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).nativeVersion" "$WORK/release.json")"
BACKUP="/var/lib/aiden-release-history/$ID"; install -d -m 700 "$BACKUP"
ROOTS=(/opt/win11-home /opt/projects/voxel-campus /opt/projects/campus-entry /opt/projects/desktop-auth)
NAMES=(home voxel campus auth)
for i in 0 1 2 3; do
 current="${ROOTS[$i]}/current"
 if [ -e "$current" ] && [ ! -L "$current" ]; then echo "Refusing non-symlink current: $current" >&2; exit 1; fi
 if [ -L "$current" ] && [ -d "$current" ]; then readlink -f "$current" > "$BACKUP/${NAMES[$i]}.previous"; else : > "$BACKUP/${NAMES[$i]}.previous"; fi
done
for file in win11-home-app.conf win11-home-headers.conf win11-home-projects.conf; do if [ -f "/etc/nginx/snippets/$file" ]; then cp -p "/etc/nginx/snippets/$file" "$BACKUP/$file"; fi; done
if [ -f /etc/systemd/system/desktop-auth.service ]; then cp -p /etc/systemd/system/desktop-auth.service "$BACKUP/desktop-auth.service"; fi
systemctl is-active desktop-auth > "$BACKUP/auth.was-active" || true
COMMITTED=0
switch_link() { local root="$1" dest="$2"; case "$root" in /opt/win11-home|/opt/projects/voxel-campus|/opt/projects/campus-entry|/opt/projects/desktop-auth) ;; *) return 1;; esac; ln -s "$dest" "$root/.current-$ID"; mv -Tf "$root/.current-$ID" "$root/current"; }
rollback() {
 local rc=$?; trap - ERR INT TERM
 if [ "$COMMITTED" = 0 ]; then
  echo 'Release failed; restoring prior pointers/configuration.' >&2
  for i in 0 1 2 3; do
   local root="${ROOTS[$i]}" previous; previous="$(cat "$BACKUP/${NAMES[$i]}.previous")"
   if [ -n "$previous" ] && [ -d "$previous" ]; then ln -sfn "$previous" "$root/.rollback-$ID"; mv -Tf "$root/.rollback-$ID" "$root/current"; elif [ -L "$root/current" ]; then rm -f "$root/current"; fi
  done
  for file in win11-home-app.conf win11-home-headers.conf win11-home-projects.conf; do if [ -f "$BACKUP/$file" ]; then cp -p "$BACKUP/$file" "/etc/nginx/snippets/$file"; elif [ "$file" = win11-home-projects.conf ]; then rm -f "/etc/nginx/snippets/$file"; fi; done
  if [ -f "$BACKUP/desktop-auth.service" ]; then cp -p "$BACKUP/desktop-auth.service" /etc/systemd/system/desktop-auth.service; systemctl daemon-reload; if grep -qx active "$BACKUP/auth.was-active"; then systemctl restart desktop-auth || true; else systemctl stop desktop-auth || true; fi
  else systemctl disable --now desktop-auth >/dev/null 2>&1 || true; rm -f /etc/systemd/system/desktop-auth.service; systemctl daemon-reload; fi
  nginx -t && systemctl reload nginx || true
 fi
 exit "$rc"
}
trap rollback ERR INT TERM
for i in 0 1 2 3; do
 root="${ROOTS[$i]}"; rel="$root/releases/$ID"; [ ! -e "$rel" ]; install -d -m 755 "$rel"; cp -a "$WORK/${NAMES[$i]}/." "$rel/"; chown -R root:root "$rel"; chmod -R u=rwX,go=rX "$rel"
done
# Immutable Vite URLs remain available after switching current; no older files are overwritten.
"$NODE" - "$WORK" <<'ASSETS'
const fs=require('fs'),path=require('path'),crypto=require('crypto'),work=process.argv[2],m=JSON.parse(fs.readFileSync(path.join(work,'release.json'),'utf8'));
const shared='/opt/win11-home/shared/assets/releases';fs.mkdirSync(shared,{recursive:true,mode:0o755});
const previous=fs.existsSync('/opt/win11-home/current')?fs.realpathSync('/opt/win11-home/current'):null;
function keep(src,dest){const b=fs.readFileSync(src);fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o755});if(fs.existsSync(dest)){if(fs.lstatSync(dest).isSymbolicLink()||!fs.readFileSync(dest).equals(b))throw Error('Existing namespace bytes differ');}else fs.writeFileSync(dest,b,{flag:'wx',mode:0o644});}
function importOld(src,dest){for(const e of fs.readdirSync(src,{withFileTypes:true})){if(e.isSymbolicLink()||e.name==='..'||e.name.startsWith('.'))throw Error('Unexpected previous namespace link/file');const a=path.join(src,e.name),b=path.join(dest,e.name);if(e.isDirectory())importOld(a,b);else if(e.isFile())keep(a,b);else throw Error('Unsupported previous asset');}}
if(previous){if(!previous.startsWith('/opt/win11-home/releases/'))throw Error('Unexpected previous home root');const old=path.join(previous,'assets/releases');if(fs.existsSync(old))for(const e of fs.readdirSync(old,{withFileTypes:true})){if(!/^[a-f0-9]{24}$/.test(e.name))throw Error('Unexpected previous release id');const src=path.join(old,e.name),dest=path.join(shared,e.name);if(e.isSymbolicLink()){if(fs.realpathSync(src)!==dest)throw Error('Untrusted previous namespace link');}else if(e.isDirectory())importOld(src,dest);else throw Error('Bad previous namespace');}}
for(const e of m.files.filter(e=>e.path.startsWith('home/assets/releases/'))){const src=path.join(work,e.path),dest=path.join('/opt/win11-home/shared',e.path.slice(5));fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o755});if(fs.existsSync(dest)){if(fs.lstatSync(dest).isSymbolicLink()||crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')!==e.sha256)throw Error('Existing native namespace differs');}else fs.copyFileSync(src,dest,fs.constants.COPYFILE_EXCL);fs.chmodSync(dest,0o644);}
// Additive compatibility bridge: first-migration rollback keeps newly issued URLs readable.
if(previous){const old=path.join(previous,'assets/releases');fs.mkdirSync(old,{recursive:true,mode:0o755});for(const id of fs.readdirSync(shared)){if(!/^[a-f0-9]{24}$/.test(id))throw Error('Bad shared id');const dest=path.join(old,id);if(!fs.existsSync(dest))fs.symlinkSync(path.join(shared,id),dest,'dir');}}
for(const [name,root] of [['voxel','/opt/projects/voxel-campus'],['campus','/opt/projects/campus-entry']]){fs.mkdirSync(root+'/shared-assets',{recursive:true,mode:0o755});for(const e of m.files.filter(e=>e.path.startsWith(name+'/assets/'))){const rel=e.path.slice((name+'/assets/').length);if(!/^[A-Za-z0-9_.-]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(rel))throw Error('Expected fingerprinted Vite asset');const src=path.join(work,e.path),dest=path.join(root,'shared-assets',rel);if(fs.existsSync(dest)){if(fs.lstatSync(dest).isSymbolicLink()||crypto.createHash('sha256').update(fs.readFileSync(dest)).digest('hex')!==e.sha256)throw Error('Existing immutable asset differs');}else fs.copyFileSync(src,dest,fs.constants.COPYFILE_EXCL);fs.chmodSync(dest,0o644);}}
ASSETS
getent group desktop-auth >/dev/null || groupadd --system desktop-auth
id desktop-auth >/dev/null 2>&1 || useradd --system --gid desktop-auth --no-create-home --shell /usr/sbin/nologin desktop-auth
install -d -m 700 -o desktop-auth -g desktop-auth /var/lib/desktop-auth/data
if [ ! -f /var/lib/desktop-auth/data/auth.json ]; then install -m 600 -o desktop-auth -g desktop-auth "$STAGE/auth-private.json" /var/lib/desktop-auth/data/auth.json; fi
chown desktop-auth:desktop-auth /var/lib/desktop-auth/data/auth.json; chmod 600 /var/lib/desktop-auth/data/auth.json
runuser -u desktop-auth -- "$NODE" -e 'const fs=require("fs"),p=process.argv[1];fs.writeFileSync(p,"writable",{flag:"wx",mode:0o600});fs.renameSync(p,p+".renamed");fs.unlinkSync(p+".renamed");' "/var/lib/desktop-auth/data/.write-probe-$ID"
switch_link /opt/projects/desktop-auth "/opt/projects/desktop-auth/releases/$ID"
install -m 644 "$WORK/systemd/desktop-auth.service" /etc/systemd/system/desktop-auth.service
systemctl daemon-reload; systemctl enable desktop-auth >/dev/null; systemctl restart desktop-auth
for i in $(seq 1 25); do if curl -fsS -H 'Host: studentop.cn:14355' -H 'X-Real-IP: 127.0.0.1' http://127.0.0.1:8900/__desktop/auth | "$NODE" -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{if(JSON.parse(s).configured!==true)process.exitCode=1;}catch{process.exitCode=1;}});'; then break; fi; [ "$i" != 25 ]; sleep .2; done
switch_link /opt/projects/voxel-campus "/opt/projects/voxel-campus/releases/$ID"
switch_link /opt/projects/campus-entry "/opt/projects/campus-entry/releases/$ID"
for file in win11-home-app.conf win11-home-headers.conf win11-home-projects.conf; do install -m 644 "$WORK/nginx/$file" "/etc/nginx/snippets/$file"; done
nginx -t; systemctl reload nginx
# New same-origin auth and both apps must succeed while the old home is still current.
"$NODE" "$WORK/checks/check-live.mjs" "$VERSION" before-home
switch_link /opt/win11-home "/opt/win11-home/releases/$ID"
"$NODE" "$WORK/checks/check-live.mjs" "$VERSION" after-home
COMMITTED=1; trap - ERR INT TERM
"$NODE" - "$WORK/release.json" "$BACKUP" <<'RECEIPT'
const fs=require('fs'),path=require('path'),m=JSON.parse(fs.readFileSync(process.argv[2],'utf8')),dir=process.argv[3],previous={};for(const n of ['home','voxel','campus','auth'])previous[n]=fs.readFileSync(path.join(dir,n+'.previous'),'utf8').trim()||null;const result={ok:true,id:m.id,commit:m.commit,nativeVersion:m.nativeVersion,files:m.files.length,previous,backup:dir,completedAt:new Date().toISOString()};fs.writeFileSync(path.join(dir,'receipt.json'),JSON.stringify(result,null,2)+'\n',{mode:0o600});console.log(JSON.stringify(result));
RECEIPT
# Only this validated private upload file is removed; stable auth/rate state is never deleted.
rm -f "$STAGE/auth-private.json"
