import {createStorage,normalizeProgress,normalizeFavorites,normalizeTimer,secondsLeft,formatTime,matchesRecipe} from './state.mjs';
document.documentElement.classList.add('js');
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>[...root.querySelectorAll(s)];
let toastTimeout;
function toast(message) {const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),4200);}
const storage=createStorage(()=>localStorage,()=>toast('浏览器无法保存进度，本次仍可正常使用。'));
let favorites=normalizeFavorites(storage.read('favorites',[]));
function renderFavorites(){
  $$('[data-favorite]').forEach(b=>{const saved=favorites.includes(b.dataset.favorite);b.setAttribute('aria-pressed',String(saved));b.textContent=b.classList.contains('icon-button')?(saved?'♥':'♡'):(saved?'♥ 已收藏':'♡ 收藏');const name=b.closest('.recipe-card')?.querySelector('h3')?.textContent||document.title.split(' · ')[0];b.setAttribute('aria-label',`${saved?'取消收藏':'收藏'}${name}`);});
}
let applyFilters=()=>{};
$$('[data-favorite]').forEach(b=>b.addEventListener('click',()=>{const id=b.dataset.favorite;favorites=favorites.includes(id)?favorites.filter(x=>x!==id):[...favorites,id];storage.write('favorites',favorites);renderFavorites();applyFilters();}));renderFavorites();
if ($('#search')) {
 let category=new URLSearchParams(location.search).get('view')==='saved'?'saved':'all';
 applyFilters=()=>{let visible=0;$$('.recipe-card').forEach(card=>{const show=matchesRecipe(card.dataset,$('#search').value,category,favorites);card.hidden=!show;if(show)visible++;});$('#empty').hidden=visible>0;$('#search-status').textContent=`找到 ${visible} 道菜谱`;$$('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===category)));};
 $$('[data-filter]').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.filter;applyFilters();}));
 $('#search').addEventListener('input',applyFilters);$('#clear-search').addEventListener('click',()=>{category='all';$('#search').value='';applyFilters();$('#search').focus();});applyFilters();
}
const dataElement=$('#recipe-data');
if (dataElement) initRecipe(JSON.parse(dataElement.textContent));
function initRecipe(recipe) {
 const progressKey=recipe.contentRevision?`${recipe.id}:revision-${recipe.contentRevision}`:recipe.id;
 const storedProgress=storage.read(progressKey,null);
 const legacy=recipe.contentRevision&&storedProgress===null?storage.read(recipe.id,null):null;
 let progress=normalizeProgress(storedProgress??(legacy?{ingredients:legacy.ingredients,large:legacy.large}:{}),recipe.ingredients.length,recipe.steps.length);
 // Step numbers change when an abridged recipe is restored. Keep ingredients,
 // but never attach an old step position or timer to a different source step.
 let timer=normalizeTimer(storage.read(`${progressKey}:timer`,null),recipe.steps.length);
 if(legacy){storage.write(progressKey,progress);toast('菜谱已恢复原始步骤，食材勾选已保留，步骤进度从头开始。');}
 let timerAnnounced=false;
 const dialog=$('#cooking-dialog');const timerPanel=$('#timer-panel');
 const persist=()=>storage.write(progressKey,progress);
 function updateProgress(){
  $$('[data-ingredient]').forEach(el=>{el.checked=progress.ingredients.includes(Number(el.dataset.ingredient));});
  $('#ingredient-count').textContent=`${progress.ingredients.length} / ${recipe.ingredients.length}`;
  $$('[data-step-done]').forEach(el=>{const done=progress.done.includes(Number(el.dataset.stepDone));el.setAttribute('aria-pressed',String(done));el.setAttribute('aria-label',`${done?'取消完成':'标记完成'}第 ${Number(el.dataset.stepDone)+1} 步`);});
  const complete=progress.done.length===recipe.steps.length;
  $('#resume-note').textContent=complete?'这道菜已经完成，点击开始可再做一次。':progress.done.length||progress.current?`上次做到第 ${progress.current+1} 步，打开后继续。`:'食材勾选和烹饪进度会保存在这台设备上。';
  $('#cook-progress-label').textContent=complete?'这道菜完成了':progress.done.length||progress.current?`继续第 ${progress.current+1} 步`:'准备好了？';
 }
 $$('[data-ingredient]').forEach(el=>el.addEventListener('change',()=>{const i=Number(el.dataset.ingredient);progress.ingredients=el.checked?[...new Set([...progress.ingredients,i])]:progress.ingredients.filter(x=>x!==i);persist();updateProgress();}));
 $('#reset-ingredients').addEventListener('click',()=>{progress.ingredients=[];persist();updateProgress();});
 $$('[data-step-done]').forEach(el=>el.addEventListener('click',()=>{const i=Number(el.dataset.stepDone);progress.done=progress.done.includes(i)?progress.done.filter(x=>x!==i):[...progress.done,i];persist();updateProgress();}));
 $('#print').addEventListener('click',()=>window.print());
 function renderStep(focus=false){
  const i=progress.current,s=recipe.steps[i];
  $('#cook-position').textContent=`第 ${i+1} 步，共 ${recipe.steps.length} 步`;
  $('#cook-progress').value=i+1;$('#cook-step-number').textContent=`STEP ${String(i+1).padStart(2,'0')}`;
  $('#cook-title').textContent=s.title;$('#cook-text').textContent=s.text;$('#cook-image').src=`../../${s.image}`;$('#cook-image').alt=`${recipe.title}：${s.title}`;
  $('#previous-step').disabled=i===0;$('#next-step').textContent=i===recipe.steps.length-1?'完成这道菜 ✓':'完成，下一步 →';
  $('#cook-timer').hidden=!s.timerSeconds;$('#cook-timer').textContent=`◷ 开始 ${s.timerSeconds/60} 分钟计时`;
  $('.cook-content').classList.toggle('large',progress.large);$('#large-text').setAttribute('aria-pressed',String(progress.large));
  updateProgress();if(focus){dialog.scrollTop=0;$('#cook-title').focus({preventScroll:true});}
 }
 let opener;
 $$('[data-start-cooking]').forEach(b=>b.addEventListener('click',()=>{
  if(typeof dialog.showModal!=='function'){toast('当前浏览器不支持烹饪模式，请直接阅读下方步骤。');return;}
  opener=b;if(progress.done.length===recipe.steps.length){progress.current=0;progress.done=[];persist();}
  $('.cook-settings').after(timerPanel);renderStep();dialog.showModal();renderStep(true);
 }));
 $('#close-cooking').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{document.body.append(timerPanel);releaseWake();opener?.focus({preventScroll:true});updateProgress();});
 $('#previous-step').addEventListener('click',()=>{progress.current=Math.max(0,progress.current-1);persist();renderStep(true);});
 $('#next-step').addEventListener('click',()=>{progress.done=[...new Set([...progress.done,progress.current])];if(progress.current===recipe.steps.length-1){persist();dialog.close();toast('完成啦，趁热开饭！');}else{progress.current++;persist();renderStep(true);}});
 $('#large-text').addEventListener('click',()=>{progress.large=!progress.large;persist();renderStep();});
 const timerKey=`${progressKey}:timer`;
 function saveTimer(){storage.write(timerKey,timer);}
 function startTimer(index){
  const duration=recipe.steps[index].timerSeconds;if(!duration)return;
  if(timer&&secondsLeft(timer)>0&&!window.confirm('已有计时正在进行，替换为这一步的计时？'))return;
  timer={step:index,duration,remaining:duration,deadline:Date.now()+duration*1000};timerAnnounced=false;saveTimer();renderTimer();
 }
 function renderTimer(){
  timerPanel.hidden=!timer;if(!timer)return;
  const seconds=secondsLeft(timer);const finished=seconds===0;
  $('#timer-display').textContent=formatTime(seconds);$('#timer-label').textContent=`${recipe.steps[timer.step].title}${finished?' · 时间到':timer.deadline===null?' · 已暂停':''}`;
  $('#timer-pause').textContent=finished?'重新计时':timer.deadline===null?'继续':'暂停';
  $('#timer-cancel').setAttribute('aria-label',finished?'关闭计时器':'取消计时');timerPanel.classList.toggle('finished',finished);
  if(finished&&!timerAnnounced){$('#timer-status').textContent='计时结束，请查看锅中状态。';timerAnnounced=true;}else if(!finished){$('#timer-status').textContent='';}
 }
 $$('[data-timer-step]').forEach(b=>b.addEventListener('click',()=>startTimer(Number(b.dataset.timerStep))));
 $('#cook-timer').addEventListener('click',()=>startTimer(progress.current));
 $('#timer-pause').addEventListener('click',()=>{if(!timer)return;const left=secondsLeft(timer);if(left===0){timer.remaining=timer.duration;timer.deadline=Date.now()+timer.duration*1000;timerAnnounced=false;}else if(timer.deadline!==null){timer.remaining=left;timer.deadline=null;}else{timer.deadline=Date.now()+left*1000;}saveTimer();renderTimer();});
 $('#timer-cancel').addEventListener('click',()=>{timer=null;saveTimer();renderTimer();});
 setInterval(renderTimer,1000);renderTimer();
 let wake=null,wakeWanted=false,wakePending=false;
 async function acquireWake(){
  if(!wakeWanted||wakePending||wake||!dialog.open||document.visibilityState!=='visible')return;
  if(!navigator.wakeLock){wakeWanted=false;$('#wake-status').textContent='此浏览器不支持常亮';return;}
  wakePending=true;
  try{
   const lock=await navigator.wakeLock.request('screen');
   if(!wakeWanted||!dialog.open){await lock.release();return;}
   wake=lock;$('#wake-lock').setAttribute('aria-pressed','true');$('#wake-status').textContent='屏幕常亮已开启';
   lock.addEventListener('release',()=>{if(wake!==lock)return;wake=null;$('#wake-lock').setAttribute('aria-pressed','false');$('#wake-status').textContent=wakeWanted?'常亮已暂停，返回页面后重试':'';});
  }catch{wakeWanted=false;$('#wake-lock').setAttribute('aria-pressed','false');$('#wake-status').textContent='无法保持常亮，请检查浏览器或省电设置';}
  finally{wakePending=false;}
 }
 function releaseWake(){wakeWanted=false;if(wake){wake.release().catch(()=>{});wake=null;}$('#wake-lock').setAttribute('aria-pressed','false');$('#wake-status').textContent='';}
 $('#wake-lock').addEventListener('click',()=>{if(wakeWanted){releaseWake();}else{wakeWanted=true;acquireWake();}});
 document.addEventListener('visibilitychange',()=>{renderTimer();if(document.visibilityState==='visible')acquireWake();});
 window.addEventListener('pagehide',releaseWake);updateProgress();
}
