export const KEY = 'yumama:v1:';
export function normalizeProgress(value, ingredientCount, stepCount) {
  const raw = value && typeof value === 'object' ? value : {};
  const indices = (items, size) => Array.isArray(items) ? [...new Set(items.filter(i=>Number.isInteger(i)&&i>=0&&i<size))] : [];
  return { ingredients:indices(raw.ingredients,ingredientCount), done:indices(raw.done,stepCount), current:Number.isInteger(raw.current)?Math.max(0,Math.min(raw.current,stepCount-1)):0, large:raw.large===true };
}
export function normalizeFavorites(value) {
  return Array.isArray(value) ? [...new Set(value.filter(x=>typeof x==='string' && /^\d+$/.test(x)))] : [];
}
export function normalizeTimer(value, stepCount) {
  if (!value || !Number.isInteger(value.step) || value.step<0 || value.step>=stepCount) return null;
  if (!Number.isFinite(value.duration) || value.duration<=0 || value.duration>86400) return null;
  if (value.deadline!==null && (!Number.isFinite(value.deadline) || value.deadline<0)) return null;
  if (!Number.isFinite(value.remaining) || value.remaining<0 || value.remaining>value.duration) return null;
  return {step:value.step,duration:value.duration,deadline:value.deadline,remaining:value.remaining};
}
export function secondsLeft(timer, now=Date.now()) {
  if (!timer) return 0;
  return timer.deadline === null ? timer.remaining : Math.max(0, Math.min(timer.duration,Math.ceil((timer.deadline-now)/1000)));
}
export function formatTime(seconds) { return `${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`; }
export function createStorage(getStorage, onError=()=>{}) {
  let failed = false;
  const fail = () => { if (!failed) { failed=true;onError(); } };
  return {
    read(key,fallback) { try { const value=getStorage().getItem(KEY+key); return value===null?fallback:JSON.parse(value); } catch { fail(); return fallback; } },
    write(key,value) { try { getStorage().setItem(KEY+key,JSON.stringify(value)); return true; } catch { fail(); return false; } }
  };
}
export function matchesRecipe(recipe,query,category,favorites) {
  return (category==='all'||category===recipe.category||(category==='saved'&&favorites.includes(recipe.id))) && recipe.search.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
