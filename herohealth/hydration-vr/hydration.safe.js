// === /herohealth/hydration-vr/hydration.safe.js ===
'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  null;

function $(id){ return DOC ? DOC.getElementById(id) : null; }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function now(){ return (typeof performance !== 'undefined') ? performance.now() : Date.now(); }

function zoneLabel(zoneCode){
  if (zoneCode === 'LOW') return 'BLUE';
  if (zoneCode === 'HIGH') return 'RED';
  return 'GREEN';
}

function ensureFallbackFxLayer(){
  let layer = DOC.querySelector('.hvr-fx-layer');
  if (layer) return layer;
  layer = DOC.createElement('div');
  layer.className = 'hvr-fx-layer';
  DOC.body.appendChild(layer);
  return layer;
}

function fxText(text, x, y, opts = {}){
  const layer = ensureFallbackFxLayer();
  const el = DOC.createElement('div');
  el.textContent = text;
  Object.assign(el.style, {
    position:'fixed',
    left: (x|0) + 'px',
    top: (y|0) + 'px',
    transform:'translate(-50%,-50%)',
    fontWeight:'1000',
    letterSpacing:'.04em',
    fontSize: (opts.size||16) + 'px',
    textShadow:'0 10px 28px rgba(0,0,0,.55)',
    opacity:'1',
    pointerEvents:'none',
    zIndex:'99989',
    filter:'drop-shadow(0 10px 18px rgba(0,0,0,.35))',
    willChange:'transform,opacity'
  });
  el.style.color = opts.color || '#e5e7eb';
  layer.appendChild(el);

  const dy = opts.dy ?? -46;
  const t0 = now();
  const dur = opts.dur ?? 520;

  function step(){
    const t = now();
    const p = clamp((t - t0) / dur, 0, 1);
    const ease = 1 - Math.pow(1-p, 3);
    el.style.transform = `translate(-50%, -50%) translateY(${(dy*ease).toFixed(1)}px) scale(${(1+0.08*(1-p)).toFixed(3)})`;
    el.style.opacity = String(1 - p);
    if (p < 1) requestAnimationFrame(step);
    else { try{ el.remove(); }catch{} }
  }
  requestAnimationFrame(step);
}

function fxScore(delta, x, y){
  // prefer particles.js
  if (Particles && typeof Particles.scorePop === 'function'){
    try{ Particles.scorePop((delta>=0?`+${delta}`:`${delta}`), x, y); return; }catch{}
  }
  fxText(delta>=0?`+${delta}`:`${delta}`, x, y, { size:16, color: delta>=0?'#a7f3d0':'#fecaca', dy:-56, dur:620 });
}

function fxJudge(label, x, y, kind){
  const map = {
    PERFECT: { color:'#fde68a', size:18 },
    GOOD:    { color:'#86efac', size:16 },
    MISS:    { color:'#fca5a5', size:16 },
    POWER:   { color:'#93c5fd', size:16 }
  };
  const st = map[label] || { color:'#e5e7eb', size:16 };

  if (Particles && typeof Particles.judgeText === 'function'){
    try{ Particles.judgeText(label, x, y, kind); return; }catch{}
  }
  fxText(label, x, y-22, { size: st.size, color: st.color, dy:-40, dur:520 });
}

function fxBurst(kind, x, y){
  if (Particles && typeof Particles.burstAt === 'function'){
    try{ Particles.burstAt(x, y, { kind, power: 1.35 }); return; }catch{}
  }
  // fallback: burst เป็นข้อความจิ๋ว
  const t = kind === 'STAR' ? '✨' : (kind === 'SPLASH' ? '💦' : '💥');
  fxText(t, x, y, { size:18, color:'#e5e7eb', dy:-34, dur:420 });
}

function blink(type){
  const el = $('hvr-screen-blink');
  if (!el) return;
  el.className = '';
  el.classList.add(type || 'good');
  el.classList.add('on');
  ROOT.setTimeout(()=>{ try{ el.classList.remove('on'); }catch{} }, 110);
}

