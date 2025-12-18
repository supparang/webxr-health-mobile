// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — FUN+RESEARCH (1–8 complete)
// 1) Perfect Ring scoring
// 2) Sudden Challenge
// 3) Rhythm Mode (Fever/Clutch)
// 4) Fake Good (looks good but is bad)
// 5) Shield Choice (pick reward)
// 6) Camera shake + blink
// 7) End celebration by grade
// 8) Research vs Play mode (run=research|play)

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';
import * as HQ from './hydration.quest.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop () {}, burstAt () {}, celebrate () {} };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  {
    ensureFeverBar () {},
    setFever () {},
    setFeverActive () {},
    setShield () {}
  };

const { ensureFeverBar, setFever, setFeverActive, setShield } = FeverUI;

// ---- Quest targets ----
const GOAL_TARGET = 2;
const MINI_TARGET = 3;

// ---- Emoji pools ----
const GOOD = ['💧', '🥛', '🍉'];
const BAD  = ['🥤', '🧋', '🍺', '☕️'];

// Trick pool (fake good)
const FAKE_GOOD = ['🧃', '🍹']; // looks good-ish but is trap (counts as bad)

const STAR   = '⭐';
const DIA    = '💎';
const SHIELD = '🛡️';
const FIRE   = '🔥';
const BONUS  = [STAR, DIA, SHIELD, FIRE];

// ---- Coach helper ----
let lastCoachAt = 0;
function coach (text, minGap = 2200) {
  if (!text) return;
  const now = Date.now();
  if (now - lastCoachAt < minGap) return;
  lastCoachAt = now;
  try { ROOT.dispatchEvent(new CustomEvent('hha:coach', { detail: { text } })); } catch {}
}

function emit(type, detail) {
  try { ROOT.dispatchEvent(new CustomEvent(type, { detail })); } catch {}
}
function nowIso() { return new Date().toISOString(); }
const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
function fromStartMs() {
  const n = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  return Math.max(0, Math.round(n - t0));
}

function getCreateHydrationQuest () {
  if (typeof HQ.createHydrationQuest === 'function') return HQ.createHydrationQuest;
  if (HQ.default) {
    if (typeof HQ.default.createHydrationQuest === 'function') return HQ.default.createHydrationQuest;
    if (typeof HQ.default === 'function') return HQ.default;
  }
  throw new Error('createHydrationQuest not found in hydration.quest.js');
}

// ---- FX (blink + shake) ----
function ensureFxStyle(){
  if (!document || document.getElementById('hha-hydr-fx-style')) return;
  const s = document.createElement('style');
  s.id = 'hha-hydr-fx-style';
  s.textContent = `
    .hha-blink{
      position:fixed; inset:0;
      background:rgba(255,140,0,0.28);
      opacity:0; pointer-events:none;
      z-index:9999;
    }
    .hha-blink.on{
      animation:hhaBlink .22s ease-out;
    }
    @keyframes hhaBlink{
      0%{opacity:0;}
      35%{opacity:1;}
      100%{opacity:0;}
    }
    .hha-shake{
      animation:hhaShake .18s linear;
    }
    @keyframes hhaShake{
      0%{ transform:translate3d(0,0,0); }
      25%{ transform:translate3d(-3px,1px,0); }
      50%{ transform:translate3d(3px,-1px,0); }
      75%{ transform:translate3d(-2px,-1px,0); }
      100%{ transform:translate3d(0,0,0); }
    }
  `;
  document.head.appendChild(s);
}
function ensureBlink(){
  ensureFxStyle();
  let el = document.getElementById('hha-blink');
  if (!el) {
    el = document.createElement('div');
    el.id = 'hha-blink';
    el.className = 'hha-blink';
    document.body.appendChild(el);
  }
  return el;
}
function blink(){
  const el = ensureBlink();
  el.classList.remove('on');
  void el.offsetWidth;
  el.classList.add('on');
}
function shake(strong=false){
  try{
    const b = document.body;
    b.classList.remove('hha-shake');
    void b.offsetWidth;
    b.classList.add('hha-shake');
    if (strong) blink();
  }catch{}
}

