// === /herohealth/hydration-vr/hydration-challenge.js ===
// Hydration Challenge Pack v1
// PATCH v20260427-HYDRATION-CHALLENGE-PACK-V1
//
// เป้าหมาย:
// ✅ เพิ่มความท้าทายโดยไม่แตะ hydration.safe.js
// ✅ เปิดอัตโนมัติเมื่อ diff=challenge / diff=hard / diff=hero หรือ challenge=1/2/hero
// ✅ Combo Gate
// ✅ Storm Chain visual pressure
// ✅ Shield Scarcity
// ✅ Threat/Boss/Final Rush pressure
// ✅ บันทึก challenge metrics ลง HHA_LAST_SUMMARY
//
// ใช้กับ URL เช่น:
// &diff=challenge
// &diff=hero
// &challenge=1
// &challenge=hero

'use strict';

const PATCH = 'v20260427-HYDRATION-CHALLENGE-PACK-V1';

let installed = false;

export function installHydrationChallenge(){
  if (installed || window.__HHA_HYDRATION_CHALLENGE_INSTALLED__) return;
  installed = true;
  window.__HHA_HYDRATION_CHALLENGE_INSTALLED__ = true;

  const cfg = getChallengeConfig();

  if (!cfg.enabled) {
    console.log('[hydration-challenge] inactive', PATCH);
    return;
  }

  injectStyles();
  createHud(cfg);
  installBubbleObserver(cfg);
  installStatsLoop(cfg);
  installEndSummaryHook(cfg);

  document.body.classList.add('hha-challenge-on');
  document.body.classList.add('hha-challenge-' + cfg.level);

  console.log('[hydration-challenge] installed', PATCH, cfg);
}

/* ------------------------------------------------------------
 * Config
 * ------------------------------------------------------------ */

function getChallengeConfig(){
  const q = new URLSearchParams(location.search);
  const diff = String(q.get('diff') || 'normal').toLowerCase();
  const challenge = String(q.get('challenge') || '').toLowerCase();

  let level = 'off';

  if (challenge === '1' || challenge === 'true' || challenge === 'challenge') level = 'challenge';
  if (challenge === '2' || challenge === 'hero' || challenge === 'hard') level = 'hero';

  if (['challenge','hard'].includes(diff)) level = 'challenge';
  if (['hero','expert','insane'].includes(diff)) level = 'hero';

  if (level === 'off') {
    return { enabled:false, level:'off' };
  }

  const base = {
    enabled:true,
    level,
    comboGates: level === 'hero' ? [8, 12, 16] : [5, 8, 12],
    rushSec: level === 'hero' ? 25 : 18,
    shieldKeepRate: level === 'hero' ? 0.55 : 0.72,
    goodScale: level === 'hero' ? 0.88 : 0.94,
    threatScale: level === 'hero' ? 1.24 : 1.14,
    badScale: level === 'hero' ? 1.16 : 1.08,
    floatSpeed: level === 'hero' ? 0.72 : 0.84,
    finalGoodLifeMs: level === 'hero' ? 1650 : 2100,
    seed: Number(new URLSearchParams(location.search).get('seed') || Date.now())
  };

  return base;
}

/* ------------------------------------------------------------
 * State
 * ------------------------------------------------------------ */

const S = {
  startedAt: Date.now(),
  level: 'off',
  maxCombo: 0,
  maxWater: 0,
  minWater: 100,
  maxRisk: 0,
  currentCombo: 0,
  currentWater: 0,
  currentMiss: 0,
  currentShield: 0,
  currentBlock: 0,
  currentTimeLeft: 0,
  totalTime: 0,
  gateTarget: 0,
  gatePassed: false,
  rushActive: false,
  rushStarted: false,
  stormChain: 0,
  lastStorm: false,
  shieldsRemoved: 0,
  threatTouched: 0,
  bubblesSeen: 0
};

/* ------------------------------------------------------------
 * CSS
 * ------------------------------------------------------------ */

