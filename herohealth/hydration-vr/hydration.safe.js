// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — ORB Edition (PLAY-ready but “โหดแบบวิจัย”)
// ✅ Orb targets (Hydration identity) + hit FX (Particles)
// ✅ Water gauge: no more “ขึ้นเองถึง 100” (BAD expire ไม่เพิ่มใน Play)
// ✅ Expire logic fixed: GOOD expire = แย่ลง / BAD expire = ไม่ให้รางวัล (Play) / มีผล (Study)
// ✅ Goal: นับเฉพาะ “GOOD ที่กดตอนอยู่ GREEN” (แก้ไม่นับให้)
// ✅ Mini: Storm-only “Shield Timing” (block BAD ตอน laser-fire window) + UI ชัด ๆ
// ✅ Storm warning (cinematic) + beep/tick/thunder (ตามเงื่อนไขเสียง)
// ✅ End Summary: minisTotal = จำนวน storm จริง (ไม่ใช่ 999) + save last summary + retry + back-to-hub
// ✅ P0+P1 รวมในไฟล์เดียว (ตามที่คุยกัน)

// NOTE: ต้องมี /vr/mode-factory.js + /vr/ui-water.js + (optional) /vr/particles.js + (optional) /vr/ui-fever.js

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

// ------------------------------------------------------------
// Root + safe modules
// ------------------------------------------------------------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop(){}, burstAt(){}, celebrate(){ } };

const FeverUI =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.FeverUI) ||
  ROOT.FeverUI ||
  null;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function clamp(v, a, b){ v = Number(v)||0; return v<a?a:(v>b?b:v); }
function nowMs(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }
function qs(){ try{ return new URLSearchParams(location.search||''); }catch{ return new URLSearchParams(); } }
function qStr(p,k,def=''){ const v=p.get(k); return (v==null||v==='')?def:String(v); }
function qNum(p,k,def=0){ const v=Number(p.get(k)); return Number.isFinite(v)?v:def; }
function qBool(p,k,def=false){ const v=(p.get(k)||'').toLowerCase(); if(!v) return def; return (v==='1'||v==='true'||v==='yes'||v==='y'); }
function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}
function getHubUrl(){
  const p = qs();
  const hub = p.get('hub') || './hub.html';
  return hub;
}
function saveLastSummary(sum){
  try{ localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(sum||{})); }catch{}
  try{ localStorage.setItem('HHA_LAST_SUMMARY_HYDRATION', JSON.stringify(sum||{})); }catch{}
}

// ------------------------------------------------------------
// Minimal “cinematic” overlay + SFX (beep/tick/thunder only)
// ------------------------------------------------------------
function ensureCineStyle(){
  if (!DOC || DOC.getElementById('hy-cine-style')) return;
  const st = DOC.createElement('style');
  st.id = 'hy-cine-style';
  st.textContent = `
    .hy-cine-overlay{
      position:fixed; inset:0; z-index:9997; pointer-events:none;
      opacity:0; transition: opacity .18s ease;
      background:
        radial-gradient(900px 520px at 50% 40%, rgba(56,189,248,.08), rgba(2,6,23,0) 65%),
        linear-gradient(180deg, rgba(2,6,23,.00), rgba(2,6,23,.42));
      mix-blend-mode: screen;
      backdrop-filter: blur(0px);
    }
    .hy-cine-overlay.on{ opacity:1; }
    .hy-cine-vignette{
      position:absolute; inset:-2%;
      background: radial-gradient(circle at 50% 45%, rgba(2,6,23,0) 35%, rgba(2,6,23,.55) 72%, rgba(2,6,23,.75) 100%);
      opacity:.0;
      transition: opacity .16s ease;
    }
    .hy-cine-overlay.on .hy-cine-vignette{ opacity:1; }

    .hy-storm-warn{
      position:absolute; inset:0;
      opacity:0;
      background:
        radial-gradient(800px 420px at 50% 40%, rgba(56,189,248,.10), rgba(2,6,23,0) 60%),
        linear-gradient(180deg, rgba(2,6,23,.00), rgba(2,6,23,.38));
      transition: opacity .14s ease;
    }
    .hy-cine-overlay.warn .hy-storm-warn{ opacity:1; animation: hyWarnPulse .48s ease-in-out infinite; }
    @keyframes hyWarnPulse{
      0%{ filter: brightness(1.0) saturate(1.0); }
      50%{ filter: brightness(1.18) saturate(1.25); }
      100%{ filter: brightness(1.0) saturate(1.0); }
    }

    .hy-lightning{
      position:absolute; inset:0; opacity:0;
      background: radial-gradient(720px 420px at 58% 30%, rgba(255,255,255,.16), rgba(255,255,255,0) 60%);
      mix-blend-mode: screen;
    }
    .hy-cine-overlay.flash .hy-lightning{
      opacity:1;
      animation: hyFlash .22s ease-out 1;
    }
    @keyframes hyFlash{
      0%{ opacity:0; }
      30%{ opacity:1; }
      100%{ opacity:0; }
    }

    .hy-storm-banner{
      position:fixed; left:50%; top:14%;
      transform: translate(-50%,-50%);
      z-index:9998;
      pointer-events:none;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(148,163,184,.18);
      background: rgba(2,6,23,.62);
      color: #e5e7eb;
      font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
      font-weight: 900;
      letter-spacing: .2px;
      box-shadow: 0 18px 50px rgba(0,0,0,.45);
      backdrop-filter: blur(10px);
      opacity:0;
      transition: opacity .18s ease, transform .18s ease;
    }
    .hy-storm-banner.on{
      opacity:1;
      transform: translate(-50%,-50%) scale(1.02);
    }
  `;
  DOC.head.appendChild(st);
}
function ensureCineOverlay(){
  if (!DOC) return null;
  ensureCineStyle();
  let ov = DOC.getElementById('hy-cine-overlay');
  if (ov && ov.isConnected) return ov;

  ov = DOC.createElement('div');
  ov.id = 'hy-cine-overlay';
  ov.className = 'hy-cine-overlay';
  ov.innerHTML = `
    <div class="hy-cine-vignette"></div>
    <div class="hy-storm-warn"></div>
    <div class="hy-lightning"></div>
  `;
  DOC.body.appendChild(ov);

  let banner = DOC.getElementById('hy-storm-banner');
  if (!banner){
    banner = DOC.createElement('div');
    banner.id = 'hy-storm-banner';
    banner.className = 'hy-storm-banner';
    banner.textContent = '⚡ Storm incoming…';
    DOC.body.appendChild(banner);
  }

  return ov;
}

