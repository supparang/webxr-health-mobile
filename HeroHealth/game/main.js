// === Hero Health Academy — main.js (modes selectable, Start-only, missions + stats + daily, shared FX, Quests HUD) ===
window.__HHA_BOOT_OK = true;

// ----- Imports -----
import * as THREE           from 'https://unpkg.com/three@0.159.0/build/three.module.js';
import { Engine }           from '/webxr-health-mobile/HeroHealth/game/core/engine.js';
import { HUD }              from '/webxr-health-mobile/HeroHealth/game/core/hud.js';
import { Coach }            from '/webxr-health-mobile/HeroHealth/game/core/coach.js';
import { SFX }              from '/webxr-health-mobile/HeroHealth/game/core/sfx.js';
import { ScoreSystem }      from '/webxr-health-mobile/HeroHealth/game/core/score.js';
import { PowerUpSystem }    from '/webxr-health-mobile/HeroHealth/game/core/powerup.js';
import { Progress }         from '/webxr-health-mobile/HeroHealth/game/core/progression.js';
import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';

// ⬇️ NEW: Quests HUD/logic (ทำงานคู่กับ Progress)
import { Quests }           from '/webxr-health-mobile/HeroHealth/game/core/quests.js';

import * as goodjunk        from '/webxr-health-mobile/HeroHealth/game/modes/goodjunk.js';
import * as groups          from '/webxr-health-mobile/HeroHealth/game/modes/groups.js';
import * as hydration       from '/webxr-health-mobile/HeroHealth/game/modes/hydration.js';
import * as plate           from '/webxr-health-mobile/HeroHealth/game/modes/plate.js';

// ----- Helpers -----
const $  = (s)=>document.querySelector(s);
const byAction = (el)=>el?.closest?.('[data-action]')||null;
const setText = (sel, txt)=>{ const el=$(sel); if(el) el.textContent = txt; };

// ----- Config -----
const MODES = { goodjunk, groups, hydration, plate };
const DIFFS = {
  Easy:   { time: 70, spawn: 900, life: 4200 },
  Normal: { time: 60, spawn: 700, life: 3000 },
  Hard:   { time: 50, spawn: 550, life: 1800 }
};
const ICON_SIZE_MAP = { Easy:92, Normal:72, Hard:58 };
const MAX_ITEMS = 10;
const LIVE = new Set();

const I18N = {
  TH:{ names:{goodjunk:'ดี vs ขยะ', groups:'จาน 5 หมู่', hydration:'สมดุลน้ำ', plate:'จัดจานสุขภาพ'},
       diffs:{Easy:'ง่าย', Normal:'ปกติ', Hard:'ยาก'} },
  EN:{ names:{goodjunk:'Good vs Junk', groups:'Food Group Frenzy', hydration:'Hydration', plate:'Healthy Plate'},
       diffs:{Easy:'Easy', Normal:'Normal', Hard:'Hard'} }
};
const T = (lang)=>I18N[lang]||I18N.TH;

// ----- Systems & State -----
const hud   = new HUD();
const sfx   = new SFX();
const score = new ScoreSystem();
const power = new PowerUpSystem();
const eng   = new Engine(THREE, document.getElementById('c'));
const coach = new Coach({ lang: localStorage.getItem('hha_lang') || 'TH' });

// ⬇️ NEW: bind Quests ให้ sync HUD/Coach
const QUEST_BIND = Quests.bindToMain({ hud, coach });

const state = {
  modeKey:'goodjunk',
  difficulty:'Normal',
  running:false,
  paused:false,
  timeLeft:60,
  lang: localStorage.getItem('hha_lang') || 'TH',
  gfx:  localStorage.getItem('hha_gfx')  || 'quality',
  haptic: (localStorage.getItem('hha_haptic') ?? '1') === '1',
  combo:0, bestCombo:0,
  fever:{ active:false, meter:0, drainPerSec:14, chargeGood:10, chargePerfect:20, threshold:100, mul:2, timeLeft:0 },
  spawnTimer:0, tickTimer:0,
  ctx:{}, stats:{good:0, perfect:0, ok:0, bad:0},
  _accHist:[],
  freezeUntil:0,
  didWarnT10:false
};