function pickDiff(d){
  d = String(d||'easy').toLowerCase();
  if (d === 'hard') return {
    goalGreenSec: 34,
    maxBadSec: 18,
    miniCombo: 10,
    miniPerfect: 6,
    miniNoJunkSec: 14,
    scorePerfect: 28,
    scoreGood: 16,
    penBad: -35,
    waterGood: +3.2,
    waterBad: -10.0,
    stormEverySec: 22,
    stormLenSec: 7
  };
  if (d === 'normal') return {
    goalGreenSec: 32,
    maxBadSec: 22,
    miniCombo: 9,
    miniPerfect: 5,
    miniNoJunkSec: 12,
    scorePerfect: 26,
    scoreGood: 14,
    penBad: -30,
    waterGood: +3.0,
    waterBad: -9.0,
    stormEverySec: 24,
    stormLenSec: 6
  };
  return {
    goalGreenSec: 28,
    maxBadSec: 26,
    miniCombo: 8,
    miniPerfect: 4,
    miniNoJunkSec: 10,
    scorePerfect: 24,
    scoreGood: 12,
    penBad: -26,
    waterGood: +2.7,
    waterBad: -8.0,
    stormEverySec: 26,
    stormLenSec: 6
  };
}

function gradeFromScore(score){
  score = Number(score)||0;
  if (score >= 2300) return 'SSS';
  if (score >= 1750) return 'SS';
  if (score >= 1350) return 'S';
  if (score >= 950)  return 'A';
  if (score >= 650)  return 'B';
  return 'C';
}
function gradeProgress(score){
  score = Number(score)||0;
  const tiers = [
    { g:'C',  min:0,    max:650 },
    { g:'B',  min:650,  max:950 },
    { g:'A',  min:950,  max:1350 },
    { g:'S',  min:1350, max:1750 },
    { g:'SS', min:1750, max:2300 },
    { g:'SSS',min:2300, max:2600 }
  ];
  let cur = tiers[0];
  for (const t of tiers){ if (score >= t.min) cur = t; }
  const span = Math.max(1, cur.max - cur.min);
  const pct = clamp((score - cur.min)/span, 0, 1);
  return { grade: gradeFromScore(score), pct, next: (cur.g==='SSS'?'MAX':cur.max) };
}

function hudSet(id,v){ const el=$(id); if(el) el.textContent=String(v); }
function hudQuest(goalText, miniText){
  const g=$('hha-quest-goal'); const m=$('hha-quest-mini');
  if(g) g.textContent = goalText || 'Goal: —';
  if(m) m.textContent = miniText || 'Mini: —';
}

