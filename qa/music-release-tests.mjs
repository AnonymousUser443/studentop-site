/** Local-only release guards. Fixtures use temporary Git repositories; no SSH or production apply. */
import test, {before, after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
import {buildSite} from '../tools/site-release.mjs';
import {prepareMusicRelease, createMusicTar} from '../tools/prepare-music-release.mjs';
import {
  validateMusicBaseline, validateMusicEnvironment, includeMusicSnippet,
  readMusicTar, readMusicArtifact, sha256
} from '../deploy/apply-music-release.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TEMP_ROOT=fs.realpathSync(os.tmpdir());
const PREFIX='tingchao-release-test-';
const temporaryDirectories=[];
const baseline={home:'/opt/win11-home/releases/old-home',auth:'/opt/projects/desktop-auth/releases/old-auth',homeAppSha256:'a'.repeat(64)};
const PRIVATE_SENTINEL='synthetic-private-fixture-never-package-2026';
let fixture;

function temporary() {
  const directory=fs.mkdtempSync(path.join(TEMP_ROOT,PREFIX));
  temporaryDirectories.push(directory);return directory;
}
function write(root,name,bytes) {
  const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);
}
function git(root,args) {
  const env={...process.env};
  for(const name of ['GIT_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_CONFIG','GIT_CONFIG_COUNT'])delete env[name];
  return execFileSync('git',['-c','core.autocrlf=false','-c','commit.gpgsign=false','-c','core.hooksPath='+path.join(root,'.disabled-hooks'),...args],{
    cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:1024*1024,windowsHide:true,env
  }).trim();
}
function commit(root,message) {
  git(root,['add','.']);git(root,['-c','user.name=Music release fixture','-c','user.email=fixture@example.invalid','commit','--quiet','-m',message]);
  return git(root,['rev-parse','HEAD']);
}
function makeFixture() {
  const root=temporary();
  write(root,'.gitignore','node_modules/\n.private/\n.release-local/\ndist-site/\n.env\n');
  write(root,'site/index.html','<html><head><title>Music fixture</title></head><body><script type="module" src="/assets/js/apps-music.js"></script></body></html>');
  write(root,'site/assets/js/apps-music.js','export const musicFixture=true;\n');
  for(const name of ['desktop-auth.mjs','serve-desktop-auth.mjs','task-manager-proxy.mjs','music-proxy.mjs','prepare-music-release.mjs','site-release.mjs'])write(root,'tools/'+name,fs.readFileSync(path.join(ROOT,'tools',name)));
  for(const name of ['package.json','package-lock.json'])write(root,'apps/aidenos-music/'+name,fs.readFileSync(path.join(ROOT,'apps/aidenos-music',name)));
  for(const name of fs.readdirSync(path.join(ROOT,'apps/aidenos-music/server')))if(name.endsWith('.mjs'))write(root,'apps/aidenos-music/server/'+name,fs.readFileSync(path.join(ROOT,'apps/aidenos-music/server',name)));
  for(const name of ['deploy/apply-music-release.mjs','deploy/systemd/aidenos-music.service','deploy/nginx/win11-home-music.conf'])write(root,name,fs.readFileSync(path.join(ROOT,name)));
  // Plant excluded material so the bundle test would catch an accidental broad copy.
  for(const name of ['.private/music-dev/config.json','apps/aidenos-music/.env','apps/aidenos-music/node_modules/fixture/index.js'])write(root,name,PRIVATE_SENTINEL);
  for(const name of ['extra.test.mjs','diagnose-fixture.mjs','guest-smoke-extra.mjs','README.md'])write(root,'apps/aidenos-music/server/'+name,PRIVATE_SENTINEL);
  buildSite(path.join(root,'site'),path.join(root,'dist-site'),{retain:0});
  fs.mkdirSync(path.join(root,'.disabled-hooks'));git(root,['init','--quiet']);
  const reviewed=commit(root,'Local-only Music release fixture');
  const baselineFile=path.join(root,'.release-local/music-baseline.json');write(root,'.release-local/music-baseline.json',JSON.stringify(baseline));
  const prepared=prepareMusicRelease(reviewed,baselineFile,{root,now:new Date('2026-11-16T00:00:00Z')});
  return {root,reviewed,baselineFile,prepared,artifact:readMusicArtifact(prepared.out,prepared.archiveSHA256)};
}
function pack(files) {
  const stage=temporary(),archive=gzipSync(createMusicTar(files));
  fs.writeFileSync(path.join(stage,'bundle.tar.gz'),archive);
  return {stage,hash:sha256(archive)};
}
function alteredArtifact(change) {
  const files=new Map(fixture.artifact.buffers),manifest=JSON.parse(files.get('manifest.json'));
  change(files,manifest);
  files.set('manifest.json',Buffer.from(JSON.stringify(manifest)));
  return pack(files);
}
function replaceJSON(files,manifest,name,change) {
  const value=JSON.parse(files.get(name));change(value);const bytes=Buffer.from(JSON.stringify(value));files.set(name,bytes);
  const entry=manifest.files.find(file=>file.path===name);assert(entry);entry.bytes=bytes.length;entry.sha256=sha256(bytes);
}
function rejected({stage,hash},pattern) {assert.throws(()=>readMusicArtifact(stage,hash),pattern);}
function headerChecksum(tar) {
  tar.fill(32,148,156);const sum=tar.subarray(0,512).reduce((total,value)=>total+value,0);
  tar.write(sum.toString(8).padStart(6,'0')+'\0 ',148,8,'ascii');return tar;
}
function alteredHeader({name,type,size}={}) {
  const bytes=Buffer.from(createMusicTar(new Map([['safe.txt',Buffer.from('safe')]])));
  if(name!==undefined){bytes.fill(0,0,100);bytes.write(name,0,100,'utf8');}
  if(type!==undefined)bytes[156]=type.charCodeAt(0);
  if(size!==undefined)bytes.write(size.toString(8).padStart(11,'0')+'\0',124,12,'ascii');
  return headerChecksum(bytes);
}

