// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — PRODUCTION (PATCHED)
// ✅ Parses query: view/run/diff/time/seed/hub
// ✅ Sets body classes: view-mobile / view-cvr / view-cardboard
// ✅ Calls goodjunk.safe.js boot({view,run,diff,time,seed})
// ✅ Triggers gj:measureSafe multiple times (after UI mounts)
// ✅ Safe: no crash if some modules absent

'use strict';

import { boot as bootGoodJunk } from './goodjunk.safe.js';

const WIN = window;
const DOC = document;

const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
const emit = (n,d)=>{ try{ WIN.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} };

function normView(v){
  v = String(v||'').toLowerCase();
  if(!v || v==='auto') return 'mobile';
  if(v==='cvr' || v==='cardboard' || v==='vr') return v;
  if(v==='pc' || v==='desktop') return 'pc';
  return v;
}

function setBodyViewClasses(view){
  try{
    DOC.body.classList.remove('view-mobile','view-cvr','view-cardboard','view-pc');
    if(view === 'cvr') DOC.body.classList.add('view-cvr');
    else if(view === 'cardboard' || view === 'vr') DOC.body.classList.add('view-cardboard');
    else if(view === 'pc') DOC.body.classList.add('view-pc');
    else DOC.body.classList.add('view-mobile');
  }catch(_){}
}

function updateChipMeta(view, run, diff, time){
  const el = DOC.getElementById('gjChipMeta');
  if(!el) return;
  el.textContent = `view=${view} · run=${run} · diff=${diff} · time=${time}`;
}

function multiMeasureSafe(){
  // ยิงหลายครั้ง เพราะ VR UI / font / layout อาจโผล่ช้า
  emit('gj:measureSafe', {});
  setTimeout(()=>emit('gj:measureSafe', {}), 80);
  setTimeout(()=>emit('gj:measureSafe', {}), 220);
  setTimeout(()=>emit('gj:measureSafe', {}), 520);
  setTimeout(()=>emit('gj:measureSafe', {}), 980);
}

function main(){
  const view = normView(qs('view','mobile'));
  const run  = String(qs('run','play')).toLowerCase();
  const diff = String(qs('diff','normal')).toLowerCase();
  const time = clamp(Number(qs('time','80'))||80, 20, 300);
  const seed = String(qs('seed', Date.now()));
  const hub  = qs('hub', null);

  setBodyViewClasses(view);
  updateChipMeta(view, run, diff, time);

  // ให้ปุ่มกลับ hub ใช้ค่า hub ถ้ามี
  const btnBack = DOC.getElementById('btnBackHub');
  if(btnBack){
    btnBack.onclick = ()=>{
      if(hub) location.href = hub;
      else alert('ยังไม่ได้ใส่ hub url');
    };
  }

  // Measure safe early + after UI mounts
  multiMeasureSafe();
  WIN.addEventListener('resize', multiMeasureSafe, {passive:true});
  WIN.addEventListener('orientationchange', multiMeasureSafe, {passive:true});

  // Start game
  try{
    bootGoodJunk({ view, run, diff, time, seed });
  }catch(err){
    console.error('[GoodJunkVR] boot failed:', err);
    // กันจอดำ: อย่างน้อยให้ user เห็นใน console
    emit('hha:error', { game:'GoodJunkVR', error:String(err?.message||err) });
  }

  // อีกทีหลังเริ่ม (ป้องกัน quest/boss/progress เปลี่ยน layout)
  setTimeout(multiMeasureSafe, 250);
}

if(DOC.readyState === 'loading'){
  DOC.addEventListener('DOMContentLoaded', main, {once:true});
}else{
  main();
}