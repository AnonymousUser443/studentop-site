import http from 'node:http';import https from 'node:https';import fs from 'node:fs';import path from 'node:path';
const root=fs.realpathSync(process.argv[2]),port=Number(process.argv[3]||5184),mime={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.woff2':'font/woff2','.webp':'image/webp','.png':'image/png','.mp3':'audio/mpeg','.opus':'audio/ogg'};
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405).end();return;}
 if(url.pathname.startsWith('/api/content/')){
  const upstream=https.get('https://liyun.studentop.cn:14355'+url.pathname,{headers:{'Accept-Encoding':'identity'}},reply=>{res.writeHead(reply.statusCode,{'Content-Type':reply.headers['content-type']||'application/octet-stream','Cache-Control':'no-store'});reply.pipe(res);});upstream.on('error',()=>res.writeHead(502).end());return;
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':url.pathname.startsWith('/assets/releases/')?'public, max-age=31536000, immutable':'no-cache'});
 if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
}).listen(port,'127.0.0.1',()=>console.log('Local release preview on '+port));
