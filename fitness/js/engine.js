// === /fitness/js/engine.js ===
// Shadow Breaker — Engine (DOM)
// ✅ Fix SessionLogger import/export
// ✅ View switching (menu/play/result)
// ✅ Spawn targets + hit/miss + FX
// ✅ Basic "AI assist" hook (optional) via window.RB_AI (ai-predictor.js)

'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger, downloadEventCsv } from './event-logger.js';
import { SessionLogger, downloadSessionCsv } from './session-logger.js';

const WIN = window;
const DOC = document;

const qs = (id) => DOC.getElementById(id);
const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

function readQuery() {
  const q = new URL(location.href).searchParams;
  return {
    pid: q.get('pid') || '',
    diff: (q.get('diff') || 'normal').toLowerCase(),
    time: clamp(q.get('time') || 70, 30, 180),
    mode: ((q.get('mode') || 'normal')).toLowerCase(), // normal|research
    hub: q.get('hub') || './hub.html'
  };
}

function setActiveView(name){
  const menu = qs('sb-view-menu');
  const play = qs('sb-view-play');
  const res  = qs('sb-view-result');
  if (!menu || !play || !res) return;

  menu.classList.toggle('is-active', name==='menu');
  play.classList.toggle('is-active', name==='play');
  res.classList.toggle('is-active', name==='result');
}

