/** Deterministic public-site release builder. No server, deployment, private config or dependencies. */
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, realpathSync, lstatSync, readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
const FORMAT = 1;
const SCHEMA = 'aiden-public-site-release-v2';
const ID = /^[a-f0-9]{24}$/;
const HTML = ['index.html', 'projects/index.html'];
const ASSET = /^assets\/(?:css|js|img|fonts|audio)\//;
const EXT = new Set(['.css','.js','.mjs','.svg','.png','.jpg','.jpeg','.webp','.avif','.gif','.ico','.bmp','.woff','.woff2','.ttf','.otf','.opus','.mp3','.ogg','.wav','.m4a','.mp4','.webm']);
const LICENSES = new Set(['assets/fonts/OFL-NotoSansSC.txt','assets/fonts/OFL-NotoSerifSC.txt']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function within(root, candidate) { const rel=path.relative(root,candidate); return rel==='' || (!path.isAbsolute(rel) && rel!=='..' && !rel.startsWith('..'+path.sep)); }
function segments(name) { return name.split('/').every(s=>s && s!=='.' && s!=='..' && !s.startsWith('.') && !/[\\:\x00-\x1f\x7f]/.test(s) && !/[. ]$/.test(s)); }
function assetName(name) { return ASSET.test(name) && segments(name) && !/(?:^|[\/._-])(?:secret|credentials?|private|password|auth)(?:[\/._-]|$)/i.test(name) && (EXT.has(path.extname(name).toLowerCase()) || LICENSES.has(name)); }
function safeFile(root, name) {
  if (!segments(name)) throw new Error('Unsafe public path: '+name);
  let full=root;
  for(const part of name.split('/')) { full=path.join(full,part); if(lstatSync(full).isSymbolicLink()) throw new Error('Public symlinks are not allowed: '+name); }
  const actual=realpathSync(full);
  if(!within(root,actual) || !lstatSync(actual).isFile()) throw new Error('Public file escapes root: '+name);
  return actual;
}
function canonicalPath(value) {
  let parent=path.resolve(value); const rest=[];
  while(!existsSync(parent)) {rest.unshift(path.basename(parent));const next=path.dirname(parent);if(next===parent)throw new Error('No accessible output ancestor.');parent=next;}
  return path.resolve(realpathSync(parent),...rest);
}
function sourceSnapshot(siteRoot) {
  const root=realpathSync(path.resolve(siteRoot));
  const files=[];
  for(const name of HTML) {
    if(name!=='index.html' && !existsSync(path.join(root,name))) continue;
    files.push({name,data:readFileSync(safeFile(root,name))});
  }
  const assetsRoot=path.join(root,'assets');
  if(!existsSync(assetsRoot) || lstatSync(assetsRoot).isSymbolicLink()) throw new Error('A real public assets directory is required.');
  const visit=dir=>{
    for(const entry of readdirSync(path.join(root,dir),{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0)) {
      const name=dir+'/'+entry.name;
      if(entry.isSymbolicLink()) throw new Error('Public symlinks are not allowed: '+name);
      if(!segments(name)) throw new Error('Hidden or unsafe file in public assets: '+name);
      if(entry.isDirectory()) visit(name);
      else if(entry.isFile()) {
        if(!assetName(name)) throw new Error('File is not in the public asset allowlist: '+name);
        files.push({name,data:readFileSync(safeFile(root,name))});
      } else throw new Error('Non-regular public asset: '+name);
    }
  };
  visit('assets');
  files.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  const hash=createHash('sha256').update(SCHEMA+'\0');
  for(const file of files) hash.update(file.name+'\0'+file.data.length+'\0').update(file.data).update('\0');
  return {root,files,id:hash.digest('hex').slice(0,24)};
}
/** Synchronous, side-effect-free: same public content gives the same 24-hex id regardless of cwd/mtime. */
export function siteRevision(siteRoot) { return sourceSnapshot(siteRoot).id; }
export function releaseAssetURL(value,id) {
  if(!ID.test(id)) throw new Error('Invalid release id.');
  if(typeof value!=='string') return value;
  const match=value.match(/^(?:\/|\.\/|\.\.\/)?(assets\/(?:css|js|img|fonts|audio)\/[^\s<>]*)$/);
  if(!match) return value; // Never rewrite external, data:, mailto:, API or navigation URLs.
  return '/assets/releases/'+id+'/'+match[1].slice('assets/'.length);
}
function rewrite(text,id) {
  // Native scripts use ordinary quoted strings for image/font/media URLs; CSS relative URLs
  // retain their folder structure under the release namespace and need no additional query.
  let result=text.replace(/(["'\x60])((?:\/|\.\/|\.\.\/)?assets\/(?:css|js|img|fonts|audio)\/[^"'\x60\s<>]*)\1/g,
    (_all,quote,url)=>quote+releaseAssetURL(url,id)+quote);
  result=result.replace(/url\(\s*((?:\/|\.\/|\.\.\/)?assets\/[^\s"')]+)\s*\)/gi,(_all,url)=>'url('+releaseAssetURL(url,id)+')');
  // Multiple media candidates are only meaningful in HTML srcset, not arbitrary JS strings.
  result=result.replace(/\bsrcset=(['"])([^'"]*)\1/gi,(_all,quote,value)=>'srcset='+quote+value.split(',').map(item=>item.trim().split(/\s+/).map((part,i)=>i===0?releaseAssetURL(part,id):part).join(' ')).join(', ')+quote);
  return result;
}
function htmlDocument(text,id) {
  if(!/<\/head\s*>/i.test(text)) throw new Error('Public HTML has no closing head.');
  const withoutOld=text.replace(/<meta\b[^>]*>/gi,tag=>/\bname\s*=\s*["']site-version["']/i.test(tag)?'':tag);
  let output=rewrite(withoutOld,id);
  // OpenGraph images require absolute URLs. Rewrite only the document's declared own
  // canonical origin; genuinely remote URLs stay untouched.
  const canonical=(text.match(/<link\b[^>]*>/gi)||[]).find(tag=>/\brel\s*=\s*["']canonical["']/i.test(tag));
  const canonicalURL=canonical?.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
  if(canonicalURL) {
    let origin;try{origin=new URL(canonicalURL).origin;}catch{throw new Error('Invalid canonical URL.');}
    output=output.replace(/(["'])(https?:\/\/[^"'\s<>]+)\1/g,(all,quote,value)=>{
      const url=new URL(value);if(url.origin!==origin)return all;
      const pathname=releaseAssetURL(url.pathname,id);if(pathname===url.pathname)return all;
      url.pathname=pathname;return quote+url.href+quote;
    });
  }
  return output.replace(/<\/head\s*>/i,'  <meta name="site-version" content="'+id+'">\n</head>');
}
function treeFiles(root,dir='') {
  const result=[];
  for(const entry of readdirSync(path.join(root,dir),{withFileTypes:true})) {
    const name=dir?dir+'/'+entry.name:entry.name;
    if(entry.isSymbolicLink()) throw new Error('Generated output contains a symlink: '+name);
    if(entry.isDirectory()) result.push(...treeFiles(root,name));
    else if(entry.isFile()) result.push(name);
    else throw new Error('Generated output contains a special file: '+name);
  }
  return result.sort();
}
function readJSON(root,name) { return JSON.parse(readFileSync(safeFile(root,name),'utf8')); }
function validateRelease(root,id,checkEntries=false) {
  if(!ID.test(id)) throw new Error('Invalid generated release id.');
  const prefix='assets/releases/'+id+'/';
  const manifest=readJSON(root,prefix+'manifest.json');
  if(manifest.format!==FORMAT || manifest.id!==id || !Array.isArray(manifest.files) || !Array.isArray(manifest.entries)) throw new Error('Invalid release manifest.');
  const seen=new Set();
  for(const file of manifest.files) {
    if(!file || !assetName('assets/'+file.path) || seen.has(file.path)) throw new Error('Unexpected or duplicate generated asset.');
    seen.add(file.path);
    const data=readFileSync(safeFile(root,prefix+file.path));
    if(file.sha256!==sha(data) || file.bytes!==data.length) throw new Error('Generated asset checksum failed: '+file.path);
  }
  const actual=treeFiles(path.join(root,prefix));
  const expected=[...seen,'manifest.json'].sort();
  if(JSON.stringify(actual)!==JSON.stringify(expected)) throw new Error('Unlisted files inside release namespace.');
  if(checkEntries) {
    const names=new Set();
    for(const entry of manifest.entries) {
      if(!HTML.includes(entry.path) || names.has(entry.path)) throw new Error('Unexpected generated HTML.');
      names.add(entry.path);
      const data=readFileSync(safeFile(root,entry.path));
      if(sha(data)!==entry.sha256 || data.length!==entry.bytes || !data.toString('utf8').includes('<meta name="site-version" content="'+id+'">')) throw new Error('Generated HTML checksum/version failed: '+entry.path);
    }
    if(!names.has('index.html')) throw new Error('Missing generated index.html.');
    if(!Array.isArray(manifest.aliases)) throw new Error('Missing compatibility asset manifest.');
    const aliases=new Set();
    const generated=new Map(manifest.files.map(file=>['assets/'+file.path,file]));
    if(manifest.aliases.length!==manifest.files.length) throw new Error('Incomplete compatibility aliases.');
    for(const file of manifest.aliases) {
      const expected=generated.get(file.path);
      if(!assetName(file.path) || aliases.has(file.path) || !expected || expected.sha256!==file.sha256 || expected.bytes!==file.bytes) throw new Error('Invalid compatibility alias.');
      aliases.add(file.path);
      const data=readFileSync(safeFile(root,file.path));
      if(sha(data)!==file.sha256 || data.length!==file.bytes) throw new Error('Compatibility asset checksum failed: '+file.path);
    }
  }
  return manifest;
}
/** Pure local deployment guard: checks checksums, exact output allowlist and matching HTML/version. */
export function verifySiteBuild(outDir) {
  const root=realpathSync(path.resolve(outDir));
  if(lstatSync(path.resolve(outDir)).isSymbolicLink()) throw new Error('Build output root must not be a symlink.');
  const version=readJSON(root,'version.json');
  const history=readJSON(root,'site-build.json');
  if(!ID.test(version.id) || Object.keys(version).join()!=='id' || history.format!==FORMAT || !Array.isArray(history.releases) || history.releases[0]!==version.id || new Set(history.releases).size!==history.releases.length) throw new Error('Invalid generated build identity.');
  const allowed=new Set(['version.json','site-build.json']);
  let assetCount=0;
  for(const id of history.releases) {
    const manifest=validateRelease(root,id,id===version.id);
    allowed.add('assets/releases/'+id+'/manifest.json');
    for(const file of manifest.files) { allowed.add('assets/releases/'+id+'/'+file.path); assetCount++; }
    if(id===version.id) {
      for(const entry of manifest.entries) allowed.add(entry.path);
      for(const alias of manifest.aliases) allowed.add(alias.path);
    }
  }
  if(JSON.stringify(treeFiles(root))!==JSON.stringify([...allowed].sort())) throw new Error('Output has unexpected files; refusing deployment.');
  return {id:version.id,releases:history.releases,assetCount};
}
function removeOwned(folder,parent,prefix) {
  if(!existsSync(folder)) return;
  const actual=realpathSync(folder);
  if(actual!==path.resolve(folder) || path.dirname(actual)!==realpathSync(parent) || !path.basename(actual).startsWith(prefix)) throw new Error('Refusing unexpected cleanup path.');
  rmSync(actual,{recursive:true,force:true});
}
/** Build into a fresh stage, verify it, then replace only a previously verified generated output. */
export function buildSite(siteRoot,outDir,{retain=2}={}) {
  if(!Number.isInteger(retain) || retain<0 || retain>10) throw new Error('retain must be 0..10.');
  const snapshot=sourceSnapshot(siteRoot);
  const out=path.resolve(outDir);
  const parent=path.dirname(out), name=path.basename(out);
  if(out===path.parse(out).root || within(snapshot.root,out) || within(out,snapshot.root)) throw new Error('Output must be separate from the source tree and its ancestors.');
  const canonicalOut=canonicalPath(out);
  if(within(snapshot.root,canonicalOut) || within(canonicalOut,snapshot.root)) throw new Error('Output resolves into the source tree or its ancestors.');
  mkdirSync(parent,{recursive:true});
  const actualParent=realpathSync(parent);
  if(within(snapshot.root,actualParent) || within(path.join(actualParent,name),snapshot.root)) throw new Error('Output ancestor resolves into the source tree.');
  if(existsSync(out) && lstatSync(out).isSymbolicLink()) throw new Error('Output must not be a symlink.');
  let previous=[];
  if(existsSync(out)) previous=verifySiteBuild(out).releases.filter(id=>id!==snapshot.id).slice(0,retain);
  const releases=[snapshot.id,...previous];
  const stage=path.join(actualParent,'.'+name+'.stage-'+randomUUID());
  const backup=path.join(actualParent,'.'+name+'.backup-'+randomUUID());
  mkdirSync(stage);
  let movedOld=false,committed=false;
  const write=(relative,data)=>{const full=path.join(stage,relative);mkdirSync(path.dirname(full),{recursive:true});writeFileSync(full,data,{flag:'wx'});};
  try {
    for(const id of previous) {
      for(const relative of treeFiles(path.join(out,'assets/releases/'+id))) {
        const name='assets/releases/'+id+'/'+relative;
        write(name,readFileSync(safeFile(realpathSync(out),name)));
      }
    }
    const manifest={format:FORMAT,id:snapshot.id,files:[],entries:[],aliases:[]};
    for(const file of snapshot.files) {
      if(HTML.includes(file.name)) {
        const data=Buffer.from(htmlDocument(file.data.toString('utf8'),snapshot.id));
        write(file.name,data);manifest.entries.push({path:file.name,bytes:data.length,sha256:sha(data)});
      } else {
        const relative=file.name.slice('assets/'.length);
        const data=['.js','.mjs','.css','.svg'].includes(path.extname(file.name))?Buffer.from(rewrite(file.data.toString('utf8'),snapshot.id)):file.data;
        write('assets/releases/'+snapshot.id+'/'+relative,data);manifest.files.push({path:relative,bytes:data.length,sha256:sha(data)});
        // Mutable aliases keep pre-versioned tabs and old shared URLs from immediately 404ing.
        // New HTML/scripts always use the immutable namespace instead.
        write(file.name,data);manifest.aliases.push({path:file.name,bytes:data.length,sha256:sha(data)});
      }
    }
    write('assets/releases/'+snapshot.id+'/manifest.json',JSON.stringify(manifest,null,2)+'\n');
    write('version.json',JSON.stringify({id:snapshot.id})+'\n');
    write('site-build.json',JSON.stringify({format:FORMAT,releases},null,2)+'\n');
    const verified=verifySiteBuild(stage);
    if(existsSync(out)) {renameSync(out,backup);movedOld=true;}
    try {renameSync(stage,out);committed=true;}
    catch(error) {if(movedOld && !existsSync(out))renameSync(backup,out);throw error;}
    if(movedOld) removeOwned(backup,actualParent,'.'+name+'.backup-');
    return {...verified,outDir:out,htmlCount:manifest.entries.length};
  } finally {
    if(!committed) removeOwned(stage,actualParent,'.'+name+'.stage-');
    // A backup is never deleted after failed activation/restoration; the operator can recover it.
  }
}
