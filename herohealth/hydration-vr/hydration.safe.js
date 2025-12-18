// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — น้ำสมดุล + Water Gauge + Fever + Goal / Mini quest
// ใช้ร่วมกับ: mode-factory.js, ui-water.js, hydration.quest.js
//
// ✅ 2025-12-18 FULL PATCH:
// - FIX: ui-fever.js เดิมไม่มี ensureFeverBar/setFever/setFeverActive/setShield -> ทำ FeverAdapter ให้เอง
// - spawn targets ลง #hvr-playfield (เลื่อนตาม scroll ได้)
// - ส่ง quest/update + hha:score + hha:session + hha:event ครบ
// - shield block: ไม่นับ miss (ตามกติกาเดิมของคุณ)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import * as HQ from './hydration.quest.js';

// ---------- Root & Global modules ----------
const ROOT = (typeof window !== 'undefined' ? window : globalThis);

// Particles: /vr/particles.js (IIFE)
const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop () {}, burstAt () {} };

// ======================================================
//  Fever Adapter (compat กับ ui-fever.js รุ่นเก่า)
//  - ไม่พึ่ง ensureFeverBar (เพราะไม่มี)
//  - อัปเดต DOM #hha-fever-fill / #hha-fever-percent / #hha-shield-count
// ======================================================
function FeverAdapter () {
  const api = (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) || ROOT.FeverUI || null;

  function ensure() {
    // ไม่มีอะไรต้องสร้าง เพราะหน้า hydration-vr.html มี bar อยู่แล้ว
    return true;
  }

  function setValue(pct) {
    const v = Math.max(0, Math.min(100, Number(pct) || 0));
    const fill = document.getElementById('hha-fever-fill') || document.getElementById('fever-fill');
    if (fill) fill.style.width = v.toFixed(0) + '%';
    const txt = document.getElementById('hha-fever-percent');
    if (txt) txt.textContent = v.toFixed(0) + '%';
    return v;
  }

  function setActive(isOn) {
    // รุ่นเก่ามีแค่ isActive() / reset() / add()
    // เราไม่บังคับ state ใน api เดิม แต่จะโชว์ด้วย DOM แทน
    // (ถ้าคุณอยากให้ api เดิม sync จริง ๆ ค่อยอัปเกรด ui-fever.js ภายหลัง)
    return !!isOn;
  }

  function setShieldCount(n) {
    const v = Math.max(0, Math.min(9, Number(n) || 0));
    const el = document.getElementById('hha-shield-count');
    if (el) el.textContent = String(v);
    return v;
  }

  function add(n) {
    try { api && typeof api.add === 'function' && api.add(n); } catch {}
  }
  function reset() {
    try { api && typeof api.reset === 'function' && api.reset(); } catch {}
    setValue(0);
    setShieldCount(0);
  }

  return {
    ensureFeverBar: ensure,
    setFever: setValue,
    setFeverActive: setActive,
    setShield: setShieldCount,
    add,
    reset,
    isActive: () => (api && typeof api.isActive === 'function') ? !!api.isActive() : false,
    getValue: () => (api && typeof api.getValue === 'function') ? (Number(api.getValue())||0) : 0
  };
}

const FeverUI = FeverAdapter();
const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

// ---------- Quest targets ----------
const GOAL_TARGET = 2;
const MINI_TARGET = 3;

// ---------- Coach helper ----------
let lastCoachAt = 0;
function coach (text, minGap = 2200) {
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try {
    ROOT.dispatchEvent(new CustomEvent('hha:coach', { detail: { text } }));
  } catch {}
}

// ---------- quest factory selector ----------
function getCreateHydrationQuest () {
  if (typeof HQ.createHydrationQuest === 'function') return HQ.createHydrationQuest;
  if (HQ.default) {
    if (typeof HQ.default.createHydrationQuest === 'function') return HQ.default.createHydrationQuest;
    if (typeof HQ.default === 'function') return HQ.default;
  }
  throw new Error('createHydrationQuest not found in hydration.quest.js');
}

