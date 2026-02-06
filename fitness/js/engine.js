// === /fitness/js/engine.js ===
// Shadow Breaker — TESTABLE PRODUCTION ENGINE (PATCH F)
// Goals:
// ✅ Enter game reliably (no dependency on session-logger.js)
// ✅ Targets spawn/remove, score/combo/miss, fever, HP bars
// ✅ AI tips via DLFeatures (safe; never crash)
// ✅ Difficulty sizes via AIPattern (Option A)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { AIPattern } from './ai-pattern.js';
import { DLFeatures } from './dl-features.js';

// -------------------------
// helpers
// -------------------------
const $ = (s)=>document.querySelector(s);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const nowMs = ()=>performance.now();

function getQS(){
  try { return new URL(location.href).searchParams; }
  catch { return new URLSearchParams(); }
}
const QS = getQS();

function qsStr(k, d=''){ const v = QS.get(k); return (v==null?d:String(v)); }
function qsNum(k, d){ const v = Number(QS.get(k)); return Number.isFinite(v)?v:d; }

function setView(which){
  const views = ['menu','play','result'];
  for(const v of views){
    const el = document.getElementById(`sb-view-${v}`);
    if (el) el.classList.toggle('is-active', v===which);
  }
}

function setText(id, txt){
  const el = document.getElementById(id);
  if (el) el.textContent = String(txt);
}
function setScaleX(id, pct){ // pct 0..1
  const el = document.getElementById(id);
  if (el) el.style.transform = `scaleX(${clamp(pct,0,1)})`;
}

function setFeedback(text, mood=''){
  const el = document.getElementById('sb-msg-main');
  if (!el) return;
  el.classList.remove('good','bad','miss','perfect');
  if (mood) el.classList.add(mood);
  el.textContent = text || '';
}

function decodeHub(){
  const hub = qsStr('hub','');
  if (!hub) return './hub.html';
  try { return decodeURIComponent(hub); } catch { return hub; }
}

// -------------------------
// config
// -------------------------
const DIFF_CONFIG = {
  easy:   { spawnMs: 820, ttlMs: 1550, baseSize: 160 },
  normal: { spawnMs: 720, ttlMs: 1350, baseSize: 135 },
  hard:   { spawnMs: 620, ttlMs: 1200, baseSize: 120 }
};

// -------------------------
// state
// -------------------------
const state = {
  running:false,
  ended:false,
  mode:'normal', // normal|research
  pid:'',
  group:'',
  note:'',
  diff:'normal',
  durationSec:70,

  // gameplay
  tStart:0,
  tNow:0,
  score:0,
  combo:0,
  maxCombo:0,
  miss:0,
  hit:0,
  total:0,

  playerHp: 1.0,
  bossHp: 1.0,
  shield: 0,
  phase: 1,

  fever: 0,      // 0..1
  feverOn:false,

  // target bookkeeping
  nextId:1,
  alive:new Map(), // id -> {id, bornMs, ttlMs, type, sizePx, bossEmoji}
  spawnTimer:null,
  tickRaf:null,

  renderer:null,
};

// -------------------------
// boot UI
// -------------------------
function wireMenu(){
  const btnNormal = $('#sb-mode-normal');
  const btnResearch = $('#sb-mode-research');
  const desc = $('#sb-mode-desc');
  const researchBox = $('#sb-research-box');

  const diffSel = $('#sb-diff');
  const timeSel = $('#sb-time');

  const pidIn = $('#sb-part-id');
  const grpIn = $('#sb-part-group');
  const noteIn = $('#sb-part-note');

  const btnPlay = $('#sb-btn-play');
  const btnRes  = $('#sb-btn-research');
  const btnHow  = $('#sb-btn-howto');
  const howBox  = $('#sb-howto');

  function applyModeUI(){
    btnNormal?.classList.toggle('is-active', state.mode==='normal');
    btnResearch?.classList.toggle('is-active', state.mode==='research');
    if (desc){
      desc.textContent = (state.mode==='research')
        ? 'Research: กรอก Participant/Group เพื่อใช้งานวิจัย (AI assist ล็อก)'
        : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
    }
    if (researchBox){
      researchBox.classList.toggle('is-on', state.mode==='research');
    }
  }

  btnNormal?.addEventListener('click', ()=>{
    state.mode='normal';
    applyModeUI();
  });
  btnResearch?.addEventListener('click', ()=>{
    state.mode='research';
    applyModeUI();
  });

  btnHow?.addEventListener('click', ()=>{
    howBox?.classList.toggle('is-on');
  });

  // apply query defaults
  const qMode = qsStr('mode','').toLowerCase();
  if (qMode === 'research') state.mode = 'research';

  const qDiff = qsStr('diff','').toLowerCase();
  if (qDiff === 'easy' || qDiff === 'normal' || qDiff === 'hard') state.diff = qDiff;

  const qTime = qsNum('time', NaN);
  if (Number.isFinite(qTime) && qTime>=20 && qTime<=300) state.durationSec = Math.round(qTime);

  // UI set
  if (diffSel) diffSel.value = state.diff;
  if (timeSel) timeSel.value = String(state.durationSec);

  // hub link
  const hubA = document.querySelector('.sb-link');
  if (hubA) hubA.href = decodeHub();

  applyModeUI();

  btnPlay?.addEventListener('click', ()=>{
    state.mode='normal';
    startFromMenu();
  });
  btnRes?.addEventListener('click', ()=>{
    state.mode='research';
    startFromMenu();
  });

  function startFromMenu(){
    // read inputs
    state.diff = diffSel ? String(diffSel.value || 'normal') : state.diff;
    state.durationSec = timeSel ? Number(timeSel.value||70) : state.durationSec;

    state.pid = qsStr('pid','') || (pidIn ? String(pidIn.value||'').trim() : '');
    state.group = grpIn ? String(grpIn.value||'').trim() : '';
    state.note = noteIn ? String(noteIn.value||'').trim() : '';

    // if research: require pid
    if (state.mode==='research' && !state.pid){
      alert('Research mode: กรุณากรอก Participant ID');
      return;
    }

    startGame();
  }
}

