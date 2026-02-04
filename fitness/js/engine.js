/* (ตัวเต็มไฟล์ engine.js จากแพตช์ล่าสุดยาวมาก)
   เพื่อให้คุณ copy ไปวางได้ “แบบไม่พลาดบรรทัด”
   ผมแปะให้ครบทั้งไฟล์ในบล็อกเดียวตามนี้
*/

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { AiDirector } from './ai-director.js';
import { DlFeatures } from './dl-features.js';
import { SessionLogger } from './session-logger.js';
import { EventLogger } from './event-logger.js';
import { StatsStore } from './stats-store.js';

const WIN = window;
const DOC = document;

function qs(sel){ return DOC.querySelector(sel); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, Number(v)||0)); }
function clamp01(v){ return Math.max(0, Math.min(1, Number(v)||0)); }
function nowMs(){ try{ return performance.now(); }catch(_){ return Date.now(); } }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)] }
function uid(){ return Math.floor(Math.random()*1e9) }

function readQS(key, def=null){
  try{
    const v = new URL(location.href).searchParams.get(key);
    return (v==null || v==='') ? def : v;
  }catch(_){
    return def;
  }
}

function readQSNum(key, def=0){
  const v = Number(readQS(key, ''));
  return Number.isFinite(v) ? v : def;
}

function normalizeDiff(v){
  const x = String(v||'').toLowerCase();
  if (x==='easy' || x==='normal' || x==='hard') return x;
  return 'normal';
}

function setActiveView(id){
  const menu = qs('#sb-view-menu');
  const play = qs('#sb-view-play');
  const result = qs('#sb-view-result');
  if (menu) menu.classList.toggle('is-active', id==='menu');
  if (play) play.classList.toggle('is-active', id==='play');
  if (result) result.classList.toggle('is-active', id==='result');
}

function setText(id, v){
  const el = qs(id);
  if (!el) return;
  el.textContent = String(v);
}

function setScaleX(id, x01){
  const el = qs(id);
  if (!el) return;
  el.style.transform = `scaleX(${clamp01(x01)})`;
}

function setMsg(text, cls=''){
  const el = qs('#sb-msg-main');
  if(!el) return;
  el.className = 'sb-msg-main' + (cls ? ' ' + cls : '');
  el.textContent = text || '';
}

function isResearchMode(){
  const mode = (readQS('mode','') || '').toLowerCase();
  return mode === 'research';
}

/* ===========================
   Boss definitions
=========================== */
const BOSSES = [
  {
    key: 'bubble',
    name: 'Bubble Glove',
    emoji: '🐣',
    desc: 'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน',
    phases: [
      { hp: 100, spawnRate: 1.00, sizePx: 132 },
      { hp: 120, spawnRate: 1.10, sizePx: 124 },
      { hp: 150, spawnRate: 1.20, sizePx: 118 },
    ]
  },
  {
    key: 'gear',
    name: 'Gear Golem',
    emoji: '⚙️',
    desc: 'สลับเป้าดี/ลวงให้ทัน ระวังจังหวะหลอก',
    phases: [
      { hp: 110, spawnRate: 1.05, sizePx: 128 },
      { hp: 140, spawnRate: 1.15, sizePx: 120 },
      { hp: 170, spawnRate: 1.25, sizePx: 114 },
    ]
  },
  {
    key: 'nova',
    name: 'Nova Phantom',
    emoji: '🌌',
    desc: 'ระวัง Bomb โผล่เป็นชุด ถ้ามี Shield ให้เก็บไว้',
    phases: [
      { hp: 120, spawnRate: 1.10, sizePx: 126 },
      { hp: 160, spawnRate: 1.22, sizePx: 118 },
      { hp: 200, spawnRate: 1.35, sizePx: 112 },
    ]
  },
];

/* ===========================
   Game state
=========================== */
const state = {
  inited: false,
  running: false,
  mode: 'normal', // normal | research
  diff: 'normal',
  totalSec: 70,
  tLeft: 0,
  startMs: 0,

  score: 0,
  combo: 0,
  maxCombo: 0,
  miss: 0,

  youHp: 100,
  bossHp: 100,
  bossHpMax: 100,

  fever: 0,
  feverOn: false,

  shield: 0,

  phase: 1,
  bossesCleared: 0,
  bossIndex: 0,

  activeBoss: null,
  targetIdSeq: 1,

  renderer: null,
  aiDirector: null,
  sessionLogger: null,
  eventLogger: null,
  statsStore: null,

  // timing
  lastTickMs: 0,
  spawnAcc: 0,

  // accuracy-ish
  hitGood: 0,
  hitBad: 0,
  hitPerfect: 0,
  hitBomb: 0,
  hitHeal: 0,
  hitShield: 0,
};

