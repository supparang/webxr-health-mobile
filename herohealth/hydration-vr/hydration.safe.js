// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION SAFE (Boss Ultimate++ : Laser + ComboGate)
// ✅ Play vs Research policy
// ✅ Quest + Coach + Audio (safe fallback)
// ✅ Drag-look world (targets follow view; factory edge-fix supported)
// ✅ HUD events: hha:score / quest:update / hha:coach / hha:time / hha:celebrate / hha:end
// ✅ Boss Ultimate++ (last 15s):
//    - Phase 1 (15–10): WARNING STORM (เร็วขึ้น + กดดันโซน)
//    - Phase 2 (10–5): BOSS TARGET (🌀) โผล่ + Aim Gate
//    - Phase 3 (5–0): FINAL RUSH + BOSS LASER (ถ้า LOW/HIGH เกิน grace ยิงทุกวิ)
//    - Boss Combo Gate: บอสโดนจริง "เฉพาะคอมโบ >= 3" (และต้องเล็งกลาง)
// ✅ Fair Drain: โดนเฉพาะตอนอยู่นอก GREEN ต่อเนื่องเกิน grace เท่านั้น

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { createHydrationQuest } from './hydration.quest.js';
import { createHydrationCoach } from './hydration.coach.js';
import { createHydrationAudio } from './hydration.audio.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const doc  = ROOT.document;

function $(id){ return doc ? doc.getElementById(id) : null; }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function pct01(x){ return Math.round(clamp(x,0,1)*100); }
function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{} }

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
    seed,
    time,
    debug
  };
}

function fatal(msg, err){
  console.error('[HydrationVR] FATAL:', msg, err||'');
  if(!doc) return;
  let box = doc.getElementById('hhaFatal');
  if(!box){
    box = doc.createElement('div');
    box.id = 'hhaFatal';
    Object.assign(box.style, {
      position:'fixed', inset:'0', zIndex:'9999',
      background:'rgba(2,6,23,.92)', color:'#e5e7eb',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'18px', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    });
    box.innerHTML = `
      <div style="max-width:720px;border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:16px;background:rgba(15,23,42,.55)">
        <div style="font-weight:900;font-size:18px;margin-bottom:8px">เข้าเกมไม่ได้</div>
        <div id="hhaFatalMsg" style="white-space:pre-wrap;color:rgba(229,231,235,.92);line-height:1.35"></div>
        <div style="margin-top:10px;color:rgba(148,163,184,.95);font-size:12px">
          Tip: ตรวจ path ของไฟล์ .js / ล้าง cache (Hard reload) / เช็ก Console error
        </div>
      </div>
    `;
    doc.body.appendChild(box);
  }
  const m = doc.getElementById('hhaFatalMsg');
  if(m) m.textContent = String(msg || 'Unknown error');
}

function ensureBossStyle(){
  if(!doc) return;
  if(doc.getElementById('hhaBossStyle')) return;

  const s = doc.createElement('style');
  s.id = 'hhaBossStyle';
  s.textContent = `
    /* ===== Boss overlays injected by hydration.safe.js ===== */
    #hha-vignette, #hha-warnline, #hha-laserflash{
      position:fixed; inset:0; pointer-events:none; z-index:9;
      opacity:0; transition:opacity .2s ease;
    }
    #hha-vignette{
      background:
        radial-gradient(1200px 680px at 50% 50%, rgba(0,0,0,0) 50%, rgba(0,0,0,.80) 100%),
        radial-gradient(900px 520px at 50% 52%, rgba(239,68,68,0) 45%, rgba(239,68,68,.18) 95%);
      mix-blend-mode: screen;
    }
    #hha-warnline{
      background: linear-gradient(180deg,
        rgba(239,68,68,0),
        rgba(239,68,68,0) 32%,
        rgba(239,68,68,.18) 60%,
        rgba(239,68,68,0)
      );
    }
    #hha-laserflash{
      background:
        radial-gradient(1000px 640px at 50% 50%, rgba(255,255,255,.06), rgba(255,255,255,0) 60%),
        linear-gradient(90deg, rgba(239,68,68,0), rgba(239,68,68,.22), rgba(239,68,68,0));
      mix-blend-mode: screen;
    }

    body.hha-boss #hha-vignette{ opacity:.42; }
    body.hha-boss-danger #hha-warnline{
      opacity:.75; animation: hhaWarnPulse .42s ease-in-out infinite;
    }
    body.hha-boss-peak #hha-vignette{ opacity:.55; }
    body.hha-boss-peak #hha-warnline{
      opacity:.85; animation: hhaWarnPulse .28s ease-in-out infinite;
    }

    body.hha-laser #hha-laserflash{
      opacity:.92; animation: hhaLaser .12s ease-in-out 1;
    }
    @keyframes hhaWarnPulse{ 0%{ filter:blur(0px); } 50%{ filter:blur(1px);} 100%{ filter:blur(0px);} }
    @keyframes hhaLaser{
      0%{ opacity:.0; }
      35%{ opacity:.95; }
      100%{ opacity:0; }
    }

    /* Boss shake (soft) */
    body.hha-boss-shake{ animation:hhaBossShake .18s ease-in-out 1; }
    @keyframes hhaBossShake{
      0%{ transform:translate3d(0,0,0); }
      25%{ transform:translate3d(-2px,1px,0); }
      55%{ transform:translate3d(2px,-1px,0); }
      100%{ transform:translate3d(0,0,0); }
    }
  `;
  doc.head.appendChild(s);

  const ensure = (id)=>{
    if(doc.getElementById(id)) return;
    const d = doc.createElement('div');
    d.id = id;
    doc.body.appendChild(d);
  };
  ensure('hha-vignette');
  ensure('hha-warnline');
  ensure('hha-laserflash');
}

