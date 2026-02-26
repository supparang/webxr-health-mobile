// === /herohealth/germ-detective/germ-detective.boot.js ===
// Germ Detective Boot — PRODUCTION (PC/Mobile/Cardboard VR) + Mission + AI + Graph + Intervention + Result + CSV Logger
// v20260225-PRO-ALLINONE (No Apps Script; CSV-ready local export)
// Requires:
//  - /herohealth/germ-detective/app.js (GameApp default export)
//  - optional /herohealth/vr/vr-ui.js (Universal VR UI)
//  - run page with panels/modal placeholders OR this boot can create missing pieces.
// Notes:
//  - This file is self-contained and safe-fallback oriented
//  - Supports run=play / run=research deterministic replay
//  - Supports view=pc/mobile/cvr/vr

import GameApp from './app.js';

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---------------------------------------------------------
  // BASIC HELPERS
  // ---------------------------------------------------------
  const $  = (s, el=DOC) => el.querySelector(s);
  const $$ = (s, el=DOC) => Array.from(el.querySelectorAll(s));

  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }
  function qs(k, def=null){
    try { return new URL(location.href).searchParams.get(k) ?? def; }
    catch { return def; }
  }
  function nowMs(){ return Date.now(); }
  function nowPerf(){ return (WIN.performance && performance.now) ? performance.now() : Date.now(); }
  function isoNow(){ return new Date().toISOString(); }
  function safeJson(v){ try{ return JSON.stringify(v ?? {});}catch(e){ return '{"error":"json"}'; } }
  function numOrNull(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
  function uid(p='id'){ return `${p}_${Math.random().toString(36).slice(2,8)}`; }

  // ---------------------------------------------------------
  // QUERY PARAMS / CONTEXT
  // ---------------------------------------------------------
  const P = {
    run:  String(qs('run','play') || 'play').toLowerCase(),             // play | research
    diff: String(qs('diff','normal') || 'normal').toLowerCase(),        // easy|normal|hard
    time: clamp(qs('time','80'), 20, 600),
    seed: String(qs('seed', String(Date.now())) || String(Date.now())),
    pid:  String(qs('pid','anon') || 'anon'),
    scene:String(qs('scene','classroom') || 'classroom').toLowerCase(), // classroom|home|canteen
    view: String(qs('view', DOC.documentElement?.dataset?.view || 'pc') || 'pc').toLowerCase(),
    hub:  String(qs('hub','/herohealth/hub.html') || '/herohealth/hub.html'),
    api:  String(qs('api','') || ''),
  };
  try { DOC.documentElement.dataset.view = P.view; } catch {}

  // ---------------------------------------------------------
  // GLOBAL STATE (GD)
  // ---------------------------------------------------------
  const GD = WIN.GD = {
    version: 'v20260225-PRO-ALLINONE',
    app: null,
    started: false,
    ended: false,
    endReason: null,

    trace: {
      toolUse: { uv:0, swab:0, cam:0 },
      targetVisits: {},       // target -> count
      uniqueTargets: new Set(),
      evidence: [],
      evidenceCount: 0,
      aiTips: [],
      challengeSuccess: 0,
      shotsHit: 0,
      shotsMiss: 0,
      pathSamples: []         // optional pointer trail for path entropy proxy
    },

    targetState: new Map(),   // target -> {uv,swab,cam,inspect,lastTs}
    ai: {
      riskScore: 72,
      nextBestAction: null,
      coachLastAt: 0,
      coachCooldownMs: 3500
    },

    mission: { current:null, progress:{}, completed:false, failed:false },

    budget: {
      initialized: false,
      points: 100,
      spent: 0,
      actions: [],
      cleanedTargets: new Set(),
      methods: {
        wipe:   { cost:12, label:'🧻 Wipe',    baseImpact:14 },
        spray:  { cost:18, label:'🧴 Spray',   baseImpact:20 },
        uvpass: { cost:22, label:'🔦 UV Pass', baseImpact:24 },
      }
    },

    phase: { mode: 'investigate' }, // investigate | intervene | report

    graph: {
      nodes: new Map(),
      edges: [],
      lastSeq: []
    },

    score: null,

    resultUI: { open:false, lastScore:null },

    logger: {
      sessionId:null,
      startedAt:null,
      endedAt:null,
      seq:0,
      enabled:true,
      buffers: { sessions:[], events:[], features1s:[] }
    }
  };

  // ---------------------------------------------------------
  // BOOT HELPERS (HHA-style compatibility)
  // ---------------------------------------------------------
  const GD_BOOT = WIN.GD_BOOT = {
    hubURL(){
      return P.hub || '/herohealth/hub.html';
    },
    saveLastSummary(payload={}){
      try{
        const KEY = 'HHA_LAST_SUMMARY';
        const prev = JSON.parse(localStorage.getItem(KEY) || '{}');
        const next = {
          game: 'germ-detective',
          at: isoNow(),
          pid: P.pid,
          run: P.run,
          diff: P.diff,
          scene: P.scene,
          view: P.view,
          seed: P.seed,
          ...payload
        };
        localStorage.setItem(KEY, JSON.stringify({ ...prev, germDetective: next }));
      }catch(e){}
    }
  };

  // ---------------------------------------------------------
  // TOAST (safe fallback)
  // ---------------------------------------------------------
  function gdToast(msg=''){
    let box = $('#gdToast');
    if(!box){
      box = DOC.createElement('div');
      box.id = 'gdToast';
      box.style.cssText = [
        'position:fixed','left:50%','bottom:16px','transform:translateX(-50%)',
        'z-index:9999','background:rgba(2,6,23,.85)','color:#e5e7eb',
        'border:1px solid rgba(148,163,184,.2)','border-radius:999px',
        'padding:8px 12px','font:700 12px/1.2 system-ui, sans-serif',
        'backdrop-filter: blur(8px)','display:none'
      ].join(';');
      DOC.body.appendChild(box);
    }
    box.textContent = String(msg || '');
    box.style.display = 'block';
    clearTimeout(box.__t);
    box.__t = setTimeout(()=>{ try{ box.style.display='none'; }catch{} }, 1200);
  }

  // ---------------------------------------------------------
  // RNG (DETERMINISTIC FOR RESEARCH MODE)
  // ---------------------------------------------------------
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      let t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = ((c << 21) | (c >>> 11));
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    };
  }
  function dayKey(){
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function buildResearchSeedBase(){
    return ['GD', P.pid || 'anon', P.scene || 'classroom', dayKey(), P.seed || ''].join('|');
  }
  let gdRandDet = null;
  let gdRandDetBase = '';
  function gdInitDeterministicRNG(){
    if(P.run !== 'research'){
      gdRandDet = null;
      gdRandDetBase = '';
      return;
    }
    gdRandDetBase = buildResearchSeedBase();
    const h = xmur3(gdRandDetBase);
    gdRandDet = sfc32(h(),h(),h(),h());
    WIN.__GD_RESEARCH_SEED_BASE__ = gdRandDetBase;
    WIN.__GD_RAND__ = gdRandDet;
    emitHhaEvent('research_rng_init', {
      seedBase: gdRandDetBase, pid:P.pid, scene:P.scene, dayKey: dayKey(), userSeed:P.seed
    });
  }
  function gdRand(){
    if(P.run === 'research' && typeof gdRandDet === 'function') return gdRandDet();
    return Math.random();
  }

  // ---------------------------------------------------------
  // EVENT BUS HELPERS
  // ---------------------------------------------------------
  function emitHhaEvent(name, payload={}){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:event', { detail:{ name, payload } }));
    }catch(e){}
  }
  function emitHhaEnd(reason='end', extra={}){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:end', { detail:{ reason, ...extra } }));
    }catch(e){}
  }

  // ---------------------------------------------------------
  // UI SHELL (auto-create if missing)
  // ---------------------------------------------------------
  function ensureBaseLayout(){
    if($('#gdShell')) return;

    const shell = DOC.createElement('div');
    shell.id = 'gdShell';
    shell.innerHTML = `
      <div id="gdTopBar" class="gd-topbar">
        <div class="left">
          <div class="pill" id="gdScenePill">scene: ${P.scene}</div>
          <div class="pill" id="gdRunPill">run: ${P.run}</div>
          <div class="pill" id="gdDiffPill">diff: ${P.diff}</div>
          <div class="pill" id="gdTimePill">time: ${P.time}</div>
          <div class="pill" id="gdRiskPill">risk: ${GD.ai.riskScore}</div>
          <div class="pill" id="gdAiNextPill">AI: -</div>
        </div>
        <div class="right">
          <button class="btn" id="gdPauseBtn" type="button">Pause</button>
          <button class="btn" id="gdSubmitBtn" type="button">ส่งรายงาน</button>
          <button class="btn" id="gdBackHubBtnTop" type="button">HUB</button>
        </div>
      </div>

      <div id="gdMainWrap" class="gd-mainwrap">
        <div id="gdGameStage" class="gd-stage"></div>

        <aside id="gdSidePanels" class="gd-side">
          <section class="gd-panel mission" id="gdMissionPanel">
            <div class="head"><strong>🎯 Case Mission</strong><small id="gdMissionScene">scene</small></div>
            <div class="body">
              <div id="gdMissionTitle" style="font-weight:900;margin-bottom:6px">-</div>
              <div id="gdMissionStory" class="mut" style="line-height:1.4">-</div>
            </div>
            <div class="section-title" style="margin-top:8px">Objectives</div>
            <div id="gdMissionObjectives" class="mission-list"></div>
            <div class="section-title" style="margin-top:8px">Mission Bonus</div>
            <div id="gdMissionBonus" class="mut">0 pts</div>
          </section>

          <section class="gd-panel" id="gdBudgetPanel">
            <div class="head"><strong>🧰 Resource Budget</strong><small id="gdPhasePill">investigate</small></div>
            <div class="body">
              <div class="budget-row">
                <div class="metric"><div class="mut">Budget Total</div><div id="gdBudgetTotal">100</div></div>
                <div class="metric"><div class="mut">Spent</div><div id="gdBudgetSpent">0</div></div>
                <div class="metric"><div class="mut">Left</div><div id="gdBudgetLeft">100</div></div>
              </div>
              <div class="budget-bar"><div id="gdBudgetBarFill"></div></div>
              <div class="mut" style="margin-top:8px">เลือกวิธีทำความสะอาด + จุดเป้าหมาย แล้วกด Apply (ช่วง Intervention)</div>
              <div class="form-mini" style="margin-top:8px">
                <select id="gdCleanMethod">
                  <option value="wipe">🧻 Wipe (12)</option>
                  <option value="spray">🧴 Spray (18)</option>
                  <option value="uvpass">🔦 UV Pass (22)</option>
                </select>
                <select id="gdCleanTarget"></select>
                <button class="btn" id="gdApplyCleanBtn" type="button">Apply</button>
              </div>
              <div class="actions" style="margin-top:8px;justify-content:flex-start">
                <button class="btn" id="gdToInvestigateBtn" type="button">Investigate</button>
                <button class="btn primary" id="gdToInterveneBtn" type="button">Intervention</button>
                <button class="btn good" id="gdToReportBtn" type="button">Report</button>
              </div>
            </div>
          </section>

          <section class="gd-panel" id="gdInterventionLogPanel">
            <div class="head"><strong>🧾 Intervention Log</strong><small id="gdInterventionSummary">0 actions</small></div>
            <div class="body"><div id="gdInterventionLog" class="mini-list"></div></div>
          </section>

          <section class="gd-panel" id="gdGraphPanel">
            <div class="head"><strong>🕸️ Transmission Graph</strong><small id="gdGraphStatus">0 nodes • 0 edges</small></div>
            <div class="body">
              <canvas id="gdGraphCanvas" width="320" height="220" aria-label="Transmission graph"></canvas>
              <div class="section-title" style="margin-top:8px">AI Explainable Overlay</div>
              <div id="gdGraphExplain" class="mini-list"></div>
              <div class="section-title" style="margin-top:8px">Inferred Chain</div>
              <div id="gdGraphChain" class="mut">-</div>
            </div>
          </section>

          <section class="gd-panel" id="gdEvidencePanel">
            <div class="head"><strong>🧪 หลักฐาน</strong><small id="gdEvidenceMeta">0 items</small></div>
            <div class="body"><div id="gdEvidenceList" class="mini-list"></div></div>
          </section>
        </aside>
      </div>
    `;
    DOC.body.appendChild(shell);

    ensureStyles();
  }

  function ensureStyles(){
    if($('#gdBootStyles')) return;
    const st = DOC.createElement('style');
    st.id = 'gdBootStyles';
    st.textContent = `
      :root{
        --bg:#050814; --panel:rgba(2,6,23,.74); --line:rgba(148,163,184,.16);
        --txt:#e5e7eb; --mut:#94a3b8; --good:#10b981; --cyan:#22d3ee; --warn:#f59e0b;
      }
      body{ background:var(--bg); color:var(--txt); margin:0; font-family:system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif; }
      .mut{ color:var(--mut); font-size:12px; }
      .gd-topbar{
        position:sticky; top:0; z-index:50;
        display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;
        padding:8px 10px; background:rgba(2,6,23,.82); border-bottom:1px solid var(--line); backdrop-filter: blur(8px);
      }
      .gd-topbar .left,.gd-topbar .right{ display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
      .pill{ border:1px solid var(--line); border-radius:999px; padding:4px 8px; background:rgba(255,255,255,.02); font-size:12px; font-weight:700; }
      .btn{
        appearance:none; border:1px solid var(--line); background:rgba(255,255,255,.03);
        color:var(--txt); border-radius:10px; padding:8px 10px; font-weight:800; cursor:pointer;
      }
      .btn.primary{ border-color:rgba(34,211,238,.25); background:rgba(34,211,238,.08); }
      .btn.good{ border-color:rgba(16,185,129,.25); background:rgba(16,185,129,.10); }
      .btn:disabled{ opacity:.5; cursor:not-allowed; }
      .gd-mainwrap{ display:grid; grid-template-columns: minmax(0,1fr) 360px; gap:10px; padding:10px; }
      .gd-stage{ position:relative; min-height:50vh; border:1px solid var(--line); border-radius:14px; background:rgba(255,255,255,.01); overflow:hidden; }
      .gd-side{ display:grid; gap:10px; align-content:start; }
      .gd-panel{ border:1px solid var(--line); border-radius:14px; background:var(--panel); overflow:hidden; }
      .gd-panel .head{
        display:flex; justify-content:space-between; align-items:center; gap:8px;
        padding:10px 12px; border-bottom:1px solid rgba(148,163,184,.10);
      }
      .gd-panel .body{ padding:10px; }
      .section-title{ font-size:11px; color:var(--mut); font-weight:800; text-transform:uppercase; letter-spacing:.04em; }

      .budget-row{ display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
      .budget-row .metric{ border:1px solid var(--line); border-radius:10px; padding:8px; background:rgba(255,255,255,.02); }
      .budget-row .metric>div:last-child{ font-weight:900; font-size:18px; margin-top:2px; }
      .budget-bar{ margin-top:8px; height:10px; border-radius:999px; overflow:hidden; background:rgba(148,163,184,.12); border:1px solid var(--line); }
      #gdBudgetBarFill{ height:100%; width:100%; background:linear-gradient(90deg, rgba(16,185,129,.9), rgba(34,211,238,.9)); }

      .form-mini{ display:grid; grid-template-columns:1fr 1fr auto; gap:8px; }
      .form-mini select{
        border-radius:10px; border:1px solid var(--line); background:rgba(255,255,255,.02);
        color:var(--txt); padding:8px 10px; min-width:0;
      }

      .actions{ display:flex; gap:8px; flex-wrap:wrap; }

      .mini-list{ display:grid; gap:6px; max-height:190px; overflow:auto; }
      .mini-item{
        border:1px solid rgba(148,163,184,.12); border-radius:10px; padding:8px;
        background:rgba(255,255,255,.02); font-size:12px; line-height:1.35;
      }

      .mission-list{ display:grid; gap:6px; }
      .mission-item{
        border:1px solid rgba(148,163,184,.14); border-radius:10px; background:rgba(255,255,255,.02);
        padding:8px 10px; display:grid; grid-template-columns:1fr auto; gap:8px; align-items:center;
      }
      .mission-item .label{ font-size:12px; line-height:1.35; }
      .mission-item .meta{ font-size:11px; color:var(--mut); text-align:right; }
      .mission-item.done{ border-color:rgba(16,185,129,.22); background:linear-gradient(180deg, rgba(16,185,129,.07), rgba(16,185,129,.03)); }
      .mission-item.done .meta{ color:rgba(16,185,129,.95); font-weight:800; }

      .phase-pill{ border:1px solid var(--line); border-radius:999px; padding:2px 8px; font-size:11px; font-weight:800; text-transform:uppercase; }
      .phase-investigate{ color:#eab308; }
      .phase-intervene{ color:#22d3ee; }
      .phase-report{ color:#10b981; }

      #gdGraphCanvas{
        width:100%; height:auto; display:block; border-radius:12px; border:1px solid var(--line);
        background:
          radial-gradient(circle at 20% 10%, rgba(34,211,238,.05), transparent 35%),
          radial-gradient(circle at 80% 20%, rgba(16,185,129,.05), transparent 40%),
          rgba(255,255,255,.01);
      }

      .gd-spot{
        position:absolute; padding:10px 12px; border-radius:12px; border:1px solid var(--line);
        background:rgba(255,255,255,.03); color:var(--txt); font-weight:800; cursor:pointer; user-select:none;
      }
      .gd-spot:hover{ transform: translateY(-1px); }
      .gd-spot.cleaned{ outline:2px solid rgba(16,185,129,.55); }
      .gd-spot.hot{ box-shadow: 0 0 0 2px rgba(244,63,94,.35); }

      .gd-toolbar{
        position:absolute; left:12px; top:12px; z-index:10; display:flex; gap:6px; flex-wrap:wrap;
        max-width:calc(100% - 24px);
      }
      .gd-timer{
        position:absolute; left:12px; top:58px; z-index:10; font-weight:900; font-size:13px;
        padding:6px 10px; border-radius:999px; border:1px solid var(--line); background:rgba(2,6,23,.70);
      }

      /* Result modal */
      .gd-modal[hidden]{ display:none !important; }
      .gd-modal{ position:fixed; inset:0; z-index:9998; }
      .gd-modal__backdrop{ position:absolute; inset:0; background:rgba(2,6,23,.72); backdrop-filter: blur(6px); }
      .gd-modal__card{
        position:relative; width:min(980px, calc(100vw - 20px)); max-height:calc(100vh - 20px);
        margin:10px auto; border-radius:16px; border:1px solid var(--line);
        background:rgba(2,6,23,.92); box-shadow: 0 30px 80px rgba(0,0,0,.45);
        overflow:hidden; display:grid; grid-template-rows:auto 1fr auto;
      }
      .gd-modal__head,.gd-modal__foot{
        padding:10px 12px; border-bottom:1px solid rgba(148,163,184,.10);
        display:flex; align-items:center; justify-content:space-between; gap:8px;
      }
      .gd-modal__foot{ border-bottom:none; border-top:1px solid rgba(148,163,184,.10); justify-content:flex-end; flex-wrap:wrap; }
      .gd-modal__body{ overflow:auto; padding:10px; display:grid; gap:10px; }
      .result-grid{ display:grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:8px; }
      .result-item{ border:1px solid rgba(148,163,184,.12); border-radius:10px; background:rgba(255,255,255,.02); padding:8px; }
      .result-item > div:last-child{ font-weight:900; margin-top:2px; }
      .badge-row{ display:flex; flex-wrap:wrap; gap:8px; }
      .gd-badge-pill{ border:1px solid rgba(148,163,184,.14); border-radius:999px; padding:6px 10px; background:rgba(255,255,255,.03); font-weight:800; font-size:12px; }
      .gd-badge-pill.rare{ border-color: rgba(250,204,21,.35); background: rgba(250,204,21,.08); }
      .gd-badge-pill.epic{ border-color: rgba(168,85,247,.35); background: rgba(168,85,247,.10); }

      @media (max-width: 980px){ .gd-mainwrap{ grid-template-columns:1fr; } .gd-side{ order:2; } .gd-stage{ order:1; min-height:42vh; } }
      @media (max-width: 680px){
        .form-mini{ grid-template-columns:1fr; }
        .result-grid{ grid-template-columns:1fr; }
        .gd-modal__card{ width:calc(100vw - 10px); margin:5px auto; max-height:calc(100vh - 10px); border-radius:12px; }
      }
    `;
    DOC.head.appendChild(st);
  }

  function ensureResultModal(){
    if($('#gdResultModal')) return;
    const wrap = DOC.createElement('div');
    wrap.innerHTML = `
      <div id="gdResultModal" class="gd-modal" hidden aria-hidden="true" role="dialog" aria-labelledby="gdResultTitle">
        <div class="gd-modal__backdrop" data-close="1"></div>
        <section class="gd-modal__card">
          <header class="gd-modal__head">
            <div>
              <h3 id="gdResultTitle" style="margin:0">🕵️‍♀️ สรุปผลคดี Germ Detective</h3>
              <div class="mut" id="gdResultSubline">-</div>
            </div>
            <button class="btn" id="gdResultCloseBtn" type="button">ปิด</button>
          </header>

          <div class="gd-modal__body">
            <section class="gd-panel">
              <div class="head"><strong>📊 คะแนนรวม</strong><small id="gdResultRank">-</small></div>
              <div class="body">
                <div class="result-grid" id="gdFinalScoreGrid">
                  <div class="result-item"><div class="mut">Total</div><div id="gdScoreTotal">-</div></div>
                  <div class="result-item"><div class="mut">Accuracy</div><div id="gdScoreAccuracy">-</div></div>
                  <div class="result-item"><div class="mut">Chain</div><div id="gdScoreChain">-</div></div>
                  <div class="result-item"><div class="mut">Speed</div><div id="gdScoreSpeed">-</div></div>
                  <div class="result-item"><div class="mut">Verification</div><div id="gdScoreVerify">-</div></div>
                  <div class="result-item"><div class="mut">Intervention</div><div id="gdScoreIntervention">-</div></div>
                  <div class="result-item" style="grid-column:1/-1"><div class="mut">Mission</div><div id="gdScoreMission">-</div></div>
                  <div class="result-item" style="grid-column:1/-1"><div class="mut">Graph Chain</div><div id="gdScoreGraphChain">-</div></div>
                  <div class="result-item" style="grid-column:1/-1"><div class="mut">Research Replay</div><div id="gdResearchReplayInfo">-</div></div>
                </div>
              </div>
            </section>

            <section class="gd-panel">
              <div class="head"><strong>🎯 Case & Mission Recap</strong><small id="gdResultMissionStatus">-</small></div>
              <div class="body">
                <div id="gdResultMissionTitle" style="font-weight:900;margin-bottom:4px">-</div>
                <div id="gdResultMissionStory" class="mut" style="line-height:1.4;margin-bottom:8px">-</div>
                <div id="gdResultMissionObjectives" class="mini-list"></div>
              </div>
            </section>

            <section class="gd-panel">
              <div class="head"><strong>🕸️ Transmission Analysis</strong><small id="gdResultGraphMeta">-</small></div>
              <div class="body">
                <div id="gdResultGraphChain" style="font-weight:900;margin-bottom:6px">-</div>
                <div class="mini-list" id="gdResultGraphReasons"></div>
              </div>
            </section>

            <section class="gd-panel">
              <div class="head"><strong>🧰 Intervention Recap</strong><small id="gdResultBudgetMeta">-</small></div>
              <div class="body">
                <div class="result-grid">
                  <div class="result-item"><div class="mut">Budget</div><div id="gdResultBudgetTotal">-</div></div>
                  <div class="result-item"><div class="mut">Spent</div><div id="gdResultBudgetSpent">-</div></div>
                  <div class="result-item"><div class="mut">Left</div><div id="gdResultBudgetLeft">-</div></div>
                  <div class="result-item"><div class="mut">Actions</div><div id="gdResultIntervActions">-</div></div>
                </div>
                <div class="mini-list" id="gdResultInterventionLog" style="margin-top:8px"></div>
              </div>
            </section>

            <section class="gd-panel">
              <div class="head"><strong>🤖 AI Coach Recap</strong><small id="gdResultAiMeta">-</small></div>
              <div class="body"><div class="mini-list" id="gdResultAiTips"></div></div>
            </section>

            <section class="gd-panel">
              <div class="head"><strong>🏅 Badges</strong><small id="gdResultBadgeMeta">-</small></div>
              <div class="body"><div id="gdResultBadges" class="badge-row"></div></div>
            </section>
          </div>

          <footer class="gd-modal__foot">
            <button class="btn" id="gdBtnExportSessionCsv" type="button">Export sessions.csv</button>
            <button class="btn" id="gdBtnExportEventsCsv" type="button">Export events.csv</button>
            <button class="btn" id="gdBtnExportFeatCsv" type="button">Export features_1s.csv</button>
            <button class="btn" id="gdBtnPlayAgain" type="button">เล่นอีกครั้ง</button>
            <button class="btn" id="gdBtnCopySummary" type="button">คัดลอกสรุป</button>
            <button class="btn good" id="gdBtnBackHub" type="button">กลับ HUB</button>
          </footer>
        </section>
      </div>
    `;
    DOC.body.appendChild(wrap.firstElementChild);
  }

  // ---------------------------------------------------------
  // CASE / HOTSPOTS
  // ---------------------------------------------------------
  const HOTSPOTS_BY_SCENE = {
    classroom: [
      { name:'ลูกบิด', x:8, y:20, tags:['high-contact','shared-touch'] },
      { name:'โต๊ะ', x:35, y:36, tags:['shared-touch'] },
      { name:'สวิตช์ไฟ', x:16, y:56, tags:['high-contact'] },
      { name:'ก๊อกน้ำ', x:72, y:22, tags:['high-contact','shared-touch'] },
      { name:'ราวจับ', x:74, y:58, tags:['high-contact','shared-touch'] },
    ],
    home: [
      { name:'รีโมต', x:14, y:28, tags:['high-contact','shared-touch'] },
      { name:'ลูกบิด', x:78, y:18, tags:['high-contact','shared-touch'] },
      { name:'โต๊ะกินข้าว', x:48, y:54, tags:['shared-touch'] },
      { name:'ก๊อกน้ำ', x:73, y:62, tags:['high-contact','shared-touch'] },
      { name:'มือถือ', x:30, y:18, tags:['high-contact','shared-touch'] },
      { name:'ฟองน้ำ', x:58, y:72, tags:['shared-touch'] },
    ],
    canteen: [
      { name:'ถาด', x:16, y:28, tags:['high-contact','shared-touch'] },
      { name:'ช้อน', x:34, y:20, tags:['high-contact','shared-touch'] },
      { name:'โต๊ะ', x:54, y:42, tags:['shared-touch'] },
      { name:'ก๊อกน้ำ', x:78, y:24, tags:['high-contact','shared-touch'] },
      { name:'ราวจับ', x:80, y:58, tags:['high-contact','shared-touch'] },
      { name:'เขียง', x:28, y:70, tags:['shared-touch'] }
    ]
  };

  const CASES = {
    classroom_sick3: {
      id:'classroom_sick3', scene:'classroom',
      title:'เคส: เด็กป่วยในห้องเรียน 3 คน',
      story:'มีนักเรียน 3 คนเริ่มไอและไม่สบายในช่วงบ่าย ต้องหาจุดเสี่ยงสัมผัสสูงและต่อ chain การแพร่ให้เร็วที่สุด',
      objectives:[
        { id:'scan_high_contact_2', type:'scan_targets', min:2, tags:['high-contact'], label:'สแกนจุดสัมผัสสูง ≥ 2 จุด' },
        { id:'verify_2_targets', type:'verify_targets', min:2, label:'ยืนยันหลักฐาน (≥2 เครื่องมือ) ≥ 2 จุด' },
        { id:'build_chain_3', type:'chain_len', min:3, label:'ต่อ chain การแพร่ ≥ 3 จุด' },
        { id:'submit_before_20pct', type:'submit_before_ratio', maxRatioLeft:0.20, invert:true, label:'ส่งรายงานก่อนเวลาเหลือน้อยกว่า 20%' }
      ],
      scoreBonus:{ allClear:12, eachObjective:4 },
      recommendedTargets:['ลูกบิด','โต๊ะ','ก๊อกน้ำ','สวิตช์ไฟ','ราวจับ']
    },
    home_coughing_family: {
      id:'home_coughing_family', scene:'home',
      title:'เคส: บ้านมีคนไอ',
      story:'สมาชิกในบ้านมีอาการไอ ต้องแยกจุดเสี่ยงร่วมใช้และตัดสินใจทำความสะอาดก่อน-หลังให้คุ้มทรัพยากร',
      objectives:[
        { id:'scan_common_touch_3', type:'scan_targets', min:3, tags:['shared-touch'], label:'สแกนจุดใช้ร่วมกัน ≥ 3 จุด' },
        { id:'photo_evidence_2', type:'photo_count', min:2, label:'ถ่ายภาพหลักฐาน ≥ 2' },
        { id:'verify_1_key', type:'verify_targets', min:1, label:'ยืนยันหลักฐานสำคัญ ≥ 1 จุด' },
        { id:'risk_below_45', type:'risk_below', max:45, label:'ลด riskScore ให้ต่ำกว่า 45' }
      ],
      scoreBonus:{ allClear:10, eachObjective:4 },
      recommendedTargets:['รีโมต','ลูกบิด','โต๊ะกินข้าว','ก๊อกน้ำ','มือถือ']
    },
    canteen_outbreak_alert: {
      id:'canteen_outbreak_alert', scene:'canteen',
      title:'เคส: สัญญาณเสี่ยงในโรงอาหาร',
      story:'มีการใช้งานร่วมสูงในช่วงพักกลางวัน ต้องรีบสำรวจจุดแพร่เชื้อและจัดลำดับแก้ไขภายใต้ Time Pressure',
      objectives:[
        { id:'scan_4_total', type:'scan_count', min:4, label:'สแกน hotspot รวม ≥ 4 ครั้ง' },
        { id:'survive_event', type:'challenge_success', min:1, label:'ผ่าน Mini Challenge สำเร็จ ≥ 1 ครั้ง' },
        { id:'coverage_70', type:'coverage_at_least', min:0.70, label:'Coverage ≥ 70%' },
        { id:'submit_with_chain', type:'chain_len', min:3, label:'ส่งรายงานพร้อม chain ≥ 3 จุด' }
      ],
      scoreBonus:{ allClear:14, eachObjective:3 },
      recommendedTargets:['ถาด','ช้อน','โต๊ะ','ก๊อกน้ำ','ราวจับ']
    }
  };

  // ---------------------------------------------------------
  // MISSION SYSTEM
  // ---------------------------------------------------------
  function pickMissionByScene(scene){
    const pool = Object.values(CASES).filter(c => c.scene === scene);
    if(!pool.length) return Object.values(CASES)[0];
    if(P.run === 'research'){
      const idx = Math.floor(gdRand() * pool.length);
      return pool[idx];
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function initMission(){
    GD.mission.current = pickMissionByScene(P.scene);
    GD.mission.progress = {};
    GD.mission.completed = false;
    GD.mission.failed = false;
    for(const o of GD.mission.current.objectives){
      GD.mission.progress[o.id] = { done:false, value:0, text:'' };
    }
    renderMissionUI();
    updateMissionProgress();
    emitHhaEvent('mission_start', {
      missionId:GD.mission.current.id, scene:GD.mission.current.scene, title:GD.mission.current.title
    });
  }

  function countScans(){ return GD.trace.toolUse.uv || 0; }
  function countPhotos(){ return GD.trace.toolUse.cam || 0; }
  function countVerifiedTargets(){
    let n = 0;
    for(const [,st] of GD.targetState.entries()){
      const kinds = [!!st.uv, !!st.swab, !!st.cam].filter(Boolean).length;
      if(kinds >= 2) n++;
    }
    return n;
  }
  function coverageScore(){
    const hs = currentHotspots();
    if(!hs.length) return 0;
    return clamp(GD.trace.uniqueTargets.size / hs.length, 0, 1);
  }

  function currentHotspots(){
    return HOTSPOTS_BY_SCENE[P.scene] || HOTSPOTS_BY_SCENE.classroom || [];
  }

  function countScannedTargetsByTag(tag){
    let n = 0;
    const hs = currentHotspots();
    const taggedNames = new Set(hs.filter(h => (h.tags||[]).includes(tag)).map(h => h.name));
    for(const [target, st] of GD.targetState.entries()){
      if(taggedNames.has(target) && (st.uv || 0) > 0) n++;
    }
    return n;
  }

  function missionCompletionStats(){
    const m = GD.mission.current;
    if(!m) return { done:0, total:0, allClear:false };
    let done = 0;
    for(const o of m.objectives){
      if(GD.mission.progress[o.id]?.done) done++;
    }
    const total = m.objectives.length;
    return { done, total, allClear: total>0 && done===total };
  }

  function computeMissionBonus(){
    const m = GD.mission.current;
    if(!m) return { points:0, done:0, total:0, allClear:false };
    const stat = missionCompletionStats();
    let points = stat.done * Number(m.scoreBonus?.eachObjective || 0);
    if(stat.allClear) points += Number(m.scoreBonus?.allClear || 0);
    return { points, ...stat };
  }

  function updateMissionProgress(){
    const m = GD.mission.current;
    if(!m || !GD.app) return;

    const s = GD.app.getState ? GD.app.getState() : null;
    const timeTotal = Number(s?.timeTotal || P.time || 1);
    const timeLeft = Number(s?.timeLeft ?? s?.timeLeft === 0 ? s.timeLeft : 0);
    const tRatio = timeTotal > 0 ? (timeLeft / timeTotal) : 1;

    const chainLen = topChainNames(4).length;
    const coverage = coverageScore();
    const verified = countVerifiedTargets();
    const scans = countScans();
    const photos = countPhotos();
    const riskScore = GD.ai.riskScore ?? 999;

    for(const o of m.objectives){
      const st = GD.mission.progress[o.id] || { done:false, value:0, text:'' };
      let done = false, value = 0, text = '';

      switch(o.type){
        case 'scan_targets': {
          const tag = o.tags?.[0];
          value = tag ? countScannedTargetsByTag(tag) : GD.trace.uniqueTargets.size;
          done = value >= (o.min || 1);
          text = `${value}/${o.min}`;
          break;
        }
        case 'verify_targets':
          value = verified; done = value >= (o.min || 1); text = `${value}/${o.min}`; break;
        case 'chain_len':
          value = chainLen; done = value >= (o.min || 1); text = `${value}/${o.min}`; break;
        case 'submit_before_ratio':
          value = Number(tRatio.toFixed(2));
          if(GD.ended || GD.phase.mode === 'report'){
            done = !!o.invert ? (tRatio > (o.maxRatioLeft ?? 0.2)) : (tRatio <= (o.maxRatioLeft ?? 0.2));
          }
          text = `timeLeft ${Math.round(tRatio*100)}%`;
          break;
        case 'photo_count':
          value = photos; done = value >= (o.min || 1); text = `${value}/${o.min}`; break;
        case 'risk_below':
          value = riskScore; done = value <= (o.max || 50); text = `${value} ≤ ${o.max}`; break;
        case 'scan_count':
          value = scans; done = value >= (o.min || 1); text = `${value}/${o.min}`; break;
        case 'challenge_success':
          value = GD.trace.challengeSuccess || 0; done = value >= (o.min || 1); text = `${value}/${o.min}`; break;
        case 'coverage_at_least':
          value = coverage; done = value >= (o.min || 0.7); text = `${Math.round(value*100)}% / ${Math.round((o.min||0.7)*100)}%`; break;
        default:
          value = 0; done = false; text = '-';
      }

      st.done = !!done;
      st.value = value;
      st.text = text;
      GD.mission.progress[o.id] = st;
    }
    renderMissionProgress();
  }

  function renderMissionUI(){
    const m = GD.mission.current;
    if(!m) return;
    const set = (sel, val)=>{ const e=$(sel); if(e) e.textContent = String(val ?? '-'); };
    set('#gdMissionScene', m.scene);
    set('#gdMissionTitle', m.title);
    set('#gdMissionStory', m.story);
    renderMissionProgress();
  }

  function renderMissionProgress(){
    const m = GD.mission.current;
    const host = $('#gdMissionObjectives');
    const bonusEl = $('#gdMissionBonus');
    if(!m || !host) return;

    host.innerHTML = '';
    for(const o of m.objectives){
      const st = GD.mission.progress[o.id] || { done:false, text:'-' };
      const item = DOC.createElement('div');
      item.className = 'mission-item' + (st.done ? ' done' : '');
      item.innerHTML = `<div class="label">${o.label}</div><div class="meta">${st.done ? '✅ สำเร็จ' : (st.text || '-')}</div>`;
      host.appendChild(item);
    }

    const mb = computeMissionBonus();
    if(bonusEl){
      bonusEl.textContent = `+${mb.points} pts (${mb.done}/${mb.total}${mb.allClear ? ' + all clear':''})`;
    }
  }

  // ---------------------------------------------------------
  // AI COACH (EXPLAINABLE HEURISTIC + DET SCHEDULE IN RESEARCH)
  // ---------------------------------------------------------
  GD.aiTipSchedule = { nextAt:0, initialized:false };

  function missionRecommendedOrder(){
    const names = currentHotspots().map(h=>h.name).filter(Boolean);
    if(!names.length) return [];
    const rec = GD.mission.current?.recommendedTargets || [];
    const scored = names.map(n=>{
      let s = 0.4;
      if(/ลูกบิด|ก๊อก|สวิตช์|ราว|รีโมต|มือถือ|ช้อน|ถาด/i.test(n)) s += 0.4;
      if(rec.some(k => n.includes(k))) s += 0.15;
      s += gdRand() * 0.05;
      return { n, s };
    }).sort((a,b)=> b.s-a.s);
    return scored.map(x=>x.n);
  }
  function emitRecommendedOrder(){
    const order = missionRecommendedOrder();
    WIN.__GD_RECOMMENDED_ORDER__ = order;
    emitHhaEvent('recommended_order', { order });
  }

  function maybeCoach(force=false){
    const t = nowPerf();
    if(!force && (t - GD.ai.coachLastAt) < GD.ai.coachCooldownMs) return;

    const hs = currentHotspots().map(h=>h.name);
    const scannedTargets = new Set([...GD.targetState.entries()].filter(([,st]) => (st.uv||0)>0).map(([n])=>n));
    const unscanned = hs.filter(n => !scannedTargets.has(n));
    const rec = WIN.__GD_RECOMMENDED_ORDER__ || [];
    const topRecUnscanned = rec.find(n => unscanned.includes(n));

    let title = 'AI Coach';
    let message = '';
    let nextBestAction = null;

    if(unscanned.length >= 2 && topRecUnscanned){
      title = 'ตรวจจุดสัมผัสสูงก่อน';
      message = `ลองตรวจ ${topRecUnscanned} เพราะเป็นจุดสัมผัสสูง/ใช้ร่วมกัน`;
      nextBestAction = `scan:${topRecUnscanned}`;
    } else if(countVerifiedTargets() < 2){
      const target = [...GD.targetState.keys()].find(n=>{
        const st = GD.targetState.get(n) || {};
        const kinds = [!!st.uv, !!st.swab, !!st.cam].filter(Boolean).length;
        return kinds === 1;
      });
      if(target){
        title = 'ยืนยันหลักฐานเพิ่ม';
        message = `ใช้เครื่องมืออีกชนิดกับ ${target} เพื่อยืนยันหลักฐาน`;
        nextBestAction = `verify:${target}`;
      }
    } else if(GD.phase.mode !== 'intervene' && (GD.trace.evidenceCount >= 3 || coverageScore() >= 0.5)){
      title = 'เข้าสู่ Intervention';
      message = 'มีหลักฐานพอสมควรแล้ว ลองเข้า Intervention เพื่อกด riskScore';
      nextBestAction = 'phase:intervene';
    } else if(GD.phase.mode === 'intervene' && gdBudgetLeft() > 0){
      const target = topChainNames(1)[0] || (WIN.__GD_RECOMMENDED_ORDER__ || [])[0];
      if(target){
        title = 'ลงมือแก้จุดคุ้มสุด';
        message = `ลองทำความสะอาด ${target} ก่อนเพื่อลดความเสี่ยงเร็ว`;
        nextBestAction = `clean:${target}`;
      }
    } else {
      title = 'สรุปรายงาน';
      message = 'ตรวจ chain แล้วส่งรายงานเพื่อปิดคดี';
      nextBestAction = 'report:submit';
    }

    if(!message) return;
    GD.ai.nextBestAction = nextBestAction;
    GD.ai.coachLastAt = t;
    GD.trace.aiTips.push({ at:isoNow(), title, message, nextBestAction });
    updateTopPills();
    emitHhaEvent('ai_tip', { title, message, nextBestAction });

    // lightweight visual hint
    gdToast(`🤖 ${message}`);
  }

  function scheduleNextCoachTip(){
    const base = (P.diff === 'hard') ? [5500,8500] : (P.diff === 'easy' ? [7500,11000] : [6500,9500]);
    const dt = base[0] + Math.floor(gdRand() * (base[1]-base[0]));
    GD.aiTipSchedule.nextAt = nowPerf() + dt;
    GD.aiTipSchedule.initialized = true;
  }

  function coachTick(){
    const s = GD.app?.getState?.();
    if(!s || !s.running) return;
    if(P.run === 'research'){
      if(!GD.aiTipSchedule.initialized) scheduleNextCoachTip();
      if(nowPerf() >= GD.aiTipSchedule.nextAt){
        maybeCoach(true);
        scheduleNextCoachTip();
      }
    } else {
      maybeCoach(false);
    }
  }

  // ---------------------------------------------------------
  // TRACE / TARGET STATE / EVIDENCE UI
  // ---------------------------------------------------------
  function ensureTargetState(name){
    if(!GD.targetState.has(name)){
      GD.targetState.set(name, { uv:0, swab:0, cam:0, inspect:0, lastTs:0 });
    }
    return GD.targetState.get(name);
  }

  function noteToolUse(tool){
    if(!tool || !GD.trace.toolUse[tool] && GD.trace.toolUse[tool] !== 0) return;
    GD.trace.toolUse[tool] += 1;
  }

  function noteTargetVisit(target){
    if(!target) return;
    GD.trace.targetVisits[target] = (GD.trace.targetVisits[target] || 0) + 1;
    GD.trace.uniqueTargets.add(target);
    graphNoteVisit(target);
  }

  function addEvidenceToUI(rec){
    const list = $('#gdEvidenceList');
    if(!list) return;
    const item = DOC.createElement('div');
    item.className = 'mini-item';
    item.innerHTML = `<div><strong>${String(rec.type||'-').toUpperCase()}</strong> • ${rec.target || '-'}</div>
      <div class="mut">${rec.info || ''}</div>`;
    list.prepend(item);

    const meta = $('#gdEvidenceMeta');
    if(meta) meta.textContent = `${GD.trace.evidenceCount} items`;
  }

  function attachCoreEventBridges(){
    // Core app emits hha:event and hha:labels already; enrich local trace
    WIN.addEventListener('hha:event', (ev)=>{
      const n = ev.detail?.name || '';
      const p = ev.detail?.payload || {};

      if(n === 'tool_change'){
        noteToolUse(String(p.tool || '').toLowerCase());
      }

      if(n === 'evidence_added'){
        GD.trace.evidence.push(p);
        GD.trace.evidenceCount = GD.trace.evidence.length;
        if(p.target){
          noteTargetVisit(p.target);
          const st = ensureTargetState(p.target);
          const type = String(p.type || '');
          if(type === 'hotspot') st.uv += 1;
          else if(type === 'sample') st.swab += 1;
          else if(type === 'photo') st.cam += 1;
          else st.inspect += 1;
          st.lastTs = nowMs();
        }
        addEvidenceToUI(p);
        updateRiskHeuristic();
        updateMissionProgress();
        refreshInterventionTargets();
        renderGraph();
        updateTopPills();
      }

      if(n === 'intervention_applied'){
        updateMissionProgress();
        renderGraph();
        updateTopPills();
      }

      if(n === 'phase_change'){
        updateMissionProgress();
      }

      if(n === 'ai_tip'){
        // no-op; already stored
      }
    }, false);

    // Hook hha:shoot from vr-ui for cVR/PC aim tap
    WIN.addEventListener('hha:shoot', (ev)=>{
      const d = ev.detail || {};
      const target = hitTestSpot(d.x, d.y, Number(d.lockPx || 28));
      if(target){
        GD.trace.shotsHit++;
        flashSpot(target.el);
        target.el.click(); // reuse normal hotspot click
        emitHhaEvent('shoot_hit', { target: target.name, source: d.source || 'tap', x:d.x, y:d.y });
      } else {
        GD.trace.shotsMiss++;
        emitHhaEvent('shoot_miss', { source: d.source || 'tap', x:d.x, y:d.y });
      }
    }, false);
  }

  function updateRiskHeuristic(){
    // simple explainable heuristic: less coverage + low verification + high contact untouched => high risk
    const cov = coverageScore();
    const verify = countVerifiedTargets();
    const uncleanedHigh = currentHotspots().filter(h =>
      (h.tags||[]).includes('high-contact') && !GD.budget.cleanedTargets.has(h.name)
    ).length;

    let risk = 85;
    risk -= cov * 28;
    risk -= Math.min(3, verify) * 8;
    risk -= Math.min(5, GD.budget.actions.length) * 5;
    risk += Math.min(4, uncleanedHigh) * 4;
    risk = clamp(Math.round(risk), 5, 99);

    GD.ai.riskScore = risk;
  }

  // ---------------------------------------------------------
  // INTERVENTION / BUDGET
  // ---------------------------------------------------------
  function gdBudgetLeft(){
    return Math.max(0, Number(GD.budget.points || 0) - Number(GD.budget.spent || 0));
  }

  function initBudgetByDifficulty(){
    const base = P.diff === 'easy' ? 120 : P.diff === 'hard' ? 85 : 100;
    GD.budget.points = base;
    GD.budget.spent = 0;
    GD.budget.actions = [];
    GD.budget.cleanedTargets = new Set();
    GD.budget.initialized = true;
    renderBudgetUI();
    renderInterventionLog();
  }

  function targetEvidenceStrength(target){
    const st = GD.targetState.get(target);
    if(!st) return 0;
    let s = 0;
    s += Math.min(2, st.uv || 0) * 0.35;
    s += Math.min(2, st.swab || 0) * 0.40;
    s += Math.min(2, st.cam || 0) * 0.25;
    s += Math.min(2, (GD.trace.targetVisits[target] || 0)/2) * 0.15;
    return Math.min(1.5, s);
  }

  function targetRiskWeight(target){
    const n = String(target || '');
    let w = 1.0;
    if(/ลูกบิด|ก๊อก|ราว|สวิตช์/i.test(n)) w += 0.45;
    if(/ช้อน|ถาด|โต๊ะกินข้าว|เขียง|โต๊ะ/i.test(n)) w += 0.35;
    if(/มือถือ|รีโมต/i.test(n)) w += 0.40;
    if(/ฟองน้ำ/i.test(n)) w += 0.30;
    return w;
  }

  function estimateCleanImpact(target, method){
    const m = GD.budget.methods[method];
    if(!m) return 0;
    const evidence = targetEvidenceStrength(target);
    const riskW = targetRiskWeight(target);
    const already = GD.budget.cleanedTargets.has(target) ? 0.55 : 1.0;
    const jitter = 0.92 + gdRand() * 0.18;
    const impact = m.baseImpact * (0.7 + evidence * 0.5) * riskW * already * jitter;
    return Math.round(Math.max(4, Math.min(45, impact)));
  }

  function applyIntervention(target, method){
    if(GD.phase.mode !== 'intervene') return { ok:false, reason:'wrong_phase' };
    const m = GD.budget.methods[method];
    if(!m) return { ok:false, reason:'bad_method' };

    if(gdBudgetLeft() < m.cost){
      gdToast('งบไม่พอสำหรับการกระทำนี้');
      emitHhaEvent('intervention_fail', { target, method, reason:'budget_insufficient', left:gdBudgetLeft(), cost:m.cost });
      return { ok:false, reason:'budget_insufficient' };
    }

    const impact = estimateCleanImpact(target, method);
    const riskBefore = GD.ai.riskScore;

    GD.budget.spent += m.cost;
    GD.budget.actions.push({ target, method, cost:m.cost, impactEst:impact, ts:isoNow() });
    GD.budget.cleanedTargets.add(target);

    GD.ai.riskScore = Math.max(0, Math.round((GD.ai.riskScore || 50) - impact * 0.55));

    // visual state
    const spot = $(`.gd-spot[data-name="${CSS.escape(target)}"]`);
    if(spot) spot.classList.add('cleaned');

    renderBudgetUI();
    renderInterventionLog();
    refreshInterventionTargets();
    updateMissionProgress();
    renderGraph();
    updateTopPills();

    emitHhaEvent('intervention_applied', {
      target, method, cost:m.cost, impactEst:impact,
      budgetLeft: gdBudgetLeft(),
      riskBefore, riskAfter: GD.ai.riskScore
    });
    return { ok:true };
  }

  function setPhase(mode){
    GD.phase.mode = mode;
    const p = $('#gdPhasePill');
    if(p){
      p.textContent = mode;
      p.className = 'phase-pill phase-' + mode;
    }
    DOC.body.dataset.gdPhase = mode;
    if(mode === 'intervene') refreshInterventionTargets();
    emitHhaEvent('phase_change', { mode });
  }

  function renderBudgetUI(){
    const total = Number(GD.budget.points || 0);
    const spent = Number(GD.budget.spent || 0);
    const left = gdBudgetLeft();

    const set = (sel, v)=>{ const e = $(sel); if(e) e.textContent = String(v); };
    set('#gdBudgetTotal', total);
    set('#gdBudgetSpent', spent);
    set('#gdBudgetLeft', left);

    const fill = $('#gdBudgetBarFill');
    if(fill){
      const usedPct = total > 0 ? clamp((spent/total)*100, 0, 100) : 0;
      fill.style.width = `${100 - usedPct}%`;
    }

    const applyBtn = $('#gdApplyCleanBtn');
    if(applyBtn){
      applyBtn.disabled = (GD.phase.mode !== 'intervene');
      applyBtn.title = (GD.phase.mode !== 'intervene') ? 'เข้าโหมด Intervention ก่อน' : '';
    }
  }

  function refreshInterventionTargets(){
    const sel = $('#gdCleanTarget');
    if(!sel) return;
    const names = currentHotspots().map(h=>h.name);
    const unique = Array.from(new Set(names));
    const ranked = unique.map(name=>{
      const priority = targetEvidenceStrength(name)*0.6 + targetRiskWeight(name)*0.4;
      return { name, priority };
    }).sort((a,b)=> b.priority-a.priority);

    const oldVal = sel.value;
    sel.innerHTML = '';
    ranked.forEach(r=>{
      const op = DOC.createElement('option');
      const isCleaned = GD.budget.cleanedTargets.has(r.name);
      op.value = r.name;
      op.textContent = `${isCleaned ? '✅ ' : ''}${r.name}`;
      sel.appendChild(op);
    });
    if(oldVal && ranked.some(r=>r.name===oldVal)) sel.value = oldVal;
  }

  function renderInterventionLog(){
    const host = $('#gdInterventionLog');
    const sumEl = $('#gdInterventionSummary');
    if(!host) return;
    host.innerHTML = '';
    const arr = GD.budget.actions.slice().reverse();
    arr.forEach(a=>{
      const item = DOC.createElement('div');
      item.className = 'mini-item';
      item.innerHTML = `
        <div><strong>${a.target}</strong> • ${GD.budget.methods[a.method]?.label || a.method}</div>
        <div class="mut">cost ${a.cost} • estImpact ${a.impactEst} • ${new Date(a.ts).toLocaleTimeString()}</div>
      `;
      host.appendChild(item);
    });
    if(sumEl) sumEl.textContent = `${GD.budget.actions.length} actions • budget left ${gdBudgetLeft()}`;
  }

  function wireInterventionUI(){
    $('#gdApplyCleanBtn')?.addEventListener('click', ()=>{
      const target = $('#gdCleanTarget')?.value;
      const method = $('#gdCleanMethod')?.value || 'wipe';
      if(!target) return;
      const res = applyIntervention(target, method);
      if(res.ok){
        gdToast(`ลดความเสี่ยงที่ ${target}`);
      }
    });
    $('#gdToInvestigateBtn')?.addEventListener('click', ()=> setPhase('investigate'));
    $('#gdToInterveneBtn')?.addEventListener('click', ()=> setPhase('intervene'));
    $('#gdToReportBtn')?.addEventListener('click', ()=> setPhase('report'));
  }

  // ---------------------------------------------------------
  // TRANSMISSION GRAPH
  // ---------------------------------------------------------
  function graphReset(){
    GD.graph.nodes = new Map();
    GD.graph.edges = [];
    GD.graph.lastSeq = [];
  }

  function graphEnsureNode(name){
    if(!GD.graph.nodes.has(name)){
      GD.graph.nodes.set(name, { name, visits:0, evidenceScore:0, riskWeight:targetRiskWeight(name), cleaned:false });
    }
    return GD.graph.nodes.get(name);
  }

  function graphNoteVisit(target){
    if(!target) return;
    const n = graphEnsureNode(target);
    n.visits += 1;
    n.evidenceScore = targetEvidenceStrength(target);
    n.cleaned = GD.budget.cleanedTargets.has(target);
    GD.graph.lastSeq.push({ target, t: nowPerf() });
    if(GD.graph.lastSeq.length > 24) GD.graph.lastSeq.shift();
    graphRebuildEdges();
  }

  function graphEdgeKey(a,b){ return [a,b].sort().join('||'); }

  function graphRebuildEdges(){
    const edgeMap = new Map();
    const recent = GD.graph.lastSeq;

    for(let i=1;i<recent.length;i++){
      const prev = recent[i-1], cur = recent[i];
      if(!prev || !cur || prev.target === cur.target) continue;
      const dt = Math.max(1, cur.t - prev.t);
      const closeness = 1 / Math.min(5, dt / 1500);
      const a = prev.target, b = cur.target;
      const key = graphEdgeKey(a,b);
      if(!edgeMap.has(key)) edgeMap.set(key, { a,b,w:0,reasons:new Set(['sequence']) });
      edgeMap.get(key).w += 0.35 * closeness;
    }

    const names = Array.from(GD.graph.nodes.keys());
    for(let i=0;i<names.length;i++){
      for(let j=i+1;j<names.length;j++){
        const a = GD.graph.nodes.get(names[i]);
        const b = GD.graph.nodes.get(names[j]);
        if(!a || !b) continue;
        const sharedHigh = (a.riskWeight >= 1.3 && b.riskWeight >= 1.3);
        const bothEvidence = (a.evidenceScore >= 0.5 && b.evidenceScore >= 0.5);
        if(!sharedHigh && !bothEvidence) continue;

        const key = graphEdgeKey(a.name, b.name);
        if(!edgeMap.has(key)) edgeMap.set(key, { a:a.name, b:b.name, w:0, reasons:new Set() });
        const e = edgeMap.get(key);
        if(sharedHigh){ e.w += 0.28; e.reasons.add('high-touch'); }
        if(bothEvidence){ e.w += 0.34; e.reasons.add('multi-evidence'); }
      }
    }

    GD.graph.edges = Array.from(edgeMap.values())
      .map(e=> ({ a:e.a, b:e.b, w:Number(Math.min(0.99,e.w).toFixed(3)), reasons:Array.from(e.reasons) }))
      .filter(e => e.w >= 0.15)
      .sort((x,y)=> y.w-x.w)
      .slice(0,12);
  }

  function graphTopChainApprox(){
    const nodes = Array.from(GD.graph.nodes.values());
    if(!nodes.length) return [];
    const degree = new Map(nodes.map(n=> [n.name,0]));
    for(const e of GD.graph.edges){
      degree.set(e.a, (degree.get(e.a)||0)+e.w);
      degree.set(e.b, (degree.get(e.b)||0)+e.w);
    }
    nodes.sort((a,b)=>(degree.get(b.name)||0)-(degree.get(a.name)||0));
    let start = nodes[0]?.name;
    if(!start) return [];
    const chain = [start];
    const used = new Set(chain);
    for(let step=0; step<3; step++){
      const cur = chain[chain.length-1];
      const cands = GD.graph.edges
        .filter(e => e.a===cur || e.b===cur)
        .map(e => ({ next:e.a===cur ? e.b : e.a, w:e.w }))
        .filter(x => !used.has(x.next))
        .sort((a,b)=> b.w-a.w);
      if(!cands.length) break;
      chain.push(cands[0].next);
      used.add(cands[0].next);
    }
    return chain;
  }

  function topChainNames(n=3){
    const chain = graphTopChainApprox();
    if(chain.length) return chain.slice(0,n);
    return Object.entries(GD.trace.targetVisits)
      .sort((a,b)=> b[1]-a[1])
      .slice(0,n)
      .map(([name])=>name);
  }

  function renderGraph(){
    const canvas = $('#gdGraphCanvas');
    const statusEl = $('#gdGraphStatus');
    const explainEl = $('#gdGraphExplain');
    const chainEl = $('#gdGraphChain');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);

    const nodes = Array.from(GD.graph.nodes.values());
    const edges = GD.graph.edges;
    if(statusEl) statusEl.textContent = `${nodes.length} nodes • ${edges.length} edges`;

    if(!nodes.length){
      ctx.fillStyle = 'rgba(148,163,184,.85)';
      ctx.font = '12px system-ui';
      ctx.fillText('ยังไม่มีข้อมูลพอสำหรับสร้าง graph', 14, 22);
      if(explainEl) explainEl.innerHTML = '';
      if(chainEl) chainEl.textContent = '-';
      return;
    }

    const sorted = nodes.slice().sort((a,b)=> a.name.localeCompare(b.name, 'th'));
    const cx = W/2, cy = H/2;
    const R = Math.min(W,H)*0.34;
    const pos = new Map();

    sorted.forEach((n,i)=>{
      const ang = (-Math.PI/2) + (i / Math.max(1, sorted.length)) * Math.PI * 2;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * (R*0.78);
      pos.set(n.name, {x,y});
    });

    edges.forEach(e=>{
      const a = pos.get(e.a), b = pos.get(e.b);
      if(!a || !b) return;
      const alpha = clamp(e.w, 0.15, 0.9);
      ctx.strokeStyle = `rgba(34,211,238,${alpha})`;
      ctx.lineWidth = 1 + e.w * 3.5;
      ctx.beginPath();
      ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
      ctx.fillStyle = 'rgba(148,163,184,.85)';
      ctx.font = '10px system-ui';
      ctx.fillText(String(Math.round(e.w*100)), mx+4, my-2);
    });

    sorted.forEach(n=>{
      const p = pos.get(n.name);
      const isCleaned = GD.budget.cleanedTargets.has(n.name);
      const r = 8 + Math.min(10, n.visits * 1.2);
      const risk = Math.max(0.8, n.riskWeight);
      const ev = Math.max(0, Math.min(1.2, n.evidenceScore));
      const alpha = Math.max(0.35, Math.min(0.95, 0.35 + ev*0.35));

      ctx.beginPath();
      ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fillStyle = isCleaned ? `rgba(16,185,129,${0.45 + ev*0.2})` : `rgba(244,63,94,${alpha})`;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isCleaned ? 'rgba(16,185,129,.95)' : `rgba(255,255,255,${Math.min(0.9, 0.35 + risk*0.25)})`;
      ctx.stroke();

      ctx.fillStyle = 'rgba(241,245,249,.95)';
      ctx.font = '11px system-ui';
      ctx.fillText(n.name, p.x + r + 4, p.y + 3);
    });

    if(explainEl){
      explainEl.innerHTML = '';
      const ranked = sorted.map(n=>{
        const score = n.riskWeight*0.45 + n.evidenceScore*0.35 + Math.min(1.2, n.visits/3)*0.20;
        return { ...n, explainScore:score };
      }).sort((a,b)=> b.explainScore-a.explainScore).slice(0,3);

      ranked.forEach(n=>{
        const reasons = [];
        if(n.riskWeight >= 1.3) reasons.push('จุดสัมผัสสูง');
        if(n.evidenceScore >= 0.5) reasons.push('หลักฐานหลายแบบ');
        if(n.visits >= 2) reasons.push('พบในลำดับซ้ำ');

        const item = DOC.createElement('div');
        item.className = 'mini-item';
        item.innerHTML = `<div><strong>${n.name}</strong> ${GD.budget.cleanedTargets.has(n.name) ? '✅' : '⚠️'}</div>
          <div class="mut">เหตุผล: ${reasons.join(', ') || 'ข้อมูลยังน้อย'} • score ${n.explainScore.toFixed(2)}</div>`;
        explainEl.appendChild(item);
      });
    }

    const chain = graphTopChainApprox();
    if(chainEl) chainEl.textContent = chain.length ? chain.join(' → ') : '-';
  }

  // ---------------------------------------------------------
  // SCORE
  // ---------------------------------------------------------
  function computeInterventionSubscore(){
    const actions = GD.budget.actions || [];
    if(!actions.length){
      return { strategy:20, efficiency:20, totalImpactEst:0, actionCount:0, uniqueCleaned:0, costPerImpact:null };
    }
    const totalCost = actions.reduce((s,a)=> s + (Number(a.cost)||0), 0);
    const totalImpact = actions.reduce((s,a)=> s + (Number(a.impactEst)||0), 0);
    const uniqueCleaned = new Set(actions.map(a=>a.target)).size;
    const costPerImpact = totalImpact > 0 ? (totalCost / totalImpact) : 999;

    let evidenceAligned = 0;
    for(const a of actions){
      if(targetEvidenceStrength(a.target) >= 0.45) evidenceAligned++;
    }

    const strategy = Math.round(clamp((
      (Math.min(1, uniqueCleaned/3) * 0.35) +
      (Math.min(1, evidenceAligned / Math.max(1,actions.length)) * 0.45) +
      (Math.min(1, (GD.budget.points - gdBudgetLeft()) / Math.max(1,GD.budget.points)) * 0.20)
    ) * 100, 0, 100));

    let efficiencyNorm = 1 - Math.min(1, (costPerImpact - 0.4) / 1.6);
    if(!Number.isFinite(efficiencyNorm)) efficiencyNorm = 0;
    const efficiency = Math.round(clamp(efficiencyNorm * 100, 0, 100));

    return {
      strategy, efficiency,
      totalImpactEst:Math.round(totalImpact),
      actionCount:actions.length,
      uniqueCleaned,
      costPerImpact: Number.isFinite(costPerImpact) ? Number(costPerImpact.toFixed(3)) : null
    };
  }

  function computeFinalScore(){
    const appState = GD.app?.getState?.() || {};
    const timeLeft = Number(appState.timeLeft ?? 0);
    const timeTotal = Number(appState.timeTotal || P.time || 1);

    const cov = coverageScore(); // 0..1
    const verified = countVerifiedTargets();
    const chain = graphTopChainApprox();
    const chainLen = chain.length;

    const accuracyScore = Math.round(clamp((cov*0.55 + Math.min(1, verified/3)*0.45) * 100, 0, 100));
    const chainScore = Math.round(clamp(((chainLen>=4?1:chainLen/4)*0.7 + Math.min(1,(GD.graph.edges.length||0)/6)*0.3) * 100, 0, 100));
    const resourceScore = Math.round(clamp((1 - (gdBudgetLeft()/Math.max(1,GD.budget.points))) * 100, 0, 100)); // usage, not efficiency
    const speedScore = Math.round(clamp((timeLeft / Math.max(1,timeTotal)) * 100, 0, 100));
    const verificationScore = Math.round(clamp((Math.min(1, verified/3) * 0.6 + Math.min(1,(GD.trace.evidenceCount||0)/6)*0.4) * 100, 0, 100));

    const intervention = computeInterventionSubscore();
    const interventionScore = Math.round(intervention.strategy * 0.55 + intervention.efficiency * 0.45);

    let total = (
      accuracyScore * 0.24 +
      chainScore * 0.20 +
      resourceScore * 0.14 +
      speedScore * 0.12 +
      verificationScore * 0.15 +
      interventionScore * 0.15
    );

    const missionBonus = computeMissionBonus();
    total += Number(missionBonus.points || 0);
    total = clamp(Math.round(total), 0, 100);

    const rank = total>=90?'S': total>=80?'A': total>=70?'B': total>=60?'C':'D';

    return {
      final: total,
      rank,
      accuracy: { score: accuracyScore, coverage: Number(cov.toFixed(3)), verifiedTargets: verified },
      chain: { score: chainScore, inferredChain: chain, edgeCount: GD.graph.edges.length },
      speed: { score: speedScore, timeLeft, timeTotal },
      verification: { score: verificationScore, evidenceCount: GD.trace.evidenceCount, verifiedTargets: verified },
      resource: { score: resourceScore, budgetUsed: GD.budget.spent, budgetTotal: GD.budget.points },
      intervention: {
        score: interventionScore,
        strategy: intervention.strategy,
        efficiency: intervention.efficiency,
        totalImpactEst: intervention.totalImpactEst,
        actionCount: intervention.actionCount,
        uniqueCleaned: intervention.uniqueCleaned,
        costPerImpact: intervention.costPerImpact,
        budgetTotal: GD.budget.points,
        budgetSpent: GD.budget.spent,
        budgetLeft: gdBudgetLeft()
      },
      mission: {
        id: GD.mission.current?.id || null,
        title: GD.mission.current?.title || null,
        bonusPoints: Number(missionBonus.points || 0),
        completedObjectives: missionBonus.done || 0,
        totalObjectives: missionBonus.total || 0,
        allClear: !!missionBonus.allClear
      },
      graph: {
        inferredChain: chain,
        nodeCount: Array.from(GD.graph.nodes.values()).length,
        edgeCount: GD.graph.edges.length
      }
    };
  }

  // ---------------------------------------------------------
  // RESULT MODAL
  // ---------------------------------------------------------
  function openResultModal(){
    const m = $('#gdResultModal');
    if(!m) return;
    m.hidden = false;
    m.setAttribute('aria-hidden','false');
    GD.resultUI.open = true;
    DOC.body.style.overflow = 'hidden';
  }
  function closeResultModal(){
    const m = $('#gdResultModal');
    if(!m) return;
    m.hidden = true;
    m.setAttribute('aria-hidden','true');
    GD.resultUI.open = false;
    DOC.body.style.overflow = '';
  }

  function getAICoachTipsRecent(limit=8){
    return (GD.trace.aiTips || []).slice(-limit).reverse();
  }

  function computeBadges(score){
    const badges = [];
    const total = Number(score?.final || 0);
    const chain = score?.graph?.inferredChain || [];
    const mission = score?.mission || {};
    const interv = score?.intervention || {};

    if(total >= 85) badges.push({ key:'super_sleuth', label:'🕵️ Super Sleuth', tier:'epic' });
    if(mission.allClear) badges.push({ key:'mission_all_clear', label:'🎯 Mission All Clear', tier:'rare' });
    if((interv.efficiency || 0) >= 75) badges.push({ key:'budget_master', label:'🧰 Budget Master', tier:'rare' });
    if((interv.strategy || 0) >= 75) badges.push({ key:'smart_cleaner', label:'🧠 Smart Cleaner', tier:'' });
    if((chain.length || 0) >= 3) badges.push({ key:'chain_builder', label:'🕸️ Chain Builder', tier:'' });
    if((GD.ai.riskScore || 999) <= 35) badges.push({ key:'risk_crusher', label:'📉 Risk Crusher', tier:'' });
    if((GD.trace.toolUse.uv||0)>=3 && (GD.trace.toolUse.swab||0)>=2 && (GD.trace.toolUse.cam||0)>=2){
      badges.push({ key:'forensic_combo', label:'🔬 Forensic Combo', tier:'rare' });
    }
    if(P.run === 'research') badges.push({ key:'research_run', label:'🧪 Research Replay', tier:'' });
    return badges;
  }

  function saveBadgesToHHA(badges){
    try{
      const key='HHA_BADGES_V1';
      const cur = JSON.parse(localStorage.getItem(key) || '{}');
      const list = Array.isArray(cur.germDetective) ? cur.germDetective : [];
      const map = new Map(list.map(x=>[x.key,x]));
      badges.forEach(b=> map.set(b.key, { ...b, at: isoNow() }));
      cur.germDetective = Array.from(map.values());
      localStorage.setItem(key, JSON.stringify(cur));
    }catch(e){}
  }

  function renderResultModal(score){
    GD.resultUI.lastScore = score || null;
    const s = score || {};
    const graphChain = s.graph?.inferredChain || graphTopChainApprox();
    const graphEdges = GD.graph.edges || [];
    const graphNodes = Array.from(GD.graph.nodes.values() || []);
    const aiTips = getAICoachTipsRecent(8);
    const badges = computeBadges(s);

    const set = (sel, val)=>{ const e=$(sel); if(e) e.textContent = (val == null ? '-' : String(val)); };

    set('#gdResultSubline', `${P.scene} • ${P.diff} • ${P.run} • pid=${P.pid} • seed=${P.seed}`);
    set('#gdResultRank', `Rank ${s.rank || '-'}`);

    set('#gdScoreTotal', s.final ?? '-');
    set('#gdScoreAccuracy', s.accuracy?.score ?? '-');
    set('#gdScoreChain', s.chain?.score ?? '-');
    set('#gdScoreSpeed', s.speed?.score ?? '-');
    set('#gdScoreVerify', s.verification?.score ?? '-');
    set('#gdScoreIntervention', s.intervention ? `${s.intervention.score} (S:${s.intervention.strategy}/E:${s.intervention.efficiency})` : '-');
    set('#gdScoreMission', s.mission ? `${s.mission.completedObjectives}/${s.mission.totalObjectives} • bonus +${s.mission.bonusPoints}${s.mission.allClear?' • ALL CLEAR':''}` : '-');
    set('#gdScoreGraphChain', graphChain.length ? graphChain.join(' → ') : '-');
    set('#gdResearchReplayInfo', P.run === 'research'
      ? `deterministic ✅ • ${WIN.__GD_RESEARCH_SEED_BASE__ || '-'}`
      : 'play mode (non-deterministic)');

    set('#gdResultMissionStatus', s.mission ? `${s.mission.completedObjectives}/${s.mission.totalObjectives}` : '-');
    set('#gdResultMissionTitle', GD.mission.current?.title || '-');
    set('#gdResultMissionStory', GD.mission.current?.story || '-');

    const missionList = $('#gdResultMissionObjectives');
    if(missionList){
      missionList.innerHTML = '';
      (GD.mission.current?.objectives || []).forEach(o=>{
        const st = GD.mission.progress[o.id];
        const item = DOC.createElement('div');
        item.className = 'mini-item';
        item.innerHTML = `<div>${st?.done ? '✅' : '⬜'} <strong>${o.label}</strong></div><div class="mut">${st?.text || '-'}</div>`;
        missionList.appendChild(item);
      });
    }

    set('#gdResultGraphMeta', `${graphNodes.length} nodes • ${graphEdges.length} edges`);
    set('#gdResultGraphChain', graphChain.length ? `Inferred chain: ${graphChain.join(' → ')}` : 'Inferred chain: -');

    const graphReasons = $('#gdResultGraphReasons');
    if(graphReasons){
      graphReasons.innerHTML = '';
      graphEdges.slice(0,6).forEach(e=>{
        const item = DOC.createElement('div');
        item.className = 'mini-item';
        item.innerHTML = `<div><strong>${e.a}</strong> ↔ <strong>${e.b}</strong> • weight ${Math.round(e.w*100)}</div>
          <div class="mut">เหตุผล: ${(e.reasons||[]).join(', ') || 'sequence'}</div>`;
        graphReasons.appendChild(item);
      });
      if(!graphEdges.length){
        const item = DOC.createElement('div'); item.className='mini-item'; item.textContent='ยังมีข้อมูล graph ไม่พอ';
        graphReasons.appendChild(item);
      }
    }

    set('#gdResultBudgetMeta', `riskScore=${GD.ai.riskScore} • actions=${GD.budget.actions.length}`);
    set('#gdResultBudgetTotal', GD.budget.points);
    set('#gdResultBudgetSpent', GD.budget.spent);
    set('#gdResultBudgetLeft', gdBudgetLeft());
    set('#gdResultIntervActions', GD.budget.actions.length);

    const intLog = $('#gdResultInterventionLog');
    if(intLog){
      intLog.innerHTML = '';
      GD.budget.actions.slice().reverse().forEach(a=>{
        const item = DOC.createElement('div');
        item.className = 'mini-item';
        item.innerHTML = `<div><strong>${a.target}</strong> • ${GD.budget.methods[a.method]?.label || a.method}</div>
          <div class="mut">cost ${a.cost} • estImpact ${a.impactEst}</div>`;
        intLog.appendChild(item);
      });
      if(!GD.budget.actions.length){
        const item = DOC.createElement('div'); item.className='mini-item'; item.textContent='ยังไม่มี intervention action';
        intLog.appendChild(item);
      }
    }

    set('#gdResultAiMeta', `${aiTips.length} tips`);
    const aiBox = $('#gdResultAiTips');
    if(aiBox){
      aiBox.innerHTML = '';
      aiTips.forEach(t=>{
        const item = DOC.createElement('div');
        item.className = 'mini-item';
        item.innerHTML = `<div><strong>${t.title || 'AI Coach'}</strong></div><div class="mut">${t.message || '-'}</div>`;
        aiBox.appendChild(item);
      });
      if(!aiTips.length){
        const item = DOC.createElement('div'); item.className='mini-item'; item.textContent='ยังไม่มี AI tip ที่บันทึกไว้';
        aiBox.appendChild(item);
      }
    }

    set('#gdResultBadgeMeta', `${badges.length} badges`);
    const badgeBox = $('#gdResultBadges');
    if(badgeBox){
      badgeBox.innerHTML = '';
      badges.forEach(b=>{
        const pill = DOC.createElement('div');
        pill.className = `gd-badge-pill ${b.tier||''}`.trim();
        pill.textContent = b.label;
        badgeBox.appendChild(pill);
      });
      if(!badges.length){
        const pill = DOC.createElement('div'); pill.className='gd-badge-pill'; pill.textContent='ยังไม่มี badge รอบนี้';
        badgeBox.appendChild(pill);
      }
    }

    saveBadgesToHHA(badges);
    GD_BOOT.saveLastSummary({
      reason:'result_modal',
      score:s.final ?? null,
      rank:s.rank ?? null,
      mission:s.mission || null,
      graphChain,
      riskScore:GD.ai.riskScore ?? null,
      intervention:s.intervention || null,
      badges
    });

    // append log counts
    const sub = $('#gdResultSubline');
    if(sub && GD.logger){
      const c = GD.logger.buffers;
      if(!String(sub.textContent).includes('logs:')){
        sub.textContent += ` • logs: S${c.sessions.length}/E${c.events.length}/F${c.features1s.length}`;
      }
    }

    openResultModal();
  }

  function buildPlaintextSummaryForCopy(){
    const s = GD.resultUI.lastScore || GD.score || {};
    const chain = s.graph?.inferredChain || graphTopChainApprox();
    return [
      `Germ Detective Summary`,
      `Scene: ${P.scene} | Diff: ${P.diff} | Run: ${P.run} | PID: ${P.pid}`,
      `Seed: ${P.seed}`,
      `Score: ${s.final ?? '-'} | Rank: ${s.rank ?? '-'}`,
      `Mission: ${s.mission ? `${s.mission.completedObjectives}/${s.mission.totalObjectives} (+${s.mission.bonusPoints})` : '-'}`,
      `Graph Chain: ${chain.length ? chain.join(' -> ') : '-'}`,
      `Intervention: ${s.intervention ? `score ${s.intervention.score}, budget ${s.intervention.budgetSpent}/${s.intervention.budgetTotal}` : '-'}`,
      `RiskScore End: ${GD.ai.riskScore ?? '-'}`,
      (P.run === 'research') ? `Deterministic: ${WIN.__GD_RESEARCH_SEED_BASE__ || '-'}` : `Deterministic: no`,
      `Time: ${isoNow()}`
    ].join('\n');
  }

  function wireResultModalUI(){
    const root = $('#gdResultModal');
    if(!root) return;

    root.addEventListener('click', (ev)=>{
      const t = ev.target;
      if(t?.dataset?.close === '1') closeResultModal();
    });
    $('#gdResultCloseBtn')?.addEventListener('click', closeResultModal);

    $('#gdBtnBackHub')?.addEventListener('click', ()=>{
      GD_BOOT.saveLastSummary({ reason:'back_hub_from_result' });
      location.href = GD_BOOT.hubURL();
    });

    $('#gdBtnPlayAgain')?.addEventListener('click', ()=>{
      const u = new URL(location.href);
      if(P.run !== 'research') u.searchParams.set('seed', String(Date.now()));
      location.href = u.pathname + u.search;
    });

    $('#gdBtnCopySummary')?.addEventListener('click', async ()=>{
      const txt = buildPlaintextSummaryForCopy();
      try{
        await navigator.clipboard.writeText(txt);
        gdToast('คัดลอกสรุปแล้ว');
      }catch(e){
        const ta = DOC.createElement('textarea');
        ta.value = txt;
        DOC.body.appendChild(ta); ta.select();
        try{ DOC.execCommand('copy'); gdToast('คัดลอกสรุปแล้ว'); }catch{}
        ta.remove();
      }
    });

    WIN.addEventListener('keydown', (e)=>{
      if(e.key === 'Escape' && GD.resultUI.open) closeResultModal();
    });
  }

  // ---------------------------------------------------------
  // LOGGER (CSV-READY, NO NETWORK)
  // ---------------------------------------------------------
  function makeSessionId(){
    return ['GD', P.pid||'anon', P.run||'play', P.scene||'scene', Date.now().toString(36)].join('_').replace(/[^\w-]+/g,'_');
  }
  function loggerInit(){
    GD.logger.sessionId = makeSessionId();
    GD.logger.startedAt = isoNow();
    GD.logger.endedAt = null;
    GD.logger.seq = 0;
    GD.logger.buffers = { sessions:[], events:[], features1s:[] };

    gdLogEvent('session_start', {
      pid:P.pid, run:P.run, diff:P.diff, time:P.time, seed:P.seed,
      scene:P.scene, view:P.view, hub:P.hub || null,
      researchSeedBase: (P.run==='research') ? (WIN.__GD_RESEARCH_SEED_BASE__ || null) : null
    });
  }

  function baseRow(kind){
    GD.logger.seq += 1;
    return {
      game:'germ-detective',
      kind,
      sessionId:GD.logger.sessionId,
      seq:GD.logger.seq,
      tsIso: isoNow(),
      tsMs: nowMs(),

      pid:P.pid || 'anon',
      run:P.run || 'play',
      diff:P.diff || 'normal',
      scene:P.scene || 'classroom',
      view:P.view || 'pc',
      seed:P.seed || null,

      researchSeedBase: (P.run==='research') ? (WIN.__GD_RESEARCH_SEED_BASE__ || null) : null,
      deterministic: (P.run==='research') ? 1 : 0,

      missionId: GD.mission.current?.id || null,
      phaseMode: GD.phase.mode || 'investigate'
    };
  }

  function gdLogEvent(name, payload={}){
    if(!GD.logger.enabled) return;
    const p = payload || {};
    const row = {
      ...baseRow('event'),
      eventName: String(name || 'event'),
      payloadJson: safeJson(p),
      payloadSize: JSON.stringify(p).length,
      target: p.target ?? null,
      method: p.method ?? null,
      tool: p.tool ?? null,
      reason: p.reason ?? null,
      score: numOrNull(p.score),
      riskBefore: numOrNull(p.riskBefore),
      riskAfter: numOrNull(p.riskAfter),
      budgetLeft: numOrNull(p.budgetLeft),
      impactEst: numOrNull(p.impactEst)
    };
    GD.logger.buffers.events.push(row);
  }

  function computeRecommendationAdherence(){
    const chain = graphTopChainApprox();
    const rec = WIN.__GD_RECOMMENDED_ORDER__ || [];
    if(!chain.length || !rec.length) return null;
    return rec.slice(0,2).includes(chain[0]) ? 1 : 0;
  }

  function gdLogFeature1s(){
    if(!GD.logger.enabled) return;
    const appState = GD.app?.getState?.() || {};
    const missionStat = missionCompletionStats();
    const chain = graphTopChainApprox();

    const row = {
      ...baseRow('features1s'),
      timeLeft: numOrNull(appState.timeLeft),
      timeTotal: numOrNull(appState.timeTotal),
      running: appState.running ? 1 : 0,
      paused: appState.paused ? 1 : 0,
      ended: appState.ended ? 1 : 0,

      evidenceCount: numOrNull(GD.trace.evidenceCount),
      uniqueTargets: numOrNull(GD.trace.uniqueTargets.size),
      scansUV: numOrNull(GD.trace.toolUse.uv),
      swabs: numOrNull(GD.trace.toolUse.swab),
      photos: numOrNull(GD.trace.toolUse.cam),

      coverage: numOrNull(coverageScore()),
      verifiedTargets: numOrNull(countVerifiedTargets()),
      riskScore: numOrNull(GD.ai.riskScore),
      nextBestAction: GD.ai.nextBestAction || null,

      graphNodeCount: numOrNull(Array.from(GD.graph.nodes.values()).length),
      graphEdgeCount: numOrNull(GD.graph.edges.length),
      graphChain: chain.join('>') || null,

      budgetTotal: numOrNull(GD.budget.points),
      budgetSpent: numOrNull(GD.budget.spent),
      budgetLeft: numOrNull(gdBudgetLeft()),
      interventionActions: numOrNull(GD.budget.actions.length),

      missionDone: missionStat.done,
      missionTotal: missionStat.total,
      missionAllClear: missionStat.allClear ? 1 : 0,

      recommendationTop1: WIN.__GD_RECOMMENDED_ORDER__?.[0] || null,
      recommendationTop2: WIN.__GD_RECOMMENDED_ORDER__?.[1] || null,
      playerTop1: chain[0] || null,
      playerTop2: chain[1] || null,
      recommendationAdherence: numOrNull(computeRecommendationAdherence())
    };
    GD.logger.buffers.features1s.push(row);
  }

  function sessionDurationSec(){
    try{
      const a = new Date(GD.logger.startedAt).getTime();
      const b = new Date(GD.logger.endedAt || isoNow()).getTime();
      return Math.max(0, Math.round((b-a)/1000));
    }catch(e){ return null; }
  }

  function gdLogSessionEnd(extra={}){
    if(!GD.logger.enabled) return;
    if(GD.logger.buffers.sessions.length) return;
    GD.logger.endedAt = isoNow();
    const score = GD.score || {};
    const missionStat = missionCompletionStats();
    const chain = graphTopChainApprox();

    const row = {
      ...baseRow('session'),
      startedAt: GD.logger.startedAt,
      endedAt: GD.logger.endedAt,
      durationSec: sessionDurationSec(),

      finalScore: numOrNull(score.final),
      rank: score.rank || null,

      accScore: numOrNull(score.accuracy?.score),
      chainScore: numOrNull(score.chain?.score),
      speedScore: numOrNull(score.speed?.score),
      verifyScore: numOrNull(score.verification?.score),
      interventionScore: numOrNull(score.intervention?.score),

      riskScoreEnd: numOrNull(GD.ai.riskScore),
      missionDone: missionStat.done,
      missionTotal: missionStat.total,
      missionAllClear: missionStat.allClear ? 1 : 0,

      graphNodeCount: numOrNull(Array.from(GD.graph.nodes.values()).length),
      graphEdgeCount: numOrNull(GD.graph.edges.length),
      graphChain: chain.join('>') || null,

      budgetTotal: numOrNull(GD.budget.points),
      budgetSpent: numOrNull(GD.budget.spent),
      budgetLeft: numOrNull(gdBudgetLeft()),
      interventionActions: numOrNull(GD.budget.actions.length),

      aiTipsCount: numOrNull(GD.trace.aiTips.length),
      evidenceCount: numOrNull(GD.trace.evidenceCount),

      resultReason: extra.reason || null,
      extraJson: safeJson(extra)
    };

    GD.logger.buffers.sessions.push(row);
  }

  function csvEscape(v){
    if(v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }
  function rowsToCsv(rows){
    if(!rows || !rows.length) return '';
    const cols = Array.from(rows.reduce((set,r)=>{ Object.keys(r||{}).forEach(k=>set.add(k)); return set; }, new Set()));
    const head = cols.map(csvEscape).join(',');
    const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(',')).join('\n');
    return head + '\n' + body;
  }
  function downloadText(filename, text, mime='text/plain;charset=utf-8'){
    const blob = new Blob([text], {type:mime});
    const url = URL.createObjectURL(blob);
    const a = DOC.createElement('a');
    a.href = url; a.download = filename;
    DOC.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 1000);
  }
  function exportCsv(kind='events'){
    const rows = GD.logger.buffers[kind] || [];
    const csv = rowsToCsv(rows);
    const ts = isoNow().replace(/[:.]/g,'-');
    const sid = GD.logger.sessionId || 'session';
    downloadText(`germ-detective_${kind}_${sid}_${ts}.csv`, csv, 'text/csv;charset=utf-8');
  }
  function persistLogBuffersLocal(){
    try{
      localStorage.setItem('GD_LOG_BUFFERS_LAST', JSON.stringify({
        savedAt: isoNow(),
        sessionId: GD.logger.sessionId,
        counts: {
          sessions: GD.logger.buffers.sessions.length,
          events: GD.logger.buffers.events.length,
          features1s: GD.logger.buffers.features1s.length
        },
        buffers: GD.logger.buffers
      }));
    }catch(e){}
  }

  let featureLogTimer = null;
  function startFeatureLogging1s(){
    if(featureLogTimer) clearInterval(featureLogTimer);
    featureLogTimer = setInterval(()=>{
      try{
        const s = GD.app?.getState?.();
        if(!s || !s.running) return;
        gdLogFeature1s();
      }catch(e){}
    }, 1000);
  }
  function stopFeatureLogging1s(){
    if(featureLogTimer){ clearInterval(featureLogTimer); featureLogTimer = null; }
  }

  function wireLoggerEventBus(){
    WIN.addEventListener('hha:event', (ev)=>{
      const d = ev.detail || {};
      gdLogEvent(d.name || 'hha_event', d.payload || {});
    }, false);

    WIN.addEventListener('hha:labels', (ev)=>{
      gdLogEvent('hha_labels', ev.detail || {});
      const t = ev.detail?.type;
      if(t === 'report_submitted'){
        // core app may not emit hha:end; finalize ourselves
        setTimeout(()=> finalizeAndShowResult('report_submitted'), 50);
      }
    }, false);

    WIN.addEventListener('hha:end', (ev)=>{
      gdLogEvent('hha_end', ev.detail || {});
      if(!GD.logger.buffers.sessions.length){
        gdLogSessionEnd({ reason: ev.detail?.reason || 'hha:end' });
      }
    }, false);

    WIN.addEventListener('pagehide', ()=>{
      gdLogEvent('pagehide', { reason:'pagehide' });
      if(!GD.logger.buffers.sessions.length){
        gdLogSessionEnd({ reason:'pagehide' });
      }
      persistLogBuffersLocal();
    });
  }

  // ---------------------------------------------------------
  // GAME STAGE + HOTSPOTS (DOM WORLD)
  // ---------------------------------------------------------
  function buildStageWorld(){
    const stage = $('#gdGameStage');
    if(!stage) return;

    // mount container for app simple DOM prototype
    let mount = $('#app');
    if(!mount){
      mount = DOC.createElement('div');
      mount.id = 'app';
      mount.style.cssText = 'position:absolute; inset:0;';
      stage.appendChild(mount);
    }

    // background / scene label
    const bg = DOC.createElement('div');
    bg.id = 'gdSceneBg';
    bg.style.cssText = [
      'position:absolute','inset:0',
      'background: radial-gradient(circle at 20% 15%, rgba(34,211,238,.06), transparent 35%), radial-gradient(circle at 80% 20%, rgba(16,185,129,.06), transparent 40%), rgba(255,255,255,.01)'
    ].join(';');
    stage.prepend(bg);

    const sceneLabel = DOC.createElement('div');
    sceneLabel.className = 'pill';
    sceneLabel.style.cssText = 'position:absolute; right:12px; top:12px; z-index:10;';
    sceneLabel.textContent = `Scene: ${P.scene}`;
    stage.appendChild(sceneLabel);

    // hotspots overlay
    const hs = currentHotspots();
    hs.forEach(h=>{
      const d = DOC.createElement('button');
      d.type = 'button';
      d.className = 'gd-spot';
      d.dataset.name = h.name;
      d.textContent = h.name;
      d.style.left = `${h.x}%`;
      d.style.top = `${h.y}%`;
      d.style.transform = 'translate(-50%, -50%)';
      d.addEventListener('click', ()=> onHotspotClick(h));
      stage.appendChild(d);
    });
  }

  function flashSpot(el){
    if(!el) return;
    const old = el.style.boxShadow;
    el.style.boxShadow = '0 0 0 3px rgba(34,211,238,.55), 0 0 22px rgba(34,211,238,.35)';
    setTimeout(()=>{ try{ el.style.boxShadow = old || ''; }catch{} }, 260);
  }

  function hitTestSpot(x,y, lockPx=28){
    const spots = $$('.gd-spot');
    let best = null, bestD = Infinity;
    for(const el of spots){
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const d = Math.hypot(cx - x, cy - y);
      if(d <= lockPx && d < bestD){
        bestD = d;
        best = { el, name: el.dataset.name };
      }
    }
    return best;
  }

  function onHotspotClick(h){
    if(GD.ended) return;
    const tool = GD.app?.getState?.()?.tool || GD.app?.getState?.().tool; // core state
    const name = h.name;

    if(!tool){
      GD.app?.addEvidence?.({ type:'inspect', target:name, info:'ตรวจสอบ' });
      return;
    }

    if(tool === 'uv'){
      const el = $(`.gd-spot[data-name="${CSS.escape(name)}"]`);
      if(el){ el.classList.add('hot'); setTimeout(()=> el.classList.remove('hot'), 1400); }
      GD.app?.addEvidence?.({ type:'hotspot', target:name, info:'พบโดย UV' });
    } else if(tool === 'swab'){
      const el = $(`.gd-spot[data-name="${CSS.escape(name)}"]`);
      if(el){ el.style.opacity='0.65'; setTimeout(()=>{ try{ el.style.opacity='1'; }catch{} }, 650); }
      setTimeout(()=> GD.app?.addEvidence?.({ type:'sample', target:name, info:'swab สำเร็จ' }), 550);
    } else if(tool === 'cam'){
      GD.app?.addEvidence?.({ type:'photo', target:name, info:'ถ่ายภาพ' });
    } else {
      GD.app?.addEvidence?.({ type:'inspect', target:name, info:'ตรวจสอบ' });
    }
  }

  // ---------------------------------------------------------
  // TOP BAR / CONTROLS
  // ---------------------------------------------------------
  function updateTopPills(){
    const set = (sel, val)=>{ const e=$(sel); if(e) e.textContent = String(val); };
    set('#gdRiskPill', `risk: ${GD.ai.riskScore}`);
    set('#gdAiNextPill', `AI: ${GD.ai.nextBestAction || '-'}`);

    const timerEl = $('#gdTimer');
    const s = GD.app?.getState?.();
    if(timerEl && s){
      timerEl.textContent = `เวลา: ${s.timeLeft}s`;
    }
  }

  function wireTopBarControls(){
    $('#gdSubmitBtn')?.addEventListener('click', ()=>{
      setPhase('report');
      GD.app?.submitReport?.();
      // if core app doesn't expose submitReport publicly, fallback finalize:
      setTimeout(()=>{
        if(!GD.ended) finalizeAndShowResult('submit_button');
      }, 100);
    });

    $('#gdBackHubBtnTop')?.addEventListener('click', ()=>{
      GD_BOOT.saveLastSummary({ reason:'back_hub_top' });
      location.href = GD_BOOT.hubURL();
    });

    $('#gdPauseBtn')?.addEventListener('click', (ev)=>{
      const s = GD.app?.getState?.();
      if(!s) return;
      if(s.running){
        WIN.postMessage({ type:'command', action:'pause' }, '*');
        ev.currentTarget.textContent = 'Resume';
      }else{
        WIN.postMessage({ type:'command', action:'resume' }, '*');
        ev.currentTarget.textContent = 'Pause';
      }
    });
  }

  // ---------------------------------------------------------
  // RESULT FINALIZE FLOW
  // ---------------------------------------------------------
  let resultShown = false;
  function finalizeAndShowResult(reason='end'){
    if(resultShown) return;
    resultShown = true;

    GD.ended = true;
    GD.endReason = reason;
    stopFeatureLogging1s();

    GD.score = computeFinalScore();

    if(!GD.logger.buffers.sessions.length){
      gdLogSessionEnd({ reason });
    }
    persistLogBuffersLocal();

    renderResultModal(GD.score);
    emitHhaEvent('result_modal_open', { reason, final: GD.score.final, rank: GD.score.rank });
  }

  // ---------------------------------------------------------
  // CORE APP INIT (patch around app.js)
  // ---------------------------------------------------------
  function initCoreApp(){
    // GameApp app.js originally appends UI to body and creates hotspots itself.
    // We reuse its evidence/timer/events machinery but suppress duplicate hotspots by not calling createHotspots there.
    // Since createHotspots is internal, easiest path: instantiate app and use addEvidence/setTool/state only;
    // we render our own stage + hotspots and own buttons.

    GD.app = GameApp({
      mountId: 'app',
      timeSec: P.time,
      dwellMs: 1200,
      seed: P.seed
    });

    GD.app.init();

    // Patch core UI duplication: hide its default toolbar/panel if created
    $$('.gd-toolbar, .gd-evidence').forEach(el => {
      try { el.style.display = 'none'; } catch {}
    });

    // Patch timer text location: if core created #gdTimer in hidden toolbar, clone timer pill on stage
    if(!$('#gdTimer')){
      const timer = DOC.createElement('div');
      timer.id = 'gdTimer';
      timer.className = 'gd-timer';
      timer.textContent = `เวลา: ${P.time}s`;
      $('#gdGameStage')?.appendChild(timer);
    }

    // Add tool buttons local toolbar
    if(!$('#gdToolBarLocal')){
      const bar = DOC.createElement('div');
      bar.id = 'gdToolBarLocal';
      bar.className = 'gd-toolbar';
      bar.innerHTML = `
        <button class="btn" id="gdBtnUV" type="button">UV (1)</button>
        <button class="btn" id="gdBtnSwab" type="button">Swab (2)</button>
        <button class="btn" id="gdBtnCam" type="button">Camera (3)</button>
      `;
      $('#gdGameStage')?.appendChild(bar);

      $('#gdBtnUV')?.addEventListener('click', ()=> GD.app?.setTool?.('uv'));
      $('#gdBtnSwab')?.addEventListener('click', ()=> GD.app?.setTool?.('swab'));
      $('#gdBtnCam')?.addEventListener('click', ()=> GD.app?.setTool?.('cam'));
    }

    // keyboard shortcuts
    WIN.addEventListener('keydown', (e)=>{
      if(e.key === '1') GD.app?.setTool?.('uv');
      if(e.key === '2') GD.app?.setTool?.('swab');
      if(e.key === '3') GD.app?.setTool?.('cam');
    }, false);

    // Since core submitReport is not public in provided code, expose fallback from labels/timeup.
    // Hook hha:labels/hha:end to finalize result.
    WIN.addEventListener('hha:end', (ev)=>{
      const reason = ev.detail?.reason || 'end';
      setTimeout(()=> finalizeAndShowResult(reason), 50);
    }, false);

    WIN.addEventListener('hha:labels', (ev)=>{
      const type = ev.detail?.type;
      if(type === 'report_submitted' || type === 'end'){
        setTimeout(()=> finalizeAndShowResult(type), 50);
      }
    }, false);

    // Ensure app default tool and sync
    setTimeout(()=>{
      GD.app?.setTool?.('uv');
    }, 50);
  }

  // ---------------------------------------------------------
  // CSV EXPORT BUTTONS
  // ---------------------------------------------------------
  function wireExportButtons(){
    $('#gdBtnExportSessionCsv')?.addEventListener('click', ()=> exportCsv('sessions'));
    $('#gdBtnExportEventsCsv')?.addEventListener('click', ()=> exportCsv('events'));
    $('#gdBtnExportFeatCsv')?.addEventListener('click', ()=> exportCsv('features1s'));
  }

  // ---------------------------------------------------------
  // META LOOP
  // ---------------------------------------------------------
  let metaLoopTimer = null;
  function startMetaLoop(){
    if(metaLoopTimer) clearInterval(metaLoopTimer);
    metaLoopTimer = setInterval(()=>{
      try{
        updateTopPills();
        updateMissionProgress();
        coachTick();
      }catch(e){}
    }, 1000);
  }

  // ---------------------------------------------------------
  // APP <-> LOGGER / EVENT BRIDGE
  // ---------------------------------------------------------
  function bridgeCoreToCustom(){
    // tool change from core -> count tool use
    WIN.addEventListener('gd:toolchange', (ev)=>{
      const tool = String(ev.detail?.tool || '').toLowerCase();
      emitHhaEvent('tool_change', { tool });
    }, false);

    // If core creates hotspot divs itself, hide duplicates (we use custom stage spots)
    setTimeout(()=>{
      const stray = [...DOC.body.querySelectorAll('.gd-spot')].filter(el => !$('#gdGameStage')?.contains(el));
      stray.forEach(el => { try{ el.remove(); }catch{} });
    }, 120);
  }

  // ---------------------------------------------------------
  // WIRING ALL BUTTONS
  // ---------------------------------------------------------
  function wireAllButtons(){
    wireTopBarControls();
    wireInterventionUI();
    wireResultModalUI();
    wireExportButtons();
  }

  // ---------------------------------------------------------
  // FINAL INIT
  // ---------------------------------------------------------
  function init(){
    ensureBaseLayout();
    ensureResultModal();

    gdInitDeterministicRNG();
    buildStageWorld();

    initCoreApp();            // creates timer/events/state
    bridgeCoreToCustom();
    attachCoreEventBridges();

    initMission();
    emitRecommendedOrder();

    graphReset();
    renderGraph();

    initBudgetByDifficulty();
    setPhase('investigate');
    refreshInterventionTargets();
    renderInterventionLog();

    loggerInit();
    wireLoggerEventBus();
    startFeatureLogging1s();

    wireAllButtons();
    startMetaLoop();

    updateRiskHeuristic();
    updateTopPills();

    GD.started = true;
    emitHhaEvent('boot_ready', {
      version:GD.version, run:P.run, diff:P.diff, time:P.time, scene:P.scene, view:P.view, pid:P.pid, seed:P.seed
    });

    // cVR hint if vr-ui loaded
    if(P.view === 'cvr'){
      gdToast('Cardboard: แตะจอเพื่อยิงจาก crosshair');
    }
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }

})();