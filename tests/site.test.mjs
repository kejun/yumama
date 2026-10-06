import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,stat} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import * as state from '../public/state.mjs';
const root=path.resolve(import.meta.dirname,'..');
execFileSync(process.execPath,['scripts/build.mjs'],{cwd:root});
const recipes=JSON.parse(await readFile(path.join(root,'data/recipes.json'),'utf8'));
const app=(await readFile(path.join(root,'public/app.js'),'utf8')).replace(/^import[^\n]+\n/,'');
const read=p=>readFile(path.join(root,'dist',p),'utf8');
async function setup(file='recipes/braised-hairtail/index.html',initial={},navigator={}){
 const {document,window:domWindow}=parseHTML(await read(file));
 Object.defineProperty(document,'visibilityState',{value:'visible',configurable:true});
 const values=new Map(Object.entries(initial));const intervals=[];const clock={now:100000};const listeners={};
 const dialog=document.querySelector('dialog');
 if(dialog){Object.defineProperty(dialog,'open',{get:()=>dialog.hasAttribute('open')});dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new domWindow.Event('close'));};}
 const storage={getItem:k=>values.has(k)?values.get(k):null,setItem:(k,v)=>values.set(k,v)};
 const window={print(){},confirm:()=>true,addEventListener:(type,callback)=>listeners[type]=callback};
 const context=vm.createContext({document,window,localStorage:storage,navigator,location:{search:''},URLSearchParams,Date:class extends Date{static now(){return clock.now;}},setTimeout:()=>1,clearTimeout(){},setInterval:fn=>intervals.push(fn),...state,secondsLeft:timer=>state.secondsLeft(timer,clock.now)});
 vm.runInContext(app,context);
 return {document,dialog,values,clock,context,listeners,tick:()=>intervals.forEach(f=>f()),click:selector=>{const el=document.querySelector(selector);assert.ok(el,selector);el.click();},change:(selector,checked)=>{const el=document.querySelector(selector);el.checked=checked;el.dispatchEvent(new domWindow.Event('change'));},input:(selector,value)=>{const el=document.querySelector(selector);el.value=value;el.dispatchEvent(new domWindow.Event('input'));},event:(type)=>document.dispatchEvent(new domWindow.Event(type))};
}
test('all three source recipes, every original step image, and local resource links are preserved',async()=>{
 assert.equal(recipes.length,3);
 const pages=['index.html','404.html',...recipes.map(r=>`recipes/${r.slug}/index.html`)];
 for(const page of pages){
  const {document}=parseHTML(await read(page));assert.equal(document.documentElement.lang,'zh-CN');assert.equal(document.querySelectorAll('h1').length,1);
  const base=new URL(page,'https://example.test/yumama/');
  for(const el of document.querySelectorAll('[src],[href]')){
   const raw=el.getAttribute('src')||el.getAttribute('href');if(!raw)continue;
   const target=new URL(raw,base);
   if(target.origin!==base.origin){assert.equal(el.tagName,'A',`Remote runtime asset: ${raw}`);continue;}
   assert.ok(target.pathname.startsWith('/yumama/'),raw);
   let local=path.join(root,'dist',decodeURIComponent(target.pathname.slice('/yumama/'.length)));
   if(target.pathname.endsWith('/'))local=path.join(local,'index.html');
   await access(local);
   if(target.hash){const {document:linked}=parseHTML(await readFile(local,'utf8'));assert.ok(linked.getElementById(target.hash.slice(1)),`Missing anchor ${raw}`);}
  }
 }
 for(const r of recipes){const coverage=[...new Set(r.steps.flatMap(s=>s.sourceSteps))].sort((a,b)=>a-b);assert.deepEqual(coverage,Array.from({length:r.gallery.length},(_,i)=>i+1));const {document}=parseHTML(await read(`recipes/${r.slug}/index.html`));assert.equal(document.querySelectorAll('.recipe-step').length,r.steps.length);assert.equal(document.querySelectorAll('[data-ingredient]').length,r.ingredients.length);}
});
test('44 local JPG files match source manifest hashes',async()=>{
 const assets=JSON.parse(await readFile(path.join(root,'data/image-sources.json'),'utf8'));assert.equal(assets.length,44);
 for(const asset of assets){const bytes=await readFile(path.join(root,'public',asset.path));assert.equal(bytes[0],0xff);assert.equal(bytes[1],0xd8);assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal((await stat(path.join(root,'dist',asset.path))).size,asset.bytes);}
});
test('homepage filters by ingredient, category and saved recipe, with empty recovery',async()=>{
 const h=await setup('index.html');const visible=()=>[...h.document.querySelectorAll('.recipe-card')].filter(x=>!x.hidden);
 assert.equal(visible().length,3);h.input('#search','黄油');assert.equal(visible().length,1);
 h.click('[data-filter="鱼鲜"]');assert.equal(visible().length,0);assert.equal(h.document.querySelector('#empty').hidden,false);
 h.click('#clear-search');assert.equal(visible().length,3);
 h.click('[data-favorite="103730028"]');h.click('[data-filter="saved"]');assert.equal(visible().length,1);assert.equal(visible()[0].dataset.id,'103730028');
 h.click('[data-favorite="103730028"]');assert.equal(visible().length,0);
});
test('ingredients, cooking position, completion, and large type survive a page reload',async()=>{
 const h=await setup();h.change('[data-ingredient="0"]',true);h.click('[data-start-cooking]');assert.equal(h.dialog.open,true);
 h.click('#large-text');h.click('#next-step');assert.match(h.document.querySelector('#cook-position').textContent,/第 2 步/);h.click('#close-cooking');assert.equal(h.dialog.open,false);
 const reloaded=await setup(undefined,Object.fromEntries(h.values));assert.equal(reloaded.document.querySelector('[data-ingredient="0"]').checked,true);reloaded.click('[data-start-cooking]');assert.match(reloaded.document.querySelector('#cook-position').textContent,/第 2 步/);assert.equal(reloaded.document.querySelector('#large-text').getAttribute('aria-pressed'),'true');
 for(let i=1;i<7;i++)reloaded.click('#next-step');assert.equal(reloaded.dialog.open,false);assert.match(reloaded.document.querySelector('#resume-note').textContent,/已经完成/);
 reloaded.click('[data-start-cooking]');assert.match(reloaded.document.querySelector('#cook-position').textContent,/第 1 步/);assert.equal(reloaded.document.querySelector('#previous-step').disabled,true);
 reloaded.click('#close-cooking');reloaded.click('#reset-ingredients');assert.equal(reloaded.document.querySelector('[data-ingredient="0"]').checked,false);
});
test('timer starts, pauses, resumes, restores after reload, expires and resets',async()=>{
 const h=await setup();h.click('[data-timer-step="0"]');assert.equal(h.document.querySelector('#timer-display').textContent,'20:00');
 // state.secondsLeft uses real Date by default; pass a deterministic Date.now for the imported helper through VM.
 h.context.secondsLeft=(timer)=>state.secondsLeft(timer,h.clock.now);
 h.clock.now+=60000;h.tick();assert.equal(h.document.querySelector('#timer-display').textContent,'19:00');
 h.click('#timer-pause');h.clock.now+=300000;h.tick();assert.equal(h.document.querySelector('#timer-display').textContent,'19:00');
 h.click('#timer-pause');const saved=JSON.parse(h.values.get(state.KEY+'103730028:timer'));assert.equal(saved.deadline,h.clock.now+1140000);
 h.click('[data-start-cooking]');assert.equal(h.document.querySelector('#timer-panel').closest('dialog'),h.dialog);h.click('#close-cooking');assert.equal(h.document.querySelector('#timer-panel').closest('dialog'),null);
 const reloaded=await setup(undefined,Object.fromEntries(h.values));reloaded.context.secondsLeft=timer=>state.secondsLeft(timer,h.clock.now);h.clock.now=saved.deadline+1000;reloaded.tick();assert.equal(reloaded.document.querySelector('#timer-display').textContent,'00:00');assert.match(reloaded.document.querySelector('#timer-status').textContent,/计时结束/);
 reloaded.click('#timer-cancel');assert.equal(reloaded.document.querySelector('#timer-panel').hidden,true);assert.equal(JSON.parse(reloaded.values.get(state.KEY+'103730028:timer')),null);
});
test('storage failure and malformed or out-of-range state are contained',()=>{
 let errors=0;const store=state.createStorage(()=>{throw Error('denied');},()=>errors++);assert.equal(store.read('a',null),null);assert.equal(store.write('a',{}),false);assert.equal(errors,1);
 assert.deepEqual(state.normalizeProgress({ingredients:[0,0,99,'1'],done:[2,-1,8],current:999,large:'yes'},2,3),{ingredients:[0],done:[2],current:2,large:false});
 assert.deepEqual(state.normalizeProgress(null,2,3),{ingredients:[],done:[],current:0,large:false});
 assert.equal(state.normalizeTimer({step:0,duration:60,remaining:60,deadline:'broken'},7),null);assert.equal(state.normalizeTimer({step:99,duration:60,remaining:60,deadline:null},7),null);
 assert.deepEqual(state.normalizeFavorites(['123','123',null,'bad']),['123']);
});
test('wake lock handles unsupported browsers, acquired lock, close race and rejection',async()=>{
 const unsupported=await setup();unsupported.click('[data-start-cooking]');unsupported.click('#wake-lock');assert.match(unsupported.document.querySelector('#wake-status').textContent,/不支持/);
 let released=0;let resolve;const lock={release:async()=>{released++;},addEventListener(){}};
 const supported=await setup(undefined,{}, {wakeLock:{request:()=>new Promise(r=>resolve=r)}});Object.defineProperty(supported.document,'visibilityState',{value:'visible',configurable:true});
 supported.click('[data-start-cooking]');supported.click('#wake-lock');supported.click('#close-cooking');resolve(lock);await new Promise(r=>setImmediate(r));assert.equal(released,1);assert.equal(supported.document.querySelector('#wake-lock').getAttribute('aria-pressed'),'false');
 const rejected=await setup(undefined,{}, {wakeLock:{request:async()=>{throw Error('denied');}}});Object.defineProperty(rejected.document,'visibilityState',{value:'visible',configurable:true});rejected.click('[data-start-cooking]');rejected.click('#wake-lock');await new Promise(r=>setImmediate(r));assert.match(rejected.document.querySelector('#wake-status').textContent,/无法保持常亮/);
});
