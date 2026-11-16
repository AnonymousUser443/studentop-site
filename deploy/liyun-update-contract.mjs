import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export function validateUpdateManifest(m,commit){
 assert.match(commit,/^[a-f0-9]{40}$/);assert.equal(m.commit,commit);assert.equal(m.format,1);assert.equal(m.appVersion,'1.2.0');assert.match(m.id,/^liyun-ui-\d{8}T\d{6}Z-[a-f0-9]{10}$/);assert.match(m.version,/^[a-f0-9]{24}$/);
 const api=['progress.mjs','published-content.mjs','server.mjs','shared/game-settings.mjs','shared/published.mjs','store.mjs'];assert.deepEqual(Object.keys(m.reviewedApi).sort(),api);
 assert.ok(Array.isArray(m.files)&&m.files.length<200&&m.files.length>8);let bytes=0;const seen=new Set();
 for(const f of m.files){assert.match(f.path,/^(?:public\/(?:index\.html|sw\.js|version\.json|assets\/[A-Za-z0-9_./-]+)|api\/(?:server\.mjs|store\.mjs|progress\.mjs|published-content\.mjs|shared\/(?:game-settings|published)\.mjs))$/);assert.ok(f.path.split('/').every(x=>x&&!x.startsWith('.')));assert.ok(!seen.has(f.path));seen.add(f.path);assert.match(f.sha256,/^[a-f0-9]{64}$/);assert.ok(Number.isSafeInteger(f.bytes)&&f.bytes>=0);bytes+=f.bytes;if(f.path.startsWith('api/'))assert.equal(f.sha256,m.reviewedApi[f.path.slice(4)]);}
 assert.ok(bytes<50_000_000);for(const name of [...api.map(x=>'api/'+x),'public/index.html','public/sw.js','public/version.json','public/assets/releases/'+m.version+'/precache.json'])assert.ok(seen.has(name),'Missing '+name);
 assert.equal(m.reviewedApi['progress.mjs'],m.baseline.apiFiles['progress.mjs']);assert.equal(m.reviewedApi['shared/game-settings.mjs'],m.baseline.apiSharedSHA256);
 for(const name of ['published-content.mjs','shared/published.mjs'])assert.equal(m.reviewedApi[name],m.baseline.apiSupport[name]);
 for(const root of ['/opt/projects/liyun','/opt/projects/liyun-api'])assert.ok(m.baseline.pointers[root]?.startsWith(root+'/releases/'));
 assert.match(m.baseline.publicationSHA256,/^[a-f0-9]{64}$/);return true;
}
export function accountFingerprint(db){
 const schema=db.prepare('PRAGMA user_version').get().user_version;assert.equal(schema,2);const count={},hash=createHash('sha256');
 for(const [table,order]of [['users','id'],['sessions','token_hash'],['checkins','user_id,landmark_id'],['progress','user_id']]){const rows=db.prepare('SELECT * FROM '+table+' ORDER BY '+order).all();count[table]=rows.length;hash.update(table+'\0'+JSON.stringify(rows)+'\0');}
 return {schema,count,contentDigest:hash.digest('hex')};
}
