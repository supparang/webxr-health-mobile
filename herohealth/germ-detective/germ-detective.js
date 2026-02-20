// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — PRODUCTION v20260218b (PATCH: Drag-Connect Chain + Cleaning Triage)
// PC/Mobile/cVR supported
// Core loop: ColdOpen -> Explore -> Evidence combo (UV->Swab->Cam) -> Chain (drag connect) -> Triage cleaning (priorities 1-3) -> End
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
  function hash32(str){
    str = String(str||'');
    let h = 2166136261;
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h|0;
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
    resources: { spray: 6, cloth: 6, time: 3 }, // triage tokens in `time`
    r0: 1.55,
    exposure: 0.65, // 0..1

    evidence: [], // {type, target, zone, quality, t, meta}
    comboState: new Map(), // target -> {uv, swab, cam}
    chain: [], // [{from,to,why,ok}]

    // chain builder UI state
    chainUI: {
      selectedA: null, // click-select fallback
      draggingFrom: null,
      dragOver: null,
      tempLine: null
    },

    // triage UI state
    triage: {
      picks: [], // [{target, rank}]
    },

    score: 0,
    alert: 0,
    waste: 0,
    chainOk: 0,

    outbreak: { active:false, tLeft:0, gapSec:26, since:0, infected:new Set() },

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

    const res = (diff==='hard')
      ? { spray: 5, cloth: 5, time: 2 }
      : (diff==='easy' ? { spray: 7, cloth: 7, time: 4 } : { spray: 6, cloth: 6, time: 3 });

    const objectives = [];
    const must = allTargets.filter(t=>t.tag==='hub').slice(0,5);
    must.forEach(t=> objectives.push({ type:'scan', tool:'uv', target:t.name }));
    objectives.push({ type:'chain', need:3 });
    objectives.push({ type:'r0', below:1.0 });

    return { zones: Z, truth, infected, resources: res, objectives };
  }

  // ---------- UI refs ----------
  let ROOT=null, hud=null, toolbar=null, board=null, pill=null, overlay=null;
  let layer=null, fxLayer=null, zoneTitle=null;

  // chain map DOM refs
  let chainMap=null, chainCanvas=null, chainNodesBox=null;

  // ---------- Build UI ----------
  function buildUI(){
    ROOT = qs(cfg.mountId) || DOC.body;

    const wrap = el('div','gd-scene');
    ROOT.appendChild(wrap);

    zoneTitle = el('div','gd-zone-title');
    zoneTitle.textContent = '—';
    DOC.body.appendChild(zoneTitle);

    layer = el('div','gd-layer');
    fxLayer = el('div','gd-fx');
    layer.appendChild(fxLayer);
    wrap.appendChild(layer);

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

    toolbar = el('div','gd-toolbar');
    toolbar.innerHTML = `
      <button class="gd-btn" id="gdToolUV">UV</button>
      <button class="gd-btn" id="gdToolSwab">Swab</button>
      <button class="gd-btn" id="gdToolCam">Camera</button>
      <button class="gd-btn" id="gdToolClean">Clean</button>
      <button class="gd-btn" id="gdBtnTriage">🧴 Triage</button>
      <button class="gd-btn" id="gdBtnSubmit">📤 ส่งรายงาน</button>
      <button class="gd-btn" id="gdBtnPause">⏸ Pause</button>
      <button class="gd-btn" id="gdBtnBack">↩ HUB</button>
    `;
    DOC.body.appendChild(toolbar);

    pill = el('div','gd-pill'); pill.id='gdPill';
    DOC.body.appendChild(pill);

    board = el('div','gd-board');
    board.innerHTML = `
      <h3>หลักฐาน & Chain</h3>
      <div class="mini" id="gdObj">—</div>

      <div class="gd-chainmap" id="gdChainMap">
        <canvas class="gd-chainmap-canvas" id="gdChainCanvas"></canvas>
        <div class="gd-chainmap-head">
          <div class="mini"><b>Drag-Connect Chain</b> (ลากจากจุด A ไปจุด B) • ต้องได้ ≥ 3 เส้น</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="gd-btn" id="gdChainHelp" style="padding:8px 10px;">Help</button>
            <button class="gd-btn" id="gdChainClear" style="padding:8px 10px;">Clear</button>
          </div>
        </div>
        <div class="gd-nodes" id="gdChainNodes"></div>
        <div class="mini" style="margin-top:10px;">
          Tip: ถ้าเป็น Cardboard ให้ใช้ปุ่ม <b>🧴 Triage</b> หรือ “ยิงเลือก” แล้วกด Link ในโหมดช่วย (Help)
        </div>
      </div>

      <div id="gdEvList"></div>

      <div class="gd-chain" id="gdChainBox">
        <div class="mini"><b>Chain list</b> (ตรวจเหตุผล) </div>
        <div id="gdChainList"></div>
      </div>
    `;
    DOC.body.appendChild(board);

    overlay = el('div','gd-overlay'); overlay.id='gdOverlay';
    DOC.body.appendChild(overlay);

    // cache refs
    chainMap = qs('gdChainMap');
    chainCanvas = qs('gdChainCanvas');
    chainNodesBox = qs('gdChainNodes');

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

    qs('gdBtnTriage').onclick = ()=> openTriageOverlay();
    qs('gdBtnSubmit').onclick = ()=> submitReport();
    qs('gdBtnPause').onclick = ()=> togglePause();
    qs('gdBtnBack').onclick = ()=> backHub();

    qs('gdChainClear').onclick = ()=>{
      STATE.chain = [];
      logEvent('chain_clear', {});
      renderChainList();
      renderChainMap(true);
      setPill('ล้าง chain แล้ว');
    };
    qs('gdChainHelp').onclick = ()=> openChainHelpOverlay();

    // cVR shoot / click/tap support on hotspots
    WIN.addEventListener('hha:shoot', (ev)=>{
      const d = ev.detail || {};
      onShoot(d.x, d.y, Number(d.lockPx)||28, d.source||'tap');
    });

    // desktop: click inside layer hits
    layer.addEventListener('pointerdown', (ev)=>{
      if(ev.defaultPrevented) return;
      if(String(CTX.view||'') === 'cvr') return;
      onShoot(ev.clientX, ev.clientY, 28, 'pointer');
    }, { passive:true });

    DOC.addEventListener('keydown', (ev)=>{
      if(ev.code === 'Space'){
        onShoot(innerWidth/2, innerHeight/2, 28, 'space');
      }
      if(ev.key === '1') setTool('uv');
      if(ev.key === '2') setTool('swab');
      if(ev.key === '3') setTool('cam');
      if(ev.key === '4') setTool('clean');
      if(ev.key.toLowerCase() === 't') openTriageOverlay();
    }, { passive:true });

    // chain map drag connect
    chainNodesBox.addEventListener('pointerdown', onNodePointerDown, { passive:false });
    chainNodesBox.addEventListener('pointermove', onNodePointerMove, { passive:false });
    chainNodesBox.addEventListener('pointerup', onNodePointerUp, { passive:false });
    chainNodesBox.addEventListener('pointercancel', onNodePointerUp, { passive:false });

    // resize redraw
    WIN.addEventListener('resize', ()=>{
      renderChainMap(true);
    }, { passive:true });
  }

  // ---------- World ----------
  const WORLD = {
    truth: new Map(),
    infected: new Set(),
    objectives: [],
    zones: []
  };

  function currentZone(){
    return WORLD.zones[STATE.zoneIdx] || WORLD.zones[0];
  }

  // ---------- Hotspots spawn (DOM) ----------
  function placeHotspots(zone){
    layer.querySelectorAll('.gd-spot').forEach(n=> n.remove());
    zoneTitle.textContent = zone.name;

    const seedObj = { x: hash32(String(CTX.seed||Date.now()) + '|' + zone.id) };
    const w = layer.clientWidth, h = layer.clientHeight;

    const used = [];
    function ok(x,y){
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

      if(hs.tag === 'hub') d.dataset.risk = 'hub';
      else if(hs.base === 'hi') d.dataset.risk = 'hi';

      d.dataset.name = hs.name;
      d.dataset.zone = zone.id;
      d.dataset.clean = '0';

      hs._x = x; hs._y = y; hs._el = d;
      layer.appendChild(d);
    });

    // refresh chain nodes for current zone (more relevant)
    renderChainMap(true);
  }

  // ---------- Evidence + Combo + Scoring ----------
  function ensureCombo(target){
    let c = STATE.comboState.get(target);
    if(!c){ c = { uv:false, swab:false, cam:false }; STATE.comboState.set(target, c); }
    return c;
  }
  function ensureClue(target){
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
  function averageEvidenceQuality(){
    const ev = STATE.evidence.filter(e=>!e?.meta?.practice);
    if(!ev.length) return 0.0;
    let s=0;
    for(const e of ev) s += clamp(e.quality ?? 0.5, 0, 1);
    return s / ev.length;
  }

  function addEvidence(rec){
    rec.t = iso();
    STATE.evidence.push(rec);

    const list = qs('gdEvList');
    if(list){
      const item = el('div','gd-ev');
      item.innerHTML = `<b>${rec.type.toUpperCase()}</b> • ${rec.target} <span class="mini">(${rec.zone})</span><div class="mini">${rec.info||''}</div>`;
      list.insertBefore(item, list.firstChild);
      while(list.children.length > 10) list.removeChild(list.lastChild);
    }

    logEvent('evidence_added', rec);

    const q = clamp(rec.quality ?? 0.5, 0, 1);
    const add = Math.round(30 + 70*q);
    STATE.score += add;
    STATE.exposure = clamp(STATE.exposure - 0.01*q, 0, 1);

    // evidence changed -> chain nodes metadata refresh
    renderChainMap(false);
  }

  function markMistake(target, kind){
    if(target){
      const n = (STATE.mistakesByTarget.get(target) || 0) + 1;
      STATE.mistakesByTarget.set(target, n);
    }
    STATE.alert += 1;
    STATE.score = Math.max(0, STATE.score - 25);
    logEvent('mistake', { target: target||'', kind });
    aiUpdateSkill();
  }

  // ---------- Risk model ----------
  function recomputeRisk(){
    const base = (STATE.diff==='hard') ? 1.65 : (STATE.diff==='easy' ? 1.35 : 1.55);

    const all = WORLD.zones.flatMap(z=> z.hotspots);
    const hubs = all.filter(h=>h.tag==='hub');
    const cleaned = hubs.filter(h=> h._el && h._el.dataset.clean === '1').length;
    const cleanRatio = hubs.length ? (cleaned / hubs.length) : 0;

    const ob = STATE.outbreak.active ? 0.22 : 0;
    const chainBonus = clamp(STATE.chainOk * 0.06, 0, 0.22);
    const qBonus = clamp(averageEvidenceQuality() * 0.18, 0, 0.18);
    const pressure = (STATE.timeLeft < 60) ? 0.10 : 0;

    let r0 = base + ob + pressure - (0.55*cleanRatio) - chainBonus - qBonus;
    r0 = clamp(r0, 0.6, 2.4);

    let exp = 0.45 + (STATE.outbreak.active ? 0.12 : 0);
    exp += clamp((STATE.alert * 0.03), 0, 0.24);
    exp += (STATE.timeLeft < 60) ? 0.08 : 0;
    exp -= clamp(cleanRatio * 0.22, 0, 0.22);
    exp = clamp(exp, 0, 1);

    STATE.r0 = r0;
    STATE.exposure = exp;
  }

  // ---------- Outbreak ----------
  function outbreakTick(){
    STATE.outbreak.since++;

    if(!STATE.outbreak.active && STATE.outbreak.since >= (STATE.outbreak.gapSec||26)){
      STATE.outbreak.active = true;
      STATE.outbreak.tLeft = 10 + Math.round(STATE.ai.enabled ? STATE.ai.chaos*6 : 0);
      STATE.outbreak.since = 0;
      STATE.outbreak.infected = new Set();

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
      setPill('🦠 Outbreak! เน้น clean จุด hub/เสี่ยงเพื่อกด R₀');
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

  // ---------- AI L1 ----------
  function predictRisk(target){
    const hs = findHotspotByName(target);
    const c = ensureClue(target);
    let r = 0.35;

    if(hs.tag === 'hub') r += 0.18;
    if(hs.base === 'hi') r += 0.10;
    if(STATE.outbreak.active && STATE.outbreak.infected.has(target)) r += 0.22;

    if(c.truth === 'fake' && !c.revealedByUV) r += 0.25;

    const bad = STATE.mistakesByTarget.get(target) || 0;
    r += Math.min(0.18, bad*0.06);

    if(STATE.diff === 'hard') r += 0.08;
    if(STATE.diff === 'easy') r -= 0.06;

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

    const zone = currentZone();
    const hubs = zone.hotspots.filter(h=>h.tag==='hub').map(h=>h.name);
    const scannedUV = new Set(STATE.evidence.filter(e=>e.type==='uv').map(e=>e.target));
    const missingHub = hubs.find(h=> !scannedUV.has(h));

    let tip = '';
    if(missingHub && (cfg.ctx.timeSec - STATE.timeLeft) > 18){
      tip = `AI Coach: ลองตรวจ "${missingHub}" ด้วย UV — จุดสัมผัสสูง (hub ยังไม่สแกน)`;
      STATE.ai.focusTarget = missingHub;
    }else{
      const target = aiPickNextTarget();
      if(!target) return;
      const c = ensureClue(target);
      if(c.truth === 'fake' && !c.revealedByUV){
        tip = `AI Coach: "${target}" อาจเป็นจุดหลอก — ใช้ UV ก่อนเพื่อดู pattern`;
      }else{
        tip = `AI Coach: โฟกัส "${target}" ทำคอมโบ UV→Swab→Cam เพื่อหลักฐานคุณภาพสูง`;
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

    const baseGap = (STATE.diff==='hard') ? 20 : (STATE.diff==='easy' ? 32 : 26);
    STATE.outbreak.gapSec = Math.round(clamp(baseGap - STATE.ai.chaos*10, 14, 34));

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
      if(d2 < bestD){ bestD = d2; best = h; }
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

    const rect = layer.getBoundingClientRect();
    fxBurst(clientX - rect.left, clientY - rect.top);

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

    if(STATE.tool === 'clean'){
      doClean(hs, { source:'manual' });
      return;
    }

    const c = ensureCombo(target);
    const clue = ensureClue(target);

    if(STATE.tool === 'uv'){
      c.uv = true;
      clue.revealedByUV = true;

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

      if(hs.tag==='hub') STATE.exposure = clamp(STATE.exposure - 0.01, 0, 1);
      return;
    }

    if(STATE.tool === 'swab'){
      if(!c.uv){
        markMistake(target, 'swab_without_uv');
        addEvidence({ type:'swab', target, zone: zoneId, quality: 0.25, info:'Swab (ไม่มี UV ก่อน) → คุณภาพต่ำ', meta:{ lowQuality:true } });
        return;
      }
      c.swab = true;

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

      if(ok) setPill(`ยืนยันแล้ว: "${target}" เสี่ยงสูง — พิจารณา clean ก่อนเพื่อกด R₀`);
      return;
    }

    if(STATE.tool === 'cam'){
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

      if(c.uv && c.swab){
        STATE.score += 60;
        setPill('🔥 Sleuth Combo! คุณภาพหลักฐานสูง + โบนัสคะแนน');
      }
      return;
    }
  }

  // ---------- Cleaning (manual + plan) ----------
  function doClean(hs, meta = {}){
    const target = hs.name;
    const zoneId = currentZone().id;

    if(hs._el.dataset.clean === '1'){
      STATE.waste += 1;
      STATE.score = Math.max(0, STATE.score - 18);
      logEvent('clean_waste', { target, zone: zoneId, source: meta.source || 'manual' });
      setPill('ทำซ้ำแล้ว (waste) — เลือกจุดใหม่ให้คุ้ม');
      return { ok:false, eff:0, wasted:true };
    }

    if(STATE.resources.spray <= 0 || STATE.resources.cloth <= 0){
      markMistake(target, 'clean_no_resource');
      setPill('ทรัพยากรไม่พอ! ต้องเลือกให้คุ้ม');
      return { ok:false, eff:0, noRes:true };
    }

    STATE.resources.spray -= 1;
    STATE.resources.cloth -= 1;

    hs._el.dataset.clean = '1';

    const infected = (WORLD.infected.has(target) || (STATE.outbreak.active && STATE.outbreak.infected.has(target)));
    const hub = (hs.tag === 'hub');

    let eff = 0.05 + (hub ? 0.06 : 0.02) + (infected ? 0.08 : 0);
    eff = clamp(eff, 0.03, 0.18);

    // plan bonus (evidence-informed cleaning is more effective, but explainable)
    const c = ensureCombo(target);
    const evidenceBoost = (c.uv ? 0.01 : 0) + (c.swab ? 0.02 : 0) + (c.cam ? 0.01 : 0);
    eff = clamp(eff + evidenceBoost, 0.03, 0.22);

    STATE.r0 = clamp(STATE.r0 - eff, 0.6, 2.4);
    STATE.exposure = clamp(STATE.exposure - eff*0.65, 0, 1);
    STATE.score += Math.round(70 + eff*220);

    logEvent('clean', { target, zone: zoneId, hub, infected, eff, source: meta.source || 'manual', evidenceBoost });

    setPill(infected ? `✅ Clean "${target}" (infected) → R₀ ลดแรง!` : `✅ Clean "${target}" → ลดความเสี่ยง`);
    renderChainMap(false);
    return { ok:true, eff, infected, hub };
  }

  // ---------- NEW: Cleaning Triage Overlay ----------
  function buildTriageCandidates(){
    const all = WORLD.zones.flatMap(z=> z.hotspots);
    const cand = all.map(h=>{
      const clue = ensureClue(h.name);
      const c = ensureCombo(h.name);
      const cleaned = (h._el && h._el.dataset.clean === '1');
      const infectedNow = (WORLD.infected.has(h.name) || (STATE.outbreak.active && STATE.outbreak.infected.has(h.name)));
      const risk = predictRisk(h.name);
      const comboN = (c.uv?1:0) + (c.swab?1:0) + (c.cam?1:0);
      const fakeKnown = clue.revealedByUV && clue.truth === 'fake';
      // triage score: high risk + hub + infected + evidence quality; penalty if already cleaned / fake-known
      let tri = risk + (h.tag==='hub'?0.18:0) + (infectedNow?0.22:0) + (comboN*0.04);
      if(cleaned) tri -= 0.50;
      if(fakeKnown) tri -= 0.35;
      tri = clamp(tri, 0, 2.0);
      return {
        name: h.name,
        zone: WORLD.zones.find(z=> z.hotspots.includes(h))?.id || '',
        hub: h.tag==='hub',
        base: h.base,
        cleaned,
        infectedNow,
        fakeKnown,
        comboN,
        risk: Number(risk.toFixed(2)),
        tri: Number(tri.toFixed(3))
      };
    });

    cand.sort((a,b)=> b.tri - a.tri);
    return cand;
  }

  function openTriageOverlay(){
    const cand = buildTriageCandidates().slice(0, 10);
    const picks = new Map(STATE.triage.picks.map(p=> [p.target, p.rank])); // persist last picks

    function rankOf(name){ return picks.get(name) || 0; }
    function setRank(name, r){
      // ensure unique ranks 1..3
      for(const [k,v] of picks.entries()){
        if(v === r && k !== name) picks.set(k, 0);
      }
      picks.set(name, r);
    }
    function togglePick(name){
      // cycle 0->1->2->3->0
      const r = rankOf(name);
      const nr = (r===0)?1:(r===1)?2:(r===2)?3:0;
      if(nr===0) picks.set(name,0);
      else setRank(name,nr);
    }
    function getSelected(){
      const arr = [];
      for(const [t,r] of picks.entries()){
        if(r>=1 && r<=3) arr.push({ target:t, rank:r });
      }
      arr.sort((a,b)=> a.rank - b.rank);
      return arr;
    }

    const rowsHtml = cand.map(c=>{
      const tags = [
        c.hub ? `<span class="gd-chip acc">hub</span>` : '',
        c.infectedNow ? `<span class="gd-chip bad">infected?</span>` : '',
        c.fakeKnown ? `<span class="gd-chip warn">fake</span>` : '',
        c.cleaned ? `<span class="gd-chip">cleaned</span>` : ''
      ].join(' ');
      return `
        <div class="gd-triage-item" data-name="${c.name}">
          <div class="gd-triage-left">
            <div class="gd-triage-title">${c.name} ${tags}</div>
            <div class="gd-triage-sub">risk=${c.risk} • combo=${c.comboN} • triScore=${c.tri}</div>
          </div>
          <div class="gd-rank" data-r="${rankOf(c.name)||0}">${rankOf(c.name)||0 || '—'}</div>
        </div>
      `;
    }).join('');

    showOverlay(`
      <h2>🧴 Cleaning Triage (เลือก 1–3 จุดที่ “คุ้มสุด”)</h2>
      <p>แตะรายการเพื่อจัดอันดับ (1→2→3→ยกเลิก) แล้วกด Apply • ใช้ทรัพยากร: spray/cloth ตามจำนวนจุด + ใช้ <b>time token</b> 1 ต่อการ Apply</p>

      <div class="gd-triage">
        <div class="mini">Resources: spray=${STATE.resources.spray} • cloth=${STATE.resources.cloth} • timeToken=${STATE.resources.time}</div>
        <div class="gd-triage-list" id="gdTriageList">${rowsHtml}</div>
      </div>

      <div class="row">
        <button class="gd-bigbtn" id="gdTriageApply">✅ Apply Plan</button>
        <button class="gd-bigbtn" id="gdTriageClose">ปิด</button>
      </div>
      <div class="row">
        <button class="gd-bigbtn" id="gdTriageAuto">✨ Auto Pick (Top 3)</button>
        <button class="gd-bigbtn" id="gdTriageClear">🗑 Clear Picks</button>
      </div>
    `);

    const list = qs('gdTriageList');
    const refreshRanks = ()=>{
      list.querySelectorAll('.gd-triage-item').forEach(item=>{
        const name = item.dataset.name;
        const r = rankOf(name);
        const box = item.querySelector('.gd-rank');
        box.textContent = r || '—';
        box.dataset.r = String(r||0);
      });
    };

    list.addEventListener('click', (ev)=>{
      const item = ev.target.closest('.gd-triage-item');
      if(!item) return;
      togglePick(item.dataset.name);
      refreshRanks();
      logEvent('triage_pick', { picks: getSelected() });
    });

    qs('gdTriageAuto').onclick = ()=>{
      // take top 3 tri score not cleaned and not fakeKnown
      const top = cand.filter(x=>!x.cleaned && !x.fakeKnown).slice(0,3);
      picks.clear();
      top.forEach((t, idx)=> picks.set(t.name, idx+1));
      refreshRanks();
      logEvent('triage_auto', { picks: getSelected() });
      setPill('Auto เลือก Top3 แล้ว');
    };

    qs('gdTriageClear').onclick = ()=>{
      picks.clear();
      refreshRanks();
      logEvent('triage_clear', {});
      setPill('ล้าง picks แล้ว');
    };

    qs('gdTriageClose').onclick = ()=> closeOverlay();

    qs('gdTriageApply').onclick = ()=>{
      const sel = getSelected();
      if(sel.length < 1){
        setPill('ต้องเลือกอย่างน้อย 1 จุด');
        return;
      }
      if(STATE.resources.time <= 0){
        setPill('time token ไม่พอ! (Resources.time)');
        markMistake('', 'triage_no_time_token');
        return;
      }

      // compute resource need
      const need = sel.length;
      if(STATE.resources.spray < need || STATE.resources.cloth < need){
        setPill('spray/cloth ไม่พอสำหรับจำนวนจุดที่เลือก');
        markMistake('', 'triage_no_material');
        return;
      }

      STATE.resources.time -= 1;

      logEvent('triage_apply_start', { sel });

      // Apply in order 1..3 with order bonus:
      // - If rank1 is hub or infected -> extra efficiency
      // - If rank2 also hub -> extra
      // - If picks include fakeKnown -> penalty (but user sees fake tag)
      let orderBonus = 0;
      sel.forEach(s=>{
        const hs = findHotspotByName(s.target);
        const clue = ensureClue(s.target);
        const infectedNow = (WORLD.infected.has(s.target) || (STATE.outbreak.active && STATE.outbreak.infected.has(s.target)));
        if(s.rank === 1 && (hs.tag==='hub' || infectedNow)) orderBonus += 0.02;
        if(s.rank === 2 && hs.tag==='hub') orderBonus += 0.01;
        if(clue.revealedByUV && clue.truth==='fake') orderBonus -= 0.02;
      });
      orderBonus = clamp(orderBonus, -0.03, 0.04);

      let totalEff = 0;
      let cleanedCount = 0;
      for(const s of sel){
        const hs = findHotspotByName(s.target);
        const beforeR0 = STATE.r0;
        const r = doClean(hs, { source:'triage', rank:s.rank });
        if(r.ok){
          cleanedCount++;
          // apply order bonus as a second-pass improvement (explainable: “ทำลำดับถูก → ลดการแพร่ได้มากขึ้น”)
          const add = clamp(orderBonus, -0.02, 0.04);
          STATE.r0 = clamp(STATE.r0 - add, 0.6, 2.4);
          STATE.exposure = clamp(STATE.exposure - add*0.55, 0, 1);
          totalEff += (beforeR0 - STATE.r0);
        }
      }

      recomputeRisk();
      updateHUD();

      // persist picks
      STATE.triage.picks = sel;

      logEvent('triage_apply_end', {
        sel, cleanedCount,
        orderBonus,
        r0: STATE.r0,
        exposure: STATE.exposure
      });

      setPill(`✅ Apply Plan สำเร็จ (${cleanedCount}/${sel.length}) • โบนัสลำดับ=${orderBonus.toFixed(2)} • R₀=${STATE.r0.toFixed(2)}`);
      closeOverlay();
    };
  }

  // ---------- NEW: Chain drag-connect map ----------
  function nodeMeta(name){
    const hs = findHotspotByName(name);
    const clue = ensureClue(name);
    const c = ensureCombo(name);
    const cleaned = (hs._el && hs._el.dataset.clean === '1');
    const infectedNow = (WORLD.infected.has(name) || (STATE.outbreak.active && STATE.outbreak.infected.has(name)));
    const fakeKnown = clue.revealedByUV && clue.truth === 'fake';
    const hi = (hs.base === 'hi' || hs.tag === 'hub');
    return {
      name,
      hub: hs.tag === 'hub',
      risk: hi ? 'hi' : 'mid',
      cleaned,
      infectedNow,
      fakeKnown,
      comboN: (c.uv?1:0) + (c.swab?1:0) + (c.cam?1:0)
    };
  }

  function chainCandidateNames(){
    // show node set = current zone hotspots + any evidence targets (so board feels alive)
    const zone = currentZone();
    const base = zone.hotspots.map(h=>h.name);
    const evT = Array.from(new Set(STATE.evidence.map(e=>e.target)));
    const set = new Set([...base, ...evT]);
    return Array.from(set).slice(0, 10);
  }

  function renderChainMap(force){
    if(!chainNodesBox || !chainCanvas || !chainMap) return;

    const names = chainCandidateNames();
    const old = chainNodesBox.dataset._sig || '';
    const sig = names.join('|') + '|' + (STATE.evidence.length) + '|' + (STATE.outbreak.active?'1':'0') + '|' + (STATE.resources.spray);
    if(!force && old === sig){
      // still redraw lines if needed
      drawChainCanvas();
      return;
    }
    chainNodesBox.dataset._sig = sig;

    chainNodesBox.innerHTML = '';
    names.forEach(n=>{
      const m = nodeMeta(n);
      const node = el('div','gd-node');
      node.dataset.name = m.name;
      node.dataset.hub = m.hub ? '1' : '0';
      node.dataset.risk = m.risk;
      node.dataset.clean = m.cleaned ? '1' : '0';
      node.dataset.infected = m.infectedNow ? '1' : '0';
      node.dataset.fake = m.fakeKnown ? '1' : '0';
      node.dataset.sel = '0';
      node.innerHTML = `<span class="gd-dot"></span><span>${m.name}</span>`;
      chainNodesBox.appendChild(node);
    });

    // size canvas to container
    resizeChainCanvas();
    drawChainCanvas();
  }

  function resizeChainCanvas(){
    const rect = chainMap.getBoundingClientRect();
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    chainCanvas.width = Math.floor(rect.width * dpr);
    chainCanvas.height = Math.floor(rect.height * dpr);
    chainCanvas.style.width = rect.width + 'px';
    chainCanvas.style.height = rect.height + 'px';
  }

  function nodeCenterInMap(nodeEl){
    const rNode = nodeEl.getBoundingClientRect();
    const rMap = chainMap.getBoundingClientRect();
    const x = (rNode.left + rNode.right)/2 - rMap.left;
    const y = (rNode.top + rNode.bottom)/2 - rMap.top;
    return { x, y };
  }

  function drawLine(ctx, ax, ay, bx, by, alpha=0.9){
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.restore();
  }

  function drawChainCanvas(){
    if(!chainCanvas) return;
    const ctx2d = chainCanvas.getContext('2d');
    if(!ctx2d) return;

    const rect = chainMap.getBoundingClientRect();
    const dpr = chainCanvas.width / Math.max(1, rect.width);

    ctx2d.clearRect(0,0, chainCanvas.width, chainCanvas.height);
    ctx2d.strokeStyle = 'rgba(99,102,241,.85)';

    const nodes = Array.from(chainNodesBox.querySelectorAll('.gd-node'));
    const pos = new Map(nodes.map(n=> [n.dataset.name, nodeCenterInMap(n)]));

    // draw existing chain
    for(const c of STATE.chain){
      const a = pos.get(c.from);
      const b = pos.get(c.to);
      if(!a || !b) continue;
      ctx2d.strokeStyle = c.ok ? 'rgba(34,197,94,.85)' : 'rgba(239,68,68,.85)';
      drawLine(ctx2d, a.x*dpr, a.y*dpr, b.x*dpr, b.y*dpr, 0.9);
    }

    // temp dragging line
    if(STATE.chainUI.draggingFrom && STATE.chainUI.tempLine){
      const a = pos.get(STATE.chainUI.draggingFrom);
      if(a){
        ctx2d.strokeStyle = 'rgba(99,102,241,.85)';
        drawLine(ctx2d, a.x*dpr, a.y*dpr, STATE.chainUI.tempLine.x*dpr, STATE.chainUI.tempLine.y*dpr, 0.75);
      }
    }
  }

  function plausibleLink(a,b){
    const ha = findHotspotByName(a);
    const hb = findHotspotByName(b);
    const zoneA = WORLD.zones.find(z=> z.hotspots.includes(ha))?.id || '';
    const zoneB = WORLD.zones.find(z=> z.hotspots.includes(hb))?.id || '';
    const sameZone = zoneA && zoneA === zoneB;

    const infectedA = WORLD.infected.has(a) || (STATE.outbreak.active && STATE.outbreak.infected.has(a));
    const infectedB = WORLD.infected.has(b) || (STATE.outbreak.active && STATE.outbreak.infected.has(b));

    let ok = true;
    let why = '';

    if(sameZone && (ha.tag==='hub' || hb.tag==='hub')){
      why = 'โซนเดียวกัน + มี hub hotspot → แพร่ผ่านการสัมผัสสูง';
    }else if(infectedA || infectedB){
      why = 'มีจุดที่สงสัย/ยืนยันเสี่ยงสูง → chain มีน้ำหนัก';
    }else{
      why = 'แพร่ผ่านการสัมผัสต่อเนื่อง (หลักฐานเชิงพฤติกรรม)';
    }

    return { ok, why, zoneA, zoneB };
  }

  function addChainEdge(a,b, source){
    if(!a || !b || a===b) return false;
    if(STATE.chain.length >= 8){
      setPill('Chain เต็ม (8 เส้น) — เคลียร์ก่อนถ้าจะต่อเพิ่ม');
      return false;
    }
    // avoid duplicate edges
    const dup = STATE.chain.some(e=> (e.from===a && e.to===b) || (e.from===b && e.to===a));
    if(dup){ setPill('มีเส้นนี้แล้ว'); return false; }

    const p = plausibleLink(a,b);
    STATE.chain.push({ from:a, to:b, why:p.why, ok:p.ok });
    logEvent('chain_add', { from:a, to:b, why:p.why, ok:p.ok, source: source||'drag' });

    renderChainList();
    renderChainMap(false);
    recomputeRisk();
    updateHUD();

    setPill(`🧩 ต่อเส้น: ${a} → ${b}`);
    return true;
  }

  function renderChainList(){
    const box = qs('gdChainList');
    if(!box) return;
    box.innerHTML = '';
    STATE.chain.forEach((c, idx)=>{
      const item = el('div','gd-ev');
      item.innerHTML = `<b>${idx+1})</b> ${c.from} → ${c.to} ${c.ok ? '<span class="gd-chip good">OK</span>' : '<span class="gd-chip bad">weak</span>'}<div class="mini">${c.why}</div>`;
      box.appendChild(item);
    });
    STATE.chainOk = STATE.chain.filter(c=> c.ok).length;
  }

  // pointer drag handlers (PC/Mobile)
  function nearestNodeElFromEvent(ev){
    const t = ev.target;
    if(!t) return null;
    const node = t.closest('.gd-node');
    return node || null;
  }

  function onNodePointerDown(ev){
    if(STATE.ended) return;
    if(!STATE.running) return;

    const node = nearestNodeElFromEvent(ev);
    if(!node) return;

    // prevent scroll while dragging inside board
    ev.preventDefault();

    const name = node.dataset.name;
    STATE.chainUI.draggingFrom = name;
    STATE.chainUI.dragOver = null;

    // highlight
    chainNodesBox.querySelectorAll('.gd-node').forEach(n=> n.dataset.sel='0');
    node.dataset.sel = '1';

    // capture pointer
    try{ node.setPointerCapture(ev.pointerId); }catch(_){}

    // init temp line at pointer pos within map
    const rMap = chainMap.getBoundingClientRect();
    STATE.chainUI.tempLine = { x: ev.clientX - rMap.left, y: ev.clientY - rMap.top };
    drawChainCanvas();
  }

  function onNodePointerMove(ev){
    if(!STATE.chainUI.draggingFrom) return;
    ev.preventDefault();

    const rMap = chainMap.getBoundingClientRect();
    STATE.chainUI.tempLine = { x: ev.clientX - rMap.left, y: ev.clientY - rMap.top };

    const over = nearestNodeElFromEvent(ev);
    STATE.chainUI.dragOver = over ? over.dataset.name : null;

    drawChainCanvas();
  }

  function onNodePointerUp(ev){
    if(!STATE.chainUI.draggingFrom) return;
    ev.preventDefault();

    const from = STATE.chainUI.draggingFrom;
    const over = nearestNodeElFromEvent(ev);
    const to = over ? over.dataset.name : null;

    STATE.chainUI.draggingFrom = null;
    STATE.chainUI.dragOver = null;
    STATE.chainUI.tempLine = null;

    // clear highlight
    chainNodesBox.querySelectorAll('.gd-node').forEach(n=> n.dataset.sel='0');

    if(to && from && to !== from){
      addChainEdge(from, to, 'drag');
    }else{
      // click-select fallback: tap twice
      // First tap sets A, second tap links A->B
      if(!STATE.chainUI.selectedA){
        STATE.chainUI.selectedA = from;
        setPill(`เลือก A แล้ว: ${from} (แตะอีกจุดเพื่อเชื่อม)`);
      }else{
        const a = STATE.chainUI.selectedA;
        STATE.chainUI.selectedA = null;
        if(a !== from){
          addChainEdge(a, from, 'tap2');
        }
      }
    }

    drawChainCanvas();
  }

  function openChainHelpOverlay(){
    showOverlay(`
      <h2>🧩 Chain Help</h2>
      <p>PC/Mobile: ลากจากจุด A ไปจุด B เพื่อสร้างเส้น (Drag-Connect)</p>
      <p>Cardboard: ใช้ <b>🧴 Triage</b> เป็นหลัก (เพราะ chain ละเอียด) หรือใช้โหมดช่วย: เลือก A แล้วเลือก B (แตะ/ยิงบนบอร์ดไม่สะดวก)</p>
      <div class="row">
        <button class="gd-bigbtn" id="gdChainAuto1">✨ Auto เติม 1 เส้น</button>
        <button class="gd-bigbtn" id="gdChainClose2">ปิด</button>
      </div>
      <div class="row">
        <button class="gd-bigbtn" id="gdChainAuto3">✨ Auto เติมให้ครบ 3 เส้น</button>
        <button class="gd-bigbtn" id="gdChainClear2">🗑 Clear Chain</button>
      </div>
    `);

    qs('gdChainClose2').onclick = ()=> closeOverlay();
    qs('gdChainClear2').onclick = ()=>{
      STATE.chain = [];
      logEvent('chain_clear', {});
      renderChainList();
      renderChainMap(true);
      closeOverlay();
      setPill('ล้าง chain แล้ว');
    };

    qs('gdChainAuto1').onclick = ()=>{
      autoAddChain(1);
      closeOverlay();
    };
    qs('gdChainAuto3').onclick = ()=>{
      autoAddChain(3);
      closeOverlay();
    };
  }

  function autoAddChain(n){
    const names = chainCandidateNames();
    if(names.length < 2) return;
    const seedObj = { x: hash32(String(CTX.seed)+'|autoChain|'+STATE.chain.length+'|'+STATE.timeLeft) };
    let added = 0;
    for(let i=0;i<30 && added < n;i++){
      const a = pick(seedObj, names);
      let b = pick(seedObj, names);
      if(b === a) b = names[(names.indexOf(a)+1) % names.length];
      if(addChainEdge(a,b,'auto')) added++;
    }
    setPill(`Auto เพิ่ม chain ${added} เส้น`);
  }

  // ---------- Objectives ----------
  function renderObjectives(){
    const obj = WORLD.objectives || [];
    const scannedUV = new Set(STATE.evidence.filter(e=>e.type==='uv').map(e=>e.target));
    const chainOk = STATE.chain.filter(c=>c.ok).length;
    const r0Ok = STATE.r0 < 1.0;

    const lines = [];
    lines.push(`Case: <b>${STATE.caseId}</b> • Diff: <b>${STATE.diff}</b> • View: <b>${STATE.view}</b> • AI: <b>${STATE.ai.enabled?'ON':'OFF'}</b>`);
    lines.push(`Goal: ลด <b>R₀ &lt; 1</b> + ต่อ chain ≥ <b>3</b> + ใช้ทรัพยากรคุ้ม`);

    const scanTargets = obj.filter(o=>o.type==='scan').map(o=>o.target);
    const done = scanTargets.filter(t=> scannedUV.has(t)).length;
    lines.push(`Scan hub (UV): <b>${done}/${scanTargets.length}</b>`);

    lines.push(`Chain OK: <b>${chainOk}</b> / 3`);
    lines.push(`R₀ status: ${r0Ok ? '<span class="gd-chip good">OK</span>' : '<span class="gd-chip bad">> 1</span>'}`);

    const box = qs('gdObj');
    if(box) box.innerHTML = lines.join('<br/>');
  }

  // ---------- Overlays ----------
  function showOverlay(innerHtml){
    overlay.style.display = 'grid';
    overlay.innerHTML = `<div class="gd-modal">${innerHtml}</div>`;
  }
  function closeOverlay(){
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
      setPill('คอมโบ: UV→Swab→Cam | ต่อ chain ≥3 (ลากเชื่อม) | 🧴Triage เลือก 1–3 จุดคุ้มสุดแล้ว Apply');
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
  let _zoneShiftIn = 0;

  function scheduleZoneShift(){
    const base = 38;
    const jitter = 7;
    const sec = base + Math.floor(Math.random()*jitter);
    return sec;
  }

  function zoneTick(){
    _zoneShiftIn--;
    if(_zoneShiftIn > 0) return;
    _zoneShiftIn = scheduleZoneShift();

    STATE.zoneIdx = (STATE.zoneIdx + 1) % WORLD.zones.length;
    const z = currentZone();
    placeHotspots(z);
    logEvent('zone_switch', { zone: z.id });

    setPill(`📍 เปลี่ยนโซน: ${z.name} (risk map เปลี่ยน)`);
  }

  function updateHUD(){
    qs('gdTime').textContent = fmtSec(STATE.timeLeft);
    qs('gdR0').textContent = STATE.r0.toFixed(2);
    qs('gdExp').textContent = Math.round(STATE.exposure*100) + '%';
    qs('gdRes').textContent = `spray ${STATE.resources.spray} • cloth ${STATE.resources.cloth} • time ${STATE.resources.time}`;

    const bar = qs('gdR0Bar');
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

    try{ localStorage.setItem(cfg.lastSummaryKey, JSON.stringify(summary)); }catch(_){}
    OfflineStore.appendSession(summary);

    logEvent('session_end', summary);
    showEndSummary(summary);
  }

  function gradeReport(superSleuth){
    const chainOk = STATE.chain.filter(c=>c.ok).length;
    const r0Score = clamp((1.6 - STATE.r0) / 1.0, 0, 1);
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
    logEvent('report_submitted', {
      chainOk: STATE.chain.filter(c=>c.ok).length,
      r0: STATE.r0,
      exposure: STATE.exposure,
      evidenceCount: STATE.evidence.length
    });
    endGame('submitted');
  }

  // ---------- Export ----------
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
    qs('gdReplay').onclick = ()=> location.reload();
    qs('gdClearLocal').onclick = ()=> { OfflineStore.clearAll(); setPill('🧹 ล้าง local logs แล้ว'); };
  }

  // ---------- Back hub ----------
  function backHub(){
    try{ logEvent('back_hub', { to: CTX.hub||'../hub.html' }); }catch(_){}
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

  // ---------- init + start ----------
  function initWorld(){
    const pack = buildCase(STATE.caseId, STATE.diff);
    WORLD.zones = pack.zones;
    WORLD.truth = pack.truth;
    WORLD.infected = pack.infected;
    WORLD.objectives = pack.objectives;

    STATE.resources = pack.resources;

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
    renderChainList();
    renderChainMap(true);
    renderObjectives();

    recomputeRisk();
    updateHUD();

    logEvent('session_start', { session_id: STATE.sessionId, ctx: CTX });

    clearInterval(_timer);
    _timer = setInterval(()=>{
      if(STATE.ended) return;
      if(!STATE.running) return;

      STATE.timeLeft--;
      if(STATE.timeLeft < 0) STATE.timeLeft = 0;

      outbreakTick();
      zoneTick();

      if(STATE.ai.enabled && STATE.timeLeft % 5 === 0){
        aiApplyPacing();
        logEvent('ai_pacing', { skill: STATE.ai.skill, chaos: STATE.ai.chaos, gapSec: STATE.outbreak.gapSec, lockBonusPx: STATE.ai.lockBonusPx });
      }
      aiMaybeTip();

      recomputeRisk();
      updateHUD();
      drawChainCanvas();

      if(STATE.timeLeft <= 0){
        endGame('timeup');
      }
    }, 1000);

    WIN.addEventListener('beforeunload', ()=>{
      try{ logEvent('beforeunload', { timeLeft: STATE.timeLeft, score: STATE.score, r0: STATE.r0, exposure: STATE.exposure }); }catch(_){}
    });
    WIN.addEventListener('pagehide', ()=>{
      try{ logEvent('pagehide', { timeLeft: STATE.timeLeft, score: STATE.score, r0: STATE.r0, exposure: STATE.exposure }); }catch(_){}
    });
  }

  function init(){
    STATE.sessionId = makeSessionId();
    buildUI();
    initWorld();

    recomputeRisk();
    updateHUD();
    renderChainList();
    renderChainMap(true);

    if(STATE.gate === 1) openColdOpen();
    else startGame();
  }

  return {
    init,
    getState: ()=> STATE,
    exportOfflineJSON,
    exportEventsCSV,
    exportSessionsCSV,
    stop: ()=>{ STATE.running=false; clearInterval(_timer); }
  };
}