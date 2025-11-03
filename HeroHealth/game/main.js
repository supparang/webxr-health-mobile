// === Hero Health Academy — /game/main.js (STABLE TIMER + COUNTDOWN + HARD 1s TICK) ===
'use strict';
if (window.__HHA_MAIN_LOADED__) {
  // ป้องกันโหลดซ้ำกรณี index เคย include module ค้าง
  console.warn('[HHA] main.js already loaded — skipping duplicate');
} else {
  window.__HHA_MAIN_LOADED__ = true;
}

import { HUD }        from './core/hud.js';
import { Coach }      from './core/coach.js';
import { ScoreSystem }from './core/score.js';
import { SFX }        from './core/sfx.js';
import { Quests }     from './core/quests.js';
import { Progress }   from './core/progression.js';

const MODE = (k)=>import(`./modes/${k}.js`);
const TIME_BY_MODE = { goodjunk:45, groups:60, hydration:50, plate:55 };
const $=(s)=>document.querySelector(s);

function matchTime(mode,diff){
  const base = TIME_BY_MODE[mode] ?? 45;
  if (diff==='Easy') return base+5;
  if (diff==='Hard') return Math.max(20, base-5);
  return base;
}

// --------- Builtin emergency spawner (กันเงียบ) ----------
function BuiltinGoodJunk(){
  let alive=false, t=0, host=null, interval=0.65;
  function H(){ host=document.getElementById('spawnHost')||document.body; }
  function spawn(bus){
    H();
    const good=Math.random()<0.72, golden=Math.random()<0.12;
    const G=['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍇'], B=['🍔','🍟','🍕','🍩','🍫','🥤'];
    const glyph=golden?'🌟':(good?G[Math.random()*G.length|0]:B[Math.random()*B.length|0]);
    const d=document.createElement('button'); d.type='button'; d.textContent=glyph;
    Object.assign(d.style,{position:'fixed',left:(56+Math.random()*(innerWidth-112))+'px',top:(96+Math.random()*(innerHeight-240))+'px',transform:'translate(-50%,-50%)',font:`900 ${golden?64:54}px ui-rounded`,border:0,background:'transparent',filter:'drop-shadow(0 6px 16px rgba(0,0,0,.55))',cursor:'pointer',zIndex:5500});
    const life=1700;
    const to=setTimeout(()=>{ try{d.remove();}catch{}; if(good) bus?.miss?.({source:'good-timeout'}); }, life);
    d.addEventListener('click',(ev)=>{ clearTimeout(to); try{d.remove();}catch{}; if(good){ const perfect=golden||Math.random()<0.2; const pts=perfect?200:100; bus?.hit?.({kind:perfect?'perfect':'good',points:pts,ui:{x:ev.clientX,y:ev.clientY},meta:{good:1,golden:golden?1:0}});} else { bus?.bad?.({source:'junk-click'});} },{passive:true});
    host.appendChild(d);
  }
  return {
    start(){ alive=true; t=0; H(); for(let i=0;i<3;i++) spawn(busFor()); },
    update(dt,bus){ if(!alive) return; t+=dt; while(t>=interval){ t-=interval; spawn(bus); } },
    setFever(){}, cleanup(){ alive=false; try{ (document.getElementById('spawnHost')||{}).innerHTML=''; }catch{} }
  };
}

// --------- Runtime State ----------
const R = {
  playing:false, paused:false,
  modeKey:'goodjunk', diff:'Normal',
  matchTime:45,
  startAtMs:0,
  remain:45,
  lastSecShown:-1,
  fever:false, feverBreaks:0,
  sys:{ score:null, sfx:null },
  hud:null, coach:null,
  modeAPI:null, modeInst:null,
  _raf:0, _lastRAF:0, _idleMark:0,
  _usingBuiltin:false,
  _hardTick:null
};

function setTopHUD(){
  R.hud?.setTop({mode:R.modeKey, diff:R.diff});
  R.hud?.setTimer(R.remain|0);
  R.hud?.updateHUD(R.sys.score?.get?.()||0, R.sys.score?.combo|0);
}

function feverOn(){
  if(R.fever) return;
  R.fever=true; R.feverBreaks=0;
  R.hud?.showFever(true);
  R.sys.sfx?.fever?.(true);
  R.modeAPI?.setFever?.(true);
  Quests?.event?.('fever',{on:true});
}
function feverOff(){
  if(!R.fever) return;
  R.fever=false; R.feverBreaks=0;
  R.hud?.showFever(false);
  R.sys.sfx?.fever?.(false);
  R.modeAPI?.setFever?.(false);
  Quests?.event?.('fever',{on:false});
}

