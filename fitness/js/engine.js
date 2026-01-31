// === /fitness/js/engine.js ===
// Shadow Breaker — Engine (DOM-based)
// ✅ Play / Research modes (research collects participant + session/event CSV)
// ✅ Boss phases + HP/Shield/FEVER
// ✅ AI hooks (Director/Predictor/Coach/DL-lite) — play default ON, research default OFF (override: ?ai=1/0)

import { SessionLogger, downloadSessionCsv } from './session-logger.js';
import { EventLogger, downloadEventCsv } from './event-logger.js';
import { AIDirector } from './ai-director.js';
import { AIPredictor } from './ai-predictor.js';
import { AICoach } from './ai-coach.js';
import { DLFeatures } from './dl-features.js';

// ----- optional AI mode (play-first, research-off by default) -----
// AI สำหรับทำให้ "สนุก/ท้าทาย" (prediction + director + coach)
// - play: ON เป็นค่าเริ่มต้น
// - research: OFF เป็นค่าเริ่มต้น
// override ได้ด้วย ?ai=1 หรือ ?ai=0
let AI_QUERY = null; // null = ไม่ได้ระบุ
try{
  const v = new URL(location.href).searchParams.get('ai');
  if (v !== null && v !== undefined && v !== ''){
    const s = String(v).toLowerCase();
    AI_QUERY = (s === '1' || s === 'true' || s === 'on' || s === 'yes');
  }
}catch(e){
  AI_QUERY = null;
}

// ----- utilities -----
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const randRange = (min, max) => min + Math.random() * (max - min);
const pickWeighted = (list) => {
  let sum = 0;
  for (const it of list) sum += (it.w || 0);
  let r = Math.random() * sum;
  for (const it of list) {
    r -= (it.w || 0);
    if (r <= 0) return it.v;
  }
  return list[list.length - 1].v;
};

const QS = (s) => document.querySelector(s);
const byId = (id) => document.getElementById(id);

const DIFF_CONFIG = {
  easy: {
    spawnIntervalMin: 700,
    spawnIntervalMax: 1050,
    lifeMs: 1200,
    baseSize: 82,
    comboDecayMs: 2200,
    feverGainHit: 0.12,
    feverGainPerfect: 0.18,
    feverLossMiss: 0.09,
    bossHp: [48, 62, 78],
    playerHp: 8,
    shieldDurationMs: 3500,
    shieldDropChance: 0.12,
    healDropChance: 0.10,
    bombChance: 0.06,
    decoyChance: 0.10
  },
  normal: {
    spawnIntervalMin: 520,
    spawnIntervalMax: 860,
    lifeMs: 1050,
    baseSize: 72,
    comboDecayMs: 1900,
    feverGainHit: 0.11,
    feverGainPerfect: 0.17,
    feverLossMiss: 0.10,
    bossHp: [62, 78, 96],
    playerHp: 7,
    shieldDurationMs: 3200,
    shieldDropChance: 0.10,
    healDropChance: 0.08,
    bombChance: 0.08,
    decoyChance: 0.11
  },
  hard: {
    spawnIntervalMin: 420,
    spawnIntervalMax: 720,
    lifeMs: 930,
    baseSize: 66,
    comboDecayMs: 1600,
    feverGainHit: 0.10,
    feverGainPerfect: 0.16,
    feverLossMiss: 0.11,
    bossHp: [76, 96, 118],
    playerHp: 6,
    shieldDurationMs: 2900,
    shieldDropChance: 0.09,
    healDropChance: 0.06,
    bombChance: 0.10,
    decoyChance: 0.12
  }
};

const BUILD = {
  build_version: 'shadow-breaker-packB-2026-01-25',
  engine: 'dom',
  mode_default: 'play'
};

