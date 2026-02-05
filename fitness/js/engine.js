// === /fitness/js/engine.js ===
// Shadow Breaker Engine — PATCH: robust AI + no boot crash
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { DL_SYNC } from './dl-features.js';

// (imports อื่น ๆ ของคุณ: event-logger, session-logger, stats-store,
//  ai-director, ai-coach, ai-pattern, ฯลฯ ใส่เหมือนเดิมได้เลย)

// ---------------- fatal overlay ----------------
function fatal(err){
  console.error(err);
  try{
    const box = document.createElement('div');
    box.style.position='fixed';
    box.style.inset='12px';
    box.style.zIndex='99999';
    box.style.background='rgba(2,6,23,.88)';
    box.style.border='1px solid rgba(148,163,184,.25)';
    box.style.borderRadius='18px';
    box.style.padding='14px';
    box.style.color='#e5e7eb';
    box.style.fontFamily='system-ui';
    box.innerHTML = `<div style="font-weight:900;font-size:16px;margin-bottom:8px;">Shadow Breaker — ERROR</div>
      <div style="opacity:.9;white-space:pre-wrap;font-size:13px;line-height:1.35;">${String(err && (err.stack||err.message||err))}</div>`;
    document.body.appendChild(box);
  }catch{}
}

// ---------------- tiny helpers ----------------
function qs(sel){ return document.querySelector(sel); }
function qsid(id){ return document.getElementById(id); }

function readParam(key, def=null){
  try{
    const v = new URL(location.href).searchParams.get(key);
    return v==null ? def : v;
  }catch{ return def; }
}
function setView(activeId){
  // menu/play/result
  const ids = ['sb-view-menu','sb-view-play','sb-view-result'];
  for (const id of ids){
    const el = qsid(id);
    if (!el) continue;
    el.classList.toggle('is-active', id === activeId);
  }
}

function clamp(v,a,b){ v = Number(v)||0; return Math.max(a, Math.min(b, v)); }

// ---------------- state ----------------
const S = {
  mode: 'normal',        // 'normal' | 'research'
  diff: 'normal',        // easy/normal/hard
  timeSec: 70,
  running: false,

  score: 0,
  combo: 0,
  miss: 0,
  phase: 1,
  bossesCleared: 0,

  // hp bars (0..1)
  hpYou: 1,
  hpBoss: 1,

  // timers
  tStart: 0,
  tNow: 0,

  // renderer
  renderer: null,

  // active targets meta (engine side) — คุณอาจมีโครงสร้างของคุณเองอยู่แล้ว
  // ที่นี่เป็น placeholder ให้ boot ไม่พัง
};

// ---------------- UI bind ----------------
function uiSync(){
  const t = Math.max(0, (S.timeSec - (S.tNow - S.tStart)/1000));
  const timeEl = qsid('sb-text-time');
  if (timeEl) timeEl.textContent = `${t.toFixed(1)} s`;

  const scoreEl = qsid('sb-text-score');
  if (scoreEl) scoreEl.textContent = String(S.score);

  const comboEl = qsid('sb-text-combo');
  if (comboEl) comboEl.textContent = String(S.combo);

  const missEl = qsid('sb-text-miss');
  if (missEl) missEl.textContent = String(S.miss);

  const phaseEl = qsid('sb-text-phase');
  if (phaseEl) phaseEl.textContent = String(S.phase);

  const shEl = qsid('sb-text-shield');
  if (shEl) shEl.textContent = '0';

  // hp bars scaleX
  const youTop = qsid('sb-hp-you-top');
  const bossTop = qsid('sb-hp-boss-top');
  const youBot = qsid('sb-hp-you-bottom');
  const bossBot = qsid('sb-hp-boss-bottom');
  const y = clamp(S.hpYou,0,1);
  const b = clamp(S.hpBoss,0,1);
  if (youTop) youTop.style.transform = `scaleX(${y})`;
  if (youBot) youBot.style.transform = `scaleX(${y})`;
  if (bossTop) bossTop.style.transform = `scaleX(${b})`;
  if (bossBot) bossBot.style.transform = `scaleX(${b})`;
}

function setMsg(kind, text){
  const el = qsid('sb-msg-main');
  if (!el) return;
  el.classList.remove('good','bad','miss','perfect');
  if (kind) el.classList.add(kind);
  el.textContent = text || '';
}

// ---------------- gameplay placeholders ----------------
// IMPORTANT: ส่วนนี้คือ “โครง” ให้ engine บูทได้แน่นอน
// คุณสามารถแทนที่ด้วย logic จริงของคุณได้โดยคง contract เดิมไว้