function injectStyles(){
  if (document.getElementById('hhaHydrationChallengeStyle')) return;

  const css = `
/* === Hydration Challenge Pack v1 === */
#hhaChallengeHud{
  position:fixed;
  left:12px;
  bottom:12px;
  z-index:2450;
  width:min(330px, calc(100vw - 24px));
  display:grid;
  gap:8px;
  padding:10px;
  border-radius:20px;
  background:rgba(7,18,38,.82);
  border:1px solid rgba(255,255,255,.14);
  box-shadow:0 16px 40px rgba(0,0,0,.28);
  color:#eff7ff;
  font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif;
  backdrop-filter:blur(12px);
  pointer-events:none;
}
#hhaChallengeHud .top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:8px;
}
#hhaChallengeHud .title{
  font-size:12px;
  font-weight:1000;
}
#hhaChallengeHud .badge{
  font-size:11px;
  font-weight:1000;
  padding:5px 8px;
  border-radius:999px;
  background:rgba(251,191,36,.16);
  border:1px solid rgba(251,191,36,.34);
  color:#fef3c7;
}
#hhaChallengeHud .bar{
  height:8px;
  border-radius:999px;
  background:rgba(255,255,255,.10);
  overflow:hidden;
  border:1px solid rgba(255,255,255,.08);
}
#hhaChallengeHud .fill{
  height:100%;
  width:0%;
  border-radius:999px;
  background:linear-gradient(90deg,#22d3ee,#fbbf24,#fb7185);
  transition:width .16s ease;
}
#hhaChallengeHud .line{
  display:flex;
  justify-content:space-between;
  gap:8px;
  color:#bfdbfe;
  font-size:11px;
  font-weight:900;
}
#hhaChallengeHud .line strong{
  color:#fff;
}

.hha-challenge-on #stage.hha-challenge-rush{
  outline:3px solid rgba(250,204,21,.26);
  box-shadow:
    0 28px 76px rgba(0,0,0,.30),
    0 0 44px rgba(250,204,21,.22),
    0 0 0 1px rgba(255,255,255,.08) inset !important;
}

.hha-challenge-on #stage.hha-challenge-pressure{
  filter:saturate(1.08) brightness(.98);
}

.hha-challenge-orb-good{
  outline:2px solid rgba(34,211,238,.20);
}

.hha-challenge-orb-bad,
.hha-challenge-orb-threat{
  outline:3px solid rgba(251,191,36,.20);
  box-shadow:
    0 0 0 5px rgba(251,191,36,.10),
    0 14px 34px rgba(251,113,133,.24) !important;
}

.hha-challenge-orb-threat{
  animation:hhaChallengeThreatPulse .55s ease-in-out infinite alternate !important;
}

@keyframes hhaChallengeThreatPulse{
  from{ filter:brightness(1) saturate(1); }
  to{ filter:brightness(1.16) saturate(1.2); }
}

.hha-challenge-callout{
  position:absolute;
  left:50%;
  top:15%;
  transform:translate(-50%,-50%);
  z-index:60;
  padding:10px 14px;
  border-radius:999px;
  background:rgba(7,18,38,.84);
  border:1px solid rgba(255,255,255,.16);
  color:#fff;
  font-size:13px;
  font-weight:1000;
  box-shadow:0 14px 34px rgba(0,0,0,.24);
  pointer-events:none;
  animation:hhaChallengeCallout 1.2s ease forwards;
}

@keyframes hhaChallengeCallout{
  0%{ opacity:0; transform:translate(-50%,-35%) scale(.92); }
  16%{ opacity:1; transform:translate(-50%,-50%) scale(1); }
  100%{ opacity:0; transform:translate(-50%,-80%) scale(.98); }
}

@media (max-width:640px){
  #hhaChallengeHud{
    left:8px;
    right:8px;
    bottom:8px;
    width:auto;
  }
}
`;

  const st = document.createElement('style');
  st.id = 'hhaHydrationChallengeStyle';
  st.textContent = css;
  document.head.appendChild(st);
}

/* ------------------------------------------------------------
 * HUD
 * ------------------------------------------------------------ */

