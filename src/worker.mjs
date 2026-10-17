import {DemoReader,EntityMode} from 'cs2parser/browser';
import Bzip2 from '@foxglove/wasm-bz2';
import {analyzeDemo} from './analyzer.mjs';
const MAX=512*1024*1024;
const status=(stage,received=0,total=0)=>postMessage({type:'progress',stage,received,total});
async function download(url){
    const response=await fetch('/api/demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({demo_url:url})});
    if(!response.ok){const body=await response.json();throw new Error(body.error||'Demo download failed.');}
    const total=Number(response.headers.get('X-Demo-Size'))||0,reader=response.body.getReader(),chunks=[];let received=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;received+=value.length;if(received>MAX)throw new Error('The download exceeds 512 MB.');chunks.push(value);status('downloading',received,total);}}
    catch(e){await reader.cancel();throw e;}
    if(total&&total!==received)throw new Error('The demo download was interrupted.');
    const data=new Uint8Array(received);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return data;
}
async function unpack(data){
    if(data[0]===66&&data[1]===90&&data[2]===104){
        status('unpacking');const decoder=await Bzip2.init();
        for(let size=64*1024*1024;size<=MAX;size*=2){
            try{return decoder.decompress(data,size);}catch(error){if(!error.message.includes('-8')||size===MAX)throw new Error('The archive is invalid or its unpacked demo exceeds 512 MB.');}
        }
    }
    return data;
}
onmessage=async event=>{
    try{
        let data=event.data.file?new Uint8Array(await event.data.file.arrayBuffer()):await download(event.data.url);
        if(data.length>MAX)throw new Error('This demo exceeds the 512 MB browser limit.');
        data=await unpack(data);
        if(new TextDecoder().decode(data.subarray(0,8))!=='PBDEMS2\0')throw new Error('This is not a CS2 demo file.');
        status('analyzing',0,data.length);
        const digest=await crypto.subtle.digest('SHA-256',data);
        const match=await analyzeDemo(DemoReader,EntityMode,data,{name:event.data.file?.name??'downloaded-match.dem',onProgress:received=>status('analyzing',received,data.length)});
        match.sha256=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
        postMessage({type:'complete',match});
    }catch(error){postMessage({type:'error',message:error.message||'Could not read this demo. Try a recent, complete CS2 demo.'});}
};