function makeSnapshot(){
  // ให้ predictor ใช้ได้เหมือนที่คุณออกแบบไว้
  // { accPct, hitMiss, combo, offsetAbsMean, hp, songTime, durationSec, hitPerfect/hitGreat/hitGood }
  const judged = (S.score>0 || S.miss>0) ? (S.score/10 + S.miss) : 0;
  const accPct = judged ? clamp(((judged - S.miss)/judged)*100, 0, 100) : 0;

  return {
    accPct,
    hitMiss: S.miss,
    combo: S.combo,
    offsetAbsMean: 0.06, // placeholder
    hp: Math.round(S.hpYou*100),
    songTime: (S.tNow - S.tStart)/1000,
    durationSec: S.timeSec,
    hitPerfect: 0,
    hitGreat: 0,
    hitGood: Math.round((judged - S.miss))
  };
}

function onHitTarget(id, pt){
  // ✅ ตัวอย่าง pipeline: เพิ่มคะแนน + เอฟเฟกต์
  S.score += 10;
  S.combo += 1;
  setMsg('good', 'โดน! ดีมาก');

  // FX (สำคัญ: ต้องเรียก playHitFx ถึงจะเห็นเอฟเฟกต์)
  if (S.renderer){
    S.renderer.playHitFx(id, {
      clientX: pt?.clientX,
      clientY: pt?.clientY,
      grade: 'good',
      scoreDelta: 10
    });
  }

  // AI micro-tip (ถ้าเปิด ai=1 และไม่ใช่ research)
  if (DL_SYNC.isAssistEnabled()){
    const pred = DL_SYNC.predict(makeSnapshot());
    if (pred?.tip){
      // ใช้ msg กลางเป็น tip แบบเบา ๆ
      setMsg('perfect', pred.tip);
    }
  }
}

function onMiss(){
  S.miss += 1;
  S.combo = 0;
  setMsg('miss', 'พลาด! รีบคุมจังหวะ');
}

// spawn demo target (คุณแทนด้วย spawner ของคุณได้)
let _nextId = 1;
function spawnOne(){
  if (!S.renderer) return;
  const id = _nextId++;
  S.renderer.spawnTarget({
    id,
    type: 'normal',
    sizePx: (S.diff==='easy') ? 140 : (S.diff==='hard' ? 110 : 125),
    bossEmoji: '🐣'
  });

  // timeout auto-miss (placeholder)
  setTimeout(()=>{
    // ถ้ายังอยู่ -> ถือว่าพลาด
    // remove + miss
    // NOTE: renderer.removeTarget ปลอดภัยแม้ไม่มี target
    S.renderer.removeTarget(id, 'timeout');
    onMiss();
  }, (S.diff==='hard') ? 900 : (S.diff==='easy' ? 1400 : 1100));
}

// ---------------- loop ----------------
let _raf = 0;
function loop(){
  if (!S.running) return;
  S.tNow = performance.now();
  uiSync();

  const elapsed = (S.tNow - S.tStart)/1000;
  if (elapsed >= S.timeSec){
    finish();
    return;
  }

  // spawn rate placeholder
  // (คุณแทนด้วย director/pattern ของจริงได้)
  if (Math.random() < (S.diff==='hard' ? 0.18 : S.diff==='easy' ? 0.11 : 0.14)){
    spawnOne();
  }

  _raf = requestAnimationFrame(loop);
}

// ---------------- start/stop ----------------
function startRun(mode){
  S.mode = mode || 'normal';
  S.running = true;

  // reset
  S.score = 0; S.combo = 0; S.miss = 0;
  S.phase = 1; S.bossesCleared = 0;
  S.hpYou = 1; S.hpBoss = 1;

  setView('sb-view-play');
  setMsg('', 'แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!');

  S.tStart = performance.now();
  S.tNow = S.tStart;

  // renderer init
  const layer = qsid('sb-target-layer');
  if (!layer) throw new Error('Missing #sb-target-layer');

  if (S.renderer) {
    try{ S.renderer.destroy(); } catch {}
    S.renderer = null;
  }

  S.renderer = new DomRendererShadow(layer, {
    onTargetHit: (id, pt) => {
      // IMPORTANT: remove target first (กันยิงซ้ำ)
      try{ S.renderer.removeTarget(id, 'hit'); } catch {}
      onHitTarget(id, pt);
    }
  });
  S.renderer.setDifficulty(S.diff);

  // kick first spawn
  for (let i=0;i<2;i++) spawnOne();

  cancelAnimationFrame(_raf);
  _raf = requestAnimationFrame(loop);
}

function stopRun(){
  S.running = false;
  cancelAnimationFrame(_raf);
  _raf = 0;
}