// DOM refs
let viewMenu, viewPlay, viewEnd;
let btnStart, btnRestart, btnBack;
let elTimer, elScore, elCombo, elRank, elHp, elBossHp;
let elFeverFill, elShield;
let elMessage, elBossName;
let layerTargets, layerFx;
let inputModeNormal, inputModeResearch;
let inputDiff;
let inputPartId, inputPartGroup, inputPartNote;

let state = null;
let rafId = 0;

function parseParams() {
  const url = new URL(location.href);
  const p = url.searchParams;
  const mode = (p.get('mode') || BUILD.mode_default || 'play').toLowerCase(); // play/research
  const diff = (p.get('diff') || 'normal').toLowerCase();
  const time = Math.max(20, Math.min(240, parseInt(p.get('time') || '70', 10) || 70));
  return { mode, diff, time };
}

function getDiffCfg(diffKey){
  return DIFF_CONFIG[diffKey] || DIFF_CONFIG.normal;
}

function mountDomRefs(){
  viewMenu = byId('sb-view-menu');
  viewPlay = byId('sb-view-play');
  viewEnd  = byId('sb-view-end');

  btnStart = byId('sb-start');
  btnRestart = byId('sb-restart');
  btnBack = byId('sb-back');

  elTimer = byId('sb-timer');
  elScore = byId('sb-score');
  elCombo = byId('sb-combo');
  elRank  = byId('sb-rank');
  elHp    = byId('sb-hp');
  elBossHp = byId('sb-boss-hp');

  elFeverFill = byId('sb-fever-fill');
  elShield = byId('sb-shield');
  elMessage = byId('sb-msg');
  elBossName = byId('sb-boss-name');

  layerTargets = byId('sb-target-layer');
  layerFx = byId('sb-fx-layer');

  inputModeNormal = byId('sb-mode-normal');
  inputModeResearch = byId('sb-mode-research');
  inputDiff = byId('sb-diff');

  // ✅ FIX: ให้ตรงกับหน้า HTML ล่าสุดของคุณ
  inputPartId = document.getElementById('sb-participant-id');
  inputPartGroup = document.getElementById('sb-participant-group');
  inputPartNote = document.getElementById('sb-participant-note');
}

function showView(which){
  if (!viewMenu || !viewPlay || !viewEnd) return;
  viewMenu.style.display = (which === 'menu') ? '' : 'none';
  viewPlay.style.display = (which === 'play') ? '' : 'none';
  viewEnd.style.display  = (which === 'end')  ? '' : 'none';
}

function setMsg(text){
  if (!elMessage) return;
  elMessage.textContent = text || '';
}

function setShield(on){
  if (!elShield) return;
  elShield.style.display = on ? '' : 'none';
}

function setFever(v){
  if (!elFeverFill) return;
  const p = clamp(v, 0, 1);
  elFeverFill.style.width = (p * 100).toFixed(1) + '%';
}

function computeRank(score){
  if (score >= 1600) return 'SSS';
  if (score >= 1200) return 'SS';
  if (score >= 900)  return 'S';
  if (score >= 650)  return 'A';
  if (score >= 420)  return 'B';
  return 'C';
}

function uiSync(){
  if (!state) return;
  if (elTimer) elTimer.textContent = String(Math.max(0, Math.ceil(state.timeLeftMs / 1000)));
  if (elScore) elScore.textContent = String(state.score|0);
  if (elCombo) elCombo.textContent = String(state.combo|0);
  if (elRank)  elRank.textContent  = computeRank(state.score|0);
  if (elHp)    elHp.textContent    = String(state.playerHp|0);
  if (elBossHp) elBossHp.textContent = String(state.bossHp|0);
  setShield(state.shieldActive);
  setFever(state.fever);
  if (elBossName) elBossName.textContent = state.bossName || '';
}

function clearTargets(){
  if (!layerTargets) return;
  layerTargets.innerHTML = '';
}

function clearFx(){
  if (!layerFx) return;
  layerFx.innerHTML = '';
}