function createHud(cfg){
  S.level = cfg.level;

  if (document.getElementById('hhaChallengeHud')) return;

  const hud = document.createElement('div');
  hud.id = 'hhaChallengeHud';
  hud.innerHTML = `
    <div class="top">
      <div class="title">🔥 Challenge Pack</div>
      <div class="badge" id="hhaChallengeBadge">${cfg.level.toUpperCase()}</div>
    </div>
    <div class="bar"><div class="fill" id="hhaChallengeFill"></div></div>
    <div class="line"><span>Combo Gate</span><strong id="hhaChallengeGate">0</strong></div>
    <div class="line"><span>Max Combo</span><strong id="hhaChallengeCombo">0</strong></div>
    <div class="line"><span>Rush</span><strong id="hhaChallengeRush">Standby</strong></div>
  `;

  document.body.appendChild(hud);
}

function updateHud(cfg){
  const gateEl = document.getElementById('hhaChallengeGate');
  const comboEl = document.getElementById('hhaChallengeCombo');
  const rushEl = document.getElementById('hhaChallengeRush');
  const fillEl = document.getElementById('hhaChallengeFill');

  if (gateEl) gateEl.textContent = String(S.gateTarget || 0);
  if (comboEl) comboEl.textContent = String(S.maxCombo || 0);
  if (rushEl) rushEl.textContent = S.rushActive ? 'FINAL RUSH!' : 'Standby';

  const pct = S.gateTarget > 0
    ? clamp((S.maxCombo / S.gateTarget) * 100, 0, 100)
    : 0;

  if (fillEl) fillEl.style.width = pct.toFixed(0) + '%';
}

/* ------------------------------------------------------------
 * Stats loop
 * ------------------------------------------------------------ */

function installStatsLoop(cfg){
  S.totalTime = Number(new URLSearchParams(location.search).get('time') || 0) || 0;

  setInterval(()=>{
    collectStats(cfg);
    updateChallengeStage(cfg);
    updateHud(cfg);
  }, 220);
}

function collectStats(cfg){
  const combo = readNumFromEl('uiCombo');
  const water = readNumFromEl('uiWater');
  const miss = readNumFromEl('uiMiss');
  const shield = readNumFromEl('uiShield');
  const block = readNumFromEl('uiBlock');
  const timeLeft = readTimeLeft();

  S.currentCombo = combo;
  S.currentWater = water;
  S.currentMiss = miss;
  S.currentShield = shield;
  S.currentBlock = block;
  S.currentTimeLeft = timeLeft;

  S.maxCombo = Math.max(S.maxCombo, combo);
  S.maxWater = Math.max(S.maxWater, water);
  S.minWater = Math.min(S.minWater, water || S.minWater);

  if (!S.totalTime && timeLeft) S.totalTime = Math.max(S.totalTime, timeLeft);

  const total = S.totalTime || Number(new URLSearchParams(location.search).get('time') || 80) || 80;
  const elapsed = clamp(total - timeLeft, 0, total);
  const ratio = total > 0 ? elapsed / total : 0;

  let gateIndex = 0;
  if (ratio > 0.66) gateIndex = 2;
  else if (ratio > 0.33) gateIndex = 1;

  S.gateTarget = cfg.comboGates[gateIndex] || cfg.comboGates[0] || 0;
  S.gatePassed = S.maxCombo >= S.gateTarget;

  const risk = computeRisk();
  S.maxRisk = Math.max(S.maxRisk, risk);
}

function updateChallengeStage(cfg){
  const stage = document.getElementById('stage');
  if (!stage) return;

  const timeLeft = S.currentTimeLeft;
  const rushShouldActive = timeLeft > 0 && timeLeft <= cfg.rushSec;

  if (rushShouldActive && !S.rushStarted) {
    S.rushStarted = true;
    showChallengeCallout('⚡ FINAL RUSH! ใช้ Shield ให้คุ้ม และคุม Combo!');
  }

  S.rushActive = rushShouldActive;

  stage.classList.toggle('hha-challenge-rush', S.rushActive);
  stage.classList.toggle('hha-challenge-pressure', computeRisk() >= 0.62);

  const isStorm = stage.classList.contains('is-storm') || stage.classList.contains('is-boss') || stage.classList.contains('final-rush');

  if (isStorm && !S.lastStorm) {
    S.stormChain += 1;
    showChallengeCallout(`🌩️ Storm Chain ${S.stormChain}: อย่าแตะพลาด!`);
  }

  S.lastStorm = isStorm;
}

