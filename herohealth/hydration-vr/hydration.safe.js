// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION SAFE (ULTRA BOSS: Shockwave + Laser + Enrage)
// ✅ Compatible with /herohealth/hydration-vr.html that already has:
//    #hha-vignette, #hha-warnline, #hvr-bounds/#hvr-world/#hvr-layer, HUD ids.
// ✅ Keeps emitting events (logger / external HUD):
//    hha:score / hha:time / hha:coach / quest:update / hha:celebrate / hha:end
// ✅ Adds internal HUD binder fallback (if you didn’t include vr/hha-hud.js)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { createHydrationQuest } from './hydration.quest.js';
import { createHydrationCoach } from './hydration.coach.js';
import { createHydrationAudio } from './hydration.audio.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function $(id){ return DOC ? DOC.getElementById(id) : null; }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name,{detail})); }catch{} }
function pct01(x){ return Math.round(clamp(x,0,1)*100); }

function parseQS(){
  const qs = new URLSearchParams(ROOT.location.search || '');
  const diff = String(qs.get('diff') || 'normal').toLowerCase();
  const run  = String(qs.get('run')  || 'play').toLowerCase();
  const seed = String(qs.get('seed') || '').trim();
  const time = clamp(qs.get('time') || 90, 20, 180);
  const debug = (qs.get('debug') === '1' || qs.get('debug') === 'true');
  return {
    diff: (diff==='easy'||diff==='hard'||diff==='normal') ? diff : 'normal',
    run:  (run==='research') ? 'research' : 'play',
    seed, time, debug
  };
}

function fatal(msg, err){
  console.error('[HydrationVR] FATAL:', msg, err||'');
  if(!DOC) return;
  let box = DOC.getElementById('hhaFatal');
  if(!box){
    box = DOC.createElement('div');
    box.id='hhaFatal';
    Object.assign(box.style,{
      position:'fixed', inset:'0', zIndex:'9999',
      background:'rgba(2,6,23,.92)', color:'#e5e7eb',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'18px', fontFamily:'system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
    });
    box.innerHTML = `
      <div style="max-width:760px;border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:16px;background:rgba(15,23,42,.55)">
        <div style="font-weight:900;font-size:18px;margin-bottom:8px">เข้าเกมไม่ได้</div>
        <div id="hhaFatalMsg" style="white-space:pre-wrap;line-height:1.35;color:rgba(229,231,235,.92)"></div>
        <div style="margin-top:10px;color:rgba(148,163,184,.95);font-size:12px">
          Tip: ตรวจ path ของไฟล์ / ล้าง cache (Hard reload) / เช็ก Console
        </div>
      </div>`;
    DOC.body.appendChild(box);
  }
  const m = DOC.getElementById('hhaFatalMsg');
  if(m) m.textContent = String(msg||'Unknown error');
}

/* ---------------------------------------------------------
   FX + Boss HUD (inject only what HTML doesn't already provide)
--------------------------------------------------------- */
function ensureUltraStyle(){
  if(!DOC || DOC.getElementById('hhaUltraRaidStyle')) return;

  const s = DOC.createElement('style');
  s.id='hhaUltraRaidStyle';
  s.textContent = `
    /* Boss HUD */
    #hha-boss-hud{
      position:fixed; top:10px; left:50%;
      transform:translateX(-50%);
      z-index:58;
      width:min(560px, calc(100vw - 22px));
      pointer-events:none;
      opacity:0; transition:opacity .18s ease;
      border-radius:18px;
      background:rgba(2,6,23,.62);
      border:1px solid rgba(148,163,184,.22);
      box-shadow:0 16px 40px rgba(2,6,23,.65);
      overflow:hidden;
    }
    #hha-boss-hud.on{ opacity:1; }
    #hha-boss-top{
      display:flex; align-items:center; justify-content:space-between;
      padding:10px 12px 8px 12px;
      color:rgba(229,231,235,.95);
      font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      font-weight:900; letter-spacing:.2px;
    }
    #hha-boss-top .tag{ display:flex; align-items:center; gap:8px; font-size:13px; }
    #hha-boss-top .tag .icon{ font-size:18px; }
    #hha-boss-top .meta{ font-size:12px; color:rgba(148,163,184,.95); font-weight:800; }
    #hha-boss-bar{
      height:14px; margin:0 12px 12px 12px;
      background:rgba(148,163,184,.14);
      border-radius:999px;
      overflow:hidden;
      border:1px solid rgba(148,163,184,.16);
    }
    #hha-boss-fill{
      height:100%;
      width:100%;
      background:linear-gradient(90deg, rgba(239,68,68,.95), rgba(244,63,94,.82));
      border-radius:999px;
      box-shadow:0 0 18px rgba(239,68,68,.35);
      transition:width .10s linear;
    }
    #hha-boss-sub{
      margin:-6px 12px 12px 12px;
      font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
      font-size:12px;
      color:rgba(148,163,184,.95);
      font-weight:800;
      letter-spacing:.2px;
      display:flex; justify-content:space-between; gap:10px;
    }

    /* Laser overlay (HTML doesn’t have it) */
    #hha-laserflash{
      position:fixed; inset:0; z-index:57;
      pointer-events:none;
      opacity:0;
      background:
        radial-gradient(1000px 640px at 50% 50%, rgba(255,255,255,.06), rgba(255,255,255,0) 62%),
        linear-gradient(90deg, rgba(239,68,68,0), rgba(239,68,68,.24), rgba(239,68,68,0));
      mix-blend-mode: screen;
    }
    body.hha-laser #hha-laserflash{ opacity:.92; animation:hhaLaser .12s ease-in-out 1; }
    @keyframes hhaLaser{ 0%{opacity:0;} 35%{opacity:.95;} 100%{opacity:0;} }

    /* Shockwave overlay */
    #hha-shock{
      position:fixed; inset:0; z-index:56;
      pointer-events:none;
      opacity:0;
      background:
        radial-gradient(circle at 50% 52%, rgba(239,68,68,.20), rgba(239,68,68,0) 54%),
        radial-gradient(circle at 50% 52%, rgba(255,255,255,.06), rgba(255,255,255,0) 62%);
      mix-blend-mode: screen;
    }
    body.hha-shock #hha-shock{ opacity:1; animation:hhaShock .42s ease-in-out 1; }
    @keyframes hhaShock{
      0%{ transform:scale(0.98); filter:blur(0px); }
      40%{ transform:scale(1.02); filter:blur(.6px); }
      100%{ transform:scale(1.00); filter:blur(0px); opacity:0; }
    }

    /* Boss danger: repaint warnline to RED (override your yellow warnline) */
    body.hha-boss-danger #hha-warnline{
      opacity:.70 !important;
      background: linear-gradient(180deg,
        rgba(239,68,68,0),
        rgba(239,68,68,0) 30%,
        rgba(239,68,68,.18) 62%,
        rgba(239,68,68,0)
      ) !important;
      animation: warnPulse .45s ease-in-out infinite !important;
    }
    body.hha-enrage #hha-warnline{ opacity:.86 !important; animation: warnPulse .30s ease-in-out infinite !important; }
  `;
  DOC.head.appendChild(s);

  // create overlays only if missing (your HTML already has vignette/warnline)
  function ensureEl(id){
    if(DOC.getElementById(id)) return;
    const d = DOC.createElement('div');
    d.id = id;
    d.setAttribute('aria-hidden','true');
    DOC.body.appendChild(d);
  }
  ensureEl('hha-laserflash');
  ensureEl('hha-shock');
}