// ---------- Emoji pools ----------
const GOOD = ['💧', '🥛', '🍉'];                 // น้ำดี
const BAD  = ['🥤', '🧋', '🍺', '☕️'];           // น้ำหวาน / คาเฟอีน
const STAR   = '⭐';
const DIA    = '💎';
const SHIELD = '🛡️';
const FIRE   = '🔥';
const BONUS  = [STAR, DIA, SHIELD, FIRE];

// ---------- FX wrappers ----------
function safeScorePop (x, y, value, judgment, isGood) {
  try {
    Particles.scorePop(x, y, String(value), { good: !!isGood, judgment: judgment || '' });
  } catch {}
}
function safeBurstAt (x, y, isGood, colorHint) {
  try {
    Particles.burstAt(x, y, { color: colorHint || (isGood ? '#22c55e' : '#f97316') });
  } catch {}
}

// ---------- logger helpers ----------
function emit(type, detail) {
  try { ROOT.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
}
function nowIso() { return new Date().toISOString(); }
const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
function fromStartMs() {
  const n = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  return Math.max(0, Math.round(n - t0));
}

// ======================================================
//  boot(cfg)
// ======================================================
export async function boot (cfg = {}) {
  // ----- Difficulty + Duration -----
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = (['easy', 'normal', 'hard'].includes(diffRaw)) ? diffRaw : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  dur = Math.max(20, Math.min(180, dur));

  // ✅ playfield container (targets ลงนี้ → เลื่อนตาม scroll)
  const playfield =
    (typeof document !== 'undefined' && document.getElementById)
      ? document.getElementById('hvr-playfield')
      : null;

  // ----- Session -----
  const sessionId = `HYDR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const sessionStartIso = nowIso();

  // ----- Fever + Water gauge initial HUD -----
  ensureFeverBar();
  let fever = 0;
  let feverActive = false;
  let shield = 0;
  setFever(fever);
  setFeverActive(feverActive);
  setShield(shield);

  ensureWaterGauge();
  let waterPct = 50;
  let waterRes = setWaterGauge(waterPct);
  let waterZone = waterRes.zone || 'GREEN';
  const waterStart = waterPct;

  // ----- Quest Deck -----
  let deck;
  try {
    const factory = getCreateHydrationQuest();
    deck = factory(diff);
  } catch (err) {
    console.error('[Hydration] createHydrationQuest error', err);
    deck = {
      stats: { greenTick: 0, zone: waterZone },
      updateScore () {},
      updateCombo () {},
      onGood () {},
      onJunk () {},
      second () {},
      getProgress () { return []; },
      getMiniNoJunkProgress () { return { now: 0, target: 0 }; }
    };
  }

  if (!deck.stats) deck.stats = {};
  deck.stats.greenTick = 0;
  deck.stats.zone = waterZone;

  // ---------- Quest counters ----------
  let goalCleared = 0;
  let miniCleared = 0;

  function questMeta () {
    return {
      goalsCleared: goalCleared,
      goalsTarget: GOAL_TARGET,

      quests: miniCleared,
      questsTotal: MINI_TARGET,

      questsCleared: miniCleared,
      questsTarget: MINI_TARGET
    };
  }

  function getQuestSnapshot () {
    if (!deck || typeof deck.getProgress !== 'function') {
      return {
        goalsView: [], minisView: [],
        goalsAll: [], minisAll: [],
        goalsDone: goalCleared, goalsTotal: GOAL_TARGET,
        minisDone: miniCleared, minisTotal: MINI_TARGET
      };
    }

    const goalsView = deck.getProgress('goals') || deck.goals || [];
    const minisView = deck.getProgress('mini')  || deck.minis || [];

    const goalsAll = goalsView._all || goalsView;
    const minisAll = minisView._all || minisView;

    const goalsDone = goalsAll.filter(g => g && (g._done || g.done)).length;
    const minisDone = minisAll.filter(m => m && (m._done || m.done)).length;

    const goalsTotal = goalsAll.length || GOAL_TARGET;
    const minisTotal = minisAll.length || MINI_TARGET;

    return { goalsView, minisView, goalsAll, minisAll, goalsDone, goalsTotal, minisDone, minisTotal };
  }

  // ---------- Metrics ----------
  let nHitGood = 0;
  let nHitBad  = 0;
  let nHitStar = 0;
  let nHitDia  = 0;
  let nHitShield = 0;
  let nHitFire = 0;

  let nExpireGood = 0;
  let nExpireBad  = 0;

  let rtGoodList = [];
  let nHitGoodPerfect = 0;

  // ---------- Core state ----------
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let star = 0;
  let diamond = 0;
  let elapsedSec = 0;
  let ended = false;

  let inClutch = false;

  function mult () {
    let m = feverActive ? 2 : 1;
    if (inClutch) m += 0.5;
    return m;
  }

  function pushFeverEvent (state) {
    emit('hha:fever', { state, fever, active: feverActive });
  }

  function applyFeverUI () {
    setFever(fever);
    setFeverActive(feverActive);
    setShield(shield);
  }

  function emitGameEvent(payload) {
    const p = progressForLogger();
    emit('hha:event', {
      sessionId,
      mode: 'HydrationVR',
      difficulty: diff,
      timeFromStartMs: fromStartMs(),
      feverState: feverActive ? 'ON' : 'OFF',
      feverValue: Math.round(fever),
      waterPct: Math.round(waterPct),
      waterZone,
      totalScore: score,
      combo,
      misses,
      goalProgress: p.goalProgress,
      miniProgress: p.miniProgress,
      goalIdActive: p.goalIdActive,
      miniIdActive: p.miniIdActive,
      ...payload
    });
  }

  function gainFever (n) {
    if (inClutch) n *= 1.2;
    fever = Math.max(0, Math.min(100, fever + n));
    if (!feverActive && fever >= 100) {
      feverActive = true;
      coach('เข้าโหมดไฟแล้ว! เลือกน้ำดีรัว ๆ เลย 🔥');
      pushFeverEvent('start');
      emitGameEvent({ type:'fever_on' });
    } else {
      pushFeverEvent('change');
    }
    applyFeverUI();
  }

  function decayFever (n) {
    if (inClutch) n *= 1.15;

    const wasActive = feverActive;
    const d = feverActive ? 10 : n;
    fever = Math.max(0, fever - d);
    if (feverActive && fever <= 0) feverActive = false;

    if (wasActive && !feverActive) {
      pushFeverEvent('end');
      emitGameEvent({ type:'fever_off' });
    } else {
      pushFeverEvent('change');
    }
    applyFeverUI();
  }

  function addWater (n) {
    waterPct = Math.max(0, Math.min(100, waterPct + n));
    waterRes = setWaterGauge(waterPct);
    waterZone = waterRes.zone;
    deck.stats.zone = waterZone;
  }

  function syncDeck () {
    if (!deck) return;
    if (typeof deck.updateScore === 'function') deck.updateScore(score);
    if (typeof deck.updateCombo === 'function') deck.updateCombo(combo);
  }

  function pushHudScore (extra = {}) {
    emit('hha:score', {
      mode: 'Hydration',
      modeKey: 'hydration-vr',
      modeLabel: 'Hydration Quest',
      difficulty: diff,
      score,
      combo,
      comboMax,
      misses,
      miss: misses,
      timeSec: elapsedSec,
      waterPct,
      waterZone,
      ...questMeta(),
      ...extra
    });
  }

  // ---------- Progress helper for logger ----------
  function progressForLogger() {
    const snap = getQuestSnapshot();
    const goalsTotal = snap.goalsTotal || GOAL_TARGET;
    const minisTotal = snap.minisTotal || MINI_TARGET;
    const goalsDone  = Math.min(snap.goalsDone || 0, goalsTotal);
    const minisDone  = Math.min(snap.minisDone || 0, minisTotal);

    const g = (snap.goalsView && snap.goalsView[0]) ? snap.goalsView[0] : null;
    const m = (snap.minisView && snap.minisView[0]) ? snap.minisView[0] : null;

    return {
      goalsDone, goalsTotal,
      minisDone, minisTotal,
      goalIdActive: g ? (g.id || '') : '',
      miniIdActive: m ? (m.id || '') : '',
      goalProgress: g ? `${g.prog || 0}/${g.target || 0}` : `${goalsDone}/${goalsTotal}`,
      miniProgress: m ? `${m.prog || 0}/${m.target || 0}` : `${minisDone}/${minisTotal}`,
    };
  }

  // ---------- ส่งหัวข้อ Goal / Mini ให้ HUD ----------
  function pushQuest (hint) {
    const snap = getQuestSnapshot();
    const { goalsView, minisView, goalsAll, minisAll, goalsTotal, minisTotal } = snap;

    const currentGoal = goalsView[0] || null;
    const currentMini = minisView[0] || null;

    let goalIndex = 0;
    if (currentGoal && goalsAll && goalsAll.length) {
      const idx = goalsAll.findIndex(g => g && g.id === currentGoal.id);
      goalIndex = idx >= 0 ? (idx + 1) : 0;
    }

    let miniIndex = 0;
    if (currentMini && minisAll && minisAll.length) {
      const idx = minisAll.findIndex(m => m && m.id === currentMini.id);
      miniIndex = idx >= 0 ? (idx + 1) : 0;
    }

    const goalText = currentGoal ? (currentGoal.label || currentGoal.title || currentGoal.text || '') : '';
    const miniText = currentMini ? (currentMini.label || currentMini.title || currentMini.text || '') : '';

    const goalHeading = goalIndex
      ? `Goal ${goalIndex}: ${goalText}`
      : (goalsTotal > 0 && goalCleared >= goalsTotal ? `Goal: สำเร็จครบแล้ว (${goalCleared}/${goalsTotal}) 🎉` : '');

    const miniHeading = miniIndex
      ? `Mini: ${miniText}`
      : (minisTotal > 0 && miniCleared >= minisTotal ? `Mini quest: สำเร็จครบแล้ว (${miniCleared}/${minisTotal}) 🎉` : '');

    let autoHint = `โซนน้ำ: ${waterZone}`;
    try {
      if (currentMini && (currentMini.id === 'mini-no-junk') && typeof deck.getMiniNoJunkProgress === 'function') {
        const p = deck.getMiniNoJunkProgress();
        const now = Number(p?.now ?? 0) || 0;
        const target = Number(p?.target ?? 0) || 0;
        if (target > 0 && now < target) autoHint = `เลี่ยงน้ำหวาน ${now}/${target}s`;
        else if (target > 0) autoHint = `เลี่ยงน้ำหวาน ${target}/${target}s ✅`;
      }
    } catch {}

    emit('quest:update', {
      goal: currentGoal,
      mini: currentMini,
      goalsAll,
      minisAll,
      goalIndex,
      goalTotal: goalsTotal,
      miniIndex,
      miniTotal: minisTotal,
      goalHeading,
      miniHeading,
      hint: hint || autoHint,
      meta: questMeta()
    });
  }

  function scoreFX (x, y, val, judgment, isGood, colorHint) {
    safeScorePop(x, y, val, judgment, isGood);
    safeBurstAt(x, y, isGood, colorHint);
  }

  function sendJudge (label, extra = {}) {
    emit('hha:judge', { label, ...extra });
  }

  function judgeLabelForRT(rtMs) {
    if (rtMs == null || rtMs < 0) return 'GOOD';
    if (rtMs <= 350) return 'PERFECT';
    if (rtMs <= 750) return 'GOOD';
    return 'LATE';
  }

  function recordRtGood(rtMs, label) {
    if (rtMs == null || !Number.isFinite(rtMs) || rtMs < 0) return;
    rtGoodList.push(rtMs);
    if (String(label).toUpperCase() === 'PERFECT') nHitGoodPerfect++;
  }

  function buildSessionMetrics() {
    const nTargetGoodSpawned = '';
    const nTargetBadSpawned  = '';

    const avgRtGoodMs = rtGoodList.length ? Math.round(rtGoodList.reduce((a,b)=>a+b,0)/rtGoodList.length) : '';
    const sorted = rtGoodList.slice().sort((a,b)=>a-b);
    const medianRtGoodMs = sorted.length
      ? (sorted.length % 2 ? sorted[(sorted.length/2)|0] : Math.round((sorted[sorted.length/2-1]+sorted[sorted.length/2])/2))
      : '';

    const fastHitRatePct = nHitGood > 0 ? Math.round((nHitGoodPerfect / nHitGood) * 100) : '';

    return {
      nTargetGoodSpawned,
      nTargetBadSpawned,
      nHitGood,
      nHitBad,
      nHitStar,
      nHitDia,
      nHitShield,
      nHitFire,
      nExpireGood,
      nExpireBad,
      avgRtGoodMs,
      medianRtGoodMs,
      fastHitRatePct
    };
  }

  // ======================================================
  //  JUDGE
  // ======================================================
  function judge (ch, ctx) {
    if (ended) return { good: false, scoreDelta: 0 };

    const x = ctx?.clientX ?? ctx?.cx ?? (ctx?.x ?? 0);
    const y = ctx?.clientY ?? ctx?.cy ?? (ctx?.y ?? 0);
    const rtMs = (typeof ctx?.rtMs === 'number') ? ctx.rtMs
               : (typeof ctx?.reactionMs === 'number') ? ctx.reactionMs
               : null;

    const targetId = ctx?.targetId || ctx?.tid || '';
    const spawnX = (typeof ctx?.spawnX === 'number') ? ctx.spawnX : null;

    // ----- Power-ups -----
    if (ch === STAR) {
      const d = 40 * mult();
      score += d;
      star++;
      nHitStar++;
      gainFever(10);

      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();

      const label = 'GOOD';
      sendJudge(label, { points: d, kind: 'star', x, y });
      scoreFX(x, y, d, label, true, '#facc15');

      emitGameEvent({ type:'hit', targetId, emoji:ch, itemType:'star', rtMs, judgment:label, isGood:true, spawnX });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === DIA) {
      const d = 80 * mult();
      score += d;
      diamond++;
      nHitDia++;
      gainFever(30);

      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); pushQuest();

      const label = 'PERFECT';
      sendJudge(label, { points: d, kind: 'diamond', x, y });
      scoreFX(x, y, d, label, true, '#38bdf8');

      emitGameEvent({ type:'hit', targetId, emoji:ch, itemType:'diamond', rtMs, judgment:label, isGood:true, spawnX });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === SHIELD) {
      shield = Math.min(3, shield + 1);
      setShield(shield);

      const d = 20;
      score += d;
      nHitShield++;

      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();

      coach('ได้เกราะกันน้ำหวานแล้วนะ 🛡️ ถ้าเผลอแตะจะไม่ถือว่าพลาดหนึ่งครั้ง', 3500);

      const label = 'GOOD';
      sendJudge(label, { points: d, kind: 'shield', x, y });
      scoreFX(x, y, d, label, true, '#60a5fa');

      emitGameEvent({ type:'hit', targetId, emoji:ch, itemType:'shield', rtMs, judgment:label, isGood:true, spawnX });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === FIRE) {
      const wasActive = feverActive;
      feverActive = true;
      fever = Math.max(fever, 60);
      applyFeverUI();
      if (!wasActive) pushFeverEvent('start');
      else pushFeverEvent('change');

      nHitFire++;

      const d = 25;
      score += d;

      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();

      coach('โหมดไฟ 🔥 เลือกน้ำดีให้ไว แล้วหลบพวกน้ำหวาน!', 3500);

      const label = 'FEVER';
      sendJudge(label, { points: d, kind: 'fire', x, y });
      scoreFX(x, y, d, label, true, '#f97316');

      emitGameEvent({ type:'hit', targetId, emoji:ch, itemType:'fire', rtMs, judgment:label, isGood:true, spawnX });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    // ----- GOOD -----
    if (GOOD.includes(ch)) {
      addWater(+8);

      const d = (14 + combo * 2) * mult();
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);

      nHitGood++;

      gainFever(6 + combo * 0.4);
      deck.onGood && deck.onGood();
      syncDeck(); pushQuest();

      const label = (combo >= 8) ? 'PERFECT' : judgeLabelForRT(rtMs);
      recordRtGood(rtMs, label);

      sendJudge(label, { points: d, kind: 'good', x, y });
      scoreFX(x, y, d, label, true);

      emitGameEvent({ type:'hit', targetId, emoji:ch, itemType:'good', rtMs, judgment:label, isGood:true, spawnX });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    // ----- BAD / JUNK -----
    if (BAD.includes(ch)) {
      // ✅ shield block = ไม่ miss
      if (shield > 0) {
        shield--;
        setShield(shield);

        addWater(-4);
        decayFever(6);
        syncDeck(); pushQuest();

        sendJudge('BLOCK', { points: 0, kind: 'shield', x, y });
        scoreFX(x, y, 0, 'BLOCK', false, '#60a5fa');

        coach('เกราะช่วยกันน้ำหวานให้แล้วนะ 🛡️ ระวังอย่าเผลอบ่อยเกินไป', 3500);

        emitGameEvent({ type:'hit', targetId, emoji:ch, itemType:'bad', rtMs, judgment:'BLOCK', isGood:false, spawnX });
        pushHudScore();
        return { good: false, scoreDelta: 0 };
      }

      addWater(-8);

      const d = -10;
      score = Math.max(0, score + d);
      combo = 0;

      misses++;
      nHitBad++;

      decayFever(14);
      deck.onJunk && deck.onJunk(); // ✅ โดนจริงเท่านั้น
      syncDeck(); pushQuest();

      emit('hha:miss', { misses });

      sendJudge('MISS', { points: d, kind: 'bad', x, y });
      scoreFX(x, y, d, 'MISS', false);

      emitGameEvent({ type:'hit', targetId, emoji:ch, itemType:'bad', rtMs, judgment:'MISS', isGood:false, spawnX });
      pushHudScore();
      return { good: false, scoreDelta: d };
    }

    return { good: false, scoreDelta: 0 };
  }

  // ======================================================
  //  expire
  // ======================================================
  function onExpire (ev) {
    if (ended) return;

    if (ev && ev.isGood === false) {
      nExpireBad++;
      syncDeck();
      pushQuest();
      pushHudScore({ reason: 'expire-junk' });
      emitGameEvent({ type:'expire', itemType:'bad', judgment:'', isGood:false });
      return;
    }

    nExpireGood++;
    pushHudScore({ reason: 'expire' });
    emitGameEvent({ type:'expire', itemType:'good', judgment:'MISS', isGood:true });
  }

  // ======================================================
  //  Quest completion
  // ======================================================
  function checkQuestCompletion () {
    const snap = getQuestSnapshot();
    const { goalsAll, minisAll, goalsDone, goalsTotal, minisDone, minisTotal } = snap;

    const prevGoal = goalCleared;
    const prevMini = miniCleared;

    goalCleared = Math.min(GOAL_TARGET, goalsDone);
    miniCleared = Math.min(MINI_TARGET, minisDone);

    if (goalCleared > prevGoal) {
      const justIndex = goalCleared;
      const g = goalsAll[justIndex - 1] || null;
      const text = g ? (g.label || g.title || g.text || '') : '';

      emit('quest:celebrate', { kind:'goal', index: justIndex, total: goalsTotal, label: text });
      emit('quest:goal-cleared', {
        index: justIndex,
        total: goalsTotal,
        title: text,
        heading: `Goal ${justIndex}: ${text}`,
        reward: 'shield',
        meta: questMeta()
      });

      coach(`Goal ${justIndex}/${goalsTotal} สำเร็จแล้ว! ${text || ''} 🎯`, 3500);

      if (typeof deck.nextGoal === 'function' && goalCleared < GOAL_TARGET) deck.nextGoal();
    }

    if (miniCleared > prevMini) {
      const justIndex = miniCleared;
      const m = minisAll[justIndex - 1] || null;
      const text = m ? (m.label || m.title || m.text || '') : '';

      emit('quest:celebrate', { kind:'mini', index: justIndex, total: minisTotal, label: text });
      emit('quest:mini-cleared', {
        index: justIndex,
        total: minisTotal,
        title: text,
        heading: `Mini quest ${justIndex}: ${text}`,
        reward: 'star',
        meta: questMeta()
      });

      coach(`Mini quest ${justIndex}/${minisTotal} สำเร็จแล้ว! ${text || ''} ⭐`, 3500);

      if (typeof deck.nextMini === 'function' && miniCleared < MINI_TARGET) deck.nextMini();
    }

    if (!ended && goalCleared >= GOAL_TARGET && miniCleared >= MINI_TARGET) {
      emit('quest:all-complete', { goals: goalCleared, minis: miniCleared, goalsTotal, minisTotal });
      emit('quest:all-cleared', {
        goals: goalCleared,
        minis: miniCleared,
        goalsTotal,
        minisTotal,
        meta: questMeta()
      });

      coach('สุดยอด! เคลียร์ทุกภารกิจแล้ว 🎉 ฉลองใหญ่แล้วมาดูสรุปคะแนนกัน!', 4000);
      finish(elapsedSec, 'quests-complete', snap);
    } else {
      pushQuest();
    }
  }

  // ======================================================
  //  Tick รายวินาที (hha:time)
  // ======================================================
  function onSec () {
    if (ended) return;

    elapsedSec++;

    const z = zoneFrom(waterPct);

    if (z === 'GREEN') {
      deck.stats.greenTick = (deck.stats.greenTick | 0) + 1;
      decayFever(2);
    } else {
      decayFever(6);
    }

    if (z === 'HIGH') addWater(-4);
    else if (z === 'LOW') addWater(+4);
    else addWater(-1);

    if (deck && typeof deck.second === 'function') deck.second();
    syncDeck();

    checkQuestCompletion();
    pushHudScore();
  }

  // ======================================================
  //  CLUTCH TIME handler
  // ======================================================
  const onClutch = (e) => {
    if (ended) return;
    inClutch = true;
    const d = (e && e.detail) || {};
    const secLeft = (typeof d.secLeft === 'number') ? d.secLeft : null;

    if (secLeft && secLeft > 0) coach(`ช่วงท้ายเกมแล้ว เหลือประมาณ ${secLeft} วินาที! เก็บน้ำดีรัว ๆ ให้โซนยังสีเขียว 💧🔥`, 1500);
    else coach('ช่วงท้ายเกมแล้ว! เก็บน้ำดีให้สุดกำลังก่อนหมดเวลา 💧🔥', 1500);
  };

  // ======================================================
  //  finish
  // ======================================================
  let inst = null;

  function finish (durationSec, reason = 'time-up', snapOpt) {
    if (ended) return;
    ended = true;

    const snap = snapOpt || getQuestSnapshot();
    const { goalsDone, goalsTotal, minisDone, minisTotal } = snap;

    const goalsOk = Math.min(goalsDone, GOAL_TARGET);
    const minisOk = Math.min(minisDone, MINI_TARGET);

    const greenTick    = deck.stats.greenTick | 0;
    const waterEnd     = waterPct;
    const waterZoneEnd = zoneFrom(waterPct);

    try { ROOT.removeEventListener('hha:time', onTime); } catch {}
    try { ROOT.removeEventListener('hha:clutch', onClutch); } catch {}

    try {
      if (inst && typeof inst.stop === 'function') inst.stop(reason);
    } catch (err) {
      console.warn('[Hydration] inst.stop error', err);
    }

    emit('hha:end', {
      mode: 'Hydration',
      modeLabel: 'Hydration Quest VR',
      difficulty: diff,
      score,
      misses,
      comboMax,
      duration: durationSec,
      greenTick,
      goalsCleared: goalsOk,
      goalsTarget: goalsTotal,
      questsCleared: minisOk,
      questsTarget: minisTotal,
      waterStart,
      waterEnd,
      waterZoneEnd,
      endReason: reason
    });

    const metrics = buildSessionMetrics();
    emit('hha:session', {
      sessionId,
      mode: 'HydrationVR',
      difficulty: diff,

      durationSecPlayed: durationSec,
      scoreFinal: score,
      comboMax,
      misses,

      goalsCleared: goalsOk,
      goalsTotal,
      miniCleared: minisOk,
      miniTotal: minisTotal,

      nTargetGoodSpawned: metrics.nTargetGoodSpawned,
      nTargetJunkSpawned: metrics.nTargetBadSpawned,
      nHitGood: metrics.nHitGood,
      nHitJunk: metrics.nHitBad,

      reason: reason || '',
      extra: JSON.stringify({
        waterStart,
        waterEnd,
        waterZoneEnd,
        greenTick,
        hitStar: metrics.nHitStar,
        hitDiamond: metrics.nHitDia,
        hitShield: metrics.nHitShield,
        hitFire: metrics.nHitFire,
        expireGood: metrics.nExpireGood,
        expireBad: metrics.nExpireBad,
        avgRtGoodMs: metrics.avgRtGoodMs,
        medianRtGoodMs: metrics.medianRtGoodMs,
        fastHitRatePct: metrics.fastHitRatePct
      }),

      startTimeIso: sessionStartIso,
      endTimeIso: nowIso(),
      gameVersion: 'HydrationVR-2025-12-18-FeverAdapter-Crosshair'
    });

    pushHudScore({ ended: true, ...questMeta() });
  }

  const onTime = (e) => {
    const sec = (e.detail && typeof e.detail.sec === 'number')
      ? e.detail.sec
      : (e.detail?.sec | 0);

    if (sec > 0) onSec();
    if (sec === 0 && !ended) finish(dur, 'time-up');
  };

  ROOT.addEventListener('hha:time', onTime);
  ROOT.addEventListener('hha:clutch', onClutch);

  // ======================================================
  //  factoryBoot
  // ======================================================
  const spawnInterval = (diff === 'easy') ? 1400 : (diff === 'hard' ? 900 : 1100);
  const maxActive = (diff === 'easy') ? 3 : (diff === 'hard' ? 6 : 4);

  inst = await factoryBoot({
    difficulty: diff,
    duration: dur,
    modeKey: 'hydration',

    // ✅ สำคัญ: ให้เป้าลง playfield (เลื่อนตาม scroll)
    spawnHost: '#hvr-playfield',
    spawnLayer: playfield || document.body,
    container: playfield || document.body,

    spawnInterval,
    maxActive,

    pools: { good: [...GOOD, ...BONUS], bad: [...BAD] },
    goodRate: 0.60,
    powerups: BONUS,
    powerRate: 0.10,
    powerEvery: 7,
    spawnStyle: 'pop',
    judge: (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  if (inst && typeof inst.stop === 'function') {
    const origStop = inst.stop.bind(inst);
    inst.stop = (...args) => {
      try { ROOT.removeEventListener('hha:time', onTime); } catch {}
      try { ROOT.removeEventListener('hha:clutch', onClutch); } catch {}
      return origStop(...args);
    };
  }

  // ---------- START ----------
  pushQuest('เริ่มโหมดน้ำสมดุล');
  coach('ภารกิจคือรักษาน้ำในร่างกายให้อยู่โซนสีเขียว 💧 เลือกน้ำดี เลี่ยงน้ำหวานนะ');
  pushHudScore();

  emitGameEvent({ type:'start', judgment:'OK', extra:`diff=${diff}` });

  return inst;
}