function computeRisk(){
  let risk = 0;

  if (S.currentWater < 40 && S.currentWater > 0) risk += 0.24;
  if (S.currentMiss >= 10) risk += 0.18;
  if (S.currentMiss >= 18) risk += 0.18;
  if (S.currentShield <= 0) risk += 0.14;
  if (!S.gatePassed && S.currentTimeLeft < (S.totalTime || 80) * 0.45) risk += 0.18;
  if (S.rushActive) risk += 0.22;

  return clamp(risk, 0, 1);
}

function readNumFromEl(id){
  const el = document.getElementById(id);
  if (!el) return 0;
  const raw = String(el.textContent || '').replace(/[^\d.-]/g, '');
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

function readTimeLeft(){
  const el = document.getElementById('uiTime');
  if (!el) return 0;

  const t = String(el.textContent || '').trim();

  if (/^\d+:\d+$/.test(t)) {
    const [m,s] = t.split(':').map(Number);
    return (Number(m)||0) * 60 + (Number(s)||0);
  }

  const n = Number(t.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/* ------------------------------------------------------------
 * Bubble Observer
 * ------------------------------------------------------------ */

function installBubbleObserver(cfg){
  const layer = document.getElementById('layer');
  if (!layer) {
    console.warn('[hydration-challenge] #layer not found');
    return;
  }

  const rng = makeRng(cfg.seed || Date.now());

  function scanNode(node){
    if (!node || node.nodeType !== 1) return;
    if (!node.classList || !node.classList.contains('bubble')) return;
    if (node.dataset.hhaChallengeTouched === '1') return;

    node.dataset.hhaChallengeTouched = '1';
    S.bubblesSeen += 1;

    tuneBubble(node, cfg, rng);
  }

  qsa('.bubble', layer).forEach(scanNode);

  const obs = new MutationObserver((muts)=>{
    for (const m of muts){
      for (const n of m.addedNodes){
        scanNode(n);

        if (n && n.querySelectorAll) {
          n.querySelectorAll('.bubble').forEach(scanNode);
        }
      }
    }
  });

  obs.observe(layer, {
    childList:true,
    subtree:true
  });
}

function tuneBubble(node, cfg, rng){
  const text = String(node.textContent || '');
  const cls = node.className || '';

  const isGood = node.classList.contains('bubble-good') || /💧|🚰|🧊|🌊/.test(text);
  const isShield = node.classList.contains('bubble-shield') || /🛡/.test(text);
  const isBonus = node.classList.contains('bubble-bonus') || /🌟|⭐|✨/.test(text);
  const isBad = node.classList.contains('bubble-bad') || /🥤|☕|🧃|🍟|⚠️/.test(text);
  const isThreat = node.classList.contains('bubble-threat') || /⚡|🌩|☇/.test(text);

  // Shield Scarcity: เอา shield ออกบางส่วนในโหมด challenge/hero
  if (isShield && rng() > cfg.shieldKeepRate) {
    S.shieldsRemoved += 1;
    try{ node.remove(); }catch(_){}
    return;
  }

  // Good bubbles เล็กลงเล็กน้อย เพื่อให้ต้องเล็งขึ้น
  if (isGood && !isBonus) {
    node.classList.add('hha-challenge-orb-good');
    scaleBubble(node, cfg.goodScale);
    speedFloat(node, cfg.floatSpeed);
  }

  // Bad ใหญ่ขึ้นเล็กน้อย กดดันขึ้น
  if (isBad) {
    node.classList.add('hha-challenge-orb-bad');
    scaleBubble(node, cfg.badScale);
    speedFloat(node, cfg.floatSpeed * 0.92);
  }

  // Threat ใหญ่/เด่น/เต้น
  if (isThreat) {
    node.classList.add('hha-challenge-orb-threat');
    scaleBubble(node, cfg.threatScale);
    speedFloat(node, cfg.floatSpeed * 0.84);

    node.addEventListener('click', ()=>{
      S.threatTouched += 1;
    }, { once:true, passive:true });
  }

  // Final Rush: เป้าที่เกิดช่วงท้ายจะถูกไฮไลต์ให้กดดัน
  if (S.rushActive) {
    node.classList.add('bubble-priority');

    if (isGood && !isShield && !isBonus) {
      setTimeout(()=>{
        try{
          if (node && node.isConnected) {
            node.style.opacity = '0.45';
            node.style.filter = 'saturate(.65)';
          }
        }catch(_){}
      }, cfg.finalGoodLifeMs);
    }
  }
}

function scaleBubble(node, scale){
  try{
    const base = 90;
    const size = Math.round(base * Number(scale || 1));
    node.style.width = size + 'px';
    node.style.height = size + 'px';
    node.style.minWidth = size + 'px';
    node.style.minHeight = size + 'px';
  }catch(_){}
}

function speedFloat(node, factor){
  try{
    const current = getComputedStyle(node).animationDuration || '';
    const n = Number(String(current).replace('s','')) || 2.2;
    const next = Math.max(0.45, n * Number(factor || 1));
    node.style.animationDuration = next.toFixed(2) + 's';
  }catch(_){}
}

/* ------------------------------------------------------------
 * End summary hook
 * ------------------------------------------------------------ */

function installEndSummaryHook(cfg){
  const end = document.getElementById('end');

  function saveChallengeSummary(){
    const summary = readLastSummary();
    const challenge = buildChallengeSummary(cfg);

    summary.challenge = challenge;

    summary.ch_enabled = true;
    summary.ch_level = challenge.level;
    summary.ch_maxCombo = challenge.maxCombo;
    summary.ch_gateTarget = challenge.gateTarget;
    summary.ch_gatePassed = challenge.gatePassed;
    summary.ch_rushActive = challenge.rushStarted;
    summary.ch_stormChain = challenge.stormChain;
    summary.ch_shieldsRemoved = challenge.shieldsRemoved;
    summary.ch_bubblesSeen = challenge.bubblesSeen;
    summary.ch_maxRisk = challenge.maxRisk;

    writeLastSummary(summary);

    window.dispatchEvent(new CustomEvent('hha:challenge_saved', {
      detail: challenge
    }));
  }

  if (end){
    const obs = new MutationObserver(()=>{
      const shown = end.getAttribute('aria-hidden') === 'false';
      if (shown) {
        setTimeout(saveChallengeSummary, 100);
      }
    });

    obs.observe(end, {
      attributes:true,
      attributeFilter:['aria-hidden']
    });
  }

  window.addEventListener('hha:end', ()=>{
    setTimeout(saveChallengeSummary, 100);
  });
}

function buildChallengeSummary(cfg){
  return {
    patch: PATCH,
    enabled: true,
    level: cfg.level,
    maxCombo: S.maxCombo,
    gateTarget: S.gateTarget,
    gatePassed: !!S.gatePassed,
    rushStarted: !!S.rushStarted,
    stormChain: S.stormChain,
    shieldsRemoved: S.shieldsRemoved,
    threatTouched: S.threatTouched,
    bubblesSeen: S.bubblesSeen,
    maxRisk: Number(S.maxRisk.toFixed(3)),
    startedAt: S.startedAt,
    endedAt: Date.now()
  };
}

/* ------------------------------------------------------------
 * Utilities
 * ------------------------------------------------------------ */

function showChallengeCallout(text){
  try{
    const stage = document.getElementById('stage');
    if (!stage) return;

    const el = document.createElement('div');
    el.className = 'hha-challenge-callout';
    el.textContent = String(text || '');

    stage.appendChild(el);

    setTimeout(()=>{
      try{ el.remove(); }catch(_){}
    }, 1300);
  }catch(_){}
}

function makeRng(seed){
  let s = Number(seed) || 123456789;
  s = Math.abs(Math.floor(s)) % 2147483647;
  if (s <= 0) s += 2147483646;

  return function(){
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}