before(()=>{fixture=makeFixture();});
after(()=>{
  for(const directory of temporaryDirectories.reverse()){
    const absolute=path.resolve(directory);
    assert.equal(path.dirname(absolute),TEMP_ROOT);assert(path.basename(absolute).startsWith(PREFIX));
    assert(!fs.lstatSync(absolute).isSymbolicLink());fs.rmSync(absolute,{recursive:true,force:true});
  }
});

test('baseline accepts exactly the reviewed release pointers and nginx hash',()=>{
  assert.deepEqual(validateMusicBaseline(baseline),baseline);
  for(const bad of [{...baseline,auth:'/tmp/other'},{...baseline,home:baseline.home+'/../other'},{...baseline,homeAppSha256:'wrong'},{...baseline,extra:true}])assert.throws(()=>validateMusicBaseline(bad));
});

test('private environment requires exact production constants and rejects injected fields',()=>{
  const env='MUSIC_GATEWAY_KEY='+'b'.repeat(64)+'\nMUSIC_COOKIE_KEY='+'c'.repeat(64)+'\nMUSIC_DATA_DIR=/var/lib/aidenos-music\nMUSIC_PORT=8901\nMUSIC_PUBLIC_ORIGIN=https://studentop.cn:14355\nMUSIC_SECURE_COOKIES=true\n';
  assert.equal(validateMusicEnvironment(env),true);
  for(const bad of [env.replace('14355','443'),env.replace('true','false'),env+'NODE_OPTIONS=unsafe\n',env+'MUSIC_PORT=8901\n'])assert.throws(()=>validateMusicEnvironment(bad));
});

test('nginx insertion preserves all original bytes and is idempotent for LF, CRLF and no final newline',()=>{
  for(const ending of ['\n','\r\n','']){
    const original=Buffer.from('# existing live configuration'+ending+'location / { try_files $uri =404; }'+ending);
    const next=includeMusicSnippet(original);
    assert(next.subarray(0,original.length).equals(original));assert(includeMusicSnippet(next).equals(next));
    assert.equal(next.toString().split('win11-home-music.conf').length,2);
  }
  assert.throws(()=>includeMusicSnippet(Buffer.from('# ambiguous win11-home-music.conf')));
  assert.throws(()=>includeMusicSnippet(Buffer.from('include /etc/nginx/snippets/win11-home-music.conf;\n'.repeat(2))));
});

test('USTAR round trip retains long UTF-8 paths, bytes and zero-length files',()=>{
  const input=new Map([['long/'.repeat(20)+'听潮.js',Buffer.from('export const 听潮=true;')],['fonts/empty.txt',Buffer.alloc(0)]]);
  const result=readMusicTar(createMusicTar(input,1));assert.equal(result.size,input.size);
  for(const [name,bytes]of input)assert(result.get(name).equals(bytes));
});

test('tar rejects traversal, absolute paths, links, devices and extended metadata',()=>{
  for(const name of ['../escape','/absolute','home/../escape','home\\escape','C:/escape','home/.hidden'])assert.throws(()=>readMusicTar(alteredHeader({name})),undefined,name);
  for(const type of ['1','2','3','4','5','6','x','g','L'])assert.throws(()=>readMusicTar(alteredHeader({type})),undefined,type);
});

test('tar rejects invalid checksums, duplicate members, truncated payloads and oversize headers',()=>{
  const original=createMusicTar(new Map([['same.txt',Buffer.from('same')]]));
  const corrupt=Buffer.from(original);corrupt[10]^=1;assert.throws(()=>readMusicTar(corrupt),/checksum/);
  assert.throws(()=>readMusicTar(Buffer.concat([original.subarray(0,-1024),original])),/duplicate/);
  assert.throws(()=>readMusicTar(original.subarray(0,-512)),/terminator/);
  assert.throws(()=>readMusicTar(alteredHeader({size:128*1024*1024+1})),/size/);
});