function getBoss(){
  const b = BOSSES[clamp(state.bossIndex, 0, BOSSES.length-1)];
  return b || BOSSES[0];
}

function getBossPhaseDef(){
  const b = getBoss();
  const p = clamp(state.phase, 1, b.phases.length);
  return b.phases[p-1];
}

function baseSpawnRateByDiff(){
  if (state.diff === 'easy') return 0.85;
  if (state.diff === 'hard') return 1.20;
  return 1.0;
}

function baseSizeMulByDiff(){
  if (state.diff === 'easy') return 1.12;
  if (state.diff === 'hard') return 0.92;
  return 1.0;
}

function setBossUI(){
  const b = getBoss();
  setText('#sb-current-boss-name', `${b.name} ${b.emoji}`);
  setText('#sb-meta-emoji', b.emoji);
  setText('#sb-meta-name', b.name);
  setText('#sb-meta-desc', b.desc);
  setText('#sb-boss-phase-label', String(state.phase));
  setText('#sb-text-phase', String(state.phase));
}

function updateHud(){
  setText('#sb-text-time', `${state.tLeft.toFixed(1)} s`);
  setText('#sb-text-score', String(state.score));
  setText('#sb-text-combo', String(state.combo));
  setText('#sb-text-miss', String(state.miss));
  setText('#sb-text-shield', String(state.shield));

  setScaleX('#sb-hp-you-top', state.youHp / 100);
  setScaleX('#sb-hp-you-bottom', state.youHp / 100);

  setScaleX('#sb-hp-boss-top', state.bossHpMax ? (state.bossHp / state.bossHpMax) : 0);
  setScaleX('#sb-hp-boss-bottom', state.bossHpMax ? (state.bossHp / state.bossHpMax) : 0);

  setScaleX('#sb-fever-bar', state.fever / 100);
  const lab = qs('#sb-label-fever');
  if (lab){
    if (state.feverOn) {
      lab.textContent = 'ON!';
      lab.classList.add('on');
    } else if (state.fever >= 100) {
      lab.textContent = 'READY';
      lab.classList.remove('on');
    } else {
      lab.textContent = `${Math.round(state.fever)}%`;
      lab.classList.remove('on');
    }
  }
}

function resetRunStats(){
  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.miss = 0;

  state.youHp = 100;

  state.fever = 0;
  state.feverOn = false;
  state.shield = 0;

  state.phase = 1;
  state.bossesCleared = 0;

  state.hitGood = 0;
  state.hitBad = 0;
  state.hitPerfect = 0;
  state.hitBomb = 0;
  state.hitHeal = 0;
  state.hitShield = 0;
}

function applyBossPhase(){
  const b = getBoss();
  const p = getBossPhaseDef();

  state.activeBoss = b;
  state.bossHpMax = p.hp;
  state.bossHp = p.hp;

  setBossUI();
  updateHud();
}

function killAllTargets(){
  if (state.renderer) {
    state.renderer.destroy();
    state.renderer = new DomRendererShadow(qs('#sb-target-layer'), {
      wrapEl: qs('#sb-wrap'),
      feedbackEl: qs('#sb-msg-main'),
      onTargetHit: onTargetHit
    });
    state.renderer.setDifficulty(state.diff);
  }
}

function setModeUI(mode){
  const nbtn = qs('#sb-mode-normal');
  const rbtn = qs('#sb-mode-research');
  const box = qs('#sb-research-box');
  const desc = qs('#sb-mode-desc');

  const isR = mode === 'research';

  if (nbtn) nbtn.classList.toggle('is-active', !isR);
  if (rbtn) rbtn.classList.toggle('is-active', isR);
  if (box) box.classList.toggle('is-on', isR);

  if (desc){
    desc.textContent = isR
      ? 'Research: ใช้เก็บข้อมูลการทดลอง (ล็อก AI/Adaptive)'
      : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
  }

  const btnPlay = qs('#sb-btn-play');
  const btnRes = qs('#sb-btn-research');
  if (btnPlay) btnPlay.style.display = isR ? 'none' : '';
  if (btnRes) btnRes.style.display = isR ? '' : 'none';
}

