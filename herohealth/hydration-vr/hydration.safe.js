// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR (PLAY MODE) — Production-safe
// ✅ DOM emoji sticker targets (spawnStyle:'emoji')
// ✅ VR-look: drag-to-look + deviceorientation + crosshair shoot
// ✅ Goals 2 + Core Minis 3 + Chain Minis (fail เฉพาะ junk hit)
// ✅ HUD update (#hha-*) + End overlay event (hha:end)
// ✅ FX: screen blink + near-end shake/tick

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){} };

function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }
function now(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
function $(id){ return DOC ? DOC.getElementById(id) : null; }

function setText(id, txt){
  const el = $(id);
  if (el) el.textContent = String(txt);
}
function setBlink(type){
  const el = $('hvr-screen-blink');
  if (!el) return;
  el.className = '';
  el.classList.add(type, 'on');
  ROOT.setTimeout(()=>{ try{ el.classList.remove('on'); }catch{} }, 110);
}
function setShake(on){
  const wrap = $('hvr-wrap');
  if (!wrap) return;
  if (on) wrap.classList.add('shake');
  else wrap.classList.remove('shake');
}

// tiny tick (WebAudio) — optional
function beep(freq=880, ms=45, gain=0.06){
  try{
    const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
    if (!AC) return;
    const ac = beep.__ac || (beep.__ac = new AC());
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g); g.connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + ms/1000);
  }catch{}
}

function zoneFromWater(w){
  // GREEN = 40..60 (สมดุล), YELLOW = 25..39 or 61..75, RED = outside
  w = clamp(w,0,100);
  if (w >= 40 && w <= 60) return 'GREEN';
  if ((w >= 25 && w < 40) || (w > 60 && w <= 75)) return 'YELLOW';
  return 'RED';
}

function gradeFromProg(p){ // p = 0..100
  if (p >= 97) return 'SSS';
  if (p >= 90) return 'SS';
  if (p >= 80) return 'S';
  if (p >= 65) return 'A';
  if (p >= 45) return 'B';
  return 'C';
}

function diffNums(diff){
  diff = String(diff||'normal').toLowerCase();
  if (diff === 'easy') {
    return {
      // goals
      goalGreenSec: 20,
      goalOutsideLimit: 28,
      // minis
      miniCombo: 8,
      miniSprintHits: 6,
      miniSprintSec: 10,
      miniSurpriseNoJunkSec: 10,
      // scoring
      goodBase: 10,
      goodPerfect: 16,
      badPenalty: -14,
      waterGood: +6,
      waterBad: -10,
      // shield blocks
      shieldAdd: 2
    };
  }
  if (diff === 'hard') {
    return {
      goalGreenSec: 34,
      goalOutsideLimit: 18,
      miniCombo: 12,
      miniSprintHits: 8,
      miniSprintSec: 9,
      miniSurpriseNoJunkSec: 12,
      goodBase: 12,
      goodPerfect: 20,
      badPenalty: -18,
      waterGood: +5,
      waterBad: -12,
      shieldAdd: 2
    };
  }
  return {
    goalGreenSec: 28,
    goalOutsideLimit: 22,
    miniCombo: 10,
    miniSprintHits: 7,
    miniSprintSec: 10,
    miniSurpriseNoJunkSec: 11,
    goodBase: 11,
    goodPerfect: 18,
    badPenalty: -16,
    waterGood: +6,
    waterBad: -11,
    shieldAdd: 2
  };
}

