// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — core runtime (PC/Mobile/cVR) — PRODUCTION SAFE + RESULT MODAL ++
// ✅ Result Modal (no alert): score/rank/breakdown
// ✅ Badges: Super Sleuth / Chain Master / Budget Hero / Speed Runner
// ✅ Export CSV (local download)
// ✅ Flush-hardened Back HUB (save last summary + ensure end event)
// ✅ 3-stage mission + chain + budget + AI coach + hha:shoot
// NOTE: No networking / no apps script binding.

export default function GameApp(opts = {}) {
  const cfg = Object.assign({
    mountId: 'app',
    timeSec: 120,
    dwellMs: 1200,
    seed: '0',
    run: 'play',
    diff: 'normal',
    scene: 'classroom',
    view: 'pc',
    pid: 'anon',
    hub: '/herohealth/hub.html'
  }, opts);

  const DOC = document;
  const WIN = window;

  // ---------------- RNG ----------------
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
  let RNG = mulberry32(hash32(cfg.seed + '|' + cfg.scene + '|' + cfg.diff + '|' + cfg.run));

  // ---------------- helpers ----------------
  function el(tag='div', cls=''){ const e = DOC.createElement(tag); if(cls) e.className = cls; return e; }
  function qs(id){ return DOC.getElementById(id); }
  function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
  function nowMs(){ return (WIN.performance && WIN.performance.now) ? WIN.performance.now() : Date.now(); }
  function isoNow(){ return new Date().toISOString(); }

  function emitEvent(name, payload){
    try{ WIN.dispatchEvent(new CustomEvent('hha:event', { detail:{ name, payload } })); }catch(_){}
  }
  function emitLabels(type, payload){
    try{ WIN.dispatchEvent(new CustomEvent('hha:labels', { detail:{ type, payload } })); }catch(_){}
  }

  function saveLastSummary(reason, score){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify({
        game:'germ-detective',
        at: isoNow(),
        reason: reason || 'end',
        score: score || null,
        url: location.href
      }));
    }catch(_){}
  }

  // ---------------- state ----------------
  const STATE = {
    running:false,
    paused:false,
    ended:false,
    timeTotal: clamp(cfg.timeSec, 20, 600),
    timeLeft:  clamp(cfg.timeSec, 20, 600),

    tool: 'uv',
    phase: 'investigate',
    stage: 1,

    budget: { points: diffBudget(cfg.diff), spent:0, actions:[] },
    coach: { lastAt:0, lastKey:'', cooldownMs: 6500, enabled:true },

    hotspots: [],
    evidence: [],
    chain: { edges: [], inferred: [], _truth: [] },
    score: null
  };

  function diffBudget(diff){
    diff = String(diff||'normal').toLowerCase();
    if(diff==='easy') return 140;
    if(diff==='hard') return 85;
    return 110;
  }
  function diffRiskScale(diff){
    diff = String(diff||'normal').toLowerCase();
    if(diff==='easy') return 0.85;
    if(diff==='hard') return 1.18;
    return 1.0;
  }
  function diffBossTarget(diff){
    diff = String(diff||'normal').toLowerCase();
    if(diff==='easy') return 38;
    if(diff==='hard') return 28;
    return 33;
  }

  // ---------------- scene templates ----------------
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

  function layoutPositions(n){
    const pos = [];
    for(let i=0;i<n;i++){
      const x = 8 + RNG()*84;
      const y = 18 + RNG()*70;
      pos.push({xp:x, yp:y});
    }
    return pos;
  }

  function buildHotspots(){
    const list = (SCENES[cfg.scene] || SCENES.classroom).slice();
    const pos = layoutPositions(list.length);
    const scale = diffRiskScale(cfg.diff);

    STATE.hotspots = list.map((h, i)=>{
      const base = Math.round((22 + RNG()*55) * scale);
      return {
        id: 'hs_'+i,
        name: h.name,
        sceneTag: cfg.scene,
        xp: pos[i].xp,
        yp: pos[i].yp,
        baseRisk: base,
        risk: base,
        importance: clamp(h.importance || 3, 1, 5),

        scanned:false, swabbed:false, photoed:false,
        verified:false, cleaned:false,
        el: null
      };
    });

    const infectedCount = (cfg.diff==='hard') ? 4 : (cfg.diff==='easy' ? 2 : 3);
    const sorted = STATE.hotspots.slice().sort((a,b)=> (b.importance*100 + b.baseRisk) - (a.importance*100 + a.baseRisk));
    const infected = sorted.slice(0, infectedCount);
    infected.forEach(h=>{ h._infected = true; h.risk = clamp(h.risk + 18 + RNG()*18, 0, 100); });
    STATE.hotspots.forEach(h=>{
      if(!h._infected) h.risk = clamp(h.risk - (5 + RNG()*12), 0, 100);
    });

    const chain = infected.slice().sort((a,b)=> b.risk - a.risk);
    const truth = [];
    for(let i=0;i<Math.min(chain.length-1, 3);i++){
      truth.push([chain[i].name, chain[i+1].name]);
    }
    STATE.chain._truth = truth;
  }

  // ---------------- UI ----------------
  let STAGE=null, TOPBAR=null, PANEL=null, COACH=null, MODAL=null;

  function ensureStyle(){
    if(qs('gdBaseStyle')) return;
    const st = el('style'); st.id='gdBaseStyle';
    st.textContent = `
      .gd-topbar{
        position:sticky; top:0; z-index:50;
        display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;
        padding:8px 10px; background:rgba(2,6,23,.82);
        border-bottom:1px solid rgba(148,163,184,.16); backdrop-filter: blur(8px);
      }
      .gd-topbar .left,.gd-topbar .right{ display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
      .pill{ border:1px solid rgba(148,163,184,.18); border-radius:999px; padding:6px 10px; background:rgba(255,255,255,.02); font-size:12px; font-weight:900; color:rgba(229,231,235,.92); }
      .btn{
        appearance:none; border:1px solid rgba(148,163,184,.18); background:rgba(255,255,255,.03);
        color:rgba(229,231,235,.96); border-radius:12px; padding:10px 12px; font-weight:1000; cursor:pointer;
      }
      .btn:active{ transform: translateY(1px); }
      .btn.good{ border-color: rgba(16,185,129,.28); background: rgba(16,185,129,.10); }
      .btn.cyan{ border-color: rgba(34,211,238,.28); background: rgba(34,211,238,.10); }
      .btn.warn{ border-color: rgba(245,158,11,.28); background: rgba(245,158,11,.10); }

      .gd-wrap{ display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:10px; padding:10px; }
      .gd-stage{ position:relative; min-height:58vh; border:1px solid rgba(148,163,184,.18); border-radius:16px; background:rgba(255,255,255,.01); overflow:hidden; }
      .gd-side{ display:grid; gap:10px; align-content:start; }
      .gd-panel{ border:1px solid rgba(148,163,184,.18); border-radius:16px; background:rgba(2,6,23,.70); overflow:hidden; }
      .gd-panel .head{ padding:10px 12px; border-bottom:1px solid rgba(148,163,184,.10); display:flex; justify-content:space-between; gap:8px; align-items:center; }
      .gd-panel .body{ padding:10px; }

      .gd-spot{
        position:absolute;
        border:1px solid rgba(148,163,184,.18);
        background: rgba(255,255,255,.03);
        border-radius:14px;
        padding:10px 12px;
        font-weight:1000;
        cursor:pointer;
        user-select:none;
        box-shadow: 0 12px 30px rgba(0,0,0,.20);
      }
      .gd-spot:hover{ transform: translateY(-1px); }
      .gd-spot .sub{ display:block; font-size:11px; font-weight:900; opacity:.78; margin-top:2px; }
      .gd-spot.hot{ box-shadow: 0 0 0 2px rgba(244,63,94,.28), 0 18px 40px rgba(0,0,0,.25); }
      .gd-spot.cleaned{ outline:2px solid rgba(16,185,129,.55); }
      .gd-spot.verified{ outline:2px solid rgba(34,211,238,.55); }

      .gd-toolbar{ position:absolute; left:12px; top:12px; z-index:20; display:flex; gap:6px; flex-wrap:wrap; max-width:calc(100% - 24px); }
      .gd-timer{ position:absolute; left:12px; top:60px; z-index:20; font-weight:1000; font-size:12px; padding:6px 10px; border-radius:999px; border:1px solid rgba(148,163,184,.18); background:rgba(2,6,23,.70); }

      .gd-coach{
        position:fixed; left:50%; top:calc(10px + env(safe-area-inset-top,0px));
        transform:translateX(-50%); z-index:9998;
        max-width:min(880px, 92vw);
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

      .mini-list{ display:grid; gap:6px; max-height:200px; overflow:auto; }
      .mini-item{ border:1px solid rgba(148,163,184,.12); border-radius:12px; padding:8px; background:rgba(255,255,255,.02); font-size:12px; line-height:1.35; }

      .budgetbar{ height:10px; border-radius:999px; overflow:hidden; background:rgba(148,163,184,.12); border:1px solid rgba(148,163,184,.18); }
      .budgetfill{ height:100%; width:100%; background: linear-gradient(90deg, rgba(16,185,129,.9), rgba(34,211,238,.9)); }

      /* ===== Result Modal ===== */
      .gd-modal{
        position:fixed; inset:0; z-index:9999;
        background:rgba(0,0,0,.55);
        display:none;
        align-items:center; justify-content:center;
        padding:16px;
      }
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
      .gd-modal-body{
        padding:14px;
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap:12px;
      }
      .gd-kpi{
        border:1px solid rgba(148,163,184,.14);
        border-radius:14px;
        padding:12px;
        background:rgba(255,255,255,.02);
      }
      .gd-kpi b{ font-size:22px; }
      .gd-grid2{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      .gd-actions{
        padding:12px 14px;
        border-top:1px solid rgba(148,163,184,.14);
        display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end;
      }
      .gd-small{ color:rgba(148,163,184,.95); font-weight:850; font-size:12px; line-height:1.35; }
      .gd-badges{ display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
      .gd-badge{
        border:1px solid rgba(148,163,184,.18);
        background:rgba(255,255,255,.02);
        border-radius:999px;
        padding:6px 10px;
        font-weight:1000;
        font-size:12px;
      }
      .gd-badge.on{
        border-color: rgba(34,211,238,.30);
        background: rgba(34,211,238,.10);
      }
      @media (max-width: 860px){ .gd-modal-body{ grid-template-columns:1fr; } }
      @media (max-width: 980px){ .gd-wrap{ grid-template-columns:1fr; } }
    `;
    DOC.head.appendChild(st);
  }

  function buildUI(){
    ensureStyle();

    COACH = qs('gdCoach');
    if(!COACH){ COACH = el('div','gd-coach'); COACH.id='gdCoach'; DOC.body.appendChild(COACH); }

    MODAL = qs('gdResultModal');
    if(!MODAL){
      MODAL = el('div','gd-modal'); MODAL.id='gdResultModal';
      MODAL.innerHTML = `
        <div class="gd-modal-card" role="dialog" aria-modal="true" aria-label="result">
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
            <button class="btn" id="gdResClose" type="button">ปิด</button>
            <button class="btn" id="gdResExport" type="button">⬇️ Export CSV</button>
            <button class="btn warn" id="gdResRetry" type="button">🔁 เล่นใหม่</button>
            <button class="btn good" id="gdResBackHub" type="button">🏠 กลับ HUB</button>
          </div>
        </div>
      `;
      DOC.body.appendChild(MODAL);

      qs('gdResClose').onclick = ()=> hideResult();
      qs('gdResRetry').onclick = ()=> { hideResult(); resetAndRestart(); };
      qs('gdResBackHub').onclick = ()=> { flushAndGoHub('backhub'); };
      qs('gdResExport').onclick = ()=> { exportCSV(); };

      MODAL.addEventListener('click', (e)=>{ if(e.target===MODAL) hideResult(); });
      DOC.addEventListener('keydown', (e)=>{
        if(!MODAL.classList.contains('show')) return;
        if(e.key==='Escape') hideResult();
      });
    }

    TOPBAR = el('div','gd-topbar');
    TOPBAR.innerHTML = `
      <div class="left">
        <span class="pill" id="gdPhasePill">phase: investigate</span>
        <span class="pill" id="gdStagePill">stage: 1</span>
        <span class="pill" id="gdToolPill">tool: UV</span>
      </div>
      <div class="right">
        <button class="btn" id="gdBtnPause" type="button">⏸ Pause</button>
        <button class="btn warn" id="gdBtnHelp" type="button">❓ Help</button>
        <button class="btn good" id="gdBtnSubmit" type="button">🧾 ส่งรายงาน</button>
      </div>
    `;
    DOC.body.appendChild(TOPBAR);

    const WRAP = el('div','gd-wrap');
    STAGE = el('div','gd-stage'); STAGE.id='gdStage';
    PANEL = el('div','gd-side');

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

    const p1 = el('div','gd-panel');
    p1.innerHTML = `
      <div class="head"><strong>🎯 Mission</strong><span class="pill" id="gdMissionPill">Warm</span></div>
      <div class="body" id="gdMissionBody"></div>
    `;
    const p2 = el('div','gd-panel');
    p2.innerHTML = `
      <div class="head"><strong>🧰 Budget</strong><span class="pill" id="gdBudgetPill">0</span></div>
      <div class="body">
        <div class="budgetbar"><div class="budgetfill" id="gdBudgetFill"></div></div>
        <div class="mini-list" id="gdBudgetList" style="margin-top:10px"></div>
      </div>
    `;
    const p3 = el('div','gd-panel');
    p3.innerHTML = `
      <div class="head"><strong>🧾 Evidence</strong><span class="pill" id="gdEvidencePill">0</span></div>
      <div class="body"><div class="mini-list" id="gdEvidenceList"></div></div>
    `;
    const p4 = el('div','gd-panel');
    p4.innerHTML = `
      <div class="head"><strong>🤖 AI Coach</strong><span class="pill" id="gdRiskPill">risk: -</span></div>
      <div class="body">
        <div class="mini-item" id="gdCoachBox">เริ่มสืบสวน… ใช้ UV/Swab/Camera เก็บหลักฐาน แล้ว Clean ลดความเสี่ยง</div>
      </div>
    `;

    PANEL.appendChild(p1); PANEL.appendChild(p2); PANEL.appendChild(p3); PANEL.appendChild(p4);
    WRAP.appendChild(STAGE); WRAP.appendChild(PANEL);
    DOC.body.appendChild(WRAP);

    qs('gdToolUV').onclick = ()=> setTool('uv');
    qs('gdToolSwab').onclick = ()=> setTool('swab');
    qs('gdToolCam').onclick = ()=> setTool('cam');
    qs('gdToolClean').onclick = ()=> setTool('clean');

    qs('gdBtnSubmit').onclick = ()=> submitReport();
    qs('gdBtnPause').onclick = ()=> togglePause();
    qs('gdBtnHelp').onclick = ()=> showCoach(
      'วิธีเล่น: UV → ชี้จุดเสี่ยง, Swab → ยืนยัน, Camera → เก็บภาพ, Clean → ลด risk (งบจำกัด)',
      'เป้าหมาย: ต่อ chain A→B→C และลด risk เฉลี่ยให้ต่ำก่อนหมดเวลา'
    );
  }

  function showCoach(main, sub){
    if(!COACH) return;
    COACH.innerHTML = `${main}${sub?`<small>${sub}</small>`:''}`;
    COACH.classList.add('show');
    setTimeout(()=>{ try{ COACH.classList.remove('show'); }catch{} }, 3600);
  }

  // ---------------- gameplay helpers ----------------
  function updateTopPills(){
    const toolTxt = (STATE.tool==='uv'?'UV':STATE.tool==='swab'?'Swab':STATE.tool==='cam'?'Camera':'Clean');
    const m = (STATE.stage===1?'Warm':STATE.stage===2?'Trick':'Boss');
    const p1 = qs('gdPhasePill'); if(p1) p1.textContent = 'phase: ' + STATE.phase;
    const p2 = qs('gdStagePill'); if(p2) p2.textContent = 'stage: ' + String(STATE.stage);
    const p3 = qs('gdToolPill');  if(p3) p3.textContent = 'tool: ' + toolTxt;
    const mp = qs('gdMissionPill'); if(mp) mp.textContent = m;
  }
  function updateTimerUI(){ const e = qs('gdTimer'); if(e) e.textContent = `เวลา: ${STATE.timeLeft}s`; }
  function mkMini(text){ const d = el('div','mini-item'); d.textContent = text; return d; }

  function budgetLeft(){ return Math.max(0, (STATE.budget.points||0) - (STATE.budget.spent||0)); }
  function avgRisk(){ if(!STATE.hotspots.length) return 0; return STATE.hotspots.reduce((a,h)=>a+(Number(h.risk)||0),0)/STATE.hotspots.length; }
  function countScanned(){ return STATE.hotspots.reduce((a,h)=>a+(h.scanned?1:0),0); }
  function verifiedCount(){ return STATE.hotspots.reduce((a,h)=>a+(h.verified?1:0),0); }
  function uniqueTargetsTouched(){ return new Set(STATE.evidence.map(e=>e.target)).size; }
  function warmTargetCount(){ return cfg.diff==='easy'?3:cfg.diff==='hard'?5:4; }

  function updateBudgetUI(){
    const left = budgetLeft();
    const pill = qs('gdBudgetPill'); if(pill) pill.textContent = `${left}/${STATE.budget.points}`;
    const fill = qs('gdBudgetFill'); if(fill){ fill.style.width = `${Math.round((left/STATE.budget.points)*100)}%`; }
    const list = qs('gdBudgetList');
    if(list){
      list.innerHTML = '';
      const last = STATE.budget.actions.slice(-6).reverse();
      if(!last.length) list.appendChild(mkMini(`ยังไม่ใช้ Clean • งบคงเหลือ ${left}`));
      else last.forEach(a=> list.appendChild(mkMini(`Clean: ${a.target} • -${a.cost} • risk ${a.riskBefore}→${a.riskAfter}`)));
    }
  }

  function updateEvidenceUI(){
    const pill = qs('gdEvidencePill'); if(pill) pill.textContent = String(STATE.evidence.length);
    const list = qs('gdEvidenceList');
    if(list){
      list.innerHTML = '';
      const last = STATE.evidence.slice(-10).reverse();
      if(!last.length) list.appendChild(mkMini('ยังไม่มีหลักฐาน • เริ่มจาก UV ที่ “ลูกบิด/มือถือ/ช้อนกลาง”'));
      else last.forEach(r=> list.appendChild(mkMini(`${String(r.type||'').toUpperCase()} • ${r.target} • ${r.info||''}`)));
    }
  }

  // ---- chain inference ----
  function findHotspotByName(name){ return STATE.hotspots.find(h=>h.name===name)||null; }
  function findHotspotById(id){ return STATE.hotspots.find(h=>h.id===id)||null; }
  function addEdge(a,b,w){ if(!a||!b||a===b) return; if(STATE.chain.edges.some(e=>e.a===a&&e.b===b)) return; STATE.chain.edges.push({a,b,w}); }
  function bestChain3(edges){
    const nodes = Array.from(new Set(edges.flatMap(e=>[e.a,e.b])));
    if(nodes.length<3) return [];
    const wm = new Map();
    edges.forEach(e=> wm.set(e.a+'>'+e.b, (wm.get(e.a+'>'+e.b)||0) + (e.w||1)));
    let best={s:-1,c:[]};
    for(const a of nodes)for(const b of nodes)for(const c of nodes){
      if(a===b||b===c||a===c) continue;
      const wab=wm.get(a+'>'+b)||0, wbc=wm.get(b+'>'+c)||0;
      if(!wab||!wbc) continue;
      let score=wab+wbc, chain=[a,b,c];
      for(const d of nodes){
        if(d===a||d===b||d===c) continue;
        const wcd=wm.get(c+'>'+d)||0;
        if(wcd && score+wcd>score){ score+=wcd; chain=[a,b,c,d]; }
      }
      if(score>best.s) best={s:score,c:chain};
    }
    return best.c;
  }
  function updateChainInference(){
    const seq = STATE.evidence
      .filter(e=>['hotspot','sample','photo','clean'].includes(e.type))
      .map(e=>({t:e.tIso,target:e.target}))
      .sort((x,y)=>String(x.t).localeCompare(String(y.t)));
    for(let i=0;i<seq.length-1;i++){
      const a=seq[i].target,b=seq[i+1].target; if(a===b) continue;
      const ha=findHotspotByName(a), hb