// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR (DOM) — Play + Research Mode (Concept-locked)
// - spawn targets inside #hvr-playfield (ไม่ใช้ overlay)
// - water gauge เป็นแกนหลัก (LOW / GREEN / HIGH)
// - MISS = junk hit เท่านั้น (โหมดวิจัย/เล่นเหมือนกัน)
// - good expired: ไม่เป็น miss แต่ทำให้น้ำลด (concept ไม่ทิ้ง)
// - fever + shield ทำงานผ่าน window.FeverUI (IIFE)
// - crosshair ยิงได้จาก HTML
// - เป้าตามตอนหมุน/resize จอ: ทำผ่าน mode-factory ที่มี reflow (แนะนำให้ใส่ patch reflow ตามที่ส่งก่อนหน้า)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;

function clamp(v, min, max){
  v = Number(v) || 0;
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function $(id){ return document.getElementById(id); }

function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail: detail || {} })); }catch{}
}

// ===== FX / Fever =====
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, floatScore(){}, celebration(){} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  { ensureFeverBar(){}, setFever(){}, setFeverActive(){}, setShield(){}, getShield(){ return 0; }, isActive(){ return false; }, getValue(){ return 0; } };

// ===== Grade (S=30%) =====
const S_THRESHOLD = 0.30; // ✅ “S 30%”
function gradeFrom(p){
  if (p >= 0.60) return 'SSS';
  if (p >= 0.45) return 'SS';
  if (p >= 0.30) return 'S';
  if (p >= 0.22) return 'A';
  if (p >= 0.14) return 'B';
  return 'C';
}

function updateGradeUI(progress01){
  const badge = $('hha-grade-badge');
  if (badge) badge.textContent = gradeFrom(progress01);

  const fill = $('hha-grade-progress-fill');
  const txt  = $('hha-grade-progress-text');

  // Progress to S = progress / 0.30 (cap 100)
  const toS = clamp(progress01 / S_THRESHOLD, 0, 1);
  if (fill) fill.style.width = (toS * 100).toFixed(0) + '%';
  if (txt) txt.textContent = `Progress to S: ${(toS * 100).toFixed(0)}%`;
}

// ===== Coach helpers =====
function setCoach(text, mood='neutral'){
  dispatch('hha:coach', { text, mood });

  const el = $('hha-coach-text');
  if (el) el.textContent = text;

  // avatar (optional) ตามไฟล์ที่คุณใช้ในโปรเจค:
  // /herohealth/img/coach-neutral.png, coach-happy.png, coach-sad.png, coach-fever.png
  const av = $('hha-coach-avatar');
  if (av && !av.querySelector('img')){
    const img = document.createElement('img');
    img.alt = 'coach';
    img.src = `./img/coach-${mood}.png`;
    img.onerror = () => { /* ไม่เด้ง error */ };
    av.appendChild(img);
  } else if (av){
    const img = av.querySelector('img');
    if (img) img.src = `./img/coach-${mood}.png`;
  }
}

