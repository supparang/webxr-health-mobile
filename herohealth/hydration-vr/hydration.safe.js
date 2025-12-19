// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM AimLayer Engine (PLAY MODE ready)
// Fixes:
// ✅ Fever/Shield update via global FeverUI (new/legacy)
// ✅ Aim layer: targets shift with deviceorientation + drag (like VR camera)
// ✅ Quest UI: emit quest:update + DOM fallback (goal/mini done/total)
// ✅ Uses mode-factory spawnHost = '#hvr-aim-layer'

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import { createHydrationQuest } from './hydration.quest.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const DOC  = ROOT.document;

function $(id){ return DOC ? DOC.getElementById(id) : null; }
function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

function getFeverUI(){
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;
}

function fx(){
  return (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) || ROOT.Particles || { scorePop(){}, burstAt(){} };
}

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function setText(id, txt){
  const el = $(id);
  if (el) el.textContent = String(txt ?? '');
}

function screenBlink(kind){
  const el = $('hvr-screen-blink');
  if (!el) return;
  el.classList.remove('good','bad','block','on');
  el.classList.add(kind || 'good');
  void el.offsetWidth;
  el.classList.add('on');
  setTimeout(()=> el.classList.remove('on'), 110);
}

function vibrate(pattern){
  try{ if (navigator && typeof navigator.vibrate === 'function') navigator.vibrate(pattern); }catch{}
}

// ===== Grade + ProgressToS (S=30%) =====
function calcProgressToS(score, miss){
  // “S 30%” แบบง่าย: สร้างคะแนนเป้าหมายตามเวลา/ความพลาด
  // ให้เด็กเห็นขึ้นเร็ว แต่ยังต้องรักษา miss ต่ำ
  const base = 1200;                 // ปรับได้
  const missPenalty = (miss|0) * 120;
  const target = Math.max(400, base + missPenalty);
  const pct = clamp((Number(score)||0) / target * 30, 0, 30); // S = 30%
  return { pctToS: pct, target, raw: clamp((Number(score)||0) / target * 100, 0, 999) };
}

function gradeFrom(score, miss){
  // โทนเด็ก ป.5: ไม่เครียดเกินไป
  const s = Number(score)||0;
  const m = miss|0;
  if (s >= 3200 && m <= 1) return 'SSS';
  if (s >= 2400 && m <= 2) return 'SS';
  if (s >= 1800 && m <= 3) return 'S';
  if (s >= 1200) return 'A';
  if (s >= 800)  return 'B';
  return 'C';
}

// ===== Aim (หมุน/ลาก) =====
function installAimController(){
  const play = $('hvr-playfield');
  const layer = $('hvr-aim-layer');
  if (!play || !layer) return { get(){ return {x:0,y:0}; }, dispose(){} };

  // aim offset in px (เลื่อนสนามเป้า)
  let ax = 0, ay = 0;
  let dragging = false;
  let sx = 0, sy = 0;
  let ox = 0, oy = 0;

  // config
  const MAX_X = 160;
  const MAX_Y = 120;

  function apply(){
    // ขยับทั้ง layer ให้เป้า “เลื่อนตาม” เหมือนกล้อง VR
    layer.style.transform = `translate(${ax.toFixed(1)}px, ${ay.toFixed(1)}px)`;
  }

  // --- Drag fallback (ทุกเครื่องเล่นได้) ---
  function onDown(e){
    dragging = true;
    sx = e.clientX || 0;
    sy = e.clientY || 0;
    ox = ax; oy = ay;
  }
  function onMove(e){
    if (!dragging) return;
    const dx = (e.clientX || 0) - sx;
    const dy = (e.clientY || 0) - sy;
    ax = clamp(ox + dx * 0.55, -MAX_X, MAX_X);
    ay = clamp(oy + dy * 0.55, -MAX_Y, MAX_Y);
    apply();
  }
  function onUp(){ dragging = false; }

  play.addEventListener('pointerdown', onDown, { passive:true });
  ROOT.addEventListener('pointermove', onMove, { passive:true });
  ROOT.addEventListener('pointerup', onUp, { passive:true });
  ROOT.addEventListener('pointercancel', onUp, { passive:true });

  // --- DeviceOrientation (มือถือ: หมุนแล้วเลื่อน) ---
  function onOri(ev){
    // gamma: ซ้ายขวา (-90..90), beta: หน้า-หลัง (-180..180)
    const g = Number(ev.gamma);
    const b = Number(ev.beta);
    if (!Number.isFinite(g) || !Number.isFinite(b)) return;

    // map → px
    const tx = clamp(g * 2.2, -MAX_X, MAX_X);
    const ty = clamp((b - 20) * 1.4, -MAX_Y, MAX_Y);

    // smoothing
    ax = ax * 0.78 + tx * 0.22;
    ay = ay * 0.78 + ty * 0.22;
    apply();
  }

  // ไม่ฝืนขอ permission ในนี้ (บางบราวเซอร์ต้องกดปุ่ม)
  // แต่ถ้าได้ event มา ก็ใช้ทันที
  ROOT.addEventListener('deviceorientation', onOri, true);

  apply();

  return {
    get(){ return { x: ax, y: ay }; },
    dispose(){
      play.removeEventListener('pointerdown', onDown);
      ROOT.removeEventListener('pointermove', onMove);
      ROOT.removeEventListener('pointerup', onUp);
      ROOT.removeEventListener('pointercancel', onUp);
      ROOT.removeEventListener('deviceorientation', onOri, true);
    }
  };
}

