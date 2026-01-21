// === /herohealth/hygiene-vr/hygiene-vr.boot.js ===
// HygieneVR Boot — PRODUCTION-lite
// ✅ View modes: pc/mobile/vr/cvr (from ?view=)
// ✅ Starts engine when user presses Start
// ✅ Practice mode 15s (no history write if you want; here we still run normally but shorter)
// ✅ Back to hub via ?hub=

import { createHygieneGame } from './hygiene.safe.js';

const DOC = document;

const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };

function setBodyView(view){
  view = String(view||'').toLowerCase();
  DOC.body.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
  DOC.body.classList.add(view === 'cvr' ? 'view-cvr' : view === 'vr' ? 'view-vr' : view === 'mobile' ? 'view-mobile' : 'view-pc');
}

function hubUrl(){
  const h = qs('hub','');
  return h ? String(h) : '../hub.html';
}

function showParams(){
  const sp = new URL(location.href).searchParams;
  const keys = [];
  sp.forEach((v,k)=>keys.push(`${k}=${v}`));
  const el = DOC.getElementById('paramLine');
  if(el) el.textContent = keys.length ? keys.join(' • ') : '(no query params)';
}

function safeNav(url){
  try{ location.href = url; } catch { location.assign(url); }
}

let GAME = null;

function startGame({ practice=false } = {}){
  const ov = DOC.getElementById('ovStart');
  if(ov) ov.style.display = 'none';

  const opts = {
    stage: DOC.getElementById('stage'),
    targetsEl: DOC.getElementById('targets'),
    ui: {
      kTime: DOC.getElementById('kTime'),
      kScore: DOC.getElementById('kScore'),
      kCombo: DOC.getElementById('kCombo'),
      kMiss: DOC.getElementById('kMiss'),
      bGoal: DOC.getElementById('bGoal'),
      bMini: DOC.getElementById('bMini'),
      bMode: DOC.getElementById('bMode'),
      questText: DOC.getElementById('questText'),
      questHint: DOC.getElementById('questHint'),
      ovEnd: DOC.getElementById('ovEnd'),
      endLine: DOC.getElementById('endLine'),
      endJson: DOC.getElementById('endJson')
    },
    params: {
      view: qs('view','pc'),
      run: (qs('run','play')||'play').toLowerCase(),
      diff: (qs('diff','normal')||'normal').toLowerCase(),
      time: Number(qs('time', practice ? 15 : 70)),
      seed: qs('seed',''),
      chal: qs('chal',''),
      log: qs('log',''),
      hub: hubUrl(),
      studyId: qs('studyId',''),
      phase: qs('phase',''),
      conditionGroup: qs('conditionGroup',''),
      style: qs('style','')
    }
  };

  GAME = createHygieneGame(opts);
  GAME.start();
}

function init(){
  setBodyView(qs('view','pc'));
  showParams();

  DOC.getElementById('btnBackHub')?.addEventListener('click', ()=> safeNav(hubUrl()));
  DOC.getElementById('btnBackHub2')?.addEventListener('click', ()=> safeNav(hubUrl()));

  DOC.getElementById('btnStart')?.addEventListener('click', ()=> startGame({ practice:false }));
  DOC.getElementById('btnPractice')?.addEventListener('click', ()=> startGame({ practice:true }));

  DOC.getElementById('btnPlayAgain')?.addEventListener('click', ()=>{
    // reload same URL but clear overlays
    safeNav(location.href);
  });

  DOC.getElementById('btnCopySummary')?.addEventListener('click', async ()=>{
    try{
      const raw = localStorage.getItem('HHA_LAST_SUMMARY') || '';
      await navigator.clipboard.writeText(raw);
      alert('คัดลอก Summary แล้ว ✅');
    }catch(_){
      alert('Copy ไม่สำเร็จ');
    }
  });
}

init();