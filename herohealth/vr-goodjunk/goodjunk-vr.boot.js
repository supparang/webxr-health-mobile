// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (Fair Pack + AI Hooks)
// ✅ Adds view classes (pc/mobile/vr/cvr)
// ✅ Attaches AI hooks (play=coach ON, research=observe)
// ✅ Boots safe.js (goodjunk.safe.js)

import { boot as engineBoot } from './goodjunk.safe.js';
import { attachAIHooks } from '../vr/ai-hooks.js';

const WIN = window;
const DOC = document;

const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };

function normView(v){
  v = String(v||'').toLowerCase();
  if(v === 'cardboard') return 'vr';
  if(v === 'view-cvr' || v === 'cvr') return 'cvr';
  if(v === 'vr') return 'vr';
  if(v === 'pc') return 'pc';
  return 'mobile';
}

function setBodyView(view){
  const b = DOC.body;
  b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  b.classList.add(
    view === 'pc' ? 'view-pc' :
    view === 'vr' ? 'view-vr' :
    view === 'cvr'? 'view-cvr' : 'view-mobile'
  );
}

function inferMode(run){
  run = String(run||'play').toLowerCase();
  // research/study => observe only
  return (run === 'research' || run === 'study') ? 'research' : 'play';
}

function main(){
  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = Number(qs('time','80')) || 80;
  const seed = String(qs('seed', Date.now()));

  setBodyView(view);

  // ✅ AI Prediction hooks
  attachAIHooks({ mode: inferMode(run) });

  // ✅ Boot SAFE engine
  engineBoot({ view, run, diff, time, seed });
}

if(DOC.readyState === 'complete' || DOC.readyState === 'interactive'){
  setTimeout(main, 0);
}else{
  DOC.addEventListener('DOMContentLoaded', main, { once:true });
}