// ----- UI -----
function applyUI(){
  const L = T(state.lang);
  setText('#modeName',   L.names[state.modeKey]||state.modeKey);
  setText('#difficulty', L.diffs[state.difficulty]||state.difficulty);
  document.documentElement.setAttribute('data-hha-mode', state.modeKey);
}
function updateHUD(){
  hud.setScore?.(score.score);
  hud.setTime?.(state.timeLeft|0);
  hud.setCombo?.('x'+state.combo);
  // ⬇️ NEW: อัปเดตแถบ Power timers บน HUD ทุกครั้งที่รีเฟรช HUD
  hud.setPowerTimers?.(power.timers);
}

// ----- Fever -----
function setFeverBar(pct){
  const bar = $('#feverBar'); if (!bar) return;
  bar.style.width = Math.max(0,Math.min(100,pct|0))+'%';
}
function showFeverLabel(show){
  const f = $('#fever'); if(!f) return;
  f.style.display = show?'block':'none';
  f.classList.toggle('pulse', !!show);
}
function startFever(){
  if (state.fever.active) return;
  state.fever.active = true;
  state.fever.timeLeft = 7;
  showFeverLabel(true);
  coach.onFever?.();
  try{ $('#sfx-powerup')?.play(); }catch{}
  Progress.event('fever', {kind:'start'});
  // ⬇️ NEW: ส่งไปยังระบบ Quests ด้วย (บางเควสต์นับจำนวนเปิด FEVER)
  Quests.event('fever', {kind:'start'});
}
function stopFever(){
  if (!state.fever.active) return;
  state.fever.active = false;
  state.fever.timeLeft = 0;
  showFeverLabel(false);
  coach.onFeverEnd?.();
  Progress.event('fever', {kind:'end'});
  Quests.event('fever', {kind:'end'});
}

// ----- Score FX (UI burst only) -----
function makeScoreBurst(x,y,text,minor,color){
  const el = document.createElement('div');
  el.className='scoreBurst';
  el.style.cssText = `
    position:fixed;left:${x}px;top:${y}px;transform:translate(-50%,-50%);
    font:900 20px/1.2 ui-rounded,system-ui,Arial;color:${color||'#7fffd4'};
    text-shadow:0 2px 6px #000c;z-index:120;pointer-events:none;opacity:0;translate:0 6px;
    transition:opacity .22s, translate .22s;`;
  el.textContent = text;
  if (minor){
    const m = document.createElement('div');
    m.style.cssText = 'font:700 12px/1.2 ui-rounded,system-ui;opacity:.9';
    m.textContent = minor; el.appendChild(m);
  }
  document.body.appendChild(el);
  requestAnimationFrame(()=>{ el.style.opacity='1'; el.style.translate='0 0'; });
  setTimeout(()=>{ el.style.opacity='0'; el.style.translate='0 -8px';
    setTimeout(()=>{ try{el.remove();}catch{} }, 220);
  }, 720);
}
function scoreWithEffects(base,x,y){
  const comboMul = state.combo>=20?1.4:(state.combo>=10?1.2:1.0);
  const feverMul = state.fever.active?state.fever.mul:1.0;
  const total = Math.round(base * comboMul * feverMul);
  score.add?.(total);
  const tag = total>=0?('+'+total):(''+total);
  const minor = (comboMul>1||feverMul>1) ? ('x'+comboMul.toFixed(1)+(feverMul>1?' & FEVER':'')) : '';
  const color = total>=0? (feverMul>1?'#ffd54a':'#7fffd4') : '#ff9b9b';
  makeScoreBurst(x,y,tag,minor,color);
}

