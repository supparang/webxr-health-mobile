// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — FUN LOOP + BOSS + EMERGENCY (PC/Mobile/cVR) — v20260220b
// ✅ Hidden hotspots + decoys + discovery pressure
// ✅ Tool minigames: UV coverage, Swab stroke challenge, Camera steady-focus dwell
// ✅ Evidence cards + Chain puzzle (A→B→C) (wrong possible, best path rewarded)
// ✅ Triage cleaning under limited supplies -> reduces exposure & R0
// ✅ AI Prediction L1 (heuristic, explainable, deterministic, rate-limited)
// ✅ Emergency events (waves) + Boss cluster (HP) + Momentum/Panic/Combo
// ✅ Works with /herohealth/vr/vr-ui.js (hha:shoot for cVR crosshair)
// ✅ Offline only: no app script

export default function GameApp(opts = {}) {
  'use strict';

  const cfg = Object.assign({
    mountId: 'gdApp',
    ctx: {},                 // {hub, run, view, diff, caseId, timeSec, seed, pid, ai}
    dwellMs: 1200,
  }, opts);

  const CTX = Object.assign({
    hub: '../hub.html',
    run: 'play',
    view: 'pc',              // pc|mobile|cvr
    diff: 'normal',          // easy|normal|hard
    caseId: 'classroom',     // classroom|home
    timeSec: 240,
    seed: String(Date.now()),
    pid: 'anon',
    ai: 1,
    gate: 1
  }, cfg.ctx || {});

  // ---------- utils ----------
  const WIN = window;
  const DOC = document;
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, v));
  const clamp01 = (v)=>clamp(v,0,1);
  const now = ()=> (WIN.performance && WIN.performance.now) ? WIN.performance.now() : Date.now();
  const qs = (id)=> DOC.getElementById(id);
  const el = (tag='div', cls='')=>{ const e=DOC.createElement(tag); if(cls) e.className=cls; return e; };

  // seeded RNG (deterministic)
  function xmur3(str){
    let h = 1779033703 ^ str.length;
    for (let i=0; i<str.length; i++){
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function(){
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= (h >>> 16)) >>> 0;
    };
  }
  function sfc32(a,b,c,d){
    return function(){
      a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
      var t = (a + b) | 0;
      a = b ^ (b >>> 9);
      b = (c + (c << 3)) | 0;
      c = (c << 21) | (c >>> 11);
      d = (d + 1) | 0;
      t = (t + d) | 0;
      c = (c + t) | 0;
      return (t >>> 0) / 4294967296;
    }
  }
  const seedKey = `${CTX.caseId}|${CTX.diff}|${CTX.seed}|${CTX.pid}`;
  const seedFn = xmur3(seedKey);
  const rand = sfc32(seedFn(), seedFn(), seedFn(), seedFn());
  const rint = (a,b)=>Math.floor(a + rand()*(b-a+1));
  const rpick = (arr)=>arr[Math.floor(rand()*arr.length)];

  // log bridge (offline)
  function logEvent(name, payload){
    try{
      if (WIN.PlateSafe && typeof WIN.PlateSafe.logEvent === 'function'){
        WIN.PlateSafe.logEvent(name, payload || {});
        return;
      }
    }catch(_){}
    try{
      if (WIN.PlateLogger && typeof WIN.PlateLogger.logEvent === 'function'){
        WIN.PlateLogger.logEvent(name, payload || {});
        return;
      }
    }catch(_){}
    try{
      WIN.dispatchEvent(new CustomEvent('hha:event', { detail:{ name, payload: payload||{} } }));
    }catch(_){}
  }

  function showToast(title, reason, ms=2600){
    const t = qs('gdToast');
    if(!t) return;
    qs('gdToastTitle').textContent = title || '';
    qs('gdToastReason').textContent = reason || '';
    t.style.display = 'block';
    clearTimeout(t.__tm);
    t.__tm = setTimeout(()=>{ try{ t.style.display='none'; }catch{} }, ms);
  }

  // ---------- core state ----------
  const STATE = {
    running: false,
    timeLeft: clamp(Number(CTX.timeSec)||240, 90, 480),

    tool: 'uv', // uv|swab|cam|clean
    evidence: [],      // {id,type,target,targetName,quality,risk,info,t}
    slots: { A:null, B:null, C:null }, // chain slots store evidenceId
    cleaned: new Set(),// target ids cleaned

    // difficulty params
    diff: CTX.diff,
    supplies: { wipes: 3, spray: 2 },
    baseR0: 1.55,
    exposure: 1.00,    // 1.00 baseline
    riskMap: {},       // targetId -> 0..1
    scanned: {},       // targetId -> scan progress (uv coverage)
    swabbed: {},       // targetId -> bool
    photographed: {},  // targetId -> bool

    // objects in world
    objs: [],          // {id,name,kind,el,isHotspot,isDecoy,zone,baseRisk,discovered,x,y,w,h}

    // interaction
    pointerDown: false,
    activeObjId: null,
    uvHoldAt: 0,
    uvAccum: 0,

    swab: { strokes:0, lastMoveAt:0, t0:0, ok:false, vx:0, vy:0, lastX:0, lastY:0 },
    cam: { steadyAt:0, lastX:0, lastY:0, inRadiusMs:0 },

    // ai
    aiOn: Number(CTX.ai||0) === 1,
    lastTipAt: -999999,
    tipCooldownMs: 18000,

    // --- adrenaline systems ---
    momentum: 0,          // 0..100
    panic: 0,             // 0..100
    combo: 0,
    lastGoodAt: -999999,
    lastBadAt: -999999,

    // --- boss system ---
    boss: {
      active: true,
      id: null,
      hp: 100,
      revealed: false,
      lastHitAt: -999999
    },

    // --- emergency events ---
    events: {
      current: null,
      __sched: null,
      __idx: 0,
      fired: 0
    },

    ended: false,
  };

  // apply difficulty
  (function applyDiff(){
    const d = String(STATE.diff||'normal').toLowerCase();
    if(d === 'easy'){
      STATE.supplies = { wipes: 4, spray: 3 };
      STATE.baseR0 = 1.45;
      STATE.tipCooldownMs = 14000;
    }else if(d === 'hard'){
      STATE.supplies = { wipes: 2, spray: 1 };
      STATE.baseR0 = 1.75;
      STATE.tipCooldownMs = 22000;
    }else{
      STATE.supplies = { wipes: 3, spray: 2 };
      STATE.baseR0 = 1.55;
      STATE.tipCooldownMs = 18000;
    }
  })();

  // ---------- case design ----------
  const CASES = {
    classroom: {
      title: 'โรงเรียน: เด็กป่วยในห้องเรียน',
      intro: 'เด็กป่วย 3 คนในห้องเดียวกัน — หา “จุดแพร่หลัก” แล้วกด R₀ ให้ต่ำกว่า 1',
      bestChains: [
        { A:'doorknob', B:'desk', C:'shared_stationery' },
        { A:'faucet', B:'doorknob', C:'desk' }
      ]
    },
    home: {
      title: 'บ้าน: บ้านมีคนไอ',
      intro: 'ในบ้านมีคนไอ — จุดสัมผัสสูง + จุดอาหารต้องรีบจัดการ ก่อนแพร่ไปทั้งบ้าน',
      bestChains: [
        { A:'phone', B:'remote', C:'kitchen_board' },
        { A:'doorknob', B:'phone', C:'kitchen_board' }
      ]
    }
  };

  // ---------- build DOM ----------
  let root, stage, world, layer, panels;

  function buildDOM(){
    root = qs(cfg.mountId) || DOC.body;
    root.innerHTML = '';

    // stage
    stage = el('div','gd-stage');
    world = el('div','gd-world');
    layer = el('div','gd-layer');
    world.appendChild(layer);
    stage.appendChild(world);
    root.appendChild(stage);

    // HUD top
    const hud = el('div','gd-hud');
    hud.innerHTML = `
      <div class="gd-box" style="min-width:260px;">
        <div class="gd-title" id="gdCaseTitle">Germ Detective</div>
        <div class="gd-sub" id="gdCaseIntro"></div>
        <div class="gd-stat">
          <span class="gd-pill">⏱ <span id="gdTime">--</span></span>
          <span class="gd-pill">🦠 R₀ <span id="gdR0">--</span></span>
          <span class="gd-pill">☣ Exposure <span id="gdExpo">--</span></span>
        </div>
      </div>

      <div class="gd-box">
        <div class="gd-title">🔥 Pressure</div>
        <div class="gd-stat">
          <span class="gd-pill">⚡ Mom <span id="gdMom">--</span></span>
          <span class="gd-pill">😱 Panic <span id="gdPanic">--</span></span>
          <span class="gd-pill">🧿 Boss <span id="gdBoss">--</span></span>
        </div>
      </div>

      <div class="gd-box">
        <div class="gd-title">🎒 Supplies</div>
        <div class="gd-stat">
          <span class="gd-pill">🧻 Wipes <span id="gdWipes">--</span></span>
          <span class="gd-pill">🧴 Spray <span id="gdSpray">--</span></span>
          <span class="gd-pill">🔎 Evidence <span id="gdEvc">--</span></span>
        </div>
      </div>
    `;
    root.appendChild(hud);

    // tool buttons
    const toolbar = el('div','gd-toolbar');
    toolbar.innerHTML = `
      <button class="gd-btn" id="gdBtnUV">UV Scan</button>
      <button class="gd-btn" id="gdBtnSwab">Swab</button>
      <button class="gd-btn" id="gdBtnCam">Camera</button>
      <button class="gd-btn" id="gdBtnClean">Triage Clean</button>
      <button class="gd-btn" id="gdBtnSubmit">ส่งรายงาน</button>
    `;
    root.appendChild(toolbar);

    // right panels
    panels = el('div','gd-panels');
    panels.innerHTML = `
      <div class="gd-panel">
        <h4>🧾 หลักฐาน (Evidence)</h4>
        <div class="gd-scroll" id="gdEvidenceList"></div>
      </div>

      <div class="gd-panel">
        <h4>🧩 ต่อ Chain การแพร่ (A→B→C)</h4>
        <div class="gd-sub">ลากการ์ดหลักฐานมาวาง (ผิดได้ / ทางที่ดีที่สุดจะคะแนนสูงสุด)</div>
        <div class="gd-chainSlots" id="gdChainSlots">
          <div class="gd-slot" data-slot="A"><div class="lbl">A: ต้นตอ / จุดสัมผัสสูง</div><div class="val" id="gdSlotA">—</div></div>
          <div class="gd-slot" data-slot="B"><div class="lbl">B: ตัวกลาง / จุดส่งต่อ</div><div class="val" id="gdSlotB">—</div></div>
          <div class="gd-slot" data-slot="C"><div class="lbl">C: จุดรับผล / บริบท</div><div class="val" id="gdSlotC">—</div></div>
        </div>
        <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
          <span class="gd-tag" id="gdChainScore">Chain Score: 0</span>
          <span class="gd-tag" id="gdHintTag">Hint: สำรวจให้ครบก่อน</span>
        </div>
      </div>
    `;
    root.appendChild(panels);

    // toast coach
    const toast = el('div','gd-toast');
    toast.id = 'gdToast';
    toast.innerHTML = `
      <div><b id="gdToastTitle">AI Coach</b></div>
      <div class="small" id="gdToastReason"></div>
    `;
    root.appendChild(toast);

    // end screen
    const end = el('div','gd-end');
    end.id = 'gdEnd';
    end.innerHTML = `
      <div class="box">
        <h2 id="gdEndTitle">สรุปผลคดี</h2>
        <div class="p" id="gdEndDesc"></div>

        <div class="grid">
          <div class="gd-kpi">
            <div class="k">R₀ หลังแก้ไข</div>
            <div class="v" id="gdEndR0">--</div>
            <div class="s" id="gdEndR0s">เป้าหมาย: &lt; 1.00</div>
          </div>
          <div class="gd-kpi">
            <div class="k">Exposure ลดลง</div>
            <div class="v" id="gdEndExpo">--</div>
            <div class="s" id="gdEndExps">ยิ่งลดมากยิ่งดี</div>
          </div>
          <div class="gd-kpi">
            <div class="k">Chain Score</div>
            <div class="v" id="gdEndChain">--</div>
            <div class="s" id="gdEndChains">เชื่อมเหตุผล A→B→C</div>
          </div>
          <div class="gd-kpi">
            <div class="k">Badge</div>
            <div class="v" id="gdEndBadge">--</div>
            <div class="s" id="gdEndBadges">Super Sleuth ถ้าทำได้ครบ</div>
          </div>
        </div>

        <div class="actions">
          <button class="gd-btn" id="gdBtnReplay">เล่นใหม่</button>
          <button class="gd-btn on" id="gdBtnHub">กลับ HUB</button>
        </div>
      </div>
    `;
    root.appendChild(end);

    // tool buttons
    qs('gdBtnUV').onclick = ()=> setTool('uv');
    qs('gdBtnSwab').onclick = ()=> setTool('swab');
    qs('gdBtnCam').onclick = ()=> setTool('cam');
    qs('gdBtnClean').onclick = ()=> setTool('clean');
    qs('gdBtnSubmit').onclick = submitReport;

    qs('gdBtnReplay').onclick = ()=> location.reload();
    qs('gdBtnHub').onclick = ()=> location.href = CTX.hub;

    // chain slots allow drop
    const slots = qs('gdChainSlots');
    slots.querySelectorAll('.gd-slot').forEach(s=>{
      s.addEventListener('dragover', (e)=>{ e.preventDefault(); }, false);
      s.addEventListener('drop', (e)=>{
        e.preventDefault();
        const id = e.dataTransfer.getData('text/plain');
        if(!id) return;
        setSlot(s.dataset.slot, id);
      }, false);
    });
  }

  function setTool(t){
    STATE.tool = t;
    ['UV','Swab','Cam','Clean'].forEach(k=>{
      const id = 'gdBtn'+k;
      const b = qs(id);
      if(b) b.classList.toggle('on', t === k.toLowerCase());
    });
    logEvent('tool_change', { tool:t });

    showToast(
      t === 'uv' ? '🔦 UV Scan' :
      t === 'swab' ? '🧪 Swab' :
      t === 'cam' ? '📷 Camera' :
      '🧽 Triage Clean',
      t === 'uv' ? 'กดค้าง/สแกนให้ coverage สูง จะได้หลักฐานคุณภาพดี' :
      t === 'swab' ? 'ถูให้ครบ “หลาย stroke” ภายในเวลาจำกัด เพื่อ sample ที่ดี' :
      t === 'cam' ? 'ค้างนิ่งในวงเล็งเพื่อถ่ายภาพคมชัด' :
      'ทรัพยากรจำกัด เลือกจุดคุ้มสุดเพื่อลด R₀',
      1400
    );
  }

  // ---------- world objects ----------
  function makeObjCard(o){
    const d = el('div','gd-obj');
    d.dataset.id = o.id;
    d.style.left = o.x+'%';
    d.style.top = o.y+'%';
    d.style.width = o.w+'%';
    d.style.height = o.h+'%';

    const hd = el('div','hd');
    hd.textContent = o.name;
    const bd = el('div','bd');
    bd.textContent = 'สำรวจเพื่อหาหลักฐาน…';
    const bar = el('div','bar');
    const fill = el('i');
    bar.appendChild(fill);

    d.appendChild(hd);
    d.appendChild(bd);
    d.appendChild(bar);

    d.addEventListener('pointerdown', (e)=>{
      e.preventDefault();
      STATE.pointerDown = true;
      STATE.activeObjId = o.id;
      onInteractStart(o, e.clientX, e.clientY);
    }, {passive:false});

    d.addEventListener('pointermove', (e)=>{
      if(!STATE.pointerDown) return;
      if(STATE.activeObjId !== o.id) return;
      onInteractMove(o, e.clientX, e.clientY);
    }, {passive:true});

    d.addEventListener('pointerup', (e)=>{
      if(STATE.activeObjId !== o.id) return;
      STATE.pointerDown = false;
      onInteractEnd(o, e.clientX, e.clientY);
    }, {passive:true});

    return d;
  }

  function spawnWorld(){
    const caseDef = CASES[CTX.caseId] || CASES.classroom;
    qs('gdCaseTitle').textContent = `🕵️ Germ Detective — ${caseDef.title}`;
    qs('gdCaseIntro').textContent = caseDef.intro;

    const base = (CTX.caseId === 'home')
      ? [
          { id:'phone', name:'โทรศัพท์', kind:'hotspot', zone:'living', baseRisk:.90, x:10, y:12, w:26, h:30 },
          { id:'remote', name:'รีโมท', kind:'hotspot', zone:'living', baseRisk:.78, x:40, y:18, w:26, h:26 },
          { id:'doorknob', name:'ลูกบิด', kind:'hotspot', zone:'entry', baseRisk:.88, x:72, y:14, w:22, h:28 },
          { id:'kitchen_board', name:'เขียง', kind:'hotspot', zone:'kitchen', baseRisk:.92, x:18, y:56, w:30, h:34 },
          { id:'sink_handle', name:'ก๊อกน้ำ', kind:'vector', zone:'kitchen', baseRisk:.70, x:54, y:58, w:28, h:32 },
          { id:'plant', name:'ต้นไม้ (Decoy)', kind:'decoy', zone:'living', baseRisk:.12, x:80, y:60, w:16, h:22 },
        ]
      : [
          { id:'doorknob', name:'ลูกบิด', kind:'hotspot', zone:'entry', baseRisk:.90, x:8, y:18, w:26, h:30 },
          { id:'desk', name:'โต๊ะเรียน', kind:'vector', zone:'class', baseRisk:.82, x:38, y:14, w:30, h:34 },
          { id:'shared_stationery', name:'เครื่องเขียนร่วม', kind:'victim', zone:'class', baseRisk:.86, x:70, y:18, w:24, h:30 },
          { id:'faucet', name:'ก๊อกน้ำ', kind:'vector', zone:'wash', baseRisk:.76, x:18, y:56, w:26, h:34 },
          { id:'doorframe', name:'วงกบประตู', kind:'hotspot', zone:'entry', baseRisk:.62, x:52, y:58, w:30, h:30 },
          { id:'poster', name:'โปสเตอร์ (Decoy)', kind:'decoy', zone:'class', baseRisk:.10, x:82, y:58, w:16, h:24 },
        ];

    // jitter deterministic
    const jitter = (CTX.diff==='hard') ? 2.2 : 1.4;
    STATE.objs = base.map(o=>{
      const isDecoy = o.kind === 'decoy';
      const jx = (rand()*2-1)*jitter;
      const jy = (rand()*2-1)*jitter;
      const jw = (rand()*2-1)*1.2;
      const jh = (rand()*2-1)*1.2;
      return Object.assign({}, o, {
        x: clamp(o.x + jx, 2, 88),
        y: clamp(o.y + jy, 4, 78),
        w: clamp(o.w + jw, 14, 40),
        h: clamp(o.h + jh, 16, 42),
        isHotspot: !isDecoy,
        isDecoy,
        discovered: false
      });
    });

    STATE.riskMap = {};
    STATE.scanned = {};
    STATE.swabbed = {};
    STATE.photographed = {};
    STATE.cleaned.clear();

    layer.innerHTML = '';
    STATE.objs.forEach(o=>{
      const card = makeObjCard(o);
      o.el = card;

      // hidden appearance
      card.style.opacity = o.isDecoy ? '0.55' : '0.38';
      card.querySelector('.bd').textContent = '???';
      card.querySelector('.bar > i').style.width = '0%';

      layer.appendChild(card);
      STATE.riskMap[o.id] = clamp01(o.baseRisk + (rand()*0.10 - 0.05));
      STATE.scanned[o.id] = 0;
    });

    logEvent('case_start', { caseId:CTX.caseId, diff:CTX.diff, seed:CTX.seed, pid:CTX.pid, view:CTX.view });
  }

  function discover(o){
    if(o.discovered) return;
    o.discovered = true;
    const card = o.el;
    if(!card) return;
    card.style.opacity = o.isDecoy ? '0.70' : '0.94';
    card.querySelector('.bd').textContent =
      o.isDecoy ? 'ดูเหมือนสะอาด… อย่าหลงทาง!' :
      'จุดสัมผัสสูง — ใช้ UV/Swab/Camera เพื่อยืนยัน';
    showToast('🔎 พบจุดต้องสงสัย', `${o.name} • ลองใช้เครื่องมือเก็บหลักฐาน`, 1100);
    logEvent('discover', { target:o.id });

    // good: discovery
    markGood('discover');
  }

  // ---------- interactions ----------
  function onInteractStart(o, x, y){
    discover(o);
    if(STATE.ended) return;

    if(STATE.tool === 'uv'){
      STATE.uvHoldAt = now();
      STATE.uvAccum = 0;
    } else if(STATE.tool === 'swab'){
      STATE.swab = { strokes:0, lastMoveAt: now(), t0: now(), ok:false, lastX:x, lastY:y };
    } else if(STATE.tool === 'cam'){
      STATE.cam = { steadyAt: now(), lastX:x, lastY:y, inRadiusMs:0 };
    } else if(STATE.tool === 'clean'){
      tryClean(o);
    }
  }

  function onInteractMove(o, x, y){
    if(STATE.ended) return;

    if(STATE.tool === 'uv'){
      const dt = (now() - STATE.uvHoldAt);
      STATE.uvHoldAt = now();
      const gain = dt * (o.isDecoy ? 0.00010 : 0.00018);
      STATE.scanned[o.id] = clamp01((STATE.scanned[o.id] || 0) + gain);
      renderObjProgress(o, 'uv', STATE.scanned[o.id]);
      if(STATE.scanned[o.id] > 0.18 && !o.el.classList.contains('uv-glow') && !o.isDecoy){
        o.el.classList.add('uv-glow');
      }
    }

    if(STATE.tool === 'swab'){
      const dx = x - STATE.swab.lastX;
      const dy = y - STATE.swab.lastY;
      const dist = Math.hypot(dx,dy);
      STATE.swab.lastX = x;
      STATE.swab.lastY = y;
      if(dist > 10){
        STATE.swab.strokes++;
        STATE.swab.lastMoveAt = now();
        const prog = clamp01(STATE.swab.strokes / (CTX.diff==='hard'? 16 : 12));
        renderObjProgress(o, 'swab', prog);
      }
    }

    if(STATE.tool === 'cam'){
      const dx = x - STATE.cam.lastX;
      const dy = y - STATE.cam.lastY;
      const dist = Math.hypot(dx,dy);
      STATE.cam.lastX = x;
      STATE.cam.lastY = y;
      const radius = (CTX.view==='cvr') ? 18 : 22;
      if(dist <= radius){
        STATE.cam.inRadiusMs += 16;
      }else{
        STATE.cam.inRadiusMs = Math.max(0, STATE.cam.inRadiusMs - 22);
      }
      const prog = clamp01(STATE.cam.inRadiusMs / cfg.dwellMs);
      renderObjProgress(o, 'cam', prog);
    }
  }

  function onInteractEnd(o){
    if(STATE.ended) return;

    if(STATE.tool === 'uv'){
      const cov = STATE.scanned[o.id] || 0;
      if(cov >= (CTX.diff==='hard'? 0.55 : 0.45) && !o.isDecoy){
        addEvidence({
          type:'uv',
          target:o.id,
          targetName:o.name,
          quality: gradeQuality(cov),
          risk: estimateRisk(o),
          info:`UV coverage ${Math.round(cov*100)}%`
        });
      }else{
        markBad('uv_fail');
        showToast('🔦 UV ไม่พอ', 'coverage ยังน้อย — สแกนเพิ่ม', 900);
      }
    }

    if(STATE.tool === 'swab'){
      const t = now() - STATE.swab.t0;
      const need = (CTX.diff==='hard'? 16 : 12);
      const ok = (STATE.swab.strokes >= need && t <= 2400 && !o.isDecoy);
      if(ok){
        STATE.swabbed[o.id] = true;
        addEvidence({
          type:'swab',
          target:o.id,
          targetName:o.name,
          quality: 'A',
          risk: estimateRisk(o) + 0.06,
          info:`Swab strokes ${STATE.swab.strokes}`
        });
      }else{
        markBad('swab_fail');
        showToast('🧪 Swab พลาด', `ต้อง ≥${need} strokes ใน ~2s (ตอนนี้ ${STATE.swab.strokes})`, 1200);
      }
    }

    if(STATE.tool === 'cam'){
      const prog = clamp01((STATE.cam.inRadiusMs || 0) / cfg.dwellMs);
      if(prog >= 1 && !o.isDecoy){
        STATE.photographed[o.id] = true;
        addEvidence({
          type:'photo',
          target:o.id,
          targetName:o.name,
          quality: 'A',
          risk: estimateRisk(o),
          info:'Photo: sharp'
        });
      }else{
        markBad('cam_fail');
        showToast('📷 ยังไม่นิ่งพอ', `ค้างนิ่งให้ครบ ${cfg.dwellMs}ms`, 1000);
      }
    }
  }

  function renderObjProgress(o, mode, prog01){
    const card = o.el;
    if(!card) return;
    const fill = card.querySelector('.bar > i');
    if(fill) fill.style.width = `${Math.round(clamp01(prog01)*100)}%`;

    const bd = card.querySelector('.bd');
    if(!bd) return;

    if(o.isDecoy){
      bd.textContent = (mode==='uv')
        ? `UV: ${Math.round((STATE.scanned[o.id]||0)*100)}% (ดูไม่ค่อยมีอะไร…)`
        : 'จุดนี้ดู “ไม่น่าใช่” แต่ระวังหลงทาง!';
      return;
    }

    if(mode==='uv') bd.textContent = `UV: coverage ${Math.round((STATE.scanned[o.id]||0)*100)}%`;
    if(mode==='swab') bd.textContent = `Swab: strokes ${STATE.swab.strokes}`;
    if(mode==='cam') bd.textContent = `Camera: steady ${Math.round(clamp01(prog01)*100)}%`;
  }

  function estimateRisk(o){
    const base = STATE.riskMap[o.id] ?? o.baseRisk ?? 0.5;
    const cov = STATE.scanned[o.id] || 0;
    const sw = STATE.swabbed[o.id] ? 1 : 0;
    const ph = STATE.photographed[o.id] ? 1 : 0;
    const evBonus = (cov>0.45?0.05:0) + (sw?0.06:0) + (ph?0.04:0);
    const cleanedPenalty = STATE.cleaned.has(o.id) ? -0.25 : 0;
    return clamp01(base + evBonus + cleanedPenalty);
  }

  function gradeQuality(cov){
    if(cov >= 0.85) return 'A';
    if(cov >= 0.65) return 'B';
    if(cov >= 0.45) return 'C';
    return 'D';
  }

  // ---------- evidence + drag cards ----------
  let evSeq = 0;
  function addEvidence(rec){
    const id = `E${++evSeq}`;
    const tISO = new Date().toISOString();
    const risk = clamp01(Number(rec.risk || 0));
    const quality = rec.quality || 'C';

    const item = {
      id,
      type: rec.type,
      target: rec.target,
      targetName: rec.targetName || rec.target,
      quality,
      risk,
      info: rec.info || '',
      t: tISO
    };

    STATE.evidence.push(item);
    logEvent('evidence_added', item);

    const list = qs('gdEvidenceList');
    if(list){
      const c = el('div','gd-card');
      c.draggable = true;
      c.dataset.eid = id;
      c.innerHTML = `
        <div class="t">${badgeOf(item)} ${item.targetName} <span class="gd-tag">Q:${quality}</span> <span class="gd-tag">Risk:${Math.round(risk*100)}</span></div>
        <div class="m">${item.info || ''}</div>
      `;
      c.addEventListener('dragstart', (e)=>{ e.dataTransfer.setData('text/plain', id); }, false);

      // click-to-place (mobile)
      c.addEventListener('click', ()=>{
        if(!STATE.slots.A) return setSlot('A', id);
        if(!STATE.slots.B) return setSlot('B', id);
        if(!STATE.slots.C) return setSlot('C', id);
        setSlot('C', id);
      }, false);

      list.prepend(c);
    }

    // adrenaline hooks
    if(item.target === STATE.boss.id && (item.type==='uv' || item.type==='swab' || item.type==='photo')){
      hitBoss(item.quality==='A'? 18 : (item.quality==='B'? 12 : 8), 'evidence_on_boss');
    }else if(isDecoyTarget(item.target)){
      markBad('evidence_on_decoy');
    }else{
      markGood('evidence_gain');
    }

    updateHUD();
    showToast('✅ เก็บหลักฐานสำเร็จ', `${item.type.toUpperCase()} • ${item.targetName} • Q:${quality} • Risk:${Math.round(risk*100)}`, 1500);
  }

  function badgeOf(item){
    if(item.type==='uv') return '🔦';
    if(item.type==='swab') return '🧪';
    if(item.type==='photo') return '📷';
    if(item.type==='clean') return '🧽';
    return '🧾';
  }

  function getEvidenceById(id){
    return STATE.evidence.find(e=>e.id===id) || null;
  }

  function setSlot(slot, evidenceId){
    if(!['A','B','C'].includes(slot)) return;
    const ev = getEvidenceById(evidenceId);
    if(!ev) return;
    STATE.slots[slot] = evidenceId;

    qs('gdSlot'+slot).textContent = `${badgeOf(ev)} ${ev.targetName} (Q:${ev.quality}, Risk:${Math.round(ev.risk*100)})`;
    logEvent('chain_slot', { slot, evidenceId, target: ev.target });

    const sc = scoreChain();
    qs('gdChainScore').textContent = `Chain Score: ${sc}`;
    qs('gdHintTag').textContent = sc >= 80 ? '🔥 Chain สมเหตุผลมาก!' : (sc >= 40 ? '👍 พอใช้ได้ ลองปรับอีกนิด' : '🧠 ลองหา evidence เพิ่ม');

    if(sc >= 80) markGood('chain_best');
    else if(sc <= 20) markBad('chain_weak');

    if(sc >= 80) showToast('🧩 ต่อ Chain เยี่ยม!', 'ตอนนี้เหลือ “Triage” ให้คุ้มเพื่อกด R₀', 1400);

    updateHUD();
  }

  function isDecoyTarget(tid){
    const o = STATE.objs.find(x=>x.id===tid);
    return !!(o && o.isDecoy);
  }

  function scoreChain(){
    const A = getEvidenceById(STATE.slots.A);
    const B = getEvidenceById(STATE.slots.B);
    const C = getEvidenceById(STATE.slots.C);

    let score = 0;

    const qScore = (q)=> q==='A'?25 : (q==='B'?18 : (q==='C'?12 : 6));
    if(A) score += qScore(A.quality) + Math.round(A.risk*10);
    if(B) score += qScore(B.quality) + Math.round(B.risk*10);
    if(C) score += qScore(C.quality) + Math.round(C.risk*10);

    if(A && B && C){
      const caseDef = CASES[CTX.caseId] || CASES.classroom;
      const hit = caseDef.bestChains.some(ch => ch.A===A.target && ch.B===B.target && ch.C===C.target);
      if(hit) score += 50;

      if(isDecoyTarget(A.target)) score -= 18;
      if(isDecoyTarget(B.target)) score -= 14;
      if(isDecoyTarget(C.target)) score -= 10;
    }

    return clamp(Math.round(score), 0, 100);
  }

  // ---------- triage cleaning ----------
  function tryClean(o){
    if(STATE.ended) return;
    if(o.isDecoy){
      markBad('clean_decoy');
      showToast('🧽 อย่าเสียทรัพยากร!', 'จุดนี้ดูเป็น Decoy — เลือกจุดคุ้มกว่า', 1200);
      return;
    }
    if(STATE.cleaned.has(o.id)){
      showToast('✅ สะอาดแล้ว', 'ไปจุดอื่นต่อเลย!', 800);
      return;
    }

    const risk = estimateRisk(o);
    const useSpray = (risk >= 0.85 && STATE.supplies.spray > 0);
    const useWipe = (STATE.supplies.wipes > 0);

    if(!useWipe && !useSpray){
      markBad('supplies_empty');
      showToast('❌ ของหมด!', 'ไม่มี Wipes/Spray แล้ว ต้องสรุปผลด้วยสิ่งที่มี', 1400);
      return;
    }

    if(useSpray){
      STATE.supplies.spray--;
      STATE.cleaned.add(o.id);
      o.el.classList.add('cleaned');
      addEvidence({ type:'clean', target:o.id, targetName:o.name, quality:'B', risk: clamp01(risk-0.28), info:'Cleaned with spray' });
      logEvent('triage_clean', { target:o.id, method:'spray' });
      showToast('🧴 ทำความสะอาด (Spray)', 'ลดความเสี่ยงได้มาก แต่ใช้จำกัด!', 1200);
    }else{
      STATE.supplies.wipes--;
      STATE.cleaned.add(o.id);
      o.el.classList.add('cleaned');
      addEvidence({ type:'clean', target:o.id, targetName:o.name, quality:'C', risk: clamp01(risk-0.20), info:'Cleaned with wipes' });
      logEvent('triage_clean', { target:o.id, method:'wipe' });
      showToast('🧻 ทำความสะอาด (Wipes)', 'ลดความเสี่ยงได้ดี เลือกให้คุ้ม!', 1200);
    }

    if(o.id === STATE.boss.id){
      hitBoss(CTX.diff==='hard'? 22 : 26, 'clean_boss');
    }else{
      markGood('clean');
    }

    updateHUD();
  }

  // ---------- AI prediction (heuristic + explainable) ----------
  function maybeAITip(){
    if(!STATE.aiOn || STATE.ended) return;
    const t = now();
    if(t - STATE.lastTipAt < STATE.tipCooldownMs) return;

    const candidates = STATE.objs
      .filter(o=>!o.isDecoy)
      .map(o=>({ o, risk: estimateRisk(o) }))
      .sort((a,b)=> b.risk - a.risk);

    const top = candidates[0]?.o;
    if(!top) return;

    const cov = STATE.scanned[top.id] || 0;
    const needs = cov < 0.25 && !STATE.cleaned.has(top.id);
    const lowTime = STATE.timeLeft <= 50 && (STATE.cleaned.size === 0);
    const bossUrgent = STATE.boss.revealed && STATE.boss.hp > 0 && STATE.timeLeft <= 90;

    if(needs || lowTime || bossUrgent){
      STATE.lastTipAt = t;
      const reason = bossUrgent
        ? `Boss ยังไม่ลง (HP ${Math.round(STATE.boss.hp)}%) — โฟกัส ${bossName()} ด้วยหลักฐาน/ทำความสะอาด`
        : lowTime
          ? `เหลือ ${STATE.timeLeft}s — รีบ “Triage” 1–2 จุดคุ้มสุดเพื่อกด R₀`
          : `ลองตรวจ “${top.name}” เพราะเป็นจุดสัมผัสสูง (risk สูง) และยังสแกนไม่ครบ`;

      showToast('🤖 AI Coach (Prediction)', reason, 2800);
      logEvent('ai_tip', { msg: reason, target: top.id, timeLeft: STATE.timeLeft });
      qs('gdHintTag').textContent = bossUrgent ? `🧿 Boss: ${bossName()}` : (lowTime ? '⏳ ใกล้หมดเวลา! Triage ด่วน' : `👉 แนะนำ: ${top.name}`);
    }
  }

  // ---------- Boss + Emergency + Momentum/Panic ----------
  function bossName(){
    const b = STATE.objs.find(o=>o.id===STATE.boss.id);
    return b ? b.name : 'Boss';
  }

  function chooseBoss(){
    const candidates = STATE.objs
      .filter(o=>!o.isDecoy)
      .map(o=>({o, r: STATE.riskMap[o.id] ?? o.baseRisk ?? 0.5}))
      .sort((a,b)=>b.r-a.r);

    const boss = candidates[0]?.o || STATE.objs.find(o=>!o.isDecoy);
    if(!boss) return;

    STATE.boss.id = boss.id;
    STATE.boss.hp = 100;
    STATE.boss.revealed = false;

    logEvent('boss_spawn', { bossId: boss.id });
  }

  function markGood(reason){
    STATE.combo++;
    STATE.lastGoodAt = now();
    STATE.momentum = clamp(STATE.momentum + 8 + Math.min(10, STATE.combo), 0, 100);
    STATE.panic = Math.max(0, STATE.panic - 6);
    logEvent('good', { reason, combo: STATE.combo, momentum: STATE.momentum, panic: STATE.panic });
  }

  function markBad(reason){
    STATE.combo = 0;
    STATE.lastBadAt = now();
    STATE.panic = clamp(STATE.panic + 10, 0, 100);
    STATE.momentum = Math.max(0, STATE.momentum - 8);
    logEvent('bad', { reason, momentum: STATE.momentum, panic: STATE.panic });
  }

  function hitBoss(dmg, why){
    if(!STATE.boss.active || STATE.boss.hp <= 0) return;
    const t = now();
    if(t - STATE.boss.lastHitAt < 450) return;
    STATE.boss.lastHitAt = t;

    STATE.boss.hp = clamp(STATE.boss.hp - dmg, 0, 100);

    if(STATE.boss.hp <= 0){
      showToast('🏆 BOSS DOWN!', 'คุณปิดคลัสเตอร์หลักได้แล้ว — Exposure จะลดลงแรง!', 3200);
      markGood('boss_down');
      logEvent('boss_down', { bossId: STATE.boss.id });
    }else{
      showToast('🎯 โดนแล้ว!', `โจมตีคลัสเตอร์หลัก: -${dmg} HP (เหลือ ${Math.round(STATE.boss.hp)}%)`, 1400);
      markGood(why || 'boss_hit');
    }
    updateHUD();
  }

  function maybeTriggerEvent(){
    if(!STATE.events.__sched){
      const T = clamp(Number(CTX.timeSec)||240, 90, 480);
      const pts = (T >= 240) ? [180,120,75,45,25] :
                  (T >= 180) ? [135,90,55,35,20] :
                               [90,60,35,22,12];
      STATE.events.__sched = pts.filter(x=>x < T && x > 0);
      STATE.events.__idx = 0;
    }

    const idx = STATE.events.__idx || 0;
    const sched = STATE.events.__sched || [];
    if(idx >= sched.length) return;

    const fireAt = sched[idx];
    if(STATE.timeLeft === fireAt){
      STATE.events.__idx = idx + 1;
      fireEmergencyWave(idx + 1);
    }
  }

  function fireEmergencyWave(waveNo){
    const wave = {
      no: waveNo,
      startedAt: now(),
      deadlineAt: now() + 12000,
      resolved: false,
      type: (waveNo % 2 === 1) ? 'cough_cluster' : 'touch_spike'
    };
    STATE.events.current = wave;
    STATE.events.fired++;

    // reveal boss on first wave
    if(STATE.boss.active && !STATE.boss.revealed){
      STATE.boss.revealed = true;
      const b = STATE.objs.find(o=>o.id===STATE.boss.id);
      if(b && b.el){
        b.el.classList.add('uv-glow');
        b.el.querySelector('.bd').textContent = '🧿 BOSS CLUSTER: จุดแพร่หลัก! ต้องจัดการด่วน';
      }
      showToast('🚨 EMERGENCY', `คลื่นแพร่รอบ ${waveNo}! (Boss โผล่: ${bossName()}) รีบกดให้ลง!`, 3400);
    }else{
      showToast('🚨 EMERGENCY', `คลื่นแพร่รอบ ${waveNo}! รีบเก็บหลักฐาน/ทำความสะอาดก่อนลาม`, 3000);
    }

    STATE.panic = clamp(STATE.panic + 18 + waveNo*4, 0, 100);
    logEvent('event_start', { waveNo, type: wave.type, timeLeft: STATE.timeLeft });

    setTimeout(()=> checkEventResolution(wave), 12500);
    updateHUD();
  }

  function checkEventResolution(wave){
    const cur = STATE.events.current;
    if(!cur || cur.startedAt !== wave.startedAt) return;
    if(cur.resolved) return;

    const chainScore = scoreChain();
    const bossDown = (STATE.boss.active && STATE.boss.hp <= 0);
    const cleanedHigh = STATE.objs.some(o => !o.isDecoy && STATE.cleaned.has(o.id) && estimateRisk(o) >= 0.80);

    if(bossDown || cleanedHigh || chainScore >= 80){
      cur.resolved = true;
      STATE.events.current = null;
      STATE.momentum = clamp(STATE.momentum + 20, 0, 100);
      STATE.panic = Math.max(0, STATE.panic - 22);
      showToast('✅ คลื่นหยุดได้!', 'คุณแก้สถานการณ์ทัน — Momentum เพิ่ม!', 2600);
      logEvent('event_resolve', { waveNo: wave.no, bossDown, cleanedHigh, chainScore });
      updateHUD();
      return;
    }

    // fail
    cur.resolved = false;
    STATE.events.current = null;

    markBad('event_fail');
    STATE.panic = clamp(STATE.panic + 22, 0, 100);

    if(STATE.diff === 'hard'){
      STATE.timeLeft = Math.max(0, STATE.timeLeft - 6);
      showToast('💥 ลามแล้ว!', 'พลาดคลื่นการแพร่: Panic เพิ่ม + เวลา -6s', 3200);
    }else{
      showToast('💥 ลามแล้ว!', 'พลาดคลื่นการแพร่: Panic เพิ่ม (R₀ จะพุ่ง) รีบ Triage!', 3000);
    }
    logEvent('event_fail', { waveNo: wave.no, timeLeft: STATE.timeLeft });
    updateHUD();
  }

  // ---------- scoring ----------
  function computeExposureAndR0(){
    const cleanedCount = STATE.cleaned.size;
    const chainScore = scoreChain();

    const momBoost = 1 + (STATE.momentum/180); // up to ~1.55
    const cleanImpact = momBoost * (0.14*cleanedCount + 0.02*Math.max(0, cleanedCount-2));
    const chainImpact = chainScore >= 80 ? 0.24 : (chainScore >= 40 ? 0.13 : 0.06);
    const panicPenalty = (STATE.panic/240);
    const bossPenalty = (STATE.boss.active && STATE.boss.revealed && STATE.boss.hp > 0) ? (0.10 + (STATE.boss.hp/600)) : 0;

    const expo = clamp01(1.0 - cleanImpact - chainImpact + panicPenalty + bossPenalty);
    STATE.exposure = expo;

    const R0 = STATE.baseR0 * (0.50 + 0.95*expo) * (1 + STATE.panic/300);
    return { expo, R0, chainScore };
  }

  function updateHUD(){
    qs('gdTime').textContent = `${STATE.timeLeft}s`;
    qs('gdWipes').textContent = String(STATE.supplies.wipes);
    qs('gdSpray').textContent = String(STATE.supplies.spray);
    qs('gdEvc').textContent = String(STATE.evidence.length);

    qs('gdMom').textContent = String(Math.round(STATE.momentum));
    qs('gdPanic').textContent = String(Math.round(STATE.panic));
    qs('gdBoss').textContent = (STATE.boss.revealed ? `${Math.round(STATE.boss.hp)}%` : '???');

    const { expo, R0 } = computeExposureAndR0();
    qs('gdExpo').textContent = `${Math.round(expo*100)}%`;
    qs('gdR0').textContent = `${R0.toFixed(2)}`;

    if(STATE.timeLeft <= 30){
      qs('gdHintTag').textContent = '🚨 เร่งด่วน! เหลือไม่ถึง 30s';
    }else if(STATE.timeLeft <= 60){
      qs('gdHintTag').textContent = '⚠ ใกล้หมดเวลา — เลือกทำสิ่งที่คุ้มสุด';
    }
    if(STATE.events.current){
      qs('gdHintTag').textContent = `🚨 EMERGENCY: รอบ ${STATE.events.current.no} (แก้ภายใน ~12s)`;
    }
    if(STATE.boss.revealed && STATE.boss.hp > 0 && STATE.timeLeft <= 90){
      qs('gdHintTag').textContent = `🧿 BOSS: ${bossName()} (HP ${Math.round(STATE.boss.hp)}%)`;
    }
  }

  // ---------- timer ----------
  let timerId = null;

  function startTimer(){
    STATE.running = true;
    updateHUD();

    chooseBoss();

    timerId = setInterval(()=>{
      if(!STATE.running || STATE.ended) return;

      STATE.timeLeft--;
      updateHUD();

      maybeAITip();
      maybeTriggerEvent();

      // passive decay
      STATE.panic = Math.max(0, STATE.panic - 0.45);
      if(now() - STATE.lastGoodAt > 8000) STATE.momentum = Math.max(0, STATE.momentum - 0.55);

      try{
        WIN.dispatchEvent(new CustomEvent('hha:features_1s', {
          detail: {
            game:'germ-detective',
            timeLeft: STATE.timeLeft,
            evidenceCount: STATE.evidence.length,
            supplies: Object.assign({}, STATE.supplies),
            momentum: Math.round(STATE.momentum),
            panic: Math.round(STATE.panic),
            bossHp: STATE.boss.active ? Math.round(STATE.boss.hp) : 0
          }
        }));
      }catch(_){}

      if(STATE.timeLeft <= 0){
        endGame('timeup');
      }
    }, 1000);
  }

  function endGame(reason){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.running = false;
    clearInterval(timerId);

    const { expo, R0, chainScore } = computeExposureAndR0();
    const win = (R0 < 1.00);

    const badge =
      win && chainScore >= 80 && STATE.cleaned.size >= 2 && (!STATE.boss.revealed || STATE.boss.hp <= 0) ? '🏆 Super Sleuth' :
      win ? '🥇 Case Closed' :
      chainScore >= 80 ? '🧠 Great Detective (แต่ Triage ยังไม่พอ)' :
      '🕵️ Keep Training';

    qs('gdEndTitle').textContent = win ? '🎉 ปิดคดีสำเร็จ!' : '😵 คดียังไม่จบ…';
    qs('gdEndDesc').textContent =
      win
        ? `คุณลด R₀ จนต่ำกว่า 1 ได้สำเร็จ — การแพร่เชื้อหยุดลง!`
        : `R₀ ยังสูงเกินไป — ครั้งหน้าต้อง Triage ให้คุ้มขึ้น + โฟกัส Boss ให้ลง`;

    qs('gdEndR0').textContent = R0.toFixed(2);
    qs('gdEndExpo').textContent = `${Math.round((1-expo)*100)}%`;
    qs('gdEndChain').textContent = String(chainScore);
    qs('gdEndBadge').textContent = badge;

    qs('gdEnd').style.display = 'grid';

    logEvent('end', {
      reason, R0, expo, chainScore, badge,
      evidenceCount: STATE.evidence.length,
      cleaned: Array.from(STATE.cleaned),
      momentum: STATE.momentum,
      panic: STATE.panic,
      bossId: STATE.boss.id,
      bossHp: STATE.boss.hp
    });
  }

  async function submitReport(){
    if(STATE.ended) return;
    if(STATE.evidence.length < 3){
      markBad('submit_too_early');
      showToast('🧾 ยังส่งไม่ได้', 'ต้องมีหลักฐานอย่างน้อย 3 ชิ้นก่อน', 1300);
      return;
    }
    endGame('submitted');
  }

  // ---------- cVR support (hha:shoot) ----------
  function wireShoot(){
    WIN.addEventListener('hha:shoot', (ev)=>{
      if(STATE.ended) return;
      const d = ev?.detail || {};
      const x = Number(d.x); const y = Number(d.y);
      if(!Number.isFinite(x) || !Number.isFinite(y)) return;

      const hit = DOC.elementFromPoint(x,y);
      if(!hit) return;
      const card = hit.closest && hit.closest('.gd-obj');
      if(!card) return;
      const id = String(card.dataset.id || '');
      const o = STATE.objs.find(z=>z.id===id);
      if(!o) return;

      discover(o);

      if(STATE.tool === 'clean'){
        tryClean(o);
        return;
      }

      // tap assist for cVR
      if(STATE.tool === 'uv'){
        STATE.scanned[o.id] = clamp01((STATE.scanned[o.id]||0) + 0.08);
        renderObjProgress(o,'uv',STATE.scanned[o.id]);
        showToast('🔦 UV Tap', 'แตะช่วยได้เล็กน้อย แต่กดค้างจะดีกว่า', 900);
      }else if(STATE.tool === 'swab'){
        showToast('🧪 Swab', 'Cardboard: ลากนิ้วบนการ์ดเพื่อสะสม stroke', 1200);
      }else if(STATE.tool === 'cam'){
        showToast('📷 Camera', `Cardboard: กดค้างนิ่งบนการ์ด ${cfg.dwellMs}ms`, 1200);
      }
    }, false);
  }

  // ---------- init ----------
  function init(){
    buildDOM();
    spawnWorld();
    wireShoot();
    setTool('uv');

    DOC.addEventListener('pointerup', ()=>{
      STATE.pointerDown = false;
      STATE.activeObjId = null;
    }, {passive:true});

    DOC.addEventListener('keydown', (e)=>{
      if(e.key==='1') setTool('uv');
      if(e.key==='2') setTool('swab');
      if(e.key==='3') setTool('cam');
      if(e.key==='4') setTool('clean');
      if(e.key==='Enter') submitReport();
    }, {passive:true});

    startTimer();

    if(STATE.aiOn){
      setTimeout(()=> showToast('🤖 AI Coach', 'เป้าหมาย: เก็บหลักฐาน → ต่อ Chain → Triage → ตี Boss → กด R₀ < 1', 2800), 700);
    }
  }

  return {
    init,
    getState: ()=>STATE,
    setTool,
    addEvidence,
    stop: ()=>{ STATE.running=false; clearInterval(timerId); }
  };
}