function busFor(){
  return {
    sfx:R.sys.sfx,
    hit:(e)=>{
      R._idleMark = performance.now();
      const pts = e?.points|0;
      if (pts) R.sys.score.add(pts, { kind: e?.kind||'good' });
      R.sys.score.combo=(R.sys.score.combo|0)+1;
      if(R.sys.score.combo>(R.sys.score.bestCombo|0)) R.sys.score.bestCombo=R.sys.score.combo;
      if(!R.fever && (R.sys.score.combo|0)>=10) feverOn();
      if (e?.ui) R.hud?.showFloatingText(e.ui.x, e.ui.y, `+${pts}`);
      Quests?.event?.('hit',{...e, pointsAccum:R.sys.score.get(), comboNow:R.sys.score.combo});
      setTopHUD();
    },
    miss:(info)=>{
      R._idleMark = performance.now();
      if(R.fever && ++R.feverBreaks>=3) feverOff();
      R.sys.score.combo=0;
      R.coach?.onMiss?.();
      Quests?.event?.('miss', info||{});
      setTopHUD();
    },
    bad:(info)=>{
      R._idleMark = performance.now();
      if(R.fever && ++R.feverBreaks>=3) feverOff();
      R.sys.sfx?.bad?.();
      R.sys.score.combo=0;
      R.coach?.onJunk?.();
      Quests?.event?.('junk', info||{});
      setTopHUD();
    },
    power:(kind)=>{
      R._idleMark = performance.now();
      R.sys.sfx?.power?.();
      Quests?.event?.('power',{kind});
      setTopHUD();
    }
  };
}

// --------- Main step (RAF + wall-clock) ----------
function step(nowMs){
  if(!R.playing || R.paused) return;

  const elapsed = Math.max(0, (nowMs - R.startAtMs)/1000);
  const remain  = Math.max(0, R.matchTime - Math.floor(elapsed));
  R.remain = remain|0;

  if ((R.remain|0) !== (R.lastSecShown|0)) {
    R.lastSecShown = R.remain|0;
    R.hud?.setTimer(R.remain);
    if (R.remain===10) R.coach?.onTimeLow?.();
    Quests?.tick?.({ score:R.sys.score.get?.()||0, dt:1, fever:R.fever });
  }

  const dt = Math.max(0, (nowMs - (R._lastRAF||nowMs))/1000);
  R._lastRAF = nowMs;
  try { R.modeAPI?.update?.(dt, busFor()); } catch(e){ console.warn('[mode.update]', e); }
  try { R.modeInst?.update?.(dt, busFor()); } catch(e){ console.warn('[inst.update]', e); }

  if (R.remain<=0) return endGame();

  if (nowMs - (R._idleMark||nowMs) > 1200) {
    try { R.modeAPI?.update?.(0.9, busFor()); R.modeInst?.update?.(0.9, busFor()); } catch{}
    R._idleMark = nowMs;
  }
}

function loop(now){ if (R.playing) step(now); R._raf = requestAnimationFrame(loop); }

// --------- Hard 1s tick (กัน throttle) ----------
function startHardTick(){
  stopHardTick();
  const tick = ()=>{ if(R.playing && !R.paused){ step(performance.now()); } R._hardTick = setTimeout(tick, 1000); };
  R._hardTick = setTimeout(tick, 1000);
}
function stopHardTick(){ if (R._hardTick){ clearTimeout(R._hardTick); R._hardTick=null; } }

// --------- 3-2-1-GO ----------
function countdownThen(cb){
  const seq=['3','2','1','GO!'];
  let i=0;
  const run=()=>{
    R.hud?.showBig(seq[i]);
    if (seq[i]==='GO!'){ setTimeout(cb, 340); }
    else { setTimeout(()=>{ i++; run(); }, 480); }
  };
  run();
}

