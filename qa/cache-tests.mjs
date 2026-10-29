/** Offline fixtures only: never writes dist-site, runs deployment, or opens sockets. */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,existsSync,symlinkSync,utimesSync,realpathSync } from 'node:fs';
import { siteRevision,buildSite,verifySiteBuild,releaseAssetURL } from '../tools/site-release.mjs';
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function write(file,content){mkdirSync(path.dirname(file),{recursive:true});writeFileSync(file,content);}
function fixture(base){
 const src=path.join(base,'source');
 write(path.join(src,'index.html'),'<!doctype html><html><head><link rel="canonical" href="https://site.invalid/"><meta property="og:image" content="https://site.invalid/assets/img/photo.svg"><link rel="stylesheet" href="assets/css/main.css"><link rel="icon" href="assets/img/photo.svg"></head><body><img src="assets/img/photo.svg"><img srcset="assets/img/photo.svg 1x, /assets/img/photo.svg 2x"><script src="assets/js/main.js"></script></body></html>');
 write(path.join(src,'projects/index.html'),'<html><head><link rel="stylesheet" href="../assets/css/main.css"></head><body><script src="../assets/js/main.js"></script></body></html>');
 write(path.join(src,'assets/js/main.js'),'window.PICTURE="assets/img/photo.svg";window.EXTERNAL="https://other.invalid/assets/img/photo.svg";window.DATA="data:image/svg+xml,test";');
 write(path.join(src,'assets/css/main.css'),'@font-face{src:url("../fonts/font.woff2")} .photo{background:url("../img/photo.svg")} .absolute{background:url(/assets/img/photo.svg)}');
 write(path.join(src,'assets/img/photo.svg'),'<svg xmlns="http://www.w3.org/2000/svg"><text>synthetic one</text></svg>');
 write(path.join(src,'assets/fonts/font.woff2'),Buffer.from([0,1,2,3]));
 write(path.join(src,'README.md'),'synthetic readme');write(path.join(src,'auth.json'),'SYNTHETIC-NOT-A-REAL-AUTH-CONFIG');return src;
}
function files(root,dir=''){let out=[];for(const entry of readdirSync(path.join(root,dir),{withFileTypes:true})){const name=dir?dir+'/'+entry.name:entry.name;if(entry.isDirectory())out=out.concat(files(root,name));else out.push(name);}return out.sort();}
function digestTree(root){return files(root).map(name=>[name,createHash('sha256').update(readFileSync(path.join(root,name))).digest('hex')]);}
function temporary(fn){const base=realpathSync(os.tmpdir());const dir=mkdtempSync(path.join(base,'site-cache-test-'));try{return fn(dir);}finally{assert.equal(path.dirname(realpathSync(dir)),base);assert.ok(path.basename(dir).startsWith('site-cache-test-'));rmSync(dir,{recursive:true,force:true});}}
test('identical content builds byte-identically regardless of output path and mtime',()=>temporary(base=>{
 const src=fixture(base),before=digestTree(src),id=siteRevision(src);assert.match(id,/^[a-f0-9]{24}$/);
 const a=buildSite(src,path.join(base,'out-a')),b=buildSite(src,path.join(base,'out-b'));assert.equal(a.id,id);assert.equal(b.id,id);assert.deepEqual(digestTree(a.outDir),digestTree(b.outDir));
 utimesSync(path.join(src,'assets/js/main.js'),new Date(0),new Date(0));assert.equal(siteRevision(src),id);assert.deepEqual(digestTree(src),before);
 assert.equal(existsSync(path.join(a.outDir,'auth.json')),false);assert.equal(existsSync(path.join(a.outDir,'README.md')),false);buildSite(src,a.outDir);assert.deepEqual(digestTree(a.outDir),digestTree(b.outDir));
}));
test('changed media changes id and HTML/JS URLs while retaining the previous namespace',()=>temporary(base=>{
 const src=fixture(base),out=path.join(base,'out');const first=buildSite(src,out);const oldURL='/assets/releases/'+first.id+'/img/photo.svg';const old=readFileSync(path.join(out,oldURL.slice(1)));
 write(path.join(src,'assets/img/photo.svg'),old.toString().replace('one','two'));const second=buildSite(src,out);assert.notEqual(first.id,second.id);assert.deepEqual(verifySiteBuild(out).releases,[second.id,first.id]);assert.deepEqual(readFileSync(path.join(out,oldURL.slice(1))),old);assert.ok(existsSync(path.join(out,'assets/img/photo.svg')));assert.ok(readFileSync(path.join(out,'index.html'),'utf8').includes('https://site.invalid/assets/releases/'+second.id+'/img/photo.svg'));
 for(const name of ['index.html','projects/index.html']){const html=readFileSync(path.join(out,name),'utf8');assert.ok(html.includes('<meta name="site-version" content="'+second.id+'">'));assert.ok(html.includes('/assets/releases/'+second.id+'/'));assert.ok(!html.includes('/assets/releases/'+first.id+'/'));}
 const js=readFileSync(path.join(out,'assets/releases/'+second.id+'/js/main.js'),'utf8');assert.ok(js.includes('"/assets/releases/'+second.id+'/img/photo.svg"'));assert.ok(js.includes('https://other.invalid/assets/img/photo.svg'));assert.ok(js.includes('data:image/svg+xml,test'));
 const cssURL='https://site.invalid/assets/releases/'+second.id+'/css/main.css';assert.equal(new URL('../img/photo.svg',cssURL).pathname,'/assets/releases/'+second.id+'/img/photo.svg');const css=readFileSync(path.join(out,'assets/releases/'+second.id+'/css/main.css'),'utf8');assert.ok(css.includes('../fonts/font.woff2'));assert.ok(css.includes('url(/assets/releases/'+second.id+'/img/photo.svg)'));
}));
test('URL rewriting preserves query and fragment but never changes remote or API URLs',()=>{
 const id='a'.repeat(24);assert.equal(releaseAssetURL('../assets/img/a.svg?v=2#x',id),'/assets/releases/'+id+'/img/a.svg?v=2#x');for(const value of ['https://x.invalid/assets/img/a.svg','//x.invalid/assets/img/a.svg','data:test','mailto:a@b','/__desktop/auth','/version.json','/projects/'])assert.equal(releaseAssetURL(value,id),value);
});
test('secret-like or unsupported asset files fail the allowlist',()=>temporary(base=>{const src=fixture(base),out=path.join(base,'out');write(path.join(src,'assets/js/private-key.js'),'synthetic');assert.throws(()=>buildSite(src,out),/allowlist/);assert.equal(existsSync(out),false);}));
test('verification rejects tampering and extra output files',()=>temporary(base=>{
 const src=fixture(base),out=path.join(base,'out');const result=buildSite(src,out);write(path.join(out,'assets/releases/'+result.id+'/js/main.js'),'changed');assert.throws(()=>verifySiteBuild(out),/checksum/);
 const clean=path.join(base,'clean');buildSite(src,clean);write(path.join(clean,'unexpected.json'),'{}');assert.throws(()=>verifySiteBuild(clean),/unexpected files/);
}));
test('source/output and junction guards run before any source modification',()=>temporary(base=>{
 const src=fixture(base);assert.throws(()=>buildSite(src,path.join(src,'out')),/separate/);assert.throws(()=>buildSite(src,base),/separate/);
 const link=path.join(base,'source-link');symlinkSync(src,link,'junction');assert.throws(()=>buildSite(src,path.join(link,'must-not-exist','out')),/resolves/);assert.equal(existsSync(path.join(src,'must-not-exist')),false);
 const extra=path.join(base,'elsewhere');mkdirSync(extra);write(path.join(extra,'private.js'),'synthetic');symlinkSync(extra,path.join(src,'assets/js/link'),'junction');assert.throws(()=>siteRevision(src),/symlink/);
}));
test('unrecognized existing output is not overwritten',()=>temporary(base=>{const src=fixture(base),out=path.join(base,'not-a-build');write(path.join(out,'keep.txt'),'keep me');assert.throws(()=>buildSite(src,out));assert.equal(readFileSync(path.join(out,'keep.txt'),'utf8'),'keep me');}));
test('retention is bounded and preserves current plus two previous releases',()=>temporary(base=>{const src=fixture(base),out=path.join(base,'out');const ids=[];for(let i=0;i<4;i++){write(path.join(src,'assets/js/main.js'),'window.i='+i+';');ids.push(buildSite(src,out,{retain:2}).id);}assert.deepEqual(verifySiteBuild(out).releases,ids.slice(-3).reverse());assert.equal(existsSync(path.join(out,'assets/releases',ids[0])),false);}));
test('nginx templates preserve headers and deploy guard precedes every SSH call',()=>{
 const home=readFileSync(path.join(ROOT,'deploy/nginx/win11-home-app.conf'),'utf8'),setup=readFileSync(path.join(ROOT,'deploy/pi-setup.sh'),'utf8'),projects=readFileSync(path.join(ROOT,'deploy/nginx-projects.conf'),'utf8'),deploy=readFileSync(path.join(ROOT,'deploy/deploy-site.sh'),'utf8');
 const marker="<<'APPEOF'\n",start=setup.indexOf(marker)+marker.length,end=setup.indexOf('\nAPPEOF',start);assert.equal(setup.slice(start,end).trim(),home.trim());
 assert.ok(home.includes('location ~ "^/assets/releases/[a-f0-9]{24}/"'));assert.ok(home.includes('location ~* \\.html$'));assert.ok(home.includes('location = /version.json'));
 assert.equal((home.match(/include \/etc\/nginx\/snippets\/win11-home-headers[.]conf;/g)||[]).length,2);assert.ok(home.includes('proxy_set_header Host $http_host;'));assert.ok(home.includes('proxy_set_header X-Real-IP $remote_addr;'));assert.ok(home.includes('client_max_body_size 1k;'));assert.ok(home.includes('"no-store, private" always;'));
 assert.ok(!/expires\s+(?:7d|30d)/.test(home+projects));assert.ok(projects.includes('[A-Za-z0-9_-]{8}'));assert.ok(deploy.includes('SRC="'+String.fromCharCode(36)+'{1:-dist-site}"'));assert.ok(deploy.indexOf('build-site.mjs" --check')<deploy.indexOf('"'+String.fromCharCode(36)+'{SSH_CMD[@]}" -o ConnectTimeout'));
});
