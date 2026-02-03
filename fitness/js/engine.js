// === /fitness/js/engine.js ===
// Shadow Breaker Engine — PRODUCTION (Boss Targets)
// PC/Mobile (DOM) | Normal + Research mode
// Modules: dom-renderer-shadow + event/session loggers + AI predictor
'use strict';

import { DomRendererShadow } from './dom-renderer-shadow.js';
import { EventLogger, downloadEventsCsv } from './event-logger.js';
import { SessionLogger, downloadSessionCsv } from './session-logger.js';
import { AIPredictor } from './ai-predictor.js';

function fatalOverlay(msg, err){
  try{
    const el = document.createElement('div');
    el.style.position='fixed';
    el.style.inset='0';
    el.style.zIndex='99999';
    el.style.background='rgba(2,6,23,.92)';
    el.style.color='#e5e7eb';
    el.style.fontFamily='system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    el.style.padding='18px';
    el.style.display='flex';
    el.style.alignItems='flex-start';
    el.style.justifyContent='center';
    el.style.overflow='auto';
    el.innerHTML = `
      <div style="max-width:860px;width:100%;border:1px solid rgba(148,163,184,.25);border-radius:18px;padding:14px;background:rgba(15,23,42,.75)">
        <div style="font-weight:900;font-size:1.1rem;margin-bottom:6px">Shadow Breaker: โหลดไม่สำเร็จ</div>
        <div style="color:rgba(226,232,240,.9);margin-bottom:10px">${msg || 'ไม่ทราบสาเหตุ'}</div>
        <pre style="white-space:pre-wrap;color:#cbd5e1;background:rgba(2,6,23,.55);padding:10px;border-radius:12px;border:1px solid rgba(148,163,184,.18)">${(err && (err.stack||err.message)) ? (err.stack||err.message) : ''}</pre>
        <div style="margin-top:10px;font-size:.9rem;color:#94a3b8">ลองกด Refresh หรือเปิด DevTools ดู error ที่ Console</div>
      </div>`;
    document.body.appendChild(el);
  }catch(_){}
}

// ---------- tiny helpers ----------
const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
const clamp01 = (v)=>clamp(v,0,1);
const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
const now = ()=>performance.now();

function setView(menu, play, result, which){
  menu.classList.toggle('is-active', which==='menu');
  play.classList.toggle('is-active', which==='play');
  result.classList.toggle('is-active', which==='result');
}

function fmt1(v){ return (Number(v)||0).toFixed(1); }

function computeGrade(accPct){
  const a = Number(accPct)||0;
  if (a >= 92) return 'S';
  if (a >= 85) return 'A';
  if (a >= 75) return 'B';
  if (a >= 60) return 'C';
  return 'D';
}

// ---------- difficulty presets ----------
const DIFF = {
  easy:   { spawnEveryMs: 760, ttlMs: 1550, baseSize: 150, bombRate: 0.10, decoyRate: 0.10, healRate: 0.14, shieldRate: 0.12 },
  normal: { spawnEveryMs: 650, ttlMs: 1320, baseSize: 128, bombRate: 0.14, decoyRate: 0.14, healRate: 0.12, shieldRate: 0.10 },
  hard:   { spawnEveryMs: 560, ttlMs: 1120, baseSize: 112, bombRate: 0.18, decoyRate: 0.18, healRate: 0.10, shieldRate: 0.08 },
};

const BOSSES = [
  { name:'Bubble Glove', emoji:'🐣', desc:'โฟกัสที่ฟองใหญ่ ๆ แล้วตีให้ทัน', hp: 1200, phases: 3 },
  { name:'Shadow Wisp',  emoji:'👻', desc:'เป้าหลอกมาเป็นชุด—อย่าเผลอตีผิด', hp: 1400, phases: 3 },
  { name:'Iron Fang',    emoji:'🐺', desc:'บอมบ์แรงขึ้น—เก็บโล่ไว้กันจังหวะ', hp: 1600, phases: 3 },
];