function spawnFxText(x, y, text, cls){
  if (!layerFx) return;
  const el = document.createElement('div');
  el.className = 'sb-fx ' + (cls || '');
  el.textContent = text || '';
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  layerFx.appendChild(el);
  setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 650);
}

function createTargetEl(kind, xPct, yPct, sizePx, ttlMs, meta){
  if (!layerTargets) return null;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sb-target sb-' + kind;
  btn.style.left = xPct.toFixed(1) + '%';
  btn.style.top  = yPct.toFixed(1) + '%';
  btn.style.width = sizePx + 'px';
  btn.style.height = sizePx + 'px';
  btn.dataset.kind = kind;
  btn.dataset.spawnMs = String(meta.spawnTime || nowMs());
  btn.dataset.targetId = String(meta.targetId || '');

  // icon
  const icon = document.createElement('div');
  icon.className = 'sb-icon';
  icon.textContent = meta.icon || '🎯';
  btn.appendChild(icon);

  layerTargets.appendChild(btn);

  // TTL -> miss
  const tmo = setTimeout(()=>{
    if (!state) return;
    if (!btn.isConnected) return;
    btn.remove();
    // miss
    state.miss++;
    state.playerHp = Math.max(0, state.playerHp - 1);
    state.combo = 0;
    state.fever = clamp(state.fever - state.cfg.feverLossMiss, 0, 1);
    setMsg('พลาด!');
    if (state.aiEnabled && state.ai) state.ai.onMiss();
  }, ttlMs);

  btn.addEventListener('click', (ev)=>{
    try{ ev.preventDefault(); ev.stopPropagation(); }catch(e){}
    if (!state || state.ended) return;
    if (!btn.isConnected) return;

    clearTimeout(tmo);
    btn.remove();

    const now = nowMs();
    const spawnTime = parseFloat(btn.dataset.spawnMs || String(now));
    const rt = Math.max(0, now - spawnTime);
    const targetId = btn.dataset.targetId || '';
    const kind2 = btn.dataset.kind || kind;

    const grade = state.aiEnabled && state.predictor ? state.predictor.judge(rt) : (rt <= 250 ? 'Perfect' : rt <= 360 ? 'Great' : rt <= 520 ? 'Good' : 'Ok');
    const delta = (grade === 'Perfect') ? 60 : (grade === 'Great') ? 45 : (grade === 'Good') ? 30 : 18;

    let scoreDelta = delta;
    let msg = grade;

    // apply kind effects
    if (kind2 === 'bomb'){
      if (state.shieldActive){
        msg = 'Shield!';
        scoreDelta = 0;
      } else {
        msg = 'Bomb!';
        state.playerHp = Math.max(0, state.playerHp - 2);
        state.combo = 0;
        scoreDelta = -40;
      }
      state.fever = clamp(state.fever - 0.10, 0, 1);
    } else if (kind2 === 'decoy'){
      msg = 'Decoy!';
      state.combo = 0;
      scoreDelta = Math.max(5, Math.floor(scoreDelta * 0.25));
      state.fever = clamp(state.fever - 0.06, 0, 1);
    } else if (kind2 === 'heal'){
      msg = 'Heal!';
      state.playerHp = Math.min(state.cfg.playerHp, state.playerHp + 1);
      scoreDelta = 10;
      state.fever = clamp(state.fever + 0.06, 0, 1);
    } else if (kind2 === 'shield'){
      msg = 'Shield+';
      state.shieldActive = true;
      state.shieldUntilMs = now + state.cfg.shieldDurationMs;
      scoreDelta = 12;
      state.fever = clamp(state.fever + 0.04, 0, 1);
    } else {
      // normal
      state.combo++;
      state.fever = clamp(state.fever + (grade === 'Perfect' ? state.cfg.feverGainPerfect : state.cfg.feverGainHit), 0, 1);
    }

    // fever bonus
    if (state.fever >= 1){
      scoreDelta = Math.floor(scoreDelta * 1.6);
      spawnFxText(10, 14, 'FEVER!', 'fever');
    }

    state.score += scoreDelta;
    state.hit++;

    // boss HP
    state.bossHp = Math.max(0, state.bossHp - Math.max(1, Math.floor((kind2 === 'normal' ? 1 : 0.5) * (grade === 'Perfect' ? 2 : 1))));

    // AI updates
    if (state.aiEnabled && state.ai) state.ai.onHit({ rt, grade, kind: kind2 });

    // event log
    if (state.eventLogger){
      state.eventLogger.add({
        ts_ms: Date.now(),
        mode: state.mode,
        diff: state.diffKey,
        boss_index: state.bossIndex,
        boss_phase: state.bossPhase,
        target_id: targetId,
        target_type: kind2,
        is_boss_face: 0,
        event_type: 'hit',
        rt_ms: Math.round(rt),
        grade: grade,
        score_delta: scoreDelta,
        combo_after: state.combo,
        score_after: state.score,
        player_hp: state.playerHp,
        boss_hp: state.bossHp
      });
    }

    // feedback
    setMsg(msg);

    // victory check
    if (state.bossHp <= 0){
      nextBossPhase();
    }

    uiSync();
  });

  return btn;
}