function nowMs(){ return performance.now(); }
function rand(min,max){ return min + Math.random()*(max-min); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

// ---- simple boss table (extend later) ----
const BOSSES = [
  { name:'Bubble Glove', emoji:'🐣', desc:'โฟกัสฟองใหญ่ ๆ แล้วตีให้ทัน' },
  { name:'Neon Wasp', emoji:'🐝', desc:'เร็วขึ้น—อย่าหลง Decoy' },
  { name:'Violet Ogre', emoji:'👾', desc:'Bomb โผล่ถี่—คุมคอมโบ' }
];

// ---- difficulty tuning ----
function diffCfg(diff){
  if (diff==='easy') return {
    spawnEveryMs: 720,
    ttlMs: 1200,
    sizePx: [120, 190],
    bombP: 0.08, decoyP: 0.10, healP: 0.08, shieldP: 0.06
  };
  if (diff==='hard') return {
    spawnEveryMs: 430,
    ttlMs: 780,
    sizePx: [95, 155],
    bombP: 0.18, decoyP: 0.18, healP: 0.05, shieldP: 0.05
  };
  return { // normal
    spawnEveryMs: 560,
    ttlMs: 980,
    sizePx: [110, 175],
    bombP: 0.12, decoyP: 0.14, healP: 0.06, shieldP: 0.06
  };
}

(function boot(){
  // ---- DOM refs ----
  const wrap = qs('sb-wrap');
  const layer = qs('sb-target-layer');

  const btnBackMenu = qs('sb-btn-back-menu');
  const btnPlay = qs('sb-btn-play');
  const btnResearch = qs('sb-btn-research');
  const btnHowto = qs('sb-btn-howto');
  const howto = qs('sb-howto');

  const modeNormal = qs('sb-mode-normal');
  const modeResearch = qs('sb-mode-research');
  const modeDesc = qs('sb-mode-desc');
  const researchBox = qs('sb-research-box');

  const selDiff = qs('sb-diff');
  const selTime = qs('sb-time');

  const partId = qs('sb-part-id');
  const partGroup = qs('sb-part-group');
  const partNote = qs('sb-part-note');

  const linkHub = DOC.querySelector('.sb-link');

  // HUD / Result refs
  const tTime = qs('sb-text-time');
  const tScore = qs('sb-text-score');
  const tCombo = qs('sb-text-combo');
  const tPhase = qs('sb-text-phase');
  const tMiss = qs('sb-text-miss');
  const tShield = qs('sb-text-shield');

  const bossNameTop = qs('sb-current-boss-name');
  const metaEmoji = qs('sb-meta-emoji');
  const metaName = qs('sb-meta-name');
  const metaDesc = qs('sb-meta-desc');
  const bossPhaseLabel = qs('sb-boss-phase-label');
  const bossShieldLabel = qs('sb-boss-shield-label');

  const hpYouTop = qs('sb-hp-you-top');
  const hpBossTop = qs('sb-hp-boss-top');
  const hpYouBottom = qs('sb-hp-you-bottom');
  const hpBossBottom = qs('sb-hp-boss-bottom');

  const feverBar = qs('sb-fever-bar');
  const feverLabel = qs('sb-label-fever');

  const msgMain = qs('sb-msg-main');

  const resTime = qs('sb-res-time');
  const resScore = qs('sb-res-score');
  const resMaxCombo = qs('sb-res-max-combo');
  const resMiss = qs('sb-res-miss');
  const resPhase = qs('sb-res-phase');
  const resBossCleared = qs('sb-res-boss-cleared');
  const resAcc = qs('sb-res-acc');
  const resGrade = qs('sb-res-grade');

  const btnRetry = qs('sb-btn-result-retry');
  const btnResMenu = qs('sb-btn-result-menu');
  const btnDlEvents = qs('sb-btn-download-events');
  const btnDlSession = qs('sb-btn-download-session');

  if (!wrap || !layer) {
    console.error('[SB] missing DOM root');
    return;
  }

  // ---- query init ----
  const q0 = readQuery();
  if (linkHub && q0.hub) linkHub.setAttribute('href', q0.hub);

  // defaults
  if (selDiff) selDiff.value = ['easy','normal','hard'].includes(q0.diff) ? q0.diff : 'normal';
  if (selTime) selTime.value = String(q0.time);

  // mode init
  let mode = (q0.mode==='research') ? 'research' : 'normal';
  function applyModeUI(){
    modeNormal?.classList.toggle('is-active', mode==='normal');
    modeResearch?.classList.toggle('is-active', mode==='research');
    if (modeDesc) {
      modeDesc.textContent = (mode==='research')
        ? 'Research: เก็บข้อมูลตาม Participant/Group (โหมดวิจัยจะล็อกการปรับ AI อัตโนมัติ)'
        : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
    }
    if (researchBox) researchBox.classList.toggle('is-on', mode==='research');
    if (btnResearch) btnResearch.style.display = (mode==='research') ? 'inline-flex' : 'none';
  }
  applyModeUI();

  modeNormal?.addEventListener('click', ()=>{ mode='normal'; applyModeUI(); });
  modeResearch?.addEventListener('click', ()=>{ mode='research'; applyModeUI(); });

  btnHowto?.addEventListener('click', ()=>{
    howto?.classList.toggle('is-on');
  });

  // ---- loggers ----
  const eventLogger = new EventLogger();
  const sessionLogger = new SessionLogger();

  // ---- game state ----
  let running = false;
  let rafId = null;

  let startAt = 0;
  let lastSpawnAt = 0;

  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let miss = 0;
  let hitGood = 0;
  let hitPerfect = 0;
  let hitBad = 0;

  let youHp = 100;
  let bossHp = 100;
  let fever = 0;        // 0..100
  let shield = 0;       // integer
  let phase = 1;
  let bossIndex = 0;
  let bossesCleared = 0;

  let nextId = 1;
  const live = new Map(); // id -> {id,type,spawnMs,expireMs,sizePx}

  // ---- renderer ----
  const renderer = new DomRendererShadow(layer, {
    wrapEl: wrap,
    onTargetHit: (id, pt) => onHit(id, pt)
  });

  function setMsg(text, cls=''){
    if (!msgMain) return;
    msgMain.className = 'sb-msg-main' + (cls ? ' ' + cls : '');
    msgMain.textContent = text || '';
  }

  function setBar(el, pct){
    if (!el) return;
    const p = clamp(pct, 0, 100) / 100;
    el.style.transform = `scaleX(${p})`;
  }

  function updateHUD(tSec){
    if (tTime) tTime.textContent = `${tSec.toFixed(1)} s`;
    if (tScore) tScore.textContent = String(score|0);
    if (tCombo) tCombo.textContent = String(combo|0);
    if (tPhase) tPhase.textContent = String(phase|0);
    if (tMiss) tMiss.textContent = String(miss|0);
    if (tShield) tShield.textContent = String(shield|0);

    const b = BOSSES[bossIndex] || BOSSES[0];
    bossNameTop && (bossNameTop.textContent = `${b.name} ${b.emoji}`);
    metaEmoji && (metaEmoji.textContent = b.emoji);
    metaName && (metaName.textContent = b.name);
    metaDesc && (metaDesc.textContent = b.desc);
    bossPhaseLabel && (bossPhaseLabel.textContent = String(phase));
    bossShieldLabel && (bossShieldLabel.textContent = String(shield));

    setBar(hpYouTop, youHp);
    setBar(hpYouBottom, youHp);
    setBar(hpBossTop, bossHp);
    setBar(hpBossBottom, bossHp);

    setBar(feverBar, fever);
    if (feverLabel) {
      const ready = fever >= 100;
      feverLabel.textContent = ready ? 'READY' : `${Math.round(fever)}%`;
      feverLabel.classList.toggle('on', ready);
    }
  }

  function gradeFromRt(rtMs){
    if (rtMs <= 240) return 'perfect';
    if (rtMs <= 420) return 'good';
    return 'bad';
  }

  function applyDamageByType(type, grade){
    // base values
    let scoreDelta = 0;
    let bossDmg = 0;
    let youDmg = 0;
    let feverGain = 0;

    const feverOn = fever >= 100;
    const feverMul = feverOn ? 1.35 : 1.0;

    if (type === 'normal') {
      if (grade === 'perfect') { scoreDelta = 18; bossDmg = 10; feverGain = 10; }
      else if (grade === 'good') { scoreDelta = 12; bossDmg = 7; feverGain = 7; }
      else { scoreDelta = 6; bossDmg = 4; feverGain = 4; }
    } else if (type === 'decoy') {
      // decoy: ไม่ดาเมจ + ลดคอมโบ
      scoreDelta = -8;
      youDmg = 6;
      feverGain = 0;
    } else if (type === 'bomb') {
      // bomb: ถ้ามี shield กันได้
      scoreDelta = -14;
      youDmg = 14;
      feverGain = 0;
    } else if (type === 'heal') {
      scoreDelta = 4;
      youDmg = -18;
      feverGain = 4;
    } else if (type === 'shield') {
      scoreDelta = 4;
      youDmg = 0;
      feverGain = 4;
    } else if (type === 'bossface') {
      // bossface = โบนัสหนัก
      scoreDelta = 22;
      bossDmg = 14;
      feverGain = 12;
    }

    scoreDelta = Math.round(scoreDelta * feverMul);
    bossDmg   = Math.round(bossDmg * feverMul);

    return { scoreDelta, bossDmg, youDmg, feverGain, feverOn };
  }

  function onHit(id, pt){
    if (!running) return;
    const t = live.get(id);
    if (!t) return;

    const tNow = nowMs();
    const rtMs = Math.max(0, tNow - t.spawnMs);
    const grade = (t.type === 'heal' || t.type === 'shield') ? t.type : gradeFromRt(rtMs);

    // FX first (สำคัญ!)
    renderer.playHitFx(id, { ...pt, grade, scoreDelta: 0 });

    // remove
    renderer.removeTarget(id, 'hit');
    live.delete(id);

    // apply effect
    const { scoreDelta, bossDmg, youDmg, feverGain } = applyDamageByType(t.type, grade);

    // combo rules
    const isGoodHit = (t.type==='normal' || t.type==='bossface' || t.type==='heal' || t.type==='shield');
    if (isGoodHit && (grade==='perfect' || grade==='good' || grade==='heal' || grade==='shield')) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
    } else {
      combo = Math.max(0, Math.floor(combo * 0.55));
    }

    // shield/bomb logic
    if (t.type === 'bomb') {
      if (shield > 0) {
        shield -= 1; // block!
        setMsg('🛡️ BLOCK!', 'good');
      } else {
        youHp = clamp(youHp - Math.abs(youDmg), 0, 100);
        setMsg('💣 โดนระเบิด!', 'bad');
      }
    } else if (t.type === 'decoy') {
      youHp = clamp(youHp - Math.abs(youDmg), 0, 100);
      setMsg('👀 หลอกนะ!', 'miss');
    } else if (t.type === 'heal') {
      youHp = clamp(youHp - youDmg, 0, 100); // youDmg is negative
      setMsg('+HP', 'good');
    } else if (t.type === 'shield') {
      shield = clamp(shield + 1, 0, 9);
      setMsg('+SHIELD', 'good');
    } else {
      bossHp = clamp(bossHp - Math.abs(bossDmg), 0, 100);
      if (grade === 'perfect') setMsg('PERFECT!', 'perfect');
      else if (grade === 'good') setMsg('GOOD!', 'good');
      else setMsg('OK', 'miss');
    }

    // fever
    fever = clamp(fever + feverGain, 0, 100);

    // apply score
    score = Math.max(0, (score + scoreDelta)|0);

    // refine FX score text with actual delta
    renderer.playHitFx(id, { ...pt, grade, scoreDelta });

    // stats counts
    if (grade === 'perfect') hitPerfect++;
    else if (grade === 'good') hitGood++;
    else if (grade === 'bad') hitBad++;

    // log event
    eventLogger.add({
      ts_ms: Date.now(),
      mode,
      diff: selDiff?.value || 'normal',
      boss_index: bossIndex,
      boss_phase: phase,
      target_id: id,
      target_type: t.type,
      event_type: 'hit',
      rt_ms: Math.round(rtMs),
      grade,
      score_delta: scoreDelta,
      combo_after: combo,
      score_after: score,
      player_hp: youHp,
      boss_hp: bossHp
    });

    // phase/boss progress
    if (bossHp <= 0) {
      bossesCleared++;
      bossIndex = (bossIndex + 1) % BOSSES.length;
      phase++;

      bossHp = 100;
      fever = clamp(fever + 25, 0, 100);
      shield = clamp(shield + 1, 0, 9);

      setMsg('🔥 NEXT BOSS!', 'perfect');
    }

    if (youHp <= 0) finish('you_dead');
  }

  function onMiss(id, why='timeout'){
    if (!running) return;
    const t = live.get(id);
    if (!t) return;

    // miss rules
    miss++;
    combo = Math.max(0, Math.floor(combo * 0.5));
    youHp = clamp(youHp - 6, 0, 100);

    // FX miss at last pos
    renderer.playHitFx(id, { grade:'bad', scoreDelta: 0 });

    renderer.removeTarget(id, why);
    live.delete(id);

    setMsg('MISS!', 'miss');

    eventLogger.add({
      ts_ms: Date.now(),
      mode,
      diff: selDiff?.value || 'normal',
      boss_index: bossIndex,
      boss_phase: phase,
      target_id: id,
      target_type: t.type,
      event_type: 'miss',
      rt_ms: Math.round(nowMs() - t.spawnMs),
      grade: 'miss',
      score_delta: 0,
      combo_after: combo,
      score_after: score,
      player_hp: youHp,
      boss_hp: bossHp
    });

    if (youHp <= 0) finish('you_dead');
  }

  function spawnOne(){
    const diff = selDiff?.value || 'normal';
    const cfg = diffCfg(diff);

    const b = BOSSES[bossIndex] || BOSSES[0];

    // target type distribution
    const r = Math.random();
    let type = 'normal';
    if (r < cfg.bombP) type = 'bomb';
    else if (r < cfg.bombP + cfg.decoyP) type = 'decoy';
    else if (r < cfg.bombP + cfg.decoyP + cfg.healP) type = 'heal';
    else if (r < cfg.bombP + cfg.decoyP + cfg.healP + cfg.shieldP) type = 'shield';

    // bossface chance when boss low (spike fun)
    if (bossHp <= 28 && Math.random() < 0.18) type = 'bossface';

    const sizePx = rand(cfg.sizePx[0], cfg.sizePx[1]);

    const id = nextId++;
    const t0 = nowMs();
    const ttl = cfg.ttlMs * (type==='bossface' ? 0.90 : 1.0);

    const item = {
      id,
      type,
      spawnMs: t0,
      expireMs: t0 + ttl,
      sizePx: Math.round(sizePx),
      bossEmoji: b.emoji
    };

    live.set(id, item);
    renderer.spawnTarget(item);
  }

  function step(){
    if (!running) return;

    const t = nowMs();
    const tSec = (t - startAt) / 1000;
    const limitSec = clamp(selTime?.value || 70, 30, 180);

    // time up
    if (tSec >= limitSec) {
      finish('time_up');
      return;
    }

    // spawn pacing
    const diff = selDiff?.value || 'normal';
    const cfg = diffCfg(diff);

    // optional AI assist: adjust spawn speed in NORMAL when ?ai=1 (via RB_AI)
    let spawnEvery = cfg.spawnEveryMs;
    try {
      if (WIN.RB_AI && WIN.RB_AI.isAssistEnabled && WIN.RB_AI.isAssistEnabled()) {
        const snap = snapshot();
        const pred = WIN.RB_AI.predict(snap);
        if (pred && typeof pred.fatigueRisk === 'number') {
          // fatigue high -> slower; skill high -> faster
          spawnEvery = cfg.spawnEveryMs * clamp(1 + pred.fatigueRisk*0.55 - pred.skillScore*0.35, 0.78, 1.45);
        }
      }
    } catch {}

    if (t - lastSpawnAt >= spawnEvery) {
      lastSpawnAt = t;
      spawnOne();
      // sometimes double-spawn for spice (hard+phase)
      if ((diff==='hard' && phase >= 3) && Math.random() < 0.22) spawnOne();
    }

    // expire targets
    for (const [id, it] of live.entries()) {
      if (t >= it.expireMs) onMiss(id, 'timeout');
    }

    updateHUD(tSec);
    rafId = requestAnimationFrame(step);
  }

  function resetState(){
    score=0; combo=0; maxCombo=0; miss=0;
    hitGood=0; hitPerfect=0; hitBad=0;
    youHp=100; bossHp=100;
    fever=0; shield=0;
    phase=1; bossIndex=0; bossesCleared=0;
    nextId=1;
    live.clear();
    eventLogger.clear();
    sessionLogger.clear();
    renderer.destroy();
    setMsg('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!');
  }

  function snapshot(){
    const totalHits = hitPerfect + hitGood + hitBad;
    const judged = totalHits + miss;
    const accPct = judged ? (totalHits / judged) * 100 : 0;
    return {
      accPct,
      hitMiss: miss,
      hitPerfect,
      hitGreat: hitGood, // map
      hitGood: hitBad,   // map
      hp: youHp,
      bossHp,
      combo,
      phase
    };
  }

  function finish(reason='end'){
    if (!running) return;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    // clean remaining
    for (const [id] of live.entries()) {
      renderer.removeTarget(id, 'end');
    }
    live.clear();

    // compute result
    const endMs = nowMs();
    const durSec = (endMs - startAt) / 1000;

    const totalHits = hitPerfect + hitGood + hitBad;
    const judged = totalHits + miss;
    const accPct = judged ? (totalHits / judged) * 100 : 0;

    // grade
    let grade = 'C';
    if (accPct >= 92 && miss <= 3) grade = 'SSS';
    else if (accPct >= 86) grade = 'S';
    else if (accPct >= 78) grade = 'A';
    else if (accPct >= 68) grade = 'B';

    // write result UI
    resTime && (resTime.textContent = `${durSec.toFixed(1)} s`);
    resScore && (resScore.textContent = String(score|0));
    resMaxCombo && (resMaxCombo.textContent = String(maxCombo|0));
    resMiss && (resMiss.textContent = String(miss|0));
    resPhase && (resPhase.textContent = String(phase|0));
    resBossCleared && (resBossCleared.textContent = String(bossesCleared|0));
    resAcc && (resAcc.textContent = `${accPct.toFixed(1)} %`);
    resGrade && (resGrade.textContent = grade);

    // session log (1 row)
    const q = readQuery();
    sessionLogger.add({
      ts_ms: Date.now(),
      pid: (mode==='research') ? (partId?.value || q.pid || '') : (q.pid || ''),
      group: (mode==='research') ? (partGroup?.value || '') : '',
      note: (mode==='research') ? (partNote?.value || '') : '',
      mode,
      diff: selDiff?.value || 'normal',
      time_limit_s: clamp(selTime?.value || 70, 30, 180),
      dur_s: Number(durSec.toFixed(2)),
      score,
      max_combo: maxCombo,
      miss,
      hits_total: totalHits,
      hit_perfect: hitPerfect,
      hit_good: hitGood,
      hit_bad: hitBad,
      acc_pct: Number(accPct.toFixed(2)),
      grade,
      bosses_cleared: bossesCleared,
      end_reason: reason
    });

    setActiveView('result');
  }

  function start(whichMode){
    mode = (whichMode==='research') ? 'research' : 'normal';
    applyModeUI();

    // if research: require participant id? (soft)
    if (mode==='research') {
      const pidv = (partId?.value || '').trim();
      if (!pidv) {
        alert('โหมด Research: กรุณากรอก Participant ID ก่อนเริ่ม');
        return;
      }
    }

    resetState();
    startAt = nowMs();
    lastSpawnAt = startAt;
    running = true;

    setActiveView('play');
    updateHUD(0);

    rafId = requestAnimationFrame(step);
  }

  // ---- wire buttons ----
  btnPlay?.addEventListener('click', ()=> start('normal'));
  btnResearch?.addEventListener('click', ()=> start('research'));
  btnBackMenu?.addEventListener('click', ()=>{
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    setActiveView('menu');
  });

  btnRetry?.addEventListener('click', ()=>{
    start(mode);
  });
  btnResMenu?.addEventListener('click', ()=>{
    setActiveView('menu');
  });

  btnDlEvents?.addEventListener('click', ()=>{
    downloadEventCsv(eventLogger, 'shadow-breaker-events.csv');
  });
  btnDlSession?.addEventListener('click', ()=>{
    downloadSessionCsv(sessionLogger, 'shadow-breaker-session.csv');
  });

  // apply initial view
  setActiveView('menu');
  updateHUD(0);

  // auto mode from query
  if (q0.mode === 'research') {
    mode = 'research';
    applyModeUI();
  }
})();