function bindMenu(){
  const btnHow = qs('#sb-btn-howto');
  const how = qs('#sb-howto');
  if (btnHow && how){
    btnHow.addEventListener('click', ()=>{
      how.classList.toggle('is-on');
    });
  }

  const modeN = qs('#sb-mode-normal');
  const modeR = qs('#sb-mode-research');
  if (modeN){
    modeN.addEventListener('click', ()=>{
      state.mode = 'normal';
      setModeUI('normal');
    });
  }
  if (modeR){
    modeR.addEventListener('click', ()=>{
      state.mode = 'research';
      setModeUI('research');
    });
  }

  const dd = qs('#sb-diff');
  if (dd){
    dd.addEventListener('change', ()=>{
      state.diff = normalizeDiff(dd.value);
      qs('#sb-wrap')?.setAttribute('data-diff', state.diff);
      if (state.renderer) state.renderer.setDifficulty(state.diff);
    });
  }

  const tt = qs('#sb-time');
  if (tt){
    tt.addEventListener('change', ()=>{
      state.totalSec = clamp(Number(tt.value)||70, 30, 180);
    });
  }

  const btnPlay = qs('#sb-btn-play');
  const btnRes = qs('#sb-btn-research');

  if (btnPlay) btnPlay.addEventListener('click', ()=> startRun('normal'));
  if (btnRes) btnRes.addEventListener('click', ()=> startRun('research'));

  const btnBack = qs('#sb-btn-back-menu');
  if (btnBack) btnBack.addEventListener('click', ()=> stopToMenu());

  const chkPause = qs('#sb-btn-pause');
  if (chkPause){
    chkPause.addEventListener('change', ()=>{
      if (!state.running) return;
      if (chkPause.checked) finishRun('stop');
    });
  }

  const btnRetry = qs('#sb-btn-result-retry');
  const btnMenu = qs('#sb-btn-result-menu');
  if (btnRetry) btnRetry.addEventListener('click', ()=> startRun(state.mode));
  if (btnMenu) btnMenu.addEventListener('click', ()=> stopToMenu());

  const btnEv = qs('#sb-btn-download-events');
  const btnSe = qs('#sb-btn-download-session');
  if (btnEv) btnEv.addEventListener('click', ()=> state.eventLogger?.downloadCsv('events'));
  if (btnSe) btnSe.addEventListener('click', ()=> state.sessionLogger?.downloadCsv('session'));
}

function parseIncomingParamsToMenu(){
  // Accept deep-link like: shadow-breaker.html?diff=easy&time=60&pid=...
  const qDiff = normalizeDiff(readQS('diff', ''));
  const qTime = readQSNum('time', NaN);

  if (qDiff){
    state.diff = qDiff;
    const dd = qs('#sb-diff');
    if (dd) dd.value = qDiff;
    qs('#sb-wrap')?.setAttribute('data-diff', qDiff);
  }
  if (Number.isFinite(qTime)){
    state.totalSec = clamp(qTime, 30, 180);
    const tt = qs('#sb-time');
    if (tt) tt.value = String(state.totalSec);
  }

  // mode from query
  const qMode = (readQS('mode','')||'').toLowerCase();
  if (qMode === 'research'){
    state.mode = 'research';
  } else {
    state.mode = 'normal';
  }
  setModeUI(state.mode);

  // If explicitly passed pid/group/note in query, prefill
  const pid = readQS('pid','') || '';
  const group = readQS('group','') || '';
  const note = readQS('note','') || '';

  if (pid) { const el = qs('#sb-part-id'); if (el) el.value = pid; }
  if (group) { const el = qs('#sb-part-group'); if (el) el.value = group; }
  if (note) { const el = qs('#sb-part-note'); if (el) el.value = note; }
}