function safeScorePop (x, y, value, judgment, isGood) {
  try { Particles.scorePop(x, y, String(value), { good: !!isGood, judgment: judgment || '' }); } catch {}
}
function safeBurstAt (x, y, isGood, colorHint) {
  try { Particles.burstAt(x, y, { color: colorHint || (isGood ? '#22c55e' : '#f97316') }); } catch {}
}
function scoreFX (x, y, val, judgment, isGood, colorHint) {
  safeScorePop(x, y, val, judgment, isGood);
  safeBurstAt(x, y, isGood, colorHint);
}

// ======================================================
//  Shield Choice modal (Feature #5)
// ======================================================
function ensureChoiceModal(){
  let wrap = document.getElementById('hha-choice');
  if (wrap) return wrap;

  const s = document.createElement('style');
  s.textContent = `
    .hha-choice{
      position:fixed; inset:0; z-index:99999;
      display:none; align-items:center; justify-content:center;
      background:rgba(2,6,23,0.72); backdrop-filter:blur(10px);
      padding:18px;
    }
    .hha-choice.on{ display:flex; }
    .hha-choice-card{
      width:min(520px, 100%);
      border-radius:18px;
      border:1px solid rgba(148,163,184,0.35);
      background:radial-gradient(circle at top left,#0b1120,#020617 70%);
      box-shadow:0 24px 60px rgba(0,0,0,0.55);
      padding:14px 14px 12px;
      color:#e5e7eb;
    }
    .hha-choice-title{ font-size:16px; font-weight:700; margin-bottom:6px; }
    .hha-choice-sub{ font-size:13px; color:#9ca3af; margin-bottom:10px; line-height:1.35; }
    .hha-choice-row{ display:flex; gap:10px; }
    .hha-choice-btn{
      flex:1 1 0;
      border-radius:16px;
      border:1px solid rgba(148,163,184,0.35);
      padding:12px;
      background:rgba(15,23,42,0.7);
      cursor:pointer;
      user-select:none;
    }
    .hha-choice-btn:active{ transform:scale(0.98); }
    .hha-choice-emoji{ font-size:26px; }
    .hha-choice-name{ font-weight:700; margin-top:6px; }
    .hha-choice-desc{ font-size:12px; color:#9ca3af; margin-top:4px; }
  `;
  s.id = 'hha-choice-style';
  document.head.appendChild(s);

  wrap = document.createElement('div');
  wrap.id = 'hha-choice';
  wrap.className = 'hha-choice';
  wrap.innerHTML = `
    <div class="hha-choice-card">
      <div class="hha-choice-title">เลือกของรางวัล! 🎁</div>
      <div class="hha-choice-sub">เลือก 1 อย่างตอนนี้ แล้วไปลุยต่อ! (เล่นโหมด Play จะสุ่มมาเป็นระยะ)</div>
      <div class="hha-choice-row">
        <div class="hha-choice-btn" data-pick="shield">
          <div class="hha-choice-emoji">🛡️</div>
          <div class="hha-choice-name">Shield +1</div>
          <div class="hha-choice-desc">กันน้ำหวานได้ 1 ครั้ง (ไม่ถือว่า MISS)</div>
        </div>
        <div class="hha-choice-btn" data-pick="boost">
          <div class="hha-choice-emoji">⚡</div>
          <div class="hha-choice-name">Score Boost</div>
          <div class="hha-choice-desc">5 วินาที คะแนนคูณเพิ่ม (ยิง PERFECT จะโหดมาก)</div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  return wrap;
}

async function pickChoice(){
  const wrap = ensureChoiceModal();
  return await new Promise(resolve=>{
    wrap.classList.add('on');
    const onClick = (e)=>{
      const btn = e.target.closest('.hha-choice-btn');
      if (!btn) return;
      const pick = btn.getAttribute('data-pick') || '';
      wrap.classList.remove('on');
      wrap.removeEventListener('click', onClick);
      resolve(pick);
    };
    wrap.addEventListener('click', onClick);
  });
}

// ======================================================
//  Sudden Challenge (Feature #2)
// ======================================================
function makeSuddenDeck(isPlay){
  // research mode: off
  if (!isPlay) return null;

  const list = [
    { id:'no-junk-10',   title:'10 วิ ห้ามโดนน้ำหวาน!',       dur:10, type:'noJunk',   target:10 },
    { id:'streak-good-5',title:'เก็บน้ำดีติดกัน 5 อัน!',       dur:12, type:'goodStreak',target:5 },
    { id:'perfect-2',    title:'ยิง PERFECT ให้ได้ 2 ครั้ง!',  dur:12, type:'perfect',  target:2 }
  ];

  return {
    nextAtSec: 12 + Math.floor(Math.random()*10),
    active: null,
    list
  };
}

function gradeFrom(score, misses, perfectHits){
  // simple but motivating: reward perfect
  const s = Number(score)||0;
  const m = Number(misses)||0;
  const p = Number(perfectHits)||0;

  // thresholds tuned for kids
  if (s >= 1100 && m <= 2 && p >= 10) return 'SSS';
  if (s >= 850  && m <= 4 && p >= 7)  return 'SS';
  if (s >= 650  && m <= 6 && p >= 5)  return 'S';
  if (s >= 450) return 'A';
  if (s >= 280) return 'B';
  return 'C';
}

// ======================================================
//  boot(cfg)
// ======================================================
export async function boot (cfg = {}) {
  const diffRaw = String(cfg.difficulty || 'normal').toLowerCase();
  const diff = (['easy', 'normal', 'hard'].includes(diffRaw)) ? diffRaw : 'normal';

  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  dur = Math.max(20, Math.min(180, dur));

  // Mode: run=research|play
  const url = new URL(location.href);
  const run = String(url.searchParams.get('run') || 'play').toLowerCase();
  const isPlay = (run !== 'research');

  // playfield (spawn here)
  const playfield = document.getElementById('hvr-playfield') || document.body;

  // Session
  const sessionId = `HYDR-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
  const sessionStartIso = nowIso();

  // Fever + Water initial
  ensureFeverBar(); // ✅ now exists
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

  // Quest deck
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

  // counters
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

  // metrics
  let nHitGood = 0;
  let nHitBad  = 0;
  let nHitFake = 0;
  let nHitStar = 0;
  let nHitDia  = 0;
  let nHitShield = 0;
  let nHitFire = 0;

  let nExpireGood = 0;
  let nExpireBad  = 0;
  let nExpireFake = 0;

  let rtGoodList = [];
  let nHitGoodPerfect = 0;

  // state
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let misses = 0;
  let star = 0;
  let diamond = 0;
  let elapsedSec = 0;
  let ended = false;

  let inClutch = false;
  let scoreBoostUntil = 0; // feature #5 choice boost

  // sudden challenge
  const sudden = makeSuddenDeck(isPlay);
  let suddenOk = 0;
  let suddenDone = 0;

  function mult () {
    let m = feverActive ? 2 : 1;
    if (Date.now() < scoreBoostUntil) m += 0.75; // boost
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

  function emitGameEvent(payload) {
    const p = progressForLogger();
    emit('hha:event', {
      sessionId,
      mode: 'HydrationVR',
      runMode: isPlay ? 'play' : 'research',
      difficulty: diff,
      timeFromStartMs: fromStartMs(),
      feverState: feverActive ? 'ON' : 'OFF',
      feverValue: Math.round(fever),
      waterPct: Math.round(waterPct),
      waterZone,
      totalScore: score,
      combo,
      misses,
      suddenDone,
      suddenOk,
      goalProgress: p.goalProgress,
      miniProgress: p.miniProgress,
      goalIdActive: p.goalIdActive,
      miniIdActive: p.miniIdActive,
      ...payload
    });
  }

  function addWater (n) {
    waterPct = Math.max(0, Math.min(100, waterPct + n));
    waterRes = setWaterGauge(waterPct);
    waterZone = waterRes.zone;
    deck.stats.zone = waterZone;
  }

  function gainFever (n) {
    if (inClutch) n *= 1.2;
    fever = Math.max(0, Math.min(100, fever + n));

    if (!feverActive && fever >= 100) {
      feverActive = true;
      pushFeverEvent('start');
      emitGameEvent({ type:'fever_on' });
      coach('เข้าโหมดไฟแล้ว! 🔥 ยิง PERFECT จะได้แต้มพุ่ง!', 1600);

      // Feature #5: choice in play mode
      if (isPlay) {
        (async ()=>{
          const pick = await pickChoice();
          if (ended) return;
          if (pick === 'shield') {
            shield = Math.min(3, shield + 1);
            setShield(shield);
            coach('เลือก Shield แล้ว! 🛡️ เผลอโดนน้ำหวานจะไม่ถือว่า MISS 1 ครั้ง', 2000);
          } else {
            scoreBoostUntil = Date.now() + 5000;
            coach('Score Boost 5 วิ! ⚡ ยิงให้รัวเลย!', 2000);
          }
        })();
      }
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
      grade: gradeFrom(score, misses, nHitGoodPerfect),
      suddenDone, suddenOk,
      ...questMeta(),
      ...extra
    });
  }

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

    // sudden overlay in hint (feature #2)
    if (sudden && sudden.active) {
      autoHint = `⚡ Sudden: ${sudden.active.title} (${sudden.active.prog}/${sudden.active.target})`;
    }

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

  function sendJudge (label, extra = {}) {
    emit('hha:judge', { label, ...extra });
  }

  function recordRtGood(rtMs, label) {
    if (rtMs == null || !Number.isFinite(rtMs) || rtMs < 0) return;
    rtGoodList.push(rtMs);
    if (String(label).toUpperCase() === 'PERFECT') nHitGoodPerfect++;
  }

  function judgeLabel(ctx, rtMs){
    // Feature #1: perfect ring has priority
    if (ctx && ctx.hitPerfect) return 'PERFECT';
    if (rtMs == null || rtMs < 0) return 'GOOD';
    if (rtMs <= 350) return 'PERFECT';
    if (rtMs <= 750) return 'GOOD';
    return 'LATE';
  }

  // ======================================================
  //  Sudden Challenge logic (Feature #2)
  // ======================================================
  function suddenTick(){
    if (!sudden || !isPlay || ended) return;

    if (!sudden.active) {
      if (elapsedSec >= sudden.nextAtSec) {
        const pick = sudden.list[Math.floor(Math.random()*sudden.list.length)];
        sudden.active = { ...pick, left: pick.dur, prog: 0, ok: true };
        suddenDone++;
        coach(`⚡ ภารกิจพิเศษ! ${pick.title}`, 1000);
        emitGameEvent({ type:'sudden_start', id: pick.id, title: pick.title });
        pushQuest();
        // next schedule
        sudden.nextAtSec = elapsedSec + (15 + Math.floor(Math.random()*12));
      }
      return;
    }

    // countdown
    sudden.active.left--;
    if (sudden.active.type === 'noJunk') {
      sudden.active.prog = Math.min(sudden.active.target, sudden.active.prog + 1);
    }

    if (sudden.active.left <= 0) {
      const ok = !!sudden.active.ok && sudden.active.prog >= sudden.active.target;
      if (ok) {
        suddenOk++;
        // reward
        score += 120;
        gainFever(20);
        coach('สำเร็จ! รับโบนัส +120 🎉', 1200);
        emit('quest:celebrate', { kind:'sudden', label: sudden.active.title });
        emitGameEvent({ type:'sudden_ok', id:sudden.active.id, reward:'score+120' });
      } else {
        coach('พลาดภารกิจพิเศษ… ไม่เป็นไร ลุยต่อ! 💪', 1200);
        emitGameEvent({ type:'sudden_fail', id:sudden.active.id });
      }
      sudden.active = null;
      pushQuest();
      pushHudScore();
    }
  }

  function suddenOnGood(perfect){
    if (!sudden || !sudden.active) return;
    const a = sudden.active;
    if (a.type === 'goodStreak') {
      a.prog = Math.min(a.target, a.prog + 1);
    }
    if (a.type === 'perfect' && perfect) {
      a.prog = Math.min(a.target, a.prog + 1);
    }
    if (a.prog >= a.target) a.ok = true;
    pushQuest();
  }
  function suddenOnBad(){
    if (!sudden || !sudden.active) return;
    const a = sudden.active;
    if (a.type === 'noJunk') a.ok = false;
    if (a.type === 'goodStreak') a.prog = 0;
    pushQuest();
  }

  // ======================================================
  //  JUDGE — called from mode-factory (tap target)
  // ======================================================
  function judge (ch, ctx) {
    if (ended) return { good: false, scoreDelta: 0 };

    const x = ctx?.clientX ?? ctx?.cx ?? (ctx?.x ?? 0);
    const y = ctx?.clientY ?? ctx?.cy ?? (ctx?.y ?? 0);
    const rtMs = (typeof ctx?.rtMs === 'number') ? ctx.rtMs
               : (typeof ctx?.reactionMs === 'number') ? ctx.reactionMs
               : null;

    const itemType = ctx?.itemType || (ctx?.isPower ? 'power' : (ctx?.isGood ? 'good' : 'bad'));
    const perfect = !!ctx?.hitPerfect;

    // powerups
    if (ch === STAR) {
      const d = Math.round(40 * mult());
      score += d; star++; nHitStar++;
      gainFever(10);

      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); suddenOnGood(false); pushQuest();

      sendJudge('GOOD', { points: d, kind: 'star', x, y });
      scoreFX(x, y, d, 'GOOD', true, '#facc15');

      emitGameEvent({ type:'hit', emoji:ch, itemType:'star', rtMs, judgment:'GOOD', isGood:true, perfect:false });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === DIA) {
      const d = Math.round(80 * mult());
      score += d; diamond++; nHitDia++;
      gainFever(30);

      deck.onGood && deck.onGood();
      combo++; comboMax = Math.max(comboMax, combo);
      syncDeck(); suddenOnGood(true); pushQuest();

      sendJudge('PERFECT', { points: d, kind: 'diamond', x, y });
      scoreFX(x, y, d, 'PERFECT', true, '#38bdf8');
      shake(false);

      emitGameEvent({ type:'hit', emoji:ch, itemType:'diamond', rtMs, judgment:'PERFECT', isGood:true, perfect:true });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === SHIELD) {
      shield = Math.min(3, shield + 1);
      setShield(shield);
      const d = 20; score += d; nHitShield++;

      deck.onGood && deck.onGood();
      syncDeck(); suddenOnGood(false); pushQuest();

      coach('ได้เกราะแล้ว 🛡️ เผลอแตะน้ำหวานจะ BLOCK ได้', 2500);

      sendJudge('GOOD', { points: d, kind: 'shield', x, y });
      scoreFX(x, y, d, 'GOOD', true, '#60a5fa');

      emitGameEvent({ type:'hit', emoji:ch, itemType:'shield', rtMs, judgment:'GOOD', isGood:true, perfect:false });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    if (ch === FIRE) {
      feverActive = true;
      fever = Math.max(fever, 60);
      applyFeverUI();
      pushFeverEvent('start');

      nHitFire++;
      const d = 25; score += d;

      deck.onGood && deck.onGood();
      syncDeck(); suddenOnGood(false); pushQuest();

      coach('โหมดไฟ 🔥 ยิง PERFECT ให้ได้เยอะ ๆ !', 2500);

      sendJudge('FEVER', { points: d, kind: 'fire', x, y });
      scoreFX(x, y, d, 'FEVER', true, '#f97316');

      emitGameEvent({ type:'hit', emoji:ch, itemType:'fire', rtMs, judgment:'FEVER', isGood:true, perfect:false });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    // Feature #4: fake good counts as BAD
    const isFake = (itemType === 'fakeGood');

    // GOOD
    if (!isFake && GOOD.includes(ch)) {
      addWater(+8);

      const base = perfect ? 22 : 14;
      const d = Math.round((base + combo * 2) * mult());
      score += d;
      combo++;
      comboMax = Math.max(comboMax, combo);

      nHitGood++;
      gainFever(6 + combo * 0.4);

      deck.onGood && deck.onGood();
      syncDeck(); suddenOnGood(perfect); pushQuest();

      const label = judgeLabel(ctx, rtMs);
      recordRtGood(rtMs, label);

      sendJudge(label, { points: d, kind: 'good', x, y });
      scoreFX(x, y, d, label, true);
      if (label === 'PERFECT') shake(false);

      emitGameEvent({ type:'hit', emoji:ch, itemType:'good', rtMs, judgment:label, isGood:true, perfect:label==='PERFECT' });
      pushHudScore();
      return { good: true, scoreDelta: d };
    }

    // BAD (includes fakeGood)
    if (isFake || BAD.includes(ch) || FAKE_GOOD.includes(ch)) {
      // shield block
      if (shield > 0) {
        shield--;
        setShield(shield);

        addWater(-4);
        decayFever(6);
        syncDeck(); pushQuest();

        sendJudge('BLOCK', { points: 0, kind: 'shield', x, y });
        scoreFX(x, y, 0, 'BLOCK', false, '#60a5fa');
        coach('BLOCK! 🛡️ เกราะช่วยไว้แล้ว', 2200);

        emitGameEvent({ type:'hit', emoji:ch, itemType: isFake?'fakeGood':'bad', rtMs, judgment:'BLOCK', isGood:false, perfect:false });
        pushHudScore();
        suddenOnBad();
        return { good: false, scoreDelta: 0 };
      }

      addWater(-8);

      const d = -10;
      score = Math.max(0, score + d);
      combo = 0;
      misses++;
      if (isFake) nHitFake++; else nHitBad++;

      decayFever(14);
      deck.onJunk && deck.onJunk();
      syncDeck(); pushQuest();

      emit('hha:miss', { misses });

      sendJudge('MISS', { points: d, kind: isFake?'fake':'bad', x, y });
      scoreFX(x, y, d, 'MISS', false);
      shake(true); // Feature #6

      emitGameEvent({ type:'hit', emoji:ch, itemType: isFake?'fakeGood':'bad', rtMs, judgment:'MISS', isGood:false, perfect:false });
      pushHudScore();
      suddenOnBad();
      return { good: false, scoreDelta: d };
    }

    return { good: false, scoreDelta: 0 };
  }

  // expire
  function onExpire (ev) {
    if (ended) return;

    const itemType = ev?.itemType || (ev?.isGood === false ? 'bad' : 'good');

    if (itemType === 'bad') {
      nExpireBad++;
      syncDeck(); pushQuest();
      pushHudScore({ reason: 'expire-junk' });
      emitGameEvent({ type:'expire', itemType:'bad', judgment:'', isGood:false });
      return;
    }
    if (itemType === 'fakeGood') {
      nExpireFake++;
      syncDeck(); pushQuest();
      pushHudScore({ reason: 'expire-fake' });
      emitGameEvent({ type:'expire', itemType:'fakeGood', judgment:'', isGood:false });
      return;
    }

    nExpireGood++;
    pushHudScore({ reason: 'expire' });
    emitGameEvent({ type:'expire', itemType:'good', judgment:'MISS', isGood:true });
  }

  // quest completion check
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
      coach(`Goal ${justIndex}/${goalsTotal} สำเร็จแล้ว! 🎯`, 2500);
    }

    if (miniCleared > prevMini) {
      const justIndex = miniCleared;
      const m = minisAll[justIndex - 1] || null;
      const text = m ? (m.label || m.title || m.text || '') : '';

      emit('quest:celebrate', { kind:'mini', index: justIndex, total: minisTotal, label: text });
      coach(`Mini quest ${justIndex}/${minisTotal} สำเร็จแล้ว! ⭐`, 2500);
    }

    if (!ended && goalCleared >= GOAL_TARGET && miniCleared >= MINI_TARGET) {
      emit('quest:all-complete', { goals: goalCleared, minis: miniCleared, goalsTotal, minisTotal });
      coach('สุดยอด! เคลียร์ครบทุกภารกิจแล้ว 🎉', 2500);
      finish(elapsedSec, 'quests-complete', snap);
    } else {
      pushQuest();
    }
  }

  // tick per second
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

    // sudden challenge tick (feature #2)
    suddenTick();

    checkQuestCompletion();
    pushHudScore();
  }

  // clutch
  const onClutch = (e) => {
    if (ended) return;
    inClutch = true;
    const d = (e && e.detail) || {};
    const secLeft = (typeof d.secLeft === 'number') ? d.secLeft : null;

    coach(secLeft ? `ช่วงท้ายเกม! เหลือ ${secLeft} วิ 💧🔥` : 'ช่วงท้ายเกม! 💧🔥', 1200);
  };

  // finish
  function buildSessionMetrics() {
    const avgRtGoodMs = rtGoodList.length ? Math.round(rtGoodList.reduce((a,b)=>a+b,0)/rtGoodList.length) : '';
    return {
      nHitGood, nHitBad, nHitFake,
      nHitStar, nHitDia, nHitShield, nHitFire,
      nExpireGood, nExpireBad, nExpireFake,
      avgRtGoodMs
    };
  }

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
    } catch {}

    const grade = gradeFrom(score, misses, nHitGoodPerfect);

    // Feature #7: celebration by grade
    try{
      emit('quest:celebrate', { kind:'end', grade });
      if (Particles.celebrate) Particles.celebrate({ grade });
      // extra burst near crosshair
      Particles.burstAt((innerWidth||0)*0.5, (innerHeight||0)*0.55, { color: grade==='SSS'?'#facc15':'#22c55e' });
    }catch{}

    emit('hha:end', {
      mode: 'Hydration',
      modeLabel: 'Hydration Quest VR',
      runMode: isPlay ? 'play' : 'research',
      difficulty: diff,
      grade,
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
      suddenDone,
      suddenOk,
      endReason: reason
    });

    const metrics = buildSessionMetrics();
    emit('hha:session', {
      sessionId,
      mode: 'HydrationVR',
      runMode: isPlay ? 'play' : 'research',
      difficulty: diff,

      durationSecPlayed: durationSec,
      scoreFinal: score,
      comboMax,
      misses,
      grade,

      goalsCleared: goalsOk,
      goalsTotal,
      miniCleared: minisOk,
      miniTotal: minisTotal,

      reason: reason || '',
      extra: JSON.stringify({
        waterStart, waterEnd, waterZoneEnd, greenTick,
        suddenDone, suddenOk,
        ...metrics
      }),

      startTimeIso: sessionStartIso,
      endTimeIso: nowIso(),
      gameVersion: 'HydrationVR-2025-12-18-FUN8'
    });

    pushHudScore({ ended: true, grade, ...questMeta() });
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
  //  Feature #3: Rhythm mode rules
  //   - Play mode: rhythm ON when feverActive OR clutch
  //   - Research: rhythm OFF (controlled)
  // ======================================================
  function getRhythmCfg(){
    if (!isPlay) return { enabled:false };
    // base bpm by difficulty
    const bpm = (diff === 'easy') ? 96 : (diff === 'hard' ? 128 : 110);
    return { enabled:true, bpm };
  }

  // ======================================================
  //  Start factory
  // ======================================================
  const spawnInterval = (diff === 'easy') ? 1400 : (diff === 'hard' ? 900 : 1100);
  const maxActive = (diff === 'easy') ? 3 : (diff === 'hard' ? 6 : 4);

  const inst = await factoryBoot({
    difficulty: diff,
    duration: dur,
    modeKey: 'hydration',

    // ✅ spawn in playfield (scroll-follow)
    spawnHost: '#hvr-playfield',
    spawnLayer: playfield,
    container: playfield,

    spawnInterval,
    maxActive,

    // pools
    pools: {
      good: [...GOOD, ...BONUS],
      bad:  [...BAD],
      trick: [...FAKE_GOOD] // fake good pool
    },

    goodRate: isPlay ? 0.60 : 0.65,
    powerups: BONUS,
    powerRate: isPlay ? 0.10 : 0.08,
    powerEvery: 7,

    // Feature #4
    trickRate: isPlay ? 0.10 : 0.00,

    // Feature #8
    allowAdaptive: isPlay,

    // Feature #3
    rhythm: getRhythmCfg(),

    spawnStyle: 'pop',
    judge: (ch, ctx) => judge(ch, ctx),
    onExpire
  });

  // expose instance for hydration-vr.html to call shootCrosshair()
  try { ROOT.HHA_ACTIVE_INST = inst; } catch {}

  // safe stop
  if (inst && typeof inst.stop === 'function') {
    const origStop = inst.stop.bind(inst);
    inst.stop = (...args) => {
      try { ROOT.removeEventListener('hha:time', onTime); } catch {}
      try { ROOT.removeEventListener('hha:clutch', onClutch); } catch {}
      return origStop(...args);
    };
  }

  // START
  pushQuest('เริ่มโหมดน้ำสมดุล');
  coach('ภารกิจคือรักษาน้ำในร่างกายให้อยู่โซนสีเขียว 💧 ใช้ crosshair แล้ว “แตะจอเพื่อยิง” ได้เลย!');
  pushHudScore();
  emitGameEvent({ type:'start', extra:`diff=${diff};run=${isPlay?'play':'research'}` });

  return inst;
}