// --------- Start / End ----------
async function startGame(){
  if (window.HHA?._busy) return;
  window.HHA = window.HHA || {};
  window.HHA._busy = true;

  Progress?.init?.();

  R.modeKey = document.body.getAttribute('data-mode') || 'goodjunk';
  R.diff    = document.body.getAttribute('data-diff') || 'Normal';
  R.matchTime = matchTime(R.modeKey, R.diff);
  R.remain = R.matchTime|0;
  R.lastSecShown = -1;
  R.fever=false; R.feverBreaks=0; R._idleMark = performance.now();

  R.hud   = new HUD();
  R.hud.hideResult?.(); R.hud.resetBars?.(); R.hud.setTop?.({mode:R.modeKey, diff:R.diff}); R.hud.setTimer?.(R.remain); R.hud.updateHUD?.(0,0);
  R.sys.score = new ScoreSystem(); R.sys.score.reset?.();
  R.sys.sfx   = new SFX();
  R.coach     = new Coach({ lang:(localStorage.getItem('hha_lang')||'TH') });

  Quests?.bindToMain?.({ hud:R.hud, coach:R.coach });
  Quests?.beginRun?.(R.modeKey, R.diff, (localStorage.getItem('hha_lang')||'TH'), R.matchTime);
  R.coach?.onStart?.();

  let api=null;
  try { api = await MODE(R.modeKey); } catch(e){ console.error('[mode load fail]', e); }
  if (!api || (!api.update && !api.create)) {
    const B = BuiltinGoodJunk();
    api = { update:B.update.bind(B), start:B.start.bind(B), cleanup:B.cleanup.bind(B), setFever:B.setFever.bind(B) };
    R._usingBuiltin = true;
  } else {
    R._usingBuiltin = false;
  }
  R.modeAPI = api;

  if (api?.create) { try { R.modeInst = api.create({ engine:{}, hud:R.hud, coach:R.coach }); R.modeInst?.start?.({ time:R.matchTime, difficulty:R.diff }); } catch{} }
  if (api?.start)  { try { api.start({ time:R.matchTime, difficulty:R.diff }); } catch{} }

  for (let i=0;i<3;i++) { try { api?.update?.(0.35, busFor()); } catch{} }

  document.body.setAttribute('data-playing','1');
  const mb = $('#menuBar'); if (mb){ mb.setAttribute('data-hidden','1'); mb.style.display='none'; }

  countdownThen(()=>{
    R.playing = true; R.paused=false;
    R.startAtMs = performance.now();
    R._lastRAF  = R.startAtMs;
    setTopHUD();

    cancelAnimationFrame(R._raf);
    R._raf = requestAnimationFrame(loop);

    startHardTick(); // <<< ฮาร์ดทิกเริ่มทำงาน

    setTimeout(()=>{
      if (!R._usingBuiltin && (R.sys.score.get?.()||0)===0){
        const B = BuiltinGoodJunk();
        try { B.start({}); } catch{}
        R.modeAPI = { update:B.update.bind(B), start:B.start.bind(B), cleanup:B.cleanup.bind(B), setFever:B.setFever.bind(B) };
        R.modeInst = null;
        R._usingBuiltin = true;
        R.hud?.toast?.('Fallback mode active');
      }
    }, 2500);
  });

  window.HHA._busy = false;
}

function endGame(){
  if (!R.playing) return;
  R.playing=false;

  stopHardTick();
  cancelAnimationFrame(R._raf);

  try{ R.modeInst?.cleanup?.(); R.modeAPI?.cleanup?.(); }catch{}

  const score = R.sys.score?.get?.()||0;
  const bestC = R.sys.score?.bestCombo|0;
  const stars=(score>=2000)?5:(score>=1500)?4:(score>=1000)?3:(score>=600)?2:(score>=200)?1:0;
  const qsum = Quests?.endRun?.({ score }) || { list:[], totalDone:0 };

  R.hud?.showResult?.({
    title:'Result',
    desc:`Mode: ${R.modeKey} • Diff: ${R.diff}\n⭐ ${'★'.repeat(stars)}${'☆'.repeat(5-stars)}`,
    stats:[`Score: ${score}`, `Best Combo: ${bestC}`, `Time: ${R.matchTime|0}s`],
    extra:(qsum.list||[]).map(q=>`${q.done?'✔':(q.fail?'✘':'…')} ${q.label} (${q.progress||0}/${q.need||0})`)
  });

  R.hud.onHome = ()=>{ R.hud.hideResult?.(); document.body.removeAttribute('data-playing'); feverOff(); const mb=$('#menuBar'); if(mb){ mb.removeAttribute('data-hidden'); mb.style.display='flex'; } };
  R.hud.onRetry= ()=>{ R.hud.hideResult?.(); feverOff(); startGame(); };

  R.coach?.onEnd?.(score);
  Progress?.endRun?.({ score, bestCombo:bestC });
}

function setPaused(on){
  if (!R.playing) return;
  R.paused = !!on;
  if (R.paused){ R.sys.sfx?.fever?.(false); R.hud?.toast?.('Paused'); }
  else { R._lastRAF = performance.now(); R._idleMark = R._lastRAF; R.hud?.toast?.('Resume'); }
}

// Expose
window.HHA = window.HHA || {};
window.HHA.startGame = startGame;
window.HHA.endGame   = endGame;
window.HHA.pause     = ()=>setPaused(true);
window.HHA.resume    = ()=>setPaused(false);

// canvases never block UI
setTimeout(()=>{ document.querySelectorAll('canvas').forEach(c=>{ try{ c.style.pointerEvents='none'; c.style.zIndex='1'; }catch{} }); },0);

// quick keyboard start
window.addEventListener('keydown',(e)=>{
  if((e.key==='Enter'||e.key===' ') && !R.playing){
    const menuVisible = !document.getElementById('menuBar')?.hasAttribute('data-hidden');
    if(menuVisible){ e.preventDefault(); startGame(); }
  }
},{passive:false});

// version ping
try { window.__HHA_VER = 'main-stable-hardtick-2025-11-02'; } catch {}
