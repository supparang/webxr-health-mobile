// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — PRODUCTION FUN LOOP (PC/Mobile/cVR) — v20260220a
// ✅ Hidden hotspots + decoys + exploration pressure
// ✅ Tool minigames: UV scan coverage, Swab stroke challenge, Camera steady-focus dwell
// ✅ Evidence cards + Chain puzzle (A→B→C) (wrong possible, best path rewarded)
// ✅ Triage cleaning under limited supplies -> reduces exposure & R0
// ✅ AI Prediction L1 (heuristic, explainable, deterministic, rate-limited)
// ✅ Works with /herohealth/vr/vr-ui.js (hha:shoot for cVR crosshair)
//
// No networking / No app script.
// Emits local events if PlateSafe/PlateLogger not present.

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
    evidence: [],      // {id,type,target,quality,risk,info,t}
    cards: [],         // same as evidence for UI list
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
    objs: [],          // {id,name,kind,rect,el,isHotspot,isDecoy,zone,baseRisk}

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

    // end
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

  // ---------- case design (graph / true chain) ----------
  // We model "best" chain for puzzle:
  // A = source hotspot (high-contact object)
  // B = transfer vector hotspot
  // C = victim context (area/object)
  const CASES = {
    classroom: {
      title: 'โรงเรียน: เด็กป่วยในห้องเรียน',
      intro: 'เด็กป่วย 3 คนในห้องเดียวกัน — ต้องหาต้นตอ + จุดแพร่หลัก แล้วกด R₀ ให้ต่ำกว่า 1',
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

    // wire tool buttons
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
    qs('gdBtnSubmit')?.classList.toggle('on', t === 'submit');
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
      1600
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

    // pointer interactions (pc/mobile)
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

    // Layout differs per case; include decoys (false positives)
    const base = (CTX.caseId === 'home')
      ? [
          { id:'phone', name:'โทรศัพท์', kind:'hotspot', zone:'living', baseRisk:.90, x:10, y:12, w:26, h:30 },
          { id:'remote', name:'รีโมท', kind:'hotspot', zone:'living', baseRisk:.78, x:40, y:18, w:26, h:26 },
          { id:'doorknob', name:'ลูกบิด', kind:'hotspot', zone:'entry', baseRisk:.88, x:72, y:14, w:22, h:28 },
          { id:'kitchen_board', name:'เขียง', kind:'hotspot', zone:'kitchen', baseRisk:.92, x:18, y:56, w:30, h:34 },
          { id:'sink_handle', name:'ก๊อกน้ำ', kind:'vector', zone:'kitchen', baseRisk:.70, x:54, y:58, w:28, h:32 },

          // decoys
          { id:'plant', name:'ต้นไม้ (Decoy)', kind:'decoy', zone:'living', baseRisk:.12, x:80, y:60, w:16, h:22 },
        ]
      : [
          { id:'doorknob', name:'ลูกบิด', kind:'hotspot', zone:'entry', baseRisk:.90, x:8, y:18, w:26, h:30 },
          { id:'desk', name:'โต๊ะเรียน', kind:'vector', zone:'class', baseRisk:.82, x:38, y:14, w:30, h:34 },
          { id:'shared_stationery', name:'เครื่องเขียนร่วม', kind:'victim', zone:'class', baseRisk:.86, x:70, y:18, w:24, h:30 },
          { id:'faucet', name:'ก๊อกน้ำ', kind:'vector', zone:'wash', baseRisk:.76, x:18, y:56, w:26, h:34 },
          { id:'doorframe', name:'วงกบประตู', kind:'hotspot', zone:'entry', baseRisk:.62, x:52, y:58, w:30, h:30 },

          // decoys
          { id:'poster', name:'โปสเตอร์ (Decoy)', kind:'decoy', zone:'class', baseRisk:.10, x:82, y:58, w:16, h:24 },
        ];

    // “ซ่อน” บางจุดแบบ deterministic (ต้องสำรวจ)
    // We do this by lowering opacity and removing label detail until discovered.
    STATE.objs = base.map(o=>{
      const isDecoy = o.kind === 'decoy';
      // randomize slight position/size for replay variety but deterministic
      const jitter = (CTX.diff==='hard') ? 2.2 : 1.4;
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

    // build risk map
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
    showToast('🔎 พบจุดต้องสงสัย', `${o.name} • ลองใช้เครื่องมือเก็บหลักฐาน`, 1400);
    logEvent('discover', { target:o.id });
  }

  // ---------- interactions (tools) ----------
  function onInteractStart(o, x, y){
    discover(o);
    if(STATE.ended) return;

    if(STATE.tool === 'uv'){
      STATE.uvHoldAt = now();
      STATE.uvAccum = 0;
      showToast('🔦 UV', 'กดค้าง/สแกนให้ครบ ยิ่งนานยิ่งชัด', 900);
    } else if(STATE.tool === 'swab'){
      STATE.swab = { strokes:0, lastMoveAt: now(), t0: now(), ok:false, lastX:x, lastY:y };
      showToast('🧪 Swab', 'ลากถูเร็ว ๆ หลายครั้งภายใน ~2 วินาที', 900);
    } else if(STATE.tool === 'cam'){
      STATE.cam = { steadyAt: now(), lastX:x, lastY:y, inRadiusMs:0 };
      showToast('📷 Camera', `ค้างนิ่ง ${cfg.dwellMs}ms เพื่อถ่าย “คมชัด”`, 900);
    } else if(STATE.tool === 'clean'){
      tryClean(o);
    }
  }

  function onInteractMove(o, x, y){
    if(STATE.ended) return;

    if(STATE.tool === 'uv'){
      // accumulate coverage while holding
      const dt = (now() - STATE.uvHoldAt);
      STATE.uvHoldAt = now();
      const gain = dt * (o.isDecoy ? 0.00010 : 0.00018); // decoy gains slower
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
        // in steady zone
        STATE.cam.inRadiusMs += 16; // approx
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
      // if enough coverage -> evidence
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
        showToast('🔦 UV ไม่พอ', 'coverage ยังน้อย — ลองสแกนเพิ่ม', 1100);
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
        showToast('🧪 Swab พลาด', `ต้อง ≥${need} strokes ใน ~2s (ตอนนี้ ${STATE.swab.strokes})`, 1300);
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
        showToast('📷 ยังไม่นิ่งพอ', `ค้างนิ่งให้ครบ ${cfg.dwellMs}ms`, 1100);
      }
    }
  }

  function renderObjProgress(o, mode, prog01){
    const card = o.el;
    if(!card) return;
    const fill = card.querySelector('.bar > i');
    if(fill) fill.style.width = `${Math.round(clamp01(prog01)*100)}%`;

    // update detail text
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
    // risk influenced by: baseRisk, discovered, evidence completeness
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

    // update UI
    const list = qs('gdEvidenceList');
    if(list){
      const c = el('div','gd-card');
      c.draggable = true;
      c.dataset.eid = id;
      c.innerHTML = `
        <div class="t">${badgeOf(item)} ${item.targetName} <span class="gd-tag">Q:${quality}</span> <span class="gd-tag">Risk:${Math.round(risk*100)}</span></div>
        <div class="m">${item.info || ''}</div>
      `;
      c.addEventListener('dragstart', (e)=>{
        e.dataTransfer.setData('text/plain', id);
      }, false);

      // click-to-place (mobile friendly)
      c.addEventListener('click', ()=>{
        // auto place into first empty slot
        if(!STATE.slots.A) return setSlot('A', id);
        if(!STATE.slots.B) return setSlot('B', id);
        if(!STATE.slots.C) return setSlot('C', id);
        // else replace the weakest slot
        setSlot('C', id);
      }, false);

      list.prepend(c);
    }

    // update counters
    updateHUD();

    // spark joy
    showToast('✅ เก็บหลักฐานสำเร็จ', `${item.type.toUpperCase()} • ${item.targetName} • Q:${quality} • Risk:${Math.round(risk*100)}`, 1700);
  }

  function badgeOf(item){
    if(item.type==='uv') return '🔦';
    if(item.type==='swab') return '🧪';
    if(item.type==='photo') return '📷';
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

    // update UI slot label
    qs('gdSlot'+slot).textContent = `${badgeOf(ev)} ${ev.targetName} (Q:${ev.quality}, Risk:${Math.round(ev.risk*100)})`;
    logEvent('chain_slot', { slot, evidenceId, target: ev.target });

    // compute chain score
    const sc = scoreChain();
    qs('gdChainScore').textContent = `Chain Score: ${sc}`;
    qs('gdHintTag').textContent = sc >= 80 ? '🔥 Chain สมเหตุผลมาก!' : (sc >= 40 ? '👍 พอใช้ได้ ลองปรับอีกนิด' : '🧠 ลองหา evidence เพิ่ม');

    // coach reaction
    if(sc >= 80) showToast('🧩 ต่อ Chain เยี่ยม!', 'ตอนนี้เหลือ “Triage” ให้คุ้มเพื่อกด R₀', 1600);
  }

  function scoreChain(){
    // if any slot missing: partial score based on risk quality
    const A = getEvidenceById(STATE.slots.A);
    const B = getEvidenceById(STATE.slots.B);
    const C = getEvidenceById(STATE.slots.C);

    let score = 0;

    // base points from quality & risk
    const qScore = (q)=> q==='A'?25 : (q==='B'?18 : (q==='C'?12 : 6));
    if(A) score += qScore(A.quality) + Math.round(A.risk*10);
    if(B) score += qScore(B.quality) + Math.round(B.risk*10);
    if(C) score += qScore(C.quality) + Math.round(C.risk*10);

    // match best chain (targets)
    if(A && B && C){
      const caseDef = CASES[CTX.caseId] || CASES.classroom;
      const hit = caseDef.bestChains.some(ch => ch.A===A.target && ch.B===B.target && ch.C===C.target);
      if(hit) score += 50;

      // penalize decoy / low-risk for core slots
      if(isDecoyTarget(A.target)) score -= 18;
      if(isDecoyTarget(B.target)) score -= 14;
      if(isDecoyTarget(C.target)) score -= 10;
    }

    return clamp(Math.round(score), 0, 100);
  }

  function isDecoyTarget(tid){
    const o = STATE.objs.find(x=>x.id===tid);
    return !!(o && o.isDecoy);
  }

  // ---------- triage cleaning ----------
  function tryClean(o){
    if(STATE.ended) return;
    if(o.isDecoy){
      showToast('🧽 อย่าเสียทรัพยากร!', 'จุดนี้ดูเป็น Decoy — เลือกจุดคุ้มกว่า', 1300);
      return;
    }
    if(STATE.cleaned.has(o.id)){
      showToast('✅ สะอาดแล้ว', 'ไปจุดอื่นต่อเลย!', 900);
      return;
    }
    // choose which supply to spend (simple rule: spray for very high risk)
    const risk = estimateRisk(o);
    const useSpray = (risk >= 0.85 && STATE.supplies.spray > 0);
    const useWipe = (STATE.supplies.wipes > 0);

    if(!useWipe && !useSpray){
      showToast('❌ ของหมด!', 'ไม่มี Wipes/Spray แล้ว ต้องสรุปผลด้วยสิ่งที่มี', 1400);
      return;
    }

    if(useSpray){
      STATE.supplies.spray--;
      STATE.cleaned.add(o.id);
      o.el.classList.add('cleaned');
      addEvidence({ type:'clean', target:o.id, targetName:o.name, quality:'B', risk: clamp01(risk-0.28), info:'Cleaned with spray' });
      logEvent('triage_clean', { target:o.id, method:'spray' });
      showToast('🧴 ทำความสะอาด (Spray)', 'ลดความเสี่ยงได้มาก แต่ใช้จำกัด!', 1400);
    }else{
      STATE.supplies.wipes--;
      STATE.cleaned.add(o.id);
      o.el.classList.add('cleaned');
      addEvidence({ type:'clean', target:o.id, targetName:o.name, quality:'C', risk: clamp01(risk-0.20), info:'Cleaned with wipes' });
      logEvent('triage_clean', { target:o.id, method:'wipe' });
      showToast('🧻 ทำความสะอาด (Wipes)', 'ลดความเสี่ยงได้ดี เลือกให้คุ้ม!', 1400);
    }

    updateHUD();
  }

  // ---------- AI prediction (heuristic + explainable) ----------
  function maybeAITip(){
    if(!STATE.aiOn || STATE.ended) return;
    const t = now();
    if(t - STATE.lastTipAt < STATE.tipCooldownMs) return;

    // choose highest-risk undiscovered / unscanned hotspot
    const candidates = STATE.objs
      .filter(o=>!o.isDecoy)
      .map(o=>({ o, risk: estimateRisk(o) }))
      .sort((a,b)=> b.risk - a.risk);

    const top = candidates[0]?.o;
    if(!top) return;

    const cov = STATE.scanned[top.id] || 0;
    const needs = cov < 0.25 && !STATE.cleaned.has(top.id);

    // also if time low and no triage
    const lowTime = STATE.timeLeft <= 50 && (STATE.cleaned.size === 0);

    if(needs || lowTime){
      STATE.lastTipAt = t;

      const reason = lowTime
        ? `เหลือ ${STATE.timeLeft}s — รีบ “Triage” 1–2 จุดคุ้มสุดเพื่อกด R₀`
        : `ลองตรวจ “${top.name}” เพราะเป็นจุดสัมผัสสูง (risk สูง) และยังสแกนไม่ครบ`;

      showToast('🤖 AI Coach (Prediction)', reason, 2800);
      logEvent('ai_tip', { msg: reason, target: top.id, timeLeft: STATE.timeLeft });

      // nudge hint tag
      qs('gdHintTag').textContent = lowTime ? '⏳ ใกล้หมดเวลา! Triage ด่วน' : `👉 แนะนำ: ${top.name}`;
    }
  }

  // ---------- timer + scoring ----------
  let timerId = null;

  function computeExposureAndR0(){
    // exposure starts 1.0; reduced by cleaning + correct chain
    const cleanedCount = STATE.cleaned.size;
    const chainScore = scoreChain();

    // cleaning impact (nonlinear)
    const cleanImpact = 0.14*cleanedCount + 0.02*Math.max(0, cleanedCount-2);
    // chain explanation impact: if good chain, we assume player targeted right nodes
    const chainImpact = chainScore >= 80 ? 0.22 : (chainScore >= 40 ? 0.12 : 0.05);

    const expo = clamp01(1.0 - cleanImpact - chainImpact);
    STATE.exposure = expo;

    // R0 scales with exposure
    const R0 = STATE.baseR0 * (0.55 + 0.90*expo); // keep plausible range
    return { expo, R0, chainScore };
  }

  function updateHUD(){
    qs('gdTime').textContent = `${STATE.timeLeft}s`;
    qs('gdWipes').textContent = String(STATE.supplies.wipes);
    qs('gdSpray').textContent = String(STATE.supplies.spray);
    qs('gdEvc').textContent = String(STATE.evidence.length);

    const { expo, R0 } = computeExposureAndR0();
    qs('gdExpo').textContent = `${Math.round(expo*100)}%`;
    qs('gdR0').textContent = `${R0.toFixed(2)}`;

    // tension cues by time
    if(STATE.timeLeft <= 30){
      qs('gdHintTag').textContent = '🚨 เร่งด่วน! เหลือไม่ถึง 30s';
    }else if(STATE.timeLeft <= 60){
      qs('gdHintTag').textContent = '⚠ ใกล้หมดเวลา — เลือกทำสิ่งที่คุ้มสุด';
    }
  }

  function startTimer(){
    STATE.running = true;
    updateHUD();

    timerId = setInterval(()=>{
      if(!STATE.running || STATE.ended) return;
      STATE.timeLeft--;
      updateHUD();
      maybeAITip();

      // feature tick (optional)
      try{
        WIN.dispatchEvent(new CustomEvent('hha:features_1s', {
          detail: {
            game:'germ-detective',
            timeLeft: STATE.timeLeft,
            evidenceCount: STATE.evidence.length,
            supplies: Object.assign({}, STATE.supplies)
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
      win && chainScore >= 80 && STATE.cleaned.size >= 2 ? '🏆 Super Sleuth' :
      win ? '🥇 Case Closed' :
      chainScore >= 80 ? '🧠 Great Detective (แต่ Triage ยังไม่พอ)' :
      '🕵️ Keep Training';

    qs('gdEndTitle').textContent = win ? '🎉 ปิดคดีสำเร็จ!' : '😵 คดียังไม่จบ…';
    qs('gdEndDesc').textContent =
      win
        ? `คุณลด R₀ จนต่ำกว่า 1 ได้สำเร็จ — การแพร่เชื้อหยุดลง!`
        : `R₀ ยังสูงเกินไป — ครั้งหน้าต้อง Triage ให้คุ้มขึ้น และต่อ Chain ให้แน่นกว่าเดิม`;

    qs('gdEndR0').textContent = R0.toFixed(2);
    qs('gdEndExpo').textContent = `${Math.round((1-expo)*100)}%`;
    qs('gdEndChain').textContent = String(chainScore);
    qs('gdEndBadge').textContent = badge;

    qs('gdEnd').style.display = 'grid';

    logEvent('end', { reason, R0, expo, chainScore, badge, evidenceCount: STATE.evidence.length, cleaned: Array.from(STATE.cleaned) });
  }

  async function submitReport(){
    if(STATE.ended) return;
    // must have at least 3 evidence to submit, else risk is high
    if(STATE.evidence.length < 3){
      showToast('🧾 ยังส่งไม่ได้', 'ต้องมีหลักฐานอย่างน้อย 3 ชิ้นก่อน', 1400);
      return;
    }
    endGame('submitted');
  }

  // ---------- cVR support (hha:shoot) ----------
  function wireShoot(){
    // In cVR strict, user taps -> vr-ui emits hha:shoot at center.
    // We'll interpret shoot as "interact" with object under that point.
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

      // emulate quick tap interaction:
      discover(o);
      if(STATE.tool === 'clean'){
        tryClean(o);
        return;
      }
      // tap = start+end quickly -> if uv, give small bump; cam/swab rely on hold, so tap gives hint
      if(STATE.tool === 'uv'){
        STATE.scanned[o.id] = clamp01((STATE.scanned[o.id]||0) + 0.08);
        renderObjProgress(o,'uv',STATE.scanned[o.id]);
        showToast('🔦 UV Tap', 'แตะช่วยได้เล็กน้อย แต่กดค้างจะดีกว่า', 900);
      }else if(STATE.tool === 'swab'){
        showToast('🧪 Swab', 'บน Cardboard แนะนำ “ลากนิ้ว” บนการ์ดเพื่อทำ stroke', 1200);
      }else if(STATE.tool === 'cam'){
        showToast('📷 Camera', `บน Cardboard ให้กดค้างนิ่งบนการ์ด ${cfg.dwellMs}ms`, 1200);
      }
    }, false);
  }

  // ---------- init ----------
  function init(){
    buildDOM();
    spawnWorld();
    wireShoot();
    setTool('uv');

    // global pointer up to release if pointer leaves
    DOC.addEventListener('pointerup', ()=>{
      STATE.pointerDown = false;
      STATE.activeObjId = null;
    }, {passive:true});

    // keyboard shortcuts (PC)
    DOC.addEventListener('keydown', (e)=>{
      if(e.key==='1') setTool('uv');
      if(e.key==='2') setTool('swab');
      if(e.key==='3') setTool('cam');
      if(e.key==='4') setTool('clean');
      if(e.key==='Enter') submitReport();
    }, {passive:true});

    startTimer();

    // initial coach tip
    if(STATE.aiOn){
      setTimeout(()=> showToast('🤖 AI Coach', 'เป้าหมาย: เก็บหลักฐาน → ต่อ Chain → Triage ให้คุ้ม เพื่อกด R₀ < 1', 2600), 800);
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