function startRun(mode){
  mode = (mode === 'research') ? 'research' : 'normal';
  state.mode = mode;

  // Research requires PID/group? (we allow empty but keep it)
  const pid = (qs('#sb-part-id')?.value || readQS('pid','') || '').trim();
  const group = (qs('#sb-part-group')?.value || readQS('group','') || '').trim();
  const note = (qs('#sb-part-note')?.value || readQS('note','') || '').trim();

  state.diff = normalizeDiff(qs('#sb-diff')?.value || state.diff);
  state.totalSec = clamp(Number(qs('#sb-time')?.value)||state.totalSec, 30, 180);

  // init logging
  state.sessionLogger = new SessionLogger({ pid, group, note, mode, diff: state.diff, timeSec: state.totalSec });
  state.eventLogger = new EventLogger({ pid, group, note, mode, diff: state.diff, timeSec: state.totalSec });
  state.statsStore = new StatsStore('SB_STATS_V1');

  // AI director (play only)
  state.aiDirector = new AiDirector({
    enabled: mode !== 'research',
    diff: state.diff
  });

  resetRunStats();
  state.tLeft = state.totalSec;
  state.startMs = nowMs();
  state.lastTickMs = state.startMs;
  state.spawnAcc = 0;
  state.bossIndex = 0;

  // renderer
  if (state.renderer) state.renderer.destroy();
  state.renderer = new DomRendererShadow(qs('#sb-target-layer'), {
    wrapEl: qs('#sb-wrap'),
    feedbackEl: qs('#sb-msg-main'),
    onTargetHit: onTargetHit
  });
  state.renderer.setDifficulty(state.diff);

  applyBossPhase();
  updateHud();

  // flip views
  setActiveView('play');
  setMsg('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');

  state.running = true;
  qs('#sb-btn-pause') && (qs('#sb-btn-pause').checked = false);

  // log start
  state.eventLogger?.push('start', {
    mode: state.mode,
    diff: state.diff,
    timeSec: state.totalSec
  });

  tick();
}

function stopToMenu(){
  state.running = false;
  try { state.renderer?.destroy(); } catch {}
  setActiveView('menu');
}

function finishRun(reason='timeout'){
  if (!state.running) return;
  state.running = false;

  // end logs
  const acc = calcAccuracyPct();
  const grade = calcGrade(acc);

  const summary = {
    reason,
    mode: state.mode,
    diff: state.diff,
    timeSec: state.totalSec,
    score: state.score,
    miss: state.miss,
    maxCombo: state.maxCombo,
    phase: state.phase,
    bossesCleared: state.bossesCleared,
    accPct: acc,
    grade
  };

  state.eventLogger?.push('end', summary);
  state.sessionLogger?.setSummary(summary);

  // save stats local
  try { state.statsStore?.append(summary); } catch {}

  // result UI
  setText('#sb-res-time', `${(state.totalSec - state.tLeft).toFixed(1)} s`);
  setText('#sb-res-score', String(state.score));
  setText('#sb-res-max-combo', String(state.maxCombo));
  setText('#sb-res-miss', String(state.miss));
  setText('#sb-res-phase', String(state.phase));
  setText('#sb-res-boss-cleared', String(state.bossesCleared));
  setText('#sb-res-acc', `${acc.toFixed(1)} %`);
  setText('#sb-res-grade', grade);

  setActiveView('result');

  try { state.renderer?.destroy(); } catch {}
}

function calcAccuracyPct(){
  const hits = state.hitGood + state.hitBad + state.hitPerfect + state.hitHeal + state.hitShield;
  const total = hits + state.miss + state.hitBomb;
  if (!total) return 0;
  const goodScore = state.hitPerfect*1.0 + state.hitGood*0.8 + state.hitBad*0.45 + state.hitHeal*0.65 + state.hitShield*0.65;
  const denom = total * 1.0;
  return clamp((goodScore/denom)*100, 0, 100);
}

function calcGrade(accPct){
  const miss = state.miss;
  // Miss weight real
  const adj = accPct - Math.min(30, miss*1.2);
  if (adj >= 92) return 'SSS';
  if (adj >= 86) return 'SS';
  if (adj >= 78) return 'S';
  if (adj >= 68) return 'A';
  if (adj >= 55) return 'B';
  return 'C';
}

