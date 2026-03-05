// === /webxr-health-mobile/herohealth/germ-detective/germ-detective.js ===
// Germ Detective CORE — PRODUCTION SAFE (PC/Mobile/cVR) — FINAL
// PATCH v20260305-GD-CORE-FINAL-A
//
// ✅ 3-Stage Mission: Warm (scan) → Trick (chain) → Boss (avgRisk target)
// ✅ Tools: UV / Swab / Camera / Clean (budgeted)
// ✅ AI Coach: riskScore + nextBestAction + 2 reasons (heuristic prediction)
// ✅ Auto-Report on Boss clear
// ✅ Result Modal + Badges
// ✅ Export CSV: summary.csv + events.csv (context columns)
// ✅ Flush-hardened Back HUB + HHA_LAST_SUMMARY
// ✅ hha:shoot support (from /herohealth/vr/vr-ui.js)
// NOTE: No networking / No Apps Script required.

export default function GameApp(opts = {}) {
  'use strict';

  const WIN = window;
  const DOC = document;

  // ---------- helpers ----------
  function qsParam(k, def=''){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }
  function nowMs(){ return (WIN.performance && WIN.performance.now) ? WIN.performance.now() : Date.now(); }
  function isoNow(){ return new Date().toISOString(); }
  function el(tag='div', cls=''){ const e = DOC.createElement(tag); if(cls) e.className = cls; return e; }
  function $(id){ return DOC.getElementById(id); }
  function safeJson(v){ try{ return JSON.stringify(v ?? {}); }catch{ return '"[unserializable]"'; } }
  function csvEscape(v){
    const s = String(v ?? '');
    if(/[",\n\r]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
    return s;
  }
  function downloadText(filename, text){
    try{
      const blob = new Blob([text], { type:'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = DOC.createElement('a');
      a.href = url; a.download = filename;
      DOC.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch{} }, 1200);
    }catch{}
  }

  // ---------- context (HHA-ish) from URL (boot passes too, but we read to be safe) ----------
  const CTX = {
    studyId: String(qsParam('studyId','')).trim(),
    phase: String(qsParam('phase','')).trim(),
    conditionGroup: String(qsParam('conditionGroup','')).trim(),
    sessionOrder: String(qsParam('sessionOrder','')).trim(),
    blockLabel: String(qsParam('blockLabel','')).trim(),
    siteCode: String(qsParam('siteCode','')).trim(),
    schoolYear: String(qsParam('schoolYear','')).trim(),
    semester: String(qsParam('semester','')).trim(),
  };

  // ---------- config ----------
  const cfg = Object.assign({
    mountId: 'app',
    timeSec: 120,
    seed: '0',
    run: String(qsParam('run','play')).toLowerCase(),
    diff: String(qsParam('diff','normal')).toLowerCase(),
    scene: String(qsParam('scene','classroom')).toLowerCase(),
    view: String(qsParam('view','pc')).toLowerCase(),
    pid:  String(qsParam('pid','anon')).trim() || 'anon',
    hub:  String(qsParam('hub','')) || '/webxr-health-mobile/herohealth/hub.html',

    autoReportOnBossClear: true,
    autoReportDelayMs: 900
  }, opts || {});

  // ---------- RNG ----------
  function hash32(str){
    str = String(str||'');
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function mulberry32(a){
    a = (a >>> 0) || 1;
    return function(){
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  let RNG = mulberry32(hash32(`${cfg.seed}|${cfg.scene}|${cfg.diff}|${cfg.run}`));

  // ---------- event log ----------
  const EVENT_LOG = []; // {tIso, ms, name, payloadJson, ctx cols...}
  function logEvt(name, payload){
    if(EVENT_LOG.length > 1500) EVENT_LOG.shift();
    EVENT_LOG.push({
      tIso: isoNow(),
      ms: Math.round(nowMs()),
      name: String(name||''),
      payloadJson: safeJson(payload),

      pid: cfg.pid,
      run: cfg.run,
      diff: cfg.diff,
      scene: cfg.scene,
      view: cfg.view,
      seed: String(cfg.seed||''),

      studyId: CTX.studyId,
      phase: CTX.phase,
      conditionGroup: CTX.conditionGroup,
      sessionOrder: CTX.sessionOrder,
      blockLabel: CTX.blockLabel,
      siteCode: CTX.siteCode,
      schoolYear: CTX.schoolYear,
      semester: CTX.semester
    });
  }
  function emitHHA(name, payload){
    const payload2 = Object.assign({
      pid: cfg.pid, run: cfg.run, diff: cfg.diff, scene: cfg.scene, view: cfg.view, seed: String(cfg.seed||'')
    }, CTX, payload || {});
    logEvt(name, payload2);
    try{
      WIN.dispatchEvent(new CustomEvent('hha:event', { detail:{ name, payload: payload2 } }));
    }catch{}
  }
  function emitLabels(type, payload){
    const payload2 = Object.assign({
      pid: cfg.pid, run: cfg.run, diff: cfg.diff, scene: cfg.scene, view: cfg.view, seed: String(cfg.seed||'')
    }, CTX, payload || {});
    logEvt('label:'+type, payload2);
    try{
      WIN.dispatchEvent(new CustomEvent('hha:labels', { detail:{ type, payload: payload2 } }));
    }catch{}
  }
  function saveLastSummary(reason, score){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game:'germ-detective',
        at: isoNow(),
        reason: reason || 'end',
        score: score || null,
        url: location.href,
        ctx: Object.assign({ pid: cfg.pid, run: cfg.run, diff: cfg.diff, scene: cfg.scene, view: cfg.view, seed: String(cfg.seed||'') }, CTX)
      }));
    }catch{}
  }

  // ---------- difficulty knobs ----------
  function budgetByDiff(d){
    d = String(d||'normal').toLowerCase();
    if(d==='easy') return 140;
    if(d==='hard') return 85;
    return 110;
  }
  function bossTargetByDiff(d){
    d = String(d||'normal').toLowerCase();
    if(d==='easy') return 38;
    if(d==='hard') return 28;
    return 33;
  }
  function warmNeedByDiff(d){
    d = String(d||'normal').toLowerCase();
    if(d==='easy') return 3;
    if(d==='hard') return 5;
    return 4;
  }

  // ---------- scene catalog ----------
  const SCENES = {
    classroom: [
      {name:'ลูกบิดประตู', importance:5},
      {name:'โต๊ะเรียน', importance:4},
      {name:'สวิตช์ไฟ', importance:3},
      {name:'ก๊อกน้ำ', importance:4},
      {name:'ราวจับ', importance:3},
      {name:'โทรศัพท์ครู', importance:4},
    ],
    home: [
      {name:'รีโมตทีวี', importance:4},
      {name:'ลูกบิดประตู', importance:5},
      {name:'โต๊ะกินข้าว', importance:3},
      {name:'ก๊อกน้ำ', importance:4},
      {name:'มือถือ', importance:5},
      {name:'ฟองน้ำ', importance:4},
    ],
    canteen: [
      {name:'ถาดอาหาร', importance:4},
      {name:'ช้อนกลาง', importance:5},
      {name:'โต๊ะโรงอาหาร', importance:3},
      {name:'ก๊อกน้ำ', importance:4},
      {name:'ราวจับ', importance:3},
      {name:'เขียง', importance:5},
    ],
  };

  // ---------- state ----------
  const STATE = {
    running:false,
    paused:false,
    ended:false,

    timeTotal: clamp(cfg.timeSec, 20, 600),
    timeLeft: clamp(cfg.timeSec, 20, 600),

    tool:'uv',                // uv|swab|cam|clean
    stage:1,                  // 1 warm, 2 trick, 3 boss
    phase:'investigate',      // investigate | intervene | report

    budget: { total: budgetByDiff(cfg.diff), spent: 0, actions: [] },

    hotspots: [],
    evidence: [],             // {tIso,type,target,info,tool,method}
    chain: { edges: [], inferred: [], truthPairs: [] },

    coach: { enabled:true, cooldownMs:6500, lastAt:0, lastKey:'' },

    score: null,
    _autoReportFired:false,

    _timer:null,
    _tick:null
  };

  // ---------- build hotspots (deterministic) ----------
  function layoutPositions(n){
    const pos=[];
    for(let i=0;i<n;i++){
      pos.push({ x: 8 + RNG()*84, y: 18 + RNG()*70 });
    }
    return pos;
  }
  function buildHotspots(){
    const src = (SCENES[cfg.scene] || SCENES.classroom).slice();
    const pos = layoutPositions(src.length);

    const riskScale = (cfg.diff==='hard') ? 1.18 : (cfg.diff==='easy') ? 0.85 : 1.0;

    STATE.hotspots = src.map((s,i)=>{
      const base = Math.round((22 + RNG()*55) * riskScale);
      return {
        id: 'hs_'+i,
        name: s.name,
        importance: clamp(s.importance||3,1,5),
        baseRisk: base,
        risk: base,
        xPct: pos[i].x,
        yPct: pos[i].y,

        scanned:false, swabbed:false, photoed:false,
        verified:false, cleaned:false,

        _infected:false,
        el:null
      };
    });

    // choose infected by importance+baseRisk
    const infectedCount = (cfg.diff==='hard') ? 4 : (cfg.diff==='easy') ? 2 : 3;
    const sorted = STATE.hotspots.slice().sort((a,b)=> (b.importance*100+b.baseRisk) - (a.importance*100+a.baseRisk));
    const infected = sorted.slice(0, infectedCount);
    infected.forEach(h=>{
      h._infected = true;
      h.risk = clamp(h.risk + 18 + RNG()*18, 0, 100);
    });
    STATE.hotspots.forEach(h=>{
      if(!h._infected) h.risk = clamp(h.risk - (5 + RNG()*12), 0, 100);
    });

    // truth chain pairs among infected (sorted by risk)
    const chain = infected.slice().sort((a,b)=> b.risk - a.risk);
    const truth=[];
    for(let i=0;i<Math.min(chain.length-1, 3);i++){
      truth.push([chain[i].name, chain[i+1].name]);
    }
    STATE.chain.truthPairs = truth;
  }

  // ---------- UI ----------
  let ROOT=null, STAGE=null, SIDE=null, COACH=null, MODAL=null;

  function ensureStyle(){
    if($('gdStyle')) return;
    const st = el('style'); st.id='gdStyle';
    st.textContent = `
      :root{
        --bg:#020617; --panel:rgba(2,6,23,.72); --stroke:rgba(148,163,184,.18);
        --text:#e5e7eb; --muted:#94a3b8; --good:#22c55e; --warn:#f59e0b; --cyan:#22d3ee;
      }
      .gd-topbar{
        position:sticky; top:0; z-index:50;
        display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;
        padding:8px 10px; background:rgba(2,6,23,.82);
        border-bottom:1px solid rgba(148,163,184,.16);
        backdrop-filter: blur(8px);
      }
      .pill{ border:1px solid var(--stroke); background:rgba(255,255,255,.02); border-radius:999px;
        padding:6px 10px; font-size:12px; font-weight:900; color:rgba(229,231,235,.92); }
      .btn{
        appearance:none; border:1px solid var(--stroke); background:rgba(255,255,255,.03);
        color:rgba(229,231,235,.96); border-radius:12px; padding:10px 12px;
        font-weight:1000; cursor:pointer;
      }
      .btn:active{ transform:translateY(1px); }
      .btn.good{ border-color:rgba(34,197,94,.32); background:rgba(34,197,94,.12); }
      .btn.cyan{ border-color:rgba(34,211,238,.32); background:rgba(34,211,238,.10); }
      .btn.warn{ border-color:rgba(245,158,11,.32); background:rgba(245,158,11,.10); }

      .gd-wrap{ display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:10px; padding:10px; }
      @media (max-width:980px){ .gd-wrap{ grid-template-columns:1fr; } }

      .gd-stage{
        position:relative; min-height:58vh;
        border:1px solid var(--stroke); border-radius:16px;
        background:rgba(255,255,255,.01);
        overflow:hidden;
      }
      .gd-side{ display:grid; gap:10px; align-content:start; }

      .gd-panel{
        border:1px solid var(--stroke);
        border-radius:16px;
        background:rgba(2,6,23,.70);
        overflow:hidden;
      }
      .gd-panel .head{
        padding:10px 12px;
        border-bottom:1px solid rgba(148,163,184,.10);
        display:flex; justify-content:space-between; gap:8px; align-items:center;
      }
      .gd-panel .body{ padding:10px; }

      .gd-toolbar{ position:absolute; left:12px; top:12px; z-index:20; display:flex; gap:6px; flex-wrap:wrap; max-width:calc(100% - 24px); }
      .gd-timer{
        position:absolute; left:12px; top:60px; z-index:20;
        font-weight:1000; font-size:12px;
        padding:6px 10px; border-radius:999px;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.70);
      }

      .gd-spot{
        position:absolute;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(255,255,255,.03);
        border-radius:14px;
        padding:10px 12px;
        font-weight:1000;
        cursor:pointer;
        user-select:none;
        box-shadow:0 12px 30px rgba(0,0,0,.20);
      }
      .gd-spot:hover{ transform: translateY(-1px); }
      .gd-spot .sub{ display:block; font-size:11px; font-weight:900; opacity:.78; margin-top:2px; }
      .gd-spot.hot{ box-shadow:0 0 0 2px rgba(244,63,94,.28), 0 18px 40px rgba(0,0,0,.25); }
      .gd-spot.cleaned{ outline:2px solid rgba(34,197,94,.55); }
      .gd-spot.verified{ outline:2px solid rgba(34,211,238,.55); }

      /* cVR strict: click disabled, use hha:shoot */
      html[data-view="cvr"] .gd-spot{ pointer-events:none; }

      .mini-list{ display:grid; gap:6px; max-height:220px; overflow:auto; }
      .mini-item{ border:1px solid rgba(148,163,184,.12); border-radius:12px; padding:8px; background:rgba(255,255,255,.02); font-size:12px; line-height:1.35; }
      .budgetbar{ height:10px; border-radius:999px; overflow:hidden; background:rgba(148,163,184,.12); border:1px solid rgba(148,163,184,.18); }
      .budgetfill{ height:100%; width:100%; background: linear-gradient(90deg, rgba(16,185,129,.9), rgba(34,211,238,.9)); }

      .gd-coach{
        position:fixed; left:50%;
        top:calc(10px + env(safe-area-inset-top,0px));
        transform:translateX(-50%);
        z-index:9998;
        max-width:min(900px, 92vw);
        border:1px solid rgba(148,163,184,.18);
        border-radius:999px;
        background:rgba(2,6,23,.78);
        padding:10px 12px;
        font-weight:950;
        font-size:13px;
        color:rgba(229,231,235,.96);
        box-shadow:0 16px 50px rgba(0,0,0,.35);
        backdrop-filter: blur(10px);
        display:none;
      }
      .gd-coach.show{ display:block; }
      .gd-coach small{ display:block; color:rgba(148,163,184,.95); font-weight:900; margin-top:2px; }

      /* result modal */
      .gd-modal{ position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.55); display:none; align-items:center; justify-content:center; padding:16px; }
      .gd-modal.show{ display:flex; }
      .gd-modal-card{
        width:min(980px, 96vw);
        border:1px solid rgba(148,163,184,.18);
        border-radius:18px;
        background:rgba(2,6,23,.86);
        box-shadow:0 26px 90px rgba(0,0,0,.45);
        overflow:hidden;
      }
      .gd-modal-head{
        padding:12px 14px;
        border-bottom:1px solid rgba(148,163,184,.14);
        display:flex; gap:10px; align-items:center; justify-content:space-between; flex-wrap:wrap;
      }
      .gd-rank{ font-weight:1100; font-size:18px; letter-spacing:.3px; }
      .gd-modal-body{ padding:14px; display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      @media (max-width:860px){ .gd-modal-body{ grid-template-columns:1fr; } }
      .gd-kpi{ border:1px solid rgba(148,163,184,.14); border-radius:14px; padding:12px; background:rgba(255,255,255,.02); }
      .gd-kpi b{ font-size:22px; }
      .gd-grid2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .gd-actions{
        padding:12px 14px;
        border-top:1px solid rgba(148,163,184,.14);
        display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;
      }
      .gd-small{ color:rgba(148,163,184,.95); font-weight:850; font-size:12px; line-height:1.35; }
      .gd-badges{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
      .gd-badge{ border:1px solid rgba(148,163,184,.18); background:rgba(255,255,255,.02); border-radius:999px; padding:6px 10px; font-weight:1000; font-size:12px; }
      .gd-badge.on{ border-color: rgba(34,211,238,.30); background: rgba(34,211,238,.10); }
    `;
    DOC.head.appendChild(st);
  }

  function buildUI(){
    ensureStyle();

    ROOT = cfg.mountId ? $(cfg.mountId) : null;
    if(!ROOT) ROOT = DOC.body;

    // coach overlay
    COACH = $('gdCoach');
    if(!COACH){
      COACH = el('div','gd-coach');
      COACH.id='gdCoach';
      DOC.body.appendChild(COACH);
    }

    // modal
    MODAL = $('gdModal');
    if(!MODAL){
      MODAL = el('div','gd-modal'); MODAL.id='gdModal';
      MODAL.innerHTML = `
        <div class="gd-modal-card" role="dialog" aria-modal="true">
          <div class="gd-modal-head">
            <div>
              <div class="gd-rank" id="gdResTitle">ผลลัพธ์</div>
              <div class="gd-small" id="gdResMeta">-</div>
              <div class="gd-badges" id="gdResBadges"></div>
            </div>
            <div class="pill" id="gdResPill">-</div>
          </div>

          <div class="gd-modal-body">
            <div class="gd-kpi">
              <div class="gd-small">คะแนนรวม</div>
              <b id="gdResFinal">-</b>
              <div class="gd-small" style="margin-top:6px" id="gdResMission">-</div>
            </div>

            <div class="gd-kpi">
              <div class="gd-small">Chain ที่สรุปได้</div>
              <b id="gdResChain">-</b>
              <div class="gd-small" style="margin-top:6px" id="gdResRisk">-</div>
            </div>

            <div class="gd-grid2">
              <div class="gd-kpi">
                <div class="gd-small">Accuracy</div>
                <b id="gdResAcc">-</b>
                <div class="gd-small" id="gdResAccSub">-</div>
              </div>
              <div class="gd-kpi">
                <div class="gd-small">Intervention</div>
                <b id="gdResInt">-</b>
                <div class="gd-small" id="gdResIntSub">-</div>
              </div>
            </div>

            <div class="gd-grid2">
              <div class="gd-kpi">
                <div class="gd-small">Chain Score</div>
                <b id="gdResChainScore">-</b>
                <div class="gd-small" id="gdResChainSub">-</div>
              </div>
              <div class="gd-kpi">
                <div class="gd-small">Speed</div>
                <b id="gdResSpeed">-</b>
                <div class="gd-small" id="gdResSpeedSub">-</div>
              </div>
            </div>
          </div>

          <div class="gd-actions">
            <button class="btn" id="gdBtnClose" type="button">ปิด</button>
            <button class="btn" id="gdBtnSummary" type="button">⬇️ summary.csv</button>
            <button class="btn" id="gdBtnEvents" type="button">⬇️ events.csv</button>
            <button class="btn warn" id="gdBtnRetry" type="button">🔁 Retry</button>
            <button class="btn warn" id="gdBtnRetrySame" type="button">🔁 Same Seed</button>
            <button class="btn good" id="gdBtnHub" type="button">🏠 กลับ HUB</button>
          </div>
        </div>
      `;
      DOC.body.appendChild(MODAL);

      $('gdBtnClose').onclick = ()=> hideModal();
      $('gdBtnSummary').onclick = ()=> exportSummaryCSV();
      $('gdBtnEvents').onclick  = ()=> exportEventsCSV();
      $('gdBtnRetry').onclick = ()=> { hideModal(); retry(false); };
      $('gdBtnRetrySame').onclick = ()=> { hideModal(); retry(true); };
      $('gdBtnHub').onclick = ()=> { flushAndGoHub('backhub'); };

      MODAL.addEventListener('click', (e)=>{ if(e.target === MODAL) hideModal(); });
      DOC.addEventListener('keydown', (e)=>{ if(MODAL.classList.contains('show') && e.key==='Escape') hideModal(); });
    }

    // topbar + layout
    const top = el('div','gd-topbar');
    top.innerHTML = `
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <span class="pill" id="gdPillPhase">phase: investigate</span>
        <span class="pill" id="gdPillStage">stage: 1</span>
        <span class="pill" id="gdPillTool">tool: UV</span>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="btn" id="gdPause" type="button">⏸ Pause</button>
        <button class="btn warn" id="gdHelp" type="button">❓ Help</button>
        <button class="btn good" id="gdSubmit" type="button">🧾 ส่งรายงาน</button>
      </div>
    `;

    const wrap = el('div','gd-wrap');
    STAGE = el('div','gd-stage'); STAGE.id='gdStage';
    SIDE  = el('div','gd-side');

    const toolbar = el('div','gd-toolbar');
    toolbar.innerHTML = `
      <button class="btn cyan" id="gdToolUV" type="button">UV</button>
      <button class="btn cyan" id="gdToolSwab" type="button">Swab</button>
      <button class="btn cyan" id="gdToolCam" type="button">Camera</button>
      <button class="btn good" id="gdToolClean" type="button">Clean</button>
    `;
    const timer = el('div','gd-timer'); timer.id='gdTimer';

    STAGE.appendChild(toolbar);
    STAGE.appendChild(timer);

    const pMission = el('div','gd-panel');
    pMission.innerHTML = `
      <div class="head"><strong>🎯 Mission</strong><span class="pill" id="gdMissionPill">Warm</span></div>
      <div class="body" id="gdMissionBody"></div>
    `;

    const pBudget = el('div','gd-panel');
    pBudget.innerHTML = `
      <div class="head"><strong>🧰 Budget</strong><span class="pill" id="gdBudgetPill">-</span></div>
      <div class="body">
        <div class="budgetbar"><div class="budgetfill" id="gdBudgetFill"></div></div>
        <div class="mini-list" id="gdBudgetList" style="margin-top:10px"></div>
      </div>
    `;

    const pEvidence = el('div','gd-panel');
    pEvidence.innerHTML = `
      <div class="head"><strong>🧾 Evidence</strong><span class="pill" id="gdEvidencePill">0</span></div>
      <div class="body"><div class="mini-list" id="gdEvidenceList"></div></div>
    `;

    const pCoach = el('div','gd-panel');
    pCoach.innerHTML = `
      <div class="head"><strong>🤖 AI Coach</strong><span class="pill" id="gdRiskPill">risk: -</span></div>
      <div class="body"><div class="mini-item" id="gdCoachBox">เริ่มสืบสวน… UV → Swab → ต่อ chain → Clean</div></div>
    `;

    SIDE.appendChild(pMission);
    SIDE.appendChild(pBudget);
    SIDE.appendChild(pEvidence);
    SIDE.appendChild(pCoach);

    wrap.appendChild(STAGE);
    wrap.appendChild(SIDE);

    ROOT.innerHTML = '';
    ROOT.appendChild(top);
    ROOT.appendChild(wrap);

    $('gdToolUV').onclick = ()=> setTool('uv');
    $('gdToolSwab').onclick = ()=> setTool('swab');
    $('gdToolCam').onclick = ()=> setTool('cam');
    $('gdToolClean').onclick = ()=> setTool('clean');

    $('gdPause').onclick = ()=> togglePause();
    $('gdHelp').onclick = ()=> showCoach(
      'วิธีเล่น: UV หา “จุดสัมผัสสูง” → Swab ยืนยัน → ต่อ chain → Clean ลด risk (งบจำกัด)',
      'cVR: แตะจอเพื่อยิงจาก crosshair'
    );
    $('gdSubmit').onclick = ()=> end('submitted');
  }

  function showCoach(main, sub){
    if(!COACH) return;
    COACH.innerHTML = `${main}${sub?`<small>${sub}</small>`:''}`;
    COACH.classList.add('show');
    setTimeout(()=>{ try{ COACH.classList.remove('show'); }catch{} }, 3600);
  }

  // ---------- core mechanics ----------
  function setTool(t){
    t = String(t||'').toLowerCase();
    if(!['uv','swab','cam','clean'].includes(t)) return;
    STATE.tool = t;
    refreshPills();
    emitHHA('tool_change', { tool:t });
  }

  function setStage(s){
    s = clamp(s,1,3);
    if(STATE.stage === s) return;
    STATE.stage = s;
    refreshPills();
    emitHHA('stage_change', { stage:s });
  }

  function setPhase(p){
    p = String(p||'investigate');
    if(STATE.phase === p) return;
    STATE.phase = p;
    refreshPills();
    emitHHA('phase_change', { phase:p });
  }

  function togglePause(){
    if(STATE.ended) return;
    STATE.paused = !STATE.paused;
    const b = $('gdPause');
    if(b) b.textContent = STATE.paused ? '▶ Resume' : '⏸ Pause';
    emitHHA(STATE.paused?'pause':'resume', { paused: STATE.paused ? 1 : 0 });
  }

  function budgetLeft(){ return Math.max(0, STATE.budget.total - STATE.budget.spent); }
  function avgRisk(){
    if(!STATE.hotspots.length) return 0;
    return STATE.hotspots.reduce((a,h)=>a+(Number(h.risk)||0),0) / STATE.hotspots.length;
  }
  function scannedCount(){ return STATE.hotspots.reduce((a,h)=>a+(h.scanned?1:0),0); }
  function verifiedCount(){ return STATE.hotspots.reduce((a,h)=>a+(h.verified?1:0),0); }
  function uniqueTargets(){ return new Set(STATE.evidence.map(e=>e.target)).size; }

  function spotSubline(h){
    const f=[];
    if(h.scanned) f.push('UV');
    if(h.swabbed) f.push('SWAB');
    if(h.photoed) f.push('CAM');
    if(h.cleaned) f.push('CLEAN');
    if(h.verified) f.push('VERIFIED');
    return f.length ? f.join(' • ') : 'แตะเพื่อสืบสวน';
  }
  function applySpotClass(h){
    if(!h.el) return;
    h.el.classList.toggle('cleaned', !!h.cleaned);
    h.el.classList.toggle('verified', !!h.verified);
    h.el.classList.toggle('hot', (!h.cleaned) && h.risk >= 65);
    const sub = h.el.querySelector('.sub');
    if(sub) sub.textContent = spotSubline(h);
  }

  function renderHotspots(){
    // clear old
    STAGE.querySelectorAll('.gd-spot').forEach(n=> n.remove());
    STATE.hotspots.forEach(h=>{
      const d = el('div','gd-spot');
      d.dataset.id = h.id;
      d.style.left = `${h.xPct}%`;
      d.style.top  = `${h.yPct}%`;
      d.innerHTML  = `${h.name}<span class="sub">${spotSubline(h)}</span>`;
      d.addEventListener('click', ()=> onHotspotAction(h, 'click'), {passive:true});
      STAGE.appendChild(d);
      h.el = d;
      applySpotClass(h);
    });
  }

  function addEvidence(rec){
    const r = Object.assign({ tIso: isoNow(), tool: STATE.tool }, rec);
    STATE.evidence.push(r);
    emitHHA('evidence_added', r);
    updateEvidenceUI();
  }

  function cleanCost(h){
    const base = 12 + h.importance*4;
    const m = (cfg.diff==='hard') ? 1.15 : (cfg.diff==='easy') ? 0.90 : 1.0;
    return Math.round(base*m);
  }
  function cleanEffect(h){
    const base = 18 + h.importance*6;
    const bonus = (h.verified?10:0) + (h.scanned?6:0);
    const m = (cfg.diff==='hard') ? 0.92 : (cfg.diff==='easy') ? 1.06 : 1.0;
    return Math.round((base + bonus)*m);
  }

  function onHotspotAction(h, method){
    if(!STATE.running || STATE.paused || STATE.ended) return;

    if(STATE.tool === 'uv'){
      h.scanned = true;
      addEvidence({ type:'hotspot', target:h.name, info:'พบร่องรอยด้วย UV', method, tool:'uv' });
      h.risk = clamp(h.risk + (h._infected ? 8 : 2) + RNG()*4, 0, 100);
      applySpotClass(h);
      emitHHA('hotspot_uv', { target:h.name, risk:h.risk });

    } else if(STATE.tool === 'swab'){
      h.swabbed = true;
      const confirm = h._infected ? (RNG() < 0.92) : (RNG() < 0.15);
      if(confirm){
        h.verified = true;
        h.risk = clamp(h.risk + 10 + RNG()*6, 0, 100);
        addEvidence({ type:'sample', target:h.name, info:'Swab ยืนยัน: เสี่ยงจริง', method, tool:'swab' });
      }else{
        h.risk = clamp(h.risk - (4 + RNG()*6), 0, 100);
        addEvidence({ type:'sample', target:h.name, info:'Swab: ไม่พบเชื้อ (อาจ false negative)', method, tool:'swab' });
      }
      applySpotClass(h);
      emitHHA('hotspot_swab', { target:h.name, verified: h.verified?1:0, risk:h.risk });

    } else if(STATE.tool === 'cam'){
      h.photoed = true;
      addEvidence({ type:'photo', target:h.name, info:'ถ่ายภาพหลักฐาน', method, tool:'cam' });
      applySpotClass(h);
      emitHHA('hotspot_cam', { target:h.name });

    } else if(STATE.tool === 'clean'){
      if(STATE.phase !== 'intervene' && STATE.stage < 3){
        showCoach('ยังไม่ถึงช่วง Clean แบบคุ้มสุด', 'ทำ Warm/Trick ก่อน จะได้โบนัสและคำใบ้ดีขึ้น');
        return;
      }
      const cost = cleanCost(h);
      const left = budgetLeft();
      if(left < cost){
        showCoach('งบไม่พอ!', `เหลือ ${left} แต่ต้องใช้ ${cost}`);
        emitHHA('clean_failed', { target:h.name, cost, left });
        return;
      }
      const before = Math.round(h.risk);
      const red = cleanEffect(h);
      h.risk = clamp(h.risk - red, 0, 100);
      h.cleaned = true;
      STATE.budget.spent += cost;
      STATE.budget.actions.push({ tIso: isoNow(), target:h.name, cost, riskBefore:before, riskAfter:Math.round(h.risk) });
      addEvidence({ type:'clean', target:h.name, info:`ทำความสะอาด (-${red} risk)`, method, tool:'clean' });
      applySpotClass(h);
      updateBudgetUI();
      emitHHA('clean_done', { target:h.name, cost, riskBefore:before, riskAfter:Math.round(h.risk), budgetLeft: budgetLeft() });
    }

    updateMissionUI();
    coachTick();
  }

  // ---------- chain inference ----------
  function addEdge(a,b,w){
    if(!a||!b||a===b) return;
    if(STATE.chain.edges.some(e=>e.a===a && e.b===b)) return;
    STATE.chain.edges.push({a,b,w});
  }
  function bestChain(edges){
    const nodes = Array.from(new Set(edges.flatMap(e=>[e.a,e.b])));
    if(nodes.length < 3) return [];
    const wm = new Map();
    edges.forEach(e=> wm.set(e.a+'>'+e.b, (wm.get(e.a+'>'+e.b)||0) + (e.w||1)));

    let best = { s:-1, c:[] };
    for(const a of nodes) for(const b of nodes) for(const c of nodes){
      if(a===b||b===c||a===c) continue;
      const wab=wm.get(a+'>'+b)||0, wbc=wm.get(b+'>'+c)||0;
      if(!wab || !wbc) continue;
      let score = wab + wbc;
      let chain = [a,b,c];
      for(const d of nodes){
        if(d===a||d===b||d===c) continue;
        const wcd = wm.get(c+'>'+d)||0;
        if(wcd && score+wcd>score){ score += wcd; chain = [a,b,c,d]; }
      }
      if(score > best.s) best = { s:score, c:chain };
    }
    return best.c;
  }
  function updateChain(){
    // derive from evidence sequence
    const seq = STATE.evidence
      .filter(e=>['hotspot','sample','photo','clean'].includes(e.type))
      .slice()
      .sort((x,y)=> String(x.tIso).localeCompare(String(y.tIso)));

    for(let i=0;i<seq.length-1;i++){
      const a = seq[i].target, b = seq[i+1].target;
      if(a===b) continue;
      const ha = STATE.hotspots.find(h=>h.name===a);
      const hb = STATE.hotspots.find(h=>h.name===b);
      const wa = ha ? (ha.verified?3:ha.scanned?1:0) : 0;
      const wb = hb ? (hb.verified?3:hb.scanned?1:0) : 0;
      addEdge(a,b, 1 + wa + wb);
    }

    // add extra edges among risky scanned targets
    const risky = STATE.hotspots
      .filter(h=>h.scanned||h.swabbed||h.photoed)
      .slice()
      .sort((a,b)=> (b.risk+b.importance*8) - (a.risk+a.importance*8))
      .slice(0,4);
    for(let i=0;i<risky.length-1;i++){
      addEdge(risky[i].name, risky[i+1].name, 2 + risky[i].importance);
    }

    STATE.chain.inferred = bestChain(STATE.chain.edges) || [];
  }
  function chainShort(){
    updateChain();
    const c = STATE.chain.inferred;
    return (c && c.length>=2) ? c.slice(0,4).join(' → ') : '';
  }

  // ---------- AI coach ----------
  function computeRiskScore(){
    const avg = Math.round(avgRisk());
    const importantUnscanned = STATE.hotspots.filter(h=>h.importance>=4 && !h.scanned).length;
    const pressure = 1 - (STATE.timeLeft/STATE.timeTotal);
    return clamp(Math.round(avg*0.7 + importantUnscanned*8 + pressure*18), 0, 100);
  }
  function nextBestAction(){
    const cand = STATE.hotspots.filter(h=>!h.cleaned);
    cand.sort((a,b)=>{
      const sa = (a.risk*1.15 + a.importance*10) - (a.scanned?0:12) - (a.verified?0:6);
      const sb = (b.risk*1.15 + b.importance*10) - (b.scanned?0:12) - (b.verified?0:6);
      return sb-sa;
    });
    return cand[0] ? cand[0].name : null;
  }
  function coachTick(){
    if(!STATE.coach.enabled || STATE.ended) return;
    const t = nowMs();
    if(t - STATE.coach.lastAt < STATE.coach.cooldownMs) return;

    const risk = computeRiskScore();
    const nba  = nextBestAction();

    const un = STATE.hotspots
      .filter(h=>h.importance>=4 && !h.scanned)
      .sort((a,b)=> (b.importance*12+b.risk) - (a.importance*12+a.risk));

    const reason1 = un[0] ? `ยังไม่สแกนจุดสัมผัสสูง: ${un[0].name}` : `ลองตรวจ ${nba||'จุดเสี่ยง'} เพราะคุ้มสุด`;
    const reason2 = un[1] ? `อีกจุดสำคัญ: ${un[1].name}` : (STATE.timeLeft <= Math.max(20, Math.floor(STATE.timeTotal*0.25)) ? 'เวลาใกล้หมด — เลือกจุดคุ้มงบ' : 'ใช้ Swab เพื่อยืนยันก่อน');

    const key = `${STATE.stage}|${STATE.phase}|${risk}|${nba}|${reason1}|${reason2}`;
    if(key === STATE.coach.lastKey) return;

    const stuck = (STATE.stage===1 && scannedCount() < warmNeedByDiff(cfg.diff) && STATE.timeLeft < STATE.timeTotal-15);
    const warn  = (risk >= 70) || stuck;

    const rp = $('gdRiskPill'); if(rp) rp.textContent = `risk: ${risk}`;
    const box = $('gdCoachBox');
    if(box) box.textContent = `risk=${risk} • next=${nba||'-'} • stage=${STATE.stage} • phase=${STATE.phase}`;

    if(warn && nba){
      showCoach(`AI Coach: แนะนำไปที่ “${nba}”`, `เหตุผล: (1) ${reason1} (2) ${reason2}`);
      emitHHA('ai_coach_tip', { riskScore:risk, nextBestAction:nba, reason1, reason2 });
      STATE.coach.lastAt = t;
      STATE.coach.lastKey = key;
    }
  }

  // ---------- mission UI ----------
  function refreshPills(){
    const toolTxt = (STATE.tool==='uv'?'UV':STATE.tool==='swab'?'Swab':STATE.tool==='cam'?'Camera':'Clean');
    const m = (STATE.stage===1?'Warm':STATE.stage===2?'Trick':'Boss');

    const p1 = $('gdPillPhase'); if(p1) p1.textContent = `phase: ${STATE.phase}`;
    const p2 = $('gdPillStage'); if(p2) p2.textContent = `stage: ${STATE.stage}`;
    const p3 = $('gdPillTool');  if(p3) p3.textContent = `tool: ${toolTxt}`;
    const mp = $('gdMissionPill'); if(mp) mp.textContent = m;
  }

  function updateTimerUI(){
    const t = $('gdTimer');
    if(t) t.textContent = `เวลา: ${Math.max(0, STATE.timeLeft)}s`;
  }

  function updateBudgetUI(){
    const left = budgetLeft();
    const pill = $('gdBudgetPill'); if(pill) pill.textContent = `${left}/${STATE.budget.total}`;
    const fill = $('gdBudgetFill'); if(fill) fill.style.width = `${Math.round((left/STATE.budget.total)*100)}%`;

    const list = $('gdBudgetList');
    if(list){
      list.innerHTML = '';
      const last = STATE.budget.actions.slice(-6).reverse();
      if(!last.length){
        list.appendChild(mkItem(`ยังไม่ใช้ Clean • งบคงเหลือ ${left}`));
      } else {
        last.forEach(a=> list.appendChild(mkItem(`Clean: ${a.target} • -${a.cost} • risk ${a.riskBefore}→${a.riskAfter}`)));
      }
    }
  }

  function updateEvidenceUI(){
    const pill = $('gdEvidencePill'); if(pill) pill.textContent = String(STATE.evidence.length);
    const list = $('gdEvidenceList');
    if(list){
      list.innerHTML = '';
      const last = STATE.evidence.slice(-10).reverse();
      if(!last.length){
        list.appendChild(mkItem('ยังไม่มีหลักฐาน • เริ่มจาก UV ที่ “ลูกบิด/มือถือ/ช้อนกลาง”'));
      } else {
        last.forEach(e=> list.appendChild(mkItem(`${String(e.type||'').toUpperCase()} • ${e.target} • ${e.info||''}`)));
      }
    }
  }

  function mkItem(text){
    const d = el('div','mini-item');
    d.textContent = text;
    return d;
  }

  function updateMissionUI(){
    const box = $('gdMissionBody'); if(!box) return;

    const warmNeed = warmNeedByDiff(cfg.diff);
    const warmDone = scannedCount();
    const trickDone = (function(){ updateChain(); return (STATE.chain.inferred||[]).length >= 3; })();
    const bossTarget = bossTargetByDiff(cfg.diff);
    const bossScore  = Math.round(avgRisk());
    const bossDone   = bossScore <= bossTarget;

    box.innerHTML = '';
    box.appendChild(mkItem(`Stage 1: UV อย่างน้อย ${warmNeed} จุด (ตอนนี้ ${warmDone}/${warmNeed})`));
    box.appendChild(mkItem(`Stage 2: ต่อ chain A→B→C (ตอนนี้ ${chainShort() || 'ยังไม่มี'})`));
    box.appendChild(mkItem(`Stage 3: Clean ลด risk เฉลี่ย ≤ ${bossTarget} (ตอนนี้ ${bossScore})`));
    box.appendChild(mkItem('Tip: Swab ช่วย “ยืนยัน” ทำให้ chain/คะแนนแม่นขึ้น'));

    if(STATE.stage===1 && warmDone >= warmNeed){
      setStage(2);
      showCoach('เข้าสู่ Trick Stage!', 'ต่อ A→B→C จากลำดับที่คุณสืบ');
    }
    if(STATE.stage===2 && trickDone){
      setStage(3);
      setPhase('intervene');
      showCoach('เข้าสู่ Boss Stage!', 'ใช้ Clean แบบคุ้มงบ');
    }
    if(STATE.stage===3 && bossDone){
      setPhase('report');
      showCoach('ผ่าน Boss แล้ว! ✅', cfg.autoReportOnBossClear ? 'กำลังสรุปผลอัตโนมัติ…' : 'กด “ส่งรายงาน”');

      if(cfg.autoReportOnBossClear && !STATE._autoReportFired && !STATE.ended){
        STATE._autoReportFired = true;
        setTimeout(()=>{ if(!STATE.ended) end('auto_report'); }, clamp(cfg.autoReportDelayMs, 200, 4000));
      }
    }
  }

  // ---------- shoot support (cVR) ----------
  function hotspotFromPoint(x,y,lockPx){
    // direct element hit
    let elAt=null;
    try{ elAt = DOC.elementFromPoint(x,y); }catch{}
    const spot = elAt && elAt.closest ? elAt.closest('.gd-spot') : null;
    if(spot && spot.dataset && spot.dataset.id){
      const id = spot.dataset.id;
      return STATE.hotspots.find(h=>h.id===id) || null;
    }

    // nearest center
    lockPx = clamp(lockPx, 8, 120);
    let best=null, bestD=1e9;
    for(const h of STATE.hotspots){
      if(!h.el) continue;
      const r = h.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const d  = Math.hypot(cx-x, cy-y);
      if(d < bestD){ bestD=d; best=h; }
    }
    return (best && bestD <= lockPx) ? best : null;
  }

  function onShoot(ev){
    if(!STATE.running || STATE.paused || STATE.ended) return;
    const d = ev && ev.detail ? ev.detail : {};
    const x = Number(d.x), y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    const h = hotspotFromPoint(x,y,lockPx);
    if(h) onHotspotAction(h, d.source || 'shoot');
    else emitHHA('shoot_miss', { x,y,lockPx, source:d.source||'shoot' });
  }

  // ---------- scoring + badges + modal ----------
  function computeScore(reason){
    const truthInf = STATE.hotspots.filter(h=>h._infected).map(h=>h.name);
    const predicted = STATE.hotspots.filter(h=>h.verified).map(h=>h.name);

    const tp = predicted.filter(x=>truthInf.includes(x)).length;
    const fp = predicted.filter(x=>!truthInf.includes(x)).length;
    const fn = truthInf.filter(x=>!predicted.includes(x)).length;

    const precision = (tp+fp) ? tp/(tp+fp) : 0;
    const recall    = (tp+fn) ? tp/(tp+fn) : 0;
    const accScore  = Math.round((precision*0.6 + recall*0.4)*100);

    updateChain();
    const inf = STATE.chain.inferred || [];
    const infPairs = [];
    for(let i=0;i<inf.length-1;i++) infPairs.push(`${inf[i]}>${inf[i+1]}`);
    const truthPairs = (STATE.chain.truthPairs||[]).map(p=>`${p[0]}>${p[1]}`);
    const chainHit = infPairs.filter(p=>truthPairs.includes(p)).length;
    const chainScore = Math.round(clamp((chainHit/Math.max(1,truthPairs.length))*100, 0, 100));

    const speedScore = Math.round(clamp((STATE.timeLeft/STATE.timeTotal)*100, 0, 100));

    const avgEnd = Math.round(avgRisk());
    const avgStart = Math.round(STATE.hotspots.reduce((a,h)=>a+(h.baseRisk||0),0)/Math.max(1,STATE.hotspots.length));
    const reduce = clamp(avgStart-avgEnd, -100, 100);
    const interventionScore = Math.round(clamp(50 + reduce*1.2, 0, 100));

    const warmOk = scannedCount() >= warmNeedByDiff(cfg.diff);
    const trickOk = (inf.length >= 3);
    const bossOk = avgEnd <= bossTargetByDiff(cfg.diff);
    const missionBonus = (warmOk?6:0) + (trickOk?10:0) + (bossOk?14:0);

    const base = accScore*0.30 + chainScore*0.24 + interventionScore*0.26 + speedScore*0.20;
    const final = Math.round(clamp(base + missionBonus, 0, 100));
    const rank  = final>=90?'S':final>=80?'A':final>=70?'B':final>=60?'C':'D';

    const score = {
      reason, final, rank,
      accuracy:{score:accScore,tp,fp,fn,precision:+precision.toFixed(3),recall:+recall.toFixed(3)},
      chain:{score:chainScore,hit:chainHit,truthPairs:truthPairs.length,chain:(inf.length?inf.slice(0,4).join(' → '):'')},
      speed:{score:speedScore,timeLeft:STATE.timeLeft,timeTotal:STATE.timeTotal},
      intervention:{score:interventionScore,avgRiskStart:avgStart,avgRiskEnd:avgEnd,budgetSpent:STATE.budget.spent,budgetLeft:budgetLeft()},
      mission:{warmOk,trickOk,bossOk,bonus:missionBonus},
      seed:String(cfg.seed||''),
      ctx:Object.assign({ pid:cfg.pid, run:cfg.run, diff:cfg.diff, scene:cfg.scene, view:cfg.view }, CTX)
    };

    score.badges = computeBadges(score);
    return score;
  }

  function computeBadges(score){
    const badges=[];
    if(score.final >= 85) badges.push({ id:'super', label:'🕵️ Super Sleuth' });
    if(score.chain.score >= 80) badges.push({ id:'chain', label:'🧩 Chain Master' });
    const pctSpent = STATE.budget.total ? (score.intervention.budgetSpent/STATE.budget.total) : 1;
    if(pctSpent <= 0.55 && score.intervention.score >= 70) badges.push({ id:'budget', label:'💰 Budget Hero' });
    const speedPct = score.speed.timeTotal ? (score.speed.timeLeft/score.speed.timeTotal) : 0;
    if(speedPct >= 0.35) badges.push({ id:'speed', label:'⚡ Speed Runner' });
    return badges;
  }

  function showModal(score){
    if(!MODAL) return;

    $('gdResTitle').textContent = `ผลลัพธ์ • Rank ${score.rank}`;
    $('gdResPill').textContent  = `คะแนน ${score.final}/100`;

    const ctxLine = [
      CTX.studyId && `studyId=${CTX.studyId}`,
      CTX.phase && `phase=${CTX.phase}`,
      CTX.conditionGroup && `cond=${CTX.conditionGroup}`,
      CTX.sessionOrder && `order=${CTX.sessionOrder}`,
      CTX.blockLabel && `block=${CTX.blockLabel}`,
      CTX.siteCode && `site=${CTX.siteCode}`
    ].filter(Boolean).join(' • ');
    $('gdResMeta').textContent = `scene=${cfg.scene} • diff=${cfg.diff} • run=${cfg.run} • pid=${cfg.pid} • reason=${score.reason} • seed=${score.seed}` + (ctxLine?` • ${ctxLine}`:'');

    $('gdResFinal').textContent = String(score.final);
    $('gdResChain').textContent = score.chain.chain || '-';
    $('gdResRisk').textContent  = `avgRisk: ${score.intervention.avgRiskEnd} (start ${score.intervention.avgRiskStart}) • budgetLeft ${score.intervention.budgetLeft}`;
    $('gdResMission').textContent = `Mission: Warm=${score.mission.warmOk?'✅':'❌'} Trick=${score.mission.trickOk?'✅':'❌'} Boss=${score.mission.bossOk?'✅':'❌'} • bonus +${score.mission.bonus}`;

    $('gdResAcc').textContent = String(score.accuracy.score);
    $('gdResAccSub').textContent = `TP ${score.accuracy.tp} FP ${score.accuracy.fp} FN ${score.accuracy.fn} • P ${score.accuracy.precision} R ${score.accuracy.recall}`;

    $('gdResInt').textContent = String(score.intervention.score);
    $('gdResIntSub').textContent = `spent ${score.intervention.budgetSpent} • left ${score.intervention.budgetLeft}`;

    $('gdResChainScore').textContent = String(score.chain.score);
    $('gdResChainSub').textContent = `match ${score.chain.hit}/${score.chain.truthPairs}`;

    $('gdResSpeed').textContent = String(score.speed.score);
    $('gdResSpeedSub').textContent = `timeLeft ${score.speed.timeLeft}/${score.speed.timeTotal}`;

    const badgesBox = $('gdResBadges');
    badgesBox.innerHTML = '';
    const all = [
      {id:'super', label:'🕵️ Super Sleuth'},
      {id:'chain', label:'🧩 Chain Master'},
      {id:'budget', label:'💰 Budget Hero'},
      {id:'speed', label:'⚡ Speed Runner'},
    ];
    const on = new Set((score.badges||[]).map(b=>b.id));
    all.forEach(b=>{
      const d = el('div','gd-badge'+(on.has(b.id)?' on':''));
      d.textContent = b.label;
      badgesBox.appendChild(d);
    });

    emitLabels('badges', { badges:(score.badges||[]).map(b=>b.id) });
    emitHHA('badges_awarded', { badges: score.badges || [] });

    MODAL.classList.add('show');
  }

  function hideModal(){
    if(MODAL) MODAL.classList.remove('show');
  }

  // ---------- CSV export ----------
  function makeSummaryCSV(score){
    const rows=[];
    rows.push([
      'timestampIso','game','pid','run','diff','scene','view','seed',
      'studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester',
      'reason','final','rank',
      'accScore','tp','fp','fn','precision','recall',
      'chainScore','chainHit','chainTruthPairs','chainText',
      'speedScore','timeLeft','timeTotal',
      'interventionScore','avgRiskStart','avgRiskEnd','budgetSpent','budgetLeft',
      'missionWarm','missionTrick','missionBoss','missionBonus',
      'badges'
    ]);
    rows.push([
      isoNow(),'germ-detective',cfg.pid,cfg.run,cfg.diff,cfg.scene,cfg.view,String(cfg.seed||''),
      CTX.studyId,CTX.phase,CTX.conditionGroup,CTX.sessionOrder,CTX.blockLabel,CTX.siteCode,CTX.schoolYear,CTX.semester,
      score.reason,score.final,score.rank,
      score.accuracy.score,score.accuracy.tp,score.accuracy.fp,score.accuracy.fn,score.accuracy.precision,score.accuracy.recall,
      score.chain.score,score.chain.hit,score.chain.truthPairs,score.chain.chain||'',
      score.speed.score,score.speed.timeLeft,score.speed.timeTotal,
      score.intervention.score,score.intervention.avgRiskStart,score.intervention.avgRiskEnd,score.intervention.budgetSpent,score.intervention.budgetLeft,
      score.mission.warmOk?1:0,score.mission.trickOk?1:0,score.mission.bossOk?1:0,score.mission.bonus,
      (score.badges||[]).map(b=>b.id).join('|')
    ]);

    rows.push([]);
    rows.push(['EVIDENCE (last 12)']);
    rows.push(['tIso','type','target','info','tool','method']);
    const evs = STATE.evidence.slice(-12).reverse();
    evs.forEach(e=> rows.push([e.tIso||'',e.type||'',e.target||'',e.info||'',e.tool||'',e.method||'']));

    return rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  }

  function makeEventsCSV(){
    const rows=[];
    rows.push([
      'tIso','ms','name','payloadJson',
      'pid','run','diff','scene','view','seed',
      'studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode','schoolYear','semester'
    ]);
    EVENT_LOG.forEach(e=>{
      rows.push([
        e.tIso,e.ms,e.name,e.payloadJson,
        e.pid,e.run,e.diff,e.scene,e.view,e.seed,
        e.studyId,e.phase,e.conditionGroup,e.sessionOrder,e.blockLabel,e.siteCode,e.schoolYear,e.semester
      ]);
    });
    return rows.map(r=>r.map(csvEscape).join(',')).join('\n');
  }

  function exportSummaryCSV(){
    const score = STATE.score || computeScore('export');
    const text = makeSummaryCSV(score);
    const stamp = isoNow().replace(/[:.]/g,'-');
    downloadText(`germ-detective_summary_${cfg.pid}_${cfg.scene}_${cfg.diff}_${stamp}.csv`, text);
    emitHHA('export_summary_csv', { bytes: text.length });
  }

  function exportEventsCSV(){
    const text = makeEventsCSV();
    const stamp = isoNow().replace(/[:.]/g,'-');
    downloadText(`germ-detective_events_${cfg.pid}_${cfg.scene}_${cfg.diff}_${stamp}.csv`, text);
    emitHHA('export_events_csv', { bytes: text.length, rows: EVENT_LOG.length });
  }

  // ---------- lifecycle ----------
  function emitFeatures(){
    updateChain();
    const feat = Object.assign({
      game:'germ-detective',
      timeLeft:STATE.timeLeft,
      timeTotal:STATE.timeTotal,
      stage:STATE.stage,
      phase:STATE.phase,
      tool:STATE.tool,
      evidenceCount:STATE.evidence.length,
      uniqueTargets: uniqueTargets(),
      scanned: scannedCount(),
      verified: verifiedCount(),
      avgRisk: Math.round(avgRisk()),
      budgetLeft: budgetLeft(),
      riskScore: computeRiskScore(),
      nextBestAction: nextBestAction(),
      chain: (STATE.chain.inferred||[]).slice(0,4).join('>') || ''
    }, { pid:cfg.pid, run:cfg.run, diff:cfg.diff, scene:cfg.scene, view:cfg.view, seed:String(cfg.seed||'') }, CTX);

    try{ WIN.dispatchEvent(new CustomEvent('hha:features_1s', { detail: feat })); }catch{}
    logEvt('features_1s', feat);
  }

  function startLoops(){
    clearInterval(STATE._timer);
    clearInterval(STATE._tick);

    STATE.running = true;
    STATE.paused = false;
    STATE.ended = false;

    emitHHA('session_start', { game:'germ-detective', timeSec:STATE.timeTotal });

    STATE._timer = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      STATE.timeLeft = Math.max(0, STATE.timeLeft - 1);
      updateTimerUI();
      emitFeatures();
      updateMissionUI();
      coachTick();
      if(STATE.timeLeft <= 0) end('timeup');
    }, 1000);

    STATE._tick = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      coachTick();
    }, 1500);
  }

  function stopLoops(){
    clearInterval(STATE._timer);
    clearInterval(STATE._tick);
    STATE._timer = null;
    STATE._tick = null;
  }

  function end(reason){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.running = false;
    stopLoops();

    const score = computeScore(String(reason||'end'));
    STATE.score = score;

    // emit end
    emitHHA('session_end', { reason: score.reason, score });
    try{ WIN.dispatchEvent(new CustomEvent('hha:end', { detail:{ reason: score.reason, score } })); }catch{}
    saveLastSummary(score.reason, score);

    showModal(score);
  }

  function flushAndGoHub(reason){
    // ensure end recorded if exiting mid-game
    if(!STATE.ended){
      const score = computeScore(String(reason||'exit'));
      STATE.score = score;
      STATE.ended = true;
      STATE.running = false;
      stopLoops();
      emitHHA('session_end', { reason: String(reason||'exit'), score });
      try{ WIN.dispatchEvent(new CustomEvent('hha:end', { detail:{ reason: String(reason||'exit'), score } })); }catch{}
      saveLastSummary(String(reason||'exit'), score);
      emitLabels('exit_to_hub', { reason: String(reason||'exit') });
    } else {
      saveLastSummary(String(reason||'exit'), STATE.score || null);
    }

    setTimeout(()=>{ location.href = String(cfg.hub || '/webxr-health-mobile/herohealth/hub.html'); }, 80);
  }

  function retry(sameSeed){
    // preserve ORIGINAL seed from URL for reproducible
    const originalSeed = String(qsParam('seed', cfg.seed || '0') || cfg.seed || '0');
    cfg.seed = sameSeed ? originalSeed : (cfg.run==='play' ? String(Date.now()) : String(cfg.seed||originalSeed));
    RNG = mulberry32(hash32(`${cfg.seed}|${cfg.scene}|${cfg.diff}|${cfg.run}`));

    // reset state
    stopLoops();
    STATE.ended = false;
    STATE.running = false;
    STATE.paused = false;
    STATE.timeTotal = clamp(cfg.timeSec, 20, 600);
    STATE.timeLeft  = STATE.timeTotal;
    STATE.tool = 'uv';
    STATE.stage = 1;
    STATE.phase = 'investigate';
    STATE.budget = { total: budgetByDiff(cfg.diff), spent: 0, actions: [] };
    STATE.evidence.length = 0;
    STATE.chain.edges.length = 0;
    STATE.chain.inferred.length = 0;
    STATE.score = null;
    STATE._autoReportFired = false;

    EVENT_LOG.length = 0;

    buildHotspots();
    renderHotspots();
    refreshPills();
    updateTimerUI();
    updateBudgetUI();
    updateEvidenceUI();
    updateMissionUI();

    startLoops();
    showCoach(sameSeed?'Same Seed ✅':'Retry ✅', 'UV → Swab → Chain → Clean');
  }

  // ---------- boot ----------
  function init(){
    buildHotspots();
    buildUI();

    // set view dataset (helps cVR strict click disabling)
    if(cfg.view === 'cvr' || cfg.view === 'cardboard'){
      try{ DOC.documentElement.dataset.view = 'cvr'; }catch{}
    } else if(cfg.view){
      try{ DOC.documentElement.dataset.view = cfg.view; }catch{}
    }

    renderHotspots();
    refreshPills();
    updateTimerUI();
    updateBudgetUI();
    updateEvidenceUI();
    updateMissionUI();

    // wire shoot
    WIN.addEventListener('hha:shoot', onShoot, false);

    // keyboard shortcuts (desktop)
    WIN.addEventListener('keydown', (e)=>{
      if(e.key==='1') setTool('uv');
      if(e.key==='2') setTool('swab');
      if(e.key==='3') setTool('cam');
      if(e.key==='4') setTool('clean');
      if(e.key==='p' || e.key==='P') togglePause();
    }, false);

    // message commands
    WIN.addEventListener('message', (ev)=>{
      const m = ev.data;
      if(!m) return;
      if(m.type==='command' && m.action==='setTool' && m.value) setTool(m.value);
      if(m.type==='command' && m.action==='pause') { if(!STATE.paused) togglePause(); }
      if(m.type==='command' && m.action==='resume') { if(STATE.paused) togglePause(); }
      if(m.type==='command' && m.action==='retry') retry(false);
      if(m.type==='command' && m.action==='retrySame') retry(true);
      if(m.type==='command' && m.action==='hub') flushAndGoHub('command_hub');
      if(m.type==='command' && m.action==='exportSummary') exportSummaryCSV();
      if(m.type==='command' && m.action==='exportEvents') exportEventsCSV();
    }, false);

    // best-effort save on unload
    WIN.addEventListener('beforeunload', ()=>{
      try{
        if(!STATE.ended){
          const score = computeScore('unload');
          saveLastSummary('unload', score);
        }
      }catch{}
    });

    startLoops();
    showCoach('คดีเริ่มแล้ว! 🦠', 'เริ่มจาก UV แล้ว Swab ยืนยัน');
    emitHHA('boot_core', { ok:1 });
  }

  // ---------- public API ----------
  return {
    init,
    end,
    retry: ()=>retry(false),
    retrySameSeed: ()=>retry(true),
    exportSummaryCSV,
    exportEventsCSV,
    goHub: ()=>flushAndGoHub('api_goHub'),
    getState: ()=>STATE,
    setTool,
  };
}