// ----- Safe area & overlap -----
function safeBounds(){
  const headerH = $('header.brand')?.offsetHeight || 56;
  const menuH   = $('#menuBar')?.offsetHeight || 120;
  const yMin = headerH + 60;
  const yMax = Math.max(yMin+50, innerHeight - menuH - 80);
  const xMin = 20;
  const xMax = Math.max(xMin+50, innerWidth - 80);
  return {xMin,xMax,yMin,yMax};
}
function randPos(){
  const {xMin,xMax,yMin,yMax} = safeBounds();
  return { left: xMin + Math.random()*(xMax-xMin), top: yMin + Math.random()*(yMax-yMin) };
}
function overlapped(x,y){
  for (const n of LIVE){
    const r = n.getBoundingClientRect();
    const dx = (r.left+r.width/2)-x;
    const dy = (r.top +r.height/2)-y;
    if (Math.hypot(dx,dy) < 64) return true;
  }
  return false;
}

// ----- Spawn one -----
function spawnOnce(diff){
  if (!state.running || state.paused) return;

  const nowMs = performance?.now?.()||Date.now();
  if (state.freezeUntil && nowMs < state.freezeUntil){
    state.spawnTimer = setTimeout(()=>spawnOnce(diff), 120);
    return;
  }
  if (LIVE.size >= MAX_ITEMS){
    state.spawnTimer = setTimeout(()=>spawnOnce(diff), 180);
    return;
  }

  const mode = MODES[state.modeKey];
  const meta = mode?.pickMeta?.(diff, state) || {};

  const el = document.createElement('button');
  el.className='item'; el.type='button';
  el.textContent = meta.char || '❓';
  el.setAttribute('aria-label', meta.aria || meta.label || meta.id || 'item');
  const px = ICON_SIZE_MAP[state.difficulty] || 72;
  el.style.cssText = `
    position:fixed;border:none;background:transparent;color:#fff;cursor:pointer;z-index:80;
    line-height:1;transition:transform .15s, filter .15s, opacity .15s;padding:8px;border-radius:14px;font-size:${px}px;
    transform:perspective(600px) rotateX(0) rotateY(0);`;

  if (mode?.fx?.onSpawn) { try{ mode.fx.onSpawn(el, state); }catch{}; }
  else { add3DTilt(el); }

  let pos = randPos(), tries=0;
  while (tries++<12 && overlapped(pos.left,pos.top)) pos = randPos();
  el.style.left = pos.left+'px';
  el.style.top  = pos.top +'px';

  el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    try{
      const sys = { score, sfx, power, coach, fx: eng?.fx };
      const res = mode?.onHit?.(meta, sys, state, hud) || (meta.good?'good':'ok');

      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;

      state.stats[res] = (state.stats[res]||0)+1;
      if (res==='good' || res==='perfect') addCombo(res);
      if (res==='bad') addCombo('bad');

      const base = ({good:10, perfect:20, ok:2, bad:-8, power:5})[res] || 1;
      scoreWithEffects(base, cx, cy);

      if (mode?.fx?.onHit) { try{ mode.fx.onHit(cx, cy, meta, state); }catch{}; }
      else { shatter3D(cx, cy); }

      // ⬇️ กรอกอีเวนต์ให้ทั้ง Progress (เก็บสถิติ/XP) และ Quests (ชิป HUD)
      const hitPayload = {
        mode: state.modeKey,
        result: res,
        meta: { good: !!meta.good, groupId: meta.groupId, golden: !!meta.golden },
        comboNow: state.combo
      };
      Progress.event('hit', hitPayload);
      Quests.event('hit', { result: res, meta: hitPayload.meta, combo: state.combo });

      if (state.haptic && navigator.vibrate){
        if (res==='bad') navigator.vibrate(60);
        else if (res==='perfect') navigator.vibrate([12,30,12]);
        else if (res==='good') navigator.vibrate(12);
      }
    }catch(e){
      console.error('[HHA] onHit error:', e);
    }finally{
      setTimeout(()=>{ try{ LIVE.delete(el); el.remove(); }catch{} }, 50);
    }
  }, {passive:true});

  document.body.appendChild(el);
  LIVE.add(el);

  const ttl = (typeof meta.life === 'number') ? meta.life
            : (typeof diff.life === 'number') ? diff.life
            : 3000;
  setTimeout(()=>{ try{ LIVE.delete(el); el.remove(); }catch{} }, ttl);
}