/* ===========================
   Targets & Hit logic
=========================== */
function spawnOneTarget(){
  if (!state.running) return;

  const p = getBossPhaseDef();
  const baseRate = baseSpawnRateByDiff();
  const rate = p.spawnRate * baseRate * (state.aiDirector?.getSpawnRateMul() ?? 1);

  // composition
  const r = Math.random();
  let type = 'normal';
  if (r < 0.10) type = 'decoy';
  else if (r < 0.16) type = 'bomb';
  else if (r < 0.22) type = 'heal';
  else if (r < 0.28) type = 'shield';

  // bossface cameo when boss low
  if (state.bossHp < state.bossHpMax*0.20 && Math.random() < 0.10) type = 'bossface';

  const sizeBase = p.sizePx || 120;
  const sizeMul = baseSizeMulByDiff() * (state.aiDirector?.getSizeMul() ?? 1);
  const sizePx = clamp(sizeBase * sizeMul, 78, 320);

  const id = state.targetIdSeq++;
  state.renderer.spawnTarget({
    id,
    type,
    sizePx,
    bossEmoji: getBoss().emoji
  });

  // life time
  let ttl = 1000;
  if (state.diff === 'easy') ttl = 1150;
  if (state.diff === 'hard') ttl = 820;
  ttl = ttl * (state.aiDirector?.getTtlMul() ?? 1);

  setTimeout(()=>{
    // timeout miss (only if still exists)
    if (state.renderer.targets.has(id)) {
      state.renderer.removeTarget(id, 'timeout');
      onMiss('timeout');
    }
  }, clamp(ttl, 450, 1600));
}

function onMiss(kind='miss'){
  state.combo = 0;
  state.miss += 1;

  // you hp down unless shield
  if (state.shield > 0){
    state.shield = Math.max(0, state.shield - 1);
  } else {
    state.youHp = clamp(state.youHp - 4, 0, 100);
  }

  // fever decay on miss
  state.fever = clamp(state.fever - 7, 0, 100);
  if (state.feverOn && state.fever < 20) state.feverOn = false;

  setMsg('พลาดจังหวะ! ลองมองเส้น/จังหวะให้ชัดแล้วลองใหม่ 👀', 'miss');

  state.eventLogger?.push('miss', { kind });

  updateHud();

  // AI director learns
  state.aiDirector?.onMiss();
  DlFeatures.maybeCoachTip(state.mode, {
    miss: state.miss,
    combo: state.combo,
    youHp: state.youHp,
    accPct: calcAccuracyPct()
  });
}

function applyHit(type, grade='good'){
  let scoreDelta = 0;
  let dmg = 0;

  const feverMul = state.feverOn ? 1.35 : 1.0;

  if (type === 'normal' || type === 'bossface'){
    if (grade === 'perfect') { scoreDelta = 60; dmg = 12; state.hitPerfect++; }
    else if (grade === 'good') { scoreDelta = 35; dmg = 8; state.hitGood++; }
    else { scoreDelta = 18; dmg = 5; state.hitBad++; }

    scoreDelta = Math.round(scoreDelta * feverMul);
    dmg = Math.round(dmg * feverMul);

    state.score += scoreDelta;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);

    // fever build
    state.fever = clamp(state.fever + (grade==='perfect' ? 14 : 9), 0, 100);
    if (!state.feverOn && state.fever >= 100){
      state.feverOn = true;
      setMsg('FEVER ON! 🔥', 'perfect');
      state.eventLogger?.push('fever_on', {});
      // auto decay a bit
      setTimeout(()=>{
        if (state.feverOn){
          state.feverOn = false;
          state.fever = clamp(state.fever - 30, 0, 100);
        }
      }, 4200);
    }

    // boss hp down
    state.bossHp = clamp(state.bossHp - dmg, 0, state.bossHpMax);

  } else if (type === 'decoy'){
    // decoy gives tiny score but breaks rhythm
    scoreDelta = 8;
    state.score += scoreDelta;
    state.combo = Math.max(0, state.combo - 1);
  } else if (type === 'bomb'){
    // bomb hurts you
    if (state.shield > 0){
      state.shield = Math.max(0, state.shield - 1);
      scoreDelta = -5;
      state.score += scoreDelta;
    } else {
      scoreDelta = -25;
      state.score += scoreDelta;
      state.youHp = clamp(state.youHp - 12, 0, 100);
    }
    state.hitBomb++;
    state.combo = 0;
    state.fever = clamp(state.fever - 14, 0, 100);
    if (state.feverOn && state.fever < 20) state.feverOn = false;
  } else if (type === 'heal'){
    state.youHp = clamp(state.youHp + 10, 0, 100);
    scoreDelta = 15;
    state.score += scoreDelta;
    state.hitHeal++;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
  } else if (type === 'shield'){
    state.shield = clamp(state.shield + 1, 0, 5);
    scoreDelta = 12;
    state.score += scoreDelta;
    state.hitShield++;
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
  }

  updateHud();
  return { scoreDelta };
}

