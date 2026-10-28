#!/usr/bin/env node
/** Configure privately; never pass the answer in argv, public files or shell history. */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { access, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { privatePaths, makeConfig, savePrivate } from './desktop-auth.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function readSecret() {
  if (process.argv.slice(2).some(x => !['--stdin','--replace'].includes(x))) throw new Error('Use --stdin or interactive input; never provide the answer as an argument.');
  if (!process.stdin.isTTY) {
    if (!process.argv.includes('--stdin')) throw new Error('Non-interactive configuration requires --stdin.');
    const chunks=[];let size=0;
    for await (const chunk of process.stdin) { size+=chunk.length;if(size>512)throw new Error('Input too long.');chunks.push(chunk); }
    return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)).replace(/[\r\n]+$/, '');
  }
  process.stdout.write('Enter the private desktop answer (hidden): ');
  process.stdin.setEncoding('utf8'); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const done = () => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdin.removeListener('data', data); process.stdout.write('\n'); };
    function data(chunk) {
      if (chunk.includes('\u0003')) { done(); reject(new Error('Cancelled.')); return; }
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') { done(); resolve(value); return; }
        if (ch === '\u007f' || ch === '\b') value = Array.from(value).slice(0,-1).join('');
        else if (ch >= ' ' && value.length < 128) value += ch;
      }
    }
    process.stdin.on('data', data);
  });
}
try {
  const {config} = privatePaths(root);
  let exists = false; try { await access(config); exists = true; } catch {}
  if (exists && !process.argv.includes('--replace')) throw new Error('Private configuration already exists. Use --replace only when intentionally changing the answer.');
  await mkdir(path.dirname(config), {recursive:true, mode:0o700});
  if (process.platform === 'win32' && !process.env.DESKTOP_AUTH_CONFIG) {
    // Restrict only our dedicated default directory, never an arbitrary custom parent folder.
    const folder = path.dirname(config).replace(/'/g, "''");
    const script = "$ErrorActionPreference='Stop'; $dir='" + folder + "'; $acl=[System.Security.AccessControl.DirectorySecurity]::new(); $acl.SetAccessRuleProtection($true,$false); $me=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; foreach($sid in @($me,[System.Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[System.Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))) { $acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')) }; Set-Acl -LiteralPath $dir -AclObject $acl";
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{stdio:['ignore','ignore','pipe'],windowsHide:true});
    if(result.error || result.status!==0) throw new Error('Private directory ACL setup failed; no answer was read or saved.');
  } else if (process.platform === 'win32') console.error('Custom private directory: owner must verify Windows DACL before use.');
  let answer = await readSecret();
  const data = await makeConfig(answer); answer = undefined;
  await savePrivate(config, data);
  console.log('Private verifier saved outside public assets. Restart the auth service; no answer was printed.');
} catch (e) { console.error(e.message); process.exitCode = 1; }