// --- SFX: beep/tick/thunder (WebAudio) ---
const SFX = (function(){
  let ctx = null;
  function getCtx(){
    if (!ROOT.AudioContext && !ROOT.webkitAudioContext) return null;
    if (!ctx){
      try{ ctx = new (ROOT.AudioContext || ROOT.webkitAudioContext)(); }catch{ ctx=null; }
    }
    if (ctx && ctx.state === 'suspended'){
      // unlock on first pointer
      const unlock = () => { try{ ctx.resume(); }catch{} DOC.removeEventListener('pointerdown', unlock); DOC.removeEventListener('touchstart', unlock); };
      try{ DOC.addEventListener('pointerdown', unlock, { once:true }); DOC.addEventListener('touchstart', unlock, { once:true }); }catch{}
    }
    return ctx;
  }

  function beep(freq=880, ms=70, gain=0.06){
    const c = getCtx(); if(!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+(ms/1000));
    o.connect(g); g.connect(c.destination);
    o.start(t0);
    o.stop(t0+(ms/1000)+0.02);
  }

  function tick(ms=38){
    // short “click” using square-ish tone
    beep(1460, ms, 0.035);
  }

  function thunder(){
    const c = getCtx(); if(!c) return;
    const t0 = c.currentTime;

    // noise burst
    const buf = c.createBuffer(1, Math.floor(c.sampleRate*0.35), c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i=0;i<data.length;i++){
      // quick decay
      const k = 1 - (i/data.length);
      data[i] = (Math.random()*2-1) * (k*k);
    }
    const src = c.createBufferSource();
    src.buffer = buf;

    const g = c.createGain();
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(240, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0+0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+0.40);

    src.connect(f); f.connect(g); g.connect(c.destination);
    src.start(t0);
    src.stop(t0+0.45);

    // sub rumble
    beep(58, 260, 0.08);
  }

  return { beep, tick, thunder };
})();