// ----- Spawn loop -----
function spawnLoop(){
  if (!state.running || state.paused) return;

  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  const total = state.stats.good + state.stats.perfect + state.stats.ok + state.stats.bad;
  const accNow = total>0 ? (state.stats.good + state.stats.perfect)/total : 1;
  state._accHist.push(accNow); if (state._accHist.length>8) state._accHist.shift();
  const acc = state._accHist.reduce((s,x)=>s+x,0)/state._accHist.length;
  const speedUp = acc > 0.85 ? 0.90 : acc < 0.60 ? 1.12 : 1.00;

  const dyn = {
    time: diff.time,
    spawn: Math.max(260, Math.round((diff.spawn||700) * speedUp)),
    life:  Math.max(800,  Math.round((diff.life ||3000) / speedUp))
  };

  spawnOnce(dyn);
  const next = Math.max(220, dyn.spawn);
  state.spawnTimer = setTimeout(spawnLoop, next);
}

// ----- Combo -----
function addCombo(kind){
  if (kind==='bad'){
    state.combo = 0;
    hud.setCombo?.('x0');
    coach.onBad?.();
    return;
  }
  if (kind==='good' || kind==='perfect'){
    state.combo++; state.bestCombo = Math.max(state.bestCombo, state.combo);
    hud.setCombo?.('x'+state.combo);
    if (kind==='perfect') coach.onPerfect?.(); else coach.onGood?.();

    if (!state.fever.active){
      const gain = (kind==='perfect')?state.fever.chargePerfect:state.fever.chargeGood;
      state.fever.meter = Math.min(100, state.fever.meter + gain);
      setFeverBar(state.fever.meter);
      if (state.fever.meter >= state.fever.threshold) startFever();
    }else{
      state.fever.timeLeft = Math.min(10, state.fever.timeLeft + 0.6);
    }
    coach.onCombo?.(state.combo);
  }
}

// ----- Tick / Start / End -----
function tick(){
  if (!state.running || state.paused) return;

  if (state.fever.active){
    state.fever.timeLeft = Math.max(0, state.fever.timeLeft - 1);
    state.fever.meter = Math.max(0, state.fever.meter - state.fever.drainPerSec);
    setFeverBar(state.fever.meter);
    if (state.fever.timeLeft<=0 || state.fever.meter<=0) stopFever();
  }

  try{ MODES[state.modeKey]?.tick?.(state, {score,sfx,power,coach,fx:eng?.fx}, hud); }catch(e){}

  // ⬇️ แจ้ง 1 วินาทีให้ Progress (ใช้กับ survive_time / accuracy เก็บปลายเกม) และ Quests (เคาท์ดาวน์ชิป)
  Progress.event('sec', {});
  Quests.tick({ score: score.score|0 });

  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateHUD();

  if (state.timeLeft===10 && !state.didWarnT10){
    state.didWarnT10=true; coach.onTimeLow?.(); try{ $('#sfx-tick')?.play(); }catch{}
  }
  if (state.timeLeft<=0){ end(); return; }

  state.tickTimer = setTimeout(tick, 1000);
}

async function runCountdown(sec=3){
  let ov = document.getElementById('cdOverlay');
  if (!ov){
    ov = document.createElement('div'); ov.id='cdOverlay';
    ov.style.cssText='position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:150;pointer-events:none;';
    const b = document.createElement('div'); b.id='cdNum';
    b.style.cssText='font:900 72px/1 ui-rounded,system-ui;color:#fff;text-shadow:0 2px 14px #000c;';
    ov.appendChild(b); document.body.appendChild(ov);
  }
  const b = $('#cdNum');
  for (let n=sec;n>0;n--){ b.textContent = String(n); coach.onCountdown?.(n); await new Promise(r=>setTimeout(r, 1000)); }
  b.textContent='Go!'; await new Promise(r=>setTimeout(r, 500));
  try{ ov.remove(); }catch{}
}

