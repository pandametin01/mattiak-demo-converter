import http from 'node:http';
import fs from 'node:fs/promises';
import {handleDemoRequest} from '../functions/api/demo.js';
const port=8788;
const types={html:'text/html; charset=utf-8',js:'text/javascript',css:'text/css',wasm:'application/wasm',txt:'text/plain'};
http.createServer(async(req,res)=>{
    const origin=`http://127.0.0.1:${port}`;
    if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host)){res.writeHead(403).end();return;}
    try{
        if(req.url==='/api/demo'){
            const request=new Request(origin+req.url,{method:req.method,headers:req.headers,body:req.method==='POST'?req:undefined,duplex:'half'});
            const response=await handleDemoRequest(request);res.writeHead(response.status,Object.fromEntries(response.headers));
            if(response.body){for await(const chunk of response.body){if(res.destroyed)break;res.write(chunk);}}res.end();return;
        }
        const path=new URL(req.url,origin).pathname;
        if(!/^\/(?:[\w.-]+|licenses\/[\w.-]+)?$/.test(path)){res.writeHead(404).end();return;}
        const name=path==='/'?'/index.html':path,data=await fs.readFile('dist'+name);
        res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)]??'application/octet-stream','Cache-Control':'no-store'});res.end(data);
    }catch{res.writeHead(404).end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${port}/`));