function wirePlayControls(){
  const back = $('#sb-btn-back-menu');
  const stop = $('#sb-btn-pause');

  back?.addEventListener('click', ()=>{
    stopGame('back_menu');
    setView('menu');
  });

  stop?.addEventListener('change', ()=>{
    if (!stop.checked) return;
    stop.checked = false;
    stopGame('stopped');
    setView('menu');
  });
}

function wireResult(){
  $('#sb-btn-result-retry')?.addEventListener('click', ()=>{
    startGame();
  });
  $('#sb-btn-result-menu')?.addEventListener('click', ()=>{
    setView('menu');
  });

  // CSV buttons: keep but no-op for now (google sheet postponed)
  $('#sb-btn-download-events')?.addEventListener('click', ()=>{
    alert('พักเรื่อง CSV/Google Sheet ไว้ก่อน (ตามที่ตกลง) — ตอนนี้โฟกัสทำเกมให้สนุกและนิ่ง');
  });
  $('#sb-btn-download-session')?.addEventListener('click', ()=>{
    alert('พักเรื่อง CSV/Google Sheet ไว้ก่อน (ตามที่ตกลง) — ตอนนี้โฟกัสทำเกมให้สนุกและนิ่ง');
  });
}

// -------------------------
// game core
// -------------------------
function resetStateForRun(){
  state.running = true;
  state.ended = false;

  state.tStart = nowMs();
  state.tNow = state.tStart;

  state.score = 0;
  state.combo = 0;
  state.maxCombo = 0;
  state.miss = 0;
  state.hit = 0;
  state.total = 0;

  state.playerHp = 1.0;
  state.bossHp = 1.0;
  state.shield = 0;
  state.phase = 1;

  state.fever = 0;
  state.feverOn = false;

  state.nextId = 1;
  state.alive.clear();

  // clear stage
  const layer = $('#sb-target-layer');
  if (!layer) throw new Error('Missing #sb-target-layer');
  if (state.renderer) state.renderer.destroy();
  state.renderer = new DomRendererShadow(layer, {
    onTargetHit: onTargetHit
  });
  state.renderer.setDifficulty(state.diff);

  setFeedback('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');
}

function diffCfg(){
  const d = state.diff;
  const cfg = DIFF_CONFIG[d] || DIFF_CONFIG.normal;
  // PATCH F: enforce target size policy A (+ auto-scale)
  cfg.baseSize = AIPattern.sizePx(d);
  return cfg;
}

function spawnOne(){
  const cfg = diffCfg();

  // choose target type (simple but fun)
  // normal mostly, plus occasional bomb/heal/shield/decoy
  const r = Math.random();
  let type = 'normal';
  if (r < 0.08) type = 'bomb';
  else if (r < 0.14) type = 'decoy';
  else if (r < 0.20) type = 'heal';
  else if (r < 0.26) type = 'shield';

  // fever on increases risk/reward: more decoy/bomb
  if (state.feverOn) {
    const r2 = Math.random();
    if (r2 < 0.15) type = 'bomb';
    else if (r2 < 0.30) type = 'decoy';
  }

  const id = state.nextId++;
  const data = {
    id,
    type,
    sizePx: cfg.baseSize,
    bossEmoji: '👊'
  };

  const born = nowMs();
  const ttl = cfg.ttlMs;
  state.alive.set(id, { ...data, bornMs: born, ttlMs: ttl });
  state.total++;

  state.renderer.spawnTarget(data);

  // auto expire
  window.setTimeout(()=>{
    if (!state.running) return;
    if (!state.alive.has(id)) return;
    // expired => miss (if not bomb/heal/shield/decoy? still count as miss feel)
    applyMiss(id, 'expired');
  }, ttl);
}

