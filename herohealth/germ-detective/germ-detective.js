// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — core runtime (PC/Mobile/cVR) — PRODUCTION SAFE
// ✅ Core loop: Investigate -> Intervene -> Report
// ✅ 3-stage mission (Warm -> Trick -> Boss)
// ✅ Chain inference (A->B->C) + risk reduction with limited budget
// ✅ AI Coach (Level 1 heuristic prediction): warns when likely missing key hotspots + explains top 2 reasons
// ✅ Supports hha:shoot (Cardboard crosshair) by hit-testing DOM hotspots (nearest within lockPx)
// ✅ Emits telemetry via hha:event and hha:features_1s and hha:end
// NOTE: No networking / no apps script binding.

export default function GameApp(opts = {}) {
  const cfg = Object.assign({
    mountId: 'app',
    timeSec: 120,
    dwellMs: 1200,
    seed: '0',
    run: 'play',          // play | research
    diff: 'normal',       // easy|normal|hard
    scene: 'classroom',   // classroom|home|canteen
    view: 'pc',           // pc|mobile|cvr
    pid: 'anon'
  }, opts);

  const DOC = document;
  const WIN = window;

  // ---------------- RNG (deterministic) ----------------
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
  const RNG = mulberry32(hash32(cfg.seed + '|' + cfg.scene + '|' + cfg.diff + '|' + cfg.run));

  // ---------------- DOM helpers ----------------
  function el(tag='div', cls=''){ const e = DOC.createElement(tag); if(cls) e.className = cls; return e; }
  function qs(id){ return DOC.getElementById(id); }
  function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b, v)); }
  function nowMs(){ return (WIN.performance && WIN.performance.now) ? WIN.performance.now() : Date.now(); }
  function isoNow(){ return new Date().toISOString(); }

  // ---------------- Telemetry helpers ----------------
  function emitEvent(name, payload){
    try{
      WIN.dispatchEvent(new CustomEvent('hha:event', { detail:{ name, payload } }));
    }catch(_){}
  }

  // ---------------- Game state ----------------
  const STATE = {
    running:false,
    paused:false,
    ended:false,
    timeTotal: clamp(cfg.timeSec, 20, 600),
    timeLeft:  clamp(cfg.timeSec, 20, 600),

    tool: 'uv', // uv|swab|cam|clean
    phase: 'investigate', // investigate|intervene|report
    stage: 1, // 1 warm, 2 trick, 3 boss

    budget: { points: diffBudget(cfg.diff), spent:0, actions:[] },
    coach: { lastAt:0, lastKey:'', cooldownMs: 6500, enabled:true },

    hotspots: [], // {id,name,sceneTag,xp,yp,baseRisk,risk,verified,scanned,swabbed,photoed,cleaned,importance,el}
    evidence: [], // {type,target,info,tool,tIso}
    chain: { nodes: new Map(), edges: [], inferred: [] },
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

  // ---------------- Scene hotspot templates ----------------
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

        scanned:false,
        swabbed:false,
        photoed:false,
        verified:false,
        cleaned:false,
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
  let STAGE = null;
  let TOPBAR = null;
  let PANEL = null;
  let COACH = null;

  function ensureBaseStyle(){
    if(qs('gdBaseStyle')) return;
    const st = el('style'); st.id='gdBaseStyle';
    st.textContent = `
      .gd-topbar{
        position:sticky; top:0; z-index:50;
        display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;
        padding:8px 10px; background:rgba(2,6,23,.82); border-bottom:1px solid rgba(148,163,184,.16); backdrop-filter: blur(8px);
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

      @media (max-width: 980px){ .gd-wrap{ grid-template-columns:1fr; } }
    `;
    DOC.head.appendChild(st);
  }

  function buildUI(){
    ensureBaseStyle();

    COACH = qs('gdCoach');
    if(!COACH){
      COACH = el('div','gd-coach'); COACH.id='gdCoach';
      DOC.body.appendChild(COACH);
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

    const toolbar = el('div','gd-toolbar'); toolbar.id='gdToolbar';
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

    PANEL.appendChild(p1);
    PANEL.appendChild(p2);
    PANEL.appendChild(p3);
    PANEL.appendChild(p4);

    WRAP.appendChild(STAGE);
    WRAP.appendChild(PANEL);
    DOC.body.appendChild(WRAP);

    qs('gdToolUV').onclick = ()=> setTool('uv');
    qs('gdToolSwab').onclick = ()=> setTool('swab');
    qs('gdToolCam').onclick = ()=> setTool('cam');
    qs('gdToolClean').onclick = ()=> setTool('clean');

    qs('gdBtnSubmit').onclick = ()=> submitReport();
    qs('gdBtnPause').onclick = ()=> togglePause();
    qs('gdBtnHelp').onclick = ()=> showCoach(
      'วิธีเล่น: UV เพื่อ “ชี้จุดเสี่ยง”, Swab เพื่อ “ยืนยัน”, Camera เพื่อ “เก็บภาพ”, Clean เพื่อลด risk (มีงบจำกัด)',
      'เป้าหมาย: ต่อ chain A→B→C และทำให้ risk เฉลี่ยต่ำลงก่อนหมดเวลา'
    );
  }

  function updateTopPills(){
    const toolTxt = (STATE.tool==='uv'?'UV':STATE.tool==='swab'?'Swab':STATE.tool==='cam'?'Camera':'Clean');
    const m = (STATE.stage===1?'Warm':STATE.stage===2?'Trick':'Boss');
    const p1 = qs('gdPhasePill'); if(p1) p1.textContent = 'phase: ' + STATE.phase;
    const p2 = qs('gdStagePill'); if(p2) p2.textContent = 'stage: ' + String(STATE.stage);
    const p3 = qs('gdToolPill');  if(p3) p3.textContent = 'tool: ' + toolTxt;
    const mp = qs('gdMissionPill'); if(mp) mp.textContent = m;
  }

  function updateTimerUI(){
    const e = qs('gdTimer');
    if(e) e.textContent = `เวลา: ${STATE.timeLeft}s`;
  }

  function mkMini(text){
    const d = el('div','mini-item'); d.textContent = text; return d;
  }

  function budgetLeft(){ return Math.max(0, (STATE.budget.points||0) - (STATE.budget.spent||0)); }
  function avgRisk(){
    if(!STATE.hotspots.length) return 0;
    const sum = STATE.hotspots.reduce((a,h)=> a + (Number(h.risk)||0), 0);
    return sum / STATE.hotspots.length;
  }
  function countScanned(){ return STATE.hotspots.reduce((a,h)=> a + (h.scanned?1:0), 0); }
  function verifiedCount(){ return STATE.hotspots.reduce((a,h)=> a + (h.verified?1:0), 0); }
  function uniqueTargetsTouched(){ return new Set(STATE.evidence.map(e=>e.target)).size; }

  function updateBudgetUI(){
    const left = budgetLeft();
    const pill = qs('gdBudgetPill'); if(pill) pill.textContent = `${left}/${STATE.budget.points}`;
    const fill = qs('gdBudgetFill');
    if(fill){
      const pct = STATE.budget.points ? (left / STATE.budget.points) : 0;
      fill.style.width = `${Math.round(pct*100)}%`;
    }
    const list = qs('gdBudgetList');
    if(list){
      list.innerHTML = '';
      const last = STATE.budget.actions.slice(-6).reverse();
      if(!last.length){
        list.appendChild(mkMini(`ยังไม่ใช้ Clean • งบคงเหลือ ${left}`));
      }else{
        last.forEach(a=>{
          list.appendChild(mkMini(`Clean: ${a.target} • -${a.cost} • risk ${a.riskBefore}→${a.riskAfter}`));
        });
      }
    }
  }

  function updateEvidenceUI(){
    const pill = qs('gdEvidencePill'); if(pill) pill.textContent = String(STATE.evidence.length);
    const list = qs('gdEvidenceList');
    if(list){
      list.innerHTML = '';
      const last = STATE.evidence.slice(-10).reverse();
      if(!last.length){
        list.appendChild(mkMini('ยังไม่มีหลักฐาน • เริ่มจาก UV ที่ “ลูกบิด/มือถือ/ช้อนกลาง”'));
      }else{
        last.forEach(r=>{
          list.appendChild(mkMini(`${r.type.toUpperCase()} • ${r.target} • ${r.info||''}`));
        });
      }
    }
  }

  function warmTargetCount(){
    if(cfg.diff==='easy') return 3;
    if(cfg.diff==='hard') return 5;
    return 4;
  }

  function inferredChain(){
    updateChainInference();
    return STATE.chain.inferred || [];
  }

  function formatChainShort(){
    const c = inferredChain();
    if(!c || c.length < 2) return '';
    return c.slice(0,4).join(' → ');
  }

  function updateMissionUI(){
    const box = qs('gdMissionBody');
    if(!box) return;

    const warmNeed = warmTargetCount();
    const warmDone = countScanned();
    const trickDone = inferredChain().length >= 3 ? 1 : 0;
    const bossTarget = diffBossTarget(cfg.diff);
    const bossScore = Math.round(avgRisk());
    const bossDone = bossScore <= bossTarget ? 1 : 0;

    let html = '';
    html += `<div class="mini-item">Stage 1 (Warm): สแกน hotspot ด้วย UV อย่างน้อย <b>${warmNeed}</b> จุด (ตอนนี้ ${warmDone}/${warmNeed})</div>`;
    html += `<div class="mini-item">Stage 2 (Trick): ต่อ chain การแพร่ A→B→C ให้ได้ (ตอนนี้ ${formatChainShort() || 'ยังไม่มี'})</div>`;
    html += `<div class="mini-item">Stage 3 (Boss): ใช้ Clean ลด risk เฉลี่ยให้ ≤ <b>${bossTarget}</b> (ตอนนี้ ${bossScore})</div>`;
    html += `<div class="mini-item"><b>Tip:</b> Swab จะ “ยืนยัน” จุดที่เสี่ยงจริง (verified) และช่วยให้ chain แม่นขึ้น</div>`;
    box.innerHTML = html;

    if(STATE.stage===1 && warmDone >= warmNeed){
      setStage(2);
      showCoach('เข้าสู่ Trick Stage! ต่อจิ๊กซอว์การแพร่เชื้อ A→B→C',
        'Hint: สแกน/Swab จุดสำคัญ 2–3 จุด แล้วดู “ลำดับสัมผัส” ที่คุณทำ');
    }
    if(STATE.stage===2 && trickDone){
      setStage(3);
      setPhase('intervene');
      showCoach('เข้าสู่ Boss Stage! จำกัดงบ Clean แล้วต้องลด risk เฉลี่ยให้ต่ำกว่าเป้า',
        'Clean จุด “สำคัญ+เสี่ยง” ก่อน จะคุ้มงบที่สุด');
    }
    if(STATE.stage===3 && bossDone){
      setPhase('report');
      showCoach('สำเร็จ! พร้อมส่งรายงานคดี 🧾', 'กด “ส่งรายงาน” เพื่อสรุปคะแนนและ badge');
    }
  }

  function renderHotspots(){
    STATE.hotspots.forEach(h=>{
      if(h.el && h.el.parentNode) h.el.parentNode.removeChild(h.el);
      h.el = null;
    });

    STATE.hotspots.forEach(h=>{
      const d = el('div','gd-spot');
      d.dataset.id = h.id;
      d.style.left = `${h.xp}%`;
      d.style.top  = `${h.yp}%`;
      d.innerHTML = `${h.name}<span class="sub">${spotSubline(h)}</span>`;
      d.onclick = ()=> onHotspotAction(h, 'click');
      STAGE.appendChild(d);
      h.el = d;
      applySpotClass(h);
    });
  }

  function spotSubline(h){
    const flags = [];
    if(h.scanned) flags.push('UV');
    if(h.swabbed) flags.push('SWAB');
    if(h.photoed) flags.push('CAM');
    if(h.cleaned) flags.push('CLEAN');
    if(h.verified) flags.push('VERIFIED');
    return flags.length ? flags.join(' • ') : 'แตะเพื่อสืบสวน';
  }

  function applySpotClass(h){
    if(!h.el) return;
    h.el.classList.toggle('cleaned', !!h.cleaned);
    h.el.classList.toggle('verified', !!h.verified);
    const hot = (!h.cleaned) && h.risk >= 65;
    h.el.classList.toggle('hot', hot);
    const sub = h.el.querySelector('.sub');
    if(sub) sub.textContent = spotSubline(h);
  }

  function setTool(t){
    STATE.tool = t;
    updateTopPills();
    emitEvent('tool_change', { tool:t, phase:STATE.phase, stage:STATE.stage });
  }
  function setPhase(p){
    STATE.phase = String(p||'investigate');
    updateTopPills();
    emitEvent('phase_change', { phase:STATE.phase, stage:STATE.stage });
  }
  function setStage(s){
    s = clamp(s,1,3);
    if(STATE.stage === s) return;
    STATE.stage = s;
    updateTopPills();
    emitEvent('stage_change', { stage:s });
  }
  function togglePause(){
    STATE.paused = !STATE.paused;
    const b = qs('gdBtnPause');
    if(b) b.textContent = STATE.paused ? '▶ Resume' : '⏸ Pause';
    emitEvent(STATE.paused ? 'pause' : 'resume', { paused: STATE.paused });
  }

  function addEvidence(rec){
    const r = Object.assign({ tIso: isoNow(), tool: STATE.tool }, rec);
    STATE.evidence.push(r);
    emitEvent('evidence_added', r);
    updateEvidenceUI();
    updateMissionUI();
  }

  // -------- chain inference --------
  function findHotspotByName(name){ return STATE.hotspots.find(h=> h.name===name) || null; }
  function findHotspotById(id){ return STATE.hotspots.find(h=> h.id===id) || null; }

  function addEdge(a,b,w,why){
    if(!a || !b || a===b) return;
    if(STATE.chain.edges.some(e=> e.a===a && e.b===b)) return;
    STATE.chain.edges.push({ a,b,w,why });
  }

  function bestChain3(edges){
    const nodes = Array.from(new Set(edges.flatMap(e=> [e.a,e.b])));
    if(nodes.length < 3) return [];
    const w = new Map();
    edges.forEach(e=> w.set(e.a+'>'+e.b, (w.get(e.a+'>'+e.b)||0) + (e.w||1)));

    let best = {score:-1, chain:[]};
    for(const a of nodes){
      for(const b of nodes){
        if(b===a) continue;
        const wab = w.get(a+'>'+b)||0;
        if(!wab) continue;
        for(const c of nodes){
          if(c===a || c===b) continue;
          const wbc = w.get(b+'>'+c)||0;
          if(!wbc) continue;
          let score = wab + wbc;
          let chain = [a,b,c];
          for(const d of nodes){
            if(d===a||d===b||d===c) continue;
            const wcd = w.get(c+'>'+d)||0;
            if(wcd){
              const s2 = score + wcd;
              if(s2 > score){
                score = s2;
                chain = [a,b,c,d];
              }
            }
          }
          if(score > best.score){
            best = {score, chain};
          }
        }
      }
    }
    return best.chain;
  }

  function updateChainInference(){
    const seq = STATE.evidence
      .filter(e=> e.type==='hotspot' || e.type==='sample' || e.type==='photo' || e.type==='clean')
      .map(e=> ({t:e.tIso, target:e.target, type:e.type}))
      .sort((x,y)=> x.t.localeCompare(y.t));

    STATE.chain._lastSeq = seq.map(s=> s.target);

    for(let i=0;i<seq.length-1;i++){
      const a = seq[i].target, b = seq[i+1].target;
      if(a===b) continue;
      const ha = findHotspotByName(a);
      const hb = findHotspotByName(b);
      const wa = ha ? (ha.verified?3:ha.scanned?1:0) : 0;
      const wb = hb ? (hb.verified?3:hb.scanned?1:0) : 0;
      const w = 1 + wa + wb;
      addEdge(a,b,w,'order');
    }

    const risky = STATE.hotspots
      .filter(h=> h.scanned || h.swabbed || h.photoed)
      .slice()
      .sort((a,b)=> (b.risk + b.importance*8) - (a.risk + a.importance*8))
      .slice(0,4);

    for(let i=0;i<risky.length-1;i++){
      addEdge(risky[i].name, risky[i+1].name, 2 + risky[i].importance, 'risk');
    }

    STATE.chain.inferred = bestChain3(STATE.chain.edges) || [];
  }

  // -------- AI Coach --------
  function computeRiskScore(){
    const avg = avgRisk();
    const importantUnscanned = STATE.hotspots.filter(h=> h.importance>=4 && !h.scanned).length;
    const pressure = 1 - (STATE.timeLeft / STATE.timeTotal);
    const score = clamp(Math.round(avg*0.7 + importantUnscanned*8 + pressure*18), 0, 100);
    STATE.coach.riskScore = score;
    return score;
  }
  function nextBestAction(){
    const candidates = STATE.hotspots.filter(h=> !h.cleaned);
    candidates.sort((a,b)=>{
      const sa = (a.risk*1.15 + a.importance*10) - (a.scanned?0:12) - (a.verified?0:6);
      const sb = (b.risk*1.15 + b.importance*10) - (b.scanned?0:12) - (b.verified?0:6);
      return sb - sa;
    });
    return candidates[0] ? candidates[0].name : null;
  }
  function showCoach(main, sub){
    if(!COACH) return;
    COACH.innerHTML = `${main}${sub?`<small>${sub}</small>`:''}`;
    COACH.classList.add('show');
    setTimeout(()=>{ try{ COACH.classList.remove('show'); }catch{} }, 3600);
  }
  function coachTick(){
    if(!STATE.coach.enabled || STATE.ended) return;
    const t = nowMs();
    if(t - STATE.coach.lastAt < STATE.coach.cooldownMs) return;

    const risk = computeRiskScore();
    const nba = nextBestAction();
    const unscannedHigh = STATE.hotspots.filter(h=> h.importance>=4 && !h.scanned);
    const reasons = [];

    if(unscannedHigh.length){
      unscannedHigh.sort((a,b)=> (b.importance*12+b.risk) - (a.importance*12+a.risk));
      reasons.push(`ยังไม่สแกนจุดสัมผัสสูง: ${unscannedHigh[0].name}`);
      if(unscannedHigh[1]) reasons.push(`อีกจุดสำคัญ: ${unscannedHigh[1].name}`);
    }
    if(STATE.timeLeft <= Math.max(20, Math.floor(STATE.timeTotal*0.25))){
      reasons.push('เวลาใกล้หมด — เลือก “จุดคุ้มงบ” ก่อน');
    }

    const key = `${STATE.stage}|${STATE.phase}|${risk}|${nba}|${reasons.join('|')}`;
    if(key === STATE.coach.lastKey) return;

    const stuck = (STATE.stage===1 && countScanned() < warmTargetCount() && STATE.timeLeft < STATE.timeTotal-15);
    const warn = (risk >= 70) || stuck;

    if(warn && nba){
      const r1 = reasons[0] || `ลองตรวจ ${nba} เพราะเป็นจุดเสี่ยงสูง`;
      const r2 = reasons[1] || `โหมดตอนนี้: ${STATE.phase} • แนะนำ: ${STATE.phase==='intervene'?'Clean':'UV/Swab'}`;
      const msg = `AI Coach: แนะนำไปที่ “${nba}”`;
      showCoach(msg, `เหตุผล: (1) ${r1} (2) ${r2}`);

      const box = qs('gdCoachBox');
      if(box) box.textContent = `${msg}\nเหตุผล: 1) ${r1}  2) ${r2}`;

      const rp = qs('gdRiskPill');
      if(rp) rp.textContent = `risk: ${risk}`;

      emitEvent('ai_coach_tip', { riskScore:risk, nextBestAction:nba, reason1:r1, reason2:r2 });
      STATE.coach.lastAt = t;
      STATE.coach.lastKey = key;
    } else {
      const box = qs('gdCoachBox');
      if(box) box.textContent = `riskScore=${risk} • next=${nba||'-'} • stage=${STATE.stage} • phase=${STATE.phase}`;
      const rp = qs('gdRiskPill');
      if(rp) rp.textContent = `risk: ${risk}`;
    }
  }

  // -------- actions --------
  function onHotspotAction(h, method){
    if(!h || STATE.ended) return;
    if(!STATE.running || STATE.paused) return;

    const tool = STATE.tool;

    if(tool === 'uv'){
      h.scanned = true;
      addEvidence({ type:'hotspot', target:h.name, info:'พบร่องรอยด้วย UV', method, tool:'uv' });
      h.risk = clamp(h.risk + (h._infected ? 8 : 2) + RNG()*4, 0, 100);
      applySpotClass(h);
      emitEvent('hotspot_uv', { target:h.name, risk:h.risk });
    } else if(tool === 'swab'){
      h.swabbed = true;
      const confirm = h._infected ? (RNG() < 0.92) : (RNG() < 0.15);
      if(confirm){
        h.verified = true;
        h.risk = clamp(h.risk + 10 + RNG()*6, 0, 100);
        addEvidence({ type:'sample', target:h.name, info:'Swab ยืนยัน: เสี่ยงจริง', method, tool:'swab' });
      }else{
        addEvidence({ type:'sample', target:h.name, info:'Swab: ไม่พบเชื้อ (อาจเป็น false negative)', method, tool:'swab' });
        h.risk = clamp(h.risk - (4 + RNG()*6), 0, 100);
      }
      applySpotClass(h);
      emitEvent('hotspot_swab', { target:h.name, verified:h.verified?1:0, risk:h.risk });
    } else if(tool === 'cam'){
      h.photoed = true;
      addEvidence({ type:'photo', target:h.name, info:'ถ่ายภาพหลักฐาน', method, tool:'cam' });
      applySpotClass(h);
      emitEvent('hotspot_cam', { target:h.name });
    } else if(tool === 'clean'){
      if(STATE.phase !== 'intervene' && STATE.stage < 3){
        showCoach('ยังไม่ถึงช่วง Clean แบบคุ้มสุด', 'ทำ Warm/Trick ก่อน แล้วค่อย Clean ใน Boss stage');
        return;
      }
      const cost = cleanCost(h);
      const left = budgetLeft();
      if(left < cost){
        showCoach('งบไม่พอ!', `งบเหลือ ${left} แต่ต้องใช้ ${cost}`);
        emitEvent('clean_failed', { target:h.name, reason:'budget', cost, left });
        return;
      }
      const before = Math.round(h.risk);
      const reduction = cleanEffect(h);
      h.risk = clamp(h.risk - reduction, 0, 100);
      h.cleaned = true;
      STATE.budget.spent += cost;
      STATE.budget.actions.push({ target:h.name, cost, riskBefore:before, riskAfter:Math.round(h.risk), tIso:isoNow() });
      addEvidence({ type:'clean', target:h.name, info:`ทำความสะอาด (-${reduction} risk)`, method, tool:'clean' });
      applySpotClass(h);
      updateBudgetUI();
      updateMissionUI();
      emitEvent('clean_done', { target:h.name, cost, riskBefore:before, riskAfter:Math.round(h.risk), impactEst:reduction, budgetLeft:budgetLeft() });
    }

    updateMissionUI();
    coachTick();
  }

  function cleanCost(h){
    const base = 12 + h.importance*4;
    const diff = cfg.diff==='hard' ? 1.15 : (cfg.diff==='easy' ? 0.9 : 1.0);
    return Math.round(base * diff);
  }
  function cleanEffect(h){
    const base = 18 + h.importance*6;
    const bonus = (h.verified ? 10 : 0) + (h.scanned ? 6 : 0);
    const diff = cfg.diff==='hard' ? 0.92 : (cfg.diff==='easy' ? 1.06 : 1.0);
    return Math.round((base + bonus) * diff);
  }

  // -------- shoot hit-test --------
  function hitTestByPoint(x,y, lockPx){
    let targetEl = null;
    try{ targetEl = DOC.elementFromPoint(x,y); }catch(_){}
    const spotEl = targetEl && targetEl.closest ? targetEl.closest('.gd-spot') : null;
    if(spotEl && spotEl.dataset && spotEl.dataset.id){
      return findHotspotById(spotEl.dataset.id);
    }
    lockPx = clamp(lockPx, 8, 120);
    let best = null, bestD = 1e9;
    STATE.hotspots.forEach(h=>{
      if(!h.el) return;
      const r = h.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const d = Math.hypot(cx - x, cy - y);
      if(d < bestD){ bestD = d; best = h; }
    });
    if(best && bestD <= lockPx) return best;
    return null;
  }

  function wireShoot(){
    WIN.addEventListener('hha:shoot', (ev)=>{
      const d = ev.detail || {};
      const x = Number(d.x), y = Number(d.y);
      const lockPx = Number(d.lockPx || 28);
      const h = hitTestByPoint(x,y, lockPx);
      if(h){
        onHotspotAction(h, d.source || 'shoot');
        emitEvent('shoot_hit', { target:h.name, source:d.source||'shoot', x, y, lockPx });
      }else{
        emitEvent('shoot_miss', { source:d.source||'shoot', x, y, lockPx });
      }
    }, false);
  }

  // -------- score/end --------
  function computeScore(reason){
    const truthInfected = STATE.hotspots.filter(h=> h._infected).map(h=> h.name);
    const predicted = STATE.hotspots.filter(h=> h.verified).map(h=> h.name);

    const tp = predicted.filter(x=> truthInfected.includes(x)).length;
    const fp = predicted.filter(x=> !truthInfected.includes(x)).length;
    const fn = truthInfected.filter(x=> !predicted.includes(x)).length;
    const precision = (tp+fp) ? tp/(tp+fp) : 0;
    const recall = (tp+fn) ? tp/(tp+fn) : 0;
    const accScore = Math.round((precision*0.6 + recall*0.4)*100);

    const inf = inferredChain();
    const infPairs = [];
    for(let i=0;i<inf.length-1;i++) infPairs.push([inf[i],inf[i+1]].join('>'));
    const truthPairs = (STATE.chain._truth||[]).map(p=> p[0]+'>'+p[1]);
    const chainHit = infPairs.filter(p=> truthPairs.includes(p)).length;
    const chainScore = Math.round(clamp((chainHit / Math.max(1, truthPairs.length)) * 100, 0, 100));

    const speedScore = Math.round(clamp((STATE.timeLeft / STATE.timeTotal)*100, 0, 100));

    const avgEnd = Math.round(avgRisk());
    const avgStart = Math.round(STATE.hotspots.reduce((a,h)=> a + (h.baseRisk||0), 0) / Math.max(1, STATE.hotspots.length));
    const reduce = clamp(avgStart - avgEnd, -100, 100);
    const interventionScore = Math.round(clamp(50 + reduce*1.2, 0, 100));

    const warmOk = countScanned() >= warmTargetCount();
    const trickOk = inferredChain().length >= 3;
    const bossOk = avgEnd <= diffBossTarget(cfg.diff);
    const missionBonus = (warmOk?6:0) + (trickOk?10:0) + (bossOk?14:0);

    const base =
      accScore*0.30 +
      chainScore*0.24 +
      interventionScore*0.26 +
      speedScore*0.20;

    const final = Math.round(clamp(base + missionBonus, 0, 100));
    const rank = final>=90?'S':final>=80?'A':final>=70?'B':final>=60?'C':'D';

    return {
      reason,
      final,
      rank,
      accuracy:{ score: accScore, tp, fp, fn, precision: +precision.toFixed(3), recall:+recall.toFixed(3) },
      chain:{ score: chainScore, hit: chainHit, truthPairs: truthPairs.length, chain: formatChainShort() },
      speed:{ score: speedScore, timeLeft: STATE.timeLeft, timeTotal: STATE.timeTotal },
      intervention:{ score: interventionScore, avgRiskStart: avgStart, avgRiskEnd: avgEnd, budgetSpent: STATE.budget.spent, budgetLeft: budgetLeft() },
      mission:{ warmOk, trickOk, bossOk, bonus: missionBonus }
    };
  }

  let _timer = null;
  let _feat = null;

  function startLoops(){
    STATE.running = true;
    STATE.paused = false;
    STATE.ended = false;
    STATE.timeLeft = STATE.timeTotal;

    updateTopPills();
    updateTimerUI();
    updateBudgetUI();
    updateEvidenceUI();
    updateMissionUI();

    emitEvent('session_start', {
      game:'germ-detective',
      run:cfg.run, diff:cfg.diff, time:STATE.timeTotal, seed:cfg.seed, pid:cfg.pid,
      scene:cfg.scene, view:cfg.view
    });

    if(_timer) clearInterval(_timer);
    _timer = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      STATE.timeLeft--;
      updateTimerUI();

      try{
        const feat = {
          game:'germ-detective',
          run:cfg.run, diff:cfg.diff, scene:cfg.scene, view:cfg.view,
          timeLeft:STATE.timeLeft, timeTotal:STATE.timeTotal,
          stage:STATE.stage, phase:STATE.phase,
          tool:STATE.tool,
          evidenceCount:STATE.evidence.length,
          uniqueTargets: uniqueTargetsTouched(),
          scanned: countScanned(),
          verified: verifiedCount(),
          avgRisk: Math.round(avgRisk()),
          budgetLeft: budgetLeft(),
          riskScore: computeRiskScore(),
          nextBestAction: nextBestAction(),
          chain: (STATE.chain.inferred||[]).slice(0,4).join('>') || ''
        };
        WIN.dispatchEvent(new CustomEvent('hha:features_1s', { detail: feat }));
      }catch(_){}

      coachTick();
      updateMissionUI();

      if(STATE.timeLeft <= 0){
        endGame('timeup');
      }
    }, 1000);

    if(_feat) clearInterval(_feat);
    _feat = setInterval(()=>{ if(!STATE.paused && !STATE.ended) coachTick(); }, 1500);
  }

  function endGame(reason){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.running = false;
    if(_timer) clearInterval(_timer);
    if(_feat) clearInterval(_feat);

    const score = computeScore(reason);
    STATE.score = score;

    emitEvent('session_end', { reason, score });
    try{ WIN.dispatchEvent(new CustomEvent('hha:end', { detail:{ reason, score } })); }catch(_){}
    showCoach(`จบเกม: คะแนน ${score.final} • Rank ${score.rank}`, `chain=${score.chain.chain||'-'} • avgRisk=${score.intervention.avgRiskEnd}`);
  }

  function submitReport(){
    if(STATE.phase !== 'report'){
      showCoach('ยังไม่ถึงช่วงรายงาน แต่ส่งได้ (คะแนนจะไม่เต็ม)', 'ทำ Trick/Boss ให้สำเร็จก่อนจะได้โบนัสเพิ่ม');
    }
    endGame('submitted');
    try{ alert(`ส่งรายงานแล้ว! คะแนน ${STATE.score?.final ?? '-'} Rank ${STATE.score?.rank ?? '-'}`); }catch(_){}
  }

  function init(){
    buildHotspots();
    buildUI();
    renderHotspots();
    wireShoot();

    setTool('uv');
    setPhase('investigate');
    setStage(1);

    WIN.GD = WIN.GD || {};
    WIN.GD.started = true;

    WIN.addEventListener('message', (ev)=>{
      const m = ev.data;
      if(!m) return;
      if(m.type === 'command' && m.action === 'setTool' && m.value) setTool(m.value);
      if(m.type === 'command' && m.action === 'pause') { if(!STATE.paused) togglePause(); }
      if(m.type === 'command' && m.action === 'resume') { if(STATE.paused) togglePause(); }
    }, false);

    WIN.addEventListener('keydown', (e)=>{
      if(e.key==='1') setTool('uv');
      if(e.key==='2') setTool('swab');
      if(e.key==='3') setTool('cam');
      if(e.key==='4') setTool('clean');
    }, false);

    startLoops();
    showCoach('คดีเริ่มแล้ว! มีคนป่วยหลายคน — ต้องหา “จุดแพร่” ให้เร็ว', 'เริ่มจาก UV ที่ลูกบิด/มือถือ/ช้อนกลาง แล้ว Swab ยืนยัน');
  }

  return { init, getState: ()=> STATE, setTool, stop: ()=> { STATE.running=false; STATE.ended=true; if(_timer) clearInterval(_timer); if(_feat) clearInterval(_feat); } };
}