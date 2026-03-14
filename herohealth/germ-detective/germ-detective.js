// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — core runtime (PC / Mobile / Cardboard cVR)
// PATCH A v20260314-GD-CASELOOP-PHASE-RISK-RANK
//
// เปลี่ยนจาก hotspot demo -> เกมสืบคดีเชื้อโรคแบบมี phase / risk / report

export default function GameApp(opts = {}) {
  'use strict';

  const WIN = window;
  const DOC = document;

  const cfg = Object.assign({
    mountId: 'app',
    timeSec: 180,
    seed: null,
    scene: 'classroom',
    difficulty: 'normal',
    view: 'pc',
    runMode: 'play',

    enableBuiltinUI: true,
    enableBuiltinHotspots: true,
    builtinTarget: null,
    useSceneRootIfPresent: true
  }, opts || {});

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

  // --------------------------------------------------
  // TEXT
  // --------------------------------------------------
  const TEXT = {
    phaseTitle: {
      search: 'Phase 1: Search',
      investigate: 'Phase 2: Investigate',
      action: 'Phase 3: Stop the Spread',
      report: 'Phase 4: Report'
    },
    phaseDesc: {
      search: 'ใช้ UV หา “จุดน่าสงสัย” ก่อน',
      investigate: 'ใช้ Swab / Camera เก็บหลักฐาน',
      action: 'Clean จุดเสี่ยงหลักเพื่อลดความเสี่ยงของพื้นที่',
      report: 'ส่งรายงานเมื่อหลักฐานครบและลด Risk ได้แล้ว'
    },
    coach: {
      start: 'เริ่มจากจุดที่หลายคนจับร่วมกันบ่อย ๆ',
      search: 'ส่อง UV หาเป้าหมายก่อน อย่าเสียเวลากับทุกจุด',
      investigate: 'ตอนนี้ต้องยืนยันหลักฐาน ใช้ Swab หรือ Camera กับจุดสำคัญ',
      action: 'รีบ Clean จุดเสี่ยงหลักก่อนหมดเวลา',
      report: 'ยอดเยี่ยม ส่งรายงานเพื่อปิดคดีได้เลย',
      lowTime: 'เวลาใกล้หมดแล้ว รีบลด Risk ของพื้นที่ก่อน',
      notReady: 'หลักฐานยังไม่พอหรือ Risk ยังสูงอยู่'
    }
  };

  // --------------------------------------------------
  // STATE
  // --------------------------------------------------
  const STATE = {
    running: false,
    paused: false,
    ended: false,

    startedAt: 0,
    timeLeft: Number(cfg.timeSec) || 180,
    timeTotal: Number(cfg.timeSec) || 180,

    phase: 'search', // search | investigate | action | report
    tool: 'uv',

    areaRisk: 100,
    targetRisk: 35,
    criticalTotal: 3,
    criticalFound: 0,
    investigatedCount: 0,
    cleanedCount: 0,
    evidenceScore: 0,
    reportSubmitted: false,

    score: 0,
    stars: 0,
    rank: 'D',

    evidence: [],
    hotspots: [],

    metrics: {
      clicks: 0,
      shots: 0,
      hits: 0,
      misses: 0,
      uvCount: 0,
      swabCount: 0,
      camCount: 0,
      cleanCount: 0,
      wrongTool: 0,
      falsePositives: 0,
      uniqueTargets: 0
    },

    resources: {
      uv: 8,
      swab: 5,
      cam: 6,
      clean: 4
    },

    _timerId: null,
    _tickId: null,
    lastFeatureEmitAt: 0
  };

  // --------------------------------------------------
  // CASE DATA
  // --------------------------------------------------
  const CASES = {
    classroom: [
      { name:'ลูกบิดประตู', critical:true, risk:26, preferred:['uv','swab','clean'] },
      { name:'โต๊ะนักเรียน A', critical:false, risk:10, preferred:['uv','cam'] },
      { name:'ก๊อกน้ำ', critical:true, risk:24, preferred:['uv','swab','clean'] },
      { name:'ราวบันได', critical:true, risk:22, preferred:['uv','cam','clean'] },
      { name:'สวิตช์ไฟ', critical:false, risk:9, preferred:['uv','cam'] },
      { name:'รีโมตแอร์', critical:false, risk:9, preferred:['uv','cam'] }
    ],
    home: [
      { name:'ลูกบิดห้องนอน', critical:true, risk:22, preferred:['uv','swab','clean'] },
      { name:'รีโมตทีวี', critical:true, risk:24, preferred:['uv','cam','clean'] },
      { name:'ก๊อกน้ำล้างมือ', critical:true, risk:26, preferred:['uv','swab','clean'] },
      { name:'โต๊ะกินข้าว', critical:false, risk:11, preferred:['uv','cam'] },
      { name:'มือถือส่วนกลาง', critical:false, risk:10, preferred:['uv','cam'] }
    ],
    canteen: [
      { name:'ถาดอาหาร', critical:true, risk:22, preferred:['uv','cam','clean'] },
      { name:'ช้อนกลาง', critical:true, risk:28, preferred:['uv','swab','clean'] },
      { name:'ราวคิวรับอาหาร', critical:true, risk:20, preferred:['uv','cam','clean'] },
      { name:'โต๊ะรวม', critical:false, risk:12, preferred:['uv','cam'] },
      { name:'ก๊อกน้ำดื่ม', critical:false, risk:11, preferred:['uv','cam'] }
    ]
  };

  const HOTSPOT_POS = {
    classroom: [
      { x:12, y:22 }, { x:32, y:35 }, { x:80, y:25 },
      { x:70, y:58 }, { x:9, y:48 }, { x:26, y:13 }
    ],
    home: [
      { x:16, y:22 }, { x:64, y:54 }, { x:82, y:28 },
      { x:47, y:36 }, { x:52, y:45 }
    ],
    canteen: [
      { x:38, y:28 }, { x:52, y:32 }, { x:70, y:26 },
      { x:44, y:56 }, { x:82, y:48 }
    ]
  };

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  function ensureBuiltinStyle(){
    if(!cfg.enableBuiltinUI) return;
    if(qs('gd-core-style')) return;

    const st = el('style');
    st.id = 'gd-core-style';
    st.textContent = `
      .gd-toolbar{
        position:fixed; left:12px; top:12px; z-index:1000;
        display:flex; flex-wrap:wrap; gap:6px; align-items:center;
        background:rgba(2,6,23,.76);
        border:1px solid rgba(148,163,184,.18);
        border-radius:14px;
        padding:8px;
        backdrop-filter: blur(10px);
        box-shadow:0 12px 30px rgba(0,0,0,.25);
        max-width:min(96vw,840px);
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
      .gd-badge{
        border:1px solid rgba(148,163,184,.18);
        border-radius:999px;
        padding:8px 10px;
        font:900 12px/1 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
        color:#e2e8f0;
        background:rgba(255,255,255,.03);
      }
      .gd-panel{
        position:fixed; right:12px; top:12px; z-index:1000;
        width:min(320px,92vw); max-height:70vh; overflow:auto;
        background:rgba(2,6,23,.76);
        border:1px solid rgba(148,163,184,.18);
        border-radius:14px; padding:10px;
        backdrop-filter: blur(10px);
        box-shadow:0 12px 30px rgba(0,0,0,.25);
      }
      .gd-panel h4{
        margin:0 0 8px;
        font:900 13px/1.2 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
      }
      .gd-card{
        padding:8px; margin-bottom:6px; border-radius:10px;
        background:rgba(255,255,255,.03);
        border:1px solid rgba(148,163,184,.14);
        color:rgba(241,245,249,.94);
        font-size:12px; line-height:1.3;
      }
      .gd-card small{ color:rgba(148,163,184,.95); display:block; margin-top:3px; }

      .gd-mission{
        position:fixed; left:12px; bottom:12px; z-index:1000;
        width:min(440px,92vw);
        background:rgba(2,6,23,.82);
        border:1px solid rgba(148,163,184,.18);
        border-radius:16px;
        padding:12px;
        box-shadow:0 14px 40px rgba(0,0,0,.30);
      }
      .gd-mission .title{
        font:1000 14px/1.2 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
        margin-bottom:6px;
      }
      .gd-mission .desc{
        color:#cbd5e1;
        font:800 12px/1.45 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
      }
      .gd-toast{
        position:fixed; left:50%; bottom:16px; transform:translateX(-50%);
        z-index:1200;
        background:rgba(2,6,23,.88);
        color:#f8fafc;
        border:1px solid rgba(148,163,184,.18);
        border-radius:999px;
        padding:10px 14px;
        font:900 13px/1 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
        opacity:0; pointer-events:none; transition:opacity .18s ease;
        max-width:92vw;
      }
      .gd-toast.show{ opacity:1; }

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
      .gd-spot.is-sus{ border-color: rgba(34,211,238,.34); box-shadow:0 0 16px rgba(34,211,238,.18); }
      .gd-spot.is-confirmed{ border-color: rgba(251,191,36,.38); box-shadow:0 0 16px rgba(251,191,36,.18); }
      .gd-spot.is-cleaned{ border-color: rgba(34,197,94,.38); box-shadow:0 0 16px rgba(34,197,94,.18); opacity:.82; }
      html[data-view="cvr"] .gd-spot{ pointer-events:none; }
    `;
    DOC.head.appendChild(st);
  }

  let toastT = 0;
  function toast(msg){
    const t = qs('gdToast');
    if(!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(()=> t.classList.remove('show'), 1200);
  }

  function buildBuiltinUI(){
    if(!cfg.enableBuiltinUI) return;
    ensureBuiltinStyle();

    if(!qs('gdToolbar')){
      const toolbar = el('div');
      toolbar.id = 'gdToolbar';
      toolbar.className = 'gd-toolbar';

      const mkBtn = (id, txt, onclick)=>{
        const b = el('button', 'gd-btn');
        b.id = id;
        b.type = 'button';
        b.textContent = txt;
        b.onclick = onclick;
        return b;
      };

      toolbar.appendChild(mkBtn('gdBtnUV','UV', ()=> setTool('uv')));
      toolbar.appendChild(mkBtn('gdBtnSwab','Swab', ()=> setTool('swab')));
      toolbar.appendChild(mkBtn('gdBtnCam','Camera', ()=> setTool('cam')));
      toolbar.appendChild(mkBtn('gdBtnClean','Clean', ()=> setTool('clean')));
      toolbar.appendChild(mkBtn('gdBtnReport','ส่งรายงาน', ()=> submitReport()));

      const badgeTime = el('div','gd-badge'); badgeTime.id='gdBadgeTime';
      const badgeRisk = el('div','gd-badge'); badgeRisk.id='gdBadgeRisk';
      const badgeCrit = el('div','gd-badge'); badgeCrit.id='gdBadgeCrit';
      const badgeScore = el('div','gd-badge'); badgeScore.id='gdBadgeScore';

      toolbar.appendChild(badgeTime);
      toolbar.appendChild(badgeRisk);
      toolbar.appendChild(badgeCrit);
      toolbar.appendChild(badgeScore);

      DOC.body.appendChild(toolbar);
    }

    if(!qs('gdPanel')){
      const p = el('div','gd-panel');
      p.id = 'gdPanel';
      p.innerHTML = `
        <h4>หลักฐาน / สถานะคดี</h4>
        <div id="gdEvidenceList"></div>
      `;
      DOC.body.appendChild(p);
    }

    if(!qs('gdMission')){
      const m = el('div','gd-mission');
      m.id = 'gdMission';
      m.innerHTML = `
        <div class="title" id="gdMissionTitle">ภารกิจ</div>
        <div class="desc" id="gdMissionDesc">เริ่มสืบคดี</div>
        <div class="desc" id="gdCoachLine" style="margin-top:8px;color:#93c5fd;"></div>
      `;
      DOC.body.appendChild(m);
    }

    if(!qs('gdToast')){
      const t = el('div','gd-toast');
      t.id = 'gdToast';
      DOC.body.appendChild(t);
    }

    refreshBuiltinToolUI();
    updateHUD();
    updateMission();
  }

  function refreshBuiltinToolUI(){
    const map = { uv:'gdBtnUV', swab:'gdBtnSwab', cam:'gdBtnCam', clean:'gdBtnClean' };
    ['uv','swab','cam','clean'].forEach(t=>{
      const b = qs(map[t]);
      if(!b) return;
      b.classList.toggle('active', STATE.tool === t);
    });
  }

  function updateHUD(){
    const t = qs('gdBadgeTime');
    const r = qs('gdBadgeRisk');
    const c = qs('gdBadgeCrit');
    const s = qs('gdBadgeScore');

    if(t) t.textContent = `เวลา ${Math.max(0, STATE.timeLeft)}s`;
    if(r) r.textContent = `Risk ${STATE.areaRisk}%`;
    if(c) c.textContent = `Critical ${STATE.criticalFound}/${STATE.criticalTotal}`;
    if(s) s.textContent = `Score ${STATE.score}`;
  }

  function updateMission(){
    const title = qs('gdMissionTitle');
    const desc = qs('gdMissionDesc');
    const coach = qs('gdCoachLine');
    if(title) title.textContent = TEXT.phaseTitle[STATE.phase] || 'ภารกิจ';
    if(desc) desc.textContent = TEXT.phaseDesc[STATE.phase] || '';
    if(coach){
      if(STATE.phase === 'search') coach.textContent = TEXT.coach.search;
      else if(STATE.phase === 'investigate') coach.textContent = TEXT.coach.investigate;
      else if(STATE.phase === 'action') coach.textContent = TEXT.coach.action;
      else if(STATE.phase === 'report') coach.textContent = TEXT.coach.report;
    }
  }

  // --------------------------------------------------
  // HOTSPOTS
  // --------------------------------------------------
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

    root.querySelectorAll('.gd-spot').forEach(n=> n.remove());
    STATE.hotspots.length = 0;

    const defs = CASES[cfg.scene] || CASES.classroom;
    const poses = HOTSPOT_POS[cfg.scene] || HOTSPOT_POS.classroom;

    defs.forEach((src, i)=>{
      const pos = poses[i] || { x: 18 + i*8, y: 20 + i*7 };
      const d = el('button','gd-spot');
      d.type = 'button';
      d.textContent = src.name;
      d.style.left = `calc(${pos.x}% - 42px)`;
      d.style.top  = `calc(${pos.y}% - 18px)`;
      d.dataset.idx = String(i);

      d.addEventListener('click', ()=>{
        STATE.metrics.clicks++;
        onHotspotInteract(i, { source:'pointer' });
      }, { passive:true });

      const cs = WIN.getComputedStyle(root);
      if(cs.position === 'static') root.style.position = 'relative';

      root.appendChild(d);

      STATE.hotspots.push({
        id: i,
        name: src.name,
        el: d,
        critical: !!src.critical,
        risk: Number(src.risk || 10),
        preferred: Array.isArray(src.preferred) ? src.preferred.slice() : ['uv'],

        suspicious: false,
        investigated: false,
        photographed: false,
        cleaned: false,

        stats: { uv:0, swab:0, cam:0, clean:0 }
      });
    });

    STATE.criticalTotal = STATE.hotspots.filter(h=>h.critical).length;
  }

  function addEvidence(rec){
    const item = Object.assign({}, rec, { t: rec?.t || new Date().toISOString() });
    STATE.evidence.push(item);
    STATE.metrics.uniqueTargets = new Set(STATE.evidence.map(e=>e.target)).size;

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
  }

  function consumeResource(tool){
    if(!(tool in STATE.resources)) return true;
    if(STATE.resources[tool] <= 0){
      toast(`ไม่มี ${tool.toUpperCase()} แล้ว`);
      emitHHAEvent('resource_empty', { tool });
      return false;
    }
    STATE.resources[tool]--;
    return true;
  }

  function setTool(t){
    const tool = String(t || '').toLowerCase();
    if(!['uv','swab','cam','clean'].includes(tool)) return;
    STATE.tool = tool;
    refreshBuiltinToolUI();
    emit('gd:toolchange', { tool });
    emitHHAEvent('tool_change', { tool });
  }

  function changePhase(next){
    if(STATE.phase === next) return;
    STATE.phase = next;
    updateMission();
    toast(TEXT.phaseTitle[next] || 'ภารกิจใหม่');
    emitHHAEvent('phase_change', { phase: next });
  }

  function scoreDelta(v){
    STATE.score += Number(v || 0);
    if(STATE.score < 0) STATE.score = 0;
  }

  function lowerRisk(v){
    STATE.areaRisk = clamp(STATE.areaRisk - Number(v || 0), 0, 100);
    updateHUD();
  }

  function evaluateProgress(){
    const suspiciousCount = STATE.hotspots.filter(h => h.suspicious).length;
    const investigatedCritical = STATE.hotspots.filter(h => h.critical && h.investigated).length;
    const cleanedCritical = STATE.hotspots.filter(h => h.critical && h.cleaned).length;

    STATE.criticalFound = investigatedCritical;

    if(STATE.phase === 'search' && suspiciousCount >= 2){
      changePhase('investigate');
    }

    if(STATE.phase === 'investigate' && investigatedCritical >= Math.max(2, STATE.criticalTotal - 1)){
      changePhase('action');
    }

    if(STATE.phase === 'action' && STATE.areaRisk <= STATE.targetRisk && cleanedCritical >= Math.max(2, STATE.criticalTotal - 1)){
      changePhase('report');
    }

    updateHUD();
  }

  function hotspotToast(h, msg){
    toast(`${h.name}: ${msg}`);
  }

  function markSpotVisual(h){
    if(!h?.el) return;
    h.el.classList.toggle('is-sus', !!h.suspicious);
    h.el.classList.toggle('is-confirmed', !!h.investigated);
    h.el.classList.toggle('is-cleaned', !!h.cleaned);
  }

  function onHotspotInteract(id, meta = {}){
    if(!STATE.running || STATE.paused || STATE.ended) return;
    const h = STATE.hotspots[id];
    if(!h) return;

    const tool = STATE.tool;

    if(!consumeResource(tool)) return;

    if(tool === 'uv'){
      STATE.metrics.uvCount++;
      h.stats.uv++;

      if(h.preferred.includes('uv')){
        if(!h.suspicious){
          h.suspicious = true;
          scoreDelta(h.critical ? 18 : 8);
          addEvidence({ type:'scan', target:h.name, info:h.critical ? 'พบร่องรอยเสี่ยงสูง' : 'พบจุดน่าสงสัย' });
          hotspotToast(h, h.critical ? 'จุดนี้เสี่ยงมาก' : 'จุดนี้น่าสงสัย');
        } else {
          scoreDelta(2);
          hotspotToast(h, 'ยืนยันว่าจุดนี้น่าสงสัย');
        }
      } else {
        STATE.metrics.falsePositives++;
        scoreDelta(-2);
        hotspotToast(h, 'จุดนี้ยังไม่ใช่เป้าหมายหลัก');
      }
    }

    else if(tool === 'swab'){
      STATE.metrics.swabCount++;
      h.stats.swab++;

      if(STATE.phase === 'search'){
        STATE.metrics.wrongTool++;
        scoreDelta(-3);
        hotspotToast(h, 'ควรหาเป้าหมายก่อน แล้วค่อยเก็บตัวอย่าง');
      } else if(h.suspicious && !h.investigated){
        h.investigated = true;
        STATE.investigatedCount++;
        scoreDelta(h.critical ? 26 : 10);
        addEvidence({ type:'sample', target:h.name, info:h.critical ? 'ยืนยันแหล่งเสี่ยงหลัก' : 'เก็บตัวอย่างแล้ว' });
        hotspotToast(h, h.critical ? 'ยืนยันจุดเสี่ยงหลักสำเร็จ' : 'เก็บหลักฐานเพิ่มแล้ว');
      } else {
        STATE.metrics.falsePositives++;
        scoreDelta(-2);
        hotspotToast(h, 'ยังไม่มีหลักฐานพอสำหรับจุดนี้');
      }
    }

    else if(tool === 'cam'){
      STATE.metrics.camCount++;
      h.stats.cam++;

      if(h.suspicious){
        if(!h.photographed){
          h.photographed = true;
          scoreDelta(h.critical ? 14 : 6);
          addEvidence({ type:'photo', target:h.name, info:'บันทึกภาพหลักฐาน' });
          hotspotToast(h, 'บันทึกภาพหลักฐานแล้ว');
        } else {
          scoreDelta(1);
          hotspotToast(h, 'มีภาพหลักฐานของจุดนี้แล้ว');
        }
      } else {
        STATE.metrics.falsePositives++;
        scoreDelta(-1);
        hotspotToast(h, 'ควรสแกนหาเป้าหมายก่อนถ่ายรูป');
      }
    }

    else if(tool === 'clean'){
      STATE.metrics.cleanCount++;
      h.stats.clean++;

      if(STATE.phase !== 'action' && STATE.phase !== 'report'){
        STATE.metrics.wrongTool++;
        scoreDelta(-3);
        hotspotToast(h, 'ยังไม่ถึงขั้น Clean');
      } else if(h.investigated && !h.cleaned){
        h.cleaned = true;
        STATE.cleanedCount++;
        lowerRisk(h.critical ? h.risk : Math.ceil(h.risk * 0.6));
        scoreDelta(h.critical ? 28 : 12);
        addEvidence({ type:'clean', target:h.name, info:h.critical ? 'ลดความเสี่ยงของจุดหลักแล้ว' : 'ทำความสะอาดแล้ว' });
        hotspotToast(h, h.critical ? 'ลดความเสี่ยงของจุดหลักแล้ว' : 'พื้นที่ปลอดภัยขึ้น');
      } else if(h.cleaned){
        scoreDelta(-1);
        hotspotToast(h, 'จุดนี้สะอาดแล้ว');
      } else {
        STATE.metrics.wrongTool++;
        scoreDelta(-2);
        hotspotToast(h, 'ควรยืนยันหลักฐานก่อน Clean');
      }
    }

    markSpotVisual(h);
    evaluateProgress();
  }

  // --------------------------------------------------
  // SHOOT SUPPORT
  // --------------------------------------------------
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
      emitHHAEvent('shoot_miss', { x, y, lockPx, source: d.source || 'shoot', view: d.view || cfg.view });
      return;
    }

    STATE.metrics.hits++;
    onHotspotInteract(hit.id, { source: d.source || 'shoot', via: 'hha:shoot' });
  }

  // --------------------------------------------------
  // SUMMARY / REPORT
  // --------------------------------------------------
  function computeStars(){
    let stars = 1;
    if(STATE.areaRisk <= 60) stars = 2;
    if(STATE.areaRisk <= 40 && STATE.criticalFound >= Math.max(2, STATE.criticalTotal - 1)) stars = 3;
    if(STATE.areaRisk <= 25 && STATE.timeLeft >= 20) stars = 4;
    if(STATE.areaRisk <= 15 && STATE.metrics.wrongTool <= 2) stars = 5;
    return stars;
  }

  function computeRank(){
    const riskDown = 100 - STATE.areaRisk;
    const ratio = STATE.criticalTotal > 0 ? (STATE.criticalFound / STATE.criticalTotal) : 0;
    const score = STATE.score;

    if(score >= 220 && riskDown >= 70 && ratio >= 0.9) return 'S';
    if(score >= 170 && riskDown >= 55 && ratio >= 0.75) return 'A';
    if(score >= 120 && riskDown >= 35 && ratio >= 0.5) return 'B';
    if(score >= 70) return 'C';
    return 'D';
  }

  function buildSummary(){
    STATE.stars = computeStars();
    STATE.rank = computeRank();

    return {
      game: 'germ-detective',
      scene: cfg.scene,
      phaseFinal: STATE.phase,
      scoreFinal: STATE.score,
      stars: STATE.stars,
      rank: STATE.rank,
      timeLeft: STATE.timeLeft,
      areaRisk: STATE.areaRisk,
      riskDown: 100 - STATE.areaRisk,
      criticalFound: STATE.criticalFound,
      criticalTotal: STATE.criticalTotal,
      investigatedCount: STATE.investigatedCount,
      cleanedCount: STATE.cleanedCount,
      evidenceCount: STATE.evidence.length,
      reportSubmitted: STATE.reportSubmitted,
      metrics: Object.assign({}, STATE.metrics)
    };
  }

  function submitReport(){
    if(STATE.ended) return;
    if(STATE.phase !== 'report'){
      toast(TEXT.coach.notReady);
      emitHHAEvent('report_blocked', { phase: STATE.phase, risk: STATE.areaRisk, criticalFound: STATE.criticalFound });
      return null;
    }

    STATE.reportSubmitted = true;
    const summary = buildSummary();

    addEvidence({
      type:'report',
      target:'Case Report',
      info:`Risk ${summary.areaRisk}% • Critical ${summary.criticalFound}/${summary.criticalTotal} • Rank ${summary.rank}`
    });

    emit('hha:labels', { type:'report_submitted', payload: summary });
    emitHHAEvent('report_submitted', summary);

    toast(`ส่งรายงานแล้ว • Rank ${summary.rank}`);
    end('report_submitted');

    return summary;
  }

  // --------------------------------------------------
  // FEATURES / END
  // --------------------------------------------------
  function emitFeatures(){
    const feat = {
      game: 'germ-detective',
      timeLeft: STATE.timeLeft,
      phase: STATE.phase,
      areaRisk: STATE.areaRisk,
      targetRisk: STATE.targetRisk,
      criticalFound: STATE.criticalFound,
      criticalTotal: STATE.criticalTotal,
      investigatedCount: STATE.investigatedCount,
      cleanedCount: STATE.cleanedCount,
      evidenceCount: STATE.evidence.length,
      score: STATE.score,
      stars: STATE.stars,
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

  function end(reason='end'){
    if(STATE.ended) return;
    STATE.ended = true;
    STATE.running = false;

    clearInterval(STATE._timerId);
    clearInterval(STATE._tickId);

    const payload = Object.assign(buildSummary(), { reason });

    try{
      if(WIN.PlateSafe && typeof WIN.PlateSafe.end === 'function'){
        WIN.PlateSafe.end(reason);
      } else {
        emit('hha:end', payload);
      }
    }catch{
      emit('hha:end', payload);
    }

    emit('hha:labels', { type:'end', payload });
    emitHHAEvent('session_end', payload);

    if(cfg.enableBuiltinUI){
      setTimeout(()=>{
        alert(
          `ภารกิจจบแล้ว\n\n` +
          `Rank: ${payload.rank}\n` +
          `Stars: ${payload.stars}\n` +
          `Risk เหลือ: ${payload.areaRisk}%\n` +
          `Critical: ${payload.criticalFound}/${payload.criticalTotal}\n` +
          `Score: ${payload.scoreFinal}`
        );
      }, 40);
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

  function startTimer(){
    clearInterval(STATE._timerId);
    STATE.timeLeft = clamp(cfg.timeSec, 1, 3600);
    updateHUD();

    STATE._timerId = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;

      STATE.timeLeft = Math.max(0, STATE.timeLeft - 1);
      updateHUD();
      emitFeatures();

      if(STATE.timeLeft === 25){
        toast(TEXT.coach.lowTime);
      }

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

  // --------------------------------------------------
  // INPUT
  // --------------------------------------------------
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
      if(e.key === '4') setTool('clean');
      if(e.key === 'p' || e.key === 'P'){
        if(STATE.paused) resume(); else pause();
      }
      if(e.key === 'r' || e.key === 'R'){
        submitReport();
      }
    }, false);

    WIN.addEventListener('hha:shoot', onShoot, false);
  }

  // --------------------------------------------------
  // INIT
  // --------------------------------------------------
  function init(){
    if(STATE.running || STATE.ended) return api;

    const diff = String(cfg.difficulty || 'normal').toLowerCase();
    if(diff === 'easy'){
      STATE.resources = { uv:9, swab:6, cam:7, clean:5 };
      STATE.targetRisk = 40;
    } else if(diff === 'hard'){
      STATE.resources = { uv:7, swab:4, cam:5, clean:3 };
      STATE.targetRisk = 28;
    } else {
      STATE.resources = { uv:8, swab:5, cam:6, clean:4 };
      STATE.targetRisk = 35;
    }

    if(cfg.enableBuiltinUI) buildBuiltinUI();
    if(cfg.enableBuiltinHotspots) createHotspots();

    setTool('uv');
    wireInput();

    STATE.running = true;
    STATE.paused = false;
    STATE.ended = false;
    STATE.phase = 'search';
    STATE.score = 0;
    STATE.areaRisk = 100;
    STATE.criticalFound = 0;
    STATE.investigatedCount = 0;
    STATE.cleanedCount = 0;
    STATE.startedAt = now();

    startTimer();
    startFeatureTick();
    updateHUD();
    updateMission();
    toast('ภารกิจเริ่มแล้ว');
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
    createHotspots,
    emitFeatures,
    onHotspotInteract
  };

  return api;
}