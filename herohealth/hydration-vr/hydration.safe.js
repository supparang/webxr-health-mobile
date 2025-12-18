// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM Emoji (Crosshair-ready + Follow scroll/rotate)
// - spawn targets into #hvr-playfield (so scroll follows naturally)
// - on rotate/resize: relayout targets by ratio (rx/ry) so they stay inside playfield
// - Fever+Shield safe binding (works with updated /vr/ui-fever.js)
// - Progress to S (S 30%) bar under grade

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function $(id){ return DOC ? DOC.getElementById(id) : null; }

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, floatScore(){} };

function getFeverUI(){
  // รองรับทั้งแบบใหม่/เก่า
  const ui = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
  return ui;
}

function safeEnsureFever(){
  const ui = getFeverUI();
  try{
    if (ui && typeof ui.ensureFeverBar === 'function') ui.ensureFeverBar();
    else if (ui && typeof ui.setFever === 'function') ui.setFever(0);
  }catch{}
}

function setShield(n){
  const ui = getFeverUI();
  try{
    if (ui && typeof ui.setShield === 'function') ui.setShield(n|0);
    else {
      const el = $('hha-shield-count');
      if (el) el.textContent = String(n|0);
    }
  }catch{}
}

function setFever(v){
  const ui = getFeverUI();
  try{
    if (ui && typeof ui.setFever === 'function') ui.setFever(v);
  }catch{}
}

function setFeverActive(on){
  const ui = getFeverUI();
  try{
    if (ui && typeof ui.setFeverActive === 'function') ui.setFeverActive(!!on);
  }catch{}
}

function isFeverActive(){
  const ui = getFeverUI();
  try{
    if (ui && typeof ui.isActive === 'function') return !!ui.isActive();
  }catch{}
  return false;
}

function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

// --------------------------
// Grade + Progress to S (30%)
// --------------------------
function computeGrade(score, miss, comboBest, duration){
  // “เกมเด็ก ป.5” ให้รู้สึกว่าคะแนนดันขึ้นไว แต่พลาดมีผลจริง
  const perf = (score) + (comboBest * 12) - (miss * 35);

  // maxScore ประมาณคร่าว ๆ ตามเวลา
  const maxScore = Math.max(1, duration * 220);
  const sThreshold = maxScore * 0.30; // ✅ S 30%

  let g = 'C';
  if (perf >= maxScore * 0.95) g = 'SSS';
  else if (perf >= maxScore * 0.85) g = 'SS';
  else if (perf >= maxScore * 0.70) g = 'S';
  else if (perf >= maxScore * 0.55) g = 'A';
  else if (perf >= maxScore * 0.40) g = 'B';
  else g = 'C';

  const progToS = clamp(perf / Math.max(1, sThreshold), 0, 1);

  return { grade: g, perf, maxScore, sThreshold, progToS };
}

function renderGradeUI(gradeInfo){
  const badge = $('hha-grade-badge');
  if (badge) badge.textContent = gradeInfo.grade;

  const fill = $('hha-grade-progress-fill');
  if (fill) fill.style.width = (gradeInfo.progToS * 100).toFixed(0) + '%';
}

// --------------------------
// Targets follow rotate/resize (ratio relayout)
// --------------------------
function setupTargetRelayout(spawnHostSel = '#hvr-playfield'){
  if (!DOC) return () => {};

  const host = DOC.querySelector(spawnHostSel);
  if (!host) return () => {};

  // 1) whenever a target appears: store rx/ry ratio once
  const mo = new MutationObserver((mutList)=>{
    for (const mut of mutList){
      for (const n of mut.addedNodes){
        if (!n || n.nodeType !== 1) continue;
        const el = (n.classList && n.classList.contains('hvr-target')) ? n : (n.querySelector ? n.querySelector('.hvr-target') : null);
        if (!el) continue;

        // store ratio only if not exists
        if (el.dataset && (el.dataset.rx == null || el.dataset.ry == null)){
          const left = parseFloat(el.style.left || '0') || 0;
          const top  = parseFloat(el.style.top  || '0') || 0;

          const r = host.getBoundingClientRect();
          const w = Math.max(1, r.width);
          const h = Math.max(1, r.height);

          el.dataset.rx = String(clamp(left / w, 0, 1));
          el.dataset.ry = String(clamp(top  / h, 0, 1));
        }
      }
    }
  });
  mo.observe(host, { childList:true, subtree:true });

  function relayout(){
    const r = host.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);

    const list = host.querySelectorAll('.hvr-target');
    list.forEach(el=>{
      const rx = clamp(parseFloat(el.dataset.rx || '0.5'), 0, 1);
      const ry = clamp(parseFloat(el.dataset.ry || '0.5'), 0, 1);
      el.style.left = (rx * w) + 'px';
      el.style.top  = (ry * h) + 'px';
    });
  }

  // ✅ rotate/resize/URL bar changes (mobile) → relayout
  const onResize = () => { relayout(); };
  ROOT.addEventListener('resize', onResize);
  ROOT.addEventListener('orientationchange', onResize);

  // visualViewport changes (มือถือ) — ช่วยเยอะมาก
  const vv = ROOT.visualViewport;
  if (vv && typeof vv.addEventListener === 'function'){
    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
  }

  // first tick
  setTimeout(relayout, 80);

  return () => {
    try{ mo.disconnect(); }catch{}
    ROOT.removeEventListener('resize', onResize);
    ROOT.removeEventListener('orientationchange', onResize);
    if (vv && typeof vv.removeEventListener === 'function'){
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    }
  };
}

