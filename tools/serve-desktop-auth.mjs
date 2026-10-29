#!/usr/bin/env node
/** Optional production auth companion, loopback only. Deployment remains an owner action. */
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';
import {createDesktopAuth,acquireAuthLease} from './desktop-auth.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let releaseLease;
try {
  const raw = process.env.DESKTOP_AUTH_ORIGIN;
  if (!raw) throw new Error('DESKTOP_AUTH_ORIGIN is required, e.g. the exact HTTPS homepage origin.');
  const origin = new URL(raw);
  if (origin.origin !== raw || origin.protocol !== 'https:' || origin.username || origin.password) throw new Error('An exact HTTPS origin (without trailing slash) is required.');
  const port = Number(process.env.DESKTOP_AUTH_PORT || 8900);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid loopback port.');
  const trustedProxies = (process.env.DESKTOP_AUTH_TRUST_PROXY || '').split(',').filter(Boolean);
  if (!trustedProxies.length || trustedProxies.some(ip => !isIP(ip))) throw new Error('Explicit trusted reverse-proxy IPs are required; configure X-Real-IP at the proxy.');
  releaseLease=await acquireAuthLease(root);
  const auth = await createDesktopAuth({root,origin:raw,secure:true,trustedProxies});
  if (!auth.configured) throw new Error('Private configuration/state unavailable; refusing to start.');
  const server = http.createServer((req,res) => {
    if (req.headers.host !== origin.host) { res.writeHead(403); res.end(); return; }
    auth.handle(req,res).then(handled => {if(!handled){res.writeHead(404);res.end();}}).catch(()=>{if(!res.headersSent)res.writeHead(503);res.end();});
  });
  server.requestTimeout=15000; server.headersTimeout=10000;
  server.listen({host:'127.0.0.1',port,exclusive:true},()=>console.log('Desktop auth companion ready on loopback.'));
  let stopping=false;
  const close=()=>{if(stopping)return;stopping=true;server.close();server.closeAllConnections();void auth.drain().then(()=>releaseLease()).catch(()=>{console.error('Private auth shutdown failed.');process.exitCode=1;});};
  server.on('error',()=>{console.error('Auth listener unavailable.');process.exitCode=1;close();});
  process.once('SIGINT',close);process.once('SIGTERM',close);
} catch(e) {if(releaseLease)await releaseLease();console.error(e.message);process.exitCode=1;}