function spawnBossFaceTarget(ttlMs){
  const xPct = randRange(12, 78);
  const yPct = randRange(10, 58);
  const size = state.cfg.baseSize + 18;

  const meta = {
    targetId: 'bossface-' + state.bossIndex + '-' + (state.spawnCount|0),
    spawnTime: nowMs(),
    icon: '😈'
  };

  const el = createTargetEl('bossface', xPct, yPct, size, ttlMs, meta);
  if (!el) return;

  // override click for bossface
  el.addEventListener('click', ()=>{
    if (!state || state.ended) return;
    // extra boss damage already applied by normal flow, so add a little more
    state.bossHp = Math.max(0, state.bossHp - 4);
    if (state.eventLogger){
      state.eventLogger.add({
        ts_ms: Date.now(),
        mode: state.mode,
        diff: state.diffKey,
        boss_index: state.bossIndex,
        boss_phase: state.bossPhase,
        target_id: meta.targetId,
        target_type: 'bossface',
        is_boss_face: 1,
        event_type: 'hit',
        rt_ms: 0,
        grade: 'BossFace',
        score_delta: 0,
        combo_after: state.combo,
        score_after: state.score,
        player_hp: state.playerHp,
        boss_hp: state.bossHp
      });
    }
    if (state.bossHp <= 0) nextBossPhase();
    uiSync();
  }, { once: false });
}

function spawnTarget(){
  if (!state || state.ended) return;
  const cfg = state.cfg;

  // decide kind: use director weights when AI enabled, else fallback weights
  const kind = (state.aiEnabled && state.ai && state.ai.getWeights)
    ? pickWeighted(state.ai.getWeights())
    : pickWeighted([
      { v:'normal', w: 64 },
      { v:'decoy',  w: 10 },
      { v:'bomb',   w: 8 },
      { v:'heal',   w: 9 },
      { v:'shield', w: 9 }
    ]);

  const xPct = randRange(8, 84);
  const yPct = randRange(12, 70);

  const meta = {
    targetId: kind + '-' + state.spawnCount,
    spawnTime: nowMs(),
    icon: (kind === 'bomb') ? '💣'
        : (kind === 'decoy') ? '🪤'
        : (kind === 'heal') ? '💚'
        : (kind === 'shield') ? '🛡️'
        : '🎯'
  };

  createTargetEl(kind, xPct, yPct, cfg.baseSize, cfg.lifeMs, meta);
  state.spawnCount++;
}