// --------------------------
// Main boot
// --------------------------
export async function boot(opts = {}){
  if (!DOC) return;

  const difficulty = String(opts.difficulty || 'normal').toLowerCase();
  const duration   = clamp(opts.duration || 80, 20, 180);

  // pools (เด็ก ป.5)
  const pools = {
    good: ['💧','🥛','🍉','🍊','🍏','🍓','🥥'],
    bad:  ['🥤','🧋','🍹','🧃','🍺'] // โชว์เป็น “เครื่องดื่มน้ำตาล”
  };
  const powerups = ['🛡️','⚡','⭐']; // shield / fever boost / score burst

  // state
  let score = 0;
  let combo = 0;
  let comboBest = 0;
  let miss = 0;

  let water = 50; // 0..100
  let shield = 0;
  let fever = 0;

  const quest = createHydrationQuest(difficulty);

  // init UI
  ensureWaterGauge();
  safeEnsureFever();
  setShield(shield);
  setFever(0);
  setFeverActive(false);

  // display totals
  const gt = $('hha-goal-total'); if (gt) gt.textContent = String(quest.goals.length);
  const mt = $('hha-mini-total'); if (mt) mt.textContent = String(quest.minis.length);

  function updateHUD(judgeLabel){
    // main HUD text
    const sEl = $('hha-score-main'); if (sEl) sEl.textContent = String(score|0);
    const cEl = $('hha-combo-max');  if (cEl) cEl.textContent = String(comboBest|0);
    const mEl = $('hha-miss');       if (mEl) mEl.textContent = String(miss|0);

    // quest done counts
    const goalsDone = quest.goals.filter(x=>x._done).length;
    const minisDone = quest.minis.filter(x=>x._done).length;

    const gd = $('hha-goal-done'); if (gd) gd.textContent = String(goalsDone);
    const md = $('hha-mini-done'); if (md) md.textContent = String(minisDone);

    // quest text
    const gActive = quest.goals.find(x=>!x._done) || quest.goals[0];
    const mActive = quest.minis.find(x=>!x._done) || quest.minis[0];
    const qg = $('hha-quest-goal'); if (qg) qg.textContent = 'Goal: ' + (gActive?.text || '—');
    const qm = $('hha-quest-mini'); if (qm) qm.textContent = 'Mini: ' + (mActive?.text || '—');

    // grade + progress to S
    const gi = computeGrade(score, miss, comboBest, duration);
    renderGradeUI(gi);

    // emit events for shared HUD systems
    dispatch('hha:score', { score, combo, comboMax: comboBest, miss, water, zone: zoneFrom(water), judge: judgeLabel || '' });
    dispatch('quest:update', {
      goalText: qg ? qg.textContent : '',
      miniText: qm ? qm.textContent : '',
      goalDone: goalsDone, goalTotal: quest.goals.length,
      miniDone: minisDone, miniTotal: quest.minis.length
    });
  }

  // coach helper
  function coachSay(text, mood='neutral'){
    dispatch('hha:coach', { text, mood });
    const bubble = $('hha-coach-text');
    if (bubble) bubble.textContent = text;
  }

  // screen blink (optional, controlled in HTML too)
  function judgeEvent(label, delta, x, y){
    dispatch('hha:judge', { label, delta, x, y });
    try{ Particles.scorePop(x, y, label, delta); }catch{}
  }

  // clock tick from mode-factory
  const onTime = (e)=>{
    const sec = Number(e?.detail?.sec);
    if (!Number.isFinite(sec)) return;
    quest.second();
    // water drift เล็กน้อย (บังคับให้เล่น)
    if (sec % 4 === 0){
      water = clamp(water - 1, 0, 100);
      setWaterGauge(water);
    }
    updateHUD('');
    if (sec <= 0){
      coachSay('หมดเวลาแล้ว! สรุปผลกันเลย 🎉', 'happy');
      dispatch('hha:end', { score, miss, comboBest, water, zone: zoneFrom(water), goalsDone: quest.goals.filter(x=>x._done).length, minisDone: quest.minis.filter(x=>x._done).length });
    }
  };
  ROOT.addEventListener('hha:time', onTime);

  // relayout targets on rotate/resize
  const cleanupRelayout = setupTargetRelayout('#hvr-playfield');

  // judge function (hit logic)
  function judge(ch, ctx){
    const isGood = !!ctx?.isGood;
    const isPower = !!ctx?.isPower;
    const x = Number(ctx?.clientX || ctx?.cx || (ROOT.innerWidth/2));
    const y = Number(ctx?.clientY || ctx?.cy || (ROOT.innerHeight/2));

    // fever: ได้คะแนนคูณ 2 + กัน miss จาก bad 1 ครั้ง
    const feverOn = isFeverActive();

    let label = 'GOOD';
    let delta = 0;

    if (isPower){
      // powerup type
      if (ch === '🛡️'){
        shield = clamp(shield + 1, 0, 9);
        setShield(shield);
        delta = 40 + (feverOn ? 20 : 0);
        score += delta;
        combo += 1; comboBest = Math.max(comboBest, combo);
        label = 'SHIELD +1';
        water = clamp(water + 6, 0, 100);
        quest.onGood();
      } else if (ch === '⚡'){
        // fever boost
        fever = clamp(fever + 45, 0, 100);
        setFever(fever);
        if (fever >= 100){ setFeverActive(true); }
        delta = 25;
        score += delta;
        combo += 1; comboBest = Math.max(comboBest, combo);
        label = 'FEVER!';
        water = clamp(water + 3, 0, 100);
        quest.onGood();
      } else {
        // ⭐ burst
        delta = 60 + (comboBest * 2);
        score += delta;
        combo += 1; comboBest = Math.max(comboBest, combo);
        label = 'STAR!';
        water = clamp(water + 4, 0, 100);
        quest.onGood();
      }
    }
    else if (isGood){
      // good
      delta = feverOn ? 22 : 12;
      score += delta;
      combo += 1;
      comboBest = Math.max(comboBest, combo);

      // fever build
      fever = clamp(fever + (feverOn ? 0 : 10), 0, 100);
      setFever(fever);
      if (fever >= 100){ setFeverActive(true); }

      water = clamp(water + 4, 0, 100);
      quest.onGood();

      label = (combo >= 8) ? 'PERFECT' : 'GOOD';
    }
    else{
      // bad
      if (shield > 0){
        shield--;
        setShield(shield);

        // block = no miss
        delta = feverOn ? 0 : 0;
        label = 'BLOCK';
        // น้ำหวานโดนแต่กันไว้ → water ลดนิดเดียว
        water = clamp(water - 2, 0, 100);

        // fever bonus เล็ก ๆ ให้เด็ก “รู้สึกเทพ”
        if (!feverOn){
          fever = clamp(fever + 8, 0, 100);
          setFever(fever);
          if (fever >= 100){ setFeverActive(true); }
        }
      } else {
        // miss
        miss++;
        combo = 0;

        delta = -(feverOn ? 10 : 22);
        score = Math.max(0, score + delta);

        label = 'MISS';
        water = clamp(water - (feverOn ? 6 : 10), 0, 100);

        quest.onJunk();
      }
    }

    // sync water gauge + zone
    setWaterGauge(water);

    // quest score/combo sync
    quest.updateScore(score);
    quest.updateCombo(comboBest);

    // FX + events
    judgeEvent(label, delta, x, y);
    updateHUD(label);

    return { label, scoreDelta: delta, good: isGood };
  }

  function onExpire(info){
    // good expire => miss; bad expire => no penalty
    const isGood = !!info?.isGood;
    const isPower = !!info?.isPower;
    if (isPower) return;

    if (isGood){
      miss++;
      combo = 0;
      score = Math.max(0, score - 10);
      water = clamp(water - 4, 0, 100);
      setWaterGauge(water);

      quest.onJunk(); // ถือว่าพลาดจังหวะ
      quest.updateScore(score);
      updateHUD('MISS');
      judgeEvent('MISS', -10, (ROOT.innerWidth/2)|0, (ROOT.innerHeight/2)|0);
    }
  }

  // start coaching
  coachSay('เล็งวงกลมกลางจอแล้ว “แตะจอเพื่อยิง” 💥 เก็บน้ำดี 💧 เลี่ยงน้ำหวาน 🥤', 'happy');

  // boot spawner (สำคัญ: spawnHost ลง playfield)
  const inst = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,
    pools,
    goodRate: 0.72,
    powerups,
    powerRate: 0.14,
    powerEvery: 6,
    spawnStyle: 'pop',
    judge,
    onExpire,

    // ✅ key: เป้าอยู่ใน playfield → เลื่อนจอแล้วตาม
    spawnHost: '#hvr-playfield'
  });

  // initial UI
  setWaterGauge(water);
  updateHUD('');

  // store active instance (เผื่อ debug)
  ROOT.HHA_ACTIVE_HYDRATION = inst;

  // cleanup handle
  const stop = () => {
    try{ inst && inst.stop && inst.stop(); }catch{}
    try{ cleanupRelayout && cleanupRelayout(); }catch{}
    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
  };

  return { stop };
}

export default { boot };