function bindHud(){
  const el = {
    score: $('hha-score'),
    comboMax: $('hha-comboMax'),
    miss: $('hha-miss'),
    time: $('hha-time'),
    grade: $('hha-grade'),
    waterZone: $('hha-water-zone'),
    waterPct: $('hha-water-pct'),
    waterFill: $('hha-water-fill'),
    waterZone2: $('hha-water-zone2'),
    waterPct2: $('hha-water-pct2'),
    feverFill: $('hha-fever-fill'),
    feverPct: $('hha-fever-pct'),
    shield: $('hha-shield'),
    qNum: $('hha-quest-num'),
    qText: $('hha-quest-text'),
    qSub: $('hha-quest-sub'),
    qDone: $('hha-quest-done'),
    progFill: $('hha-progress-fill'),
    progText: $('hha-progress-text')
  };

  function setWater(zone, p){
    if (el.waterZone) el.waterZone.textContent = zone;
    if (el.waterZone2) el.waterZone2.textContent = zone;
    if (el.waterPct) el.waterPct.textContent = `${p}%`;
    if (el.waterPct2) el.waterPct2.textContent = `${p}%`;
    if (el.waterFill) el.waterFill.style.width = `${clamp(p,0,100)}%`;
  }
  function setFever(p){
    if (el.feverPct) el.feverPct.textContent = `${p}%`;
    if (el.feverFill) el.feverFill.style.width = `${clamp(p,0,100)}%`;
  }

  ROOT.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    if (el.score) el.score.textContent = String(d.score ?? 0);
    if (el.comboMax) el.comboMax.textContent = String(d.comboMax ?? 0);
    if (el.miss) el.miss.textContent = String(d.miss ?? 0);
    if (el.grade) el.grade.textContent = String(d.grade ?? 'C');
    if (d.waterZone) setWater(d.waterZone, d.waterPct ?? 50);
    if (d.feverPct != null) setFever(d.feverPct);
    if (d.shield != null && el.shield) el.shield.textContent = String(d.shield);
    if (d.progressPct != null && el.progFill && el.progText){
      el.progFill.style.width = `${clamp(d.progressPct,0,100)}%`;
      el.progText.textContent = `Progress to S (30%): ${Math.round(Number(d.progressPct||0))}%`;
    }
  });

  ROOT.addEventListener('hha:time', (ev)=>{
    const d = ev?.detail || {};
    if (el.time) el.time.textContent = String(d.sec ?? 0);
  });

  ROOT.addEventListener('quest:update', (ev)=>{
    const d = ev?.detail || {};
    if (el.qNum) el.qNum.textContent = String(d.questNum ?? 1);
    if (el.qText) el.qText.textContent = String(d.text ?? '');
    if (el.qSub) el.qSub.textContent = String(d.sub ?? '');
    if (el.qDone) el.qDone.textContent = String(d.done ?? '');
  });
}

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

