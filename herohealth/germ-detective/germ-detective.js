// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective CORE — PRODUCTION SAFE (PC/Mobile/cVR)
// PATCH v20260308-GD-END-OVERLAY-COOLDOWN
//
// ✅ summary overlay in-game
// ✅ replay / back hub / cooldown buttons
// ✅ getSummary()
// ✅ HHA_LAST_SUMMARY + HHA_SUMMARY_HISTORY
// ✅ hha:end + hha:event session_end
// ✅ no import dependency

export default function GameApp(opts = {}) {
  const WIN = window;
  const DOC = document;

  function clamp(v,a,b){
    v = Number(v);
    if(!Number.isFinite(v)) v = a;
    return Math.max(a, Math.min(b, v));
  }
  function el(tag='div', cls=''){
    const e = DOC.createElement(tag);
    if(cls) e.className = cls;
    return e;
  }
  function $(id){ return DOC.getElementById(id); }
  function isoNow(){ return new Date().toISOString(); }
  function nowMs(){ return (WIN.performance && WIN.performance.now) ? WIN.performance.now() : Date.now(); }

  const cfg = Object.assign({
    mountId: 'app',
    timeSec: 120,
    seed: String(Date.now()),
    run: 'play',
    diff: 'normal',
    scene: 'classroom',
    view: 'pc',
    pid: 'anon',
    hub: '../hub.html'
  }, opts || {});

  function hash32(str){
    str = String(str || '');
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
    ]
  };

  const STATE = {
    running:false,
    paused:false,
    ended:false,
    timeTotal: clamp(cfg.timeSec, 20, 600),
    timeLeft: clamp(cfg.timeSec, 20, 600),
    tool:'uv',
    hotspots: [],
    evidence: [],
    score:0,
    timer:null,
    summary:null
  };

  let ROOT = null;
  let STAGE = null;
  let SIDEBAR = null;
  let END_OVERLAY = null;

  function emit(name, payload){
    try{
      WIN.dispatchEvent(new CustomEvent(name, { detail: payload || {} }));
    }catch{}
  }
  function emitHHAEvent(name, payload){
    emit('hha:event', { name, payload: payload || {} });
  }

  function scoreAdd(n, reason){
    STATE.score += Math.max(0, Number(n)||0);
    updateHUD();
    emitHHAEvent('score_add', { add:n, score:STATE.score, reason:reason||'' });
  }

  function buildHotspots(){
    const source = (SCENES[cfg.scene] || SCENES.classroom).slice();
    STATE.hotspots = source.map((s, i)=>({
      id:'hs_'+i,
      name:s.name,
      importance: s.importance || 3,
      risk: Math.round(20 + RNG()*70),
      infected: false,
      scanned:false,
      swabbed:false,
      photographed:false,
      cleaned:false,
      x: 10 + RNG()*78,
      y: 20 + RNG()*60,
      el: null
    }));

    const infectedCount = cfg.diff === 'hard' ? 4 : (cfg.diff === 'easy' ? 2 : 3);
    const sorted = STATE.hotspots.slice().sort((a,b)=> (b.risk+b.importance*10) - (a.risk+a.importance*10));
    sorted.slice(0, infectedCount).forEach(h=>{
      h.infected = true;
      h.risk = clamp(h.risk + 20, 0, 100);
    });
  }

  function ensureStyle(){
    if($('gdCoreStyle')) return;
    const st = el('style');
    st.id = 'gdCoreStyle';
    st.textContent = `
      .gd-wrap{
        display:grid;
        grid-template-columns:minmax(0,1fr) 320px;
        gap:10px;
        padding:10px;
      }
      @media (max-width:960px){
        .gd-wrap{ grid-template-columns:1fr; }
      }
      .gd-stage{
        position:relative;
        min-height:64vh;
        border:1px solid rgba(148,163,184,.18);
        border-radius:18px;
        background:rgba(255,255,255,.02);
        overflow:hidden;
      }
      .gd-side{
        display:grid;
        gap:10px;
        align-content:start;
      }
      .gd-panel{
        border:1px solid rgba(148,163,184,.18);
        border-radius:18px;
        background:rgba(2,6,23,.64);
        overflow:hidden;
      }
      .gd-panel .hd{
        padding:10px 12px;
        border-bottom:1px solid rgba(148,163,184,.12);
        font-size:13px;
        font-weight:1000;
      }
      .gd-panel .bd{
        padding:10px 12px;
        font-size:12px;
        color:#cbd5e1;
        line-height:1.45;
      }
      .gd-toolbar{
        position:absolute;
        left:12px;
        top:12px;
        z-index:3;
        display:flex;
        gap:8px;
        flex-wrap:wrap;
      }
      .gd-tool{
        appearance:none;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.72);
        color:#e5e7eb;
        border-radius:999px;
        padding:8px 10px;
        font-weight:1000;
        cursor:pointer;
      }
      .gd-tool.active{
        border-color:rgba(34,211,238,.35);
        background:rgba(34,211,238,.12);
      }
      .gd-timer{
        position:absolute;
        right:12px;
        top:12px;
        z-index:3;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.72);
        color:#e5e7eb;
        border-radius:999px;
        padding:8px 10px;
        font-size:12px;
        font-weight:1000;
      }
      .gd-spot{
        position:absolute;
        min-width:90px;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(15,23,42,.76);
        color:#e5e7eb;
        border-radius:14px;
        padding:10px 12px;
        font-size:12px;
        font-weight:1000;
        box-shadow:0 14px 40px rgba(0,0,0,.26);
        user-select:none;
        cursor:pointer;
      }
      .gd-spot .sub{
        display:block;
        margin-top:4px;
        color:#94a3b8;
        font-size:11px;
        font-weight:900;
      }
      .gd-spot.hot{ box-shadow:0 0 0 2px rgba(239,68,68,.22),0 14px 40px rgba(0,0,0,.26); }
      .gd-spot.clean{ box-shadow:0 0 0 2px rgba(34,197,94,.24),0 14px 40px rgba(0,0,0,.26); }

      html[data-view="cvr"] .gd-spot{ pointer-events:none; }

      .gd-list{
        display:grid;
        gap:8px;
        max-height:220px;
        overflow:auto;
      }
      .gd-item{
        border:1px solid rgba(148,163,184,.12);
        border-radius:12px;
        background:rgba(255,255,255,.02);
        padding:8px 10px;
        font-size:12px;
      }

      .gd-end{
        position:fixed;
        inset:0;
        z-index:200;
        display:none;
        padding:16px;
        background:rgba(0,0,0,.55);
        overflow:auto;
      }
      .gd-end.show{ display:block; }
      .gd-end-card{
        max-width:760px;
        margin:0 auto;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(2,6,23,.90);
        border-radius:22px;
        padding:16px;
        box-shadow:0 30px 90px rgba(0,0,0,.45);
      }
      .gd-end-title{
        font-size:18px;
        font-weight:1100;
      }
      .gd-end-grid{
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
        gap:10px;
        margin-top:12px;
      }
      .gd-end-item{
        border:1px solid rgba(148,163,184,.14);
        border-radius:14px;
        background:rgba(255,255,255,.03);
        padding:10px;
      }
      .gd-end-item span{
        display:block;
        color:#94a3b8;
        font-size:12px;
        font-weight:900;
      }
      .gd-end-item b{
        display:block;
        margin-top:4px;
        font-size:20px;
      }
      .gd-end-note{
        margin-top:12px;
        color:#cbd5e1;
        font-size:13px;
        line-height:1.5;
      }
      .gd-end-actions{
        display:flex;
        flex-wrap:wrap;
        gap:10px;
        justify-content:flex-end;
        margin-top:14px;
      }
      .gd-btn{
        appearance:none;
        border:1px solid rgba(148,163,184,.18);
        background:rgba(255,255,255,.03);
        color:#e5e7eb;
        border-radius:14px;
        padding:10px 12px;
        font-weight:1000;
        cursor:pointer;
      }
      .gd-btn.primary{
        border-color:rgba(245,158,11,.34);
        background:rgba(245,158,11,.12);
      }
    `;
    DOC.head.appendChild(st);
  }

  function buildUI(){
    ensureStyle();
    ROOT = $(cfg.mountId);
    if(!ROOT) return;

    ROOT.innerHTML = '';

    const wrap = el('div','gd-wrap');
    STAGE = el('div','gd-stage');
    SIDEBAR = el('div','gd-side');

    const toolbar = el('div','gd-toolbar');
    toolbar.innerHTML = `
      <button class="gd-tool active" id="gdToolUV" type="button">UV</button>
      <button class="gd-tool" id="gdToolSwab" type="button">Swab</button>
      <button class="gd-tool" id="gdToolCam" type="button">Camera</button>
      <button class="gd-tool" id="gdToolClean" type="button">Clean</button>
    `;
    STAGE.appendChild(toolbar);

    const timer = el('div','gd-timer');
    timer.id = 'gdTimerBox';
    timer.textContent = `เวลา ${STATE.timeLeft}s • score ${STATE.score}`;
    STAGE.appendChild(timer);

    const pMission = el('div','gd-panel');
    pMission.innerHTML = `
      <div class="hd">Mission</div>
      <div class="bd" id="gdMissionText">ใช้ UV → Swab → Camera → Clean เพื่อสืบสวนจุดเสี่ยง</div>
    `;
    const pEvidence = el('div','gd-panel');
    pEvidence.innerHTML = `
      <div class="hd">Evidence</div>
      <div class="bd"><div class="gd-list" id="gdEvidenceList"></div></div>
    `;
    const pStats = el('div','gd-panel');
    pStats.innerHTML = `
      <div class="hd">Stats</div>
      <div class="bd" id="gdStatsBox">scene=${cfg.scene} • diff=${cfg.diff} • run=${cfg.run}</div>
    `;

    SIDEBAR.appendChild(pMission);
    SIDEBAR.appendChild(pEvidence);
    SIDEBAR.appendChild(pStats);

    wrap.appendChild(STAGE);
    wrap.appendChild(SIDEBAR);
    ROOT.appendChild(wrap);

    END_OVERLAY = el('div','gd-end');
    END_OVERLAY.id = 'gdEndOverlay';
    END_OVERLAY.innerHTML = `
      <div class="gd-end-card">
        <div class="gd-end-title">สรุปผล — Germ Detective</div>
        <div class="gd-end-grid">
          <div class="gd-end-item"><span>Score</span><b id="gdSumScore">0</b></div>
          <div class="gd-end-item"><span>Cleaned</span><b id="gdSumCleaned">0</b></div>
          <div class="gd-end-item"><span>Infected Found</span><b id="gdSumFound">0</b></div>
          <div class="gd-end-item"><span>Accuracy</span><b id="gdSumAcc">0%</b></div>
        </div>
        <div class="gd-end-note" id="gdEndNote">—</div>
        <div class="gd-end-actions">
          <button class="gd-btn" id="gdBtnReplay" type="button">↻ Replay</button>
          <button class="gd-btn primary" id="gdBtnCooldown" type="button">➡ Go Cooldown</button>
          <button class="gd-btn" id="gdBtnHub" type="button">🏠 Back HUB</button>
        </div>
      </div>
    `;
    ROOT.appendChild(END_OVERLAY);

    $('gdToolUV').onclick = ()=> setTool('uv');
    $('gdToolSwab').onclick = ()=> setTool('swab');
    $('gdToolCam').onclick = ()=> setTool('cam');
    $('gdToolClean').onclick = ()=> setTool('clean');

    $('gdBtnReplay').onclick = ()=> replay();
    $('gdBtnHub').onclick = ()=> goHub();
    $('gdBtnCooldown').onclick = ()=>{
      emitHHAEvent('summary_action', { action:'cooldown', summary: STATE.summary || null });
      const btn = DOC.getElementById('btnCooldownTop');
      if(btn) btn.click();
    };
  }

  function goHub(){
    location.href = cfg.hub || '../hub.html';
  }

  function replay(){
    location.reload();
  }

  function setTool(t){
    STATE.tool = String(t || 'uv').toLowerCase();
    ['gdToolUV','gdToolSwab','gdToolCam','gdToolClean'].forEach(id=>{
      const btn = $(id);
      if(!btn) return;
      const map = { gdToolUV:'uv', gdToolSwab:'swab', gdToolCam:'cam', gdToolClean:'clean' };
      btn.classList.toggle('active', map[id] === STATE.tool);
    });
    emitHHAEvent('tool_change', { tool: STATE.tool });
  }

  function addEvidence(type, target, info){
    STATE.evidence.unshift({
      t: isoNow(),
      type, target, info
    });
    if(STATE.evidence.length > 12) STATE.evidence.length = 12;
    updateEvidenceUI();
  }

  function updateEvidenceUI(){
    const list = $('gdEvidenceList');
    if(!list) return;
    list.innerHTML = '';
    if(!STATE.evidence.length){
      const d = el('div','gd-item');
      d.textContent = 'ยังไม่มีหลักฐาน';
      list.appendChild(d);
      return;
    }
    STATE.evidence.forEach(e=>{
      const d = el('div','gd-item');
      d.textContent = `${e.type.toUpperCase()} • ${e.target} • ${e.info}`;
      list.appendChild(d);
    });
  }

  function updateHUD(){
    const t = $('gdTimerBox');
    if(t) t.textContent = `เวลา ${STATE.timeLeft}s • score ${STATE.score}`;
    const stats = $('gdStatsBox');
    if(stats){
      const scanned = STATE.hotspots.filter(h=>h.scanned).length;
      const cleaned = STATE.hotspots.filter(h=>h.cleaned).length;
      stats.textContent =
        `scene=${cfg.scene} • diff=${cfg.diff} • tool=${STATE.tool} • scanned=${scanned} • cleaned=${cleaned} • score=${STATE.score}`;
    }
  }

  function subText(h){
    const arr = [];
    if(h.scanned) arr.push('UV');
    if(h.swabbed) arr.push('SWAB');
    if(h.photographed) arr.push('CAM');
    if(h.cleaned) arr.push('CLEAN');
    return arr.length ? arr.join(' • ') : 'แตะเพื่อสืบสวน';
  }

  function renderHotspots(){
    STAGE.querySelectorAll('.gd-spot').forEach(n=>n.remove());
    STATE.hotspots.forEach(h=>{
      const d = el('div','gd-spot' + (h.risk >= 70 ? ' hot' : '') + (h.cleaned ? ' clean' : ''));
      d.dataset.id = h.id;
      d.style.left = `${h.x}%`;
      d.style.top = `${h.y}%`;
      d.innerHTML = `${h.name}<span class="sub">${subText(h)}</span>`;
      d.addEventListener('click', ()=> onHotspot(h, 'pointer'));
      STAGE.appendChild(d);
      h.el = d;
    });
  }

  function refreshSpot(h){
    if(!h || !h.el) return;
    h.el.className = 'gd-spot' + (h.risk >= 70 ? ' hot' : '') + (h.cleaned ? ' clean' : '');
    const sub = h.el.querySelector('.sub');
    if(sub) sub.textContent = subText(h);
  }

  function onHotspot(h, source='pointer'){
    if(!STATE.running || STATE.paused || STATE.ended) return;

    if(STATE.tool === 'uv'){
      h.scanned = true;
      addEvidence('hotspot', h.name, 'พบร่องรอยด้วย UV');
      scoreAdd(5, 'uv');
    }
    else if(STATE.tool === 'swab'){
      h.swabbed = true;
      if(h.infected){
        addEvidence('sample', h.name, 'Swab ยืนยันความเสี่ยง');
        scoreAdd(12, 'swab-confirm');
      }else{
        addEvidence('sample', h.name, 'Swab ไม่พบเชื้อ');
        scoreAdd(4, 'swab-clear');
      }
    }
    else if(STATE.tool === 'cam'){
      h.photographed = true;
      addEvidence('photo', h.name, 'ถ่ายภาพหลักฐาน');
      scoreAdd(6, 'camera');
    }
    else if(STATE.tool === 'clean'){
      h.cleaned = true;
      const before = h.risk;
      h.risk = clamp(h.risk - 25, 0, 100);
      addEvidence('clean', h.name, `ทำความสะอาด risk ${before}→${h.risk}`);
      scoreAdd(10, 'clean');
    }

    refreshSpot(h);
    updateHUD();

    emitHHAEvent('hotspot_action', {
      target: h.name,
      tool: STATE.tool,
      source,
      risk: h.risk
    });
  }

  function onShoot(ev){
    if(!STATE.running || STATE.paused || STATE.ended) return;
    const d = ev && ev.detail ? ev.detail : {};
    const x = Number(d.x), y = Number(d.y);
    const lockPx = clamp(Number(d.lockPx || 28), 8, 120);
    if(!Number.isFinite(x) || !Number.isFinite(y)) return;

    let best = null, bestD = 1e9;
    STATE.hotspots.forEach(h=>{
      if(!h.el) return;
      const r = h.el.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top + r.height/2;
      const dist = Math.hypot(cx-x, cy-y);
      if(dist < bestD){
        bestD = dist;
        best = h;
      }
    });

    if(best && bestD <= lockPx + 18){
      onHotspot(best, 'shoot');
    }else{
      emitHHAEvent('shoot_miss', { x, y, lockPx });
    }
  }

  function startLoops(){
    STATE.running = true;
    STATE.paused = false;
    STATE.ended = false;

    clearInterval(STATE.timer);
    STATE.timer = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;
      STATE.timeLeft = Math.max(0, STATE.timeLeft - 1);
      updateHUD();

      try{
        WIN.dispatchEvent(new CustomEvent('hha:features_1s', {
          detail:{
            game:'germ-detective',
            pid: cfg.pid,
            run: cfg.run,
            diff: cfg.diff,
            scene: cfg.scene,
            view: cfg.view,
            timeLeft: STATE.timeLeft,
            score: STATE.score,
            tool: STATE.tool,
            evidenceCount: STATE.evidence.length
          }
        }));
      }catch{}

      if(STATE.timeLeft <= 0){
        end('timeup');
      }
    }, 1000);
  }

  function buildSummary(reason='end'){
    const cleaned = STATE.hotspots.filter(h=>h.cleaned).length;
    const infectedTotal = STATE.hotspots.filter(h=>h.infected).length;
    const infectedFound = STATE.hotspots.filter(h=>h.infected && (h.swabbed || h.cleaned)).length;
    const scanned = STATE.hotspots.filter(h=>h.scanned).length;
    const actionsTotal = scanned + STATE.hotspots.filter(h=>h.swabbed).length + STATE.hotspots.filter(h=>h.photographed).length + cleaned;
    const accuracyPct = actionsTotal ? Math.round((infectedFound / Math.max(1, infectedTotal)) * 100) : 0;

    const grade =
      STATE.score >= 80 ? 'A' :
      STATE.score >= 55 ? 'B' :
      STATE.score >= 35 ? 'C' : 'D';

    const summaryText =
      `score=${STATE.score} • cleaned=${cleaned} • infectedFound=${infectedFound}/${infectedTotal} • accuracy=${accuracyPct}%`;

    return {
      game:'germ-detective',
      reason,
      scoreFinal: STATE.score,
      score: STATE.score,
      cleaned,
      infectedFound,
      infectedTotal,
      foundCount: infectedFound,
      missCount: Math.max(0, infectedTotal - infectedFound),
      dangerCount: STATE.hotspots.filter(h=>h.risk >= 70).length,
      scanned,
      accuracyPct,
      grade,
      summaryText,
      pid: cfg.pid,
      run: cfg.run,
      diff: cfg.diff,
      scene: cfg.scene,
      view: cfg.view,
      seed: cfg.seed,
      at: isoNow(),
      url: location.href
    };
  }

  function saveSummary(summary){
    try{
      localStorage.setItem('HHA_LAST_SUMMARY', JSON.stringify(summary));
      const key = 'HHA_SUMMARY_HISTORY';
      const arr = JSON.parse(localStorage.getItem(key) || '[]');
      arr.unshift(summary);
      while(arr.length > 30) arr.pop();
      localStorage.setItem(key, JSON.stringify(arr));
    }catch{}
  }

  function showEndOverlay(summary){
    if(!END_OVERLAY) return;
    $('gdSumScore').textContent = String(summary.scoreFinal || 0);
    $('gdSumCleaned').textContent = String(summary.cleaned || 0);
    $('gdSumFound').textContent = `${summary.infectedFound || 0}/${summary.infectedTotal || 0}`;
    $('gdSumAcc').textContent = `${summary.accuracyPct || 0}%`;

    const note = $('gdEndNote');
    if(note){
      note.textContent =
        `Grade ${summary.grade || '-'} • ${summary.summaryText || ''} • reason=${summary.reason || ''}`;
    }

    END_OVERLAY.classList.add('show');
  }

  function end(reason='end'){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.running = false;
    clearInterval(STATE.timer);

    const payload = buildSummary(reason);
    STATE.summary = payload;

    saveSummary(payload);

    emit('hha:end', payload);
    emitHHAEvent('session_end', payload);

    showEndOverlay(payload);
  }

  function init(){
    buildHotspots();
    buildUI();
    if(!ROOT || !STAGE) throw new Error('mount #app not found');

    if(cfg.view === 'cvr' || cfg.view === 'cardboard'){
      try{ DOC.documentElement.dataset.view = 'cvr'; }catch{}
    } else {
      try{ DOC.documentElement.dataset.view = cfg.view; }catch{}
    }

    renderHotspots();
    updateEvidenceUI();
    updateHUD();
    setTool('uv');
    startLoops();

    WIN.addEventListener('hha:shoot', onShoot, false);
    WIN.addEventListener('keydown', (e)=>{
      if(e.key === '1') setTool('uv');
      if(e.key === '2') setTool('swab');
      if(e.key === '3') setTool('cam');
      if(e.key === '4') setTool('clean');
      if(e.key === 'p' || e.key === 'P') STATE.paused = !STATE.paused;
    });

    emitHHAEvent('session_start', {
      game:'germ-detective',
      pid: cfg.pid,
      run: cfg.run,
      diff: cfg.diff,
      scene: cfg.scene,
      view: cfg.view,
      seed: cfg.seed,
      timeSec: cfg.timeSec
    });

    return api;
  }

  function pause(){ STATE.paused = true; }
  function resume(){ STATE.paused = false; }
  function stop(){
    STATE.running = false;
    STATE.paused = false;
    clearInterval(STATE.timer);
  }

  const api = {
    init,
    end,
    pause,
    resume,
    stop,
    getState: ()=>STATE,
    getSummary: ()=>STATE.summary,
    setTool
  };

  return api;
}
