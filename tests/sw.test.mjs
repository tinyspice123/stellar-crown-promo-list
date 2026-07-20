import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const swPath = path.resolve('sw.js');
const swSource = fs.readFileSync(swPath, 'utf8');

class FakeCache {
  constructor(){ this.entries=new Map(); this.precached=[]; }
  key(request){ return typeof request==='string' ? request : request.url; }
  async addAll(urls){ this.precached.push(...urls); }
  async match(request){ return this.entries.get(this.key(request)); }
  async put(request,response){ this.entries.set(this.key(request),response); }
}

let listeners, stores, deleted, fetchImpl, skipWaitingCalled, claimCalled, warnings;

function loadWorker(){
  listeners={}; stores=new Map(); deleted=[];
  warnings=[];
  skipWaitingCalled=false; claimCalled=false;
  fetchImpl=async()=>{ throw new Error('unexpected network request'); };

  const caches={
    async open(name){
      if(!stores.has(name)) stores.set(name,new FakeCache());
      return stores.get(name);
    },
    async keys(){ return [...stores.keys()]; },
    async delete(name){ deleted.push(name); return stores.delete(name); },
    async match(request){
      for(const cache of stores.values()){
        const hit=await cache.match(request);
        if(hit) return hit;
      }
      return undefined;
    },
  };
  const self={
    addEventListener(type,handler){ listeners[type]=handler; },
    skipWaiting(){ skipWaitingCalled=true; },
    clients:{claim(){ claimCalled=true; }},
  };
  const context=vm.createContext({
    self, caches, URL, Response, Promise,
    console:{warn(...args){ warnings.push(args); }},
    location:{origin:'https://tracker.test'},
    fetch(...args){ return fetchImpl(...args); },
  });
  new vm.Script(swSource,{filename:swPath}).runInContext(context);
}

function lifecycleEvent(){
  return {promise:null,waitUntil(promise){ this.promise=Promise.resolve(promise); }};
}

function fetchEvent(url,method='GET'){
  return {
    request:{url,method}, response:null,
    respondWith(promise){ this.response=Promise.resolve(promise); },
  };
}

function fakeResponse({ok=true,type='basic',body='network'}={}){
  return {ok,type,body,clone(){ return {...this}; }};
}

beforeEach(loadWorker);

test('install precaches the shell and activates immediately',async()=>{
  const event=lifecycleEvent();
  listeners.install(event); await event.promise;
  assert.deepEqual(stores.get('shell-v3').precached,
    ['./','index.html','tracker.html','sets.js','lib.js','manifest.json']);
  assert.equal(skipWaitingCalled,true);
});

test('activate removes stale caches but preserves shell and card images',async()=>{
  stores.set('v2',new FakeCache());
  stores.set('shell-v2',new FakeCache());
  stores.set('shell-v3',new FakeCache());
  stores.set('card-images-v1',new FakeCache());
  const event=lifecycleEvent();
  listeners.activate(event); await event.promise;
  assert.deepEqual(deleted.sort(),['shell-v2','v2']);
  assert.equal(stores.has('card-images-v1'),true);
  assert.equal(claimCalled,true);
});

test('image cache hit avoids another network transfer',async()=>{
  const cache=await storesForImages();
  const cached=fakeResponse({body:'cached'});
  await cache.put('https://cards.test/1.png',cached);
  let fetches=0; fetchImpl=async()=>{ fetches++; return fakeResponse(); };
  const event=fetchEvent('https://cards.test/1.png');
  listeners.fetch(event);
  assert.equal(await event.response,cached);
  assert.equal(fetches,0);
});

test('successful and opaque card images are cached',async()=>{
  for(const [url,response] of [
    ['https://cards.test/ok.png',fakeResponse()],
    ['https://cards.test/opaque.jpg',fakeResponse({ok:false,type:'opaque'})],
  ]){
    fetchImpl=async()=>response;
    const event=fetchEvent(url); listeners.fetch(event);
    assert.equal(await event.response,response);
    assert.equal((await storesForImages()).entries.has(url),true);
  }
});

test('failed image fetch returns an error response for fallback handling',async()=>{
  fetchImpl=async()=>{ throw new Error('offline'); };
  const event=fetchEvent('https://cards.test/missing.webp');
  listeners.fetch(event);
  assert.equal((await event.response).type,'error');
  assert.match(warnings[0][0],/image request failed/i);
});

test('ordinary failed image responses are returned without caching',async()=>{
  const notFound=fakeResponse({ok:false,type:'basic',body:'not found'});
  fetchImpl=async()=>notFound;
  const event=fetchEvent('https://cards.test/missing.png');
  listeners.fetch(event);
  assert.equal(await event.response,notFound);
  assert.equal((await storesForImages()).entries.has(event.request.url),false);
});

test('same-origin pages are network-first and cached',async()=>{
  const network=fakeResponse({body:'fresh'});
  fetchImpl=async()=>network;
  const event=fetchEvent('https://tracker.test/tracker.html');
  listeners.fetch(event);
  assert.equal(await event.response,network);
  assert.equal(stores.get('shell-v3').entries.has(event.request.url),true);
});

test('page requests fall back to cache offline and non-GET is ignored',async()=>{
  const shell=new FakeCache(); stores.set('shell-v3',shell);
  const cached=fakeResponse({body:'offline'});
  await shell.put('https://tracker.test/index.html',cached);
  fetchImpl=async()=>{ throw new Error('offline'); };
  const event=fetchEvent('https://tracker.test/index.html');
  listeners.fetch(event);
  assert.equal(await event.response,cached);
  assert.match(warnings[0][0],/offline cache/i);

  const post=fetchEvent('https://tracker.test/save','POST');
  listeners.fetch(post);
  assert.equal(post.response,null);
});

async function storesForImages(){
  if(!stores.has('card-images-v1')) stores.set('card-images-v1',new FakeCache());
  return stores.get('card-images-v1');
}
