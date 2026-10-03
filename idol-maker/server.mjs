import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json'};
const port = Number(process.env.PORT || 4180);
http.createServer(async (req,res) => {
  try {
    let url = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(url.endsWith('/')) url+='index.html';
    const file=path.resolve(root,'.'+url);
    if(!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}).end(data);
  } catch {res.writeHead(404).end('파일을 찾을 수 없어요.');}
}).listen(port,'127.0.0.1',()=>console.log(`아이돌 키우기 http://127.0.0.1:${port}/idol-maker/`));