function init(){
  const wrap = document.getElementById('sb-wrap');

  const viewMenu = document.getElementById('sb-view-menu');
  const viewPlay = document.getElementById('sb-view-play');
  const viewResult = document.getElementById('sb-view-result');

  const btnModeNormal = document.getElementById('sb-mode-normal');
  const btnModeResearch = document.getElementById('sb-mode-research');
  const modeDesc = document.getElementById('sb-mode-desc');
  const boxResearch = document.getElementById('sb-research-box');

  const selDiff = document.getElementById('sb-diff');
  const selTime = document.getElementById('sb-time');

  const inpPid = document.getElementById('sb-part-id');
  const inpGroup = document.getElementById('sb-part-group');
  const inpNote = document.getElementById('sb-part-note');

  const btnPlay = document.getElementById('sb-btn-play');
  const btnResearch = document.getElementById('sb-btn-research');
  const btnHowto = document.getElementById('sb-btn-howto');
  const howto = document.getElementById('sb-howto');

  const btnBackMenu = document.getElementById('sb-btn-back-menu');
  const chkStop = document.getElementById('sb-btn-pause');

  const layer = document.getElementById('sb-target-layer');
  const msgMain = document.getElementById('sb-msg-main');

  const txtTime = document.getElementById('sb-text-time');
  const txtScore = document.getElementById('sb-text-score');
  const txtCombo = document.getElementById('sb-text-combo');
  const txtPhase = document.getElementById('sb-text-phase');
  const txtMiss = document.getElementById('sb-text-miss');
  const txtShield = document.getElementById('sb-text-shield');

  const hpYouTop = document.getElementById('sb-hp-you-top');
  const hpBossTop = document.getElementById('sb-hp-boss-top');
  const hpYouBottom = document.getElementById('sb-hp-you-bottom');
  const hpBossBottom = document.getElementById('sb-hp-boss-bottom');

  const feverBar = document.getElementById('sb-fever-bar');
  const feverLabel = document.getElementById('sb-label-fever');

  const bossNameHud = document.getElementById('sb-current-boss-name');
  const metaEmoji = document.getElementById('sb-meta-emoji');
  const metaName = document.getElementById('sb-meta-name');
  const metaDesc = document.getElementById('sb-meta-desc');
  const metaPhase = document.getElementById('sb-boss-phase-label');
  const metaShield = document.getElementById('sb-boss-shield-label');

  const resTime = document.getElementById('sb-res-time');
  const resScore = document.getElementById('sb-res-score');
  const resMaxCombo = document.getElementById('sb-res-max-combo');
  const resMiss = document.getElementById('sb-res-miss');
  const resPhase = document.getElementById('sb-res-phase');
  const resBossCleared = document.getElementById('sb-res-boss-cleared');
  const resAcc = document.getElementById('sb-res-acc');
  const resGrade = document.getElementById('sb-res-grade');

  const btnRetry = document.getElementById('sb-btn-result-retry');
  const btnMenu = document.getElementById('sb-btn-result-menu');
  const btnDlEvents = document.getElementById('sb-btn-download-events');
  const btnDlSession = document.getElementById('sb-btn-download-session');

  if (!wrap || !viewMenu || !viewPlay || !viewResult || !layer) {
    throw new Error('Missing required DOM nodes');
  }

  // --- initial query passthrough ---
  const qPid = qs('pid','') || '';
  const qDiff = (qs('diff','normal')||'normal').toLowerCase();
  const qTime = Number(qs('time','70')||70);

  if (qPid) inpPid.value = qPid;
  if (qDiff && DIFF[qDiff]) selDiff.value = qDiff;
  if (Number.isFinite(qTime)) selTime.value = String(clamp(qTime, 30, 180));

  // --- state ---
  let mode = 'normal'; // 'normal' | 'research'
  let running = false;
  let rafId = null;

  let tStart = 0;
  let tLastSpawn = 0;

  let timeLimitSec = Number(selTime.value)||70;
  let diffKey = selDiff.value || 'normal';
  let cfg = DIFF[diffKey] || DIFF.normal;

  // gameplay stats
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let miss = 0;

  // health/fever
  let youHp = 100;
  let youHpMax = 100;
  let bossHp = 1;
  let bossHpMax = 1;
  let fever = 0;       // 0..1
  let feverOn = false; // active buff
  let feverUntil = 0;

  // boss progression
  let bossIndex = 0;
  let phase = 1;
  let bossesCleared = 0;
  let bossFaceShown = false;

  // defense
  let shield = 0;

  // accuracy
  let judged = 0;
  let hitGood = 0;
  let hitPerfect = 0;

  // logs
  const evLogger = new EventLogger();
  const sesLogger = new SessionLogger();

  // AI
  const ai = new AIPredictor();

  // renderer
  const renderer = new DomRendererShadow(layer, {
    wrapEl: viewPlay,
    onTargetHit: handleTargetHit,
  });
  renderer.bind();

  function setMode(next){
    mode = next === 'research' ? 'research' : 'normal';
    const isR = mode === 'research';
    btnModeNormal.classList.toggle('is-active', !isR);
    btnModeResearch.classList.toggle('is-active', isR);
    boxResearch.classList.toggle('is-on', isR);

    modeDesc.textContent = isR
      ? 'Research: ต้องกรอก Participant ID / Group เพื่อเก็บข้อมูล'
      : 'Normal: เล่นสนุก/สอนทั่วไป ไม่ต้องกรอกข้อมูลผู้เข้าร่วม';
  }

  function uiSetMsg(text, cls=''){
    msgMain.className = 'sb-msg-main' + (cls ? ' ' + cls : '');
    msgMain.textContent = text || '';
  }

  function updateBars(){
    const youP = clamp01(youHp / youHpMax);
    const bossP = clamp01(bossHp / bossHpMax);

    hpYouTop.style.transform = `scaleX(${youP})`;
    hpBossTop.style.transform = `scaleX(${bossP})`;
    hpYouBottom.style.transform = `scaleX(${youP})`;
    hpBossBottom.style.transform = `scaleX(${bossP})`;

    feverBar.style.transform = `scaleX(${clamp01(fever)})`;
    feverLabel.classList.toggle('on', feverOn);
    feverLabel.textContent = feverOn ? 'ON FIRE' : (fever >= 1 ? 'READY' : 'BUILD');
  }

  function updateHud(tSec){
    txtTime.textContent = `${fmt1(tSec)} s`;
    txtScore.textContent = String(score|0);
    txtCombo.textContent = String(combo|0);
    txtPhase.textContent = String(phase|0);
    txtMiss.textContent = String(miss|0);
    txtShield.textContent = String(shield|0);
  }

  function setBossUI(){
    const b = BOSSES[bossIndex] || BOSSES[0];
    bossNameHud.textContent = `${b.name} ${b.emoji}`;
    metaEmoji.textContent = b.emoji;
    metaName.textContent = b.name;
    metaDesc.textContent = b.desc;
    metaPhase.textContent = String(phase);
    metaShield.textContent = String(shield);
  }

  function startGame(startAsResearch){
    setMode(startAsResearch ? 'research' : mode);

    diffKey = selDiff.value || 'normal';
    cfg = DIFF[diffKey] || DIFF.normal;
    timeLimitSec = Number(selTime.value)||70;

    if (mode === 'research') {
      const pid = (inpPid.value||'').trim();
      const grp = (inpGroup.value||'').trim();
      if (!pid || !grp) {
        alert('Research mode ต้องกรอก Participant ID และ Group');
        return;
      }
    }

    // reset
    score = 0; combo = 0; maxCombo = 0; miss = 0;
    judged = 0; hitGood = 0; hitPerfect = 0;
    youHp = 100; youHpMax = 100;
    shield = 0;
    fever = 0; feverOn = false; feverUntil = 0;

    bossIndex = 0;
    bossesCleared = 0;
    phase = 1;
    bossFaceShown = false;

    const b = BOSSES[bossIndex];
    bossHpMax = b.hp;
    bossHp = bossHpMax;

    evLogger.clear();
    sesLogger.clear();

    renderer.destroy();
    // re-bind (destroy removes listener)
    renderer.bind();

    setBossUI();
    updateBars();

    tStart = now();
    tLastSpawn = tStart;
    running = true;
    chkStop.checked = false;

    setView(viewMenu, viewPlay, viewResult, 'play');
    uiSetMsg('แตะ/ชกเป้าให้ทัน ก่อนที่เป้าจะหายไป!', '');

    loop();
  }

  function endGame(reason='timeup'){
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;

    // cleanup targets
    renderer.destroy();

    const dur = clamp((now() - tStart) / 1000, 0, timeLimitSec);
    const acc = judged ? ((hitGood + hitPerfect) / judged) * 100 : 0;
    const grade = computeGrade(acc);

    // session row
    const pid = (inpPid.value||'').trim();
    const grp = (inpGroup.value||'').trim();
    const note = (inpNote.value||'').trim();

    sesLogger.add({
      ts: Date.now(),
      mode,
      reason,
      pid,
      group: grp,
      note,
      diff: diffKey,
      timeLimitSec,
      durSec: dur.toFixed(2),
      score,
      maxCombo,
      miss,
      judged,
      hitGood,
      hitPerfect,
      accPct: acc.toFixed(2),
      grade,
      phase,
      bossesCleared
    });

    // fill result
    resTime.textContent = `${fmt1(dur)} s`;
    resScore.textContent = String(score|0);
    resMaxCombo.textContent = String(maxCombo|0);
    resMiss.textContent = String(miss|0);
    resPhase.textContent = String(phase|0);
    resBossCleared.textContent = String(bossesCleared|0);
    resAcc.textContent = `${acc.toFixed(1)} %`;
    resGrade.textContent = grade;

    setView(viewMenu, viewPlay, viewResult, 'result');
  }

  function nextBossOrPhase(){
    const b = BOSSES[bossIndex];
    if (phase < b.phases) {
      phase++;
      bossFaceShown = false;
      bossHpMax = Math.round(b.hp * (1 + (phase-1)*0.22));
      bossHp = bossHpMax;
      uiSetMsg(`PHASE ${phase}!`, 'good');
      setBossUI();
      return;
    }
    // next boss
    bossesCleared++;
    bossIndex++;
    if (bossIndex >= BOSSES.length) {
      endGame('cleared_all');
      return;
    }
    phase = 1;
    bossFaceShown = false;
    bossHpMax = BOSSES[bossIndex].hp;
    bossHp = bossHpMax;
    uiSetMsg(`NEW BOSS: ${BOSSES[bossIndex].name}!`, 'good');
    setBossUI();
  }

  function scheduleSpawn(t){
    const every = cfg.spawnEveryMs;
    if (t - tLastSpawn < every) return;

    tLastSpawn = t;

    // choose type
    const r = Math.random();
    let type = 'normal';
    if (r < cfg.bombRate) type = 'bomb';
    else if (r < cfg.bombRate + cfg.decoyRate) type = 'decoy';
    else if (r < cfg.bombRate + cfg.decoyRate + cfg.healRate) type = 'heal';
    else if (r < cfg.bombRate + cfg.decoyRate + cfg.healRate + cfg.shieldRate) type = 'shield';

    // boss face once when boss almost dead
    if (!bossFaceShown && bossHp / bossHpMax < 0.12) {
      bossFaceShown = true;
      type = 'bossface';
    }

    const id = evLogger.nextId();
    const sizePx = cfg.baseSize * (type === 'bossface' ? 1.25 : 1.0);

    renderer.spawnTarget({
      id,
      type,
      bossEmoji: BOSSES[bossIndex].emoji,
      sizePx
    });

    // timeout miss (if not hit)
    const ttl = cfg.ttlMs * (type === 'bossface' ? 1.18 : 1.0);
    setTimeout(()=>{
      // if still exists -> miss
      if (renderer.targets && renderer.targets.has(id)) {
        renderer.removeTarget(id);
        judged++;
        miss++;
        combo = 0;

        // punish a bit
        if (type === 'bomb') youHp = clamp(youHp - 12, 0, youHpMax);
        else youHp = clamp(youHp - 4, 0, youHpMax);

        uiSetMsg('MISS!', 'miss');

        evLogger.add({
          ts: Date.now(),
          tMs: Math.round(t - tStart),
          id,
          type,
          action: 'timeout_miss',
          scoreDelta: 0,
          combo,
          youHp,
          bossHp,
          phase,
          bossIndex
        });

        updateBars();
        if (youHp <= 0) endGame('dead');
      }
    }, Math.round(ttl));
  }

  function resolveHit(type){
    judged++;

    // grade
    let grade = 'good';
    let scoreDelta = 10;

    if (type === 'decoy') {
      grade = 'bad';
      scoreDelta = 0;
      combo = 0;
      miss++;
      youHp = clamp(youHp - 7, 0, youHpMax);
      uiSetMsg('DECOY!', 'bad');
    } else if (type === 'bomb') {
      grade = 'bomb';
      scoreDelta = -8;
      if (shield > 0) {
        shield--;
        scoreDelta = 0;
        uiSetMsg('SHIELD BLOCK!', 'good');
      } else {
        youHp = clamp(youHp - 16, 0, youHpMax);
        combo = 0;
        miss++;
        uiSetMsg('BOMB!', 'bad');
      }
    } else if (type === 'heal') {
      grade = 'heal';
      scoreDelta = 6;
      youHp = clamp(youHp + 10, 0, youHpMax);
      combo++;
      hitGood++;
      uiSetMsg('HEAL +HP', 'good');
    } else if (type === 'shield') {
      grade = 'shield';
      scoreDelta = 6;
      shield = clamp(shield + 1, 0, 9);
      combo++;
      hitGood++;
      uiSetMsg('SHIELD +1', 'good');
    } else {
      // normal / bossface
      // perfect chance when fever on
      if (feverOn) {
        grade = 'perfect';
        scoreDelta = 18;
        hitPerfect++;
      } else {
        hitGood++;
      }

      combo++;
      // fever build
      fever = clamp01(fever + (type === 'bossface' ? 0.22 : 0.10));

      // boss damage
      let dmg = type === 'bossface' ? 150 : 60;
      if (feverOn) dmg = Math.round(dmg * 1.35);
      bossHp = clamp(bossHp - dmg, 0, bossHpMax);

      // trigger fever
      if (!feverOn && fever >= 1) {
        feverOn = true;
        feverUntil = now() + 4200;
        fever = 1;
        uiSetMsg('FEVER!', 'perfect');
      }
    }

    // apply score
    score += scoreDelta;
    if (combo > maxCombo) maxCombo = combo;

    return { grade, scoreDelta };
  }

  function handleTargetHit(id, pos){
    if (!running) return;
    const t = now();
    const el = renderer.targets.get(id);
    if (!el) return;

    // find type from class
    let type = 'normal';
    try{
      const cn = el.className || '';
      if (cn.includes('--decoy')) type = 'decoy';
      else if (cn.includes('--bomb')) type = 'bomb';
      else if (cn.includes('--heal')) type = 'heal';
      else if (cn.includes('--shield')) type = 'shield';
      else if (cn.includes('--bossface')) type = 'bossface';
    }catch(_){}

    renderer.removeTarget(id);

    const { grade, scoreDelta } = resolveHit(type);

    // FX
    renderer.playHitFx(pos.clientX, pos.clientY, { grade, scoreDelta });

    // event log
    evLogger.add({
      ts: Date.now(),
      tMs: Math.round(t - tStart),
      id,
      type,
      action: 'hit',
      grade,
      scoreDelta,
      combo,
      youHp,
      bossHp,
      phase,
      bossIndex
    });

    // fever time out
    if (feverOn && now() >= feverUntil) {
      feverOn = false;
      fever = 0;
      uiSetMsg('FEVER END', '');
    }

    // boss down?
    if (bossHp <= 0) nextBossOrPhase();

    updateBars();
    updateHud((t - tStart)/1000);

    if (youHp <= 0) endGame('dead');
  }

  function loop(){
    if (!running) return;

    const t = now();
    const tSec = (t - tStart) / 1000;

    if (chkStop.checked) {
      endGame('stopped');
      return;
    }

    // fever expiry
    if (feverOn && t >= feverUntil) {
      feverOn = false;
      fever = 0;
      uiSetMsg('FEVER END', '');
    }

    scheduleSpawn(t);

    // AI (play-only suggestion) — kept lightweight
    // NOTE: In research mode, do NOT auto-adjust difficulty.
    if (mode !== 'research') {
      ai.tick({
        tSec,
        score,
        combo,
        miss,
        youHp,
        bossHp,
        phase,
        diffKey
      });
    }

    updateHud(tSec);
    updateBars();

    if (tSec >= timeLimitSec) {
      endGame('timeup');
      return;
    }

    rafId = requestAnimationFrame(loop);
  }

  // ---- bindings ----
  btnModeNormal.addEventListener('click', ()=>setMode('normal'));
  btnModeResearch.addEventListener('click', ()=>setMode('research'));

  btnHowto.addEventListener('click', ()=>{
    howto.classList.toggle('is-on');
  });

  btnPlay.addEventListener('click', ()=>startGame(false));
  btnResearch.addEventListener('click', ()=>startGame(true));

  btnBackMenu.addEventListener('click', ()=>{
    if (running) endGame('back_menu');
    setView(viewMenu, viewPlay, viewResult, 'menu');
  });

  btnRetry.addEventListener('click', ()=>startGame(mode==='research'));
  btnMenu.addEventListener('click', ()=>setView(viewMenu, viewPlay, viewResult, 'menu'));

  btnDlEvents.addEventListener('click', ()=>downloadEventsCsv(evLogger));
  btnDlSession.addEventListener('click', ()=>downloadSessionCsv(sesLogger));

  // initial view
  setMode('normal');
  setView(viewMenu, viewPlay, viewResult, 'menu');
  setBossUI();
  updateHud(0);
  updateBars();
}

// boot
try{ init(); }catch(err){ fatalOverlay('เกิดข้อผิดพลาดระหว่างเริ่มเกม', err); }