function showResultModal(total, accPct, grade){
  let modal = $('#result');
  if (!modal){
    modal = document.createElement('div');
    modal.id='result'; modal.className='modal';
    modal.innerHTML = `<div class="card"><h3 id="h_summary">สรุปผล</h3>
      <div id="resCore"></div><div id="resBreakdown"></div><div id="resBoard"></div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn" data-result="replay" id="btn_replay">↻ เล่นอีกครั้ง</button>
        <button class="btn" data-result="home"   id="btn_home">🏠 หน้าหลัก</button></div></div>`;
    document.body.appendChild(modal);
  }
  const core = `
    <div style="font:900 32px/1.2 ui-rounded;text-shadow:0 2px 6px #000a;color:#7fffd4">${total} คะแนน</div>
    <div style="font:700 16px;opacity:.85;margin-top:6px">แม่นยำ ${accPct.toFixed(1)}% • คอมโบสูงสุด x${state.bestCombo}</div>`;
  const br = `
    <div style="margin-top:12px;text-align:left;font-weight:700">
      ✅ ดี: ${state.stats.good}<br/>
      🌟 เพอร์เฟกต์: ${state.stats.perfect}<br/>
      😐 ปกติ: ${state.stats.ok}<br/>
      ❌ พลาด: ${state.stats.bad}
    </div>`;
  const bd = `<div style="margin-top:8px;font-weight:800">ระดับ: ${grade} (${state.difficulty})</div>`;
  $('#resCore').innerHTML = core;
  $('#resBreakdown').innerHTML = br;
  $('#resBoard').innerHTML = bd;
  modal.style.display='flex';
}

async function start(){
  end(true);
  const diff = DIFFS[state.difficulty] || DIFFS.Normal;

  await runCountdown(3);

  state.running=true; state.paused=false;
  state.timeLeft = diff.time;
  state.combo=0; state.bestCombo=0;
  state.stats={good:0,perfect:0,ok:0,bad:0};
  state._accHist=[]; state.freezeUntil=0; state.didWarnT10=false;
  state.fever.meter=0; setFeverBar(0); stopFever();
  score.reset?.(); updateHUD();

  try{ MODES[state.modeKey]?.init?.(state, hud, diff); }catch(e){ console.error('[HHA] init:', e); }
  coach.onStart?.(state.modeKey);

  // Progress missions (ใช้ XP/daily/stats)
  const missions = Progress.beginRun(state.modeKey, state.difficulty, state.lang);
  renderMissions(missions);

  // ⬇️ NEW: เริ่ม Quests HUD (สุ่ม 3 จาก 10) ให้เวลาตามรอบจริง
  Quests.beginRun(state.modeKey, state.difficulty, state.lang, state.timeLeft);
  QUEST_BIND.refresh?.();

  tick();
  spawnLoop();
}

function end(silent=false){
  clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  const wasRunning = state.running;
  state.running=false; state.paused=false;

  try{ MODES[state.modeKey]?.cleanup?.(state, hud); }catch{}

  for (const n of Array.from(LIVE)){ try{ n.remove(); }catch{} LIVE.delete(n); }

  const total = score.score|0;
  const cnt = state.stats.good + state.stats.perfect + state.stats.ok + state.stats.bad;
  const accPct = cnt>0 ? ((state.stats.good + state.stats.perfect)/cnt*100) : 0;
  const grade = total>=500?'S': total>=400?'A+': total>=320?'A': total>=240?'B':'C';

  const timePlayed = (DIFFS[state.difficulty]?.time||60) - state.timeLeft;

  // ⬇️ ปิด Quests (ให้ onEnd เคลียร์ชิป/สรุปสถานะ)
  Quests.endRun({ score: total, miss: state.stats.bad|0, acc: +accPct.toFixed(1) });

  Progress.endRun({ score: total, bestCombo: state.bestCombo|0, timePlayed, acc: +accPct.toFixed(1) });

  if (!silent && wasRunning){
    showResultModal(total, accPct, grade);
    try{ sfx.play('sfx-good'); }catch{}
  }
}

