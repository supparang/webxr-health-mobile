// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — Production Prototype (DOM-first) + Boss + Triage + Chain + Research + Local CSV
// Supports: PC / Mobile / Cardboard(cVR via /herohealth/vr/vr-ui.js)
// No App Script required (offline CSV export only)

export default function GameApp(opts = {}) {
  'use strict';

  const cfg = Object.assign({
    mountId: 'app',
    timeSec: 210,
    dwellMs: 1200,
    seed: null,
    diff: 'normal'
  }, opts);

  // -------------------------
  // Helpers
  // -------------------------
  const WIN = window;
  const DOC = document;
  const nowPerf = () => (WIN.performance?.now?.() ?? Date.now());
  const clamp = (v, a, b) => Math.max(a, Math.min(b, Number(v)));
  const clamp01 = (v) => clamp(v, 0, 1);

  function qsParam(k, def = '') {
    try { return new URL(location.href).searchParams.get(k) ?? def; } catch { return def; }
  }
  function el(tag = 'div', cls = '') {
    const x = DOC.createElement(tag);
    if (cls) x.className = cls;
    return x;
  }
  function byId(id){ return DOC.getElementById(id); }
  function escapeHtml(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function mulberry32(seed){
    let t = (Number(seed) || Date.now()) >>> 0;
    return function(){
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // -------------------------
  // State
  // -------------------------
  const STATE = {
    running: false,
    ended: false,
    timeLeft: cfg.timeSec,
    tool: null, // uv | swab | cam | clean

    diff: String(cfg.diff || qsParam('diff', 'normal')).toLowerCase(),
    seed: cfg.seed || Number(qsParam('seed', Date.now())) || Date.now(),

    evidence: [],
    objs: [],
    hotspots: [],

    scanned: {},
    swabbed: {},
    photographed: {},
    cleaned: {},

    score: 0,
    exposure: 0,
    panic: 0,
    stars: 0,

    caseTypePref: null,
    scenario: null,
    ctx: {},

    chain: {
      links: [],            // [{from,to,auto?:bool}]
      selectedFrom: null,
      maxLinks: 8
    },

    events: {
      current: null,        // { targetIds, ttlMs, startedAt, resolved, timeoutId }
      failCount: 0
    },

    boss: {
      active: false,
      targetId: null,
      hp: 0,
      maxHP: 0,
      phase: 'idle',       // idle | uv | swab | cam | clean | down
      requiredSeq: ['uv','swab','cam','clean'],
      stepIndex: 0,
      lastHitAt: 0,
      mistakes: 0,
      enraged: false
    },

    triage: {
      enabled: true,
      maxCleans: 3,
      usedCleans: 0,
      picks: [],           // [{id, ts, riskBase, wasTrue}]
      locked: false
    },

    resources: {
      uvEnergy: 100,
      swabKits: 5,
      camShots: 8,
      cleanCharges: 3
    },

    tutorial: {
      active: true,
      step: 0,
      startedAt: 0,
      completed: false
    },

    research: {
      enabled: false,
      lockDeterministic: true,
      disableAICoach: false,
      seed: cfg.seed || null,
      pid: null,
      phase: null,
      condition: null
    },

    localLogs: {
      sessionStartedAt: Date.now(),
      events: [],
      session: []
    },

    locks: {
      hotspot: {},
      submitAt: 0,
      toastAt: 0
    },

    __tick: 0,
    __hintTick: 0,
    __lastToolHintAt: 0
  };

  // -------------------------
  // UI refs
  // -------------------------
  let _timer = null;
  let UI = {};
  let CHAIN_UI = null;
  let BOSS_UI = null;
  let TRIAGE_UI = null;
  let ENDUI = { root:null, shown:false };
  let TUTOR_UI = null;

  // -------------------------
  // Audio feedback (beeps)
  // -------------------------
  const SFX = { enabled: true, ctx: null };

  function sfxInit(){
    if (!SFX.enabled) return;
    try{
      if (!SFX.ctx) {
        const AC = WIN.AudioContext || WIN.webkitAudioContext;
        if (AC) SFX.ctx = new AC();
      }
    }catch{}
  }
  function sfxBeep(type='tick'){
    if (!SFX.enabled) return;
    try{
      sfxInit();
      const ctx = SFX.ctx;
      if (!ctx) return;
      const t0 = ctx.currentTime;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);

      const cfg = (
        type === 'boss' ? { f:160, f2:90, dur:0.14, gain:0.045 } :
        type === 'good' ? { f:720, f2:980, dur:0.09, gain:0.035 } :
        type === 'bad'  ? { f:260, f2:180, dur:0.12, gain:0.04 } :
        type === 'warn' ? { f:520, f2:460, dur:0.11, gain:0.03 } :
                          { f:420, f2:520, dur:0.06, gain:0.02 }
      );

      o.type = 'triangle';
      o.frequency.setValueAtTime(cfg.f, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(50, cfg.f2), t0 + cfg.dur);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(cfg.gain, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + cfg.dur);

      o.start(t0);
      o.stop(t0 + cfg.dur + 0.02);
    }catch{}
  }

  // -------------------------
  // Logging (offline local)
  // -------------------------
  function logEventLocal(name, payload={}){
    try{
      STATE.localLogs.events.push({
        ts: new Date().toISOString(),
        tSec: Number(getDifficultyTuning(STATE.diff).timeSec || cfg.timeSec) - Number(STATE.timeLeft || 0),
        name,
        tool: STATE.tool || null,
        score: Number(STATE.score || 0),
        exposure: Number(STATE.exposure || 0),
        panic: Number(STATE.panic || 0),
        payload
      });
    }catch{}
  }

  function pushSessionRow(status='end'){
    try{
      const ev = evaluateCaseOutcome();
      STATE.localLogs.session.push({
        ts: new Date().toISOString(),
        status,
        caseType: (STATE.scenario && STATE.scenario.caseType) || STATE.caseTypePref || null,
        diff: STATE.diff || null,
        seed: STATE.seed || cfg.seed || null,
        research: !!(STATE.research && STATE.research.enabled),
        pid: STATE.research?.pid || null,
        phase: STATE.research?.phase || null,
        condition: STATE.research?.condition || null,
        timeLeft: Number(STATE.timeLeft || 0),
        evidenceCount: (STATE.evidence || []).length,
        chainLinks: (((STATE.chain||{}).links)||[]).length,
        score: Number(ev.score || STATE.score || 0),
        roAfter: Number(ev.roAfter || 0),
        bossCleared: !!ev.boss?.cleared,
        triagePrecision: Number(ev.triage?.precision || 0)
      });
    }catch{}
  }

  // -------------------------
  // CSV Export
  // -------------------------
  function csvEscape(v){
    if (v == null) return '';
    const s = (typeof v === 'string') ? v : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  }
  function toCSV(rows){
    if (!rows || !rows.length) return '';
    const cols = Array.from(rows.reduce((acc,r)=>{ Object.keys(r||{}).forEach(k=>acc.add(k)); return acc; }, new Set()));
    const head = cols.join(',');
    const body = rows.map(r => cols.map(c => csvEscape(r[c])).join(',')).join('\n');
    return `${head}\n${body}`;
  }
  function downloadTextFile(filename, text, mime='text/csv;charset=utf-8'){
    const blob = new Blob([text], { type: mime });
    const a = DOC.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    DOC.body.appendChild(a);
    a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); a.remove(); }catch{} }, 500);
  }
  function exportLocalCSV(){
    try{
      if (!STATE.localLogs) return guardedToast('📦 Export', 'ยังไม่มีข้อมูล log', 900);
      const stamp = new Date().toISOString().replace(/[:.]/g,'-');

      const sessCsv = toCSV(STATE.localLogs.session || []);
      const evCsv = toCSV((STATE.localLogs.events || []).map(e => ({
        ...e,
        payload: e.payload ? JSON.stringify(e.payload) : ''
      })));

      if (!sessCsv && !evCsv){
        guardedToast('📦 Export', 'ยังไม่มีข้อมูล log', 900);
        return;
      }

      if (sessCsv) downloadTextFile(`germ-detective-sessions-${stamp}.csv`, sessCsv);
      setTimeout(()=>{ if (evCsv) downloadTextFile(`germ-detective-events-${stamp}.csv`, evCsv); }, 250);

      guardedToast('✅ Export', 'ส่งออก CSV แล้ว (sessions + events)', 1000);
      logEventLocal('export_csv', {
        sessions:(STATE.localLogs.session||[]).length,
        events:(STATE.localLogs.events||[]).length
      });
    }catch(e){
      console.error(e);
      guardedToast('❌ Export Error', 'ส่งออก CSV ไม่สำเร็จ', 1000);
    }
  }

  // -------------------------
  // Save snapshot
  // -------------------------
  function saveRunSnapshot(){
    try{
      const snap = {
        ts: Date.now(),
        diff: STATE.diff,
        seed: STATE.seed || cfg.seed || null,
        scenarioMeta: STATE.scenario ? {
          caseType: STATE.scenario.caseType,
          bossId: STATE.scenario.bossId,
          trueIds: STATE.scenario.trueIds
        } : null,
        timeLeft: STATE.timeLeft,
        score: STATE.score,
        exposure: STATE.exposure,
        panic: STATE.panic,
        tool: STATE.tool,
        evidenceCount: (STATE.evidence||[]).length,
        chainLinks: (((STATE.chain||{}).links)||[]).length
      };
      localStorage.setItem('HHA_GD_RUN_SNAPSHOT', JSON.stringify(snap));
    }catch{}
  }
  function loadRunSnapshotHint(){
    try{
      const raw = localStorage.getItem('HHA_GD_RUN_SNAPSHOT');
      if (!raw) return;
      const s = JSON.parse(raw);
      guardedToast('🧠 Last Run', `ล่าสุด ${s.scenarioMeta?.caseType || '-'} • score ${s.score || 0}`, 1200);
    }catch{}
  }
  function saveLastCaseSummary(summary){
    try{
      localStorage.setItem('HHA_GD_LAST_SUMMARY', JSON.stringify({ ts: Date.now(), summary }));
    }catch{}
  }

  // -------------------------
  // Difficulty tuning
  // -------------------------
  function getDifficultyTuning(diffRaw){
    const d = String(diffRaw || 'normal').toLowerCase();
    if (d === 'easy') {
      return {
        timeSec: 240, triageMaxCleans: 4, bossHP: 4,
        emergencyTTL: 12000, waveCount: 2, aiHintEverySec: 7,
        exposureGainMul: 0.85, scoreBonusMul: 1.0
      };
    }
    if (d === 'hard') {
      return {
        timeSec: 180, triageMaxCleans: 3, bossHP: 8,
        emergencyTTL: 8500, waveCount: 4, aiHintEverySec: 10,
        exposureGainMul: 1.25, scoreBonusMul: 1.15
      };
    }
    return {
      timeSec: 210, triageMaxCleans: 3, bossHP: 6,
      emergencyTTL: 10000, waveCount: 3, aiHintEverySec: 8,
      exposureGainMul: 1.0, scoreBonusMul: 1.05
    };
  }

  // -------------------------
  // Query / platform / research
  // -------------------------
  function isCVRView(){
    try{
      const q = new URL(location.href).searchParams.get('view');
      return String(q || '').toLowerCase() === 'cvr' || DOC.documentElement.dataset.view === 'cvr';
    }catch{
      return false;
    }
  }

  function parseResearchFlags(){
    try{
      const u = new URL(location.href);
      const run = String(u.searchParams.get('run') || '').toLowerCase();
      const log = String(u.searchParams.get('log') || '').toLowerCase();
      const pid = u.searchParams.get('pid');
      const phase = u.searchParams.get('phase');
      const condition = u.searchParams.get('conditionGroup') || u.searchParams.get('condition');
      const seedQ = u.searchParams.get('seed');

      STATE.research.enabled = (run === 'research' || log === 'research');
      STATE.research.disableAICoach = STATE.research.enabled;
      STATE.research.lockDeterministic = STATE.research.enabled ? true : false;
      STATE.research.pid = pid || null;
      STATE.research.phase = phase || null;
      STATE.research.condition = condition || null;
      if (seedQ) STATE.research.seed = Number(seedQ) || seedQ;
    }catch{}
  }

  // -------------------------
  // DOM styles
  // -------------------------
  function ensureStyle(){
    if (byId('gd-style')) return;
    const st = DOC.createElement('style');
    st.id = 'gd-style';
    st.textContent = `
      .gd-toolbar,.gd-evidence,.gd-chain,.gd-bosshud,.gd-triagehud,#gdTutorial,.gd-end,.gd-toast{
        font-family: system-ui, -apple-system, "Noto Sans Thai", Segoe UI, Roboto, sans-serif;
      }
      .gd-btn{
        appearance:none; border:none; cursor:pointer;
        border-radius:999px; padding:8px 10px;
        background: rgba(15,23,42,.72);
        color: rgba(229,231,235,.96);
        border:1px solid rgba(148,163,184,.22);
        font-weight:900; font-size:12px;
        box-shadow: 0 10px 24px rgba(0,0,0,.20);
        -webkit-tap-highlight-color: transparent;
      }
      .gd-btn:active{ transform: translateY(1px); }

      .gd-toolbar{
        position:fixed; left:12px; top:12px; z-index:1000;
        padding:8px; border-radius:12px;
        border:1px solid rgba(148,163,184,.16);
        background: rgba(2,6,23,.78); backdrop-filter: blur(8px);
        box-shadow: 0 16px 40px rgba(0,0,0,.28);
      }
      .gd-toolbar .gd-row{ display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
      .gd-timer{ margin-top:8px; font-weight:1000; font-size:12px; opacity:.95; }

      .gd-evidence{
        position:fixed; right:12px; top:12px; width:260px; max-height:60vh; overflow:auto;
        z-index:1001; border-radius:12px; border:1px solid rgba(148,163,184,.16);
        background: rgba(2,6,23,.78); backdrop-filter: blur(8px);
        box-shadow: 0 16px 40px rgba(0,0,0,.28); padding:8px 10px; color:#e5e7eb;
      }
      .gd-evidence h4{ margin:4px 0 8px; font-size:13px; }
      .gd-card{
        padding:8px; margin-bottom:6px; border-radius:10px;
        background: rgba(255,255,255,0.03); border:1px solid rgba(148,163,184,.12);
        font-size:12px;
      }

      .gd-world{
        position:fixed; inset:0; overflow:hidden;
        background:
          radial-gradient(1000px 700px at 20% 5%, rgba(99,102,241,.12), transparent 60%),
          radial-gradient(1000px 700px at 85% 10%, rgba(34,211,238,.10), transparent 60%),
          radial-gradient(1200px 900px at 50% 120%, rgba(244,114,182,.07), transparent 60%),
          #030712;
      }
      .gd-worldTitle{
        position:absolute; left:50%; top:52px; transform:translateX(-50%);
        color:rgba(229,231,235,.85); font-weight:1000; font-size:13px;
        background: rgba(2,6,23,.45); border:1px solid rgba(148,163,184,.12);
        border-radius:999px; padding:6px 10px; z-index:3;
      }
      .gd-grid{
        position:absolute; inset:0;
        background-image:
          linear-gradient(rgba(148,163,184,.06) 1px, transparent 1px),
          linear-gradient(90deg, rgba(148,163,184,.06) 1px, transparent 1px);
        background-size: 64px 64px;
        opacity:.45;
      }

      .gd-spot{
        position:absolute;
        min-width:72px;
        min-height:44px;
        padding:10px 12px;
        border-radius:12px;
        border:1px solid rgba(148,163,184,.14);
        background: rgba(255,255,255,0.03);
        color: rgba(229,231,235,.96);
        cursor:pointer;
        user-select:none;
        display:grid;
        place-items:center;
        text-align:center;
        font-weight:900;
        font-size:12px;
        box-shadow: 0 10px 30px rgba(0,0,0,.14);
      }
      .gd-spot[data-risk="high"]{ border-color: rgba(244,114,182,.18); }
      .gd-spot[data-cleaned="1"]{
        opacity:.8;
        background: rgba(16,185,129,.10);
        border-color: rgba(16,185,129,.20);
      }
      .gd-spot.is-boss{
        box-shadow: 0 0 0 2px rgba(244,114,182,.18), 0 18px 40px rgba(0,0,0,.22);
      }

      .gd-chain{
        position:fixed; left:12px; bottom:12px;
        width:min(420px, calc(100vw - 24px));
        max-height:38vh; overflow:auto;
        z-index:1005;
        border-radius:14px;
        border:1px solid rgba(148,163,184,.16);
        background: rgba(2,6,23,.82);
        backdrop-filter: blur(10px);
        color: rgba(229,231,235,.96);
        box-shadow: 0 16px 40px rgba(0,0,0,.32);
      }
      .gd-chainHd{
        display:flex; align-items:center; justify-content:space-between; gap:8px;
        padding:10px 12px 8px; border-bottom:1px solid rgba(148,163,184,.12);
      }
      .gd-chainTitle{ font-weight:1000; font-size:13px; }
      .gd-chainBody{ padding:10px 12px; display:grid; gap:8px; }
      .gd-chainTools{ display:flex; gap:6px; flex-wrap:wrap; }
      .gd-miniList{ display:grid; gap:6px; max-height:120px; overflow:auto; }
      .gd-miniItem{
        border-radius:10px; border:1px solid rgba(148,163,184,.12);
        background: rgba(15,23,42,.45); padding:7px 9px; font-size:12px;
      }

      .gd-chainObjBtn{
        display:inline-flex; align-items:center; gap:4px;
        border-radius:999px; padding:5px 8px; font-size:11px; font-weight:900;
      }

      .gd-toast{
        position:fixed; left:50%; top:14px; transform:translateX(-50%);
        z-index:1012; color:#e5e7eb;
        background: rgba(2,6,23,.88);
        border:1px solid rgba(148,163,184,.18);
        border-radius:12px; padding:8px 10px;
        box-shadow:0 18px 50px rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
        font-size:12px; font-weight:800;
        max-width:min(92vw, 560px);
      }

      /* Boss + Triage HUD */
      .gd-bosshud{
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
        z-index: 1006; width: min(560px, calc(100vw - 24px));
        border-radius: 14px; border: 1px solid rgba(244,114,182,.22);
        background: rgba(2,6,23,.82); box-shadow: 0 16px 40px rgba(0,0,0,.34);
        backdrop-filter: blur(10px); color: rgba(229,231,235,.96); display:none;
      }
      .gd-bosshud.show{ display:block; }
      .gd-bosshd{
        display:flex; align-items:center; justify-content:space-between; gap:8px; padding:10px 12px 8px;
      }
      .gd-bossTitle{ font-weight:1000; font-size:13px; }
      .gd-bossSub{ font-size:11px; opacity:.9; }
      .gd-bossbarWrap{ padding:0 12px 10px; }
      .gd-bossbar{
        height: 10px; border-radius: 999px; background: rgba(148,163,184,.12);
        overflow:hidden; border:1px solid rgba(148,163,184,.14);
      }
      .gd-bossbarFill{
        height:100%; width:0%;
        background: linear-gradient(90deg, rgba(244,114,182,.8), rgba(34,211,238,.8));
        transition: width .18s ease;
      }
      .gd-bosssteps{ display:flex; gap:6px; flex-wrap:wrap; padding:0 12px 12px; }
      .gd-bossstep{
        border-radius:999px; padding:4px 8px; font-size:11px; font-weight:900;
        border:1px solid rgba(148,163,184,.18); background: rgba(15,23,42,.55);
      }
      .gd-bossstep.done{
        border-color: rgba(16,185,129,.28); background: rgba(16,185,129,.12);
      }
      .gd-bossstep.now{
        border-color: rgba(34,211,238,.35); background: rgba(34,211,238,.12);
      }

      .gd-triagehud{
        position: fixed; right: 12px; bottom: 12px; z-index: 1006;
        width: min(320px, calc(100vw - 24px)); border-radius: 14px;
        border: 1px solid rgba(148,163,184,.18); background: rgba(2,6,23,.82);
        box-shadow: 0 16px 40px rgba(0,0,0,.32); backdrop-filter: blur(10px);
        color: rgba(229,231,235,.96);
      }
      .gd-triageHd{
        padding:10px 12px 8px; border-bottom:1px solid rgba(148,163,184,.12);
        display:flex; align-items:center; justify-content:space-between; gap:8px;
      }
      .gd-triageTitle{ font-weight:1000; font-size:13px; }
      .gd-triageBody{ padding:10px 12px; display:grid; gap:8px; }
      .gd-triageCounter{ font-size:12px; font-weight:900; }
      .gd-triageCounter b{ font-size:16px; }
      .gd-miniItem .tag{
        display:inline-flex; align-items:center; margin-left:6px; border-radius:999px; padding:2px 6px;
        font-size:10px; font-weight:1000; border:1px solid rgba(148,163,184,.16); background: rgba(2,6,23,.35);
      }

      #gdTutorial{
        position: fixed; left: 50%; top: 50%; transform: translate(-50%,-50%);
        z-index: 1010; width: min(560px, calc(100vw - 20px));
        background: rgba(2,6,23,.88); border: 1px solid rgba(148,163,184,.18);
        border-radius: 16px; padding: 14px; color: rgba(229,231,235,.96);
        backdrop-filter: blur(10px); box-shadow: 0 20px 50px rgba(0,0,0,.35);
      }

      .gd-end{
        position:fixed; inset:0; z-index:1015;
        background: rgba(2,6,23,.58); backdrop-filter: blur(6px);
        display:grid; place-items:center;
      }
      .gd-endCard{
        width:min(760px, calc(100vw - 20px));
        max-height:85vh; overflow:auto;
        border-radius:16px; border:1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.92); color:#e5e7eb;
        box-shadow: 0 20px 60px rgba(0,0,0,.38);
        padding:14px;
      }
      .gd-endHd{ display:flex; justify-content:space-between; gap:8px; align-items:center; }
      .gd-endTitle{ font-size:16px; font-weight:1000; }
      .gd-endGrid{ display:grid; gap:10px; margin-top:10px; }
      .gd-endMeta{ display:grid; gap:6px; }
      .gd-item{
        border-radius:10px; border:1px solid rgba(148,163,184,.12);
        background: rgba(15,23,42,.45); padding:8px 10px; font-size:12px;
      }
      .gd-endActions{ display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; margin-top:10px; }

      @media (max-width: 768px){
        .gd-evidence{ width:min(46vw,220px); top:64px; }
        .gd-chain{ width:min(56vw,340px); max-height:34vh; left:8px; bottom:8px; }
        .gd-triagehud{ width:min(40vw,260px); right:8px; bottom:8px; }
      }
      @media (max-width: 640px){
        .gd-bosshud{ top:8px; width: calc(100vw - 16px); }
        .gd-evidence{ right:8px; top:64px; max-height:34vh; }
        .gd-toolbar{ left:8px; top:8px; max-width:52vw; }
      }
    `;
    DOC.head.appendChild(st);
  }

  // -------------------------
  // UI utility (toast, feedback)
  // -------------------------
  function guardedToast(title, msg, ms=900){
    const n = Date.now();
    if (n - Number(STATE.locks.toastAt || 0) < 180) return;
    STATE.locks.toastAt = n;
    showToast(title, msg, ms);
  }

  function showToast(title, msg, ms=900){
    try{
      const old = byId('gdToast');
      if (old) old.remove();
      const t = el('div', 'gd-toast');
      t.id = 'gdToast';
      t.textContent = `${title} ${msg ? '• ' + msg : ''}`;
      DOC.body.appendChild(t);
      setTimeout(()=> { try{ t.remove(); }catch{} }, ms);
    }catch{}
  }

  function fxEvent(type='tick'){
    try{
      if (type === 'boss-hit') sfxBeep('boss');
      else if (type === 'good') sfxBeep('good');
      else if (type === 'bad') sfxBeep('bad');
      else if (type === 'warn') sfxBeep('warn');
      else sfxBeep('tick');
    }catch{}
  }

  // -------------------------
  // Core platform UI build
  // -------------------------
  function buildUI(){
    ensureStyle();

    // world layer
    let world = byId('gdWorld');
    if (!world){
      world = el('div', 'gd-world');
      world.id = 'gdWorld';
      world.innerHTML = `
        <div class="gd-grid"></div>
        <div class="gd-worldTitle" id="gdWorldTitle">🕵️ Germ Detective</div>
      `;
      DOC.body.appendChild(world);
    }
    UI.world = world;
    UI.worldTitle = byId('gdWorldTitle');

    // toolbar
    const toolbar = el('div', 'gd-toolbar');
    toolbar.id = 'gdToolbar';
    const row1 = el('div','gd-row');
    const row2 = el('div','gd-row');
    const timer = el('div','gd-timer'); timer.id='gdTimer';

    const btnUV = el('button','gd-btn'); btnUV.textContent='UV'; btnUV.onclick = ()=> setTool('uv');
    const btnSwab = el('button','gd-btn'); btnSwab.textContent='Swab'; btnSwab.onclick = ()=> setTool('swab');
    const btnCam = el('button','gd-btn'); btnCam.textContent='Camera'; btnCam.onclick = ()=> setTool('cam');
    const btnClean = el('button','gd-btn'); btnClean.textContent='Clean'; btnClean.onclick = ()=> setTool('clean');
    const btnSubmit = el('button','gd-btn'); btnSubmit.textContent='ส่งรายงาน'; btnSubmit.onclick = submitReport;

    const btnPause = el('button','gd-btn'); btnPause.textContent='Pause'; btnPause.onclick = pauseGame;
    const btnResume = el('button','gd-btn'); btnResume.textContent='Resume'; btnResume.onclick = resumeGame;
    const btnRestart = el('button','gd-btn'); btnRestart.textContent='Restart'; btnRestart.onclick = restartCase;
    const btnNewCase = el('button','gd-btn'); btnNewCase.textContent='New Case'; btnNewCase.onclick = newCase;
    const btnExport = el('button','gd-btn'); btnExport.textContent='Export CSV'; btnExport.onclick = exportLocalCSV;

    [btnUV, btnSwab, btnCam, btnClean, btnSubmit].forEach(b=> row1.appendChild(b));
    [btnPause, btnResume, btnRestart, btnNewCase, btnExport].forEach(b=> row2.appendChild(b));

    toolbar.appendChild(row1);
    toolbar.appendChild(row2);
    toolbar.appendChild(timer);
    DOC.body.appendChild(toolbar);

    // touch-friendly
    const isTouch = ('ontouchstart' in WIN) || (navigator.maxTouchPoints > 0);
    if (isTouch){
      [btnUV,btnSwab,btnCam,btnClean,btnSubmit,btnPause,btnResume,btnRestart,btnNewCase,btnExport].forEach(b=>{
        b.style.minHeight = '40px';
        b.style.padding = '8px 10px';
        b.style.fontWeight = '900';
      });
    }

    // evidence panel
    const panel = el('div','gd-evidence'); panel.id='gdEvidence';
    panel.innerHTML = `<h4>หลักฐาน</h4><div id="gdEvidenceList"></div>`;
    DOC.body.appendChild(panel);

    UI.toolbar = toolbar;
    UI.timer = timer;
    UI.evidence = panel;
    UI.evidenceList = byId('gdEvidenceList');
  }

  function ensureCaseSelector(){
    let sel = byId('gdCaseType');
    if (sel) return sel;
    const toolbar = UI.toolbar || byId('gdToolbar');
    if (!toolbar) return null;

    const wrap = DOC.createElement('div');
    wrap.style.marginTop = '6px';
    wrap.style.display = 'flex';
    wrap.style.gap = '6px';
    wrap.style.alignItems = 'center';

    const label = DOC.createElement('span');
    label.textContent = 'Case:';
    label.style.fontSize = '12px';
    label.style.fontWeight = '900';
    label.style.color = 'rgba(229,231,235,.96)';

    sel = DOC.createElement('select');
    sel.id = 'gdCaseType';
    sel.className = 'gd-btn';
    sel.innerHTML = `
      <option value="classroom">Classroom</option>
      <option value="home">Home</option>
      <option value="cafeteria">Cafeteria</option>
    `;
    sel.addEventListener('change', ()=>{
      STATE.caseTypePref = sel.value;
      try{ localStorage.setItem('HHA_GD_CASE_PREF', sel.value); }catch{}
    }, false);

    try{
      const saved = localStorage.getItem('HHA_GD_CASE_PREF');
      if (saved) sel.value = saved;
      STATE.caseTypePref = sel.value;
    }catch{}

    wrap.appendChild(label);
    wrap.appendChild(sel);
    toolbar.appendChild(wrap);
    return sel;
  }

  function chooseCaseTypeForNewRun(){
    const pref = STATE.caseTypePref || byId('gdCaseType')?.value;
    if (pref && pref !== 'random') return pref;
    const arr = ['classroom','home','cafeteria'];
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function applyResponsiveUILayout(){
    const vw = Math.max(DOC.documentElement.clientWidth || 0, WIN.innerWidth || 0);
    const vh = Math.max(DOC.documentElement.clientHeight || 0, WIN.innerHeight || 0);
    const isMobile = vw <= 768;
    const isNarrow = vw <= 640;
    const isShort = vh <= 620;

    const ev = byId('gdEvidence');
    if (ev){
      ev.style.right = isNarrow ? '8px' : '12px';
      ev.style.top = isShort ? '64px' : '12px';
      ev.style.width = isNarrow ? 'min(46vw, 220px)' : '260px';
      ev.style.maxHeight = isShort ? '34vh' : '60vh';
    }

    const toolbar = UI.toolbar || byId('gdToolbar');
    if (toolbar){
      toolbar.style.left = isNarrow ? '8px' : '12px';
      toolbar.style.top = isShort ? '8px' : '12px';
      toolbar.style.maxWidth = isMobile ? '52vw' : 'unset';
    }

    const chain = byId('gdChainBoard');
    if (chain && isMobile){
      chain.style.left = '8px';
      chain.style.bottom = '8px';
      chain.style.width = 'min(56vw, 340px)';
      chain.style.maxHeight = isShort ? '30vh' : '34vh';
    }

    const tri = byId('gdTriageHUD');
    if (tri && isMobile){
      tri.style.right = '8px';
      tri.style.bottom = '8px';
      tri.style.width = 'min(40vw, 260px)';
    }

    const boss = byId('gdBossHUD');
    if (boss){
      boss.style.top = isShort ? '8px' : '12px';
      boss.style.width = isNarrow ? 'calc(100vw - 16px)' : 'min(560px, calc(100vw - 24px))';
    }
  }

  function applyCVRModeUI(){
    if (!isCVRView()) return;

    // collapse chain board
    if (CHAIN_UI && CHAIN_UI.body && CHAIN_UI.btnToggle){
      CHAIN_UI.collapsed = true;
      CHAIN_UI.body.style.display = 'none';
      CHAIN_UI.btnToggle.textContent = 'แสดง';
    }

    const ev = byId('gdEvidence');
    if (ev){
      ev.style.width = '180px';
      ev.style.maxHeight = '26vh';
      ev.style.opacity = '0.92';
    }

    DOC.querySelectorAll('.gd-btn').forEach(btn=>{
      btn.style.minHeight = '38px';
      btn.style.padding = '8px 10px';
      btn.style.fontWeight = '900';
    });

    const boss = byId('gdBossHUD');
    if (boss) boss.style.opacity = '0.95';

    const tri = byId('gdTriageHUD');
    if (tri){
      tri.style.width = '220px';
      tri.style.maxHeight = '24vh';
      tri.style.overflow = 'auto';
    }
  }

  function ensureResearchBadge(){
    if (!(STATE.research && STATE.research.enabled)) return;
    if (byId('gdResearchBadge')) return;
    const b = DOC.createElement('div');
    b.id = 'gdResearchBadge';
    b.style.position = 'fixed';
    b.style.left = '12px';
    b.style.bottom = '12px';
    b.style.zIndex = '1007';
    b.style.padding = '6px 10px';
    b.style.borderRadius = '999px';
    b.style.background = 'rgba(2,6,23,.85)';
    b.style.border = '1px solid rgba(148,163,184,.18)';
    b.style.color = 'rgba(229,231,235,.95)';
    b.style.font = '900 11px/1 system-ui';
    b.textContent = `RESEARCH • seed=${STATE.research.seed || STATE.seed || '-'} • pid=${STATE.research.pid || '-'}`;
    DOC.body.appendChild(b);
  }

  // -------------------------
  // Scenario generation (deterministic)
  // -------------------------
  function scenarioTemplate(caseType='classroom'){
    const maps = {
      classroom: {
        title: 'ห้องเรียน • เด็กป่วย 3 คน',
        objects: [
          { id:'door_knob', name:'ลูกบิดประตู', x:8, y:18, riskBase:0.90, kind:'touch' },
          { id:'desk_1', name:'โต๊ะเรียน A', x:23, y:32, riskBase:0.60, kind:'surface' },
          { id:'desk_2', name:'โต๊ะเรียน B', x:44, y:34, riskBase:0.62, kind:'surface' },
          { id:'desk_3', name:'โต๊ะเรียน C', x:66, y:36, riskBase:0.58, kind:'surface' },
          { id:'shared_tablet', name:'แท็บเล็ตรวม', x:78, y:28, riskBase:0.86, kind:'shared' },
          { id:'sink', name:'อ่างล้างมือ', x:86, y:70, riskBase:0.42, kind:'water' },
          { id:'trash_bin', name:'ถังขยะ', x:16, y:72, riskBase:0.49, kind:'waste' },
          { id:'window_latch', name:'สลักหน้าต่าง', x:58, y:16, riskBase:0.40, kind:'touch' },
          { id:'teacher_marker', name:'ปากกาไวท์บอร์ด', x:47, y:12, riskBase:0.52, kind:'shared' },
          { id:'fan_switch', name:'สวิตช์พัดลม', x:12, y:44, riskBase:0.78, kind:'touch' }
        ],
        graphEdges: [
          ['door_knob','desk_1'], ['desk_1','shared_tablet'], ['shared_tablet','desk_2'],
          ['desk_2','desk_3'], ['fan_switch','desk_2'], ['teacher_marker','shared_tablet']
        ]
      },
      home: {
        title: 'บ้าน • มีคนไอ',
        objects: [
          { id:'remote', name:'รีโมตทีวี', x:22, y:44, riskBase:0.88, kind:'shared' },
          { id:'door_knob_home', name:'ลูกบิดห้องนอน', x:12, y:18, riskBase:0.84, kind:'touch' },
          { id:'sofa_arm', name:'ที่วางแขนโซฟา', x:36, y:52, riskBase:0.54, kind:'surface' },
          { id:'phone', name:'โทรศัพท์มือถือ', x:62, y:42, riskBase:0.92, kind:'shared' },
          { id:'bath_sink', name:'ก๊อกน้ำห้องน้ำ', x:83, y:72, riskBase:0.58, kind:'water' },
          { id:'dining_spoon', name:'ช้อนกลาง', x:75, y:26, riskBase:0.76, kind:'shared' },
          { id:'toy', name:'ของเล่นเด็ก', x:52, y:70, riskBase:0.64, kind:'shared' },
          { id:'window_handle', name:'มือจับหน้าต่าง', x:50, y:16, riskBase:0.37, kind:'touch' },
          { id:'light_switch', name:'สวิตช์ไฟ', x:14, y:52, riskBase:0.79, kind:'touch' }
        ],
        graphEdges: [
          ['door_knob_home','light_switch'], ['light_switch','remote'], ['remote','phone'],
          ['phone','dining_spoon'], ['toy','sofa_arm']
        ]
      },
      cafeteria: {
        title: 'โรงอาหาร • จุดสัมผัสสูง',
        objects: [
          { id:'tray_stack', name:'ถาดอาหารรวม', x:18, y:26, riskBase:0.87, kind:'shared' },
          { id:'serving_tongs', name:'ที่คีบอาหาร', x:34, y:26, riskBase:0.91, kind:'shared' },
          { id:'table_edge', name:'ขอบโต๊ะกินข้าว', x:54, y:48, riskBase:0.59, kind:'surface' },
          { id:'water_dispenser', name:'ปุ่มตู้กดน้ำ', x:76, y:28, riskBase:0.89, kind:'touch' },
          { id:'cash_counter', name:'เคาน์เตอร์จ่ายเงิน', x:82, y:58, riskBase:0.65, kind:'surface' },
          { id:'bin_lid', name:'ฝาถังทิ้งเศษอาหาร', x:21, y:74, riskBase:0.71, kind:'waste' },
          { id:'spoon_bucket', name:'ถังช้อนส้อม', x:47, y:22, riskBase:0.78, kind:'shared' },
          { id:'chair_back', name:'พนักพิงเก้าอี้', x:62, y:70, riskBase:0.43, kind:'surface' },
          { id:'door_push', name:'ประตูทางเข้า', x:8, y:44, riskBase:0.80, kind:'touch' }
        ],
        graphEdges: [
          ['door_push','tray_stack'], ['tray_stack','serving_tongs'], ['serving_tongs','spoon_bucket'],
          ['water_dispenser','table_edge'], ['table_edge','chair_back'], ['cash_counter','bin_lid']
        ]
      }
    };
    return maps[caseType] || maps.classroom;
  }

  function buildScenarioFromSeed(seed, caseType='classroom', diff='normal'){
    const rand = mulberry32(seed);
    const base = scenarioTemplate(caseType);
    const objs = base.objects.map(o => Object.assign({}, o));
    const n = objs.length;

    // choose true hotspots (deterministic)
    const idxs = [...Array(n).keys()];
    idxs.sort(()=> rand() - 0.5);
    const trueCount = (diff === 'easy') ? 4 : (diff === 'hard' ? 5 : 4);
    const trueIdxs = idxs.slice(0, trueCount);
    const trueIds = trueIdxs.map(i => objs[i].id);

    // choose boss as highest risk among trueIds
    const trueObjs = objs.filter(o => trueIds.includes(o.id)).sort((a,b)=> b.riskBase - a.riskBase);
    const bossId = trueObjs[0]?.id || trueIds[0] || objs[0].id;

    // mark decoys / truth
    objs.forEach(o=>{
      o.truth = trueIds.includes(o.id);
      o.isDecoy = !o.truth && rand() < 0.35;
      o.scanNoise = rand() * 0.18;
      o.riskShown = clamp01(o.riskBase + (o.truth ? 0.06 : -0.08) + (rand() - 0.5) * 0.1);
    });

    return {
      caseType,
      title: base.title,
      objects: objs,
      graphEdges: base.graphEdges.slice(),
      trueIds,
      bossId
    };
  }

  // -------------------------
  // World creation
  // -------------------------
  function clearWorldHotspots(){
    (STATE.objs || []).forEach(o => { try{ o.el?.remove(); }catch{} });
    STATE.objs = [];
    STATE.hotspots = [];
  }

  function createWorldFromScenario(sc){
    if (!sc || !UI.world) return;

    clearWorldHotspots();
    UI.worldTitle && (UI.worldTitle.textContent = `🕵️ Germ Detective • ${sc.title}`);

    // create spots
    sc.objects.forEach((o, i) => {
      const d = el('div', 'gd-spot');
      d.textContent = o.name;
      d.dataset.id = o.id;
      d.dataset.name = o.name;
      d.dataset.risk = o.riskBase >= 0.75 ? 'high' : (o.riskBase >= 0.5 ? 'mid' : 'low');
      d.style.left = `${o.x}%`;
      d.style.top = `${o.y}%`;
      d.style.transform = 'translate(-50%,-50%)';

      d.addEventListener('click', ()=> onHotspotClick(o.id, d), false);

      // cVR support: hha:shoot locks to nearest center
      o.el = d;
      UI.world.appendChild(d);
      STATE.objs.push(o);
      STATE.hotspots.push({ id:o.id, name:o.name, el:d, isHotspot:true });
    });

    // mark boss
    const bossObj = STATE.objs.find(o => o.id === sc.bossId);
    if (bossObj?.el) bossObj.el.classList.add('is-boss');
  }

  function rebuildCaseWorldFromScenario(sc){
    createWorldFromScenario(sc);
  }

  function getObjNameById(id){
    return (STATE.objs || []).find(o => o.id === id)?.name || String(id || '-');
  }
  function resolveTarget(input, elRef){
    let obj = (STATE.objs || STATE.hotspots || []).find(o => o.id === input);
    if (!obj && input) obj = (STATE.objs || STATE.hotspots || []).find(o => o.name === input);
    if (!obj && elRef && elRef.dataset){
      const id = elRef.dataset.id || elRef.dataset.objId;
      const nm = elRef.dataset.name;
      if (id) obj = (STATE.objs || STATE.hotspots || []).find(o => o.id === id);
      if (!obj && nm) obj = (STATE.objs || STATE.hotspots || []).find(o => o.name === nm);
    }
    return obj || null;
  }

  // -------------------------
  // Chain Board UI + logic
  // -------------------------
  function ensureChainBoardUI(){
    if (CHAIN_UI?.root && DOC.body.contains(CHAIN_UI.root)) return CHAIN_UI;

    const root = el('div','gd-chain');
    root.id = 'gdChainBoard';
    root.innerHTML = `
      <div class="gd-chainHd">
        <div class="gd-chainTitle">🔗 Chain Board</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="gd-btn" id="gdChainAutoBtn" type="button">Auto</button>
          <button class="gd-btn" id="gdChainClearBtn" type="button">Clear</button>
          <button class="gd-btn" id="gdChainToggleBtn" type="button">ซ่อน</button>
        </div>
      </div>
      <div class="gd-chainBody" id="gdChainBody">
        <div class="gd-miniItem" id="gdChainHint">แตะเลือก 2 จุดเพื่อสร้างลิงก์ A→B</div>
        <div class="gd-miniItem">
          <div style="font-weight:900;margin-bottom:6px;">Objects</div>
          <div id="gdChainObjList" class="gd-chainTools"></div>
        </div>
        <div class="gd-miniItem">
          <div style="font-weight:900;margin-bottom:6px;">Links</div>
          <div id="gdChainLinks" class="gd-miniList"></div>
        </div>
      </div>
    `;
    DOC.body.appendChild(root);

    CHAIN_UI = {
      root,
      body: root.querySelector('#gdChainBody'),
      objList: root.querySelector('#gdChainObjList'),
      links: root.querySelector('#gdChainLinks'),
      hint: root.querySelector('#gdChainHint'),
      btnAuto: root.querySelector('#gdChainAutoBtn'),
      btnClear: root.querySelector('#gdChainClearBtn'),
      btnToggle: root.querySelector('#gdChainToggleBtn'),
      collapsed: false
    };

    CHAIN_UI.btnAuto.addEventListener('click', autoSuggestChain, false);
    CHAIN_UI.btnClear.addEventListener('click', clearChainLinks, false);
    CHAIN_UI.btnToggle.addEventListener('click', ()=>{
      CHAIN_UI.collapsed = !CHAIN_UI.collapsed;
      CHAIN_UI.body.style.display = CHAIN_UI.collapsed ? 'none' : 'grid';
      CHAIN_UI.btnToggle.textContent = CHAIN_UI.collapsed ? 'แสดง' : 'ซ่อน';
    }, false);

    refreshChainBoardUI();
    return CHAIN_UI;
  }

  function clearChainLinks(){
    STATE.chain.links = [];
    STATE.chain.selectedFrom = null;
    refreshChainBoardUI();
    logEventLocal('chain_clear', {});
  }

  function addChainLink(from, to, meta={}){
    if (!from || !to || from === to) return false;
    if ((STATE.chain.links || []).some(x => x.from === from && x.to === to)) return false;
    if ((STATE.chain.links || []).length >= Number(STATE.chain.maxLinks || 8)) {
      guardedToast('🔗 Chain', 'ลิงก์เต็มแล้ว', 900);
      return false;
    }
    STATE.chain.links.push({ from, to, auto: !!meta.auto, ts: Date.now() });

    // bonus if boss-related
    try{
      const b = STATE.boss || {};
      if (b.targetId && (from === b.targetId || to === b.targetId)) {
        STATE.score = Number(STATE.score || 0) + 8;
      }
    }catch{}

    refreshChainBoardUI();
    logEventLocal('chain_add', { from, to, auto: !!meta.auto });
    return true;
  }

  function autoSuggestChain(){
    const sc = STATE.scenario;
    if (!sc) return;
    let nAdded = 0;
    // use known graph edges, prefer scanned/swabbed/photographed nodes
    const seen = (id) => !!STATE.scanned[id] || !!STATE.swabbed[id] || !!STATE.photographed[id];
    sc.graphEdges.forEach(([a,b])=>{
      if (nAdded >= 2) return;
      if (seen(a) || seen(b)) {
        if (addChainLink(a,b,{ auto:true })) nAdded++;
      }
    });
    if (!nAdded) guardedToast('🔗 Auto', 'ยังไม่มีหลักฐานพอสำหรับแนะนำ chain', 900);
    else guardedToast('🔗 Auto', `เพิ่มลิงก์แนะนำ ${nAdded} รายการ`, 900);
    logEventLocal('chain_auto', { nAdded });
  }

  function chainObjectClick(id){
    if (!STATE.chain.selectedFrom) {
      STATE.chain.selectedFrom = id;
      refreshChainBoardUI();
      return;
    }
    const from = STATE.chain.selectedFrom;
    const to = id;
    STATE.chain.selectedFrom = null;
    if (from !== to) addChainLink(from, to);
    refreshChainBoardUI();
  }

  function refreshChainBoardUI(){
    if (!CHAIN_UI) return;

    // object chips
    CHAIN_UI.objList.innerHTML = '';
    (STATE.objs || []).forEach(o=>{
      const b = DOC.createElement('button');
      b.type = 'button';
      b.className = 'gd-btn gd-chainObjBtn';
      let mark = '';
      if (STATE.chain.selectedFrom === o.id) mark = '🎯';
      else if (STATE.cleaned[o.id]) mark = '🧼';
      else if (STATE.photographed[o.id]) mark = '📷';
      else if (STATE.swabbed[o.id]) mark = '🧪';
      else if (STATE.scanned[o.id]) mark = '🟣';
      b.innerHTML = `${mark} ${escapeHtml(o.name)}`;
      b.onclick = ()=> chainObjectClick(o.id);
      CHAIN_UI.objList.appendChild(b);
    });

    // links
    CHAIN_UI.links.innerHTML = '';
    const links = STATE.chain.links || [];
    if (!links.length) {
      CHAIN_UI.links.innerHTML = `<div class="gd-miniItem">ยังไม่มีลิงก์</div>`;
    } else {
      links.forEach((ln, i)=>{
        const row = el('div','gd-miniItem');
        row.innerHTML = `
          ${i+1}) <b>${escapeHtml(getObjNameById(ln.from))}</b> → <b>${escapeHtml(getObjNameById(ln.to))}</b>
          ${ln.auto ? '<span class="tag">AUTO</span>' : ''}
        `;
        CHAIN_UI.links.appendChild(row);
      });
    }

    // hint
    if (STATE.chain.selectedFrom) {
      CHAIN_UI.hint.textContent = `เลือกปลายทางสำหรับ: ${getObjNameById(STATE.chain.selectedFrom)}`;
    } else {
      CHAIN_UI.hint.textContent = 'แตะเลือก 2 จุดเพื่อสร้างลิงก์ A→B';
    }
  }

  function evaluateChainQuality(){
    const sc = STATE.scenario || {};
    const truth = new Set((sc.graphEdges || []).map(([a,b])=> `${a}>${b}`));
    const pred = new Set((STATE.chain.links || []).map(x => `${x.from}>${x.to}`));

    let tp = 0;
    pred.forEach(k=> { if (truth.has(k)) tp++; });
    const fp = Math.max(0, pred.size - tp);
    const fn = Math.max(0, truth.size - tp);

    const precision = tp / Math.max(1, (tp + fp));
    const recall = tp / Math.max(1, (tp + fn));
    const f1 = (2*precision*recall) / Math.max(1e-9, (precision + recall));

    return { tp, fp, fn, precision, recall, f1 };
  }

  // -------------------------
  // Boss + Triage HUD
  // -------------------------
  function ensureBossAndTriageUI(){
    if (!BOSS_UI){
      const boss = el('div', 'gd-bosshud');
      boss.id = 'gdBossHUD';
      boss.innerHTML = `
        <div class="gd-bosshd">
          <div>
            <div class="gd-bossTitle">👾 Contamination Boss</div>
            <div class="gd-bossSub" id="gdBossSub">-</div>
          </div>
          <div class="gd-bossSub" id="gdBossHpLabel">HP 0/0</div>
        </div>
        <div class="gd-bossbarWrap">
          <div class="gd-bossbar"><div class="gd-bossbarFill" id="gdBossBarFill"></div></div>
        </div>
        <div class="gd-bosssteps" id="gdBossSteps"></div>
      `;
      DOC.body.appendChild(boss);

      BOSS_UI = {
        root: boss,
        sub: boss.querySelector('#gdBossSub'),
        hpLabel: boss.querySelector('#gdBossHpLabel'),
        barFill: boss.querySelector('#gdBossBarFill'),
        steps: boss.querySelector('#gdBossSteps')
      };
    }

    if (!TRIAGE_UI){
      const tri = el('div', 'gd-triagehud');
      tri.id = 'gdTriageHUD';
      tri.innerHTML = `
        <div class="gd-triageHd">
          <div class="gd-triageTitle">🎯 Triage Mode</div>
          <div class="gd-triageCounter" id="gdTriageCounter">Clean <b>0/0</b></div>
        </div>
        <div class="gd-triageBody">
          <div class="gd-miniItem" id="gdTriageHint">เลือกทำความสะอาด “จุดเสี่ยงสูง” ก่อน</div>
          <div class="gd-miniList" id="gdTriageList"></div>
        </div>
      `;
      DOC.body.appendChild(tri);

      TRIAGE_UI = {
        root: tri,
        counter: tri.querySelector('#gdTriageCounter'),
        hint: tri.querySelector('#gdTriageHint'),
        list: tri.querySelector('#gdTriageList')
      };
    }

    refreshBossHUD();
    refreshTriageHUD();
  }

  function setupBossAndTriageFromScenario(){
    const sc = STATE.scenario || {};
    const tune = getDifficultyTuning(STATE.diff);

    const bossId = sc.bossId || null;
    const bossObj = (STATE.objs || []).find(o => o.id === bossId);
    const hp = tune.bossHP;

    STATE.boss = Object.assign({}, STATE.boss, {
      active: !!bossId,
      targetId: bossId,
      hp,
      maxHP: hp,
      phase: bossId ? 'uv' : 'idle',
      requiredSeq: ['uv','swab','cam','clean'],
      stepIndex: 0,
      lastHitAt: 0,
      mistakes: 0,
      enraged: false
    });

    if (bossObj){
      bossObj.isBoss = true;
      bossObj.bossHP = hp;
      bossObj.el?.classList.add('is-boss');
    }

    const maxCleans = tune.triageMaxCleans;
    STATE.triage = Object.assign({}, STATE.triage, {
      enabled: true,
      maxCleans,
      usedCleans: 0,
      picks: [],
      locked: false
    });

    STATE.resources = Object.assign({}, STATE.resources, {
      uvEnergy: 100,
      swabKits: (STATE.diff === 'hard') ? 4 : 5,
      camShots: (STATE.diff === 'hard') ? 6 : 8,
      cleanCharges: maxCleans
    });

    ensureBossAndTriageUI();
    refreshBossHUD();
    refreshTriageHUD();

    logEventLocal('boss_triage_setup', {
      bossId, bossHP: hp, triageMax: maxCleans, diff: STATE.diff
    });
  }

  function bossExpectedStep(){
    const b = STATE.boss || {};
    const seq = b.requiredSeq || ['uv','swab','cam','clean'];
    return seq[Math.max(0, Math.min(seq.length - 1, Number(b.stepIndex || 0)))];
  }

  function isBossTarget(targetId){
    return !!(STATE.boss && STATE.boss.active && STATE.boss.targetId === targetId && STATE.boss.phase !== 'down');
  }

  function refreshBossHUD(){
    if (!BOSS_UI) return;
    const b = STATE.boss || {};
    const active = !!b.active && !!b.targetId && Number(b.maxHP || 0) > 0 && b.phase !== 'down';

    BOSS_UI.root.classList.toggle('show', active);
    if (!active) return;

    const targetName = getObjNameById(b.targetId);
    BOSS_UI.sub.textContent = `${targetName} • phase: ${String(b.phase || 'idle').toUpperCase()}`;
    BOSS_UI.hpLabel.textContent = `HP ${Math.max(0, b.hp|0)}/${Math.max(0, b.maxHP|0)}`;
    const pct = clamp01((b.hp || 0) / Math.max(1, b.maxHP || 1));
    BOSS_UI.barFill.style.width = `${Math.round(pct * 100)}%`;

    const seq = Array.isArray(b.requiredSeq) ? b.requiredSeq : ['uv','swab','cam','clean'];
    BOSS_UI.steps.innerHTML = '';
    seq.forEach((step, idx)=>{
      const x = el('span', 'gd-bossstep');
      x.textContent = `${idx+1}. ${String(step).toUpperCase()}`;
      if (idx < Number(b.stepIndex || 0)) x.classList.add('done');
      if (idx === Number(b.stepIndex || 0)) x.classList.add('now');
      BOSS_UI.steps.appendChild(x);
    });
  }

  function refreshTriageHUD(){
    if (!TRIAGE_UI) return;
    const t = STATE.triage || { maxCleans:0, usedCleans:0, picks:[] };
    TRIAGE_UI.counter.innerHTML = `Clean <b>${Number(t.usedCleans||0)}/${Number(t.maxCleans||0)}</b>`;

    let txt = 'เลือกทำความสะอาด “จุดเสี่ยงสูง” ก่อน';
    const hint = nextBestActionHint();
    if (hint && hint.action === 'clean'){
      txt = `AI แนะนำ: clean ที่ ${hint.targetName} (${hint.reason})`;
    } else if (hint){
      txt = `AI แนะนำ: ${String(hint.action).toUpperCase()} ${hint.targetName}`;
    }
    TRIAGE_UI.hint.textContent = txt;

    TRIAGE_UI.list.innerHTML = '';
    if (!Array.isArray(t.picks) || !t.picks.length){
      TRIAGE_UI.list.innerHTML = `<div class="gd-miniItem">ยังไม่มีการเลือกจุดทำความสะอาด</div>`;
      return;
    }

    t.picks.slice().reverse().forEach((p, i)=>{
      const row = el('div', 'gd-miniItem');
      const name = getObjNameById(p.id);
      row.innerHTML = `
        ${i+1}) <b>${escapeHtml(name)}</b>
        <span class="tag">${p.wasTrue ? '✅ true hotspot' : '❓ low/decoy'}</span>
        <span class="tag">risk ${Math.round((Number(p.riskBase||0))*100)}%</span>
      `;
      TRIAGE_UI.list.appendChild(row);
    });
  }

  function applyBossToolHit(targetId, tool){
    const b = STATE.boss || {};
    if (!isBossTarget(targetId)) return { handled:false };

    const nowTs = Date.now();
    const cd = 180;
    if (nowTs - Number(b.lastHitAt || 0) < cd) return { handled:true, ok:false, reason:'cooldown' };
    b.lastHitAt = nowTs;

    const expected = bossExpectedStep();
    const incoming = (tool === 'cam' ? 'cam' : tool);

    if (incoming !== expected){
      b.mistakes = Number(b.mistakes || 0) + 1;
      STATE.panic = Math.min(100, Number(STATE.panic || 0) + 5);
      STATE.exposure = Math.min(100, Number(STATE.exposure || 0) + 4);

      // shake effect
      const bo = (STATE.objs || []).find(o => o.id === targetId);
      if (bo && bo.el && bo.el.animate){
        bo.el.animate([
          { transform:'translate(-50%,-50%) translateX(0px)' },
          { transform:'translate(-50%,-50%) translateX(-4px)' },
          { transform:'translate(-50%,-50%) translateX(4px)' },
          { transform:'translate(-50%,-50%) translateX(0px)' }
        ], { duration: 180, easing:'ease-out' });
      }

      if (b.mistakes >= 3 && !b.enraged){
        b.enraged = true;
        STATE.exposure = Math.min(100, Number(STATE.exposure || 0) + 8);
        guardedToast('👾 Boss Enraged!', 'ทำผิดลำดับหลายครั้ง ความเสี่ยงเพิ่ม', 1200);
        logEventLocal('boss_enraged', { targetId, mistakes:b.mistakes });
      } else {
        guardedToast('⚠️ Wrong Sequence', `ต้องใช้ ${String(expected).toUpperCase()} ก่อน`, 900);
      }

      sfxBeep('bad');
      logEventLocal('boss_hit_wrong', { targetId, tool:incoming, expected, stepIndex:b.stepIndex });
      refreshBossHUD();
      return { handled:true, ok:false, reason:'wrong_sequence', expected };
    }

    // correct step
    b.stepIndex += 1;
    STATE.score = Number(STATE.score || 0) + 40;
    logEventLocal('boss_step_ok', { targetId, tool:incoming, stepIndex:b.stepIndex });

    if (b.stepIndex >= (b.requiredSeq || []).length){
      b.stepIndex = 0;
      b.hp = Math.max(0, Number(b.hp || 0) - 1);
      STATE.score += 120;
      if (incoming === 'clean') STATE.score += 20;

      fxEvent('boss-hit');
      guardedToast('💥 Boss Hit!', `${getObjNameById(targetId)} HP ลดลง`, 900);
      logEventLocal('boss_hp_down', { targetId, hp:b.hp, maxHP:b.maxHP });

      if (b.hp <= 0){
        b.phase = 'down';
        b.active = false;
        STATE.score += 300;
        STATE.stars = Math.max(Number(STATE.stars || 0), 1);
        STATE.panic = Math.max(0, Number(STATE.panic || 0) - 10);
        STATE.exposure = Math.max(0, Number(STATE.exposure || 0) - 8);
        guardedToast('🏆 Boss Down!', `${getObjNameById(targetId)} ถูกควบคุมแล้ว`, 1200);
        logEventLocal('boss_down', { targetId });
        refreshBossHUD();
        return { handled:true, ok:true, bossDown:true };
      }
    }

    b.phase = bossExpectedStep();
    refreshBossHUD();
    return { handled:true, ok:true };
  }

  function performCleanAction(targetId, meta={}){
    if (!targetId) return { ok:false, reason:'no_target' };
    if (STATE.ended || ENDUI.shown) return { ok:false, reason:'ended' };

    const obj = (STATE.objs || []).find(o => o.id === targetId);
    if (!obj) return { ok:false, reason:'not_found' };

    if (!STATE.triage || !STATE.triage.enabled) {
      STATE.cleaned[targetId] = true;
      addEvidence({ type:'clean', target: targetId, targetName: obj.name, info:'ทำความสะอาดแล้ว' });
      return { ok:true, unlimited:true };
    }

    if (STATE.cleaned[targetId]) {
      guardedToast('🧼 Triage', 'จุดนี้ทำความสะอาดแล้ว', 800);
      return { ok:false, reason:'already_cleaned' };
    }

    if (Number(STATE.triage.usedCleans || 0) >= Number(STATE.triage.maxCleans || 0)) {
      STATE.triage.locked = true;
      guardedToast('🚫 Triage Limit', 'ใช้สิทธิ์ทำความสะอาดครบแล้ว', 1000);
      logEventLocal('triage_limit_reached', { targetId });
      refreshTriageHUD();
      return { ok:false, reason:'limit' };
    }

    STATE.triage.usedCleans += 1;
    STATE.resources.cleanCharges = Math.max(0, Number(STATE.resources.cleanCharges || 0) - 1);
    STATE.cleaned[targetId] = true;
    obj.el && (obj.el.dataset.cleaned = '1');

    const sc = STATE.scenario || {};
    const trueSet = new Set(sc.trueIds || []);
    const wasTrue = trueSet.has(targetId);
    const riskBase = Number(obj.riskBase || 0);

    STATE.triage.picks.push({ id: targetId, ts: Date.now(), riskBase, wasTrue });

    let deltaScore = 0;
    let deltaExposure = 0;
    if (wasTrue) {
      deltaScore += Math.round(80 + riskBase * 120);
      deltaExposure -= Math.round(8 + riskBase * 12);
    } else if (obj.isDecoy) {
      deltaScore -= 20;
      deltaExposure += 3;
    } else {
      deltaScore += Math.round(15 + riskBase * 30);
      deltaExposure -= 2;
    }

    const currentWaveTargets = (((STATE.events||{}).current||{}).targetIds) || [];
    if (currentWaveTargets.includes(targetId)) {
      deltaScore += 35;
      deltaExposure -= 4;
    }

    STATE.score = Math.max(0, Number(STATE.score || 0) + deltaScore);
    STATE.exposure = clamp(Number(STATE.exposure || 0) + deltaExposure, 0, 100);

    addEvidence({ type:'clean', target: targetId, targetName: obj.name, info:'ทำความสะอาดแล้ว' });
    logEventLocal('triage_clean', {
      targetId, wasTrue, riskBase, used:STATE.triage.usedCleans, max:STATE.triage.maxCleans,
      deltaScore, deltaExposure, source: meta.source || 'click'
    });

    const bossRes = applyBossToolHit(targetId, 'clean');

    refreshTriageHUD();
    refreshBossHUD();

    if (STATE.triage.usedCleans >= STATE.triage.maxCleans){
      STATE.triage.locked = true;
      guardedToast('🎯 Triage', 'ใช้สิทธิ์ทำความสะอาดครบแล้ว — วางแผนให้คุ้ม!', 1100);
    }

    return { ok:true, bossRes, deltaScore };
  }

  // -------------------------
  // AI Hint (heuristic now; ML/DL future hook)
  // -------------------------
  function nextBestActionHint(){
    if (STATE.research && STATE.research.enabled && STATE.research.disableAICoach) return null;

    // Boss priority
    if (STATE.boss && STATE.boss.active && STATE.boss.targetId){
      const bObj = (STATE.objs || []).find(o => o.id === STATE.boss.targetId);
      if (bObj){
        const expected = bossExpectedStep() || 'uv';
        return {
          targetId: bObj.id,
          targetName: bObj.name,
          action: expected,
          reason: `Boss phase ต้องใช้ ${String(expected).toUpperCase()} ก่อน`,
          explain: `Boss HP ${STATE.boss.hp}/${STATE.boss.maxHP}`
        };
      }
    }

    // Triage nearly full => prioritize clean high-risk unresolved non-decoy
    if (STATE.triage && STATE.triage.enabled) {
      const remain = Number(STATE.triage.maxCleans || 0) - Number(STATE.triage.usedCleans || 0);
      if (remain <= 1) {
        const cand = (STATE.objs || [])
          .filter(o => !STATE.cleaned[o.id])
          .filter(o => !o.isDecoy)
          .sort((a,b)=> Number(b.riskBase||0) - Number(a.riskBase||0))[0];
        if (cand) {
          return {
            targetId: cand.id,
            targetName: cand.name,
            action: 'clean',
            reason: 'สิทธิ์ทำความสะอาดใกล้หมด ควรเลือกจุดเสี่ยงสูงสุด',
            explain: `risk ${Math.round((cand.riskBase||0)*100)}%`
          };
        }
      }
    }

    // Basic heuristic by missing evidence progression
    const cand = (STATE.objs || [])
      .filter(o => !STATE.cleaned[o.id])
      .sort((a,b)=> Number(b.riskBase||0) - Number(a.riskBase||0))[0];
    if (!cand) return null;

    if (!STATE.scanned[cand.id]) return { targetId:cand.id, targetName:cand.name, action:'uv', reason:'ยังไม่ได้สแกน', explain:`risk ${Math.round(cand.riskBase*100)}%` };
    if (!STATE.swabbed[cand.id]) return { targetId:cand.id, targetName:cand.name, action:'swab', reason:'ยังไม่มี swab', explain:`risk ${Math.round(cand.riskBase*100)}%` };
    if (!STATE.photographed[cand.id]) return { targetId:cand.id, targetName:cand.name, action:'cam', reason:'ยังไม่มีภาพหลักฐาน', explain:`risk ${Math.round(cand.riskBase*100)}%` };
    if (!STATE.cleaned[cand.id]) return { targetId:cand.id, targetName:cand.name, action:'clean', reason:'จุดเสี่ยงสูงยังไม่ถูกทำความสะอาด', explain:`risk ${Math.round(cand.riskBase*100)}%` };

    return null;
  }

  // -------------------------
  // Evidence / tool / interaction
  // -------------------------
  function canInteractTarget(targetId, cooldownMs=220){
    if (!targetId) return true;
    const nowTs = Date.now();
    const last = Number((STATE.locks.hotspot || {})[targetId] || 0);
    if (nowTs - last < cooldownMs) return false;
    STATE.locks.hotspot[targetId] = nowTs;
    return true;
  }

  function setTool(t){
    STATE.tool = t;

    WIN.dispatchEvent(new CustomEvent('gd:toolchange', { detail:{ tool:t } }));
    if (WIN.PlateSafe && typeof WIN.PlateSafe.logEvent === 'function'){
      WIN.PlateSafe.logEvent('tool_change', { tool: t });
    } else {
      WIN.dispatchEvent(new CustomEvent('hha:event', { detail: { name:'tool_change', payload:{ tool:t } } }));
    }

    // helpful boss cue
    try{
      refreshBossHUD();
      refreshTriageHUD();
      if (STATE.boss && STATE.boss.active && STATE.boss.targetId){
        const expected = bossExpectedStep();
        if (expected && t !== expected){
          if (!STATE.__lastToolHintAt || Date.now() - STATE.__lastToolHintAt > 1800){
            STATE.__lastToolHintAt = Date.now();
            guardedToast('👾 Boss Hint', `ลำดับถัดไปควรใช้ ${String(expected).toUpperCase()}`, 800);
          }
        }
      }
    }catch{}

    logEventLocal('tool_change', { tool:t });
  }

  function addEvidence(rec){
    rec.t = new Date().toISOString();
    STATE.evidence.push(rec);

    const list = UI.evidenceList || byId('gdEvidenceList');
    if (list){
      const c = el('div','gd-card');
      c.textContent = `${String(rec.type||'').toUpperCase()} • ${rec.targetName || rec.target || '-'} • ${rec.info || ''}`;
      list.prepend(c);
    }

    if (WIN.PlateSafe && typeof WIN.PlateSafe.logEvent === 'function'){
      WIN.PlateSafe.logEvent('evidence_added', rec);
    } else {
      WIN.dispatchEvent(new CustomEvent('hha:event', { detail: { name:'evidence_added', payload:rec } }));
    }

    sfxBeep('good');
  }

  function onHotspotClick(input, elNode){
    if (STATE.ended || ENDUI.shown) return;
    if (!STATE.running) return; // pause guard

    const obj = resolveTarget(input, elNode);
    const targetId = obj ? obj.id : input;
    const targetName = obj ? obj.name : String(input || '-');
    const tool = STATE.tool;

    if (!canInteractTarget(targetId, 220)) return;

    if (!tool){
      addEvidence({ type:'inspect', target:targetId, targetName, info:'ตรวจสอบ' });
      return;
    }

    // UV
    if (tool === 'uv'){
      STATE.resources.uvEnergy = Math.max(0, Number(STATE.resources.uvEnergy||100) - 1);
      if (elNode){
        elNode.style.boxShadow = '0 0 16px rgba(255,80,120,0.8)';
        setTimeout(()=> { try{ elNode.style.boxShadow=''; }catch{} }, 700);
      }
      STATE.scanned[targetId] = Math.max(Number(STATE.scanned[targetId] || 0), 0.6);
      addEvidence({ type:'hotspot', target:targetId, targetName, info:'พบโดย UV' });

      const br = applyBossToolHit(targetId, 'uv');
      if (br.handled && !br.ok) return;

      maybeEmergencyResolveCheck(targetId);
      refreshChainBoardUI();
      refreshBossHUD();
      refreshTriageHUD();
      logEventLocal('uv_scan', { targetId, targetName });
      return;
    }

    // SWAB
    if (tool === 'swab'){
      if (Number(STATE.resources.swabKits||0) <= 0){
        guardedToast('🧪 Swab', 'Swab kits หมด', 900);
        return;
      }
      STATE.resources.swabKits = Math.max(0, Number(STATE.resources.swabKits||0) - 1);

      if (elNode) elNode.style.opacity = '0.65';
      setTimeout(()=>{
        if (elNode) elNode.style.opacity = '1';
        STATE.swabbed[targetId] = true;
        addEvidence({ type:'sample', target:targetId, targetName, info:'swab สำเร็จ' });

        const br = applyBossToolHit(targetId, 'swab');
        if (br.handled && !br.ok) return;

        maybeEmergencyResolveCheck(targetId);
        refreshChainBoardUI();
        refreshBossHUD();
        refreshTriageHUD();
        logEventLocal('swab', { targetId, targetName });
      }, 550);
      return;
    }

    // CAMERA
    if (tool === 'cam'){
      if (Number(STATE.resources.camShots||0) <= 0){
        guardedToast('📷 Camera', 'จำนวนภาพหลักฐานหมด', 900);
        return;
      }
      STATE.resources.camShots = Math.max(0, Number(STATE.resources.camShots||0) - 1);

      STATE.photographed[targetId] = true;
      addEvidence({ type:'photo', target:targetId, targetName, info:'ถ่ายภาพ' });

      const br = applyBossToolHit(targetId, 'cam');
      if (br.handled && !br.ok) return;

      if (WIN.PlateLogger && typeof WIN.PlateLogger.sendEvidence === 'function'){
        try{ WIN.PlateLogger.sendEvidence({ type:'photo', meta:{ target:targetId, targetName } }); }catch{}
      }

      maybeEmergencyResolveCheck(targetId);
      refreshChainBoardUI();
      refreshBossHUD();
      refreshTriageHUD();
      logEventLocal('photo', { targetId, targetName });
      return;
    }

    // CLEAN
    if (tool === 'clean'){
      const out = performCleanAction(targetId, { source:'click' });
      if (!out.ok) return;

      if (elNode){
        elNode.style.outline = '2px solid rgba(16,185,129,.7)';
        setTimeout(()=> { try{ elNode.style.outline=''; }catch{} }, 900);
        elNode.animate?.([
          { transform:'translate(-50%,-50%) scale(1)', filter:'brightness(1)' },
          { transform:'translate(-50%,-50%) scale(1.06)', filter:'brightness(1.15)' },
          { transform:'translate(-50%,-50%) scale(1)', filter:'brightness(1)' }
        ], { duration: 260, easing:'ease-out' });
      }
      sfxBeep('good');

      maybeEmergencyResolveCheck(targetId);
      refreshChainBoardUI();
      refreshBossHUD();
      refreshTriageHUD();
      return;
    }
  }

  // -------------------------
  // Emergency waves (pressure)
  // -------------------------
  function pickWaveTargets(){
    const unresolved = (STATE.objs || []).filter(o => !STATE.cleaned[o.id]).sort((a,b)=> (b.riskBase||0) - (a.riskBase||0));
    return unresolved.slice(0, Math.min(2, unresolved.length)).map(o => o.id);
  }

  function fireEmergencyWaveDeterministic(targetIds){
    if (STATE.ended || ENDUI.shown) return;
    if (!targetIds || !targetIds.length) return;
    const tune = getDifficultyTuning(STATE.diff);

    if (!STATE.events) STATE.events = { current:null, failCount:0 };
    if (STATE.events.current?.timeoutId) {
      try{ clearTimeout(STATE.events.current.timeoutId); }catch{}
    }

    STATE.events.current = {
      targetIds: targetIds.slice(),
      ttlMs: tune.emergencyTTL,
      startedAt: Date.now(),
      resolved: false,
      timeoutId: null
    };

    guardedToast('🚨 Emergency Wave', `จุดเสี่ยงเร่งด่วน ${targetIds.length} จุด`, 1100);
    sfxBeep('warn');
    logEventLocal('emergency_wave', { targetIds, ttlMs: tune.emergencyTTL });

    // visual pulse
    targetIds.forEach(id=>{
      const o = (STATE.objs || []).find(x=> x.id === id);
      if (o?.el) {
        o.el.animate?.([
          { boxShadow:'0 0 0 rgba(244,114,182,0)' },
          { boxShadow:'0 0 0 8px rgba(244,114,182,.14)' },
          { boxShadow:'0 0 0 rgba(244,114,182,0)' }
        ], { duration: 700, iterations: 2 });
      }
    });

    STATE.events.current.timeoutId = setTimeout(()=>{
      const cur = (STATE.events || {}).current;
      if (!cur || cur.resolved) return;

      const unresolved = (cur.targetIds || []).filter(id => !STATE.cleaned[id]);
      if (unresolved.length){
        STATE.events.failCount = Number(STATE.events.failCount || 0) + 1;
        STATE.exposure = Math.min(100, Number(STATE.exposure || 0) + unresolved.length * 3);
        STATE.panic = Math.min(100, Number(STATE.panic || 0) + unresolved.length * 2);
        STATE.score = Math.max(0, Number(STATE.score || 0) - unresolved.length * 12);

        if (STATE.boss && STATE.boss.active && unresolved.includes(STATE.boss.targetId)){
          STATE.boss.hp = Math.min(Number(STATE.boss.maxHP || 0), Number(STATE.boss.hp || 0) + 1);
          guardedToast('👾 Boss Recover!', 'Emergency ไม่ถูกจัดการทัน บอสฟื้น HP', 1100);
          logEventLocal('boss_recover_from_emergency', { hp:STATE.boss.hp });
          refreshBossHUD();
        }

        guardedToast('⚠️ Wave Missed', `ยังเหลือ ${unresolved.length} จุดเสี่ยง`, 1000);
        logEventLocal('emergency_unresolved', { unresolved, tLeft: STATE.timeLeft });
      } else {
        cur.resolved = true;
        STATE.score += 60;
        STATE.exposure = Math.max(0, Number(STATE.exposure || 0) - 5);
        guardedToast('✅ Wave Cleared', 'คุณจัดการ emergency ได้ทันเวลา', 900);
        logEventLocal('emergency_resolved', { targetIds: cur.targetIds || [] });
      }
      refreshTriageHUD();
    }, tune.emergencyTTL);
  }

  function maybeEmergencyResolveCheck(targetId){
    const cur = STATE.events?.current;
    if (!cur || cur.resolved) return;
    if (!cur.targetIds?.includes(targetId)) return;
    const unresolved = cur.targetIds.filter(id => !STATE.cleaned[id]);
    if (!unresolved.length) {
      cur.resolved = true;
      guardedToast('✅ Wave Cleared', 'เคลียร์ wave ได้ก่อนหมดเวลา', 900);
      logEventLocal('emergency_resolved_early', { targetIds: cur.targetIds.slice() });
    }
  }

  // -------------------------
  // Tutorial
  // -------------------------
  const TUTOR_STEPS = [
    'สแกน UV หา hotspot ก่อน แล้วเก็บ swab/photo เป็นหลักฐาน',
    'ต่อ Chain Board (A→B→C) จากหลักฐาน เพื่ออธิบายการแพร่เชื้อ',
    'Boss hotspot ต้องทำตามลำดับ UV → SWAB → CAM → CLEAN',
    'Triage Mode มีสิทธิ์ CLEAN จำกัด เลือกจุดเสี่ยงสูงก่อน แล้วค่อยส่งรายงาน'
  ];

  function ensureTutorialUI(){
    if (TUTOR_UI) return TUTOR_UI;
    const box = el('div');
    box.id = 'gdTutorial';
    box.innerHTML = `
      <div style="font-weight:1000;font-size:14px;margin-bottom:8px;">🕵️ Germ Detective — วิธีเล่น (20 วินาที)</div>
      <div id="gdTutorialText" style="font-size:13px;line-height:1.45;opacity:.95;">
        สแกน UV หา hotspot ก่อน แล้วเก็บ swab/photo เป็นหลักฐาน
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap;">
        <button id="gdTutorialNext" type="button" class="gd-btn">ถัดไป</button>
        <button id="gdTutorialSkip" type="button" class="gd-btn">ข้าม</button>
      </div>
    `;
    DOC.body.appendChild(box);

    TUTOR_UI = {
      root: box,
      text: box.querySelector('#gdTutorialText'),
      btnNext: box.querySelector('#gdTutorialNext'),
      btnSkip: box.querySelector('#gdTutorialSkip')
    };
    TUTOR_UI.btnNext.addEventListener('click', tutorialNext, false);
    TUTOR_UI.btnSkip.addEventListener('click', finishTutorial, false);
    return TUTOR_UI;
  }

  function startTutorial(){
    if (isCVRView()) {
      guardedToast('🕵️ Tutorial', 'UV → Swab → Cam → Clean • ต่อ Chain • Triage จำกัด', 1800);
      STATE.tutorial = { active:false, step:0, startedAt:Date.now(), completed:true };
      return;
    }
    ensureTutorialUI();
    STATE.tutorial = { active:true, step:0, startedAt:Date.now(), completed:false };
    renderTutorialStep();
  }

  function renderTutorialStep(){
    if (!TUTOR_UI || !STATE.tutorial || !STATE.tutorial.active) return;
    const s = Math.max(0, Math.min(TUTOR_STEPS.length - 1, Number(STATE.tutorial.step || 0)));
    TUTOR_UI.text.textContent = TUTOR_STEPS[s];
    TUTOR_UI.btnNext.textContent = (s >= TUTOR_STEPS.length - 1) ? 'เริ่มเล่น!' : 'ถัดไป';
  }

  function tutorialNext(){
    if (!STATE.tutorial || !STATE.tutorial.active) return;
    STATE.tutorial.step++;
    if (STATE.tutorial.step >= TUTOR_STEPS.length){
      finishTutorial();
      return;
    }
    renderTutorialStep();
  }

  function finishTutorial(){
    try{ TUTOR_UI?.root?.remove(); }catch{}
    TUTOR_UI = null;
    STATE.tutorial.active = false;
    STATE.tutorial.completed = true;
    logEventLocal('tutorial_done', { ms: Date.now() - Number(STATE.tutorial?.startedAt || Date.now()) });
  }

  // -------------------------
  // Timer + game loop
  // -------------------------
  function updateTimerUI(){
    if (UI.timer) {
      UI.timer.textContent =
        `เวลา: ${STATE.timeLeft}s • Score: ${STATE.score} • Exp: ${STATE.exposure} • Panic: ${STATE.panic} • Tool: ${(STATE.tool||'-').toUpperCase()}`;
    }
  }

  function startTimer(){
    try{ clearInterval(_timer); }catch{}
    const tune = getDifficultyTuning(STATE.diff);
    STATE.running = true;
    STATE.ended = false;
    if (!Number.isFinite(Number(STATE.timeLeft)) || STATE.timeLeft <= 0) {
      STATE.timeLeft = tune.timeSec;
    }
    updateTimerUI();

    _timer = setInterval(()=>{
      if (!STATE.running || STATE.ended) return;

      STATE.timeLeft--;
      STATE.__tick++;
      STATE.__hintTick++;

      updateTimerUI();

      // emit features_1s
      if (WIN.PlateSafe && typeof WIN.PlateSafe.emitFeatures === 'function'){
        try{ WIN.PlateSafe.emitFeatures(); }catch{}
      } else {
        const feat = { game:'germ', timeLeft:STATE.timeLeft, evidenceCount:STATE.evidence.length, score:STATE.score };
        WIN.dispatchEvent(new CustomEvent('hha:features_1s', { detail: feat }));
      }

      // periodic local snapshot
      if (STATE.__tick % 5 === 0) saveRunSnapshot();

      // AI coach hint cadence
      const tuneNow = getDifficultyTuning(STATE.diff);
      if (STATE.__hintTick % Number(tuneNow.aiHintEverySec || 8) === 0){
        const hint = nextBestActionHint();
        if (hint){
          guardedToast('🤖 Coach', `${String(hint.action).toUpperCase()} ${hint.targetName} • ${hint.reason}`, 1200);
          logEventLocal('coach_hint', hint);
        }
      }

      // emergency waves at cadence
      if (STATE.timeLeft > 20 && STATE.timeLeft % 35 === 0){
        const targets = pickWaveTargets();
        if (targets.length) fireEmergencyWaveDeterministic(targets);
      }

      if (Number(STATE.timeLeft || 0) === 25 && !STATE.ended){
        guardedToast('⏳ Final Triage Rush!', 'อีก 25 วินาที — จัดลำดับ clean ให้คุ้มแล้วส่งรายงาน!', 1400);
        logEventLocal('final_rush', { tLeft: STATE.timeLeft });
      }

      if (STATE.timeLeft <= 0){
        clearInterval(_timer);
        STATE.running = false;
        STATE.ended = true;

        if (WIN.PlateSafe && typeof WIN.PlateSafe.end === 'function'){
          try{ WIN.PlateSafe.end('timeup'); }catch{}
        } else {
          WIN.dispatchEvent(new CustomEvent('hha:labels', { detail: { type:'end', reason:'timeup' } }));
        }

        pushSessionRow('timeup');
        saveRunSnapshot();
        showEndSummary('timeup');
        guardedToast('⌛ หมดเวลา!', 'สรุปผลคดี', 1000);
      }
    }, 1000);
  }

  // -------------------------
  // Outcome evaluation + badges
  // -------------------------
  function evaluateCaseOutcome(){
    const sc = STATE.scenario || {};
    const trueSet = new Set(sc.trueIds || []);
    const cleanedIds = Object.keys(STATE.cleaned || {}).filter(k => STATE.cleaned[k]);
    const trueCleaned = cleanedIds.filter(id => trueSet.has(id)).length;
    const falseCleaned = cleanedIds.length - trueCleaned;

    const tri = STATE.triage || {};
    const triPicks = Array.isArray(tri.picks) ? tri.picks : [];
    const triTrue = triPicks.filter(p => p.wasTrue).length;
    const triPrecision = triTrue / Math.max(1, triPicks.length);

    const boss = STATE.boss || {};
    const bossCleared = (boss.phase === 'down') || (!boss.active && Number(boss.maxHP||0) > 0 && Number(boss.hp||0) <= 0);
    const bossBonus = bossCleared ? 1 : (1 - (Number(boss.hp||0) / Math.max(1, Number(boss.maxHP||1))));

    const chainEval = evaluateChainQuality();

    const baseR0 = 2.6;
    const evidenceQuality = clamp01((STATE.evidence.length / 10));
    const cleanImpact = clamp01(trueCleaned / Math.max(1, trueSet.size)) * 0.8;
    const wrongPenalty = falseCleaned * 0.08 + (STATE.events.failCount || 0) * 0.06;

    let roAfter = Math.max(0.55, baseR0 - cleanImpact - evidenceQuality * 0.35 - bossBonus * 0.55 - triPrecision * 0.45 + wrongPenalty);

    const triageScore = Math.round(triPrecision * 180 + triTrue * 25);
    const bossScore = Math.round(bossBonus * 240);
    const chainScore = Math.round((chainEval.f1 || 0) * 180);

    const finalScore = Math.round(Number(STATE.score || 0) + triageScore + bossScore + chainScore);

    return {
      score: finalScore,
      roBefore: baseR0,
      roAfter,
      evidenceCount: (STATE.evidence || []).length,
      cleanedCount: cleanedIds.length,
      trueCleaned,
      falseCleaned,
      exposure: Number(STATE.exposure || 0),
      panic: Number(STATE.panic || 0),
      chainEval,
      triage: {
        picks: triPicks.length,
        truePicks: triTrue,
        precision: triPrecision
      },
      boss: {
        maxHP: Number(boss.maxHP || 0),
        hp: Number(boss.hp || 0),
        cleared: !!bossCleared,
        progress: bossBonus
      }
    };
  }

  function computeBadges(summary){
    const badges = [];
    if (!summary) return badges;
    if (summary.boss?.cleared) badges.push('👾 Boss Breaker');
    if ((summary.triage?.precision || 0) >= 0.67 && (summary.triage?.picks || 0) >= 3) badges.push('🎯 Triage Master');
    if ((summary.chainEval?.f1 || 0) >= 0.6) badges.push('🔗 Chain Analyst');
    if ((summary.roAfter || 99) <= 1.2) badges.push('🛡 Exposure Reducer');
    if ((summary.falseCleaned || 0) === 0 && (summary.cleanedCount || 0) >= 2) badges.push('✨ Precision Cleaner');
    if ((summary.evidenceCount || 0) >= 8) badges.push('📚 Evidence Hunter');
    return badges;
  }

  // -------------------------
  // End summary UI
  // -------------------------
  function setInteractionLock(locked){
    const chain = byId('gdChainBoard');
    const tri = byId('gdTriageHUD');
    const ev = byId('gdEvidence');
    [chain, tri, ev].forEach(x=>{
      if (!x) return;
      x.style.pointerEvents = locked ? 'none' : 'auto';
      x.style.opacity = locked ? '0.85' : '1';
    });
  }

  function showEndSummary(reason='submitted'){
    if (ENDUI.shown) return;
    ENDUI.shown = true;
    STATE.running = false;
    setInteractionLock(true);

    const evOut = evaluateCaseOutcome();
    const badges = computeBadges(evOut);

    const overlay = el('div','gd-end');
    overlay.id = 'gdEndOverlay';
    overlay.innerHTML = `
      <div class="gd-endCard">
        <div class="gd-endHd">
          <div class="gd-endTitle">🧾 สรุปผลคดี Germ Detective (${escapeHtml(reason)})</div>
          <div class="gd-item" style="padding:6px 10px;">${escapeHtml((STATE.scenario && STATE.scenario.caseType) || '-')} • ${escapeHtml(STATE.diff)}</div>
        </div>

        <div class="gd-endGrid">
          <div class="gd-endMeta" id="gdEndMetaList">
            <div class="gd-item">🏁 Score: <b>${evOut.score}</b></div>
            <div class="gd-item">🦠 R₀: <b>${evOut.roBefore.toFixed(2)}</b> → <b>${evOut.roAfter.toFixed(2)}</b></div>
            <div class="gd-item">📚 Evidence: <b>${evOut.evidenceCount}</b> • 🧼 Cleaned: <b>${evOut.cleanedCount}</b> (true ${evOut.trueCleaned}, false ${evOut.falseCleaned})</div>
            <div class="gd-item">🔗 Chain F1: <b>${Math.round((evOut.chainEval?.f1 || 0) * 100)}%</b> (P ${Math.round((evOut.chainEval?.precision || 0)*100)} / R ${Math.round((evOut.chainEval?.recall || 0)*100)})</div>
          </div>

          <div class="gd-item">
            <div style="font-weight:1000;margin-bottom:6px;">🏅 Badges</div>
            <div>${badges.length ? badges.map(x=>`<span class="tag">${escapeHtml(x)}</span>`).join(' ') : '—'}</div>
          </div>
        </div>

        <div class="gd-endActions" id="gdEndActions"></div>
      </div>
    `;
    DOC.body.appendChild(overlay);

    ENDUI.root = overlay;

    // extra summary rows (triage + boss)
    try{
      const metaList = overlay.querySelector('#gdEndMetaList');
      const triEl = DOC.createElement('div');
      triEl.className = 'gd-item';
      triEl.innerHTML = `🎯 Triage Quality: <b>${Number(evOut.triage?.truePicks||0)}/${Number(evOut.triage?.picks||0)}</b> true picks (Precision ${Math.round((Number(evOut.triage?.precision||0))*100)}%)`;
      metaList.appendChild(triEl);

      const bossEl = DOC.createElement('div');
      bossEl.className = 'gd-item';
      bossEl.innerHTML = `👾 Boss: <b>${evOut.boss?.cleared ? 'DOWN ✅' : `HP ${Number(evOut.boss?.hp||0)}/${Number(evOut.boss?.maxHP||0)}`}</b> (Progress ${Math.round((Number(evOut.boss?.progress||0))*100)}%)`;
      metaList.appendChild(bossEl);
    }catch{}

    // actions
    const actions = overlay.querySelector('#gdEndActions');

    const mkBtn = (txt, onClick)=>{
      const b = DOC.createElement('button');
      b.className = 'gd-btn';
      b.type = 'button';
      b.textContent = txt;
      b.onclick = onClick;
      return b;
    };

    const btnClose = mkBtn('ปิด', ()=> { try{ overlay.remove(); }catch{} ENDUI.shown=false; setInteractionLock(false); });
    const btnAgain = mkBtn('🔁 Restart', ()=> { try{ overlay.remove(); }catch{} ENDUI.shown=false; restartCase(); });
    const btnNew = mkBtn('🆕 New Case', ()=> { try{ overlay.remove(); }catch{} ENDUI.shown=false; newCase(); });
    const btnExp = mkBtn('📦 Export CSV', exportLocalCSV);

    actions.appendChild(btnExp);
    actions.appendChild(btnAgain);
    actions.appendChild(btnNew);
    actions.appendChild(btnClose);

    // labels + local save
    try{
      WIN.dispatchEvent(new CustomEvent('hha:labels', { detail: { type:'report_submitted', payload: evOut } }));
    }catch{}
    saveLastCaseSummary(evOut);
  }

  // -------------------------
  // Submit / report
  // -------------------------
  async function submitReport(){
    if (STATE.ended) return;
    const nowS = Date.now();
    if (nowS - Number(STATE.locks.submitAt || 0) < 800) return;
    STATE.locks.submitAt = nowS;

    // quality gates
    const evN = Array.isArray(STATE.evidence) ? STATE.evidence.length : 0;
    const chainN = (((STATE.chain || {}).links) || []).length;

    if (evN < 3){
      guardedToast('📝 รายงานยังอ่อน', 'เก็บหลักฐานอย่างน้อย 3 ชิ้นก่อนส่ง', 1100);
      return;
    }
    if (chainN < 1 && Number(STATE.timeLeft || 0) > 20){
      guardedToast('🔗 Chain ยังไม่ครบ', 'ลองต่อ chain อย่างน้อย 1 ลิงก์', 1100);
      return;
    }

    STATE.running = false;
    STATE.ended = true;

    const targets = Array.from(new Set(STATE.evidence.map(e => e.target))).slice(0,5);
    const payload = { targets, timeLeft: STATE.timeLeft, evidenceCount: STATE.evidence.length };

    if (WIN.PlateSafe && typeof WIN.PlateSafe.end === 'function'){
      try{ WIN.PlateSafe.end('submitted'); }catch{}
    } else {
      WIN.dispatchEvent(new CustomEvent('hha:labels', { detail: { type:'report_submitted', payload } }));
    }

    if (WIN.PlateLogger && typeof WIN.PlateLogger.logEvent === 'function'){
      try{ WIN.PlateLogger.logEvent('report_submitted', payload); }catch{}
    } else {
      try{ WIN.parent?.postMessage?.({ type:'plate:report', payload }, '*'); }catch{}
    }

    pushSessionRow('submitted');
    saveRunSnapshot();
    logEventLocal('report_submitted', payload);

    showEndSummary('submitted');
  }

  // -------------------------
  // Pause/Resume/Restart/New Case
  // -------------------------
  function pauseGame(){
    if (STATE.ended) return;
    STATE.running = false;
    logEventLocal('pause', { tLeft: STATE.timeLeft });
    guardedToast('⏸ Pause', 'หยุดเกมชั่วคราว', 800);
  }

  function resumeGame(){
    if (STATE.ended) return;
    STATE.running = true;
    logEventLocal('resume', { tLeft: STATE.timeLeft });
    guardedToast('▶ Resume', 'เล่นต่อ', 700);
  }

  function hardResetRuntimeUI(){
    UI.evidenceList && (UI.evidenceList.innerHTML = '');
    clearChainLinks();
    try{ if (TUTOR_UI && TUTOR_UI.root){ TUTOR_UI.root.remove(); TUTOR_UI = null; } }catch{}
    try{ if (ENDUI.root){ ENDUI.root.remove(); ENDUI.root = null; ENDUI.shown = false; } }catch{}
    setInteractionLock(false);
  }

  function resetStateForCase({ keepScenario=false } = {}){
    const oldScenario = STATE.scenario;
    const oldDiff = STATE.diff;
    const oldCtx = STATE.ctx;
    const oldResearch = STATE.research;

    try{ clearInterval(_timer); }catch{}
    try{ if (STATE.events?.current?.timeoutId) clearTimeout(STATE.events.current.timeoutId); }catch{}

    STATE.running = false;
    STATE.ended = false;
    STATE.timeLeft = getDifficultyTuning(oldDiff).timeSec;
    STATE.tool = 'uv';
    STATE.evidence = [];
    STATE.scanned = {};
    STATE.swabbed = {};
    STATE.photographed = {};
    STATE.cleaned = {};
    STATE.score = 0;
    STATE.stars = 0;
    STATE.exposure = 0;
    STATE.panic = 0;
    STATE.locks = { hotspot:{}, submitAt:0, toastAt:0 };
    STATE.events = { current:null, failCount:0 };
    STATE.chain = { links:[], selectedFrom:null, maxLinks:8 };

    STATE.boss = {
      active:false, targetId:null, hp:0, maxHP:0, phase:'idle',
      requiredSeq:['uv','swab','cam','clean'], stepIndex:0, lastHitAt:0, mistakes:0, enraged:false
    };
    STATE.triage = { enabled:true, maxCleans:3, usedCleans:0, picks:[], locked:false };
    STATE.resources = { uvEnergy:100, swabKits:5, camShots:8, cleanCharges:3 };

    STATE.scenario = keepScenario ? (oldScenario || null) : null;
    STATE.diff = oldDiff;
    STATE.ctx = oldCtx;
    STATE.research = oldResearch;

    hardResetRuntimeUI();
    clearWorldHotspots();
    refreshBossHUD();
    refreshTriageHUD();
    refreshChainBoardUI();
    updateTimerUI();
  }

  function restartCase(){
    const had = !!STATE.scenario;
    resetStateForCase({ keepScenario:true });
    if (!had || !STATE.scenario) return newCase();

    rebuildCaseWorldFromScenario(STATE.scenario);
    ensureChainBoardUI();
    ensureBossAndTriageUI();
    setupBossAndTriageFromScenario();
    applyResponsiveUILayout();
    applyCVRModeUI();
    startTutorial();
    setTool('uv');
    startTimer();
    logEventLocal('restart_case', { scenarioId: STATE.scenario && STATE.scenario.caseType });
  }

  function newCase(){
    resetStateForCase({ keepScenario:false });

    const seed = (STATE.research && STATE.research.enabled && STATE.research.lockDeterministic)
      ? Number(STATE.research.seed || cfg.seed || Date.now())
      : Date.now();

    STATE.seed = seed;
    const caseType = chooseCaseTypeForNewRun();
    STATE.scenario = buildScenarioFromSeed(seed, caseType, STATE.diff);

    createWorldFromScenario(STATE.scenario);
    ensureChainBoardUI();
    ensureBossAndTriageUI();
    setupBossAndTriageFromScenario();

    applyResponsiveUILayout();
    applyCVRModeUI();
    startTutorial();

    setTool('uv');
    startTimer();
    logEventLocal('new_case', { seed, caseType, diff: STATE.diff });
  }

  // -------------------------
  // hha:shoot support (cVR tap-to-shoot)
  // -------------------------
  function handleShootEvent(ev){
    // hha:shoot emits x,y screen coords; map to nearest hotspot center within lockPx
    const d = ev?.detail || {};
    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);

    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (!STATE.running || STATE.ended) return;

    let best = null;
    let bestDist = Infinity;

    (STATE.objs || []).forEach(o=>{
      const r = o.el?.getBoundingClientRect?.();
      if (!r) return;
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx - x, cy - y);
      if (dist < bestDist){
        bestDist = dist;
        best = o;
      }
    });

    if (best && bestDist <= Math.max(16, lockPx * 2.2)){
      onHotspotClick(best.id, best.el);
      logEventLocal('shoot_select', { targetId: best.id, dist: Math.round(bestDist), source: d.source || 'shoot' });
    }
  }

  // -------------------------
  // PC keyboard & messages
  // -------------------------
  function wireInputs(){
    WIN.addEventListener('message', ev=>{
      const m = ev.data;
      if (!m) return;
      if(m.type === 'command' && m.action === 'setTool' && m.value) setTool(m.value);
      if(m.type === 'command' && m.action === 'pause') pauseGame();
      if(m.type === 'command' && m.action === 'resume') resumeGame();
      if(m.type === 'command' && m.action === 'restart') restartCase();
      if(m.type === 'command' && m.action === 'newCase') newCase();
      if(m.type === 'command' && m.action === 'export') exportLocalCSV();
    }, false);

    WIN.addEventListener('keydown', e=>{
      if(e.key === '1') setTool('uv');
      if(e.key === '2') setTool('swab');
      if(e.key === '3') setTool('cam');
      if(e.key === '4') setTool('clean');

      if(e.key === 'u' || e.key === 'U') setTool('uv');
      if(e.key === 's' || e.key === 'S') setTool('swab');
      if(e.key === 'p' || e.key === 'P') setTool('cam');
      if(e.key === 'l' || e.key === 'L') setTool('clean');

      if(e.key === 'r' || e.key === 'R') submitReport();
      if(e.key === 'n' || e.key === 'N') newCase();
      if(e.key === 'e' || e.key === 'E') exportLocalCSV();

      if(e.key === ' '){
        e.preventDefault();
        STATE.running ? pauseGame() : resumeGame();
      }
    }, false);

    WIN.addEventListener('hha:shoot', handleShootEvent, false);
  }

  // -------------------------
  // Init flow
  // -------------------------
  function init(){
    parseResearchFlags();
    ensureStyle();
    buildUI();
    ensureCaseSelector();

    const tune = getDifficultyTuning(STATE.diff);
    STATE.timeLeft = tune.timeSec;

    STATE.seed = (STATE.research && STATE.research.enabled && STATE.research.lockDeterministic)
      ? (STATE.research.seed || cfg.seed || Date.now())
      : (cfg.seed || Date.now());

    const caseType = chooseCaseTypeForNewRun();
    STATE.scenario = buildScenarioFromSeed(STATE.seed, caseType, STATE.diff);

    createWorldFromScenario(STATE.scenario);
    ensureChainBoardUI();
    ensureBossAndTriageUI();
    setupBossAndTriageFromScenario();

    applyResponsiveUILayout();
    applyCVRModeUI();
    ensureResearchBadge();

    loadRunSnapshotHint();

    setTool('uv');
    startTutorial();
    startTimer();

    wireInputs();

    WIN.addEventListener('resize', applyResponsiveUILayout, { passive:true });
    WIN.addEventListener('orientationchange', ()=> setTimeout(applyResponsiveUILayout, 120), { passive:true });

    logEventLocal('init', {
      seed: STATE.seed,
      research: !!STATE.research?.enabled,
      caseType: STATE.scenario?.caseType
    });
  }

  // -------------------------
  // Public API
  // -------------------------
  return {
    init,
    getState: ()=> STATE,
    addEvidence,
    setTool,
    pause: pauseGame,
    resume: resumeGame,
    restartCase,
    newCase,
    exportLocalCSV,
    stop: ()=> { STATE.running = false; try{ clearInterval(_timer); }catch{} }
  };
}