// ---- view drag ----
function attachDragLook(){
  const bounds = $('hvr-bounds');
  const world  = $('hvr-world');
  if(!bounds || !world) return { reset(){}, setEnabled(){} };

  let ox=0, oy=0;
  let down=false, sx=0, sy=0, bx=0, by=0;
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
    const t = e.target;
    if (t && (t.id==='btnStop' || t.id==='btnVR')) return;
    down=true; sx=e.clientX; sy=e.clientY; bx=ox; by=oy;
  }, {passive:true});

  bounds.addEventListener('pointermove', (e)=>{
    if(!enabled || !down) return;
    const dx=e.clientX - sx;
    const dy=e.clientY - sy;
    ox = bx + dx*0.55;
    oy = by + dy*0.55;
    apply();
  }, {passive:true});

  bounds.addEventListener('pointerup', ()=>{ down=false; }, {passive:true});
  bounds.addEventListener('pointercancel', ()=>{ down=false; }, {passive:true});

  ROOT.addEventListener('hha:resetView', reset);
  return { reset, setEnabled };
}

// ---- emoji pools ----
const EMOJI = {
  good: ['💧','🚰','🥛','🧊','🍉','🍊','🍇','🍏','🥥'],
  bad:  ['🥤','🧃','🧋','🍺','🍹','🥛‍🍫','🍶'],
  trick:['💧','🚰'],
  power:['🛡️','⭐','⚡']
};
const BOSS_EMOJI = ['🌀'];