export async function boot(opts = {}) {
  const diffKey = String(opts.difficulty || 'easy').toLowerCase();
  const duration = clamp(opts.duration ?? 90, 20, 180);
  const D = pickDiff(diffKey);

  ensureWaterGauge();
  ensureFallbackFxLayer(); // เผื่อ particles.js ไม่มา

  // PostFX
  const PostFX = ROOT.PostFXCanvas || null;
  try{
    PostFX && PostFX.init({
      zIndex: 46, blendMode:'screen', opacity: 1,
      strength: 1.05, chroma: 1.25, wobble: 0.85, scan: 0.55, vignette: 0.85, speedlines: 0.70,
      tiltEnabled: true
    });
  }catch{}

  const state = {
    timeLeft: duration,
    score: 0,
    combo: 0,
    comboMax: 0,
    miss: 0,

    water: 50,
    zoneCode: 'GREEN',

    greenTick: 0,
    redTick: 0,
    blueTick: 0,

    perfectCount: 0,
    lastJunkHitAt: now(),
    noJunkSec: 0,

    stormOn: false,
    nextStormAt: D.stormEverySec,
    stormLeft: 0,

    stopped: false
  };

  // HUD init
  hudSet('hha-goal-total', 2);
  hudSet('hha-mini-total', 3);
  hudSet('hha-goal-done', 0);
  hudSet('hha-mini-done', 0);
  hudSet('hha-score-main', 0);
  hudSet('hha-combo-max', 0);
  hudSet('hha-miss', 0);
  hudSet('hha-grade-badge', 'C');
  const gp = $('hha-grade-progress-fill');
  const gpt = $('hha-grade-progress-text');
  if (gp) gp.style.width = '0%';
  if (gpt) gpt.textContent = 'Progress to S: 0%';

  function updateGrade(){
    const g = gradeProgress(state.score);
    const badge = $('hha-grade-badge');
    if (badge) badge.textContent = g.grade;
    if (gp) gp.style.width = Math.round(g.pct*100)+'%';
    if (gpt){
      const nextLabel = (g.grade==='SSS') ? 'MAX' : `Next @ ${g.next}`;
      gpt.textContent = `Progress (${g.grade}) → ${nextLabel}: ${Math.round(g.pct*100)}%`;
    }
  }

  function setWater(v){
    state.water = clamp(v, 0, 100);
    const zc = zoneFrom(state.water); // LOW/GREEN/HIGH
    state.zoneCode = zc;

    const out = setWaterGauge(state.water);
    const label = zoneLabel(zc);

    const statusEl = $('hha-water-status');
    if (statusEl) statusEl.textContent = `${label} ${Math.round(out.pct)}%`;
    const zoneText = $('hha-water-zone-text');
    if (zoneText) zoneText.textContent = label;

    const fill = $('hha-water-fill');
    if (fill){
      if (zc === 'LOW') fill.style.background = 'linear-gradient(90deg, rgba(56,189,248,.95), rgba(96,165,250,.85))';
      else if (zc === 'HIGH') fill.style.background = 'linear-gradient(90deg, rgba(239,68,68,.95), rgba(245,158,11,.85))';
      else fill.style.background = 'linear-gradient(90deg, rgba(34,197,94,.95), rgba(96,165,250,.80))';
    }
  }

  function addScore(delta, x, y){
    delta = Number(delta)||0;
    state.score = Math.max(0, Math.round(state.score + delta));
    hudSet('hha-score-main', state.score);
    updateGrade();
    if (Number.isFinite(x) && Number.isFinite(y)) fxScore(delta, x, y);
  }

  function setCombo(v){
    state.combo = Math.max(0, v|0);
    state.comboMax = Math.max(state.comboMax, state.combo);
    hudSet('hha-combo-max', state.comboMax);
  }

  function addMiss(){
    state.miss++;
    hudSet('hha-miss', state.miss);
  }

  // quests (คงเดิม)
  const goals = [
    { id:'g1', label:`อยู่ GREEN ให้ครบ ${D.goalGreenSec}s`, done:false, check:()=> state.greenTick>=D.goalGreenSec },
    { id:'g2', label:`อยู่ BLUE/RED รวมไม่เกิน ${D.maxBadSec}s`, done:false,
      check:()=> (state.redTick+state.blueTick)<=D.maxBadSec && state.timeLeft<=0
    }
  ];
  const minis = [
    { id:'m1', label:`ทำ Combo ให้ถึง ${D.miniCombo}`, done:false, check:()=> state.comboMax>=D.miniCombo },
    { id:'m2', label:`Perfect ให้ครบ ${D.miniPerfect} ครั้ง`, done:false, check:()=> state.perfectCount>=D.miniPerfect },
    { id:'m3', label:`ห้ามโดน JUNK ${D.miniNoJunkSec}s`, done:false, check:()=> state.noJunkSec>=D.miniNoJunkSec }
  ];

  function updateQuestHud(){
    const g1=goals[0], g2=goals[1];
    const m1=minis[0], m2=minis[1], m3=minis[2];

    let goalLine = `Goal: ${g1.done?'✅':'⏳'} ${g1.label} (${state.greenTick}/${D.goalGreenSec})`;
    if (g1.done && !g2.done) goalLine = `Goal: ⏳ ${g2.label} (bad ${state.redTick+state.blueTick}/${D.maxBadSec})`;
    if (g1.done && g2.done) goalLine = `Goal: ✅ ผ่านครบ 2/2`;

    let miniLine = `Mini: ${m1.done?'✅':'⏳'} Combo ${state.comboMax}/${D.miniCombo} • ${m2.done?'✅':'⏳'} Perfect ${state.perfectCount}/${D.miniPerfect}`;
    miniLine += ` • ${m3.done?'✅':'⏳'} NoJunk ${state.noJunkSec}/${D.miniNoJunkSec}s`;

    hudQuest(goalLine, miniLine);
    hudSet('hha-goal-done', goals.filter(g=>g.done).length);
    hudSet('hha-mini-done', minis.filter(m=>m.done).length);
  }

  // storm control
  let inst = null;
  function setStorm(on){
    on = !!on;
    if (state.stormOn === on) return;
    state.stormOn = on;

    // postfx
    try{
      if (PostFX){
        PostFX.setStorm(on);
        if (on) PostFX.setParams({ chroma:1.55, wobble:1.15, speedlines:1.25, scan:0.62, vignette:0.92 });
        else PostFX.setParams({ chroma:1.25, wobble:0.85, speedlines:0.70, scan:0.55, vignette:0.85 });
      }
    }catch{}

    // ✅ สำคัญ: บอก mode-factory ให้เป้าส่ายแรง/เร็วขึ้น
    try{ inst && inst.setStorm && inst.setStorm(on); }catch{}

    if (on) state.stormLeft = D.stormLenSec;
  }

  // judge (คืน FX: burst + score + judgement)
  function judge(ch, ctx){
    const x = Number(ctx?.clientX ?? 0);
    const y = Number(ctx?.clientY ?? 0);

    const itemType = String(ctx?.itemType || (ctx?.isGood ? 'good' : 'bad'));
    const perfect  = !!ctx?.hitPerfect;
    const isPower  = !!ctx?.isPower;

    if (isPower || itemType === 'power'){
      blink('block');
      try{ PostFX && PostFX.flash('block'); }catch{}
      fxBurst('STAR', x, y);
      fxJudge('POWER', x, y, 'power');
      addScore(55, x, y);
      setCombo(state.combo + 1);
      setWater(state.water + 6.0);
      return;
    }

    if (itemType === 'bad' || ctx?.isGood === false){
      blink('bad');
      try{ PostFX && PostFX.flash('bad'); }catch{}
      fxBurst('SMOKE', x, y);
      fxJudge('MISS', x, y, 'bad');
      addMiss();
      setCombo(0);
      state.lastJunkHitAt = now();
      state.noJunkSec = 0;
      addScore(D.penBad, x, y);
      setWater(state.water + D.waterBad);
      return;
    }

    // good / fakeGood
    blink('good');

    const base = (itemType === 'fakeGood') ? 6 : D.scoreGood;
    const perfBonus = perfect ? D.scorePerfect : 0;
    const comboBonus = (itemType === 'fakeGood') ? 0 : Math.min(24, Math.floor(state.combo * 0.7));
    const delta = base + perfBonus + comboBonus;

    // burst mix (shard/particle)
    fxBurst(perfect ? 'STAR' : 'SPLASH', x, y);
    fxJudge(perfect ? 'PERFECT' : 'GOOD', x, y, 'good');
    addScore(delta, x, y);

    setCombo(state.combo + (itemType==='fakeGood' ? (perfect?1:0) : 1));
    setWater(state.water + (itemType==='fakeGood' ? 1.0 : D.waterGood));

    if (perfect){
      state.perfectCount++;
      // PERFECT: กระแทก chroma/wobble สั้น ๆ
      try{
        PostFX && PostFX.flash('good');
        PostFX && PostFX.setParams({ chroma:1.75, wobble: state.stormOn?1.35:1.05, speedlines: state.stormOn?1.45:0.95 });
      }catch{}
      ROOT.setTimeout(()=>{
        try{
          if (!PostFX) return;
          if (state.stormOn) PostFX.setParams({ chroma:1.55, wobble:1.15, speedlines:1.25 });
          else PostFX.setParams({ chroma:1.25, wobble:0.85, speedlines:0.70 });
        }catch{}
      }, 220);
    }
  }

  function onExpire(info){
    const itemType = String(info?.itemType || '');
    if (itemType === 'bad') setWater(state.water - 2.0);
  }

  // boot mode-factory (สำคัญ: excludeSelectors เพื่อ safe zone)
  const hostEl = $('hvr-playfield') || DOC.body;

  inst = await factoryBoot({
    modeKey:'hydration',
    difficulty: diffKey,
    duration,
    spawnHost: hostEl,
    pools: {
      good: ['💧','💦','🫧','🚰','🧊','🥒','🍉','🫐'],
      bad:  ['🥤','🧃','🍟','🍔','🍩','🍰','🧋','🍬'],
      trick:['💧','🫧']
    },
    powerups: ['⭐','🛡️'],
    goodRate: 0.68,
    powerRate: 0.10,
    trickRate: 0.09,
    allowAdaptive: true,

    // ✅ safe zone ไม่ทับ HUD (อ่านจาก selector)
    excludeSelectors: ['.hud', '#hvr-start', '#hvr-end'],

    // storm multiplier: ถี่ขึ้น
    spawnIntervalMul: ()=> state.stormOn ? 0.55 : 1.0,

    judge,
    onExpire
  });

  // init
  setWater(50);
  updateGrade();
  updateQuestHud();

  // time tick
  function onTime(ev){
    const sec = Number(ev?.detail?.sec ?? 0);
    state.timeLeft = sec;

    // ✅ zone timing (นับตาม zoneCode จริง)
    if (sec > 0){
      const zc = state.zoneCode;
      if (zc === 'GREEN') state.greenTick++;
      else if (zc === 'HIGH') state.redTick++;
      else if (zc === 'LOW') state.blueTick++;

      state.noJunkSec = clamp(Math.floor((now() - state.lastJunkHitAt)/1000), 0, 999);
    }

    // storm schedule
    const elapsed = duration - sec;
    if (!state.stormOn && elapsed >= state.nextStormAt && sec > 0){
      setStorm(true);
      state.nextStormAt += D.stormEverySec;
    }
    if (state.stormOn){
      if (state.stormLeft > 0) state.stormLeft--;
      if (state.stormLeft <= 0) setStorm(false);
    }

    // quest checks
    if (!goals[0].done && goals[0].check()){
      goals[0].done = true;
      try{ Particles && Particles.celebrate && Particles.celebrate('GOAL'); }catch{}
      try{ PostFX && PostFX.flash('good'); }catch{}
    }
    for (const m of minis){
      if (!m.done && m.check()){
        m.done = true;
        try{ Particles && Particles.celebrate && Particles.celebrate('MINI'); }catch{}
        try{ PostFX && PostFX.flash('block'); }catch{}
      }
    }

    updateQuestHud();

    if (sec <= 0 && !state.stopped){
      if (!goals[1].done && goals[1].check()) goals[1].done = true;
      state.stopped = true;

      try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
      try{ inst && inst.stop && inst.stop(); }catch{}
      try{ PostFX && PostFX.destroy && PostFX.destroy(); }catch{}

      const grade = gradeFromScore(state.score);
      try{
        ROOT.dispatchEvent(new CustomEvent('hha:end', { detail:{
          score: state.score,
          grade,
          comboBest: state.comboMax,
          miss: state.miss,
          water: Math.round(state.water),
          zone: zoneLabel(state.zoneCode),
          greenTick: state.greenTick,
          redTick: state.redTick,
          blueTick: state.blueTick,
          goalsDone: goals.filter(g=>g.done).length,
          goalsTotal: 2,
          minisDone: minis.filter(m=>m.done).length,
          minisTotal: 3
        }}));
      }catch{}
    }
  }

  ROOT.addEventListener('hha:time', onTime, { passive:true });

  return {
    stop(){
      try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
      try{ inst && inst.stop && inst.stop(); }catch{}
      try{ PostFX && PostFX.destroy && PostFX.destroy(); }catch{}
    }
  };
}

export default { boot };