function applyHit(id, type, pt){
  const wasAlive = state.alive.get(id);
  if (!wasAlive) return;

  state.alive.delete(id);
  state.renderer.removeTarget(id, 'hit');

  const cfg = diffCfg();

  // scoring rules
  let delta = 0;
  let grade = 'good';

  if (type === 'normal') {
    delta = state.feverOn ? 18 : 12;
    state.combo++;
    state.hit++;
    grade = (state.combo % 7 === 0) ? 'perfect' : 'good';

    // boss damage
    const dmg = state.feverOn ? 0.060 : 0.040;
    state.bossHp = clamp(state.bossHp - dmg, 0, 1);

    // fever gain
    state.fever = clamp(state.fever + (state.feverOn ? 0.05 : 0.08), 0, 1);
    if (state.fever >= 1 && !state.feverOn) {
      state.feverOn = true;
      state.fever = 1;
      setFeedback('FEVER ON! 🔥 ตีให้เดือด!', 'perfect');
      // fever lasts short
      window.setTimeout(()=>{
        state.feverOn = false;
        state.fever = 0.25;
        setFeedback('FEVER จบแล้ว—คุมจังหวะต่อ!', '');
      }, 2600);
    }
  }

  else if (type === 'decoy') {
    // decoy: punish unless shield
    if (state.shield > 0) {
      state.shield--;
      delta = 2;
      grade = 'good';
      setFeedback('กันหลอกด้วย Shield! 🛡️', 'good');
    } else {
      state.combo = 0;
      state.miss++;
      delta = -8;
      grade = 'bad';
      state.playerHp = clamp(state.playerHp - 0.10, 0, 1);
      setFeedback('โดนหลอก! 👀', 'bad');
    }
  }

  else if (type === 'bomb') {
    if (state.shield > 0) {
      state.shield--;
      delta = 0;
      grade = 'shield';
      setFeedback('Shield กันระเบิด! 💥🛡️', 'good');
    } else {
      state.combo = 0;
      state.miss++;
      delta = -14;
      grade = 'bomb';
      state.playerHp = clamp(state.playerHp - 0.18, 0, 1);
      setFeedback('BOOM! 💣 ระวังเป้าระเบิด', 'bad');
    }
  }

  else if (type === 'heal') {
    delta = 4;
    grade = 'heal';
    state.playerHp = clamp(state.playerHp + 0.14, 0, 1);
    setFeedback('+HP 🩹', 'good');
  }

  else if (type === 'shield') {
    delta = 4;
    grade = 'shield';
    state.shield = clamp(state.shield + 1, 0, 9);
    setFeedback('+SHIELD 🛡️', 'good');
  }

  state.score = Math.max(0, state.score + delta);
  state.maxCombo = Math.max(state.maxCombo, state.combo);

  // fx
  state.renderer.playHitFx(id, { clientX: pt.clientX, clientY: pt.clientY, grade, scoreDelta: delta });

  // phase logic (boss)
  if (state.bossHp <= 0) {
    state.phase++;
    state.bossHp = 1.0;
    setFeedback(`ผ่าน Boss เฟส ${state.phase-1}! ไปเฟส ${state.phase} 🔥`, 'perfect');

    // make harder as phase grows (soft)
    DIFF_CONFIG[state.diff].spawnMs = Math.max(420, DIFF_CONFIG[state.diff].spawnMs - 18);
    DIFF_CONFIG[state.diff].ttlMs = Math.max(820, DIFF_CONFIG[state.diff].ttlMs - 10);
  }

  // update HUD
  drawHUD();

  // AI micro tip (only when enabled)
  if (DLFeatures.isAssistEnabled()) {
    const tip = DLFeatures.tip({
      accPct: state.total ? (state.hit / state.total) * 100 : 0,
      hp: state.playerHp * 100,
      hitMiss: state.miss
    });
    if (tip && Math.random() < 0.28) {
      state.renderer.playHitFx(id, { clientX: pt.clientX, clientY: pt.clientY, grade:'good', scoreDelta: 0 });
      setFeedback('AI: ' + tip, 'good');
    }
  }
}

function applyMiss(id, reason){
  const t = state.alive.get(id);
  if (!t) return;
  state.alive.delete(id);
  state.renderer.removeTarget(id, reason || 'miss');

  state.miss++;
  state.combo = 0;

  // small hp drain on miss (fair)
  state.playerHp = clamp(state.playerHp - 0.05, 0, 1);

  drawHUD();
  setFeedback('MISS! รีบจับจังหวะกลับมา', 'miss');

  if (state.playerHp <= 0) {
    finish('dead');
  }
}

