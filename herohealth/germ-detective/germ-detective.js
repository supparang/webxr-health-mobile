// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — core runtime (PC / Mobile / Cardboard cVR)
// PRODUCTION-SAFE core for HeroHealth integration
//
// Responsibilities:
// - game timer / state / deterministic seed helpers
// - scene hotspot bootstrap (DOM placeholders, if host page wants)
// - input: click/tap + hha:shoot (crosshair lock from vr-ui.js)
// - tools: UV / Swab / Camera
// - local events (HHA style): hha:event, hha:features_1s, hha:labels, hha:end
// - optional built-in UI (can be disabled by host page)
//
// ✅ Works standalone (prototype mode)
// ✅ Works embedded in rich run page (host can hide/ignore built-in UI)
// ✅ No networking / no App Script
//
// NOTE:
// Host page (run page) can use its own UI and still call this API.
// This core intentionally emits events instead of assuming a logger backend.

export default function GameApp(opts = {}) {
  'use strict';

  const cfg = Object.assign({
    mountId: 'app',
    timeSec: 240,
    dwellMs: 1200,
    seed: null,
    scene: 'classroom',
    difficulty: 'normal',
    view: 'pc',
    runMode: 'play',

    // UI flags
    enableBuiltinUI: true,       // set false when host page provides full UI
    enableBuiltinHotspots: true, // set false when host page renders its own hotspots
    builtinTarget: null,         // DOM node to attach demo hotspots / panels
    useSceneRootIfPresent: true  // use window.__GD_SCENE_ROOT__ if host exposes it
  }, opts || {});

  const WIN = window;
  const DOC = document;

  // ---------- state ----------
  const STATE = {
    running: false,
    paused: false,
    ended: false,

    startedAt: 0,
    timeLeft: Number(cfg.timeSec) || 240,
    timeTotal: Number(cfg.timeSec) || 240,

    tool: null, // 'uv'|'swab'|'cam'
    evidence: [], // {type, target, info, t}
    hotspots: [], // {id, name, el, isHotspot, meta...}

    metrics: {
      clicks: 0,
      shots: 0,
      hits: 0,
      misses: 0,
      uvCount: 0,
      swabCount: 0,
      camCount: 0,
      uniqueTargets: 0
    },

    resources: {
      uv: 6,
      swab: 4,
      cam: 6
    },

    lastFeatureEmitAt: 0,
    _timerId: null,
    _tickId: null
  };

  // ---------- utils ----------
  const now = () =>
    (WIN.performance && typeof WIN.performance.now === 'function')
      ? WIN.performance.now()
      : Date.now();

  function qs(id){ return DOC.getElementById(id); }

  function el(tag='div', cls=''){
    const e = DOC.createElement(tag);
    if(cls) e.className = cls;
    return e;
  }

  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }

  function hashSeed(s){
    s = String(s ?? '0');
    let h = 2166136261 >>> 0;
    for(let i=0;i<s.length;i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a){
    return function(){
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rnd = mulberry32(hashSeed((cfg.seed || Date.now()) + '|' + cfg.scene + '|' + cfg.difficulty));

  function emit(name, payload){
    try{
      WIN.dispatchEvent(new CustomEvent(name, { detail: payload || {} }));
    }catch{}
  }

  function emitHHAEvent(name, payload){
    // Prefer PlateSafe if present, else fire hha:event
    try{
      if(WIN.PlateSafe && typeof WIN.PlateSafe.logEvent === 'function'){
        WIN.PlateSafe.logEvent(name, payload || {});
      } else {
        emit('hha:event', { name, payload: payload || {} });
      }
    }catch{
      emit('hha:event', { name, payload: payload || {} });
    }
  }

  function emitFeatures(){
    const feat = {
      game: 'germ-detective',
      timeLeft: STATE.timeLeft,
      timeTotal: STATE.timeTotal,
      evidenceCount: STATE.evidence.length,
      uniqueTargets: new Set(STATE.evidence.map(e=>e.target)).size,
      tool: STATE.tool || '',
      running: STATE.running,
      paused: STATE.paused,
      view: cfg.view,
      runMode: cfg.runMode,
      difficulty: cfg.difficulty,
      metrics: Object.assign({}, STATE.metrics),
      resources: Object.assign({}, STATE.resources)
    };

    try{
      if(WIN.PlateSafe && typeof WIN.PlateSafe.emitFeatures === 'function'){
        WIN.PlateSafe.emitFeatures(feat);
      } else {
        emit('hha:features_1s', feat);
      }
    }catch{
      emit('hha:features_1s', feat);
    }
  }

  // ---------- builtin style / UI (optional) ----------
  function ensureBuiltinStyle(){
    if(!cfg.enableBuiltinUI) return;
    if(qs('gd-core-style')) return;

    const st = el('style');
    st.id = 'gd-core-style';
    st.textContent = `
      .gd-toolbar{
        position:fixed; left:12px; top:12px; z-index:1000;
        display:flex; flex-wrap:wrap; gap:6px; align-items:center;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.18);
        border-radius:14px;
        padding:8px;
        backdrop-filter: blur(10px);
        box-shadow:0 12px 30px rgba(0,0,0,.25);
      }
      .gd-btn{
        appearance:none; border:1px solid rgba(148,163,184,.18);
        background:rgba(255,255,255,.03);
        color:rgba(241,245,249,.96);
        border-radius:999px; padding:8px 10px; cursor:pointer;
        font:800 12px/1 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
      }
      .gd-btn.active{
        border-color:rgba(34,211,238,.28);
        background:rgba(34,211,238,.10);
      }
      .gd-timer{
        margin-left:4px;
        color:rgba(241,245,249,.95);
        font:900 12px/1 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
      }
      .gd-evidence{
        position:fixed; right:12px; top:12px; z-index:1000;
        width:280px; max-height:60vh; overflow:auto;
        background:rgba(2,6,23,.72);
        border:1px solid rgba(148,163,184,.18);
        border-radius:14px; padding:10px;
        backdrop-filter: blur(10px);
        box-shadow:0 12px 30px rgba(0,0,0,.25);
      }
      .gd-evidence h4{
        margin:0 0 8px; font:900 13px/1.2 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
        color:rgba(241,245,249,.96);
      }
      .gd-card{
        padding:8px; margin-bottom:6px; border-radius:10px;
        background:rgba(255,255,255,.03);
        border:1px solid rgba(148,163,184,.14);
        color:rgba(241,245,249,.94);
        font-size:12px; line-height:1.25;
      }
      .gd-card small{ color:rgba(148,163,184,.95); display:block; margin-top:3px; }

      .gd-spot{
        position:absolute; z-index:120;
        padding:10px 12px; border-radius:10px;
        background:rgba(255,255,255,.04);
        border:1px solid rgba(148,163,184,.18);
        color:rgba(241,245,249,.96);
        cursor:pointer;
        font:800 12px/1 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
        box-shadow:0 10px 24px rgba(0,0,0,.16);
        transition:transform .12s ease, opacity .15s ease, box-shadow .15s ease;
      }
      .gd-spot:hover{ transform:translateY(-1px); }
      .gd-spot.is-hot{ border-color: rgba(244,63,94,.34); }
      .gd-spot.is-scan{ border-color: rgba(34,211,238,.34); box-shadow:0 0 16px rgba(34,211,238,.18); }
      .gd-spot.is-sample{ border-color: rgba(16,185,129,.34); box-shadow:0 0 16px rgba(16,185,129,.14); }
      .gd-spot.is-photo{ border-color: rgba(251,191,36,.34); box-shadow:0 0 16px rgba(251,191,36,.16); }

      html[data-view="cvr"] .gd-spot{ pointer-events:none; }
    `;
    DOC.head.appendChild(st);
  }

  function buildBuiltinUI(){
    if(!cfg.enableBuiltinUI) return;

    ensureBuiltinStyle();

    // toolbar
    if(!qs('gdCoreToolbar')){
      const toolbar = el('div','gd-toolbar');
      toolbar.id = 'gdCoreToolbar';

      const btnUV = el('button','gd-btn'); btnUV.textContent='UV'; btnUV.id='gdBtnUV';
      const btnSwab = el('button','gd-btn'); btnSwab.textContent='Swab'; btnSwab.id='gdBtnSwab';
      const btnCam = el('button','gd-btn'); btnCam.textContent='Camera'; btnCam.id='gdBtnCam';
      const btnSubmit = el('button','gd-btn'); btnSubmit.textContent='ส่งรายงาน'; btnSubmit.id='gdBtnSubmit';

      const timer = el('div','gd-timer'); timer.id='gdTimer';

      btnUV.onclick = ()=> setTool('uv');
      btnSwab.onclick = ()=> setTool('swab');
      btnCam.onclick = ()=> setTool('cam');
      btnSubmit.onclick = submitReport;

      toolbar.appendChild(btnUV);
      toolbar.appendChild(btnSwab);
      toolbar.appendChild(btnCam);
      toolbar.appendChild(btnSubmit);
      toolbar.appendChild(timer);

      DOC.body.appendChild(toolbar);
    }

    // evidence panel
    if(!qs('gdEvidence')){
      const panel = el('div','gd-evidence');
      panel.id = 'gdEvidence';
      const h = el('h4');
      h.textContent = 'หลักฐาน';
      const list = el('div');
      list.id = 'gdEvidenceList';
      panel.appendChild(h);
      panel.appendChild(list);
      DOC.body.appendChild(panel);
    }

    refreshBuiltinToolUI();
    updateTimerUI();
  }

  function refreshBuiltinToolUI(){
    const map = { uv:'gdBtnUV', swab:'gdBtnSwab', cam:'gdBtnCam' };
    ['uv','swab','cam'].forEach(t=>{
      const b = qs(map[t]);
      if(!b) return;
      b.classList.toggle('active', STATE.tool === t);
    });
  }

  function updateTimerUI(){
    const t = qs('gdTimer');
    if(t) t.textContent = `เวลา: ${Math.max(0, STATE.timeLeft)}s`;
  }

  // ---------- hotspot catalog (prototype fallback) ----------
  const DEMO_SCENES = {
    classroom: [
      { name:'ลูกบิดประตู', x:12, y:22, hot:true, risk:0.95 },
      { name:'โต๊ะนักเรียน A', x:32, y:35, hot:true, risk:0.75 },
      { name:'ก๊อกน้ำ', x:80, y:25, hot:true, risk:0.92 },
      { name:'ราวบันได', x:70, y:58, hot:true, risk:0.78 },
      { name:'สวิตช์ไฟ', x:9, y:48, hot:true, risk:0.70 },
      { name:'รีโมตแอร์', x:26, y:13, hot:false, risk:0.55 }
    ],
    home: [
      { name:'ลูกบิดห้องนอน', x:16, y:22, hot:true, risk:0.90 },
      { name:'รีโมตทีวี', x:64, y:54, hot:true, risk:0.88 },
      { name:'ก๊อกน้ำล้างมือ', x:82, y:28, hot:true, risk:0.94 },
      { name:'โต๊ะกินข้าว', x:47, y:36, hot:true, risk:0.72 },
      { name:'มือถือส่วนกลาง', x:52, y:45, hot:true, risk:0.86 }
    ],
    canteen: [
      { name:'ถาดอาหาร', x:38, y:28, hot:true, risk:0.88 },
      { name:'ช้อนกลาง', x:52, y:32, hot:true, risk:0.92 },
      { name:'ราวคิวรับอาหาร', x:70, y:26, hot:true, risk:0.84 },
      { name:'โต๊ะรวม', x:44, y:56, hot:true, risk:0.74 },
      { name:'ก๊อกน้ำดื่ม', x:82, y:48, hot:true, risk:0.90 }
    ]
  };

  function getBuiltinRoot(){
    if(cfg.builtinTarget && cfg.builtinTarget.nodeType === 1) return cfg.builtinTarget;

    if(cfg.useSceneRootIfPresent && WIN.__GD_SCENE_ROOT__ && WIN.__GD_SCENE_ROOT__.nodeType === 1){
      return WIN.__GD_SCENE_ROOT__;
    }

    const mount = cfg.mountId ? qs(cfg.mountId) : null;
    return mount || DOC.body;
  }

  function createHotspots(){
    if(!cfg.enableBuiltinHotspots) return;

    const root = getBuiltinRoot();
    if(!root) return;

    // clear previous (only builtin gd-spot elements)
    root.querySelectorAll('.gd-spot').forEach(n=> n.remove());

    STATE.hotspots.length = 0;

    const list = DEMO_SCENES[cfg.scene] || DEMO_SCENES.classroom;
    list.forEach((h,i)=>{
      const d = el('button','gd-spot' + (h.hot ? ' is-hot' : ''));
      d.type = 'button';
      d.textContent = h.name;
      d.dataset.name = h.name;
      d.dataset.hot = h.hot ? '1' : '0';
      d.dataset.idx = String(i);
      d.style.left = `calc(${h.x}% - 42px)`;
      d.style.top  = `calc(${h.y}% - 18px)`;

      d.addEventListener('click', ()=>{
        STATE.metrics.clicks++;
        onHotspotInteract(h.name, d, { source:'pointer' });
      }, { passive:true });

      // ensure root can contain absolutely positioned spots if needed
      const cs = WIN.getComputedStyle(root);
      if(cs.position === 'static'){
        root.style.position = 'relative';
      }

      root.appendChild(d);
      STATE.hotspots.push({
        id: i,
        name: h.name,
        el: d,
        isHotspot: true,
        hot: !!h.hot,
        risk: h.risk || 0.5,
        stats: { inspect:0, uv:0, swab:0, cam:0 }
      });
    });
  }

  function getHotspotByName(name){
    return STATE.hotspots.find(h => h.name === name) || null;
  }

  // ---------- gameplay core ----------
  function setTool(t){
    const tool = String(t || '').toLowerCase();
    if(!['uv','swab','cam'].includes(tool)) return;

    STATE.tool = tool;
    refreshBuiltinToolUI();

    emit('gd:toolchange', { tool });
    emitHHAEvent('tool_change', { tool });

    // host UI may listen to this
    emit('hha:labels', { type:'tool_change', payload:{ tool } });
  }

  function addEvidence(rec){
    const item = Object.assign({}, rec, {
      t: rec && rec.t ? rec.t : new Date().toISOString()
    });

    STATE.evidence.push(item);
    STATE.metrics.uniqueTargets = new Set(STATE.evidence.map(e=>e.target)).size;

    // builtin evidence panel append
    const list = qs('gdEvidenceList');
    if(list){
      const c = el('div','gd-card');
      c.innerHTML = `
        <div><b>${String(item.type || '').toUpperCase()}</b> • ${item.target || '-'}</div>
        <div>${item.info || ''}</div>
        <small>${new Date(item.t).toLocaleTimeString('th-TH')}</small>
      `;
      list.prepend(c);
    }

    emitHHAEvent('evidence_added', item);
    return item;
  }

  function consumeResource(tool){
    if(!(tool in STATE.resources)) return true;
    if(STATE.resources[tool] <= 0){
      emitHHAEvent('resource_empty', { tool });
      return false;
    }
    STATE.resources[tool]--;
    return true;
  }

  function markVisual(elm, kind){
    if(!elm) return;
    if(kind === 'uv'){
      elm.classList.add('is-scan');
      elm.animate?.(
        [{ transform:'scale(1)' }, { transform:'scale(1.05)' }, { transform:'scale(1)' }],
        { duration: 220, easing:'ease-out' }
      );
    } else if(kind === 'swab'){
      elm.classList.add('is-sample');
      elm.style.opacity = '0.8';
      setTimeout(()=>{ try{ elm.style.opacity='1'; }catch{} }, 250);
    } else if(kind === 'cam'){
      elm.classList.add('is-photo');
      elm.animate?.([{ filter:'brightness(1.8)' }, { filter:'brightness(1)' }], { duration: 180 });
    }
  }

  function onHotspotInteract(name, elm, meta = {}){
    if(!STATE.running || STATE.paused || STATE.ended) return;

    const hs = getHotspotByName(name);
    if(hs) hs.stats.inspect++;

    if(!STATE.tool){
      addEvidence({ type:'inspect', target:name, info:'ตรวจสอบ' });
      return;
    }

    if(!consumeResource(STATE.tool)) return;

    if(STATE.tool === 'uv'){
      STATE.metrics.uvCount++;
      if(hs) hs.stats.uv++;
      markVisual(elm, 'uv');
      addEvidence({ type:'hotspot', target:name, info:'พบโดย UV', source: meta.source || 'pointer' });
    }
    else if(STATE.tool === 'swab'){
      STATE.metrics.swabCount++;
      if(hs) hs.stats.swab++;
      markVisual(elm, 'swab');
      // quick async feel
      setTimeout(()=>{
        addEvidence({ type:'sample', target:name, info:'swab สำเร็จ', source: meta.source || 'pointer' });
      }, 120);
    }
    else if(STATE.tool === 'cam'){
      STATE.metrics.camCount++;
      if(hs) hs.stats.cam++;
      markVisual(elm, 'cam');
      addEvidence({ type:'photo', target:name, info:'ถ่ายภาพ', source: meta.source || 'pointer' });

      // Optional bridge
      try{
        if(WIN.PlateLogger && typeof WIN.PlateLogger.sendEvidence === 'function'){
          WIN.PlateLogger.sendEvidence({ type:'photo', meta:{ target:name } });
        }
      }catch{}
    }
  }

  // ---------- shoot support (from /herohealth/vr/vr-ui.js) ----------
  function nearestHotspotFromPoint(x, y, lockPx){
    let best = null;
    let bestD = Infinity;

    for(const h of STATE.hotspots){
      const n = h.el;
      if(!n || !n.getBoundingClientRect) continue;
      const r = n.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const d = Math.hypot(cx - x, cy - y);
      if(d < bestD){
        bestD = d;
        best = h;
      }
    }

    if(!best) return null;

    // a bit forgiving for cVR
    const th = Math.max(24, Number(lockPx) || 28) + 16;
    if(bestD > th) return null;
    return best;
  }

  function onShoot(ev){
    const d = ev && ev.detail ? ev.detail : {};
    if(!STATE.running || STATE.paused || STATE.ended) return;

    const x = Number(d.x);
    const y = Number(d.y);
    const lockPx = Number(d.lockPx || 28);

    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    STATE.metrics.shots++;

    const hit = nearestHotspotFromPoint(x, y, lockPx);
    if(!hit){
      STATE.metrics.misses++;
      emitHHAEvent('shoot_miss', {
        x, y, lockPx,
        source: d.source || 'shoot',
        view: d.view || cfg.view
      });
      return;
    }

    STATE.metrics.hits++;
    onHotspotInteract(hit.name, hit.el, {
      source: d.source || 'shoot',
      via: 'hha:shoot'
    });
  }

  // ---------- timer / lifecycle ----------
  function startTimer(){
    clearInterval(STATE._timerId);
    STATE.timeLeft = clamp(cfg.timeSec, 1, 3600);
    updateTimerUI();

    STATE._timerId = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;

      STATE.timeLeft = Math.max(0, STATE.timeLeft - 1);
      updateTimerUI();
      emitFeatures();

      if(STATE.timeLeft <= 0){
        end('timeup');
      }
    }, 1000);
  }

  function startFeatureTick(){
    clearInterval(STATE._tickId);
    STATE._tickId = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      const t = now();
      if(t - STATE.lastFeatureEmitAt > 900){
        STATE.lastFeatureEmitAt = t;
        emitFeatures();
      }
    }, 1000);
  }

  function submitReport(){
    if(STATE.ended) return;

    const targets = Array.from(new Set(STATE.evidence.map(e=>e.target))).slice(0,5);
    const payload = {
      targets,
      timeLeft: STATE.timeLeft,
      evidenceCount: STATE.evidence.length,
      uniqueTargets: STATE.metrics.uniqueTargets,
      toolStats: {
        uv: STATE.metrics.uvCount,
        swab: STATE.metrics.swabCount,
        cam: STATE.metrics.camCount
      }
    };

    emit('hha:labels', { type:'report_submitted', payload });
    emitHHAEvent('report_submitted', payload);

    try{
      if(WIN.PlateLogger && typeof WIN.PlateLogger.logEvent === 'function'){
        WIN.PlateLogger.logEvent('report_submitted', payload);
      }
    }catch{}

    // host page often shows modal summary itself; only alert if builtin UI mode
    if(cfg.enableBuiltinUI){
      try{
        alert('ส่งรายงานแล้ว: ' + (targets.join(', ') || 'ไม่มีหลักฐาน'));
      }catch{}
    }

    return payload;
  }

  function end(reason = 'end'){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.running = false;

    clearInterval(STATE._timerId);
    clearInterval(STATE._tickId);

    const payload = {
      reason: String(reason || 'end'),
      timeLeft: STATE.timeLeft,
      evidenceCount: STATE.evidence.length,
      uniqueTargets: STATE.metrics.uniqueTargets,
      metrics: Object.assign({}, STATE.metrics),
      resources: Object.assign({}, STATE.resources)
    };

    try{
      if(WIN.PlateSafe && typeof WIN.PlateSafe.end === 'function'){
        WIN.PlateSafe.end(payload.reason);
      } else {
        emit('hha:end', payload);
      }
    }catch{
      emit('hha:end', payload);
    }

    emit('hha:labels', { type:'end', reason: payload.reason, payload });
    emitHHAEvent('session_end', payload);

    // no alert if host page handles end UX
    if(cfg.enableBuiltinUI){
      try{ alert(payload.reason === 'timeup' ? 'หมดเวลาแล้ว!' : 'จบเกม'); }catch{}
    }

    return payload;
  }

  function stop(){
    STATE.running = false;
    STATE.paused = false;
    clearInterval(STATE._timerId);
    clearInterval(STATE._tickId);
  }

  function pause(){
    if(STATE.ended) return;
    STATE.paused = true;
    emitHHAEvent('pause', { paused:true });
  }

  function resume(){
    if(STATE.ended) return;
    STATE.paused = false;
    emitHHAEvent('pause', { paused:false });
  }

  // ---------- messaging / keyboard ----------
  let _wired = false;
  function wireInput(){
    if(_wired) return;
    _wired = true;

    WIN.addEventListener('message', (ev)=>{
      const m = ev.data;
      if(!m) return;
      if(m.type === 'command' && m.action === 'setTool' && m.value) setTool(m.value);
      if(m.type === 'command' && m.action === 'pause') pause();
      if(m.type === 'command' && m.action === 'resume') resume();
      if(m.type === 'command' && m.action === 'submit') submitReport();
      if(m.type === 'command' && m.action === 'end') end(m.reason || 'command');
    }, false);

    WIN.addEventListener('keydown', (e)=>{
      if(e.key === '1') setTool('uv');
      if(e.key === '2') setTool('swab');
      if(e.key === '3') setTool('cam');
      if(e.key === 'p' || e.key === 'P'){
        if(STATE.paused) resume(); else pause();
      }
    }, false);

    WIN.addEventListener('hha:shoot', onShoot, false);
  }

  // ---------- boot ----------
  function init(){
    if(STATE.running || STATE.ended) return api;

    // difficulty resource presets (base core only; host can override by handling its own resources)
    const diff = String(cfg.difficulty || 'normal').toLowerCase();
    if(diff === 'easy'){
      STATE.resources = { uv:7, swab:5, cam:7 };
    } else if(diff === 'hard'){
      STATE.resources = { uv:5, swab:3, cam:5 };
    } else {
      STATE.resources = { uv:6, swab:4, cam:6 };
    }

    if(cfg.enableBuiltinUI) buildBuiltinUI();
    if(cfg.enableBuiltinHotspots) createHotspots();

    setTool('uv'); // default
    wireInput();

    STATE.running = true;
    STATE.paused = false;
    STATE.ended = false;
    STATE.startedAt = now();

    startTimer();
    startFeatureTick();

    emitHHAEvent('session_start', {
      game: 'germ-detective',
      timeSec: cfg.timeSec,
      seed: cfg.seed,
      scene: cfg.scene,
      difficulty: cfg.difficulty,
      view: cfg.view,
      runMode: cfg.runMode
    });

    return api;
  }

  // ---------- public API ----------
  const api = {
    init,
    stop,
    pause,
    resume,
    end,
    submitReport,

    getState: ()=> STATE,
    setTool,
    addEvidence,

    // helpers for host page
    createHotspots,
    emitFeatures,
    onHotspotInteract,
    nearestHotspotFromPoint
  };

  return api;
}