export async function boot(opts = {}){
  if (!DOC) return { stop(){} };

  const diff = String(opts.difficulty || 'easy').toLowerCase();
  const duration = clamp(opts.duration ?? 90, 30, 180);

  const D = diffNums(diff);

  // ----- HUD init -----
  setText('hha-goal-total', 2);
  setText('hha-mini-total', 3);
  setText('hha-goal-done', 0);
  setText('hha-mini-done', 0);
  setText('hha-score-main', 0);
  setText('hha-combo-max', 0);
  setText('hha-miss', 0);

  // ----- Game state -----
  const S = {
    startedAt: now(),
    ended: false,

    // points
    score: 0,
    progPct: 0,
    grade: 'C',

    // combo
    combo: 0,
    comboBest: 0,

    // hits
    goodHits: 0,
    badHits: 0,
    miss: 0,

    // water/zone
    water: 50,
    zone: 'GREEN',
    greenTick: 0,
    outsideTick: 0, // time outside GREEN

    // fever/shield
    fever: 0,
    shield: 0,

    // time
    secLeft: duration,
    tickTimer: null,
    nearEndOn: false,

    // storm
    stormLeft: 0,
    stormIntervalMul: 1,
    stormCooldown: 0,

    // goals/minis
    goalsDone: 0,
    goalsTotal: 2,
    minisDone: 0,
    minisTotal: 3,

    // core mini bookkeeping
    miniIndex: 0,
    miniState: null,
    surpriseDone: false,

    // chain minis
    chainMode: false,
    chainCleared: 0,
    chainFailed: 0,
    chainActive: null,
    chainProgress: 0
  };

  // ----- Quest definitions -----
  const goals = [
    {
      id: 'g1',
      label: `อยู่ GREEN ให้ครบ ${D.goalGreenSec}s 💧`,
      hint: 'รักษาน้ำให้อยู่โซนสมดุล',
      eval: () => S.greenTick,
      target: D.goalGreenSec
    },
    {
      id: 'g2',
      label: `อยู่นอก GREEN ไม่เกิน ${D.goalOutsideLimit}s ⚠️`,
      hint: 'อย่าแกว่งไป YELLOW/RED นาน',
      eval: () => S.outsideTick,
      target: D.goalOutsideLimit,
      inverse: true // ต้อง <= target
    }
  ];

  const minis = [
    {
      id: 'm1',
      label: `ทำคอมโบให้ถึง ${D.miniCombo} 🔥`,
      hint: 'ห้ามพลาด (โดน JUNK จะตัดคอมโบ)',
      check: () => (S.comboBest >= D.miniCombo)
    },
    {
      id: 'm2',
      label: `กดน้ำดี ${D.miniSprintHits} ใน ${D.miniSprintSec}s ⚡`,
      hint: 'เร่งสปีดช่วงสั้น ๆ',
      init: () => ({ t: D.miniSprintSec, got: 0 }),
      onHitGood: (st) => { st.got++; },
      tick: (st) => { st.t--; },
      done: (st) => (st.got >= D.miniSprintHits),
      fail: (st) => (st.t <= 0 && st.got < D.miniSprintHits)
    },
    {
      id: 'm3',
      label: `Surprise: ห้ามโดน JUNK ${D.miniSurpriseNoJunkSec}s 🛡️`,
      hint: 'ตั้งสติ! รักษาคอมโบ + อย่าพลาด',
      init: () => ({ t: D.miniSurpriseNoJunkSec, ok: true }),
      onHitBad: (st) => { st.ok = false; },
      tick: (st) => { st.t--; },
      done: (st) => (st.t <= 0 && st.ok),
      fail: (st) => (st.t <= 0 && !st.ok)
    }
  ];

  const chainDefs = [
    {
      id:'c1',
      label:'Chain: เก็บน้ำดี 8 ครั้ง (ห้าม JUNK) 🟩',
      init:()=>({ need:8, got:0 }),
      onGood:(st)=>{ st.got++; },
      done:(st)=> st.got>=st.need
    },
    {
      id:'c2',
      label:'Chain: PERFECT 3 ครั้งติด ✨',
      init:()=>({ need:3, got:0 }),
      onGood:(st, ctx)=>{ st.got = (ctx.hitPerfect ? st.got+1 : 0); },
      done:(st)=> st.got>=st.need
    },
    {
      id:'c3',
      label:'Chain: อยู่ GREEN 10s ต่อเนื่อง 💧',
      init:()=>({ need:10, t:0 }),
      onTick:(st)=>{ if (S.zone==='GREEN') st.t++; else st.t=0; },
      done:(st)=> st.t>=st.need
    }
  ];

  function setGoalHUD(){
    const g1 = goals[0], g2 = goals[1];
    const g1v = g1.eval();
    const g2v = g2.eval();
    const g1ok = (g1v >= g1.target);
    const g2ok = (g2v <= g2.target);

    // ทำให้ “ผ่านได้ทั้งคู่” (ประเมินทุกวิ)
    S.goalsDone = (g1ok?1:0) + (g2ok?1:0);
    setText('hha-goal-done', S.goalsDone);

    setText('hha-quest-goal',
      `Goal: ${g1.label} (${g1v}/${g1.target}) • ${g2.label} (${g2v}/${g2.target})`
    );
  }

  function currentMini(){
    return minis[clamp(S.miniIndex, 0, minis.length-1)];
  }

  function setMiniHUD(){
    if (!S.chainMode){
      const m = currentMini();
      if (!m) { setText('hha-quest-mini', 'Mini: —'); return; }

      if (m.id === 'm2' && S.miniState){
        setText('hha-quest-mini', `Mini: ${m.label} (${S.miniState.got}/${D.miniSprintHits} • ${S.miniState.t}s)`);
      } else if (m.id === 'm3' && S.miniState){
        setText('hha-quest-mini', `Mini: ${m.label} (${S.miniState.t}s)`);
      } else {
        setText('hha-quest-mini', `Mini: ${m.label}`);
      }
    } else {
      const c = S.chainActive;
      if (c && c.def){
        const st = c.state || {};
        const hint =
          (c.def.id==='c1') ? `${st.got||0}/${st.need||8}` :
          (c.def.id==='c2') ? `${st.got||0}/${st.need||3}` :
          (c.def.id==='c3') ? `${st.t||0}/${st.need||10}` : '';
        setText('hha-quest-mini', `Mini: ${c.def.label} ${hint?`(${hint})`:''}`);
      } else {
        setText('hha-quest-mini', 'Mini: Chain…');
      }
    }

    setText('hha-mini-done', S.minisDone);
  }

  function updateWaterHUD(){
    const w = clamp(S.water,0,100);
    const z = zoneFromWater(w);
    S.zone = z;

    const fill = $('hha-water-fill');
    if (fill) fill.style.width = `${w}%`;

    setText('hha-water-status', `${z} ${Math.round(w)}%`);
    setText('hha-water-zone-text', z);
  }

  function calcProgress(){
    // โปรเกรส: เอาคะแนน + goals/minis/chain มาสร้าง % (0..100)
    // ตั้งให้ “S” แถว 80+ โดยรวม (สะใจขึ้น)
    const base = clamp(S.score / 900, 0, 1); // 900 pts ~ 100%
    const bonus = (S.goalsDone * 0.12) + (S.minisDone * 0.10) + (clamp(S.chainCleared,0,12) * 0.015);
    const p = clamp((base + bonus) * 100, 0, 100);
    S.progPct = p;
    S.grade = gradeFromProg(p);

    setText('hha-grade-badge', S.grade);
    const fill = $('hha-grade-progress-fill');
    if (fill) fill.style.width = `${Math.round(p)}%`;
    setText('hha-grade-progress-text', `Progress: ${Math.round(p)}% • Grade ${S.grade}`);
  }

  function addScore(delta, x, y, label){
    delta = Number(delta)||0;
    S.score = Math.max(0, S.score + delta);
    setText('hha-score-main', Math.round(S.score));

    if (x != null && y != null && delta !== 0){
      try{
        Particles.scorePop(x, y, (delta>0?`+${delta}`:`${delta}`), label || '');
      }catch{}
    }
    calcProgress();
  }

  function onComboUpdate(){
    if (S.combo > S.comboBest) S.comboBest = S.combo;
    setText('hha-combo-max', S.comboBest);
  }

  function startMini(m){
    if (!m) return;
    S.miniState = (typeof m.init === 'function') ? m.init() : null;
    setMiniHUD();
  }

  function passMini(){
    S.minisDone = clamp(S.minisDone + 1, 0, S.minisTotal);
    setText('hha-mini-done', S.minisDone);
    addScore(90, null, null, 'MINI!');
    try{ Particles.celebrate && Particles.celebrate('mini'); }catch{}

    // เลื่อนไป mini ถัดไป
    S.miniIndex++;
    if (S.miniIndex >= minis.length){
      // เข้า chain mode
      S.chainMode = true;
      S.chainActive = null;
      pickNextChain();
    } else {
      startMini(currentMini());
    }
    setMiniHUD();
  }

  function failMini(){
    // โหมดนี้ “ไม่แพ้” จาก mini fail แค่ให้คะแนนน้อยลง/รีสตาร์ท mini
    addScore(-30, null, null, 'MISS');
    // restart mini เดิม
    startMini(currentMini());
  }

  function pickNextChain(){
    const def = chainDefs[Math.floor(Math.random()*chainDefs.length)];
    S.chainActive = { def, state: def.init() };
    setMiniHUD();
  }

  function passChain(){
    S.chainCleared++;
    addScore(60, null, null, 'CHAIN!');
    try{ Particles.celebrate && Particles.celebrate('chain'); }catch{}
    pickNextChain();
  }

  // ----- start first mini -----
  startMini(currentMini());
  setGoalHUD();
  updateWaterHUD();
  calcProgress();
  setMiniHUD();

  // ----- storm scheduler -----
  function tickStorm(){
    if (S.stormLeft > 0){
      S.stormLeft--;
      if (S.stormLeft <= 0){
        S.stormIntervalMul = 1;
        S.stormCooldown = 10; // กัน storm ถี่เกิน
      }
      return;
    }
    if (S.stormCooldown > 0){
      S.stormCooldown--;
      return;
    }
    // random storm (ประมาณทุก 15-25 วิ)
    if (Math.random() < 0.18){
      S.stormLeft = 6;          // 6s storm
      S.stormIntervalMul = 0.62; // spawn ถี่ขึ้นจริง
    }
  }

  // ----- main clock (เราใช้ clock ของเกมเอง เพื่อรองรับ “⏱️ เพิ่มเวลา”) -----
  function tick(){
    if (S.ended) return;

    // near end FX
    if (S.secLeft <= 8 && S.secLeft > 0){
      if (!S.nearEndOn){
        S.nearEndOn = true;
      }
      setShake(true);
      beep(880 + (8 - S.secLeft)*40, 40, 0.05);
    } else {
      setShake(false);
    }

    // storm tick
    tickStorm();

    // green/outside tick (นับตามโซนปัจจุบัน)
    if (S.zone === 'GREEN') S.greenTick++;
    else S.outsideTick++;

    // update goals HUD every sec
    setGoalHUD();

    // mini tick
    if (!S.chainMode){
      const m = currentMini();
      if (m && S.miniState){
        if (typeof m.tick === 'function') m.tick(S.miniState);
        // done/fail?
        const done = (typeof m.done === 'function') ? m.done(S.miniState) : false;
        const fail = (typeof m.fail === 'function') ? m.fail(S.miniState) : false;
        if (done) passMini();
        else if (fail) failMini();
      } else {
        // m1 แบบไม่มี state: เช็คผ่านทุกวิ
        const m1 = minis[0];
        if (m1 && m1.check && m1.check()) passMini();
      }
      setMiniHUD();
    } else {
      // chain tick
      const c = S.chainActive;
      if (c && c.def && c.state){
        if (c.def.onTick) c.def.onTick(c.state);
        if (c.def.done && c.def.done(c.state)) passChain();
      }
      setMiniHUD();
    }

    // end?
    S.secLeft--;
    if (S.secLeft <= 0){
      endGame();
    }
  }

  // ----- create spawner (mode-factory) -----
  const spawner = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diff,

    // ใส่ buffer เผื่อ ⏱️ เพิ่มเวลาได้ (เราเป็นคนหยุดเอง)
    duration: duration + 30,

    spawnHost: '#hvr-playfield',

    // ✅ target style + VR feel
    spawnStyle: 'emoji',
    dragToLook: true,
    orientToLook: true,
    tapToShoot: true,
    lookMaxPx: 140,
    lookSmoothing: 0.16,
    lookInertia: 0.86,

    // ✅ safe zone: กันทับ HUD / overlays
    excludeSelectors: ['.hud', '#hvr-start', '#hvr-end', '#hvr-crosshair'],

    pools: {
      good: ['💧','🥛','🍉','🥥','🍊','🫧'],
      bad:  ['🥤','🧋','🍟','🍔','🍩','🌀'],
      // trick: ['💧','💧','💧']
    },

    goodRate: (diff === 'hard') ? 0.55 : (diff === 'easy' ? 0.70 : 0.62),

    powerups: ['⭐','🛡️','⏱️'],
    powerRate: (diff === 'hard') ? 0.10 : 0.12,
    powerEvery: 6,

    // storm ทำให้ spawn ถี่ขึ้นจริง
    spawnIntervalMul: () => (S.stormLeft > 0 ? S.stormIntervalMul : 1),

    judge: (ch, ctx) => {
      // ctx: { clientX,clientY, hitPerfect, itemType, isGood,isPower, hitDistNorm, targetRect }
      const x = ctx?.clientX ?? (ctx?.targetRect?.left ?? 0) + 40;
      const y = ctx?.clientY ?? (ctx?.targetRect?.top ?? 0) + 40;

      const itemType = String(ctx?.itemType || '');
      const isPower = !!ctx?.isPower || (itemType === 'power');

      // POWERUP
      if (isPower){
        setBlink('good');
        if (ch === '🛡️'){
          S.shield = clamp(S.shield + D.shieldAdd, 0, 9);
          addScore(35, x, y, 'SHIELD');
        } else if (ch === '⏱️'){
          // ✅ เพิ่มเวลาเกม (ของเราเอง)
          S.secLeft = clamp(S.secLeft + 3, 0, duration + 30);
          addScore(28, x, y, 'TIME+');
          setShake(false);
        } else {
          addScore(30, x, y, 'BONUS');
        }
        // power ไม่ตัดคอมโบ
        S.combo++;
        onComboUpdate();
        return { good:true, scoreDelta: 0 };
      }

      // GOOD
      if (ctx?.isGood){
        const perfect = !!ctx?.hitPerfect;
        const base = perfect ? D.goodPerfect : D.goodBase;

        // streak bonus ถ้าอยู่ GREEN (โซนสมดุล)
        const zoneBonus = (S.zone === 'GREEN') ? 2 : 0;
        const comboBonus = clamp(Math.floor(S.combo * 0.8), 0, 10);

        S.goodHits++;
        S.combo++;
        onComboUpdate();

        // water + fever
        S.water = clamp(S.water + D.waterGood, 0, 100);
        S.fever = clamp(S.fever + (perfect ? 7 : 5), 0, 100);

        updateWaterHUD();

        setBlink('good');
        addScore(base + zoneBonus + comboBonus, x, y, perfect ? 'PERFECT' : 'GOOD');

        // mini hooks
        if (!S.chainMode){
          const m = currentMini();
          if (m && m.onHitGood && S.miniState) m.onHitGood(S.miniState, ctx);
          // m1 check on fly
          if (S.miniIndex === 0 && minis[0].check && minis[0].check()) passMini();
        } else {
          const c = S.chainActive;
          if (c && c.def && c.state && c.def.onGood) c.def.onGood(c.state, ctx);
        }

        return { good:true, scoreDelta: +1 };
      }

      // BAD (JUNK)
      setBlink('bad');

      // shield blocks?
      if (S.shield > 0){
        S.shield--;
        S.combo = 0; // block ยังตัดคอมโบเพื่อ “ยุติธรรม”
        onComboUpdate();
        // ลดผลกระทบนิดหน่อย
        S.water = clamp(S.water + Math.floor(D.waterBad * 0.35), 0, 100);
        S.fever = clamp(S.fever - 10, 0, 100);
        updateWaterHUD();
        addScore(-6, x, y, 'BLOCK');
        setBlink('block');
        return { good:false, scoreDelta: 0 };
      }

      // real miss
      S.badHits++;
      S.miss++;
      setText('hha-miss', S.miss);

      S.combo = 0;
      onComboUpdate();

      // water + fever penalty
      S.water = clamp(S.water + D.waterBad, 0, 100);
      S.fever = clamp(S.fever - 18, 0, 100);
      updateWaterHUD();

      addScore(D.badPenalty, x, y, 'JUNK');

      // mini fail hooks
      if (!S.chainMode){
        const m = currentMini();
        if (m && m.onHitBad && S.miniState) m.onHitBad(S.miniState, ctx);
      } else {
        // chain fail เฉพาะ junk hit
        S.chainFailed++;
        // ไม่รีเซ็ต chain ทันที แค่ “ลงโทษ” แล้วสุ่มอันใหม่
        addScore(-18, x, y, 'CHAIN FAIL');
        pickNextChain();
      }

      return { good:false, scoreDelta: -1 };
    },

    onExpire: (info) => {
      // เป้าหมดอายุไม่ถือว่า miss โดยตรง (ยุติธรรม)
      // แต่ถ้าอยู่นอก GREEN นานก็สะท้อนผ่าน goal อยู่แล้ว
    }
  });

  // start timer after spawner ready
  S.tickTimer = ROOT.setInterval(tick, 1000);

  function endGame(){
    if (S.ended) return;
    S.ended = true;

    setShake(false);
    try{ ROOT.clearInterval(S.tickTimer); }catch{}
    S.tickTimer = null;

    // ให้ spawner หยุดเอง
    try{ ROOT.dispatchEvent(new CustomEvent('hha:stop')); }catch{}
    try{ spawner && spawner.stop && spawner.stop(); }catch{}

    // Goal bonus
    const g1ok = (S.greenTick >= D.goalGreenSec);
    const g2ok = (S.outsideTick <= D.goalOutsideLimit);
    const goalsDone = (g1ok?1:0) + (g2ok?1:0);

    if (g1ok) S.score += 120;
    if (g2ok) S.score += 120;

    S.goalsDone = goalsDone;
    calcProgress();

    // final HUD
    setText('hha-goal-done', S.goalsDone);
    setText('hha-mini-done', S.minisDone);
    setText('hha-score-main', Math.round(S.score));

    // dispatch end
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:end', {
        detail: {
          grade: S.grade,
          score: Math.round(S.score),

          goalsDone: S.goalsDone,
          goalsTotal: S.goalsTotal,

          minisDone: S.minisDone,
          minisTotal: S.minisTotal,

          chainCleared: S.chainCleared,
          chainFailed: S.chainFailed,

          comboBest: S.comboBest,
          miss: S.miss,

          water: Math.round(S.water),
          zone: S.zone,
          greenTick: S.greenTick,
          fever: Math.round(S.fever),
          shield: S.shield,

          progPct: Math.round(S.progPct)
        }
      }));
    }catch{}
  }

  // allow external stop
  function stop(){
    if (S.ended) return;
    endGame();
  }

  // expose minimal
  ROOT.__HVR_STATE = S;

  return {
    stop,
    shootCrosshair: () => (spawner && spawner.shootCrosshair ? spawner.shootCrosshair() : false),
    state: S
  };
}

export default { boot };