function onTargetHit(id, pt){
  if (!state.running) return;
  const t = state.alive.get(id);
  if (!t) return;
  applyHit(id, t.type, pt || {clientX:window.innerWidth/2, clientY:window.innerHeight/2});
}

function drawHUD(){
  const elapsed = (nowMs() - state.tStart) / 1000;
  const remain = Math.max(0, state.durationSec - elapsed);

  setText('sb-text-time', `${remain.toFixed(1)} s`);
  setText('sb-text-score', state.score);
  setText('sb-text-combo', state.combo);
  setText('sb-text-miss', state.miss);
  setText('sb-text-shield', state.shield);
  setText('sb-text-phase', state.phase);

  // bars
  setScaleX('sb-hp-you-top', state.playerHp);
  setScaleX('sb-hp-you-bottom', state.playerHp);
  setScaleX('sb-hp-boss-top', state.bossHp);
  setScaleX('sb-hp-boss-bottom', state.bossHp);

  // fever
  setScaleX('sb-fever-bar', state.fever);
  const feverLbl = $('#sb-label-fever');
  if (feverLbl){
    feverLbl.textContent = state.feverOn ? 'ON 🔥' : (state.fever >= 1 ? 'READY' : Math.round(state.fever*100)+'%');
    feverLbl.classList.toggle('on', !!state.feverOn);
  }
}

function loopTick(){
  if (!state.running) return;

  const elapsed = (nowMs() - state.tStart) / 1000;
  if (elapsed >= state.durationSec) {
    finish('timeup');
    return;
  }

  drawHUD();
  state.tickRaf = requestAnimationFrame(loopTick);
}

function startSpawning(){
  const cfg = diffCfg();
  // spawn immediately
  spawnOne();

  const tick = ()=>{
    if (!state.running) return;
    spawnOne();
    const cfg2 = diffCfg();
    state.spawnTimer = window.setTimeout(tick, cfg2.spawnMs);
  };
  state.spawnTimer = window.setTimeout(tick, cfg.spawnMs);
}

function stopTimers(){
  if (state.spawnTimer) { clearTimeout(state.spawnTimer); state.spawnTimer = null; }
  if (state.tickRaf) { cancelAnimationFrame(state.tickRaf); state.tickRaf = null; }
}

function finish(reason){
  if (!state.running) return;
  state.running = false;
  state.ended = true;

  stopTimers();

  // clear remaining targets
  try { state.renderer?.destroy(); } catch {}
  state.alive.clear();

  // compute results
  const elapsed = Math.min(state.durationSec, (nowMs() - state.tStart)/1000);
  const acc = state.total ? (state.hit / state.total) : 0;

  // grade
  let grade = 'C';
  if (acc >= 0.85 && state.miss <= 8) grade = 'SSS';
  else if (acc >= 0.78) grade = 'S';
  else if (acc >= 0.68) grade = 'A';
  else if (acc >= 0.55) grade = 'B';

  setText('sb-res-time', `${elapsed.toFixed(1)} s`);
  setText('sb-res-score', state.score);
  setText('sb-res-max-combo', state.maxCombo);
  setText('sb-res-miss', state.miss);
  setText('sb-res-phase', state.phase);
  setText('sb-res-boss-cleared', Math.max(0, state.phase-1));
  setText('sb-res-acc', `${(acc*100).toFixed(1)} %`);
  setText('sb-res-grade', grade);

  setView('result');
}

function stopGame(reason){
  if (!state.running) return;
  state.running = false;
  stopTimers();
  try { state.renderer?.destroy(); } catch {}
  state.alive.clear();
}

function startGame(){
  // set attributes
  const wrap = $('#sb-wrap');
  if (wrap) {
    wrap.dataset.diff = state.diff;
    wrap.dataset.phase = String(state.phase);
    wrap.dataset.boss = '0';
  }

  // also sync hub link each start (in case query changed)
  const hubA = document.querySelector('.sb-link');
  if (hubA) hubA.href = decodeHub();

  // reset & go
  try{
    resetStateForRun();
    setView('play');
    drawHUD();
    startSpawning();
    loopTick();
  }catch(err){
    console.error(err);
    alert('Engine error: ' + (err?.message || err));
    setView('menu');
  }
}

// -------------------------
// init
// -------------------------
function init(){
  // default hub
  const hubA = document.querySelector('.sb-link');
  if (hubA) hubA.href = decodeHub();

  wireMenu();
  wirePlayControls();
  wireResult();

  // start directly if query has diff/time/pid and you want auto-start? (not now)
  setView('menu');
}

init();