function judgeGrade(){
  // simple RT proxy from combo + diff
  const c = state.combo;
  if (c >= 10 && Math.random() < 0.45) return 'perfect';
  if (c >= 4 && Math.random() < 0.55) return 'good';
  return Math.random() < 0.2 ? 'bad' : 'good';
}

function onTargetHit(id, pos){
  if (!state.running) return;

  const el = state.renderer.targets.get(id);
  if (!el) return;

  const type = (el.className.match(/sb-target--(\w+)/)?.[1]) || 'normal';

  // remove first to avoid double hit
  state.renderer.removeTarget(id, 'hit');

  let grade = 'good';
  if (type === 'normal' || type === 'bossface') grade = judgeGrade();
  if (type === 'bomb') grade = 'bomb';
  if (type === 'heal') grade = 'heal';
  if (type === 'shield') grade = 'shield';
  if (type === 'decoy') grade = 'bad';

  const r = applyHit(type, grade);

  // FX (patched)
  try{
    state.renderer.playHitFx(id, {
      clientX: pos?.clientX,
      clientY: pos?.clientY,
      grade,
      scoreDelta: r.scoreDelta
    });
  }catch(_){}

  state.eventLogger?.push('hit', { type, grade, scoreDelta: r.scoreDelta });

  // boss phase cleared?
  if (state.bossHp <= 0){
    state.bossesCleared++;
    // move to next phase or next boss
    const boss = getBoss();
    if (state.phase < boss.phases.length){
      state.phase++;
      applyBossPhase();
      setMsg(`Phase ${state.phase}! ไปต่อ! ⚡`, 'good');
    } else {
      // next boss
      state.bossIndex++;
      state.phase = 1;
      if (state.bossIndex >= BOSSES.length){
        finishRun('win');
        return;
      } else {
        applyBossPhase();
        setMsg(`บอสใหม่มาแล้ว! ${getBoss().name} 🔥`, 'perfect');
      }
    }
    killAllTargets();
  }

  // AI director learns
  state.aiDirector?.onHit({ type, grade, scoreDelta: r.scoreDelta, combo: state.combo, miss: state.miss });
  DlFeatures.maybeCoachTip(state.mode, {
    miss: state.miss,
    combo: state.combo,
    youHp: state.youHp,
    accPct: calcAccuracyPct()
  });
}

/* ===========================
   Loop
=========================== */
function tick(){
  if (!state.running) return;

  const t = nowMs();
  const dt = Math.min(66, Math.max(0, t - state.lastTickMs));
  state.lastTickMs = t;

  // time
  state.tLeft = Math.max(0, state.tLeft - dt/1000);

  // stop if time up or dead
  if (state.tLeft <= 0){
    finishRun('timeout');
    return;
  }
  if (state.youHp <= 0){
    finishRun('dead');
    return;
  }

  // spawner
  const p = getBossPhaseDef();
  const rate = p.spawnRate * baseSpawnRateByDiff() * (state.aiDirector?.getSpawnRateMul() ?? 1);
  const perSec = clamp(rate * 1.15, 0.65, 4.5);

  state.spawnAcc += (dt/1000) * perSec;
  while (state.spawnAcc >= 1){
    state.spawnAcc -= 1;
    spawnOneTarget();
  }

  updateHud();
  requestAnimationFrame(tick);
}

/* ===========================
   Boot
=========================== */
function init(){
  if (state.inited) return;
  state.inited = true;

  bindMenu();
  parseIncomingParamsToMenu();

  // how-to default closed
  qs('#sb-howto')?.classList.remove('is-on');

  // start behavior (PATCH): if URL has autostart=1 or play=1 then start immediately
  const auto = (readQS('autostart','') || readQS('play','') || '').toLowerCase();
  if (auto === '1' || auto === 'true' || auto === 'yes'){
    startRun(isResearchMode() ? 'research' : 'normal');
  } else {
    setActiveView('menu');
  }
}

init();