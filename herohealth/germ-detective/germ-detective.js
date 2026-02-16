// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — FUN CORE (PC/Mobile/Cardboard cVR)
// ✅ Unified input: fireAt(x,y,lockPx)
// ✅ Supports hha:shoot from /herohealth/vr/vr-ui.js
// ✅ Gaze-dwell fallback for cVR
// ✅ AI Prediction / ML (online LR) / DL-like Director (Outbreak + deception)
// ✅ Local-only (no networking) but emits PlateSafe / HHA events

export default function GameApp(opts = {}) {
  const cfg = Object.assign({
    mountId: 'app',
    timeSec: 240,
    dwellMs: 1200,
    seed: null,

    view: 'pc',          // pc|mobile|cvr
    diff: 'normal',      // easy|normal|hard
    enableAI: true,
    warmupGate: true
  }, opts);

  // -------------------------
  // utils
  // -------------------------
  const now = () => performance.now();
  const iso = () => new Date().toISOString();
  const clamp = (v,min,max)=> Math.max(min, Math.min(max, v));
  const uniq = ()=> Math.random().toString(16).slice(2) + String(Date.now()).slice(-6);

  function qs(id){ return document.getElementById(id); }
  function el(tag='div', cls=''){ const e = document.createElement(tag); if(cls) e.className = cls; return e; }
  function safeDispatch(name, detail){ window.dispatchEvent(new CustomEvent(name, { detail })); }

  function logEvent(name, payload = {}) {
    if (window.PlateSafe && typeof window.PlateSafe.logEvent === 'function') {
      window.PlateSafe.logEvent(name, payload);
      return;
    }
    safeDispatch('hha:event', { name, payload });
  }
  function logLabel(type, payload = {}) {
    safeDispatch('hha:labels', { type, payload });
  }
  function emitFeatures1s() {
    if (window.PlateSafe && typeof window.PlateSafe.emitFeatures === 'function') {
      window.PlateSafe.emitFeatures();
      return;
    }
    safeDispatch('hha:features_1s', {
      game: 'germ-detective',
      timeLeft: STATE.timeLeft,
      evidenceCount: STATE.evidence.length,
      tool: STATE.tool || 'none',
      score: STATE.score,
      alert: STATE.alert
    });
  }

  // -------------------------
  // view mode
  // -------------------------
  const VIEW = String(cfg.view || document.body.getAttribute('data-view') || 'pc').toLowerCase();
  const MODE = {
    isPC: VIEW === 'pc',
    isMobile: VIEW === 'mobile',
    isCVR: VIEW === 'cvr'
  };

  // tune per mode/diff
  const DIFF = String(cfg.diff||'normal').toLowerCase();
  const TUNE = {
    easy:   { alertGainSlow: 1, alertGainMiss: 7,  outbreakThreshold: 110, falsePos: 0.12, tipCd: 6500, lockPx: 36, dwell: 950 },
    normal: { alertGainSlow: 2, alertGainMiss: 10, outbreakThreshold: 100, falsePos: 0.22, tipCd: 6200, lockPx: 44, dwell: 900 },
    hard:   { alertGainSlow: 3, alertGainMiss: 14, outbreakThreshold: 90,  falsePos: 0.30, tipCd: 7000, lockPx: 40, dwell: 980 }
  }[DIFF] || { alertGainSlow:2, alertGainMiss:10, outbreakThreshold:100, falsePos:0.22, tipCd:6200, lockPx:44, dwell:900 };

  const TAP_COOLDOWN = MODE.isMobile ? 220 : 120;
  const AIM_LOCKPX_DEFAULT = MODE.isCVR ? TUNE.lockPx : 0;
  cfg.dwellMs = MODE.isCVR ? TUNE.dwell : cfg.dwellMs;

  let _lastFireAt = 0;

  // -------------------------
  // state
  // -------------------------
  const STATE = {
    running: false,
    paused: false,
    timeLeft: cfg.timeSec,

    tool: null, // 'uv'|'swab'|'cam'
    evidence: [], // {type, target, info, t, meta?}

    hotspots: [], // {id,name,el,isHotspot}
    score: 0,
    alert: 0,    // 0..100
    caseId: null,
    objectives: [], // [{target, done:{uv,swab,cam}}]
    chain: [],

    // dwell
    dwellTargetId: null,
    dwellStart: 0
  };

  // -------------------------
  // RNG (deterministic)
  // -------------------------
  function makeRNG(seedStr){
    let s = String(seedStr || 'seed');
    let h = 1779033703 ^ s.length;
    for (let i=0;i<s.length;i++){
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    let a = h >>> 0;
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rng = makeRNG(String(cfg.seed || Date.now()));
  const pick = (arr)=> arr[Math.floor(rng()*arr.length)];

  // -------------------------
  // UI
  // -------------------------
  function buildUI(){
    // world layer (DOM hotspots)
    const world = el('div','gd-world'); world.id='gdWorld';
    document.body.appendChild(world);

    // toolbar
    const toolbar = el('div','gd-toolbar');
    const bUV = el('button','gd-btn2'); bUV.textContent='UV (1)'; bUV.onclick=()=>setTool('uv');
    const bSW = el('button','gd-btn2'); bSW.textContent='Swab (2)'; bSW.onclick=()=>setTool('swab');
    const bCM = el('button','gd-btn2'); bCM.textContent='Cam (3)'; bCM.onclick=()=>setTool('cam');
    const bSUB= el('button','gd-btn2'); bSUB.textContent='ส่งรายงาน (Enter)'; bSUB.onclick=submitReport;
    const bPAU= el('button','gd-btn2'); bPAU.id='gdPauseBtn'; bPAU.textContent='Pause (Space)'; bPAU.onclick=togglePause;
    [bUV,bSW,bCM,bSUB,bPAU].forEach(b=>toolbar.appendChild(b));

    const pill = el('div','gd-pill'); pill.id='gdPill'; pill.textContent='พร้อมเริ่มภารกิจ';
    toolbar.appendChild(pill);

    const meter = el('div','gd-meter'); meter.id='gdMeter';
    const bar = el('i'); bar.id='gdMeterBar';
    meter.appendChild(bar);
    toolbar.appendChild(meter);

    const t = el('div','gd-pill'); t.id='gdTimer'; t.textContent='เวลา: -';
    toolbar.appendChild(t);

    document.body.appendChild(toolbar);

    // evidence panel
    const panel = el('div','gd-evidence'); panel.id='gdEvidence';
    const h = el('h4'); h.textContent='หลักฐาน';
    panel.appendChild(h);
    const list = el('div'); list.id='gdEvidenceList';
    panel.appendChild(list);
    document.body.appendChild(panel);

    // reticle + dwell (show only in cVR)
    const ret = el('div','gd-reticle'); ret.id='gdReticle';
    const ring = el('div','gd-dwellRing'); ring.id='gdDwellRing';
    const prog = el('div','gd-dwellProg'); prog.id='gdDwellProg';
    document.body.appendChild(prog);
    document.body.appendChild(ring);
    document.body.appendChild(ret);

    const show = MODE.isCVR; // only cardboard
    ret.style.display = show ? 'block' : 'none';
    ring.style.display = show ? 'block' : 'none';
    prog.style.display = show ? 'block' : 'none';
  }

  function updateDwellUI(pct){
    const prog = qs('gdDwellProg');
    if(!prog) return;
    const deg = Math.max(0, Math.min(360, Math.round(360*pct)));
    prog.style.background = `conic-gradient(rgba(255,255,255,0.75) 0deg, rgba(255,255,255,0.75) ${deg}deg, rgba(255,255,255,0) ${deg}deg, rgba(255,255,255,0) 360deg)`;
  }

  function setTool(t){
    STATE.tool = t;
    safeDispatch('gd:toolchange', { tool:t });
    logEvent('tool_change', { tool:t });
    setPill(`เครื่องมือ: ${t.toUpperCase()} • เคส: ${STATE.caseId||'-'} • Score ${STATE.score}`);
  }

  function setPill(msg){
    const p = qs('gdPill');
    if(p) p.textContent = msg;
  }

  function updateHUD(){
    const timer = qs('gdTimer');
    if(timer) timer.textContent = `เวลา: ${Math.max(0,STATE.timeLeft)}s`;

    const bar = qs('gdMeterBar');
    if(bar) bar.style.width = `${clamp(STATE.alert,0,100)}%`;

    // mark hotspot risk glow (AI prediction)
    if(cfg.enableAI){
      for(const h of STATE.hotspots){
        const r = predictRisk(h.name);
        const v = r >= 0.72 ? 'high' : (r >= 0.50 ? 'mid' : 'low');
        h.el.dataset.risk = v;
      }
    }
  }

  function addEvidence(rec){
    const r = Object.assign({ t: iso() }, rec);
    STATE.evidence.push(r);

    const list = qs('gdEvidenceList');
    if(list){
      const c = el('div','gd-card2');
      c.textContent = `${String(r.type).toUpperCase()} • ${r.target} • ${r.info||''}`;
      list.prepend(c);
    }
    logEvent('evidence_added', r);
  }

  // -------------------------
  // Hotspots (DOM)
  // -------------------------
  function createHotspots(){
    const world = qs('gdWorld') || document.body;
    const names = [
      { n:'ฟองน้ำ', x: 14, y: 30 },
      { n:'ลูกบิด', x: 55, y: 26 },
      { n:'เขียง', x: 78, y: 56 },
      { n:'ก๊อกน้ำ', x: 28, y: 64 },
      { n:'มือถือ', x: 62, y: 72 }
    ];

    names.forEach((it,i)=>{
      const d = el('div','gd-spot');
      d.textContent = it.n;
      d.dataset.name = it.n;
      d.style.left = `${it.x}vw`;
      d.style.top  = `${it.y}vh`;
      world.appendChild(d);

      STATE.hotspots.push({ id:'hs_'+i, name:it.n, el:d, isHotspot:true });
    });

    logEvent('hotspots_created', { mode:'dom', count:names.length });
  }

  function findDomHotspotAt(clientX, clientY, lockPx=0){
    const spots = STATE.hotspots;
    let best = null;

    for(const h of spots){
      const r = h.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const inside = clientX>=r.left && clientX<=r.right && clientY>=r.top && clientY<=r.bottom;
      if(inside) return { h, domEl:h.el };

      if(lockPx>0){
        const dx=cx-clientX, dy=cy-clientY;
        const d2=dx*dx+dy*dy;
        const lim2=lockPx*lockPx;
        if(d2<=lim2){
          if(!best || d2<best.d2) best={ h, domEl:h.el, d2 };
        }
      }
    }
    return best ? { h:best.h, domEl:best.domEl } : null;
  }

  function flash(elm, kind='good'){
    const col = kind==='bad' ? 'rgba(239,68,68,0.85)'
              : kind==='warn'? 'rgba(245,158,11,0.85)'
              : 'rgba(56,189,248,0.85)';
    elm.style.boxShadow = `0 0 18px ${col}`;
    setTimeout(()=>{ elm.style.boxShadow=''; }, 600);
  }

  // -------------------------
  // AI / ML / DL (local)
  // -------------------------
  const W = new Map(); // name -> Float32Array(5)
  const LR = { lr: 0.12, l2: 0.002 };
  function sigmoid(z){ return 1/(1+Math.exp(-z)); }
  function ensureW(name){
    if(!W.has(name)){
      const w = new Float32Array(5);
      for(let i=0;i<5;i++) w[i] = (rng()*0.2 - 0.1);
      W.set(name,w);
    }
    return W.get(name);
  }

  function feat(name){
    // [bias, inspected, sampled, positives, recency]
    let ins=0, sam=0, pos=0, lastT=0;
    for(const e of STATE.evidence){
      if(e.target!==name) continue;
      if(e.type==='inspect' || e.type==='hotspot') ins++;
      if(e.type==='sample') sam++;
      if(String(e.info||'').includes('พบ') || String(e.info||'').includes('สำเร็จ')) pos++;
      const tt = Date.parse(e.t||'') || 0;
      if(tt>lastT) lastT=tt;
    }
    const recency = lastT ? clamp((Date.now()-lastT)/1000, 0, 120) : 120;
    const rec = 1 - (recency/120);
    return [1, clamp(ins/6,0,1), clamp(sam/4,0,1), clamp(pos/3,0,1), rec];
  }

  function updateML(name, label){
    if(!cfg.enableAI) return;
    const x = feat(name);
    const w = ensureW(name);
    let z=0; for(let i=0;i<5;i++) z += w[i]*x[i];
    const p = sigmoid(z);
    const err = (label - p);
    for(let i=0;i<5;i++){
      w[i] += LR.lr*(err*x[i] - LR.l2*w[i]);
    }
  }

  function predictRisk(name){
    if(!cfg.enableAI) return 0.35;
    const x = feat(name);
    const w = ensureW(name);
    let z=0; for(let i=0;i<5;i++) z += w[i]*x[i];
    let p = sigmoid(z);

    // exploration bonus
    if(x[2]===0) p = clamp(p + 0.12, 0, 1);

    // deception (DL-like)
    if(rng() < TUNE.falsePos*0.12) p = clamp(p + 0.15, 0, 1);
    return p;
  }

  function startCase(){
    const cases = [
      { id:'food', name:'Food Poisoning', hint:'เน้นครัว/เขียง/ฟองน้ำ' },
      { id:'flu',  name:'Flu Spread',     hint:'เน้นลูกบิด/มือถือ/ก๊อก' },
      { id:'cross',name:'Cross-Contam',   hint:'ลำดับ UV→Swab→Cam เพื่อคอมโบ' }
    ];
    const c = pick(cases);
    STATE.caseId = c.id;
    STATE.score = 0;
    STATE.alert = 0;
    STATE.chain = [];
    STATE.objectives = pickObjectives();

    setPill(`เคส: ${c.name} • ${c.hint}`);
    logEvent('case_start', { caseId: STATE.caseId, objectives: STATE.objectives });
  }

  function pickObjectives(){
    const names = STATE.hotspots.map(h=>h.name);
    const scored = names.map(n=>({ n, r: predictRisk(n) })).sort((a,b)=>b.r-a.r);
    const pickList = [];
    if(scored[0]) pickList.push(scored[0].n);
    if(scored[1]) pickList.push(scored[1].n);
    if(scored[Math.floor(scored.length/2)]) pickList.push(scored[Math.floor(scored.length/2)].n);
    if(scored.length) pickList.push(scored[Math.floor(rng()*scored.length)].n);
    const uniqPick = Array.from(new Set(pickList)).slice(0,4);

    return uniqPick.map(t=>({ target:t, done:{ uv:false, swab:false, cam:false } }));
  }

  let _lastTipAt = 0;
  function maybeTip(){
    if(!cfg.enableAI) return;
    const t = now();
    if(t - _lastTipAt < TUNE.tipCd) return;

    const pending = STATE.objectives.filter(o=> !o.done.uv || !o.done.swab || !o.done.cam);
    if(!pending.length) return;

    let best=null;
    for(const o of pending){
      const r = predictRisk(o.target);
      if(!best || r>best.r) best = { o, r };
    }
    const nextTool = !best.o.done.uv ? 'uv' : (!best.o.done.swab ? 'swab' : 'cam');
    setPill(`AI: “${best.o.target}” เสี่ยง ${Math.round(best.r*100)}% → ใช้ ${nextTool.toUpperCase()} ต่อ`);
    logEvent('ai_tip', { target: best.o.target, risk: best.r, nextTool });
    _lastTipAt = t;
  }

  function onDirectorAction({ target, tool, success=true }){
    // combo chain uv>swab>cam
    if(tool==='uv' || tool==='swab' || tool==='cam'){
      STATE.chain.push(tool);
      if(STATE.chain.length>3) STATE.chain.shift();
    }

    const obj = STATE.objectives.find(o=>o.target===target);
    if(obj){
      if(tool==='uv') obj.done.uv = true;
      if(tool==='swab') obj.done.swab = true;
      if(tool==='cam') obj.done.cam = true;
    }

    // score & alert
    let pts = 10;
    const chainStr = STATE.chain.join('>');
    if(chainStr === 'uv>swab>cam'){
      pts += MODE.isCVR ? 30 : 25;
      STATE.alert = clamp(STATE.alert - 12, 0, 100);
      logEvent('combo_chain', { chain: chainStr, bonus: pts-10 });
    } else {
      pts += 5;
    }

    if(!success) STATE.alert = clamp(STATE.alert + TUNE.alertGainMiss, 0, 100);

    STATE.score += pts;

    // ML label (placeholder truth): swab/cam has probabilistic positive
    let label = 0;
    if(tool==='swab') label = (rng() < 0.65) ? 1 : 0;
    if(tool==='cam')  label = (rng() < 0.55) ? 1 : 0;
    if(tool==='uv')   label = (rng() < 0.45) ? 1 : 0;
    if(target && target!=='none' && (tool==='uv'||tool==='swab'||tool==='cam')) updateML(target, label);

    // outbreak
    if(STATE.alert >= TUNE.outbreakThreshold){
      triggerOutbreak();
      STATE.alert = 40;
    }

    updateHUD();
    maybeTip();
  }

  function triggerOutbreak(){
    setPill('⚠️ Outbreak! รีบเก็บหลักฐาน 2 ชิ้นใน 15 วินาที!');
    logEvent('outbreak', { at: STATE.timeLeft, score: STATE.score });

    const before = STATE.evidence.length;
    setTimeout(()=>{
      const gained = STATE.evidence.length - before;
      if(gained >= 2){
        STATE.score += 50;
        setPill('✅ คุมการระบาดได้! +50');
        logEvent('outbreak_cleared', { bonus:50, score:STATE.score });
      } else {
        STATE.alert = clamp(STATE.alert + 20, 0, 100);
        setPill('❌ คุมไม่ทัน! Alert +20');
        logEvent('outbreak_failed', { alert:STATE.alert });
      }
      updateHUD();
    }, 15000);
  }

  // -------------------------
  // Gameplay actions
  // -------------------------
  function onHotspotAction(name, elm){
    const tool = STATE.tool;
    if(!tool){
      addEvidence({ type:'inspect', target:name, info:'ตรวจสอบ' });
      onDirectorAction({ target:name, tool:'inspect', success:true });
      return;
    }

    if(tool === 'uv'){
      flash(elm,'good');
      addEvidence({ type:'hotspot', target:name, info:'พบโดย UV' });
      onDirectorAction({ target:name, tool:'uv', success:true });
    } else if(tool === 'swab'){
      flash(elm,'warn');
      elm.style.opacity = '0.65';
      setTimeout(()=>{
        elm.style.opacity='1';
        addEvidence({ type:'sample', target:name, info:'swab สำเร็จ' });
        onDirectorAction({ target:name, tool:'swab', success:true });
      }, 700);
    } else if(tool === 'cam'){
      flash(elm,'good');
      addEvidence({ type:'photo', target:name, info:'ถ่ายภาพ' });
      onDirectorAction({ target:name, tool:'cam', success:true });
      if(window.PlateLogger && typeof window.PlateLogger.sendEvidence === 'function'){
        window.PlateLogger.sendEvidence({ type:'photo', meta:{ target:name, t: iso() } });
      }
    }
  }

  async function submitReport(){
    const targets = Array.from(new Set(STATE.evidence.map(e=>e.target))).filter(Boolean).slice(0,5);
    const payload = { targets, timeLeft: STATE.timeLeft, evidenceCount: STATE.evidence.length, score: STATE.score, alert: STATE.alert, caseId: STATE.caseId };

    if(window.PlateSafe && typeof window.PlateSafe.end === 'function'){
      window.PlateSafe.end('submitted');
    } else {
      logLabel('report_submitted', payload);
    }

    if(window.PlateLogger && typeof window.PlateLogger.logEvent === 'function'){
      window.PlateLogger.logEvent('report_submitted', payload);
    } else if(window.parent && window.parent !== window){
      try{ window.parent.postMessage({ type:'plate:report', payload }, '*'); }catch(_){}
    }

    alert('ส่งรายงานแล้ว: ' + (targets.length ? targets.join(', ') : 'ยังไม่มีหลักฐาน'));
  }

  function togglePause(){
    STATE.paused = !STATE.paused;
    STATE.running = !STATE.paused;
    logEvent(STATE.paused ? 'pause' : 'resume', {});
    updateHUD();
  }

  // -------------------------
  // Unified input
  // -------------------------
  function fireAt(clientX, clientY, lockPx=0){
    const t = now();
    if(t - _lastFireAt < TAP_COOLDOWN) return;
    _lastFireAt = t;

    if(!STATE.running || STATE.paused) return;

    const hit = findDomHotspotAt(clientX, clientY, lockPx);
    if(!hit){
      // miss pressure
      onDirectorAction({ target:'none', tool: STATE.tool || 'none', success:false });
      return;
    }
    onHotspotAction(hit.h.name, hit.domEl);
  }

  function attachInputs(){
    // ignore UI clicks
    const isUI = (target)=> !!(target && (String(target.className||'').includes('gd-') || target.closest?.('.gd-toolbar,.gd-evidence,.gd-overlay')));

    // PC pointer
    document.addEventListener('pointerdown', (e)=>{
      if(isUI(e.target)) return;
      fireAt(e.clientX, e.clientY, 0);
    }, { passive:true });

    // Mobile touch
    document.addEventListener('touchstart', (e)=>{
      const t = e.touches && e.touches[0];
      if(!t) return;
      if(isUI(e.target)) return;
      fireAt(t.clientX, t.clientY, 0);
    }, { passive:true });

    // Cardboard: vr-ui.js -> hha:shoot (recommended)
    window.addEventListener('hha:shoot', (ev)=>{
      const d = ev?.detail || {};
      const x = Number.isFinite(d.x) ? d.x : (window.innerWidth/2);
      const y = Number.isFinite(d.y) ? d.y : (window.innerHeight/2);
      const lockPx = Number.isFinite(d.lockPx) ? d.lockPx : AIM_LOCKPX_DEFAULT;
      fireAt(x, y, lockPx);
    }, false);

    // keyboard shortcuts
    window.addEventListener('keydown', (e)=>{
      if(e.key === '1') setTool('uv');
      if(e.key === '2') setTool('swab');
      if(e.key === '3') setTool('cam');
      if(e.key === ' ') { e.preventDefault(); togglePause(); }
      if(e.key.toLowerCase() === 'enter') submitReport();
    }, false);
  }

  // -------------------------
  // Warmup gate overlay
  // -------------------------
  function showGateOverlay(){
    const ov = el('div','gd-overlay'); ov.id='gdGate';
    const box = el('div','gd-box');
    const h = el('h2'); h.textContent = 'Warmup 15 วินาที';
    const p = el('p'); p.textContent = MODE.isCVR
      ? 'Cardboard: จ้องค้างที่ hotspot เพื่อเก็บหลักฐาน (หรือยิงด้วยปุ่ม/แตะถ้ารองรับ) เป้าคือทำคอมโบ UV→Swab→Cam'
      : 'PC/Mobile: คลิก/แตะที่ hotspot เป้าคือทำคอมโบ UV→Swab→Cam เพื่อได้โบนัสและลด Alert';
    const btn = el('button','gd-bigbtn'); btn.textContent='เริ่มจริงทันที';
    btn.onclick = ()=>{ closeGate(); };

    box.appendChild(h); box.appendChild(p);
    box.appendChild(btn);
    ov.appendChild(box);
    document.body.appendChild(ov);

    let left = 15;
    const tick = setInterval(()=>{
      const node = p;
      if(!node) return;
      node.textContent = `Warmup เหลือ ${left}s — ลองทำคอมโบ UV→Swab→Cam ให้ได้อย่างน้อย 1 ครั้ง`;
      left--;
      if(left < 0){
        clearInterval(tick);
        closeGate();
      }
    }, 1000);

    function closeGate(){
      try{ clearInterval(tick); }catch(_){}
      ov.remove();
      logEvent('warmup_end', {});
      // reset for real round
      STATE.evidence.length = 0;
      qs('gdEvidenceList') && (qs('gdEvidenceList').innerHTML = '');
      STATE.score = 0;
      STATE.alert = 0;
      STATE.chain = [];
      startCase();
      updateHUD();
    }
  }

  // -------------------------
  // Timer loop
  // -------------------------
  let _timer = null;
  function startTimer(){
    STATE.running = true;
    STATE.paused = false;
    STATE.timeLeft = cfg.timeSec;

    updateHUD();
    logEvent('game_start', { timeSec: cfg.timeSec, seed: cfg.seed||null, view: VIEW, diff: DIFF });

    _timer = setInterval(()=>{
      if(!STATE.running || STATE.paused) return;

      STATE.timeLeft--;
      // slow pressure
      if(STATE.evidence.length){
        const last = STATE.evidence[0]; // newest because we prepend UI; evidence pushes, but safe enough
        const lastT = Date.parse(last?.t || '') || 0;
        const dt = (Date.now() - lastT)/1000;
        if(dt > 10) STATE.alert = clamp(STATE.alert + TUNE.alertGainSlow, 0, 100);
      } else {
        STATE.alert = clamp(STATE.alert + 1, 0, 100);
      }

      updateHUD();
      emitFeatures1s();
      maybeTip();

      if(STATE.timeLeft <= 0){
        clearInterval(_timer);
        STATE.running = false;

        if(window.PlateSafe && typeof window.PlateSafe.end === 'function'){
          window.PlateSafe.end('timeup');
        } else {
          logLabel('end', { reason:'timeup', score:STATE.score, caseId:STATE.caseId });
        }
        alert('หมดเวลาแล้ว!');
      }
    }, 1000);
  }

  // -------------------------
  // cVR gaze-dwell fallback
  // -------------------------
  function startDwellLoop(){
    if(!MODE.isCVR) return;

    setInterval(()=>{
      if(!STATE.running || STATE.paused) {
        STATE.dwellTargetId = null;
        STATE.dwellStart = 0;
        updateDwellUI(0);
        return;
      }

      const cx = window.innerWidth/2;
      const cy = window.innerHeight/2;
      const hit = findDomHotspotAt(cx, cy, AIM_LOCKPX_DEFAULT);
      if(!hit){
        STATE.dwellTargetId = null;
        STATE.dwellStart = 0;
        updateDwellUI(0);
        return;
      }

      const id = hit.h.id;
      if(STATE.dwellTargetId !== id){
        STATE.dwellTargetId = id;
        STATE.dwellStart = now();
        updateDwellUI(0);
        return;
      }

      const dt = now() - STATE.dwellStart;
      const pct = dt / cfg.dwellMs;
      updateDwellUI(pct);

      if(dt >= cfg.dwellMs){
        fireAt(cx, cy, AIM_LOCKPX_DEFAULT);
        STATE.dwellTargetId = null;
        STATE.dwellStart = 0;
        updateDwellUI(0);
      }
    }, 60);
  }

  // -------------------------
  // init
  // -------------------------
  function init(){
    buildUI();
    createHotspots();
    attachInputs();

    setTool('uv'); // default

    // first case
    startCase();

    // warmup gate
    if(cfg.warmupGate){
      logEvent('warmup_start', {});
      showGateOverlay();
    }

    startTimer();
    startDwellLoop();
    updateHUD();
  }

  function stop(){
    STATE.running = false;
    STATE.paused = true;
    clearInterval(_timer);
    logEvent('game_stop', {});
  }

  return { init, stop, getState:()=>STATE, addEvidence, setTool };
}