// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — PRODUCTION v20260218a
// PC/Mobile/cVR supported
// Core loop: ColdOpen -> Explore -> Evidence combo (UV->Swab->Cam) -> Chain A->B->C -> Triage Cleaning (resources) -> End (R0/Exposure + Badge)
// AI: Level1 Heuristic Coach (explainable, no-leakage, baseline-able). ML/DL hooks prepared in logs (future work).
// Offline logs: localStorage (events/sessions) + export CSV/JSON

export default function Game(opts = {}) {
  const cfg = Object.assign({
    mountId: 'gdApp',
    ctx: {
      hub:'../hub.html', run:'play',
      caseId:'classroom', view:'pc', diff:'normal',
      timeSec:240, pid:'anon', seed:String(Date.now()),
      ai:1, gate:1
    },
    offlineLog: true,
    offlineKey: 'HHA_GD_OFFLINE_LOGS_V1',
    offlineMaxEvents: 4000,
    lastSummaryKey: 'HHA_LAST_SUMMARY',
  }, opts);

  const CTX = cfg.ctx || {};
  const DOC = document;
  const WIN = window;

  // ---------- helpers ----------
  const now = ()=> (WIN.performance && performance.now ? performance.now() : Date.now());
  const iso = ()=> new Date().toISOString();
  function qs(id){ return DOC.getElementById(id); }
  function el(tag='div', cls=''){ const e = DOC.createElement(tag); if(cls) e.className = cls; return e; }
  function clamp(v,a,b){ v=Number(v); if(!Number.isFinite(v)) v=a; return Math.max(a, Math.min(b,v)); }
  function rand01(seedObj){
    // xorshift32 deterministic
    let x = seedObj.x|0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    seedObj.x = x|0;
    return ((x>>>0) / 4294967296);
  }
  function pick(seedObj, arr){
    if(!arr.length) return null;
    const i = Math.floor(rand01(seedObj) * arr.length);
    return arr[Math.max(0, Math.min(arr.length-1, i))];
  }
  function pad2(n){ n=Number(n)||0; return (n<10?'0':'')+n; }
  function fmtSec(s){ s=Number(s); if(!Number.isFinite(s) || s<0) return '—'; const m=Math.floor(s/60), r=Math.floor(s%60); return `${m}:${pad2(r)}`; }

  function b64(s){
    try{ return btoa(unescape(encodeURIComponent(String(s||'')))).replace(/=+$/,''); }
    catch{ return String(s||''); }
  }
  function makeSessionId(){
    const pid = CTX.pid || 'anon';
    const seed = CTX.seed || '';
    const t = String(Date.now());
    return b64(pid+'|'+seed+'|'+t).slice(0,22);
  }

  // ---------- Offline Store ----------
  const OfflineStore = (function(){
    function load(){
      try{
        const raw = localStorage.getItem(cfg.offlineKey);
        const obj = raw ? JSON.parse(raw) : null;
        return obj && typeof obj === 'object'
          ? obj
          : { v:1, sessions:[], events:[] };
      }catch(_){
        return { v:1, sessions:[], events:[] };
      }
    }
    function save(data){
      try{ localStorage.setItem(cfg.offlineKey, JSON.stringify(data)); }catch(_){}
    }
    function appendEvent(ev){
      if(!cfg.offlineLog) return;
      const data = load();
      data.events.unshift(ev);
      if(data.events.length > cfg.offlineMaxEvents) data.events.length = cfg.offlineMaxEvents;
      save(data);
    }
    function appendSession(sess){
      if(!cfg.offlineLog) return;
      const data = load();
      data.sessions.unshift(sess);
      if(data.sessions.length > 500) data.sessions.length = 500;
      save(data);
    }
    function clearAll(){ try{ localStorage.removeItem(cfg.offlineKey); }catch(_){ } }
    function getAll(){ return load(); }
    return { appendEvent, appendSession, clearAll, getAll };
  })();

  function logEvent(name, payload){
    const evt = {
      kind:'event',
      ts: iso(),
      game:'germ-detective',
      session_id: STATE.sessionId || null,
      pid: CTX.pid || 'anon',
      run: CTX.run || '',
      view: CTX.view || '',
      diff: CTX.diff || '',
      seed: CTX.seed || '',
      caseId: CTX.caseId || '',
      name,
      payload: payload || {}
    };
    OfflineStore.appendEvent(evt);

    // optional compatibility hooks (no network required)
    try{
      if(WIN.PlateSafe && typeof WIN.PlateSafe.logEvent === 'function'){
        WIN.PlateSafe.logEvent(name, payload||{});
      }
    }catch(_){}
    try{
      if(WIN.PlateLogger && typeof WIN.PlateLogger.logEvent === 'function'){
        WIN.PlateLogger.logEvent(name, payload||{});
      }
    }catch(_){}
  }

  // ---------- Core state ----------
  const STATE = {
    sessionId: null,
    running: false,
    ended: false,

    t0: 0,
    timeLeft: clamp(CTX.timeSec ?? 240, 90, 480),

    view: String(CTX.view||'pc'),
    diff: String(CTX.diff||'normal'),
    caseId: String(CTX.caseId||'classroom'),
    gate: clamp(CTX.gate ?? 1, 1, 2),

    zoneIdx: 0,
    zones: [],

    tool: 'uv', // uv|swab|cam|clean
    resources: { spray: 6, cloth: 6, time: 3 }, // triage resources (diff affects)
    r0: 1.55,
    exposure: 0.65, // 0..1

    // evidence records
    evidence: [], // {type:'uv'|'swab'|'photo'|'inspect', target, zone, quality, t, meta}
    comboState: new Map(), // target -> {uv, swab, cam}
    chain: [], // [{from,to,why}]

    // scoring
    score: 0,
    alert: 0, // penalties
    waste: 0, // wasted cleaning
    chainOk: 0,

    // outbreak dynamics
    outbreak: { active:false, tLeft:0, gapSec:26, since:0, infected:new Set() },

    // logging/proxy actions
    shots: { total:0, hit:0, miss:0 },
    mistakesByTarget: new Map(),

    // AI L1
    ai: {
      enabled: (Number(CTX.ai)||0) === 1,
      skill: 0.45,
      chaos: 0.35,
      focusTarget: null,
      lastTipAt: 0,
      lockBonusPx: 0
    }
  };

  // ---------- Case & world data ----------
  function buildCase(caseId, diff){
    const seedObj = { x: hash32(String(CTX.seed||Date.now())) };

    // base zones
    const Z = (caseId === 'home')
      ? [
          { id:'home-living', name:'บ้าน • ห้องนั่งเล่น', hotspots: [
            { name:'ลูกบิดประตู', tag:'hub', base:'hi' },
            { name:'รีโมททีวี', tag:'touch', base:'mid' },
            { name:'โทรศัพท์', tag:'hub', base:'hi' },
            { name:'โต๊ะกลาง', tag:'touch', base:'mid' },
            { name:'แก้วน้ำ', tag:'touch', base:'mid' },
          ]},
          { id:'home-kitchen', name:'บ้าน • ครัว', hotspots: [
            { name:'ก๊อกน้ำ', tag:'hub', base:'hi' },
            { name:'ฟองน้ำ', tag:'hub', base:'hi' },
            { name:'เขียง', tag:'touch', base:'mid' },
            { name:'ลูกบิดตู้เย็น', tag:'hub', base:'hi' },
            { name:'ช้อนส้อม', tag:'touch', base:'mid' },
          ]},
          { id:'home-bath', name:'บ้าน • ห้องน้ำ', hotspots: [
            { name:'ลูกบิดห้องน้ำ', tag:'hub', base:'hi' },
            { name:'ก๊อกอ่างล้างมือ', tag:'hub', base:'hi' },
            { name:'ฝารองนั่ง', tag:'touch', base:'mid' },
            { name:'ผ้าเช็ดมือ', tag:'touch', base:'mid' },
          ]},
        ]
      : [
          { id:'classroom', name:'โรงเรียน • ห้องเรียน', hotspots: [
            { name:'ลูกบิดประตู', tag:'hub', base:'hi' },
            { name:'โต๊ะครู', tag:'touch', base:'mid' },
            { name:'โต๊ะนักเรียน', tag:'touch', base:'mid' },
            { name:'ปากกา/ดินสอร่วม', tag:'hub', base:'hi' },
            { name:'หนังสือห้องสมุด', tag:'touch', base:'mid' },
          ]},
          { id:'canteen', name:'โรงเรียน • โรงอาหาร', hotspots: [
            { name:'ถาดอาหาร', tag:'touch', base:'mid' },
            { name:'ช้อนส้อม', tag:'hub', base:'hi' },
            { name:'ก๊อกน้ำ', tag:'hub', base:'hi' },
            { name:'โต๊ะอาหาร', tag:'touch', base:'mid' },
          ]},
          { id:'toilet', name:'โรงเรียน • ห้องน้ำ', hotspots: [
            { name:'ลูกบิดห้องน้ำ', tag:'hub', base:'hi' },
            { name:'ก๊อกอ่างล้างมือ', tag:'hub', base:'hi' },
            { name:'ผ้าเช็ดมือ', tag:'touch', base:'mid' },
          ]},
        ];

    // assign true/fake + infected seeds (deterministic)
    const allTargets = [];
    Z.forEach(z=> z.hotspots.forEach(h=> allTargets.push({ zone:z.id, name:h.name, tag:h.tag, base:h.base })));

    // truth table: 25% fake (decoy) but fair: UV reveals decoy pattern "flat"
    const truth = new Map(); // name -> 'true'|'fake'
    const infected = new Set();
    allTargets.forEach(t=>{
      const r = rand01(seedObj);
      truth.set(t.name, (r < 0.25 ? 'fake' : 'true'));
    });

    // choose infected nodes: 2-3 based on diff
    const nInf = (diff==='hard') ? 3 : (diff==='easy' ? 2 : 2);
    const hubs = allTargets.filter(t=>t.tag==='hub');
    for(let i=0;i<nInf;i++){
      const pickT = pick(seedObj, hubs.length ? hubs : allTargets);
      if(pickT) infected.add(pickT.name);
    }

    // resources by diff
    const res = (diff==='hard')
      ? { spray: 5, cloth: 5, time: 2 }
      : (diff==='easy' ? { spray: 7, cloth: 7, time: 4 } : { spray: 6, cloth: 6, time: 3 });

    // objectives: top-touch hubs must be checked (fair trigger for AI)
    const objectives = [];
    const must = allTargets.filter(t=>t.tag==='hub').slice(0,5);
    must.forEach(t=> objectives.push({ type:'scan', tool:'uv', target:t.name }));
    objectives.push({ type:'chain', need:3 });
    objectives.push({ type:'r0', below:1.0 });

    return { zones: Z, truth, infected, resources: res, objectives };
  }

  // stable hash for seed -> int32
  function hash32(str){
    str = String(str||'');
    let h = 2166136261;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h|0;
  }

  // ---------- UI refs ----------
  let ROOT=null, hud=null, toolbar=null, board=null, pill=null, overlay=null;
  let layer=null, fxLayer=null, zoneTitle=null;

  // ---------- Build UI ----------
  function buildUI(){
    ROOT = qs(cfg.mountId) || DOC.body;

    const wrap = el('div','gd-scene');
    ROOT.appendChild(wrap);

    zoneTitle = el('div','gd-zone-title');
    zoneTitle.textContent = '—';
    DOC.body.appendChild(zoneTitle);

    // main scene layer (DOM proxy)
    layer = el('div','gd-layer');
    fxLayer = el('div','gd-fx');
    layer.appendChild(fxLayer);
    wrap.appendChild(layer);

    // HUD top
    hud = el('div','gd-hud');
    hud.innerHTML = `
      <div class="gd-card" style="min-width:180px;">
        <div class="gd-title">⏱ เวลา</div>
        <div class="gd-val" id="gdTime">—</div>
      </div>
      <div class="gd-card" style="min-width:220px;">
        <div class="gd-title">🦠 R₀ (การแพร่)</div>
        <div class="gd-val" id="gdR0">—</div>
        <div class="gd-gauge"><i id="gdR0Bar"></i></div>
        <div class="gd-gauge-label"><span>&lt;1 ปลอดภัย</span><span>&gt;1 เสี่ยง</span></div>
      </div>
      <div class="gd-card" style="min-width:180px;">
        <div class="gd-title">⚠ Exposure</div>
        <div class="gd-val" id="gdExp">—</div>
      </div>
      <div class="gd-card" style="min-width:220px;">
        <div class="gd-title">🧰 Resources</div>
        <div class="gd-val" id="gdRes">—</div>
      </div>
    `;
    DOC.body.appendChild(hud);

    // toolbar bottom
    toolbar = el('div','gd-toolbar');
    toolbar.innerHTML = `
      <button class="gd-btn" id="gdToolUV">UV</button>
      <button class="gd-btn" id="gdToolSwab">Swab</button>
      <button class="gd-btn" id="gdToolCam">Camera</button>
      <button class="gd-btn" id="gdToolClean">Clean</button>
      <button class="gd-btn" id="gdBtnChain">🧩 Chain</button>
      <button class="gd-btn" id="gdBtnSubmit">📤 ส่งรายงาน</button>
      <button class="gd-btn" id="gdBtnPause">⏸ Pause</button>
      <button class="gd-btn" id="gdBtnBack">↩ HUB</button>
    `;
    DOC.body.appendChild(toolbar);

    // coach pill
    pill = el('div','gd-pill'); pill.id='gdPill';
    DOC.body.appendChild(pill);

    // evidence board
    board = el('div','gd-board');
    board.innerHTML = `
      <h3>หลักฐาน & Chain</h3>
      <div class="mini" id="gdObj">—</div>
      <div id="gdEvList"></div>
      <div class="gd-chain" id="gdChainBox">
        <div class="mini"><b>Chain (A→B→C)</b> ลากเลือก 2 จุดเพื่อเชื่อม • ต้องได้ ≥ 3 เส้น</div>
        <div id="gdChainList"></div>
      </div>
    `;
    DOC.body.appendChild(board);

    // overlays: cold open / chain builder / end
    overlay = el('div','gd-overlay'); overlay.id='gdOverlay';
    DOC.body.appendChild(overlay);

    wireUI();
  }

  function setPill(msg){
    if(!pill) return;
    if(!msg){ pill.style.display='none'; return; }
    pill.textContent = msg;
    pill.style.display = 'inline-flex';
    setTimeout(()=>{ try{ pill.style.display='none'; }catch{} }, 4200);
  }

  function setTool(t){
    STATE.tool = t;
    ['gdToolUV','gdToolSwab','gdToolCam','gdToolClean'].forEach(id=>{
      const b = qs(id); if(!b) return;
      const on = (id === 'gdToolUV' && t==='uv') ||
                 (id === 'gdToolSwab' && t==='swab') ||
                 (id === 'gdToolCam' && t==='cam') ||
                 (id === 'gdToolClean' && t==='clean');
      b.dataset.on = on ? '1' : '0';
    });
    logEvent('tool_change', { tool:t });
  }

  function wireUI(){
    qs('gdToolUV').onclick = ()=> setTool('uv');
    qs('gdToolSwab').onclick = ()=> setTool('swab');
    qs('gdToolCam').onclick = ()=> setTool('cam');
    qs('gdToolClean').onclick = ()=> setTool('clean');

    qs('gdBtnChain').onclick = ()=> openChainOverlay();
    qs('gdBtnSubmit').onclick = ()=> submitReport();
    qs('gdBtnPause').onclick = ()=> togglePause();
    qs('gdBtnBack').onclick = ()=> backHub();

    // cVR shoot / click/tap support
    // click/tap on hotspot uses pointer coords; cVR uses hha:shoot center aiming (from vr-ui.js)
    WIN.addEventListener('hha:shoot', (ev)=>{
      const d = ev.detail || {};
      onShoot(d.x, d.y, Number(d.lockPx)||28, d.source||'tap');
    });

    // desktop: click inside layer hits
    layer.addEventListener('pointerdown', (ev)=>{
      if(ev.defaultPrevented) return;
      if(String(CTX.view||'') === 'cvr') return; // cvr strictly uses crosshair shoot
      onShoot(ev.clientX, ev.clientY, 28, 'pointer');
    }, { passive:true });

    // space shoot in any view
    DOC.addEventListener('keydown', (ev)=>{
      if(ev.code === 'Space'){
        onShoot(innerWidth/2, innerHeight/2, 28, 'space');
      }
      if(ev.key === '1') setTool('uv');
      if(ev.key === '2') setTool('swab');
      if(ev.key === '3') setTool('cam');
      if(ev.key === '4') setTool('clean');
    });
  }

  // ---------- Hotspots spawn (DOM) ----------
  const WORLD = {
    truth: new Map(),
    infected: new Set(),
    objectives: [],
    // zone-> target objects with runtime fields
    zones: []
  };

  function placeHotspots(zone){
    // clear old
    layer.querySelectorAll('.gd-spot').forEach(n=> n.remove());

    zoneTitle.textContent = zone.name;

    const seedObj = { x: hash32(String(CTX.seed||Date.now()) + '|' + zone.id) };
    const w = layer.clientWidth, h = layer.clientHeight;

    const used = [];
    function ok(x,y){
      // keep away from top (hud) and bottom (toolbar)
      const safeTop = 64, safeBottom = 64;
      if(y < safeTop || y > (h - safeBottom)) return false;
      for(const p of used){
        const dx = x-p.x, dy=y-p.y;
        if(dx*dx+dy*dy < 110*110) return false;
      }
      return true;
    }

    zone.hotspots.forEach((hs)=>{
      let x=0,y=0;
      for(let k=0;k<40;k++){
        x = 80 + rand01(seedObj)*(w-160);
        y = 80 + rand01(seedObj)*(h-160);
        if(ok(x,y)) break;
      }
      used.push({x,y});

      const d = el('div','gd-spot');
      d.textContent = hs.name;
      d.style.left = x+'px';
      d.style.top = y+'px';

      // mark visually high-touch hubs (fair hint)
      if(hs.tag === 'hub') d.dataset.risk = 'hub';
      else if(hs.base === 'hi') d.dataset.risk = 'hi';

      d.dataset.name = hs.name;
      d.dataset.zone = zone.id;
      d.dataset.clean = '0';

      // runtime record
      hs._x = x; hs._y = y; hs._el = d;
      layer.appendChild(d);
    });
  }

  function currentZone(){
    return WORLD.zones[STATE.zoneIdx] || WORLD.zones[0];
  }

  // ---------- Evidence + Combo + Scoring ----------
  function ensureCombo(target){
    let c = STATE.comboState.get(target);
    if(!c){ c = { uv:false, swab:false, cam:false }; STATE.comboState.set(target, c); }
    return c;
  }

  function addEvidence(rec){
    rec.t = iso();
    STATE.evidence.push(rec);

    // update board list (latest first)
    const list = qs('gdEvList');
    if(list){
      const item = el('div','gd-ev');
      item.innerHTML = `<b>${rec.type.toUpperCase()}</b> • ${rec.target} <span class="mini">(${rec.zone})</span><div class="mini">${rec.info||''}</div>`;
      list.insertBefore(item, list.firstChild);
      // keep list short in UI
      while(list.children.length > 10) list.removeChild(list.lastChild);
    }

    logEvent('evidence_added', rec);

    // score update (quality matters)
    const q = clamp(rec.quality ?? 0.5, 0, 1);
    const add = Math.round(30 + 70*q);
    STATE.score += add;

    // reduce exposure slightly if strong evidence helps triage
    STATE.exposure = clamp(STATE.exposure - 0.01*q, 0, 1);
  }

  function markMistake(target, kind){
    if(target){
      const n = (STATE.mistakesByTarget.get(target) || 0) + 1;
      STATE.mistakesByTarget.set(target, n);
    }
    STATE.alert += 1;
    STATE.score = Math.max(0, STATE.score - 25);
    logEvent('mistake', { target: target||'', kind });
    aiUpdateSkill({ hit:false, target: target||'' });
  }

  // ---------- R0 / Exposure model (simple, visible, fair) ----------
  // R0 rises with outbreak + high-touch uncleaned + time pressure; falls with cleaning hubs + correct chain + evidence quality
  function recomputeRisk(){
    const zone = currentZone();

    // base by diff
    const base = (STATE.diff==='hard') ? 1.65 : (STATE.diff==='easy' ? 1.35 : 1.55);

    // count hub hotspots cleaned
    const all = WORLD.zones.flatMap(z=> z.hotspots);
    const hubs = all.filter(h=>h.tag==='hub');
    const cleaned = hubs.filter(h=> h._el && h._el.dataset.clean === '1').length;
    const cleanRatio = hubs.length ? (cleaned / hubs.length) : 0;

    // outbreak adds
    const ob = STATE.outbreak.active ? 0.22 : 0;

    // chain correctness reduces (cap)
    const chainBonus = clamp(STATE.chainOk * 0.06, 0, 0.22);

    // evidence quality reduces
    const q = averageEvidenceQuality();
    const qBonus = clamp(q * 0.18, 0, 0.18);

    // time pressure: last 60s adds
    const pressure = (STATE.timeLeft < 60) ? 0.10 : 0;

    let r0 = base + ob + pressure - (0.55*cleanRatio) - chainBonus - qBonus;
    r0 = clamp(r0, 0.6, 2.4);

    // exposure: depends on unclean infected hubs + time + mistakes
    let exp = 0.45 + (STATE.outbreak.active ? 0.12 : 0);
    exp += clamp((STATE.alert * 0.03), 0, 0.24);
    exp += (STATE.timeLeft < 60) ? 0.08 : 0;
    exp -= clamp(cleanRatio * 0.22, 0, 0.22);
    exp = clamp(exp, 0, 1);

    STATE.r0 = r0;
    STATE.exposure = exp;
  }

  function averageEvidenceQuality(){
    const ev = STATE.evidence.filter(e=>!e?.meta?.practice);
    if(!ev.length) return 0.0;
    let s=0;
    for(const e of ev) s += clamp(e.quality ?? 0.5, 0, 1);
    return s / ev.length;
  }

  // ---------- Outbreak scheduler (dynamic) ----------
  function outbreakTick(){
    STATE.outbreak.since++;

    if(!STATE.outbreak.active && STATE.outbreak.since >= (STATE.outbreak.gapSec||26)){
      STATE.outbreak.active = true;
      STATE.outbreak.tLeft = 10 + Math.round(STATE.ai.enabled ? STATE.ai.chaos*6 : 0);
      STATE.outbreak.since = 0;
      STATE.outbreak.infected = new Set();

      // pick infected targets weighted to hubs
      const all = WORLD.zones.flatMap(z=> z.hotspots);
      const hubs = all.filter(h=>h.tag==='hub');
      const pool = (hubs.length ? hubs : all).map(h=> h.name);
      const seedObj = { x: hash32(String(CTX.seed)+'|outbreak|'+STATE.timeLeft) };

      const pickN = clamp((STATE.diff==='hard'?2:1) + Math.round((STATE.ai.chaos||0.3)*2), 1, 3);
      for(let i=0;i<pickN && pool.length;i++){
        const idx = Math.floor(rand01(seedObj) * pool.length);
        STATE.outbreak.infected.add(pool.splice(idx,1)[0]);
      }

      logEvent('outbreak_start', { tLeft: STATE.outbreak.tLeft, infected:[...STATE.outbreak.infected] });
      setPill('🦠 Outbreak! รีบลด R₀: เน้นจุดสัมผัส hub + clean ให้คุ้ม');
    }

    if(STATE.outbreak.active){
      STATE.outbreak.tLeft--;
      if(STATE.outbreak.tLeft <= 0){
        STATE.outbreak.active = false;
        STATE.outbreak.infected = new Set();
        logEvent('outbreak_end', {});
      }
    }
  }

  // ---------- AI Level 1 (Explainable coach + pacing, no leakage) ----------
  function ensureClue(target){
    // clue state stored on hotspot object
    const hs = findHotspotByName(target);
    if(!hs._clue){
      hs._clue = {
        truth: WORLD.truth.get(target) || 'true',
        revealedByUV: false,
        swabOk: false,
        photoOk: false
      };
    }
    return hs._clue;
  }

  function predictRisk(target){
    // purely from observable + state (no future data)
    const hs = findHotspotByName(target);
    const c = ensureClue(target);
    let r = 0.35;

    if(hs.tag === 'hub') r += 0.18;
    if(hs.base === 'hi') r += 0.10;
    if(STATE.outbreak.active && STATE.outbreak.infected.has(target)) r += 0.22;

    // fake suspect risk until UV reveals
    if(c.truth === 'fake' && !c.revealedByUV) r += 0.25;

    // player mistakes on this target
    const bad = STATE.mistakesByTarget.get(target) || 0;
    r += Math.min(0.18, bad*0.06);

    // difficulty baseline
    if(STATE.diff === 'hard') r += 0.08;
    if(STATE.diff === 'easy') r -= 0.06;

    // skill reduces risk (better players handle)
    r -= (STATE.ai.skill - 0.45) * 0.20;

    return clamp(r, 0.05, 0.95);
  }

  function aiPickNextTarget(){
    if(!STATE.ai.enabled) return null;

    const zone = currentZone();
    const done = new Set(STATE.evidence.map(e=>e.target));
    const pool = zone.hotspots.map(h=>h.name).filter(n=>!done.has(n));

    const candidates = pool.length ? pool : zone.hotspots.map(h=>h.name);
    let best=null, bestScore=-1;

    for(const t of candidates){
      const risk = predictRisk(t);
      const c = ensureCombo(t);
      const needCombo = !(c.uv && c.swab && c.cam);
      const bonus = needCombo ? 0.10 : 0;
      const s = (risk + bonus) * (0.9 + Math.random()*0.2);
      if(s > bestScore){ bestScore=s; best=t; }
    }
    return best;
  }

  function aiMaybeTip(){
    if(!STATE.ai.enabled) return;
    const t = now();
    if(t - STATE.ai.lastTipAt < 5200) return;

    // detect "missing important hub hotspot" in current zone
    const zone = currentZone();
    const hubs = zone.hotspots.filter(h=>h.tag==='hub').map(h=>h.name);
    const scannedUV = new Set(STATE.evidence.filter(e=>e.type==='uv').map(e=>e.target));
    const missingHub = hubs.find(h=> !scannedUV.has(h));

    let tip = '';
    if(missingHub && (cfg.ctx.timeSec - STATE.timeLeft) > 18){
      tip = `AI Coach: ลองตรวจ "${missingHub}" ด้วย UV — จุดสัมผัสสูง (เหตุผล: hub hotspot ยังไม่สแกน)`;
      STATE.ai.focusTarget = missingHub;
    }else{
      const target = aiPickNextTarget();
      if(!target) return;
      const c = ensureClue(target);
      if(c.truth === 'fake' && !c.revealedByUV){
        tip = `AI Coach: "${target}" อาจเป็นจุดหลอก — ใช้ UV ก่อนเพื่อดู pattern แล้วค่อย Swab/Camera`;
      }else{
        tip = `AI Coach: โฟกัส "${target}" ทำคอมโบ UV→Swab→Cam เพื่อคุณภาพหลักฐานสูง`;
      }
      STATE.ai.focusTarget = target;
    }

    if(tip){
      setPill(tip);
      logEvent('ai_tip', { tip, focus: STATE.ai.focusTarget || '' });
      STATE.ai.lastTipAt = t;
    }
  }

  function aiUpdateSkill(){
    if(!STATE.ai.enabled) return;
    const total = STATE.shots.total || 0;
    const acc = total ? (STATE.shots.hit / total) : 0.45;

    const ev = STATE.evidence.filter(e=>!e?.meta?.practice);
    const dt = Math.max(1, (cfg.ctx.timeSec - STATE.timeLeft));
    const pace = clamp(ev.length / dt, 0, 0.12);
    const paceN = clamp(pace / 0.06, 0, 1);

    const targetSkill = clamp(0.65*acc + 0.35*paceN, 0.05, 0.95);
    STATE.ai.skill = clamp(STATE.ai.skill*0.88 + targetSkill*0.12, 0.05, 0.95);
  }

  function aiApplyPacing(){
    if(!STATE.ai.enabled) return;
    const s = STATE.ai.skill;

    STATE.ai.chaos = clamp(0.25 + (s - 0.45)*0.55, 0.10, 0.70);

    // outbreak gap dynamic
    const baseGap = (STATE.diff==='hard') ? 20 : (STATE.diff==='easy' ? 32 : 26);
    STATE.outbreak.gapSec = Math.round(clamp(baseGap - STATE.ai.chaos*10, 14, 34));

    // cVR assist fairness
    if(STATE.view === 'cvr'){
      const extra = Math.round(clamp((0.55 - s)*18, -4, 10));
      STATE.ai.lockBonusPx = extra;
    }else{
      STATE.ai.lockBonusPx = 0;
    }
  }

  // ---------- Interaction: shooting hotspots ----------
  function findDomHotspotAt(x,y, lockPx){
    const rect = layer.getBoundingClientRect();
    const px = x - rect.left, py = y - rect.top;
    const list = currentZone().hotspots;

    let best=null, bestD=Infinity;
    for(const h of list){
      if(!h._el) continue;
      const hx = Number(h._x)||0, hy = Number(h._y)||0;
      const dx = px - hx, dy = py - hy;
      const d2 = dx*dx + dy*dy;
      if(d2 < bestD){
        bestD = d2; best = h;
      }
    }
    const lock = Math.max(18, Number(lockPx)||28);
    if(best && bestD <= lock*lock) return best;
    return null;
  }

  function fxBurst(x,y){
    const b = el('div','gd-burst');
    b.style.left = x+'px';
    b.style.top  = y+'px';
    fxLayer.appendChild(b);
    setTimeout(()=>{ try{ b.remove(); }catch{} }, 520);
  }

  function onShoot(clientX, clientY, lockPx, source){
    if(STATE.ended) return;
    if(!STATE.running) return;

    const lock = (Number(lockPx)||28) + (STATE.ai.lockBonusPx||0);
    const hit = findDomHotspotAt(clientX, clientY, lock);

    STATE.shots.total++;
    if(!hit){
      STATE.shots.miss++;
      logEvent('shot_miss', { source, lock });
      aiUpdateSkill();
      return;
    }

    STATE.shots.hit++;
    logEvent('shot_hit', { target: hit.name, zone: hit.zone||currentZone().id, source, lock });
    aiUpdateSkill();

    // local fx
    const rect = layer.getBoundingClientRect();
    fxBurst(clientX - rect.left, clientY - rect.top);

    // apply tool action
    applyToolOn(hit);
  }

  function findHotspotByName(name){
    for(const z of WORLD.zones){
      for(const h of z.hotspots){
        if(h.name === name) return h;
      }
    }
    return WORLD.zones[0].hotspots[0];
  }

  function applyToolOn(hs){
    const target = hs.name;
    const zoneId = currentZone().id;

    // if clean tool -> triage decision
    if(STATE.tool === 'clean'){
      doClean(hs);
      return;
    }

    const c = ensureCombo(target);
    const clue = ensureClue(target);

    if(STATE.tool === 'uv'){
      c.uv = true;
      clue.revealedByUV = true;

      // reveal: true shows "pattern", fake shows "flat"
      const isFake = (clue.truth === 'fake');
      const q = isFake ? 0.35 : 0.70;

      hs._el.style.boxShadow = isFake
        ? '0 0 16px rgba(251,191,36,0.55)'
        : '0 0 16px rgba(99,102,241,0.65)';
      setTimeout(()=>{ try{ hs._el.style.boxShadow=''; }catch{} }, 1200);

      addEvidence({
        type:'uv',
        target,
        zone: zoneId,
        quality: q,
        info: isFake ? 'UV: pattern แบน (จุดหลอก/ความเสี่ยงต่ำ)' : 'UV: พบ pattern น่าสงสัย',
        meta:{ truthHint: isFake?'fake':'true' }
      });

      // small immediate risk improvement if hub scanned
      if(hs.tag==='hub') STATE.exposure = clamp(STATE.exposure - 0.01, 0, 1);
      return;
    }

    if(STATE.tool === 'swab'){
      // must have UV first for best quality (fair combo)
      if(!c.uv){
        markMistake(target, 'swab_without_uv');
        addEvidence({ type:'swab', target, zone: zoneId, quality: 0.25, info:'Swab (ไม่มี UV ก่อน) → คุณภาพต่ำ', meta:{ lowQuality:true } });
        return;
      }
      c.swab = true;

      // swab "value" depends on infected + truth
      const infected = (WORLD.infected.has(target) || (STATE.outbreak.active && STATE.outbreak.infected.has(target)));
      const isFake = (clue.truth === 'fake');
      const ok = infected && !isFake;

      clue.swabOk = ok;

      addEvidence({
        type:'swab',
        target,
        zone: zoneId,
        quality: ok ? 0.85 : (isFake ? 0.35 : 0.55),
        info: ok ? 'Swab: พบค่าเชื้อสูง (ยืนยันความเสี่ยง)' : (isFake ? 'Swab: ค่าไม่ชัด (ส่อว่าเป็นจุดหลอก)' : 'Swab: พบค่าเล็กน้อย'),
        meta:{ infected: ok }
      });

      // if swab confirms infected, raise urgency (but also gives player clarity)
      if(ok) setPill(`ยืนยันแล้ว: "${target}" เสี่ยงสูง — พิจารณา clean ก่อนเพื่อกด R₀`);
      return;
    }

    if(STATE.tool === 'cam'){
      // camera wants UV+Swab for best (combo)
      const q = (c.uv && c.swab) ? 0.95 : (c.uv ? 0.70 : 0.45);
      c.cam = true;
      clue.photoOk = true;

      addEvidence({
        type:'photo',
        target,
        zone: zoneId,
        quality: q,
        info: (c.uv && c.swab) ? 'Photo: หลักฐานสมบูรณ์ (combo)' : 'Photo: บันทึกภาพ (หลักฐานเสริม)',
        meta:{ combo: (c.uv && c.swab) }
      });

      // combo bonus
      if(c.uv && c.swab){
        STATE.score += 60;
        setPill('🔥 Sleuth Combo! คุณภาพหลักฐานสูง + โบนัสคะแนน');
      }
      return;
    }
  }

  // ---------- Cleaning triage ----------
  function doClean(hs){
    const target = hs.name;
    const zoneId = currentZone().id;

    if(hs._el.dataset.clean === '1'){
      // waste
      STATE.waste += 1;
      STATE.score = Math.max(0, STATE.score - 18);
      logEvent('clean_waste', { target, zone: zoneId });
      setPill('ทำซ้ำแล้ว (waste) — เลือกจุดใหม่ให้คุ้ม');
      return;
    }

    // resource check
    if(STATE.resources.spray <= 0 || STATE.resources.cloth <= 0){
      markMistake(target, 'clean_no_resource');
      setPill('ทรัพยากรไม่พอ! เลือกให้คุ้ม/ปิด outbreak ให้ดี');
      return;
    }

    STATE.resources.spray -= 1;
    STATE.resources.cloth -= 1;

    hs._el.dataset.clean = '1';

    // effect: hubs matter more; cleaning infected matter much more
    const infected = (WORLD.infected.has(target) || (STATE.outbreak.active && STATE.outbreak.infected.has(target)));
    const hub = (hs.tag === 'hub');

    let eff = 0.05 + (hub ? 0.06 : 0.02) + (infected ? 0.08 : 0);
    eff = clamp(eff, 0.03, 0.18);

    STATE.r0 = clamp(STATE.r0 - eff, 0.6, 2.4);
    STATE.exposure = clamp(STATE.exposure - eff*0.65, 0, 1);

    STATE.score += Math.round(70 + eff*220);

    logEvent('clean', { target, zone: zoneId, hub, infected, eff });

    setPill(infected ? `✅ Clean "${target}" (infected) → R₀ ลดแรง!` : `✅ Clean "${target}" → ลดความเสี่ยง`);
  }

  // ---------- Chain builder ----------
  let chainPick = null;

  function renderChain(){
    const box = qs('gdChainList');
    if(!box) return;
    box.innerHTML = '';
    STATE.chain.forEach((c, idx)=>{
      const chip = el('div','gd-ev');
      chip.innerHTML = `<b>${idx+1})</b> ${c.from} → ${c.to}<div class="mini">${c.why}</div>`;
      box.appendChild(chip);
    });
    // compute chainOk: plausible chains count
    STATE.chainOk = STATE.chain.filter(c=> c.ok).length;
  }

  function plausibleLink(a,b){
    // fair plausibility: if either is hub or infected or both in same zone
    const ha = findHotspotByName(a);
    const hb = findHotspotByName(b);
    const zoneA = WORLD.zones.find(z=> z.hotspots.includes(ha))?.id || '';
    const zoneB = WORLD.zones.find(z=> z.hotspots.includes(hb))?.id || '';
    const sameZone = zoneA && zoneA === zoneB;

    const infectedA = WORLD.infected.has(a);
    const infectedB = WORLD.infected.has(b);

    let ok = false;
    let why = '';

    if(sameZone && (ha.tag==='hub' || hb.tag==='hub')){
      ok = true; why = 'ทั้งคู่เป็นจุดสัมผัสในโซนเดียวกัน (hub touch)';
    }else if(infectedA || infectedB){
      ok = true; why = 'มีจุดที่ยืนยัน/สงสัยว่า infected ทำให้ chain มีน้ำหนัก';
    }else{
      ok = true; why = 'แพร่ผ่านการสัมผัสต่อเนื่อง (เหตุผลทั่วไป)'; // game-friendly (ยังไม่โหด)
    }

    return { ok, why, zoneA, zoneB };
  }

  function openChainOverlay(){
    showOverlay(`
      <h2>🧩 ต่อ Chain (A→B→C)</h2>
      <p>เลือก 2 จุดเพื่อเชื่อม 1 เส้น • ทำให้ได้อย่างน้อย 3 เส้น • ระบบจะให้ “เหตุผล” อัตโนมัติ</p>
      <div class="row">
        <button class="gd-bigbtn" id="gdChainPickA">เลือก A (ยังไม่เลือก)</button>
        <button class="gd-bigbtn" id="gdChainPickB">เลือก B (ยังไม่เลือก)</button>
      </div>
      <div class="row">
        <button class="gd-bigbtn" id="gdChainAdd">➕ เพิ่มเส้น</button>
        <button class="gd-bigbtn" id="gdChainClose">ปิด</button>
      </div>
      <div class="row">
        <button class="gd-bigbtn" id="gdChainAuto">✨ Auto เติม 1 เส้น (ช่วย)</button>
        <button class="gd-bigbtn" id="gdChainClear">🗑 ล้าง Chain</button>
      </div>
    `);

    let A=null, B=null;
    const btnA = qs('gdChainPickA');
    const btnB = qs('gdChainPickB');

    function setPick(which){
      chainPick = which;
      setPill(which==='A' ? 'เลือกเป้าเป็น A: ยิง hotspot 1 จุด' : 'เลือกเป้าเป็น B: ยิง hotspot 1 จุด');
    }

    btnA.onclick = ()=> setPick('A');
    btnB.onclick = ()=> setPick('B');

    qs('gdChainAdd').onclick = ()=>{
      if(!A || !B){ setPill('ต้องเลือก A และ B ก่อน'); return; }
      const p = plausibleLink(A,B);
      STATE.chain.push({ from:A, to:B, why:p.why, ok:p.ok });
      logEvent('chain_add', { from:A, to:B, why:p.why, ok:p.ok });
      A=null; B=null;
      btnA.textContent = 'เลือก A (ยังไม่เลือก)';
      btnB.textContent = 'เลือก B (ยังไม่เลือก)';
      chainPick = null;
      closeOverlay();
      renderChain();
      setPill('เพิ่ม chain แล้ว ✅');
    };

    qs('gdChainAuto').onclick = ()=>{
      // fill 1 plausible edge using evidence targets
      const evT = Array.from(new Set(STATE.evidence.map(e=>e.target)));
      const zone = currentZone();
      const pool = evT.length ? evT : zone.hotspots.map(h=>h.name);
      if(pool.length < 2){ setPill('ยังไม่มีจุดพอให้ auto'); return; }
      const seedObj = { x: hash32(String(CTX.seed)+'|auto|'+STATE.chain.length) };
      const a = pick(seedObj, pool);
      let b = pick(seedObj, pool);
      if(b === a) b = pool[(pool.indexOf(a)+1) % pool.length];
      const p = plausibleLink(a,b);
      STATE.chain.push({ from:a, to:b, why:'(auto) '+p.why, ok:p.ok });
      logEvent('chain_auto', { from:a, to:b, ok:p.ok });
      closeOverlay();
      renderChain();
      setPill('Auto เติม chain 1 เส้น ✅');
    };

    qs('gdChainClear').onclick = ()=>{
      STATE.chain = [];
      logEvent('chain_clear', {});
      closeOverlay();
      renderChain();
      setPill('ล้าง chain แล้ว');
    };

    qs('gdChainClose').onclick = ()=> closeOverlay();

    // chain pick: intercept next hotspot hit
    const pickListener = (ev)=>{
      if(!chainPick) return;
      const d = ev.detail || {};
      const hit = findDomHotspotAt(d.x, d.y, (d.lockPx||28) + (STATE.ai.lockBonusPx||0));
      if(!hit) return;
      if(chainPick === 'A'){
        A = hit.name;
        btnA.textContent = 'A: ' + A;
        chainPick = null;
      }else{
        B = hit.name;
        btnB.textContent = 'B: ' + B;
        chainPick = null;
      }
    };
    // temporarily listen to shoot
    const onShootTmp = (ev)=> pickListener(ev);
    WIN.addEventListener('hha:shoot', onShootTmp);

    // also pointer in non-cvr overlay
    layer.addEventListener('pointerdown', (ev)=>{
      if(!chainPick) return;
      if(String(CTX.view||'') === 'cvr') return;
      const hit = findDomHotspotAt(ev.clientX, ev.clientY, 28);
      if(!hit) return;
      if(chainPick === 'A'){ A=hit.name; btnA.textContent='A: '+A; chainPick=null; }
      else { B=hit.name; btnB.textContent='B: '+B; chainPick=null; }
    }, { passive:true });

    // cleanup on close overlay
    overlay.__cleanup = ()=>{
      try{ WIN.removeEventListener('hha:shoot', onShootTmp); }catch{}
      chainPick = null;
    };
  }

  // ---------- Objectives + feedback ----------
  function renderObjectives(){
    const obj = WORLD.objectives || [];
    const scannedUV = new Set(STATE.evidence.filter(e=>e.type==='uv').map(e=>e.target));
    const chainOk = STATE.chain.filter(c=>c.ok).length;
    const r0Ok = STATE.r0 < 1.0;

    const lines = [];
    lines.push(`Case: <b>${STATE.caseId}</b> • Diff: <b>${STATE.diff}</b> • View: <b>${STATE.view}</b> • AI: <b>${STATE.ai.enabled?'ON':'OFF'}</b>`);
    lines.push(`Goal: ลด <b>R₀ &lt; 1</b> + ต่อ chain ≥ <b>3</b> + ใช้ทรัพยากรคุ้ม`);

    // show scan objectives progress
    const scanTargets = obj.filter(o=>o.type==='scan').map(o=>o.target);
    const done = scanTargets.filter(t=> scannedUV.has(t)).length;
    lines.push(`Scan hub (UV): <b>${done}/${scanTargets.length}</b>`);

    lines.push(`Chain OK: <b>${chainOk}</b> / 3`);
    lines.push(`R₀ status: ${r0Ok ? '<span class="gd-chip good">OK</span>' : '<span class="gd-chip bad">> 1</span>'}`);

    const box = qs('gdObj');
    if(box) box.innerHTML = lines.join('<br/>');
  }

  // ---------- Overlays (cold open / pause / end) ----------
  function showOverlay(innerHtml){
    overlay.style.display = 'grid';
    overlay.innerHTML = `<div class="gd-modal">${innerHtml}</div>`;
  }
  function closeOverlay(){
    if(overlay && overlay.__cleanup){ try{ overlay.__cleanup(); }catch{} overlay.__cleanup=null; }
    overlay.style.display = 'none';
    overlay.innerHTML = '';
  }

  function openColdOpen(){
    const title = (STATE.caseId === 'home')
      ? '🎬 เคส: บ้านมีคนไอ'
      : '🎬 เคส: เด็กป่วยในห้องเรียน 3 คน';

    const desc = (STATE.caseId === 'home')
      ? 'มีคนไอในบ้าน → ความเสี่ยงสะสมบนจุดสัมผัสสูง (โทรศัพท์/ลูกบิด/ก๊อกน้ำ) เป้าหมายคือกด R₀ ให้ต่ำกว่า 1 ก่อนหมดเวลา'
      : 'เด็ก 3 คนเริ่มป่วยในห้องเรียน → จุดสัมผัสร่วม (ลูกบิด/ปากกา/ช้อนส้อม) คือ key เป้าหมายคือหา chain + triage cleaning ให้คุ้ม';

    showOverlay(`
      <h2>${title}</h2>
      <p>${desc}</p>
      <div class="row">
        <button class="gd-bigbtn" id="gdStart">เริ่มสืบคดี</button>
        <button class="gd-bigbtn" id="gdSkip">ข้าม (เข้า Explore เลย)</button>
      </div>
      <div class="row">
        <button class="gd-bigbtn" id="gdHow">วิธีเล่น (เร็ว)</button>
        <button class="gd-bigbtn" id="gdBackHub">กลับ HUB</button>
      </div>
    `);

    qs('gdStart').onclick = ()=> { closeOverlay(); startGame(); };
    qs('gdSkip').onclick  = ()=> { closeOverlay(); startGame(); };
    qs('gdBackHub').onclick = ()=> backHub();
    qs('gdHow').onclick = ()=>{
      setPill('คอมโบ: UV→Swab→Cam | ต่อ chain ≥3 | Clean จุด hub/infected ให้คุ้มเพื่อกด R₀');
    };
  }

  function togglePause(){
    if(STATE.ended) return;
    STATE.running = !STATE.running;
    logEvent(STATE.running ? 'resume' : 'pause', {});
    setPill(STATE.running ? '▶ Resume' : '⏸ Paused');
  }

  // ---------- Timer loop ----------
  let _timer = null;

  function updateHUD(){
    qs('gdTime').textContent = fmtSec(STATE.timeLeft);
    qs('gdR0').textContent = STATE.r0.toFixed(2);
    qs('gdExp').textContent = Math.round(STATE.exposure*100) + '%';
    qs('gdRes').textContent = `spray ${STATE.resources.spray} • cloth ${STATE.resources.cloth} • time ${STATE.resources.time}`;

    const bar = qs('gdR0Bar');
    // map r0 0.6..2.4 to 5..95%
    const w = clamp(((STATE.r0 - 0.6) / (2.4 - 0.6)) * 90 + 5, 5, 95);
    if(bar) bar.style.width = w + '%';

    renderObjectives();
  }

  function endGame(reason){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.running = false;
    clearInterval(_timer);

    recomputeRisk();

    const chainOk = STATE.chain.filter(c=>c.ok).length;
    const superSleuth = (STATE.r0 < 1.0) && (chainOk >= 3) && (STATE.waste <= 2);

    const report = gradeReport(superSleuth);
    const summary = {
      ts: iso(),
      game:'germ-detective',
      session_id: STATE.sessionId,
      pid: CTX.pid || 'anon',
      run: CTX.run || 'play',
      view: CTX.view || '',
      diff: CTX.diff || '',
      seed: CTX.seed || '',
      caseId: CTX.caseId || '',
      reason,
      timeLeft: STATE.timeLeft,
      score: STATE.score,
      alert: STATE.alert,
      waste: STATE.waste,
      r0: Number(STATE.r0.toFixed(2)),
      exposure: Number(STATE.exposure.toFixed(3)),
      evidenceCount: STATE.evidence.length,
      chainOk,
      report,
      ctx: CTX
    };

    // save last summary for hub
    try{ localStorage.setItem(cfg.lastSummaryKey, JSON.stringify(summary)); }catch(_){}
    // save session to offline
    OfflineStore.appendSession(summary);

    logEvent('session_end', summary);

    showEndSummary(summary);
  }

  function gradeReport(superSleuth){
    // rubric: R0, chain, resource efficiency, evidence quality
    const chainOk = STATE.chain.filter(c=>c.ok).length;
    const r0Score = clamp((1.6 - STATE.r0) / 1.0, 0, 1); // lower r0 better
    const chScore = clamp(chainOk / 3, 0, 1);
    const wasteScore = clamp(1 - (STATE.waste/5), 0, 1);
    const qScore = clamp(averageEvidenceQuality(), 0, 1);

    const total = 100*(0.40*r0Score + 0.25*chScore + 0.20*wasteScore + 0.15*qScore);
    const grade = (total >= 85) ? 'S' : (total >= 70 ? 'A' : (total >= 55 ? 'B' : 'C'));

    return {
      grade,
      total: Math.round(total),
      badges: superSleuth ? ['Super Sleuth'] : (STATE.r0 < 1.0 ? ['R0 Breaker'] : []),
      breakdown: {
        r0: { v:Number(STATE.r0.toFixed(2)), score:Number((r0Score*100).toFixed(1)) },
        chain: { ok: chainOk, score:Number((chScore*100).toFixed(1)) },
        waste: { waste: STATE.waste, score:Number((wasteScore*100).toFixed(1)) },
        evidenceQ: { q:Number(qScore.toFixed(2)), score:Number((qScore*100).toFixed(1)) }
      }
    };
  }

  // ---------- Report submission ----------
  function submitReport(){
    // mimic “ส่งรายงาน” = lock decision + end
    logEvent('report_submitted', {
      chainOk: STATE.chain.filter(c=>c.ok).length,
      r0: STATE.r0,
      exposure: STATE.exposure,
      evidenceCount: STATE.evidence.length
    });
    endGame('submitted');
  }

  // ---------- Export (offline) ----------
  function downloadText(filename, text, mime='text/plain'){
    const blob = new Blob([text], { type: mime+';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 0);
  }
  function csvEscape(v){
    const s = String(v ?? '');
    if(/[,"\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  }
  function toCSV(rows, headers){
    const out = [];
    out.push(headers.map(csvEscape).join(','));
    for(const r of rows){
      out.push(headers.map(h => csvEscape(r[h])).join(','));
    }
    return out.join('\n');
  }
  function exportOfflineJSON(){
    const data = OfflineStore.getAll();
    downloadText(`germ-detective-offline-${Date.now()}.json`, JSON.stringify(data, null, 2), 'application/json');
  }
  function exportEventsCSV(){
    const data = OfflineStore.getAll();
    const rows = (data.events || []).slice().reverse().map(e=>({
      ts: e.ts,
      game: e.game,
      session_id: e.session_id,
      pid: e.pid,
      run: e.run,
      view: e.view,
      diff: e.diff,
      seed: e.seed,
      caseId: e.caseId,
      name: e.name,
      payload_json: JSON.stringify(e.payload || {})
    }));
    const headers = ['ts','game','session_id','pid','run','view','diff','seed','caseId','name','payload_json'];
    downloadText(`germ-detective-events-${Date.now()}.csv`, toCSV(rows, headers), 'text/csv');
  }
  function exportSessionsCSV(){
    const data = OfflineStore.getAll();
    const rows = (data.sessions || []).slice().reverse().map(s=>({
      ts: s.ts,
      game: s.game,
      session_id: s.session_id,
      pid: s.pid,
      run: s.run,
      view: s.view,
      diff: s.diff,
      seed: s.seed,
      caseId: s.caseId,
      reason: s.reason,
      timeLeft: s.timeLeft,
      score: s.score,
      alert: s.alert,
      waste: s.waste,
      r0: s.r0,
      exposure: s.exposure,
      evidenceCount: s.evidenceCount,
      chainOk: s.chainOk,
      grade: s.report?.grade ?? '',
      total: s.report?.total ?? ''
    }));
    const headers = ['ts','game','session_id','pid','run','view','diff','seed','caseId','reason','timeLeft','score','alert','waste','r0','exposure','evidenceCount','chainOk','grade','total'];
    downloadText(`germ-detective-sessions-${Date.now()}.csv`, toCSV(rows, headers), 'text/csv');
  }

  // ---------- End overlay ----------
  function showEndSummary(sum){
    const badge = (sum.report?.badges || []).map(b=> `<span class="gd-chip good">${b}</span>`).join(' ') || `<span class="gd-chip">${sum.r0 < 1 ? 'R0 Breaker' : '—'}</span>`;

    showOverlay(`
      <h2>📌 สรุปผลคดี</h2>
      <p>R₀: <b>${sum.r0}</b> • Exposure: <b>${Math.round(sum.exposure*100)}%</b> • Chain OK: <b>${sum.chainOk}</b> • Waste: <b>${sum.waste}</b></p>
      <p>Grade: <b>${sum.report.grade}</b> • Total: <b>${sum.report.total}</b> • ${badge}</p>

      <div class="row">
        <button class="gd-bigbtn" id="gdExportJSON">Export JSON</button>
        <button class="gd-bigbtn" id="gdExportEventsCSV">Export Events CSV</button>
      </div>
      <div class="row">
        <button class="gd-bigbtn" id="gdExportSessionsCSV">Export Sessions CSV</button>
        <button class="gd-bigbtn" id="gdBackHub2">กลับ HUB</button>
      </div>
      <div class="row">
        <button class="gd-bigbtn" id="gdReplay">เล่นใหม่ (seed เดิม)</button>
        <button class="gd-bigbtn" id="gdClearLocal">Clear Local GD Logs</button>
      </div>
    `);

    qs('gdExportJSON').onclick = exportOfflineJSON;
    qs('gdExportEventsCSV').onclick = exportEventsCSV;
    qs('gdExportSessionsCSV').onclick = exportSessionsCSV;
    qs('gdBackHub2').onclick = ()=> backHub();
    qs('gdReplay').onclick = ()=> {
      // reload keeps params
      location.reload();
    };
    qs('gdClearLocal').onclick = ()=> { OfflineStore.clearAll(); setPill('🧹 ล้าง local logs แล้ว'); };
  }

  // ---------- Back hub (flush-hardened) ----------
  function backHub(){
    try{ logEvent('back_hub', { to: CTX.hub||'../hub.html' }); }catch(_){}
    // safe end snapshot if not ended
    if(!STATE.ended){
      try{
        const snap = {
          ts: iso(), game:'germ-detective', session_id: STATE.sessionId,
          reason:'back_hub', timeLeft: STATE.timeLeft, score: STATE.score, alert: STATE.alert,
          r0: Number(STATE.r0.toFixed(2)), exposure: Number(STATE.exposure.toFixed(3)),
          evidenceCount: STATE.evidence.length, chainOk: STATE.chain.filter(c=>c.ok).length,
          ctx: CTX
        };
        localStorage.setItem(cfg.lastSummaryKey, JSON.stringify(snap));
      }catch(_){}
    }
    location.href = CTX.hub || '../hub.html';
  }

  // ---------- Zone switching (keeps excitement) ----------
  function scheduleZoneShift(){
    // every 35-45 sec shift to new zone -> risk changes
    const base = 38;
    const jitter = 7;
    const sec = base + Math.floor(Math.random()*jitter);
    return sec;
  }
  let _zoneShiftIn = 0;

  function zoneTick(){
    _zoneShiftIn--;
    if(_zoneShiftIn > 0) return;
    _zoneShiftIn = scheduleZoneShift();

    // switch zone
    STATE.zoneIdx = (STATE.zoneIdx + 1) % WORLD.zones.length;
    const z = currentZone();
    placeHotspots(z);
    logEvent('zone_switch', { zone: z.id });

    setPill(`📍 เปลี่ยนโซน: ${z.name} (risk map เปลี่ยน)`);
  }

  // ---------- init + start ----------
  function initWorld(){
    const pack = buildCase(STATE.caseId, STATE.diff);
    WORLD.zones = pack.zones;
    WORLD.truth = pack.truth;
    WORLD.infected = pack.infected;
    WORLD.objectives = pack.objectives;

    STATE.resources = pack.resources;

    // place initial
    STATE.zoneIdx = 0;
    placeHotspots(currentZone());

    logEvent('case_init', {
      caseId: STATE.caseId,
      diff: STATE.diff,
      zones: WORLD.zones.map(z=>z.id),
      infected: Array.from(WORLD.infected),
      resources: STATE.resources,
      ai: STATE.ai.enabled
    });
  }

  function startGame(){
    STATE.running = true;
    STATE.ended = false;
    STATE.t0 = now();
    STATE.timeLeft = clamp(CTX.timeSec ?? 240, 90, 480);
    _zoneShiftIn = scheduleZoneShift();

    setTool('uv');
    renderChain();
    renderObjectives();

    updateHUD();
    logEvent('session_start', { session_id: STATE.sessionId, ctx: CTX });

    clearInterval(_timer);
    _timer = setInterval(()=>{
      if(STATE.ended) return;
      if(!STATE.running) return;

      STATE.timeLeft--;
      if(STATE.timeLeft < 0) STATE.timeLeft = 0;

      // ticks
      outbreakTick();
      zoneTick();

      // AI pacing and tips
      if(STATE.timeLeft % 5 === 0){
        aiApplyPacing();
        logEvent('ai_pacing', { skill: STATE.ai.skill, chaos: STATE.ai.chaos, gapSec: STATE.outbreak.gapSec, lockBonusPx: STATE.ai.lockBonusPx });
      }
      aiMaybeTip();

      // recompute risk
      recomputeRisk();
      updateHUD();

      // end
      if(STATE.timeLeft <= 0){
        endGame('timeup');
      }
    }, 1000);

    // flush-hardened snapshots
    WIN.addEventListener('beforeunload', ()=>{
      try{ logEvent('beforeunload', { timeLeft: STATE.timeLeft, score: STATE.score, r0: STATE.r0, exposure: STATE.exposure }); }catch(_){}
    });
    WIN.addEventListener('pagehide', ()=>{
      try{ logEvent('pagehide', { timeLeft: STATE.timeLeft, score: STATE.score, r0: STATE.r0, exposure: STATE.exposure }); }catch(_){}
    });
  }

  function init(){
    // bootstrap
    STATE.sessionId = makeSessionId();
    buildUI();
    initWorld();
    recomputeRisk();
    updateHUD();

    // gate
    if(STATE.gate === 1){
      openColdOpen();
    }else{
      startGame();
    }
  }

  // expose API
  return {
    init,
    getState: ()=> STATE,
    exportOfflineJSON,
    exportEventsCSV,
    exportSessionsCSV,
    stop: ()=>{ STATE.running=false; clearInterval(_timer); }
  };
}