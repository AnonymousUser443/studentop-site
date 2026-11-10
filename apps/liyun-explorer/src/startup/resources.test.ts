import {describe,it,expect} from 'vitest';
import {validateManifest} from './resources';
describe('precache publication boundary',()=>{
 const version='1234567890abcdef12345678',asset={url:'/assets/releases/'+version+'/map.webp',bytes:123,sha256:'a'.repeat(64)};
 it('accepts a matching immutable resource manifest',()=>expect(validateManifest({format:1,version,assets:[asset]},version)).toBe(true));
 it('rejects another version, duplicate paths and untrusted resource locations',()=>{
  expect(validateManifest({format:1,version:'old',assets:[asset]},version)).toBe(false);
  expect(validateManifest({format:1,version,assets:[asset,asset]},version)).toBe(false);
  for(const url of ['https://other.test/x','/api/progress','/assets/releases/'+version+'/../private'])expect(validateManifest({format:1,version,assets:[{...asset,url}]},version)).toBe(false);
  expect(validateManifest({format:1,version,assets:[{...asset,sha256:'bad'}]},version)).toBe(false);
 });
});