// ===== Main boot =====
export async function boot(opts = {}){
  const URLX = new URL(location.href);
  const diffKey = String(opts.difficulty || URLX.searchParams.get('diff') || 'easy').toLowerCase();

  const runMode = String(opts.runMode || URLX.searchParams.get('run') || 'play').toLowerCase(); // play | research
  const IS_RESEARCH = (runMode === 'research');

  const duration = clamp(parseInt(opts.duration || URLX.searchParams.get('time') || '80', 10), 20, 180);

  // Bind water HUD (header)
  ensureWaterGauge();

  // Init Fever/Shield UI
  FeverUI.ensureFeverBar();
  FeverUI.setFever(0);
  FeverUI.setFeverActive(false);
  FeverUI.setShield(0);

  // Quest deck
  const quest = createHydrationQuest(diffKey);

  // ===== State =====
  let stopped = false;

  let water = 50;                // 0..100
  let zone  = 'GREEN';

  let score = 0;
  let combo = 0;
  let comboMax = 0;

  let miss = 0;                  // ✅ MISS = junk hit only
  let goodExpired = 0;           // ✅ separate
  let junkExpired = 0;

  // scoring model: ให้ “น้ำ” เป็นแกนหลัก แต่ยังมีคะแนนให้สนุก
  const RULE = {
    goodHit:   { water:+3, score:+10, fever:+6 },
    junkHit:   { water:-7, score:-25, fever:-12 },
    goodExpire:{ water:-2, score:  0 },
    junkExpire:{ water:+0, score:  0 },

    // Play-only fun
    powerStar: { water:+2, score:+15, fever:+25 }, // ⭐ เติม fever
    powerShield: { shield:+1 }                     // 🛡️ เพิ่มเกราะ
  };

  // Progress metric (0..1) เพื่อ grade/Progress-to-S
  // ใช้ “ความสามารถรักษาน้ำ” + “ความแม่น (miss)” แบบไม่ช่วยมากใน research
  function computeProgress01(){
    // water closeness to GREEN (35..65)
    const w = clamp(water,0,100);
    const closeness = (w >= 35 && w <= 65) ? 1 : (w < 35 ? clamp(w/35,0,1) : clamp((100-w)/35,0,1));

    // miss penalty
    const totalActions = Math.max(1, (quest.stats.goodHits + quest.stats.junkHits));
    const missRate = clamp(miss / totalActions, 0, 1);
    const aim = clamp(1 - missRate, 0, 1);

    // รวมเป็น progress
    // research: เน้น water มากกว่า
    const p = IS_RESEARCH ? (0.75*closeness + 0.25*aim) : (0.60*closeness + 0.40*aim);
    return clamp(p,0,1);
  }

  function syncHUD(){
    const z = zoneFrom(water);
    zone = z;

    setWaterGauge(water); // update header

    // score block
    const sEl = $('hha-score-main'); if (sEl) sEl.textContent = String(score|0);
    const mEl = $('hha-miss');       if (mEl) mEl.textContent = String(miss|0);
    const cEl = $('hha-combo-max');  if (cEl) cEl.textContent = String(comboMax|0);
    const zEl = $('hha-water-zone-text'); if (zEl) zEl.textContent = zone;

    // grade + progress-to-S
    updateGradeUI(computeProgress01());

    // quest counters (จำนวนรวมคงที่)
    const gT = $('hha-goal-total'); if (gT) gT.textContent = String(quest.goals.length);
    const mT = $('hha-mini-total'); if (mT) mT.textContent = String(quest.minis.length);

    // done counts
    const gDone = quest.goals.filter(x=>x._done).length;
    const mDone = quest.minis.filter(x=>x._done).length;
    const gD = $('hha-goal-done'); if (gD) gD.textContent = String(gDone);
    const mD = $('hha-mini-done'); if (mD) mD.textContent = String(mDone);

    // quest text (โชว์ 1 goal + 1 mini แบบชัด)
    const curGoal = quest.goals.find(x=>!x._done) || quest.goals[0];
    const curMini = quest.minis.find(x=>!x._done) || quest.minis[0];

    const goalEl = $('hha-quest-goal');
    const miniEl = $('hha-quest-mini');

    if (goalEl && curGoal){
      const info = quest.getGoalProgressInfo(curGoal.id);
      goalEl.textContent = `Goal: ${curGoal.label} • ${info.text}`;
    }
    if (miniEl && curMini){
      const info = quest.getMiniProgressInfo(curMini.id);
      miniEl.textContent = `Mini: ${curMini.label} • ${info.text}`;
    }

    // dispatch unified score event (ให้ hha-hud.js ฟังได้)
    dispatch('hha:score', {
      modeKey: 'hydration',
      runMode,
      difficulty: diffKey,
      score, combo, comboMax,
      miss,
      water, zone,
      shield: (FeverUI.getShield ? FeverUI.getShield() : 0),
      fever: (FeverUI.getValue ? FeverUI.getValue() : 0),
      goodExpired,
      junkExpired
    });

    // quest update event
    dispatch('quest:update', {
      modeKey: 'hydration',
      goals: quest.goals,
      minis: quest.minis
    });
  }

  function blink(kind){
    const el = $('hvr-screen-blink');
    if (!el) return;
    el.classList.remove('good','bad','block','on');
    el.classList.add(kind || 'good');
    void el.offsetWidth;
    el.classList.add('on');
    setTimeout(()=> el.classList.remove('on'), 100);
  }

  function ping(){
    const c = $('hvr-crosshair');
    if (!c) return;
    c.classList.remove('ping');
    void c.offsetWidth;
    c.classList.add('ping');
  }

  // ===== judge() — called by mode-factory when player hits a target =====
  function judge(ch, ctx){
    if (stopped) return { scoreDelta:0, good:true, label:'STOP' };

    const isPower = !!ctx?.isPower;
    const isGood  = !!ctx?.isGood;

    // Powerups (Play only)
    if (!IS_RESEARCH && isPower){
      // ⭐ fever boost
      if (ch === '⭐'){
        FeverUI.setFever(clamp((FeverUI.getValue?.() || 0) + RULE.powerStar.fever, 0, 100));
        water = clamp(water + RULE.powerStar.water, 0, 100);
        score += RULE.powerStar.score;
        combo++; comboMax = Math.max(comboMax, combo);
        quest.onGood();
        ping(); blink('good');

        dispatch('hha:judge', { label:'POWER', kind:'STAR', ch, scoreDelta: RULE.powerStar.score });
        syncHUD();
        return { scoreDelta: RULE.powerStar.score, good:true, label:'POWER' };
      }

      // 🛡️ shield
      if (ch === '🛡️'){
        const cur = (FeverUI.getShield ? FeverUI.getShield() : 0) | 0;
        FeverUI.setShield(Math.min(9, cur + RULE.powerShield.shield));
        score += 8;
        combo++; comboMax = Math.max(comboMax, combo);
        quest.onGood();
        ping(); blink('block');

        dispatch('hha:judge', { label:'POWER', kind:'SHIELD', ch, scoreDelta: 8 });
        syncHUD();
        return { scoreDelta: 8, good:true, label:'POWER' };
      }
    }

    // junk hit
    if (!isGood){
      const sh = (FeverUI.getShield ? FeverUI.getShield() : 0) | 0;
      if (sh > 0 && !IS_RESEARCH){
        // ✅ block junk (ไม่เป็น miss)
        FeverUI.setShield(sh - 1);
        combo = 0;
        ping(); blink('block');
        dispatch('hha:judge', { label:'BLOCK', ch, scoreDelta:0 });
        syncHUD();
        return { scoreDelta:0, good:true, label:'BLOCK' };
      }

      // ✅ จริง: นับ miss เฉพาะ junk hit
      miss += 1;
      score += RULE.junkHit.score;
      water = clamp(water + RULE.junkHit.water, 0, 100);
      combo = 0;

      quest.onJunk();

      // fever penalty
      FeverUI.setFever(clamp((FeverUI.getValue?.() || 0) + RULE.junkHit.fever, 0, 100));

      // FX
      ping(); blink('bad');
      Particles.scorePop?.(ctx?.clientX || 0, ctx?.clientY || 0, RULE.junkHit.score, 'MISS');
      dispatch('hha:judge', { label:'MISS', ch, scoreDelta: RULE.junkHit.score });

      syncHUD();
      return { scoreDelta: RULE.junkHit.score, good:false, label:'MISS' };
    }

    // good hit
    score += RULE.goodHit.score;
    water = clamp(water + RULE.goodHit.water, 0, 100);
    combo++; comboMax = Math.max(comboMax, combo);

    quest.onGood();
    quest.updateCombo(comboMax);
    quest.updateScore(score);

    // fever add
    FeverUI.setFever(clamp((FeverUI.getValue?.() || 0) + RULE.goodHit.fever, 0, 100));

    ping(); blink('good');
    Particles.scorePop?.(ctx?.clientX || 0, ctx?.clientY || 0, RULE.goodHit.score, 'GOOD');
    dispatch('hha:judge', { label:'GOOD', ch, scoreDelta: RULE.goodHit.score });

    syncHUD();
    return { scoreDelta: RULE.goodHit.score, good:true, label:'GOOD' };
  }

  // ===== expire handler =====
  function onExpire(info){
    if (stopped) return;
    const isGood = !!info?.isGood;
    const isPower = !!info?.isPower;

    // powerups ถ้าหายไป -> ไม่ลงโทษ
    if (isPower) { syncHUD(); return; }

    if (isGood){
      // ✅ good expired: ไม่เป็น miss แต่ทำให้น้ำลด (concept)
      goodExpired++;
      water = clamp(water + RULE.goodExpire.water, 0, 100);
      // combo ไม่ตัด (เพราะไม่ได้ “ยิงพลาด”) แต่ความช้าโดน water แล้ว
      dispatch('hha:judge', { label:'EXPIRE', kind:'GOOD', ch: info?.ch || 'good', scoreDelta:0 });
    }else{
      junkExpired++;
      water = clamp(water + RULE.junkExpire.water, 0, 100);
      dispatch('hha:judge', { label:'EXPIRE', kind:'JUNK', ch: info?.ch || 'junk', scoreDelta:0 });
    }

    syncHUD();
  }

  // ===== pools & mode tuning =====
  const pools = {
    good: ['💧','🥛','🍉','🥥','🫐'],
    bad:  ['🥤','🧋','🧃','🍭']
  };

  // Play: มี powerups, Research: ไม่มี powerups
  const powerups = IS_RESEARCH ? [] : ['⭐','🛡️'];

  // ✅ ล็อก concept โหมดวิจัย (ไม่ช่วยผู้เล่น)
  const goodRate = IS_RESEARCH ? 0.62 : 0.66;

  // Boot spawner
  const inst = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diffKey,
    duration,

    // ✅ spawn ลง playfield (ไม่ overlay)
    spawnHost: '#hvr-playfield',

    pools,
    goodRate,

    powerups,
    powerRate: IS_RESEARCH ? 0 : 0.10,
    powerEvery: IS_RESEARCH ? 9999 : 7,

    // ถ้า mode-factory รองรับ disableAdaptive จะล็อกให้เลย (ไม่มีก็ไม่พัง)
    disableAdaptive: IS_RESEARCH,

    judge,
    onExpire
  });

  // expose for debug/stop
  ROOT.HHA_ACTIVE_INST = inst;

  // ===== time tick from mode-factory =====
  let lastSec = null;

  function onTime(e){
    if (stopped) return;
    const sec = e?.detail?.sec;
    if (!Number.isFinite(sec)) return;

    // init
    if (lastSec == null) lastSec = sec;

    // detect 1-second step
    if (sec !== lastSec){
      // every second: update quest timing
      quest.second();

      // zone update + greenTick
      const z = zoneFrom(water);
      quest.stats.zone = z;
      if (z === 'GREEN'){
        quest.stats.greenTick += 1;
      }
      // update combo/score into quest
      quest.updateScore(score);
      quest.updateCombo(comboMax);

      // coach hint บางจังหวะ
      const t = quest.stats.timeSec;
      if (t === 2){
        setCoach(IS_RESEARCH
          ? 'โหมดวิจัย: รักษา Water ให้อยู่ GREEN ให้มากที่สุด 💧 (ไม่มีตัวช่วยพิเศษ)'
          : 'แตะจอที่ไหนก็ยิงจากวงเล็ง ○ เลือกน้ำดี เลี่ยงน้ำหวาน! 💧');
      }
      if (!IS_RESEARCH && (t % 10 === 0)){
        const sh = (FeverUI.getShield ? FeverUI.getShield() : 0) | 0;
        if (sh > 0) setCoach(`มีเกราะ ${sh} อัน! ถ้าโดน 🥤 จะบล็อกได้ 🛡️`, 'happy');
        else setCoach(`คุมโซน GREEN ไว้! ถ้าเริ่ม LOW/HIGH ให้รีบเก็บน้ำดี 💧`, 'neutral');
      }

      // sync HUD
      syncHUD();

      lastSec = sec;
    }

    // end
    if (sec <= 0){
      endGame();
    }
  }

  ROOT.addEventListener('hha:time', onTime);

  function endGame(){
    if (stopped) return;
    stopped = true;

    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
    try{ inst?.stop?.(); }catch{}

    const progress01 = computeProgress01();
    const grade = gradeFrom(progress01);

    setCoach(`จบเกมแล้ว! ได้เกรด ${grade} • โซนน้ำ ${zone} 💧`, (grade === 'SSS' || grade === 'SS' || grade === 'S') ? 'happy' : 'neutral');

    dispatch('hha:end', {
      modeKey: 'hydration',
      runMode,
      difficulty: diffKey,
      duration,
      score, comboMax,
      miss,
      water, zone,
      goodExpired,
      junkExpired,
      grade,
      progress01
    });

    // celebration (เบา ๆ)
    try{ Particles.celebration?.(); }catch{}
  }

  // initial paint
  setCoach(IS_RESEARCH
    ? 'โหมดวิจัย: รักษา Water ให้อยู่ GREEN ให้มากที่สุด 💧 (ไม่มี power-ups)'
    : 'แตะจอที่ไหนก็ยิงจากวงเล็ง ○ เก็บน้ำดี 💧 เลี่ยงน้ำหวาน 🥤');
  syncHUD();

  return {
    stop(){
      try{ endGame(); }catch{}
    }
  };
}

export default { boot };