function scheduleNextSpawn(){
  if (!state || state.ended) return;
  const cfg = state.cfg;

  // base delay
  let delay = randRange(cfg.spawnIntervalMin, cfg.spawnIntervalMax);

  // AI director: speed up / slow down
  if (state.aiEnabled && state.ai && typeof state.ai.getSpawnScale === 'function'){
    delay = delay * clamp(state.ai.getSpawnScale(), 0.75, 1.35);
  }

  delay = Math.max(220, delay);

  state.spawnTimer = setTimeout(()=>{
    spawnTarget();
    scheduleNextSpawn();
  }, delay);
}

function nextBossPhase(){
  if (!state) return;

  state.bossPhase++;
  state.combo = 0;
  state.fever = 0;
  setMsg('Boss Phase ' + state.bossPhase);

  // boss phase logic
  if (state.bossPhase > 3){
    state.bossIndex++;
    state.bossPhase = 1;
    if (state.bossIndex >= 3){
      // game clear
      endGame(true);
      return;
    }
  }

  const bossHpList = state.cfg.bossHp;
  state.bossHp = bossHpList[state.bossIndex] || bossHpList[bossHpList.length - 1];

  const bossNames = ['SHADOW BULL', 'NEON PHANTOM', 'VOID KING'];
  state.bossName = bossNames[state.bossIndex] || 'BOSS';

  // boss face attack burst
  const burst = 2 + state.bossPhase;
  for (let i=0;i<burst;i++){
    setTimeout(()=> spawnBossFaceTarget(Math.max(520, state.cfg.lifeMs - 120)), i*160);
  }

  uiSync();
}

function startGame(){
  const params = parseParams();
  const mode = (inputModeResearch && inputModeResearch.checked) ? 'research' : 'play';
  const diffKey = (inputDiff && inputDiff.value) ? inputDiff.value : params.diff;

  const cfg = getDiffCfg(diffKey);

  // participant meta (only for research)
  const participant = {
    id: (inputPartId && inputPartId.value || '').trim(),
    group: (inputPartGroup && inputPartGroup.value || '').trim(),
    note: (inputPartNote && inputPartNote.value || '').trim()
  };

  if (mode === 'research'){
    if (!participant.id){
      alert('โหมด Research: กรุณากรอก Participant ID');
      return;
    }
  }

  // init state
  state = {
    mode,
    diffKey,
    cfg,
    timeTotalMs: (params.time || 70) * 1000,
    timeLeftMs: (params.time || 70) * 1000,
    startedAtMs: nowMs(),
    ended: false,

    // score metrics
    score: 0,
    combo: 0,
    fever: 0,
    hit: 0,
    miss: 0,

    // hp
    playerHp: cfg.playerHp,
    bossHp: cfg.bossHp[0],
    shieldActive: false,
    shieldUntilMs: 0,

    // boss
    bossIndex: 0,
    bossPhase: 1,
    bossName: 'SHADOW BULL',

    // spawn
    spawnTimer: 0,
    spawnCount: 0,

    participant,

    // loggers
    sessionLogger: (mode === 'research') ? new SessionLogger() : null,
    eventLogger: (mode === 'research') ? new EventLogger() : null,

    // ✅ AI enable policy
    aiEnabled: (AI_QUERY === null) ? ((mode || 'play') === 'play') : !!AI_QUERY,
    ai: null,
    predictor: null,
    coach: null,
    dl: null
  };

  // init AI modules (play mode default on)
  if (state.aiEnabled){
    state.ai = new AIDirector({ diff: diffKey });
    state.predictor = new AIPredictor();
    state.coach = new AICoach();
    state.dl = new DLFeatures();
    setMsg('AI ON');
  } else {
    setMsg('');
  }

  // start phase
  nextBossPhase();

  clearTargets();
  clearFx();
  showView('play');
  uiSync();

  // start spawn loop
  if (state.spawnTimer) clearTimeout(state.spawnTimer);
  scheduleNextSpawn();

  // start game loop
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(gameLoop);
}