// ----- Missions HUD (Progress UI เดิม) -----
function renderMissions(list){
  const host = document.getElementById('questChips'); if (!host) return;
  host.innerHTML = '';
  if (!list || !list.length) return;
  for (const m of list){
    const chip = document.createElement('div');
    chip.className = 'questChip';
    chip.dataset.qid = m.id;
    chip.innerHTML = `
      <span class="qLabel">${m.label}</span>
      <span class="qProg">${Math.min(m.prog||0, m.need)}/${m.need}</span>
      <div class="qBar"><i style="width:${Math.min(100,(m.prog||0)/m.need*100)}%"></i></div>`;
    host.appendChild(chip);
  }
  if (!renderMissions._subscribed){
    Progress.on((type)=>{
      if (type==='mission_done' || type==='run_start'){ renderMissions(Progress.runCtx?.missions||[]); }
    });
    renderMissions._subscribed = true;
  }
}

// ----- Help text / Stats / Daily (unchanged) -----
const HELP_TEXT = { /* ...คงเดิมของคุณ... */ };

function openHelpCurrent(){ /* ...คงเดิมของคุณ... */ }
function openHelpAll(){ /* ...คงเดิมของคุณ... */ }
function buildStatSnapshotFallback(){ /* ...คงเดิมของคุณ... */ }
function openStatBoard(){ /* ...คงเดิมของคุณ... */ }
function openDailyPanel(){ /* ...คงเดิมของคุณ... */ }

// ----- Global UI Events -----
document.addEventListener('pointerup', (e)=>{
  const btn = byAction(e.target); if (!btn) return;
  const a = btn.getAttribute('data-action') || '';
  const v = btn.getAttribute('data-value')  || '';

  if (a.startsWith('ui:start:')){
    const key = a.split(':')[2];
    if (MODES[key]){ state.modeKey = key; applyUI(); }
    return;
  }

  if (a === 'mode'){ state.modeKey = v; applyUI(); }
  else if (a === 'diff'){ state.difficulty = v; applyUI(); }
  else if (a === 'start'){ start(); }
  else if (a === 'pause'){
    if (!state.running){ start(); return; }
    state.paused = !state.paused;
    if (!state.paused){ tick(); spawnLoop(); }
    else { clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer); }
  }
  else if (a === 'restart'){ end(true); start(); }
  else if (a === 'help'){ openHelpCurrent(); }
  else if (a === 'helpClose'){ const m=$('#help'); if (m) m.style.display='none'; }
  else if (a === 'helpScene'){ openHelpAll(); }
  else if (a === 'helpSceneClose'){ const hs=$('#helpScene'); if (hs) hs.style.display='none'; }
  else if (a === 'statOpen'){ openStatBoard(); }
  else if (a === 'statClose'){ const s=$('#statBoard'); if (s) s.style.display='none'; }
  else if (a === 'dailyOpen'){ openDailyPanel(); }
  else if (a === 'dailyClose'){ const d=$('#dailyPanel'); if (d) d.style.display='none'; }
}, {passive:true});

// ----- Power-ups (groups) -----
// (เหมือนเดิมของคุณ)
(function wirePowers(){
  const bar = $('#powerBar'); if (!bar) return;
  const sweep = bar.querySelector('.pseg[data-k="sweep"] span');
  if (sweep && sweep.textContent.trim()==='🧹') sweep.textContent = '🧲';

  const COOLDOWNS = { x2:12000, freeze:9000, sweep:8000 };
  const DURATIONS = (() => {
    const m = MODES['groups'];
    if (m?.getPowerDurations) {
      const info = m.getPowerDurations();
      return {
        x2: (info?.x2||8)*1000,
        freeze: (info?.freeze||3)*1000,
        sweep: (info?.magnet||2)*1000
      };
    }
    return { x2:8000, freeze:3000, sweep:2000 };
  })();
  const lastUsed = { x2:0, freeze:0, sweep:0 };

  function segEl(k){ return bar.querySelector(`.pseg[data-k="${k}"]`); }
  function animateCD(k, dur){
    const el = segEl(k); if (!el) return;
    el.setAttribute('aria-disabled','true'); el.classList.add('busy');
    const fill = el.querySelector('i'); if (fill) fill.style.height = '100%';
    const t0 = performance.now();
    const tick = ()=>{
      const t = performance.now() - t0;
      const pct = 1 - Math.min(1, t/dur);
      if (fill) fill.style.height = (pct*100)+'%';
      if (t < dur) requestAnimationFrame(tick);
      else {
        el.classList.remove('busy'); el.removeAttribute('aria-disabled');
        if (fill) fill.style.height = '0%';
        el.classList.add('ready'); setTimeout(()=>el.classList.remove('ready'), 400);
      }
    };
    requestAnimationFrame(tick);
  }
  function usePower(k){
    const now = performance.now();
    if (now - lastUsed[k] < (COOLDOWNS[k]||0)) return;
    const mode = MODES[state.modeKey];
    if (state.modeKey !== 'groups' || !mode?.powers) return;
    if (k==='x2')    mode.powers.x2Target?.();
    if (k==='freeze')mode.powers.freezeTarget?.();
    if (k==='sweep') mode.powers.magnetNext?.();
    try{ sfx.play('sfx-powerup'); }catch{}
    lastUsed[k] = now; animateCD(k, COOLDOWNS[k]||0);
  }
  bar.addEventListener('click', (e)=>{
    const seg = e.target.closest('.pseg'); if (!seg) return;
    const k = seg.getAttribute('data-k'); if (!k) return;
    const dur = DURATIONS[k] || 0; if (dur>0) animateCD(k, dur);
    usePower(k);
  }, {passive:true});
})();