test('reviewed prepare output survives tar validation and the read-only CLI dry-run',()=>{
  const {prepared,artifact,reviewed}=fixture;
  assert.equal(artifact.manifest.commit,reviewed);assert.equal(artifact.manifestSHA256,prepared.manifestSHA256);
  assert.equal(artifact.manifest.homeVersion,JSON.parse(fs.readFileSync(path.join(fixture.root,'dist-site/version.json'))).id);
  const before=fs.readdirSync(prepared.out).sort();
  const output=JSON.parse(execFileSync(process.execPath,[path.join(ROOT,'deploy/apply-music-release.mjs'),'--dry-run',prepared.out,prepared.archiveSHA256],{encoding:'utf8',timeout:15000,windowsHide:true}));
  assert.equal(output.mode,'dry-run');assert.equal(output.id,prepared.id);assert.equal(output.archiveSHA256,prepared.archiveSHA256);
  assert.deepEqual(fs.readdirSync(prepared.out).sort(),before);
});

test('prepare CLI uses the reviewed fixture commit and emits only local artifact metadata',()=>{
  const output=JSON.parse(execFileSync(process.execPath,[path.join(fixture.root,'tools/prepare-music-release.mjs'),fixture.reviewed,fixture.baselineFile],{cwd:fixture.root,encoding:'utf8',timeout:15000,windowsHide:true}));
  assert.equal(output.commit,fixture.reviewed);assert.equal(readMusicArtifact(output.out,output.archiveSHA256).manifest.homeVersion,fixture.prepared.homeVersion);
  assert.equal(JSON.stringify(output).includes(PRIVATE_SENTINEL),false);
});

test('bundles exclude planted private data, tests, diagnostics, documentation and node_modules',()=>{
  const {manifest,buffers}=fixture.artifact;
  assert(manifest.files.some(file=>file.path==='auth/tools/music-proxy.mjs'));
  assert(manifest.files.some(file=>file.path==='music/server/sdk-context.mjs'));
  assert.equal(manifest.files.some(file=>/node_modules|\.test\.|diagnos|guest-smoke|\.env|README|\.private/.test(file.path)),false);
  for(const bytes of buffers.values())assert.equal(bytes.includes(Buffer.from(PRIVATE_SENTINEL)),false);
});

test('prepare rejects the wrong reviewed commit, dirty tracked code and untracked runtime code',()=>{
  const prepare=()=>prepareMusicRelease(fixture.reviewed,fixture.baselineFile,{root:fixture.root,now:new Date('2026-11-17T00:00:00Z')});
  assert.throws(()=>prepareMusicRelease('0'.repeat(40),fixture.baselineFile,{root:fixture.root}),/HEAD differs/);
  const file=path.join(fixture.root,'apps/aidenos-music/server/index.mjs'),previous=fs.readFileSync(file);
  try{fs.appendFileSync(file,'\n// unreviewed fixture mutation\n');assert.throws(prepare,/committed and unchanged/);}finally{fs.writeFileSync(file,previous);}
  const untracked=path.join(fixture.root,'apps/aidenos-music/server/unreviewed.mjs');
  try{fs.writeFileSync(untracked,'export{};');assert.throws(prepare,/committed and unchanged/);}finally{fs.unlinkSync(untracked);}
});

test('SDK dependency, SDK lock version and dependency registry remain pinned after valid rehashing',()=>{
  for(const change of [
    (files,m)=>replaceJSON(files,m,'music/package.json',value=>{value.dependencies['@neteasecloudmusicapienhanced/api']='4.41.2';}),
    (files,m)=>replaceJSON(files,m,'music/package-lock.json',value=>{value.packages['node_modules/@neteasecloudmusicapienhanced/api'].version='4.41.2';}),
    (files,m)=>replaceJSON(files,m,'music/package-lock.json',value=>{value.packages['node_modules/@neteasecloudmusicapienhanced/api'].resolved='https://unreviewed.invalid/sdk.tgz';})
  ])rejected(alteredArtifact(change),/SDK|registry|dependency/);
});

test('outer archive pin and inner manifest checksums independently reject changed content',()=>{
  assert.throws(()=>readMusicArtifact(fixture.prepared.out,'0'.repeat(64)),/Archive SHA256 mismatch/);
  rejected(alteredArtifact(files=>files.set('music/server/index.mjs',Buffer.from('changed despite a new external archive hash'))),/Artifact checksum mismatch/);
});

test('unlisted members, duplicate manifest entries and a rehashed wrong home version are rejected',()=>{
  rejected(alteredArtifact(files=>files.set('home/leak.json',Buffer.from('{}'))),/Unlisted archive/);
  rejected(alteredArtifact((files,m)=>m.files.push({...m.files[0]})),/duplicate/);
  rejected(alteredArtifact((files,m)=>replaceJSON(files,m,'home/version.json',value=>{value.id='0'.repeat(24);})),/Home build\/version mismatch/);
});

test('committed source changes still require a fresh native build',()=>{
  const independent=makeFixture();
  fs.appendFileSync(path.join(independent.root,'site/assets/js/apps-music.js'),'\nexport const revised=true;\n');
  const reviewed=commit(independent.root,'Reviewed fixture update without rebuilding');
  assert.throws(()=>prepareMusicRelease(reviewed,independent.baselineFile,{root:independent.root}),/build does not match current site source/);
});