export function bootHydration(){
  try{
    if(!doc) return;
    ensureBossStyle();
    bindHud();

    const { diff, run, seed, time, debug } = parseQS();

    const hasRunParams = (new URLSearchParams(location.search)).has('run');
    const startOverlay = $('hvr-start');
    if (startOverlay) startOverlay.style.display = hasRunParams ? 'none' : 'flex';
    if (!hasRunParams) return;

    const isResearch = (run === 'research');

    const allowAdaptive = !isResearch;
    const allowTrick    = !isResearch;
    const allowPower    = !isResearch;
    const allowStorm    = !isResearch;

    const Particles =
      (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
      ROOT.Particles || { scorePop(){}, burstAt(){}, celebrate(){} };

    const audio = createHydrationAudio ? createHydrationAudio({ volume: isResearch ? 0.12 : 0.22 }) : {
      unlock: async()=>{}, tick:()=>{}, good:()=>{}, miss:()=>{}, power:()=>{}, celebrate:()=>{}
    };

    const unlockOnce = async ()=>{
      try{ await audio.unlock?.(); }catch{}
      doc.removeEventListener('pointerdown', unlockOnce);
    };
    doc.addEventListener('pointerdown', unlockOnce, { passive:true });

    const quest = createHydrationQuest ? createHydrationQuest({ diff, run }) : { start(){}, tick(){}, onHit(){} };
    const coach = createHydrationCoach ? createHydrationCoach({ run }) : {
      say(){}, onTick(){}, onHit(){}, onQuest(){}
    };

    let stopped=false, ended=false;

    const state = {
      run, diff, seed, time,
      score:0,
      combo:0,
      comboMax:0,
      miss:0,
      shield:0,
      fever:0,        // 0..1
      water:0.50,     // 0..1
      waterZone:'GREEN'
    };

    // ============================
    // BOSS ULTIMATE++ CONFIG
    // ============================
    const BOSS = {
      startAtSec: 15,

      // Fair drain policy
      graceOutSec: (diff==='hard'? 2 : diff==='easy'? 3 : 3),
      drainPerSec: (diff==='hard'? 9 : diff==='easy'? 6 : 7),
      feverPerSec: (diff==='hard'? 0.045 : diff==='easy'? 0.032 : 0.038),

      // Clear condition
      clearNeedGreenSec: (diff==='hard'? 11 : diff==='easy'? 8 : 10),
      clearBonus: (diff==='hard'? 75 : diff==='easy'? 55 : 65),

      // Boss target spawn (phase2/3)
      bossSpawnChanceP2: (diff==='hard'? 0.42 : diff==='easy'? 0.30 : 0.36),
      bossSpawnChanceP3: (diff==='hard'? 0.55 : diff==='easy'? 0.40 : 0.48),

      // Aim gate
      aimGateNorm: (diff==='hard'? 0.42 : diff==='easy'? 0.52 : 0.47),
      grazeNorm:   (diff==='hard'? 0.70 : diff==='easy'? 0.78 : 0.74),

      // Boss hit scoring
      bossHitBase: (diff==='hard'? 32 : diff==='easy'? 26 : 29),
      bossHitPerfectBonus: (diff==='hard'? 18 : diff==='easy'? 14 : 16),
      bossGrazePenalty: (diff==='hard'? 16 : diff==='easy'? 12 : 14),
      bossExpirePenalty: (diff==='hard'? 18 : diff==='easy'? 12 : 15),

      // Phase multipliers (spawnIntervalMul)
      mulP1: 0.85,
      mulP2: 0.72,
      mulP3: 0.60,

      // ✅ Combo Gate
      bossComboGateMin: 3,
      bossGateFailPenalty: (diff==='hard'? 10 : diff==='easy'? 7 : 8),
      bossGateFailFever:   (diff==='hard'? 0.08 : diff==='easy'? 0.06 : 0.07),

      // ✅ Laser (Phase3 only)
      laserPenalty: (diff==='hard'? 22 : diff==='easy'? 14 : 18),
      laserFever:   (diff==='hard'? 0.06 : diff==='easy'? 0.045 : 0.052),
      laserWaterPush: (diff==='hard'? 0.018 : diff==='easy'? 0.014 : 0.016)
    };

    const boss = {
      on:false,
      entered:false,
      cleared:false,
      phase:0,           // 0 none, 1(15-10), 2(10-5), 3(5-0)
      outStreak:0,
      greenHold:0,
      drainTicks:0,

      // boss stats
      bossHits:0,
      bossMissed:0,
      bossGrazed:0,
      bossGateFails:0,
      laserShots:0
    };

    function setWaterZone(){
      const w = state.water;
      if (w >= 0.40 && w <= 0.62) state.waterZone = 'GREEN';
      else if (w < 0.40) state.waterZone = 'LOW';
      else state.waterZone = 'HIGH';
    }
    function bumpFever(d){ state.fever = clamp(state.fever + d, 0, 1); }
    function bumpWater(d){ state.water = clamp(state.water + d, 0, 1); setWaterZone(); }

    function setBodyFx(){
      const feverPct = pct01(state.fever);
      doc.body.classList.toggle('hha-fever', feverPct >= 55);
    }

    function applyScore(){
      const grade = gradeFromScore(state.score, state.miss);
      const prog  = progressToS(state.score);
      emit('hha:score', {
        score: state.score|0,
        comboMax: state.comboMax|0,
        miss: state.miss|0,
        grade,
        waterZone: state.waterZone,
        waterPct: pct01(state.water),
        feverPct: pct01(state.fever),
        shield: state.shield|0,
        progressPct: prog
      });
      setBodyFx();
    }

    function pulseBossShake(){
      doc.body.classList.remove('hha-boss-shake');
      void doc.body.offsetWidth;
      doc.body.classList.add('hha-boss-shake');
    }

    function laserFlash(){
      doc.body.classList.remove('hha-laser');
      void doc.body.offsetWidth;
      doc.body.classList.add('hha-laser');
      setTimeout(()=>{ try{ doc.body.classList.remove('hha-laser'); }catch{} }, 160);
    }

    function enterBoss(){
      if (boss.entered) return;
      boss.entered = true;
      boss.on = true;
      boss.phase = 1;
      doc.body.classList.add('hha-boss');
      coach.say?.('🔥 BOSS WAVE! 15 วิท้าย — รักษา GREEN + สะสมคอมโบให้ถึง 3 เพื่อยิงบอส!', 'happy', true);
      try{ audio.tick?.(true); }catch{}
      try{ Particles.celebrate?.('boss'); }catch{}
    }

    function updateBossPhase(sec){
      if (!boss.on) return;
      let p = 1;
      if (sec <= 5) p = 3;
      else if (sec <= 10) p = 2;
      else p = 1;

      if (p !== boss.phase){
        boss.phase = p;
        if (p === 2){
          coach.say?.('🌀 บอสโผล่! ต้อง “คอมโบ ≥ 3” และยิงใกล้กลางถึงจะนับ!', 'neutral', true);
          try{ audio.tick?.(true); }catch{}
        } else if (p === 3){
          doc.body.classList.add('hha-boss-peak');
          coach.say?.('⚡ FINAL RUSH + LASER! ถ้าออก GREEN เกินนับถอยหลัง → เลเซอร์ยิงทุกวิ!', 'sad', true);
          try{ audio.tick?.(true); }catch{}
        }
      }
    }

    function leaveBoss(){
      boss.on = false;
      boss.phase = 0;
      doc.body.classList.remove('hha-boss','hha-boss-danger','hha-boss-peak','hha-laser');
    }

    const look = attachDragLook();

    function stopAll(){
      if (stopped) return;
      stopped=true;
      try{ factory?.stop?.(); }catch{}
      try{ look?.setEnabled?.(false); }catch{}
    }

    function endGame(){
      if (ended) return;
      ended=true;
      stopAll();
      leaveBoss();

      const grade = gradeFromScore(state.score, state.miss);
      const prog  = progressToS(state.score);

      emit('hha:end', {
        title:'จบเกมแล้ว! 💧',
        score: state.score|0,
        miss: state.miss|0,
        comboMax: state.comboMax|0,
        grade,
        progressPct: prog,
        boss: {
          entered: boss.entered,
          cleared: boss.cleared,
          phase: boss.phase,
          greenHold: boss.greenHold,
          drainTicks: boss.drainTicks,
          bossHits: boss.bossHits,
          bossMissed: boss.bossMissed,
          bossGrazed: boss.bossGrazed,
          bossGateFails: boss.bossGateFails,
          laserShots: boss.laserShots
        }
      });
    }

    ROOT.addEventListener('hha:stop', endGame);

    ROOT.addEventListener('hha:celebrate', (ev)=>{
      const d = ev?.detail || {};
      try{ Particles.celebrate?.(d.kind || 'mini'); }catch{}
      try{ audio.celebrate?.(); }catch{}
      try{ coach.onQuest?.(d.kind || 'mini'); }catch{}
    });

    quest.start?.();
    setWaterZone();
    applyScore();

    let lastTickSec = 999;
    function urgentFx(sec){
      const urgent = (sec <= 10 && sec > 0);
      doc.body.classList.toggle('hha-urgent', urgent);
      if (urgent && sec !== lastTickSec){
        lastTickSec = sec;
        try{ audio.tick?.(true); }catch{}
        if (sec <= 5) pulseBossShake();
      }
      if (!urgent) lastTickSec = 999;
    }

    function spawnIntervalMul(){
      if (isResearch) return 1;

      const feverMul = clamp(1 - state.fever*0.45, 0.55, 1.0);

      let bossMul = 1.0;
      if (boss.on){
        if (boss.phase === 1) bossMul = BOSS.mulP1;
        else if (boss.phase === 2) bossMul = BOSS.mulP2;
        else if (boss.phase === 3) bossMul = BOSS.mulP3;
      }

      return clamp(feverMul * bossMul, 0.45, 1.0);
    }

    function decorateTarget(el, parts, data){
      try{
        if (!boss.on) return;
        if (boss.phase < 2) return;

        const chance = (boss.phase === 2) ? BOSS.bossSpawnChanceP2 : BOSS.bossSpawnChanceP3;
        if (Math.random() > chance) return;

        data.ch = BOSS_EMOJI[0];
        data.isGood = true;
        data.isPower = false;
        data.itemType = 'boss';
        try{ el.setAttribute('data-item-type', 'boss'); }catch{}

        el.style.background = 'radial-gradient(circle at 30% 25%, #ef4444, #7f1d1d)';
        el.style.boxShadow = '0 14px 30px rgba(15,23,42,0.9), 0 0 0 2px rgba(239,68,68,0.75), 0 0 26px rgba(239,68,68,0.85)';

        if (parts && parts.ring){
          parts.ring.style.borderColor = 'rgba(255,255,255,0.55)';
          parts.ring.style.outlineColor = 'rgba(239,68,68,0.25)';
          parts.ring.style.filter = 'drop-shadow(0 0 14px rgba(239,68,68,.25))';
        }
        if (parts && parts.icon){
          parts.icon.textContent = data.ch;
          parts.icon.style.filter = 'drop-shadow(0 4px 6px rgba(15,23,42,0.95))';
        }
      }catch{}
    }

    function judge(ch, ctx){
      const perfect = !!ctx.hitPerfect;
      const type = String(ctx.itemType||'good');
      const isBoss = (type === 'boss') || (BOSS_EMOJI.includes(String(ch)));

      const hitX = Number(ctx.clientX ?? 0);
      const hitY = Number(ctx.clientY ?? 0);

      // -------- BOSS TARGET (Aim Gate + Combo Gate) --------
      if (isBoss){
        const norm = Number(ctx.hitDistNorm ?? 1);
        const gate = BOSS.aimGateNorm;
        const graze = BOSS.grazeNorm;
        const inGreen = (state.waterZone === 'GREEN');

        // ✅ Combo Gate check
        const needCombo = BOSS.bossComboGateMin;
        if ((state.combo|0) < needCombo){
          // gate fail (clicked boss but combo not enough)
          boss.bossGateFails++;
          state.score -= BOSS.bossGateFailPenalty;
          state.combo = 0;
          bumpFever(+BOSS.bossGateFailFever);
          pulseBossShake();

          doc.body.classList.add('hha-boss-danger');
          try{ Particles.burstAt?.(hitX, hitY, 'GATE'); }catch{}
          try{ Particles.scorePop?.(hitX, hitY, `-${BOSS.bossGateFailPenalty}`, 0); }catch{}
          try{ audio.miss?.(); }catch{}
          coach.say?.(`คอมโบยังไม่ถึง ${needCombo}! เก็บน้ำดีต่อเนื่องก่อนแล้วค่อยยิงบอส!`, 'sad', true);

          applyScore();
          return { scoreDelta: -BOSS.bossGateFailPenalty, good:false, boss:true, gateFail:true };
        }

        // Aim gate
        if (norm <= gate){
          const add = BOSS.bossHitBase + (perfect ? BOSS.bossHitPerfectBonus : 0) + (inGreen ? 6 : 0);
          state.score += add;

          const pull = (0.52 - state.water) * (inGreen ? 0.34 : 0.26);
          bumpWater(pull + 0.03);
          bumpFever(perfect ? -0.10 : -0.07);

          state.combo = clamp(state.combo + 2, 0, 9999);
          state.comboMax = Math.max(state.comboMax, state.combo);

          boss.bossHits++;

          try{ Particles.burstAt?.(hitX, hitY, perfect ? 'BOSS_PERFECT' : 'BOSS'); }catch{}
          try{ Particles.scorePop?.(hitX, hitY, `+${add}`, 1); }catch{}
          try{ audio.good?.(true); }catch{}
          coach.onHit?.({ boss:true, perfect });

          quest.onHit?.({ isGood:true, isPower:false, itemType:'boss', perfect:true });
          applyScore();
          return { scoreDelta: add, good:true, boss:true };
        }

        if (norm >= graze){
          const pen = BOSS.bossGrazePenalty;
          state.score -= pen;
          state.miss += 1;
          state.combo = 0;

          bumpFever(+0.10);
          bumpWater(state.waterZone === 'LOW' ? -0.02 : +0.02);

          boss.bossGrazed++;
          doc.body.classList.add('hha-boss-danger');
          pulseBossShake();

          try{ Particles.burstAt?.(hitX, hitY, 'GRAZE'); }catch{}
          try{ Particles.scorePop?.(hitX, hitY, `-${pen}`, 0); }catch{}
          try{ audio.miss?.(); }catch{}
          coach.say?.('โดนบอสไม่ชัวร์! เล็งกลางให้เป๊ะ!', 'sad', true);

          quest.onHit?.({ isGood:false, isPower:false, itemType:'boss', perfect:false, grazed:true });
          applyScore();
          return { scoreDelta: -pen, good:false, boss:true, grazed:true };
        }

        if (state.waterZone === 'GREEN'){
          state.score += 6;
          bumpFever(-0.02);
          try{ Particles.scorePop?.(hitX, hitY, '+6', 1); }catch{}
          applyScore();
          return { scoreDelta: 6, good:true, boss:true, soft:true };
        }
        applyScore();
        return { scoreDelta: 0, good:false, boss:true, soft:true };
      }

      // -------- POWER --------
      if (type === 'power'){
        if (ch === '🛡️') state.shield = clamp(state.shield + 1, 0, 5);
        else if (ch === '⚡'){
          state.fever = clamp(state.fever - 0.18, 0, 1);
          const toward = (0.52 - state.water) * 0.45;
          bumpWater(toward);
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
        applyScore();
        return { scoreDelta: 25, good:true, power:true };
      }

      // -------- BAD / TRICK --------
      const isTrap = (type === 'fakeGood');
      if (!ctx.isGood || isTrap){
        if (state.shield > 0){
          state.shield--;
          bumpFever(+0.02);
          state.combo = 0;

          try{ Particles.burstAt?.(hitX, hitY, 'BLOCK'); }catch{}
          try{ audio.tick?.(false); }catch{}
          coach.onHit?.({ blocked:true });

          quest.onHit?.({ isGood:false, isPower:false, itemType:type, blocked:true });
          applyScore();
          return { scoreDelta: 0, good:false, blocked:true };
        }

        const bossPenalty = boss.on ? (boss.phase===3 ? 6 : 4) : 0;
        const penalty = 12 + bossPenalty;

        state.score -= penalty;
        state.miss  += 1;
        state.combo = 0;

        bumpFever(boss.on ? +0.15 : +0.12);
        bumpWater(boss.on ? +0.10 : +0.08);

        pulseBossShake();
        try{ Particles.burstAt?.(hitX, hitY, 'BAD'); }catch{}
        try{ Particles.scorePop?.(hitX, hitY, `-${penalty}`, 0); }catch{}
        try{ audio.miss?.(); }catch{}
        coach.onHit?.({ bad:true });

        quest.onHit?.({ isGood:false, isPower:false, itemType:type, perfect, blocked:false });
        applyScore();
        return { scoreDelta: -penalty, good:false };
      }

      // -------- GOOD --------
      const bossBonus = boss.on ? (boss.phase===3 ? 4 : 2) : 0;
      const base = (10 + bossBonus) + (perfect ? (boss.on ? 7 : 5) : 0);
      state.score += base;

      state.combo = clamp(state.combo + 1, 0, 9999);
      state.comboMax = Math.max(state.comboMax, state.combo);

      const pull = (0.52 - state.water) * (boss.on ? 0.28 : 0.22);
      bumpWater(pull + (boss.on ? 0.026 : 0.02));
      bumpFever(perfect ? (boss.on ? -0.04 : -0.03) : (boss.on ? -0.022 : -0.015));

      try{ Particles.burstAt?.(hitX, hitY, perfect ? 'PERFECT' : 'GOOD'); }catch{}
      try{ Particles.scorePop?.(hitX, hitY, `+${base}`, 1); }catch{}
      try{ audio.good?.(perfect); }catch{}
      coach.onHit?.({ good:true, perfect });

      quest.onHit?.({ isGood:true, isPower:false, itemType:'good', perfect });
      applyScore();
      return { scoreDelta: base, good:true, perfect };
    }

    function onExpire(info){
      const it = String(info?.itemType || '');
      const isGood = !!info?.isGood;

      if (it === 'boss' || BOSS_EMOJI.includes(String(info?.ch))){
        state.score -= BOSS.bossExpirePenalty;
        state.miss += 1;
        state.combo = 0;
        bumpFever(+0.10);
        boss.bossMissed++;
        doc.body.classList.add('hha-boss-danger');
        pulseBossShake();
        try{ audio.miss?.(); }catch{}
        try{ Particles.scorePop?.((ROOT.innerWidth||0)*0.5, (ROOT.innerHeight||0)*0.35, `-${BOSS.bossExpirePenalty}`, 0); }catch{}
        coach.say?.('บอสหลุด! ยิงให้ทัน!', 'sad', true);
        applyScore();
        return;
      }

      if (isGood){
        state.miss += 1;
        state.combo = 0;
        bumpFever(boss.on ? +0.06 : +0.05);
        bumpWater(boss.on ? -0.05 : -0.04);
        applyScore();
      }
    }

    const factoryCfg = {
      modeKey: 'hydration',
      difficulty: diff,
      duration: time,

      spawnHost:'#hvr-layer',
      boundsHost:'#hvr-bounds',

      spawnAroundCrosshair:false,
      spawnStrategy:'grid9',
      minSeparation:0.98,
      maxSpawnTries:18,

      pools:{ good:EMOJI.good, bad:EMOJI.bad, trick: allowTrick ? EMOJI.trick : [] },
      goodRate: (diff==='easy'? 0.68 : diff==='hard'? 0.60 : 0.64),

      powerups: allowPower ? EMOJI.power : [],
      powerRate: allowPower ? 0.12 : 0,
      powerEvery: allowPower ? 6 : 999,

      trickRate: allowTrick ? 0.10 : 0.0,

      allowAdaptive,
      seed: (isResearch && seed) ? seed : null,
      rng:null,

      spawnIntervalMul: (allowStorm ? spawnIntervalMul : 1),

      decorateTarget,
      judge,
      onExpire
    };

    let factory = null;

    ROOT.addEventListener('hha:time', (ev)=>{
      const sec = Number(ev?.detail?.sec ?? 0);

      if (!boss.entered && sec <= BOSS.startAtSec && sec > 0) enterBoss();
      if (boss.on && sec > 0) updateBossPhase(sec);

      urgentFx(sec);

      quest.tick?.(sec, state.waterZone);
      coach.onTick?.({ sec, zone: state.waterZone, feverPct: pct01(state.fever), boss: boss.on, phase: boss.phase });

      // ===== BOSS DRAIN / CLEAR / LASER =====
      if (boss.on && sec > 0){
        const inGreen = (state.waterZone === 'GREEN');

        if (inGreen){
          boss.outStreak = 0;
          doc.body.classList.remove('hha-boss-danger');

          if (!boss.cleared){
            boss.greenHold++;
            if (boss.greenHold >= BOSS.clearNeedGreenSec){
              boss.cleared = true;
              state.score += BOSS.clearBonus;
              try{ Particles.celebrate?.('goal'); }catch{}
              try{ audio.celebrate?.(); }catch{}
              coach.say?.(`เคลียร์บอสแล้ว! +${BOSS.clearBonus} 🎉`, 'happy', true);
              emit('hha:celebrate', { kind:'goal', id:'boss' });
              applyScore();
            }
          }
        } else {
          boss.outStreak++;

          if (boss.outStreak === 1){
            coach.say?.('ออกนอก GREEN แล้ว! รีบกลับเข้า GREEN!', 'sad', true);
          }

          if (boss.outStreak >= Math.max(1, BOSS.graceOutSec - 1)){
            doc.body.classList.add('hha-boss-danger');
          }

          // FAIR DRAIN only after grace
          if (boss.outStreak > BOSS.graceOutSec){
            state.score -= BOSS.drainPerSec;
            bumpFever(BOSS.feverPerSec);
            boss.drainTicks++;

            if (boss.phase === 3){
              bumpWater(state.waterZone==='LOW' ? -0.01 : +0.01);
            }

            if (boss.outStreak % 2 === 0) pulseBossShake();
            try{ audio.tick?.(true); }catch{}
            applyScore();
          }

          // ✅ BOSS LASER: phase3 only, ยิงทุกวินาทีเมื่อ outStreak > grace
          if (boss.phase === 3 && boss.outStreak > BOSS.graceOutSec){
            boss.laserShots++;
            state.score -= BOSS.laserPenalty;
            bumpFever(+BOSS.laserFever);
            bumpWater(state.waterZone==='LOW' ? -BOSS.laserWaterPush : +BOSS.laserWaterPush);

            laserFlash();
            pulseBossShake();
            try{ audio.tick?.(true); }catch{}
            try{
              Particles.scorePop?.((ROOT.innerWidth||0)*0.5, (ROOT.innerHeight||0)*0.30, `LASER -${BOSS.laserPenalty}`, 0);
            }catch{}
            coach.say?.('⚡ LASER! กลับ GREEN เดี๋ยวนี้!', 'sad', true);

            applyScore();
          }
        }
      }

      if (sec <= 0) endGame();
    });

    factoryBoot(factoryCfg).then((h)=>{
      factory = h;

      doc.addEventListener('pointerdown', (e)=>{
        if (stopped || ended) return;
        const t = e.target;
        if (t && (t.id==='btnStop'||t.id==='btnVR'||t.id==='endReplay'||t.id==='endClose')) return;
        try{ h?.shootCrosshair?.(); }catch{}
      }, { passive:true });

    }).catch((err)=>{
      fatal('Failed to boot hydration.safe.js\n' + String(err?.message || err), err);
    });

    if (debug) console.log('[HydrationVR] boot', { diff, run, time, seed, factoryCfg, BOSS });

  }catch(err){
    fatal('Hydration.safe.js crashed\n' + String(err?.message || err), err);
  }
}

export default { bootHydration };