function ensureBossHud(){
  if(!DOC) return null;
  let hud = DOC.getElementById('hha-boss-hud');
  if(hud && hud.isConnected) return hud;

  hud = DOC.createElement('div');
  hud.id = 'hha-boss-hud';
  hud.setAttribute('data-hha-exclude','1'); // กัน spawn ทับ HUD
  hud.innerHTML = `
    <div id="hha-boss-top">
      <div class="tag"><span class="icon">🌀</span><span id="hha-boss-title">BOSS RAID</span></div>
      <div class="meta"><span id="hha-boss-hp">HP 0/0</span> • <span id="hha-boss-phase">P0</span></div>
    </div>
    <div id="hha-boss-bar"><div id="hha-boss-fill"></div></div>
    <div id="hha-boss-sub">
      <span id="hha-boss-rule">ComboGate</span>
      <span id="hha-boss-status">—</span>
    </div>
  `;
  DOC.body.appendChild(hud);
  return hud;
}

function setBossHud(on, hp, hpMax, phase, title, rule, status){
  if(!DOC) return;
  const hud = ensureBossHud();
  if(!hud) return;
  hud.classList.toggle('on', !!on);
  const hpEl = DOC.getElementById('hha-boss-hp');
  const phEl = DOC.getElementById('hha-boss-phase');
  const fill = DOC.getElementById('hha-boss-fill');
  const tEl  = DOC.getElementById('hha-boss-title');
  const rEl  = DOC.getElementById('hha-boss-rule');
  const sEl  = DOC.getElementById('hha-boss-status');

  if(hpEl) hpEl.textContent = `HP ${Math.max(0,hp|0)}/${Math.max(1,hpMax|0)}`;
  if(phEl) phEl.textContent = `P${phase|0}`;
  if(tEl && title) tEl.textContent = title;
  if(rEl && rule)  rEl.textContent = rule;
  if(sEl && status) sEl.textContent = status;

  if(fill){
    const p = (hpMax>0) ? clamp(hp/hpMax,0,1) : 0;
    fill.style.width = `${Math.round(p*100)}%`;
    if (p <= 0.18) fill.style.boxShadow = '0 0 26px rgba(244,63,94,.58)';
  }
}

function attachDragLook(){
  const bounds = $('hvr-bounds');
  const world  = $('hvr-world');
  if(!bounds || !world) return { reset(){}, setEnabled(){} };

  let ox=0, oy=0, down=false, sx=0, sy=0, bx=0, by=0;
  let enabled=true;
  const maxX = () => Math.max(18, (bounds.clientWidth||1) * 0.10);
  const maxY = () => Math.max(18, (bounds.clientHeight||1) * 0.12);

  function apply(){
    const mx=maxX(), my=maxY();
    ox = clamp(ox, -mx, mx);
    oy = clamp(oy, -my, my);
    world.style.transform = `translate3d(${Math.round(ox)}px, ${Math.round(oy)}px, 0)`;
  }
  function reset(){ ox=0; oy=0; apply(); }
  function setEnabled(v){ enabled=!!v; }

  bounds.addEventListener('pointerdown', (e)=>{
    if(!enabled) return;
    const t=e.target;
    if(t && (t.id==='btnStop'||t.id==='btnVR')) return;
    down=true; sx=e.clientX; sy=e.clientY; bx=ox; by=oy;
  }, {passive:true});

  bounds.addEventListener('pointermove', (e)=>{
    if(!enabled || !down) return;
    ox = bx + (e.clientX - sx)*0.55;
    oy = by + (e.clientY - sy)*0.55;
    apply();
  }, {passive:true});

  bounds.addEventListener('pointerup', ()=>{ down=false; }, {passive:true});
  bounds.addEventListener('pointercancel', ()=>{ down=false; }, {passive:true});

  ROOT.addEventListener('hha:resetView', reset);
  return { reset, setEnabled };
}

/* ---------------------------------------------------------
   HUD fallback binder (updates your HTML IDs directly)
--------------------------------------------------------- */
function setText(id, txt){ const el=$(id); if(el) el.textContent = String(txt); }
function setWidth(id, pct){ const el=$(id); if(el) el.style.width = `${clamp(pct,0,100)}%`; }

function bindHudFallback(){
  if(!DOC) return;
  let lastTime = null;

  ROOT.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    setText('hha-score', d.score ?? 0);
    setText('hha-comboMax', d.comboMax ?? 0);
    setText('hha-miss', d.miss ?? 0);
    setText('hha-grade', d.grade ?? 'C');

    // water
    setText('hha-water-zone', d.waterZone ?? 'GREEN');
    setText('hha-water-zone2', d.waterZone ?? 'GREEN');
    setText('hha-water-pct', `${d.waterPct ?? 0}%`);
    setText('hha-water-pct2', `${d.waterPct ?? 0}%`);
    setWidth('hha-water-fill', d.waterPct ?? 0);

    // fever
    setText('hha-fever-pct', `${d.feverPct ?? 0}%`);
    setWidth('hha-fever-fill', d.feverPct ?? 0);

    // shield
    setText('hha-shield', d.shield ?? 0);

    // progress to S
    setWidth('hha-progress-fill', d.progressPct ?? 0);
    setText('hha-progress-text', `Progress to S (30%): ${Math.round(d.progressPct ?? 0)}%`);
  });

  ROOT.addEventListener('quest:update', (ev)=>{
    const q = ev?.detail || {};
    setText('hha-quest-num', q.questNum ?? 1);
    // ใช้ text/sub/done ของระบบ quest ที่เรา emit
    if(q.text) setText('hha-quest-text', q.text);
    if(q.sub)  setText('hha-quest-sub', q.sub);
    if(q.done) setText('hha-quest-done', q.done);
  });

  ROOT.addEventListener('hha:time', (ev)=>{
    const sec = Number(ev?.detail?.sec ?? NaN);
    if(!Number.isFinite(sec)) return;
    if(sec === lastTime) return;
    lastTime = sec;
    setText('hha-time', sec);
  });

  ROOT.addEventListener('hha:coach', (ev)=>{
    const c = ev?.detail || {};
    const hint = $('hha-hint');
    if(!hint) return;
    hint.innerHTML = `<b>Coach</b><small>${String(c.text||'')}</small>`;
  });
}