function finish(){
  stopRun();

  // fill result UI
  const elapsed = Math.min(S.timeSec, (S.tNow - S.tStart)/1000);
  const acc = makeSnapshot().accPct;

  const resTime = qsid('sb-res-time'); if (resTime) resTime.textContent = `${elapsed.toFixed(1)} s`;
  const resScore = qsid('sb-res-score'); if (resScore) resScore.textContent = String(S.score);
  const resCombo = qsid('sb-res-max-combo'); if (resCombo) resCombo.textContent = String(S.combo);
  const resMiss = qsid('sb-res-miss'); if (resMiss) resMiss.textContent = String(S.miss);
  const resPhase = qsid('sb-res-phase'); if (resPhase) resPhase.textContent = String(S.phase);
  const resBoss = qsid('sb-res-boss-cleared'); if (resBoss) resBoss.textContent = String(S.bossesCleared);
  const resAcc = qsid('sb-res-acc'); if (resAcc) resAcc.textContent = `${acc.toFixed(1)} %`;

  const gradeEl = qsid('sb-res-grade');
  if (gradeEl){
    let g = 'C';
    if (acc >= 90) g='S';
    else if (acc >= 80) g='A';
    else if (acc >= 70) g='B';
    gradeEl.textContent = g;
  }

  setView('sb-view-result');
}

// ---------------- menu wiring ----------------
function wireMenu(){
  const btnPlay = qsid('sb-btn-play');
  const btnResearch = qsid('sb-btn-research');
  const btnHowto = qsid('sb-btn-howto');
  const howto = qsid('sb-howto');

  const modeNormal = qsid('sb-mode-normal');
  const modeResearch = qsid('sb-mode-research');
  const modeDesc = qsid('sb-mode-desc');
  const rb = qsid('sb-research-box');

  const selDiff = qsid('sb-diff');
  const selTime = qsid('sb-time');

  function setMode(m){
    S.mode = (m==='research') ? 'research' : 'normal';
    modeNormal?.classList.toggle('is-active', S.mode==='normal');
    modeResearch?.classList.toggle('is-active', S.mode==='research');
    rb?.classList.toggle('is-on', S.mode==='research');

    if (modeDesc){
      modeDesc.textContent = (S.mode==='research')
        ? 'Research: เก็บข้อมูลผู้เข้าร่วม (ล็อก AI) และบันทึกผล'
        : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
    }
  }

  modeNormal?.addEventListener('click', ()=>setMode('normal'));
  modeResearch?.addEventListener('click', ()=>setMode('research'));

  selDiff?.addEventListener('change', ()=>{
    S.diff = String(selDiff.value || 'normal');
  });
  selTime?.addEventListener('change', ()=>{
    S.timeSec = clamp(selTime.value, 20, 600);
  });

  btnHowto?.addEventListener('click', ()=>{
    howto?.classList.toggle('is-on');
  });

  btnPlay?.addEventListener('click', ()=>{
    setMode('normal');
    startRun('normal');
  });

  btnResearch?.addEventListener('click', ()=>{
    setMode('research');
    startRun('research');
  });

  // play view controls
  qsid('sb-btn-back-menu')?.addEventListener('click', ()=>{
    stopRun();
    setView('sb-view-menu');
  });

  // result controls
  qsid('sb-btn-result-menu')?.addEventListener('click', ()=>{
    setView('sb-view-menu');
  });
  qsid('sb-btn-result-retry')?.addEventListener('click', ()=>{
    startRun(S.mode);
  });

  // pause/stop toggle
  const stopToggle = qsid('sb-btn-pause');
  stopToggle?.addEventListener('change', ()=>{
    if (stopToggle.checked){
      stopRun();
      setMsg('miss', 'หยุดเกมแล้ว (Stop)');
    } else {
      // resume: restart timer baseline
      S.tStart = performance.now() - (S.tNow - S.tStart);
      S.running = true;
      cancelAnimationFrame(_raf);
      _raf = requestAnimationFrame(loop);
      setMsg('', 'กลับมาแล้ว! ตีให้ทัน');
    }
  });

  // init defaults from query
  const qDiff = (readParam('diff','')||'').toLowerCase();
  const qTime = Number(readParam('time', S.timeSec));
  if (qDiff==='easy' || qDiff==='normal' || qDiff==='hard'){
    S.diff = qDiff;
    if (selDiff) selDiff.value = qDiff;
  }
  if (Number.isFinite(qTime) && qTime>0){
    S.timeSec = clamp(qTime, 20, 600);
    if (selTime) selTime.value = String(S.timeSec);
  }

  // default view = menu
  setView('sb-view-menu');
  setMode('normal');
}

// ---------------- boot ----------------
async function boot(){
  // ✅ prewarm predictor (will not throw)
  try{ await DL_SYNC.prewarm(); }catch{}

  // wire UI
  wireMenu();

  // optional: auto-start if from hub or if you want:
  // const autostart = (readParam('from','') === 'hub');
  // if (autostart) startRun('normal');
}

boot().catch(fatal);