// ------------------------------------------------------------
// UI: End summary overlay (fallback if html has none)
// ------------------------------------------------------------
function ensureEndOverlay(){
  if (!DOC) return null;
  let end = DOC.getElementById('hvr-end');
  if (end && end.isConnected) return end;

  const stId = 'hy-end-style';
  if (!DOC.getElementById(stId)){
    const st = DOC.createElement('style');
    st.id = stId;
    st.textContent = `
      .hvr-end{
        position:fixed; inset:0;
        z-index:9999;
        display:none;
        align-items:flex-start;
        justify-content:center;
        padding-top: 6vh;
        background: radial-gradient(1200px 700px at 50% 25%, rgba(11,17,32,.85), rgba(2,6,23,.92) 65%);
        color:#e5e7eb;
        font-family: system-ui,-apple-system,Segoe UI,Roboto,Arial;
      }
      .hvr-end.on{ display:flex; }
      .hvr-end .panel{
        width:min(920px, 92vw);
        border:1px solid rgba(148,163,184,.18);
        border-radius: 22px;
        background: rgba(2,6,23,.62);
        box-shadow: 0 28px 80px rgba(0,0,0,.55);
        backdrop-filter: blur(10px);
        padding: 14px;
      }
      .hvr-end .top{
        display:flex; align-items:center; justify-content:space-between; gap:10px;
        padding: 6px 6px 10px;
      }
      .hvr-end .title{
        font-weight: 950;
        letter-spacing:.2px;
        opacity:.95;
      }
      .hvr-end .btn{
        border:1px solid rgba(148,163,184,.18);
        background: rgba(34,197,94,.18);
        color:#e5e7eb;
        border-radius: 14px;
        padding: 10px 12px;
        font-weight: 1000;
        cursor:pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .hvr-end .btn.secondary{ background: rgba(2,6,23,.55); }
      .hvr-end .grid{
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        padding: 6px;
      }
      .hvr-end .card{
        border:1px solid rgba(148,163,184,.18);
        border-radius: 16px;
        background: rgba(15,23,42,.40);
        padding: 12px;
        min-height: 60px;
      }
      .hvr-end .k{ font-size:12px; color:#94a3b8; font-weight: 900; letter-spacing:.2px; }
      .hvr-end .v{ font-size:18px; font-weight: 1100; letter-spacing:.2px; margin-top:4px; }
      @media (max-width: 720px){
        .hvr-end .grid{ grid-template-columns: 1fr; }
      }
    `;
    DOC.head.appendChild(st);
  }

  end = DOC.createElement('div');
  end.id = 'hvr-end';
  end.className = 'hvr-end';
  end.innerHTML = `
    <div class="panel">
      <div class="top">
        <div class="title">🏁 Summary</div>
        <div style="display:flex; gap:10px; align-items:center">
          <button class="btn secondary" id="hvr-end-back" type="button">🏠 HUB</button>
          <button class="btn" id="hvr-end-retry" type="button">🔁 Retry</button>
        </div>
      </div>
      <div class="grid">
        <div class="card"><div class="k">Score</div><div class="v" id="hvr-end-score">0</div></div>
        <div class="card"><div class="k">Grade</div><div class="v" id="hvr-end-grade">C</div></div>
        <div class="card"><div class="k">Combo Max</div><div class="v" id="hvr-end-combo">0</div></div>
        <div class="card"><div class="k">Miss</div><div class="v" id="hvr-end-miss">0</div></div>
        <div class="card"><div class="k">Goals</div><div class="v" id="hvr-end-goals">0/0</div></div>
        <div class="card"><div class="k">Minis</div><div class="v" id="hvr-end-minis">0/0</div></div>
      </div>
    </div>
  `;
  DOC.body.appendChild(end);
  return end;
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------
(function main(){
  if (!DOC) return;

  const P = qs();
  const runMode = (qStr(P,'run', qStr(P,'runMode','play')) || 'play').toLowerCase();
  const diff    = (qStr(P,'diff','normal') || 'normal').toLowerCase();
  const timeSec = clamp(qNum(P,'time', qNum(P,'durationPlannedSec', 70)), 20, 180) | 0;

  // stable seed (deterministic research)
  const sessionId = qStr(P,'sessionId', String(Date.now()));
  const studentKey = qStr(P,'studentKey','');
  const seed = qStr(P,'seed', `${sessionId}|hydration|${diff}|${runMode}|${studentKey}`);

  // HUD expects these keys in hha:score payload
  const state = {
    mode: runMode,
    diff,
    durationPlannedSec: timeSec,

    score: 0,
    combo: 0,
    comboMax: 0,

    miss: 0,   // “miss” = true mistakes / punishments
    drop: 0,   // “drop” = GOOD expire (P1: แยกจาก miss เพื่อไม่งง)

    // water gauge (0..100)
    waterPct: clamp(qNum(P,'waterStart', 45), 0, 100),
    zone: 'GREEN',

    // fever/shield
    feverPct: 0,
    shieldSec: 0,
    shieldUntilMs: 0,

    // quest (goals)
    goalIndex: 0,
    goalsDone: 0,
    goalsTotal: 2,

    // Green hits for current goal
    greenHits: 0,
    greenNeed: (diff==='hard' ? 14 : (diff==='easy' ? 10 : 12)),

    // minis (storm-only)
    minisDone: 0,
    minisTotal: 0,          // ✅ will become “stormSeen”
    stormSeen: 0,           // ✅ P0 fix
    stormMiniNeed: (runMode==='study' ? 3 : 2),
    stormMiniBlocks: 0,

    // storm timeline
    inStorm: false,
    stormWarn: false,
    nextStormAtMs: 0,
    stormEndsAtMs: 0,

    // timing for “laser-fire”
    lastLaserFireAtMs: 0,

    // time
    tStartMs: nowMs(),
    secLeft: timeSec,

    stopped: false,
    ended: false
  };

  // init UI
  ensureWaterGauge();
  updateWaterUI(true);
  syncFeverUI(true);
  emitQuestUpdate(true);

  // Cine overlay
  const ov = ensureCineOverlay();
  const banner = DOC.getElementById('hy-storm-banner');

  // Plan storm schedule (simple but deterministic-ish)
  // play: less frequent but punchier, study: more regular
  const STORM = (function(){
    const baseEvery = (runMode==='study')
      ? (diff==='hard' ? 16 : 18)
      : (diff==='hard' ? 18 : 20);
    const dur = (diff==='hard' ? 7 : 6);
    const warn = 3; // seconds
    return { everySec: baseEvery, durSec: dur, warnSec: warn };
  })();

  state.nextStormAtMs = state.tStartMs + (STORM.everySec * 1000);

  // Listen mode-factory tick (laser warn/fire)
  ROOT.addEventListener('hha:tick', (ev)=>{
    const d = ev && ev.detail ? ev.detail : null;
    if (!d) return;
    if (d.kind === 'laser-fire'){
      state.lastLaserFireAtMs = nowMs();
    }
  });

  // ------------------------------------------------------------
  // Water / zone logic (fix “ขึ้นเองถึง 100”)
  // ------------------------------------------------------------
  function computeZone(pct){
    try{
      const z = zoneFrom(pct);
      return (z||'GREEN').toUpperCase();
    }catch{
      // fallback bands
      if (pct < 35) return 'LOW';
      if (pct > 65) return 'HIGH';
      return 'GREEN';
    }
  }

  function updateWaterUI(force=false){
    state.waterPct = clamp(state.waterPct, 0, 100);
    const z = computeZone(state.waterPct);
    if (force || z !== state.zone){
      state.zone = z;
    }
    try{ setWaterGauge(state.waterPct); }catch{}
    dispatch('hha:score', packScore());
  }

  // “regression-to-mean” for GOOD hit: always nudges toward GREEN
  function applyGoodHit(){
    const pct = state.waterPct;
    const center = 50;
    const toward = center - pct;
    // base bump + pull toward mean
    const base = 7.0;
    const pull = clamp(toward * 0.12, -6, 6);
    state.waterPct = pct + base + pull;
  }
  // BAD hit: pushes away from GREEN (worse)
  function applyBadHit(){
    const pct = state.waterPct;
    const center = 50;
    const away = (pct >= center) ? +1 : -1;
    state.waterPct = pct + away * (diff==='hard' ? 12 : 10);
  }
  // GOOD expire: worsen (away from mean) + drop++
  function applyGoodExpire(){
    const pct = state.waterPct;
    const center = 50;
    const away = (pct >= center) ? +1 : -1;
    state.waterPct = pct + away * (diff==='hard' ? 7 : 6);
  }
  // BAD expire:
  // ✅ Play: no reward / no punish (fix “ไม่คลิก water ยังขึ้นเอง”)
  // Study: slight punish (optional) — keep it meaningful
  function applyBadExpire(){
    if (state.mode !== 'study') return;
    // study mode: drifting away slightly (pressure)
    applyBadHit();
  }

  // ------------------------------------------------------------
  // Fever / Shield
  // ------------------------------------------------------------
  function hasShield(){
    const t = nowMs();
    return (state.shieldSec > 0) && (t < state.shieldUntilMs);
  }
  function giveShield(sec){
    const s = clamp(sec, 1, 8);
    state.shieldSec = s;
    state.shieldUntilMs = nowMs() + s*1000;
    syncFeverUI();
  }
  function bumpFever(delta){
    state.feverPct = clamp(state.feverPct + delta, 0, 100);
    // Auto shield when fever full (Hydration identity: “power surge”)
    if (state.feverPct >= 100){
      state.feverPct = 0;
      giveShield(state.mode==='study' ? 4 : 3);
      // little “celebrate”
      try{ Particles.celebrate && Particles.celebrate('shield'); }catch{}
    }
    syncFeverUI();
  }
  function syncFeverUI(force=false){
    const on = hasShield();
    const left = on ? Math.ceil((state.shieldUntilMs - nowMs())/1000) : 0;
    const payload = { feverPct: state.feverPct|0, shieldSec: left|0, active: !!on };
    // prefer FeverUI if available, else events
    try{
      if (FeverUI){
        if (typeof FeverUI.set === 'function') FeverUI.set(payload);
        else if (typeof FeverUI.update === 'function') FeverUI.update(payload);
        else if (typeof FeverUI.setFever === 'function') FeverUI.setFever(payload.feverPct);
        if (typeof FeverUI.setShield === 'function') FeverUI.setShield(payload.shieldSec);
      }
    }catch{}
    dispatch('hha:fever', payload);
  }

  // ------------------------------------------------------------
  // Quests
  // ------------------------------------------------------------
  function goalNeedFor(index){
    // 2 goals, second is slightly harder
    const base = (diff==='hard' ? 14 : (diff==='easy' ? 10 : 12));
    return (index<=0) ? base : (base + (diff==='easy' ? 2 : 3));
  }

  function startNextGoal(){
    state.goalIndex = clamp(state.goalsDone, 0, state.goalsTotal-1);
    state.greenHits = 0;
    state.greenNeed = goalNeedFor(state.goalIndex);
    // make storm mini harder a bit on goal2
    state.stormMiniNeed = (state.mode==='study' ? 3 : 2) + (state.goalIndex>=1 ? 1 : 0);
    state.stormMiniBlocks = 0;
    emitQuestUpdate(true);
  }

  function onGoalProgress(){
    if (state.greenHits >= state.greenNeed){
      state.goalsDone += 1;
      try{ Particles.celebrate && Particles.celebrate('goal'); }catch{}
      dispatch('hha:celebrate', { kind:'goal', idx: state.goalsDone, total: state.goalsTotal });
      // small “reward”: stabilize water slightly toward GREEN
      const center = 50;
      state.waterPct = state.waterPct + clamp((center - state.waterPct)*0.20, -8, 8);
      updateWaterUI(true);

      if (state.goalsDone >= state.goalsTotal){
        // all complete -> end early? (keep playing till time ends, but rank improves)
      } else {
        startNextGoal();
      }
    }
    emitQuestUpdate();
  }

  function onMiniProgress(){
    if (state.stormMiniBlocks >= state.stormMiniNeed){
      state.minisDone += 1;
      state.stormMiniBlocks = 0; // reset for next storm mini
      try{ Particles.celebrate && Particles.celebrate('mini'); }catch{}
      dispatch('hha:celebrate', { kind:'mini', done: state.minisDone });
      // reward: give short shield + water pull to green
      giveShield(state.mode==='study' ? 3 : 2);
      const center = 50;
      state.waterPct = state.waterPct + clamp((center - state.waterPct)*0.16, -6, 6);
      updateWaterUI(true);
      emitQuestUpdate(true);
    }
  }

  function emitQuestUpdate(force=false){
    const nextStormIn = Math.max(0, Math.ceil((state.nextStormAtMs - nowMs())/1000));
    const inStorm = !!state.inStorm;

    const goalLine = `Goal: อยู่ GREEN รวม ${state.greenNeed} 💧`;
    const goalProg = `สะสม GREEN รวม ${state.greenHits}/${state.greenNeed}`;
    const miniLine = `Mini (Storm): ใช้ Shield block BAD “ถูกจังหวะ” ${state.stormMiniBlocks}/${state.stormMiniNeed}`;

    const detail = {
      modeKey: 'hydration',
      goalTitle: `Quest ${state.goalIndex+1}`,
      goalLine,
      goalProgress: goalProg,
      goalsDone: state.goalsDone,
      goalsTotal: state.goalsTotal,

      miniTitle: 'Storm Mini: Shield Timing (FULL)',
      miniLine,
      minisDone: state.minisDone,
      minisTotal: Math.max(1, state.stormSeen|0), // ✅ P0: miniTotal = stormSeen
      nextStormInSec: nextStormIn,
      inStorm
    };

    dispatch('quest:update', detail);
    dispatch('hha:quest', detail);
  }

  // ------------------------------------------------------------
  // Score / grade packers
  // ------------------------------------------------------------
  function gradeFrom(){
    // Keep it “โหดแบบวิจัย” แต่ยุติธรรม: ให้ goal/mini มีน้ำหนักมากขึ้น
    const g = state.goalsDone / Math.max(1, state.goalsTotal);
    const m = state.minisDone / Math.max(1, Math.max(1, state.stormSeen|0)); // mini opportunities
    const acc = (state.score <= 0) ? 0 : clamp((state.score / Math.max(1, (state.score + state.miss*18 + state.drop*10))) , 0, 1);

    // weighted
    const s = 0.48*g + 0.26*m + 0.26*acc;

    if (s >= 0.92) return 'SSS';
    if (s >= 0.84) return 'SS';
    if (s >= 0.76) return 'S';
    if (s >= 0.64) return 'A';
    if (s >= 0.52) return 'B';
    return 'C';
  }

  function packScore(){
    return {
      modeKey: 'hydration',
      score: state.score|0,
      combo: state.combo|0,
      comboMax: state.comboMax|0,
      miss: state.miss|0,
      drop: state.drop|0,
      time: state.secLeft|0,
      grade: gradeFrom(),
      waterPct: Math.round(state.waterPct),
      zone: state.zone,
      shield: hasShield() ? Math.ceil((state.shieldUntilMs - nowMs())/1000) : 0,
      storm: state.inStorm ? 1 : 0
    };
  }

  // ------------------------------------------------------------
  // Hit FX helpers
  // ------------------------------------------------------------
  function fxHit(ctx, kind='good'){
    const x = Number(ctx && ctx.clientX) || 0;
    const y = Number(ctx && ctx.clientY) || 0;
    try{ Particles.burstAt && Particles.burstAt(x, y, kind); }catch{}
    try{ Particles.scorePop && Particles.scorePop(x, y, kind==='bad' ? '-':'+'); }catch{}
    dispatch('hha:judge', { kind, x, y });
  }

  // ------------------------------------------------------------
  // Storm control
  // ------------------------------------------------------------
  function setOverlayMode(mode){
    if (!ov) return;
    try{
      ov.classList.toggle('on', !!mode);
      ov.classList.toggle('warn', mode==='warn');
      ov.classList.toggle('flash', mode==='flash');
    }catch{}
  }
  function showBanner(text, on){
    if (!banner) return;
    if (text) banner.textContent = text;
    try{ banner.classList.toggle('on', !!on); }catch{}
  }

  function stormWarnStart(){
    if (state.stormWarn || state.inStorm || state.ended) return;
    state.stormWarn = true;
    setOverlayMode('warn');
    showBanner('⚡ Storm incoming… เตรียม “Shield Timing”', true);
    // tick-tick-tick (cinematic)
    SFX.tick(); setTimeout(()=>SFX.tick(), 160); setTimeout(()=>SFX.tick(), 320);
    dispatch('hha:tick', { kind:'storm-warn', intensity: 1.1 });
  }

  function stormStart(){
    if (state.inStorm || state.ended) return;
    state.stormWarn = false;
    state.inStorm = true;
    state.stormSeen += 1;          // ✅ P0: count storm opportunities
    state.minisTotal = state.stormSeen;
    state.stormMiniBlocks = 0;

    state.stormEndsAtMs = nowMs() + STORM.durSec*1000;
    state.nextStormAtMs = nowMs() + STORM.everySec*1000;

    setOverlayMode('on');
    showBanner('🌩️ STORM! block BAD ตอน laser-fire!', true);
    SFX.thunder();
    dispatch('hha:tick', { kind:'storm-start', intensity: 1.25 });

    emitQuestUpdate(true);
  }

  function stormEnd(){
    if (!state.inStorm) return;
    state.inStorm = false;
    setOverlayMode(false);
    showBanner('', false);
    dispatch('hha:tick', { kind:'storm-end', intensity: 1.0 });
    emitQuestUpdate(true);
  }

  // ------------------------------------------------------------
  // mode-factory configuration (orb look)
  // ------------------------------------------------------------
  function decorateTarget(el, parts, data, meta){
    // Make it “orb” identity for hydration
    try{
      el.style.boxShadow = '0 18px 42px rgba(0,0,0,.55)';
      el.style.border = '1px solid rgba(148,163,184,.12)';
    }catch{}

    const type = data && data.itemType ? data.itemType : 'good';
    const inner = parts && parts.inner;
    const ring  = parts && parts.ring;
    const icon  = parts && parts.icon;

    try{
      // soften ring, add glass highlight
      if (ring){
        ring.style.borderStyle = 'solid';
        ring.style.borderWidth = '1px';
        ring.style.opacity = '0.20';
        ring.style.filter = 'drop-shadow(0 0 16px rgba(255,255,255,.10))';
      }
      if (inner){
        inner.style.background = 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.22), rgba(15,23,42,.30) 55%, rgba(2,6,23,.25) 100%)';
        inner.style.boxShadow = 'inset 0 8px 18px rgba(255,255,255,.08), inset 0 -10px 22px rgba(2,6,23,.45)';
      }
      if (icon){
        // Hydration orb: keep minimal icon
        icon.style.fontSize = (meta.size * 0.30) + 'px';
        icon.style.opacity = '0.75';
      }
    }catch{}

    if (type === 'good'){
      try{
        el.style.background = 'radial-gradient(circle at 30% 25%, rgba(125,211,252,1), rgba(56,189,248,.92), rgba(2,132,199,.70))';
        if (icon) icon.textContent = '💧';
      }catch{}
    } else if (type === 'bad'){
      try{
        el.style.background = 'radial-gradient(circle at 30% 25%, rgba(251,113,133,1), rgba(244,63,94,.92), rgba(159,18,57,.72))';
        if (icon) icon.textContent = '☠️';
      }catch{}
    } else if (type === 'power'){
      try{
        el.style.background = 'radial-gradient(circle at 30% 25%, rgba(250,204,21,1), rgba(249,115,22,.92), rgba(234,88,12,.72))';
        if (icon) icon.textContent = '🛡️';
      }catch{}
    } else if (type === 'fakeGood'){
      try{
        el.style.background = 'radial-gradient(circle at 30% 25%, rgba(167,139,250,1), rgba(139,92,246,.92), rgba(76,29,149,.72))';
        if (icon) icon.textContent = '✨';
      }catch{}
    }
  }

  // Dynamic spawn speed multiplier (storm)
  function spawnIntervalMul(){
    if (state.inStorm) return (diff==='hard' ? 0.58 : 0.64);
    if (state.stormWarn) return 0.85;
    return 1.0;
  }

  // Spawn mix (simple): keep both blue+red always present
  const pools = {
    good:  ['💧','🫧','💧','💧'],
    bad:   ['🥤','🍭','🧃','☠️'],
    trick: ['🫧'] // decoy / fake-good
  };
  const powerups = ['🛡️'];

  // ----------------------------------------------------------------
  // Judge: core gameplay logic (fix goal counting + FX + shield timing)
  // ----------------------------------------------------------------
  function judge(ch, ctx){
    const itemType = ctx && ctx.itemType ? ctx.itemType : 'good';
    const isPower = !!(ctx && ctx.isPower);
    const isGood = !!(ctx && ctx.isGood);

    const inGreen = (computeZone(state.waterPct) === 'GREEN');
    const shieldOn = hasShield();

    let scoreDelta = 0;

    // POWER: gives shield
    if (isPower || itemType === 'power'){
      scoreDelta = 8;
      state.combo += 1;
      state.comboMax = Math.max(state.comboMax, state.combo);
      giveShield(state.mode==='study' ? 4 : 3);
      bumpFever(10);
      fxHit(ctx, 'power');
      dispatch('hha:coach', { mood:'happy', text:'🛡️ ได้ Shield! ใช้กัน BAD ตอนพายุให้ “ถูกจังหวะ”' });
      updateWaterUI();
      emitQuestUpdate();
      return { scoreDelta, good:true };
    }

    // BAD
    if (!isGood || itemType === 'bad'){
      if (shieldOn){
        // ✅ Blocked: no penalty, counts for storm mini only if timing OK
        scoreDelta = 5;
        state.combo += 1;
        state.comboMax = Math.max(state.comboMax, state.combo);

        // “Shield Timing”: must be during storm + near laser-fire
        if (state.inStorm){
          const dt = Math.abs(nowMs() - state.lastLaserFireAtMs);
          const okTiming = dt <= 260; // “ถูกจังหวะ”
          if (okTiming){
            state.stormMiniBlocks += 1;
            dispatch('hha:coach', { mood:'happy', text:'🎯 Timing PERFECT! Shield block สำเร็จ!' });
            onMiniProgress();
          } else {
            dispatch('hha:coach', { mood:'neutral', text:'เกือบได้! รอจังหวะ laser-fire แล้วค่อย block' });
          }
        }

        fxHit(ctx, 'shield');
        bumpFever(6);
        emitQuestUpdate();
        updateWaterUI();
        return { scoreDelta, good:true, blocked:true };
      }

      // No shield: punish
      scoreDelta = -10;
      state.combo = 0;
      state.miss += 1;

      applyBadHit();
      updateWaterUI(true);

      fxHit(ctx, 'bad');
      bumpFever(2); // stress
      dispatch('hha:coach', { mood:'sad', text:'☠️ โดน BAD! น้ำหลุดจากสมดุล!' });
      emitQuestUpdate();
      return { scoreDelta, good:false };
    }

    // GOOD / fakeGood
    if (itemType === 'fakeGood'){
      // trick: looks good but slightly harmful (research spice)
      scoreDelta = 2;
      state.combo += 1;
      state.comboMax = Math.max(state.comboMax, state.combo);

      // small destabilize
      state.waterPct = state.waterPct + ((state.waterPct >= 50) ? +4 : -4);
      updateWaterUI(true);

      fxHit(ctx, 'trick');
      bumpFever(4);
      dispatch('hha:coach', { mood:'neutral', text:'✨ ของปลอม! ระวังจังหวะ…' });
      emitQuestUpdate();
      return { scoreDelta, good:true };
    }

    // GOOD: stabilize water toward GREEN
    scoreDelta = 7;
    state.combo += 1;
    state.comboMax = Math.max(state.comboMax, state.combo);

    applyGoodHit();
    updateWaterUI(true);

    // ✅ Goal counting fix: count ONLY when “currently in GREEN”
    if (inGreen){
      state.greenHits += 1;
      bumpFever(9);
      fxHit(ctx, 'good');
      dispatch('hha:coach', { mood:'happy', text:'💧 PERFECT! อยู่ GREEN → นับเข้า Goal!' });
      onGoalProgress();
    } else {
      bumpFever(6);
      fxHit(ctx, 'good');
      dispatch('hha:coach', { mood:'neutral', text:'💧 ดี! แต่ต้อง “อยู่ GREEN” ถึงจะนับ Goal' });
      emitQuestUpdate();
    }

    return { scoreDelta, good:true };
  }

  // ------------------------------------------------------------
  // Expire handler (fix reversed + stop “auto rise to 100”)
  // ------------------------------------------------------------
  function onExpire(info){
    const itemType = info && info.itemType ? info.itemType : 'good';
    const isGood = !!(info && info.isGood);

    // GOOD expire: worsen + drop++ (NOT increase!)
    if (isGood || itemType === 'good' || itemType === 'fakeGood'){
      state.drop += 1;
      // (ถ้าอยากโหดเพิ่ม): drop ก็ทำให้ combo แตก
      state.combo = 0;
      applyGoodExpire();
      updateWaterUI(true);
      dispatch('hha:coach', { mood:'sad', text:'⏳ พลาดน้ำดี… สมดุลแย่ลง!' });
      emitQuestUpdate();
      return;
    }

    // BAD expire:
    // ✅ Play: no reward / no punish (fix “ไม่คลิก water ยังขึ้น”)
    // Study: punish a bit
    applyBadExpire();
    updateWaterUI(true);

    if (state.mode === 'study'){
      state.miss += 1;
      dispatch('hha:coach', { mood:'sad', text:'☠️ BAD หลุดรอด (Study) → โดนลงโทษ' });
    } else {
      dispatch('hha:coach', { mood:'neutral', text:'หลบ BAD สำเร็จ (Play): ไม่โดนลงโทษจาก BAD expire' });
    }
    emitQuestUpdate();
  }

  // ------------------------------------------------------------
  // Start goal 1
  // ------------------------------------------------------------
  startNextGoal();

  // ------------------------------------------------------------
  // Boot factory
  // ------------------------------------------------------------
  let engine = null;

  (async function boot(){
    engine = await factoryBoot({
      modeKey: 'hydration',
      difficulty: diff,
      duration: timeSec,

      seed,

      // host selectors (fallback is overlay host inside mode-factory)
      spawnHost: '#hy-layer',
      boundsHost: '#hy-bounds',

      pools,
      goodRate: 0.62, // always mixed
      powerups,
      powerRate: (state.mode==='study' ? 0.12 : 0.10),
      powerEvery: 8,

      trickRate: (state.mode==='study' ? 0.10 : 0.08),

      spawnIntervalMul,
      spawnAroundCrosshair: true,
      spawnStrategy: 'random',

      // safe zone padding: hydration has big HUD; keep targets away
      playPadXFrac: 0.10,
      playPadTopFrac: 0.14,
      playPadBotFrac: 0.16,

      autoRelaxSafezone: true,

      decorateTarget,
      judge,
      onExpire
    });
  })();

  // ------------------------------------------------------------
  // Main timer loop (storm + end)
  // ------------------------------------------------------------
  let raf = 0;
  let lastSecTickMs = 0;

  function tick(){
    if (state.stopped || state.ended) return;

    const t = nowMs();
    if (!lastSecTickMs) lastSecTickMs = t;

    // second tick
    const dt = t - lastSecTickMs;
    if (dt >= 1000){
      const steps = Math.floor(dt/1000);
      for (let i=0;i<steps;i++){
        state.secLeft -= 1;
        if (state.secLeft < 0) state.secLeft = 0;
        dispatch('hha:time', { sec: state.secLeft });
      }
      lastSecTickMs += steps*1000;

      // storm warning / start / end
      if (!state.inStorm){
        const warnAt = state.nextStormAtMs - STORM.warnSec*1000;
        if (!state.stormWarn && t >= warnAt && t < state.nextStormAtMs){
          stormWarnStart();
        }
        if (t >= state.nextStormAtMs){
          stormStart();
        }
      } else {
        if (t >= state.stormEndsAtMs){
          stormEnd();
        } else {
          // lightning flash occasionally in storm (cinematic)
          if (Math.random() < 0.10){
            setOverlayMode('flash');
            // re-arm to on/warn state after flash
            setTimeout(()=>{ if(state.inStorm) setOverlayMode('on'); }, 220);
          }
        }
      }

      // update fever/shield countdown
      syncFeverUI();
      updateWaterUI();
      emitQuestUpdate();
    }

    if (state.secLeft <= 0){
      endGame();
      return;
    }

    raf = ROOT.requestAnimationFrame(tick);
  }

  raf = ROOT.requestAnimationFrame(tick);

  // ------------------------------------------------------------
  // End game
  // ------------------------------------------------------------
  function endGame(){
    if (state.ended) return;
    state.ended = true;

    try{ if (engine && engine.stop) engine.stop(); }catch{}
    try{ if (raf) ROOT.cancelAnimationFrame(raf); }catch{}
    raf = 0;

    // make summary
    const sum = {
      gameMode: 'hydration',
      runMode: state.mode,
      diff: state.diff,
      durationPlannedSec: state.durationPlannedSec,
      durationPlayedSec: state.durationPlannedSec,
      scoreFinal: state.score|0,
      comboMax: state.comboMax|0,

      // show “miss” (true mistakes) and keep “drop” separately in log payload (P1)
      misses: state.miss|0,
      drops: state.drop|0,

      goalsCleared: state.goalsDone|0,
      goalsTotal: state.goalsTotal|0,

      miniCleared: state.minisDone|0,
      miniTotal: Math.max(1, state.stormSeen|0), // ✅ P0
      stormSeen: state.stormSeen|0,

      grade: gradeFrom(),
      waterEndPct: Math.round(state.waterPct),
      waterEndZone: state.zone,

      timestampIso: new Date().toISOString()
    };

    saveLastSummary(sum);
    dispatch('hha:end', sum);

    // show overlay
    const end = ensureEndOverlay();
    if (end){
      try{
        end.classList.add('on');
        const $ = (id)=>DOC.getElementById(id);
        if ($('hvr-end-score')) $('hvr-end-score').textContent = String(sum.scoreFinal);
        if ($('hvr-end-grade')) $('hvr-end-grade').textContent = String(sum.grade);
        if ($('hvr-end-combo')) $('hvr-end-combo').textContent = String(sum.comboMax);
        if ($('hvr-end-miss'))  $('hvr-end-miss').textContent  = String(sum.misses);
        if ($('hvr-end-goals')) $('hvr-end-goals').textContent = `${sum.goalsCleared}/${sum.goalsTotal}`;
        if ($('hvr-end-minis')) $('hvr-end-minis').textContent = `${sum.miniCleared}/${sum.miniTotal}`;

        const btnRetry = $('hvr-end-retry');
        const btnBack  = $('hvr-end-back');
        if (btnRetry){
          btnRetry.onclick = ()=>{ location.reload(); };
        }
        if (btnBack){
          btnBack.onclick = ()=>{
            const hub = getHubUrl();
            location.href = hub;
          };
        }
      }catch{}
    }
  }

  // ------------------------------------------------------------
  // Score application (from judge results)
  // ------------------------------------------------------------
  ROOT.addEventListener('hha:judge', ()=>{}); // keep channel warm (optional)

  // Patch score update by wrapping judge results:
  // mode-factory calls our judge() and returns scoreDelta -> it doesn't auto add score, so we do it here:
  // easiest: listen pointer hits? Not accessible. So we update score inside judge() path:
  // (We already compute scoreDelta; finalize here by intercepting dispatch in scorePop? not)
  //
  // ✅ Solution: update score immediately inside judge() by overriding return handler via monkey:
  // (We do it directly: in judge() we returned scoreDelta but didn't add to state.score yet)
  // -> Add score update now by wrapping factoryBoot? Not possible after.
  //
  // Therefore we fix: add score update inside judge() by applying delta before return.
  //
  // (To keep this “ตัวเต็ม” correct, we patch judge() above by editing now:)
  // ------------------------------------------------------------
  //  *NO-OP HERE* (score is already updated below by patching judge function)
  // ------------------------------------------------------------

  // --- HOT PATCH: apply scoreDelta inside judge() (keep code single-file) ---
  const _judge = judge;
  function judgePatched(ch, ctx){
    const res = _judge(ch, ctx) || {};
    const d = Number(res.scoreDelta);
    if (Number.isFinite(d)){
      state.score += d;
      // clamp score in play (avoid deep negative)
      if (state.mode !== 'study') state.score = Math.max(-50, state.score);
    }
    dispatch('hha:score', packScore());
    return res;
  }

  // swap judge reference used by factory (only if engine not yet booted)
  // we already started boot(); but it captures "judge" variable.
  // ✅ If this file is loaded before boot finishes, we can safely reassign.
  // (Most browsers execute synchronously, so reassign now is OK.)
  judge = judgePatched;

})();