// Result modal buttons
const resEl = $('#result');
if (resEl){
  resEl.addEventListener('click', (e)=>{
    const t = e.target.closest('button'); if (!t) return;
    const a = t.getAttribute('data-result');
    if (a==='replay'){ resEl.style.display='none'; start(); }
    if (a==='home'){ resEl.style.display='none'; end(true); }
  });
}

// Toggles
$('#langToggle')?.addEventListener('click', ()=>{
  state.lang = state.lang==='TH' ? 'EN' : 'TH';
  localStorage.setItem('hha_lang', state.lang);
  coach.setLang?.(state.lang);
  applyUI();
  // รีเฟรชชื่อโหมด/เควสต์ทั้งหมดให้ตรงภาษา
  QUEST_BIND.refresh?.();
}, {passive:true});

$('#gfxToggle')?.addEventListener('click', ()=>{
  state.gfx = state.gfx==='low' ? 'quality' : 'low';
  localStorage.setItem('hha_gfx', state.gfx);
  try{ eng.renderer.setPixelRatio(state.gfx==='low'?0.75:(window.devicePixelRatio||1)); }catch{}
}, {passive:true});

$('#soundToggle')?.addEventListener('click', ()=>{
  const on = localStorage.getItem('hha_sound') !== '0';
  const nxt = !on;
  localStorage.setItem('hha_sound', nxt?'1':'0');
  sfx.setEnabled?.(nxt);
  $('#soundToggle').textContent = nxt ? '🔊 เสียง: เปิด' : '🔇 เสียง: ปิด';
  if (nxt){ try{ sfx.play('sfx-good'); }catch{} }
}, {passive:true});

$('#hapticToggle')?.addEventListener('click', ()=>{
  state.haptic = !state.haptic;
  localStorage.setItem('hha_haptic', state.haptic?'1':'0');
  $('#hapticToggle').textContent = state.haptic ? '📳 สั่น: เปิด' : '📴 สั่น: ปิด';
}, {passive:true});

// Auto pause
document.addEventListener('visibilitychange', ()=>{
  if (document.hidden && state.running && !state.paused){
    state.paused = true;
    clearTimeout(state.tickTimer); clearTimeout(state.spawnTimer);
  }
});

// Unlock audio
window.addEventListener('pointerdown', ()=>{ try{ sfx.unlock(); }catch{} }, {once:true, passive:true});

// Boot
Progress.init();
applyUI(); updateHUD();
(function levelUI(){
  const lvEl = document.createElement('span');
  lvEl.id = 'playerLevel';
  lvEl.style.cssText='margin-left:8px;font-weight:800';
  const brand = document.querySelector('header.brand #brandTitle')?.parentElement || document.querySelector('header.brand');
  if (brand) brand.insertBefore(lvEl, brand.children[1]||null);
  const render = ()=>{ const p=Progress.profile; if (p && lvEl) lvEl.textContent = `LV ${p.level}`; };
  render();
  Progress.on((type)=>{ if (type==='level_up') render(); });
})();