function endGame(clear){
  if (!state || state.ended) return;
  state.ended = true;

  try{ if (state.spawnTimer) clearTimeout(state.spawnTimer); }catch(e){}
  state.spawnTimer = 0;

  clearTargets();

  const totalSec = Math.max(1, Math.round((state.timeTotalMs - state.timeLeftMs)/1000));
  const rank = computeRank(state.score|0);

  // session log
  if (state.sessionLogger){
    state.sessionLogger.add({
      ts_ms: Date.now(),
      build: BUILD.build_version,
      mode: state.mode,
      diff: state.diffKey,
      duration_s: totalSec,
      score: state.score,
      rank: rank,
      hit: state.hit,
      miss: state.miss,
      boss_index: state.bossIndex,
      boss_phase: state.bossPhase,
      player_hp_end: state.playerHp,
      ai_enabled: state.aiEnabled ? 1 : 0,
      participant_id: state.participant?.id || '',
      participant_group: state.participant?.group || '',
      note: state.participant?.note || ''
    });
  }

  // end screen fill
  byId('sb-end-title').textContent = clear ? 'CLEAR!' : 'GAME OVER';
  byId('sb-end-score').textContent = String(state.score|0);
  byId('sb-end-rank').textContent = rank;
  byId('sb-end-hit').textContent = String(state.hit|0);
  byId('sb-end-miss').textContent = String(state.miss|0);
  byId('sb-end-ai').textContent = state.aiEnabled ? 'ON' : 'OFF';

  showView('end');

  // download buttons only in research
  const dlSession = byId('sb-dl-session');
  const dlEvent = byId('sb-dl-event');
  if (dlSession) dlSession.style.display = state.sessionLogger ? '' : 'none';
  if (dlEvent) dlEvent.style.display = state.eventLogger ? '' : 'none';
}

function gameLoop(){
  if (!state || state.ended) return;

  const now = nowMs();
  const elapsed = now - state.startedAtMs;
  const remain = Math.max(0, state.timeTotalMs - elapsed);
  state.timeLeftMs = remain;

  // shield timeout
  if (state.shieldActive && now >= state.shieldUntilMs){
    state.shieldActive = false;
  }

  // AI coach microtips (play)
  if (state.aiEnabled && state.coach && typeof state.coach.maybeTip === 'function'){
    const tip = state.coach.maybeTip({
      diff: state.diffKey,
      score: state.score,
      hit: state.hit,
      miss: state.miss,
      combo: state.combo,
      fever: state.fever
    });
    if (tip) setMsg(tip);
  }

  // lose conditions
  if (state.playerHp <= 0){
    endGame(false);
    return;
  }
  if (remain <= 0){
    endGame(state.bossIndex >= 2); // consider clear if reached final boss
    return;
  }

  uiSync();
  rafId = requestAnimationFrame(gameLoop);
}

function bindUi(){
  if (btnStart) btnStart.addEventListener('click', startGame);
  if (btnRestart) btnRestart.addEventListener('click', ()=>{ showView('menu'); });
  if (btnBack) btnBack.addEventListener('click', ()=>{ history.back(); });

  const dlSession = byId('sb-dl-session');
  const dlEvent = byId('sb-dl-event');

  if (dlSession) dlSession.addEventListener('click', ()=>{
    if (!state || !state.sessionLogger) return;
    downloadSessionCsv(state.sessionLogger, 'shadow-breaker-session.csv');
  });
  if (dlEvent) dlEvent.addEventListener('click', ()=>{
    if (!state || !state.eventLogger) return;
    downloadEventCsv(state.eventLogger, 'shadow-breaker-events.csv');
  });
}

export function initShadowBreaker(){
  mountDomRefs();
  bindUi();
  showView('menu');
  setMsg('');
  uiSync();
}

// auto init
document.addEventListener('DOMContentLoaded', ()=>{
  try{ initShadowBreaker(); }catch(e){ console.error(e); }
});