// ===== Main boot =====
export async function boot(opts = {}){
  if (!DOC) return;

  const difficulty = String(opts.difficulty || 'easy').toLowerCase();
  const duration   = clamp(opts.duration ?? 90, 20, 180);

  // bind HUD
  ensureWaterGauge();

  const FeverUI = getFeverUI();
  if (FeverUI && typeof FeverUI.ensureFeverBar === 'function') FeverUI.ensureFeverBar();

  const aim = installAimController();

  // host for targets = aim layer
  const hostSel = '#hvr-aim-layer';
  const hostEl = DOC.querySelector(hostSel);
  if (!hostEl) throw new Error('hvr-aim-layer not found');

  // ----- Game config -----
  // Pools: ดี/แย่ + powerups
  const pools = {
    good: ['💧','💧','💧','🍉','🥛','🥒','🍊','🍓'],
    bad:  ['🥤','🧃','🍭','🍩','🧋']
  };

  // powerups: shield + fever boost + score gem
  const powerups = ['🛡️','🔥','💎'];

  // ----- State -----
  let stopped = false;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let miss = 0;

  let shield = 0;

  let fever = 0;
  let feverActive = false;
  let feverEndsAt = 0;

  let water = 50; // %
  let zone  = 'GREEN';

  // Quest deck
  const quest = createHydrationQuest(difficulty);

  // init quest ui
  function updateQuestUI(){
    // ใช้ progress info จาก quest.js
    const g0 = quest.getGoalProgressInfo('goal-green-time');
    const m0 = quest.getMiniProgressInfo('mini-combo');

    const goalText = `Goal: โซนน้ำสีเขียว • ${g0.text}`;
    const miniText = `Mini: สายคอมโบ • ${m0.text}`;

    // DOM fallback
    setText('hha-quest-goal', goalText);
    setText('hha-quest-mini', miniText);

    // done/total (ให้ HUD ไม่เป็น 0/0)
    const goals = quest.getProgress('goals')._all || quest.goals || [];
    const minis = quest.getProgress('mini')._all || quest.minis || [];

    const goalDone = goals.filter(x=>x._done || x.done).length;
    const goalTotal = goals.length || 2;

    const miniDone = minis.filter(x=>x._done || x.done).length;
    const miniTotal = minis.length || 3;

    setText('hha-goal-done', goalDone);
    setText('hha-goal-total', goalTotal);
    setText('hha-mini-done', miniDone);
    setText('hha-mini-total', miniTotal);

    // event for hha-hud.js (ถ้าฟังอยู่)
    emit('quest:update', {
      goal: goalText,
      mini: miniText,
      goalDone, goalTotal,
      miniDone, miniTotal
    });
  }

  function updateScoreUI(){
    setText('hha-score-main', score|0);
    setText('hha-miss', miss|0);
    setText('hha-combo-max', comboMax|0);

    // water zone text
    setText('hha-water-zone-text', zone);

    // grade
    const g = gradeFrom(score, miss);
    setText('hha-grade-badge', g);

    // progress to S (S=30%)
    const p = calcProgressToS(score, miss);
    const pct = clamp(p.pctToS / 30 * 100, 0, 100);
    setText('hha-grade-progress-text', `Progress to S: ${pct.toFixed(0)}%`);
    const fill = $('hha-grade-progress-fill');
    if (fill) fill.style.width = pct.toFixed(1) + '%';

    // global HUD event (เผื่อเกมอื่นฟัง)
    emit('hha:score', { score, combo, comboMax, miss, water, zone, grade: g });
  }

  function setFeverUI(){
    const ui = FeverUI;
    if (!ui) return;

    // new API
    if (typeof ui.setFever === 'function') ui.setFever(fever);
    else if (typeof ui.add === 'function') {
      // legacy: add ได้อย่างเดียว → ทำให้ค่อย ๆ ขึ้นพอประมาณ
      // (ถ้า active แล้ว legacy จะ ignore อยู่แล้ว)
      // เราไม่สามารถ set absolute ได้ จึงไม่เรียกตรงนี้
    }

    if (typeof ui.setFeverActive === 'function') ui.setFeverActive(feverActive);
    if (typeof ui.setShield === 'function') ui.setShield(shield);
  }

  function addShield(n){
    shield = clamp((shield|0) + (n|0), 0, 9);
    setFeverUI();
  }

  function addFever(n){
    if (feverActive) return;
    const ui = FeverUI;

    fever = clamp(fever + (Number(n)||0), 0, 100);

    // update UI (new)
    if (ui && typeof ui.setFever === 'function') ui.setFever(fever);
    // legacy
    if (ui && typeof ui.add === 'function') ui.add(Number(n)||0);

    if (fever >= 100){
      feverActive = true;
      feverEndsAt = Date.now() + 6000;
      if (ui && typeof ui.setFeverActive === 'function') ui.setFeverActive(true);
      screenBlink('block');
      vibrate([14,20,14]);
      emit('hha:coach', { mood:'happy', text:'🔥 FEVER! ยิงแรงขึ้น + ได้โล่ 1!' });
      addShield(1);
    }
  }

  function endFeverIfNeeded(){
    if (!feverActive) return;
    if (Date.now() < feverEndsAt) return;
    feverActive = false;
    fever = 0;
    const ui = FeverUI;
    if (ui && typeof ui.setFever === 'function') ui.setFever(0);
    if (ui && typeof ui.setFeverActive === 'function') ui.setFeverActive(false);
  }

  function applyWater(delta){
    water = clamp(water + (Number(delta)||0), 0, 100);
    zone = zoneFrom(water);
    setWaterGauge(water);
  }

  // น้ำค่อย ๆ ลด (ถ้าไม่ยิงน้ำดี) → concept hydration
  function tickSecond(){
    if (stopped) return;
    endFeverIfNeeded();

    // natural drift: ค่อย ๆ แห้ง
    applyWater(-0.55);

    quest.second();
    updateQuestUI();
    updateScoreUI();
  }

  // clock from mode-factory
  function onTime(e){
    const sec = Number(e?.detail?.sec);
    if (!Number.isFinite(sec)) return;
    if (sec <= 0){
      stop();
      return;
    }
    // เรานับ 1 วินาทีต่อ event
    tickSecond();
  }
  ROOT.addEventListener('hha:time', onTime);

  // ===== Judge (hit handling) =====
  const GOOD_SET  = new Set(pools.good);
  const BAD_SET   = new Set(pools.bad);

  function judge(ch, ctx){
    if (stopped) return { scoreDelta: 0, label:'NONE' };

    const c = String(ch||'');
    const isPower = (c === '🛡️' || c === '🔥' || c === '💎');
    const isGood  = isPower || GOOD_SET.has(c);
    const isBad   = (!isPower && BAD_SET.has(c));

    // fever buff
    const mult = feverActive ? 2 : 1;

    // ---- Powerups ----
    if (isPower){
      if (c === '🛡️'){
        addShield(1);
        score += 40 * mult;
        combo += 1; comboMax = Math.max(comboMax, combo);
        addFever(10);
        screenBlink('block'); vibrate(16);
        emit('hha:judge', { label:'SHIELD', ch:c });
        quest.onGood();
        updateQuestUI(); updateScoreUI();
        return { scoreDelta: 40, label:'SHIELD', good:true };
      }
      if (c === '🔥'){
        addFever(35);
        score += 30 * mult;
        combo += 1; comboMax = Math.max(comboMax, combo);
        screenBlink('good'); vibrate(12);
        emit('hha:judge', { label:'FEVER+', ch:c });
        quest.onGood();
        updateQuestUI(); updateScoreUI();
        return { scoreDelta: 30, label:'FEVER+', good:true };
      }
      // 💎
      score += 60 * mult;
      combo += 1; comboMax = Math.max(comboMax, combo);
      addFever(12);
      screenBlink('good'); vibrate(10);
      emit('hha:judge', { label:'GEM', ch:c });
      quest.onGood();
      updateQuestUI(); updateScoreUI();
      return { scoreDelta: 60, label:'GEM', good:true };
    }

    // ---- Bad ----
    if (isBad){
      if (shield > 0){
        shield -= 1; setFeverUI();
        combo = 0;
        // block: น้ำยังขึ้นนิด ๆ แต่ไม่ miss
        applyWater(+3.5);
        screenBlink('block'); vibrate([12,18,12]);
        emit('hha:judge', { label:'BLOCK', ch:c });
        updateQuestUI(); updateScoreUI();
        return { scoreDelta: 0, label:'BLOCK', good:true };
      }

      miss += 1;
      combo = 0;
      score = Math.max(0, score - 25);
      applyWater(+10.0);    // น้ำหวาน → HIGH
      addFever(-8);         // (ถ้าใช้ setFever จะ clamp)
      screenBlink('bad'); vibrate([22,35,22]);
      quest.onJunk();
      updateQuestUI(); updateScoreUI();
      return { scoreDelta: -25, label:'MISS', good:false };
    }

    // ---- Good ----
    if (isGood){
      combo += 1;
      comboMax = Math.max(comboMax, combo);

      // perfect window: combo สูง
      const perfect = combo % 7 === 0;
      const add = perfect ? 40 : 22;
      score += add * mult;

      applyWater(+3.6);   // น้ำดี → ดันเข้า GREEN
      addFever(perfect ? 14 : 8);

      screenBlink('good'); vibrate(12);
      emit('hha:judge', { label: perfect ? 'PERFECT' : 'GOOD', ch:c });
      quest.onGood();
      quest.updateCombo(comboMax);
      quest.updateScore(score);

      updateQuestUI(); updateScoreUI();
      return { scoreDelta: add, label: perfect ? 'PERFECT' : 'GOOD', good:true };
    }

    // default
    return { scoreDelta: 0, label:'OK', good:true };
  }

  function onExpire(info){
    // ปล่อย “ของดี” หาย: ไม่ miss แต่เสียจังหวะ + น้ำค่อย ๆ แห้งแล้วอยู่ดี
    if (!info) return;

    // ถ้าเป็น junk หายเอง → ถือว่าดี (ไม่ต้องทำอะไร)
    if (info.isGood && !info.isPower){
      // ลงโทษนิด ๆ ให้เด็กอยากยิง
      score = Math.max(0, score - 6);
      combo = 0;
      emit('hha:judge', { label:'LATE', ch: info.ch });
      updateScoreUI();
    }
  }

  // ===== start mode-factory (spawn into aim layer) =====
  const modeInst = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,
    pools,
    goodRate: 0.68,
    powerups,
    powerRate: 0.14,
    powerEvery: 6,
    spawnHost: hostSel,
    judge,
    onExpire
  });

  // init UI
  setWaterGauge(water);
  setFeverUI();
  updateQuestUI();
  updateScoreUI();

  // expose instance for crosshair shooter
  const inst = {
    stop,
    shootCrosshair(){
      if (stopped) return false;
      const cross = $('hvr-crosshair');
      if (!cross) return false;
      const r = cross.getBoundingClientRect();
      const x = r.left + r.width/2;
      const y = r.top  + r.height/2;
      const el = DOC.elementFromPoint(x, y);
      const tgt = el && el.closest ? el.closest('.hvr-target') : null;
      if (!tgt) return false;

      try{
        tgt.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles:true, cancelable:true,
          clientX: x|0, clientY: y|0
        }));
      }catch{
        try{ tgt.click(); }catch{}
      }
      return true;
    },
    getState(){
      return { score, combo, comboMax, miss, water, zone, shield, fever, feverActive, aim: aim.get() };
    }
  };

  ROOT.HHA_ACTIVE_INST = inst;

  function stop(){
    if (stopped) return;
    stopped = true;

    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
    try{ aim.dispose(); }catch{}
    try{ if (modeInst && typeof modeInst.stop === 'function') modeInst.stop(); }catch{}

    emit('hha:end', { score, miss, comboMax, water, zone });
  }

  return inst;
}

export default { boot };