/* ---------------------------------------------------------
   Emojis
--------------------------------------------------------- */
const EMOJI = {
  good: ['💧','🚰','🥛','🧊','🍉','🍊','🍇','🍏','🥥'],
  bad:  ['🥤','🧃','🧋','🍺','🍹','🥛‍🍫','🍶'],
  trick:['💧','🚰'],
  power:['🛡️','⭐','⚡']
};
const BOSS_EMOJI = ['🌀'];

/* ---------------------------------------------------------
   Main boot
--------------------------------------------------------- */
export function bootHydration(){
  try{
    if(!DOC) return;

    ensureUltraStyle();
    bindHudFallback();

    const { diff, run, seed, time, debug } = parseQS();
    const isResearch = (run === 'research');

    // hide start overlay if run param exists
    const hasRunParams = (new URLSearchParams(location.search)).has('run');
    const startOverlay = $('hvr-start');
    if (startOverlay) startOverlay.style.display = hasRunParams ? 'none' : 'flex';
    if (!hasRunParams) return;

    const Particles =
      (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
      ROOT.Particles || { scorePop(){}, burstAt(){}, celebrate(){} };

    const audio = createHydrationAudio ? createHydrationAudio({ volume: isResearch ? 0.12 : 0.22 }) : {
      unlock: async()=>{}, tick:()=>{}, good:()=>{}, miss:()=>{}, power:()=>{}, celebrate:()=>{}
    };

    // unlock audio on first touch
    const unlockOnce = async ()=>{
      try{ await audio.unlock?.(); }catch{}
      DOC.removeEventListener('pointerdown', unlockOnce);
    };
    DOC.addEventListener('pointerdown', unlockOnce, { passive:true });

    const quest = createHydrationQuest ? createHydrationQuest({ diff, run }) : { start(){}, tick(){}, onHit(){}, getState(){return{};} };
    const coach = createHydrationCoach ? createHydrationCoach({ run }) : { say(){}, onTick(){}, onHit(){}, onQuest(){} };

    let ended=false;

    // ---- core state ----
    const state = {
      run, diff, seed, time,
      score:0,
      combo:0,
      comboMax:0,
      miss:0,
      shield:0,
      fever:0,    // 0..1
      water:0.50, // 0..1
      zone:'GREEN'
    };

    function setZone(){
      const w=state.water;
      state.zone = (w>=0.40 && w<=0.62) ? 'GREEN' : (w<0.40 ? 'LOW' : 'HIGH');
    }
    function bumpFever(d){ state.fever = clamp(state.fever + d, 0, 1); }
    function bumpWater(d){ state.water = clamp(state.water + d, 0, 1); setZone(); }

    function gradeFromScore(score, miss){
      const s = Number(score)||0;
      const m = Number(miss)||0;
      const eff = s - m*8;
      if (eff >= 560) return 'SSS';
      if (eff >= 450) return 'SS';
      if (eff >= 360) return 'S';
      if (eff >= 270) return 'A';
      if (eff >= 190) return 'B';
      return 'C';
    }
    function progressToS(score){
      const s = clamp(Number(score)||0, 0, 360);
      return (s / 360) * 100;
    }

    function setFeverClasses(){
      const feverPct = pct01(state.fever);
      DOC.body.classList.toggle('hha-fever', feverPct >= 35);
    }

    function emitScore(){
      setFeverClasses();
      emit('hha:score', {
        score: state.score|0,
        comboMax: state.comboMax|0,
        miss: state.miss|0,
        grade: gradeFromScore(state.score, state.miss),
        waterZone: state.zone,
        waterPct: pct01(state.water),
        feverPct: pct01(state.fever),
        shield: state.shield|0,
        progressPct: progressToS(state.score)
      });
    }

    function shake(){
      DOC.body.classList.remove('hha-shake');
      void DOC.body.offsetWidth;
      DOC.body.classList.add('hha-shake');
    }
    function laserFlash(){
      DOC.body.classList.remove('hha-laser');
      void DOC.body.offsetWidth;
      DOC.body.classList.add('hha-laser');
      setTimeout(()=>{ try{ DOC.body.classList.remove('hha-laser'); }catch{} }, 160);
    }
    function shockFlash(){
      DOC.body.classList.remove('hha-shock');
      void DOC.body.offsetWidth;
      DOC.body.classList.add('hha-shock');
      setTimeout(()=>{ try{ DOC.body.classList.remove('hha-shock'); }catch{} }, 520);
    }

    /* ============================
       ULTRA RAID CONFIG
    ============================ */
    const RAID = {
      raidSec: (diff==='easy'? 18 : diff==='hard'? 24 : 21),

      // phase boundaries (time left in raid)
      p1_end:  Math.round((diff==='easy'? 12 : diff==='hard'? 16 : 14)),
      p2_end:  Math.round((diff==='easy'? 7  : diff==='hard'? 9  : 8)),

      hpMax:   (diff==='easy'? 11 : diff==='hard'? 18 : 14),

      comboGateMin: 3,
      aimGate: (diff==='easy'? 0.52 : diff==='hard'? 0.41 : 0.46),
      graze:   (diff==='easy'? 0.78 : diff==='hard'? 0.69 : 0.74),

      bossChanceP2: (isResearch ? 0.18 : (diff==='easy'? 0.34 : diff==='hard'? 0.52 : 0.42)),
      bossChanceP3: (isResearch ? 0.22 : (diff==='easy'? 0.44 : diff==='hard'? 0.66 : 0.54)),
      decoyChance:  (isResearch ? 0.00 : (diff==='easy'? 0.24 : diff==='hard'? 0.38 : 0.32)),

      dmgBase: 1,
      dmgPerfectBonus: (diff==='easy'? 1 : diff==='hard'? 2 : 1),
      dmgGreenBonus: 1,

      bossHitScore: (diff==='easy'? 26 : diff==='hard'? 34 : 30),
      bossPerfectScoreBonus: (diff==='easy'? 14 : diff==='hard'? 18 : 16),
      bossGrazePenalty: (diff==='easy'? 12 : diff==='hard'? 18 : 14),
      bossExpirePenalty:(diff==='easy'? 12 : diff==='hard'? 20 : 16),

      gateFailPenalty:(diff==='easy'? 8 : diff==='hard'? 12 : 10),
      gateFailFever:  (diff==='easy'? 0.06 : diff==='hard'? 0.09 : 0.075),

      decoyPenalty:(diff==='easy'? 18 : diff==='hard'? 26 : 22),
      decoyFever:  (diff==='easy'? 0.10 : diff==='hard'? 0.15 : 0.12),

      graceOutSec:(diff==='easy'? 3 : diff==='hard'? 2 : 3),
      drainPerSec:(diff==='easy'? 7 : diff==='hard'? 11 : 9),
      feverPerSec:(diff==='easy'? 0.034 : diff==='hard'? 0.050 : 0.042),

      laserPenalty:(diff==='easy'? 16 : diff==='hard'? 26 : 20),
      laserFever:  (diff==='easy'? 0.045 : diff==='hard'? 0.070 : 0.055),
      laserWaterPush:(diff==='easy'? 0.014 : diff==='hard'? 0.020 : 0.017),

      // Shockwave (boss attack #1)
      shockEverySec:(diff==='easy'? 6 : diff==='hard'? 5 : 5), // baseline
      shockWindowMs:(diff==='easy'? 900 : diff==='hard'? 720 : 820),
      shockPenalty:(diff==='easy'? 18 : diff==='hard'? 28 : 22),
      shockFever:  (diff==='easy'? 0.09 : diff==='hard'? 0.13 : 0.11),
      shockWaterPush:(diff==='easy'? 0.06 : diff==='hard'? 0.09 : 0.075),

      // Enrage (hp < 30%)
      enrageHpPct: 0.30,
      enrageBossChanceBoost: 0.14,
      enrageDecoyBoost: 0.12,
      enrageDrainBoost: 4,
      enrageLaserBoost: 8,
      enrageGraceReduce: 1,
      enrageSpawnMul: 0.85,
      enrageShockEveryReduce: 1,

      // Boss regen if you stay out of GREEN too long (ULTIMATE)
      regenEverySec: (diff==='easy'? 5 : diff==='hard'? 4 : 4),
      regenHp: 1,

      // Wipe
      wipePenalty:(diff==='easy'? 75 : diff==='hard'? 110 : 92),
      wipeFever:  (diff==='easy'? 0.20 : diff==='hard'? 0.28 : 0.24),

      // speed multipliers (storm)
      mulP1: 0.84,
      mulP2: 0.70,
      mulP3: 0.58
    };

    const boss = {
      on:false,
      entered:false,
      phase:0,     // 0 none, 1 warning, 2 boss, 3 final
      hp:RAID.hpMax,
      hpMax:RAID.hpMax,
      cleared:false,
      enrage:false,
      outStreak:0,

      // shock
      shockCd: 0,
      shockArmed:false,
      shockTimer:null,
      shockDodges:0,
      shockHits:0,

      // stats
      hits:0,
      missed:0,
      grazed:0,
      gateFails:0,
      decoyHits:0,
      lasers:0,
      regens:0
    };

    function bossRuleText(){
      const gate = `Combo ≥ ${RAID.comboGateMin} + เล็งกลาง`;
      const enr  = boss.enrage ? ' • ENRAGE' : '';
      return gate + enr;
    }
    function bossStatusText(){
      if(!boss.on) return '—';
      if(boss.cleared) return 'CLEARED ✅';
      if(boss.phase===1) return 'WARNING…';
      if(boss.phase===2) return boss.enrage ? 'ENRAGE RAID!' : 'RAID!';
      return boss.enrage ? 'FINAL ENRAGE!' : 'FINAL!';
    }

    function enterBoss(){
      if(boss.entered) return;
      boss.entered=true;
      boss.on=true;
      boss.phase=1;
      boss.hp=boss.hpMax=RAID.hpMax;
      boss.shockCd = RAID.shockEverySec;

      DOC.body.classList.add('hha-boss');
      setBossHud(true, boss.hp, boss.hpMax, boss.phase, 'BOSS RAID', bossRuleText(), bossStatusText());

      coach.say?.(`🔥 BOSS RAID! สะสมคอมโบให้ถึง ${RAID.comboGateMin} ก่อนยิงบอส!`, 'happy', true);
      try{ audio.tick?.(true); }catch{}
      emitScore();
    }

    function setPhase(p){
      if(!boss.on) return;
      if(p === boss.phase) return;
      boss.phase = p;

      if(p===2){
        coach.say?.(`🌀 บอสโผล่! ระวัง SHOCKWAVE (ต้องยิงอะไรสักอย่างเพื่อกันแรง)`, 'neutral', true);
      } else if(p===3){
        coach.say?.('⚡ FINAL! ออก GREEN นาน → LASER ยิงทุกวิ!', 'sad', true);
      }
      setBossHud(true, boss.hp, boss.hpMax, boss.phase, boss.enrage?'BOSS ENRAGE':'BOSS RAID', bossRuleText(), bossStatusText());
      emitScore();
    }

    function setEnrage(on){
      if(!!on === boss.enrage) return;
      boss.enrage = !!on;
      DOC.body.classList.toggle('hha-enrage', boss.enrage);
      coach.say?.(boss.enrage ? '😈 ENRAGE! บอสคลั่งแล้ว!' : 'บอสเริ่มนิ่งลง…', boss.enrage?'sad':'neutral', true);
      setBossHud(true, boss.hp, boss.hpMax, boss.phase, boss.enrage?'BOSS ENRAGE':'BOSS RAID', bossRuleText(), bossStatusText());
    }

    function stopBossHud(){
      setBossHud(false, 0, 1, 0, '', '', '');
      DOC.body.classList.remove('hha-boss','hha-boss-danger','hha-enrage','hha-laser','hha-shock');
    }

    function applyBossDamage(dmg){
      dmg = Math.max(0, dmg|0);
      if(!dmg) return false;
      boss.hp = Math.max(0, boss.hp - dmg);

      if(!boss.enrage && boss.hpMax>0 && (boss.hp / boss.hpMax) <= RAID.enrageHpPct){
        setEnrage(true);
      }

      setBossHud(true, boss.hp, boss.hpMax, boss.phase, boss.enrage?'BOSS ENRAGE':'BOSS RAID', bossRuleText(), bossStatusText());

      if(boss.hp <= 0 && !boss.cleared){
        boss.cleared = true;
        coach.say?.('🎉 บอสแตกแล้ว! โหดแค่ไหนก็ไม่รอด!', 'happy', true);
        emit('hha:celebrate', { kind:'goal', id:'boss_raid' });
        try{ Particles.celebrate?.('goal'); }catch{}
        try{ audio.celebrate?.(); }catch{}
      }
      return true;
    }

    function endGame(){
      if(ended) return;
      ended=true;

      stopBossHud();

      const wipe = (boss.entered && !boss.cleared);
      if(wipe){
        state.score -= RAID.wipePenalty;
        bumpFever(+RAID.wipeFever);
        coach.say?.(`💥 WIPE! บอสไม่แตก → -${RAID.wipePenalty}`, 'sad', true);
      }

      const grade = gradeFromScore(state.score, state.miss);
      emit('hha:end', {
        title:'จบเกม Hydration 💧',
        score: state.score|0,
        miss: state.miss|0,
        comboMax: state.comboMax|0,
        grade,
        progressPct: progressToS(state.score),
        boss: {
          entered: boss.entered,
          cleared: boss.cleared,
          enrage: boss.enrage,
          hp: boss.hp,
          hpMax: boss.hpMax,
          phase: boss.phase,
          wipe,
          hits: boss.hits,
          missed: boss.missed,
          grazed: boss.grazed,
          gateFails: boss.gateFails,
          decoyHits: boss.decoyHits,
          lasers: boss.lasers,
          shockDodges: boss.shockDodges,
          shockHits: boss.shockHits,
          regens: boss.regens
        }
      });

      emitScore();
    }

    /* -------------------------------
       Spawn speed control (storm)
    ------------------------------- */
    function spawnIntervalMul(){
      if(isResearch) return 1;

      const feverMul = clamp(1 - state.fever*0.45, 0.55, 1.0);

      let bossMul = 1.0;
      if (boss.on){
        bossMul = (boss.phase===1) ? RAID.mulP1 : (boss.phase===2 ? RAID.mulP2 : RAID.mulP3);
      }

      const enrageMul = (boss.on && boss.enrage) ? RAID.enrageSpawnMul : 1.0;
      return clamp(feverMul * bossMul * enrageMul, 0.38, 1.0);
    }

    /* -------------------------------
       Boss attacks: Shockwave + Laser + Regen
    ------------------------------- */
    function clearShock(){
      boss.shockArmed = false;
      if(boss.shockTimer){
        try{ clearTimeout(boss.shockTimer); }catch{}
        boss.shockTimer = null;
      }
    }

    function armShockwave(){
      if(!boss.on || boss.cleared) return;
      if(boss.phase < 2) return;

      clearShock();
      boss.shockArmed = true;

      // warning
      DOC.body.classList.add('hha-boss-danger');
      shockFlash();
      coach.say?.('🌊 SHOCKWAVE! ยิง “อะไรก็ได้” ภายในเสี้ยววิ เพื่อกันแรง!', 'sad', true);
      try{ audio.tick?.(true); }catch{}
      try{ Particles.scorePop?.((ROOT.innerWidth||0)*0.5, (ROOT.innerHeight||0)*0.30, 'SHOCKWAVE!', 0); }catch{}
      shake();

      const windowMs = RAID.shockWindowMs - (boss.enrage ? 140 : 0);

      boss.shockTimer = setTimeout(()=>{
        // ถ้ายังไม่โดน “กันแรง” → โดนหนัก
        if(!boss.shockArmed) return;
        boss.shockArmed = false;
        boss.shockHits++;

        state.score -= (RAID.shockPenalty + (boss.enrage ? 8 : 0));
        bumpFever(+RAID.shockFever + (boss.enrage ? 0.04 : 0));
        // push water away from green (ทำให้ยากต่อเนื่อง)
        bumpWater(state.zone==='LOW' ? -RAID.shockWaterPush : +RAID.shockWaterPush);

        DOC.body.classList.add('hha-boss-danger');
        shockFlash();
        shake();
        try{ audio.miss?.(); }catch{}
        try{
          Particles.scorePop?.((ROOT.innerWidth||0)*0.5, (ROOT.innerHeight||0)*0.34,
            `SHOCK -${RAID.shockPenalty + (boss.enrage ? 8 : 0)}`, 0);
        }catch{}
        coach.say?.('โดน Shockwave เต็ม ๆ! รีบกลับ GREEN!', 'sad', true);
        emitScore();
      }, windowMs);
    }

    function dodgeShockwaveByHit(){
      if(!boss.shockArmed) return;
      // กันแรงสำเร็จ
      boss.shockArmed = false;
      if(boss.shockTimer){
        try{ clearTimeout(boss.shockTimer); }catch{}
        boss.shockTimer = null;
      }
      boss.shockDodges++;

      // reward เล็ก ๆ แต่จริง
      state.score += (boss.enrage ? 10 : 8);
      bumpFever(-0.06);
      bumpWater((0.52 - state.water) * 0.22);
      try{ audio.good?.(true); }catch{}
      try{ Particles.scorePop?.((ROOT.innerWidth||0)*0.5, (ROOT.innerHeight||0)*0.30, 'DODGE +8', 1); }catch{}
      coach.say?.('กันแรงได้! สวยมาก!', 'happy', false);
      emitScore();
    }

    function laserPunish(){
      boss.lasers++;
      state.score -= (RAID.laserPenalty + (boss.enrage ? RAID.enrageLaserBoost : 0));
      bumpFever(+RAID.laserFever + (boss.enrage ? 0.02 : 0));
      bumpWater(state.zone==='LOW' ? -RAID.laserWaterPush : +RAID.laserWaterPush);

      laserFlash();
      shake();

      try{ audio.tick?.(true); }catch{}
      try{
        Particles.scorePop?.((ROOT.innerWidth||0)*0.5,(ROOT.innerHeight||0)*0.30,
          `LASER -${RAID.laserPenalty + (boss.enrage ? RAID.enrageLaserBoost : 0)}`,0);
      }catch{}
      coach.say?.('⚡ LASER! กลับ GREEN เดี๋ยวนี้!', 'sad', true);
      emitScore();
    }

    function maybeRegenBoss(){
      if(!boss.on || boss.cleared) return;
      if(boss.phase < 2) return;
      if(state.zone === 'GREEN') return;
      if(boss.hp <= 0) return;

      // regen gating: only when outStreak is high (ultimate pressure)
      const every = Math.max(2, RAID.regenEverySec - (boss.enrage ? 1 : 0));
      if(boss.outStreak > (RAID.graceOutSec + 2) && (boss.outStreak % every === 0)){
        const before = boss.hp;
        boss.hp = Math.min(boss.hpMax, boss.hp + RAID.regenHp);
        if(boss.hp !== before){
          boss.regens++;
          DOC.body.classList.add('hha-boss-danger');
          try{ Particles.scorePop?.((ROOT.innerWidth||0)*0.5,(ROOT.innerHeight||0)*0.26,'BOSS REGEN +1',0); }catch{}
          coach.say?.('บอสฟื้นพลัง! อย่าออก GREEN นาน!', 'sad', true);
          setBossHud(true, boss.hp, boss.hpMax, boss.phase, boss.enrage?'BOSS ENRAGE':'BOSS RAID', bossRuleText(), bossStatusText());
        }
      }
    }

    /* -------------------------------
       decorateTarget: convert some targets to boss/decoy
    ------------------------------- */
    function decorateTarget(el, parts, data){
      try{
        if(!boss.on) return;
        if(boss.phase < 2) return;
        if(boss.cleared) return;

        const baseChance = (boss.phase===2) ? RAID.bossChanceP2 : RAID.bossChanceP3;
        const chance = baseChance + (boss.enrage ? RAID.enrageBossChanceBoost : 0);
        if(Math.random() > chance) return;

        const baseDecoy = RAID.decoyChance + (boss.enrage ? RAID.enrageDecoyBoost : 0);
        const isDecoy = (!isResearch && Math.random() < baseDecoy);

        data.ch = BOSS_EMOJI[0];
        data.isGood = true;
        data.isPower = false;
        data.itemType = isDecoy ? 'bossDecoy' : 'boss';

        try{ el.setAttribute('data-item-type', data.itemType); }catch{}

        // Skin: real vs decoy
        const baseGrad = isDecoy
          ? 'radial-gradient(circle at 30% 25%, #a855f7, #3b0764)'
          : 'radial-gradient(circle at 30% 25%, #ef4444, #7f1d1d)';
        el.style.background = baseGrad;

        const glow = isDecoy
          ? '0 0 0 2px rgba(167,139,250,0.75), 0 0 26px rgba(167,139,250,0.55)'
          : '0 0 0 2px rgba(239,68,68,0.75), 0 0 28px rgba(239,68,68,0.85)';
        el.style.boxShadow = '0 14px 30px rgba(15,23,42,0.9),' + glow;

        if(parts?.icon){
          parts.icon.textContent = data.ch;
          parts.icon.style.filter = 'drop-shadow(0 4px 6px rgba(15,23,42,0.95))';
        }
        if(parts?.badge){
          parts.badge.textContent = isDecoy ? '❓' : (boss.enrage ? '☠️' : '⚔️');
          parts.badge.style.opacity = isDecoy ? '0.78' : '0.88';
        }
      }catch{}
    }

    /* -------------------------------
       judge: scoring/logic
    ------------------------------- */
    function judge(ch, ctx){
      const type = String(ctx.itemType||'good');
      const hitX = Number(ctx.clientX ?? 0);
      const hitY = Number(ctx.clientY ?? 0);
      const perfect = !!ctx.hitPerfect;
      const norm = Number(ctx.hitDistNorm ?? 1);

      // any hit can "brace" shockwave
      if(boss.shockArmed) dodgeShockwaveByHit();

      // ===== Boss Decoy =====
      if(type === 'bossDecoy'){
        boss.decoyHits++;
        state.score -= (RAID.decoyPenalty + (boss.enrage ? 6 : 0));
        state.combo = 0;
        bumpFever(+RAID.decoyFever + (boss.enrage ? 0.03 : 0));

        DOC.body.classList.add('hha-boss-danger');
        shake();

        try{ Particles.burstAt?.(hitX, hitY, 'DECOY'); }catch{}
        try{ Particles.scorePop?.(hitX, hitY, `DECOY -${RAID.decoyPenalty + (boss.enrage ? 6 : 0)}`, 0); }catch{}
        try{ audio.miss?.(); }catch{}
        coach.say?.('โดนตัวหลอก! 😈 เล็งกลาง + รักษา GREEN!', 'sad', true);

        quest.onHit?.({ isGood:false, isPower:false, itemType:'bossDecoy', perfect:false });
        emitScore();
        return { scoreDelta: -(RAID.decoyPenalty + (boss.enrage ? 6 : 0)), good:false, decoy:true };
      }

      // ===== Boss Real =====
      if(type === 'boss'){
        // Combo Gate
        if((state.combo|0) < RAID.comboGateMin){
          boss.gateFails++;
          state.score -= (RAID.gateFailPenalty + (boss.enrage ? 5 : 0));
          state.combo = 0;
          bumpFever(+RAID.gateFailFever + (boss.enrage ? 0.03 : 0));
          DOC.body.classList.add('hha-boss-danger');
          shake();

          try{ Particles.burstAt?.(hitX, hitY, 'GATE'); }catch{}
          try{ Particles.scorePop?.(hitX, hitY, `GATE -${RAID.gateFailPenalty + (boss.enrage ? 5 : 0)}`, 0); }catch{}
          try{ audio.miss?.(); }catch{}
          coach.say?.(`คอมโบยังไม่ถึง ${RAID.comboGateMin}! เก็บน้ำก่อน`, 'sad', true);

          quest.onHit?.({ isGood:false, isPower:false, itemType:'boss', gateFail:true });
          emitScore();
          return { scoreDelta: -(RAID.gateFailPenalty + (boss.enrage ? 5 : 0)), good:false, gateFail:true };
        }

        // Aim Gate
        if(norm <= RAID.aimGate){
          boss.hits++;

          const inGreen = (state.zone === 'GREEN');
          const dmg = RAID.dmgBase + (perfect ? RAID.dmgPerfectBonus : 0) + (inGreen ? RAID.dmgGreenBonus : 0) + (boss.enrage ? 1 : 0);
          applyBossDamage(dmg);

          const add = RAID.bossHitScore
            + (perfect ? RAID.bossPerfectScoreBonus : 0)
            + (inGreen ? 6 : 0)
            + (boss.enrage ? 6 : 0);

          state.score += add;

          // stabilize + reduce fever
          const pull = (0.52 - state.water) * (inGreen ? 0.34 : 0.26);
          bumpWater(pull + 0.03);
          bumpFever(perfect ? -0.11 : -0.08);

          // combo boost
          state.combo = clamp(state.combo + 2, 0, 9999);
          state.comboMax = Math.max(state.comboMax, state.combo);

          try{ Particles.burstAt?.(hitX, hitY, perfect ? 'BOSS_PERFECT' : 'BOSS'); }catch{}
          try{ Particles.scorePop?.(hitX, hitY, `+${add}`, 1); }catch{}
          try{ audio.good?.(true); }catch{}
          coach.onHit?.({ boss:true, perfect });

          quest.onHit?.({ isGood:true, isPower:false, itemType:'boss', perfect:true });
          emitScore();
          return { scoreDelta: add, good:true, boss:true };
        }

        // Graze
        if(norm >= RAID.graze){
          boss.grazed++;
          state.score -= RAID.bossGrazePenalty;
          state.miss += 1;
          state.combo = 0;

          bumpFever(+0.12);
          bumpWater(state.zone==='LOW' ? -0.02 : +0.02);

          DOC.body.classList.add('hha-boss-danger');
          shake();

          try{ Particles.burstAt?.(hitX, hitY, 'GRAZE'); }catch{}
          try{ Particles.scorePop?.(hitX, hitY, `-${RAID.bossGrazePenalty}`, 0); }catch{}
          try{ audio.miss?.(); }catch{}
          coach.say?.('โดนไม่ชัวร์! เล็งกลางให้เป๊ะ!', 'sad', true);

          quest.onHit?.({ isGood:false, isPower:false, itemType:'boss', grazed:true });
          emitScore();
          return { scoreDelta: -RAID.bossGrazePenalty, good:false, boss:true, grazed:true };
        }

        emitScore();
        return { scoreDelta: 0, good:false, boss:true, soft:true };
      }

      // ===== Power =====
      if(type === 'power'){
        if (ch === '🛡️') state.shield = clamp(state.shield + 1, 0, 5);
        else if (ch === '⚡'){
          state.fever = clamp(state.fever - 0.18, 0, 1);
          bumpWater((0.52 - state.water) * 0.45);
        } else {
          state.score += 25;
          bumpWater(+0.03);
        }

        state.combo = clamp(state.combo + 1, 0, 9999);
        state.comboMax = Math.max(state.comboMax, state.combo);

        try{ Particles.burstAt?.(hitX, hitY, 'POWER'); }catch{}
        try{ Particles.scorePop?.(hitX, hitY, '+25', 1); }catch{}
        try{ audio.power?.(); }catch{}
        coach.onHit?.({ power:true });

        quest.onHit?.({ isGood:true, isPower:true, itemType:'power', perfect });
        emitScore();
        return { scoreDelta: 25, good:true, power:true };
      }

      // ===== Bad/Trap =====
      const isTrap = (type === 'fakeGood');
      if(!ctx.isGood || isTrap){
        if(state.shield > 0){
          state.shield--;
          bumpFever(+0.02);
          state.combo = 0;

          try{ Particles.burstAt?.(hitX, hitY, 'BLOCK'); }catch{}
          coach.onHit?.({ blocked:true });

          quest.onHit?.({ isGood:false, isPower:false, itemType:type, blocked:true });
          emitScore();
          return { scoreDelta: 0, good:false, blocked:true };
        }

        const bossPenalty = boss.on ? (boss.phase===3 ? 7 : 5) : 0;
        const penalty = 12 + bossPenalty + (boss.enrage ? 4 : 0);

        state.score -= penalty;
        state.miss  += 1;
        state.combo = 0;

        bumpFever(boss.on ? +0.16 : +0.12);
        bumpWater(boss.on ? +0.10 : +0.08);

        DOC.body.classList.add('hha-boss-danger');
        shake();

        try{ Particles.burstAt?.(hitX, hitY, 'BAD'); }catch{}
        try{ Particles.scorePop?.(hitX, hitY, `-${penalty}`, 0); }catch{}
        try{ audio.miss?.(); }catch{}
        coach.onHit?.({ bad:true });

        quest.onHit?.({ isGood:false, isPower:false, itemType:type, perfect, blocked:false });
        emitScore();
        return { scoreDelta: -penalty, good:false };
      }

      // ===== Good =====
      const bossBonus = boss.on ? (boss.phase===3 ? 4 : 2) : 0;
      const add = (10 + bossBonus) + (perfect ? (boss.on ? 7 : 5) : 0) + (boss.enrage ? 2 : 0);
      state.score += add;

      state.combo = clamp(state.combo + 1, 0, 9999);
      state.comboMax = Math.max(state.comboMax, state.combo);

      bumpWater((0.52 - state.water) * (boss.on ? 0.28 : 0.22) + (boss.on ? 0.026 : 0.02));
      bumpFever(perfect ? (boss.on ? -0.04 : -0.03) : (boss.on ? -0.022 : -0.015));

      try{ Particles.burstAt?.(hitX, hitY, perfect ? 'PERFECT' : 'GOOD'); }catch{}
      try{ Particles.scorePop?.(hitX, hitY, `+${add}`, 1); }catch{}
      try{ audio.good?.(perfect); }catch{}
      coach.onHit?.({ good:true, perfect });

      quest.onHit?.({ isGood:true, isPower:false, itemType:'good', perfect });
      emitScore();
      return { scoreDelta: add, good:true, perfect };
    }

    function onExpire(info){
      const it = String(info?.itemType || '');
      const isGood = !!info?.isGood;

      if(it === 'boss'){
        boss.missed++;
        state.score -= RAID.bossExpirePenalty;
        state.miss += 1;
        state.combo = 0;
        bumpFever(+0.10);
        DOC.body.classList.add('hha-boss-danger');
        shake();
        try{ audio.miss?.(); }catch{}
        try{ Particles.scorePop?.((ROOT.innerWidth||0)*0.5, (ROOT.innerHeight||0)*0.35, `-${RAID.bossExpirePenalty}`, 0); }catch{}
        coach.say?.('บอสหลุด! ยิงให้ทัน!', 'sad', true);
        emitScore();
        return;
      }
      if(it === 'bossDecoy') return;

      if(isGood){
        state.miss += 1;
        state.combo = 0;
        bumpFever(boss.on ? +0.06 : +0.05);
        bumpWater(boss.on ? -0.05 : -0.04);
        emitScore();
      }
    }

    /* -------------------------------
       View look + flags
    ------------------------------- */
    attachDragLook();

    const allowAdaptive = !isResearch;
    const allowTrick    = !isResearch;
    const allowPower    = !isResearch;
    const allowStorm    = !isResearch;

    /* -------------------------------
       Quest + initial
    ------------------------------- */
    quest.start?.();
    setZone();
    emitScore();

    /* -------------------------------
       Time handling (supports both external + fallback)
    ------------------------------- */
    let lastSec = null;
    let externalTimeSeen = false;

    function handleTimeTick(sec){
      sec = Number(sec||0);
      if(!Number.isFinite(sec)) return;
      if(sec === lastSec) return;
      lastSec = sec;

      // urgent overlay (your CSS uses hha-urgent)
      DOC.body.classList.toggle('hha-urgent', (sec <= 10 && sec > 0));
      if(sec <= 10 && sec > 0){
        try{ audio.tick?.(true); }catch{}
        if(sec <= 5) shake();
      }

      // enter raid
      if(!boss.entered && sec <= RAID.raidSec && sec > 0) enterBoss();

      // phases (only when boss on)
      if(boss.on && sec > 0){
        if(sec <= RAID.p2_end) setPhase(3);
        else if(sec <= RAID.p1_end) setPhase(2);
        else setPhase(1);

        // dynamic grace/drain under enrage
        const grace = Math.max(1, RAID.graceOutSec - (boss.enrage ? RAID.enrageGraceReduce : 0));
        const inGreen = (state.zone === 'GREEN');

        if(inGreen){
          boss.outStreak = 0;
          DOC.body.classList.remove('hha-boss-danger');
        }else{
          boss.outStreak++;

          if(boss.outStreak >= Math.max(1, grace - 1)){
            DOC.body.classList.add('hha-boss-danger');
          }

          // drain every second after grace
          if(boss.outStreak > grace){
            state.score -= (RAID.drainPerSec + (boss.enrage ? RAID.enrageDrainBoost : 0));
            bumpFever(+RAID.feverPerSec + (boss.enrage ? 0.01 : 0));

            // LASER only in phase3 (ultimate) when out of green beyond grace
            if(boss.phase === 3){
              laserPunish();
            }else{
              if(boss.outStreak % 2 === 0) shake();
              try{ audio.tick?.(true); }catch{}
              emitScore();
            }
          }
        }

        // Shockwave scheduling (phase2/3 only)
        if(boss.phase >= 2 && !boss.cleared){
          const reduce = (boss.enrage ? RAID.enrageShockEveryReduce : 0);
          const every = Math.max(3, RAID.shockEverySec - reduce);
          boss.shockCd--;
          if(boss.shockCd <= 0){
            boss.shockCd = every;
            armShockwave();
          }
        }

        // Regen boss if you stay out of green long
        maybeRegenBoss();

        // keep boss HUD updated
        setBossHud(true, boss.hp, boss.hpMax, boss.phase,
          boss.enrage?'BOSS ENRAGE':'BOSS RAID',
          bossRuleText(),
          bossStatusText()
        );
      }

      // quest + coach tick
      quest.tick?.(sec, { zone: state.zone, boss: boss.on, phase: boss.phase, bossHp: boss.hp, bossHpMax: boss.hpMax });
      coach.onTick?.({ sec, zone: state.zone, feverPct: pct01(state.fever), boss: boss.on, phase: boss.phase, hp: boss.hp });

      emit('hha:time', { sec });

      if(sec <= 0) endGame();
    }

    // listen external time if mode-factory provides it
    ROOT.addEventListener('hha:time', (ev)=>{
      // NOTE: We re-emit hha:time ourselves in handleTimeTick,
      // so we must avoid infinite loops:
      // Use a marker on our re-emit.
      if(ev?.detail && ev.detail.__internal) return;
      externalTimeSeen = true;
      handleTimeTick(Number(ev?.detail?.sec ?? 0));
    });

    // fallback timer if no external time event arrives
    const t0 = performance.now();
    let fallbackTimer = setInterval(()=>{
      if(externalTimeSeen || ended) return;
      const elapsed = (performance.now() - t0) / 1000;
      const secLeft = Math.max(0, Math.ceil(time - elapsed));
      // call directly (and emit internal time with marker)
      const prev = lastSec;
      handleTimeTick(secLeft);
      // prevent loop if listeners also handle
      if(lastSec !== prev){
        try{ ROOT.dispatchEvent(new CustomEvent('hha:time', { detail:{ sec: secLeft, __internal:true } })); }catch{}
      }
      if(secLeft <= 0){
        try{ clearInterval(fallbackTimer); }catch{}
        fallbackTimer = null;
      }
    }, 250);

    // Stop button
    ROOT.addEventListener('hha:stop', ()=>{
      if(ended) return;
      endGame();
    });

    /* -------------------------------
       Boot factory (spawn engine)
    ------------------------------- */
    const factoryCfg = {
      modeKey:'hydration',
      difficulty: diff,
      duration: time,

      spawnHost:'#hvr-layer',
      boundsHost:'#hvr-bounds',

      spawnAroundCrosshair:false,
      spawnStrategy:'grid9',
      minSeparation:0.98,
      maxSpawnTries:18,

      pools:{ good:EMOJI.good, bad:EMOJI.bad, trick: allowTrick ? EMOJI.trick : [] },
      goodRate:(diff==='easy'? 0.68 : diff==='hard'? 0.60 : 0.64),

      powerups: allowPower ? EMOJI.power : [],
      powerRate: allowPower ? 0.12 : 0,
      powerEvery: allowPower ? 6 : 999,
      trickRate: allowTrick ? 0.10 : 0.0,

      allowAdaptive,
      seed: (isResearch && seed) ? seed : null,

      spawnIntervalMul: (allowStorm ? spawnIntervalMul : 1),

      decorateTarget,
      judge,
      onExpire
    };

    factoryBoot(factoryCfg).then((h)=>{
      // tap to shoot crosshair
      DOC.addEventListener('pointerdown', (e)=>{
        if(ended) return;
        const t=e.target;
        if(t && (t.id==='btnStop'||t.id==='btnVR'||t.id==='endReplay'||t.id==='endClose')) return;
        try{ h?.shootCrosshair?.(); }catch{}
      }, { passive:true });

    }).catch((err)=>{
      fatal('Failed to boot hydration.safe.js\n' + String(err?.message||err), err);
    });

    // initial boss HUD (off)
    setBossHud(false, 0, 1, 0, '', '', '');

    if(debug) console.log('[HydrationVR ULTRA] boot', { diff, run, time, seed, RAID });

  }catch(err){
    fatal('Hydration.safe.js crashed\n' + String(err?.message||err), err);
  }
}

export default { bootHydration };
