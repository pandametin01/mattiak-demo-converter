export function validateDemoUrl(value){
    if(typeof value!=='string'||value.length>2048||/[\s\x00-\x1f]/.test(value))throw new Error('Paste a direct Valve demo download link.');
    let url;try{url=new URL(value);}catch{throw new Error('Invalid demo download link.');}
    if(!['http:','https:'].includes(url.protocol)||!/^replay\d+\.valve\.net$/.test(url.hostname)||url.port||url.username||url.password||url.hash||!/^\/730\/[A-Za-z0-9_-]+\.dem(?:\.bz2)?$/.test(url.pathname))throw new Error('Use a direct replayNNN.valve.net demo link, not a match page or CSGO share code.');
    return url.href;
}
const MAX=512*1024*1024;
const error=(message,status=400)=>Response.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
export async function handleDemoRequest(request,fetcher=fetch){
    if(request.method!=='POST')return error('Use POST.',405);
    if(request.headers.get('Origin')&&request.headers.get('Origin')!==new URL(request.url).origin)return error('Invalid request origin.',403);
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return error('Expected JSON.',415);
    if(Number(request.headers.get('Content-Length'))>4096)return error('Request too large.',413);
    const reader=request.body?.getReader();if(!reader)return error('Missing request body.');
    let raw='',bytes=0;const decoder=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return error('Request too large.',413);}raw+=decoder.decode(value,{stream:true});}
    raw+=decoder.decode();
    let url;try{url=validateDemoUrl(JSON.parse(raw).demo_url);}catch(e){return error(e.message);}
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),240000);
    try{
        let upstream;
        for(let redirects=0;redirects<=3;redirects++){
            upstream=await fetcher(url,{redirect:'manual',signal:controller.signal,headers:{'Accept-Encoding':'identity'}});
            if([301,302,303,307,308].includes(upstream.status)){
                const location=upstream.headers.get('Location');await upstream.body?.cancel();
                if(!location||redirects===3)throw new Error('Too many demo redirects.');
                url=validateDemoUrl(new URL(location,url).href);continue;
            }
            break;
        }
        if(!upstream?.ok||!upstream.body){clearTimeout(timer);return error('Demo unavailable or link expired. Copy a fresh download link from CS2.',502);}
        const length=Number(upstream.headers.get('Content-Length'));
        if(length>MAX){await upstream.body.cancel();clearTimeout(timer);return error('The demo download exceeds 512 MB.',413);}
        let received=0;const source=upstream.body.getReader();
        const stream=new ReadableStream({async pull(c){try{const {done,value}=await source.read();if(done){clearTimeout(timer);c.close();return;}received+=value.byteLength;if(received>MAX)throw new Error('Download too large.');c.enqueue(value);}catch(e){clearTimeout(timer);controller.abort();await source.cancel().catch(()=>{});c.error(e);}},async cancel(){clearTimeout(timer);controller.abort();await source.cancel().catch(()=>{});}});
        const headers={'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
        if(length>0)headers['X-Demo-Size']=String(length);
        return new Response(stream,{headers});
    }catch(e){clearTimeout(timer);controller.abort();return error(e.name==='AbortError'?'The demo download timed out.':'Unable to download this demo. Check the link and try again.',502);}
}
export const onRequest=({request})=>handleDemoRequest(request);
