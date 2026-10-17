import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/index.mjs';

test('Worker routes API requests to the relay rather than static HTML',async()=>{
    const env={ASSETS:{fetch(){throw new Error('API request reached assets');}}};
    const get=await worker.fetch(new Request('https://example.test/api/demo'),env);
    assert.equal(get.status,405);
    assert.deepEqual(await get.json(),{error:'Use POST.'});
    const invalid=await worker.fetch(new Request('https://example.test/api/demo',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({demo_url:'http://127.0.0.1/private.dem'}),
    }),env);
    assert.equal(invalid.status,400);
    assert.match((await invalid.json()).error,/direct replay/);
});

test('unknown API routes return a JSON 404',async()=>{
    const response=await worker.fetch(new Request('https://example.test/api/unknown'),{});
    assert.equal(response.status,404);
    assert.deepEqual(await response.json(),{error:'Not found.'});
});

test('non-API requests use the static asset binding and preserve the request',async()=>{
    const request=new Request('https://example.test/style.css');
    const response=await worker.fetch(request,{ASSETS:{fetch(received){
        assert.equal(received,request);
        return new Response('body{}',{headers:{'Content-Type':'text/css'}});
    }}});
    assert.equal(response.headers.get('Content-Type'),'text/css');
    assert.equal(await response.text(),'body{}');
});
