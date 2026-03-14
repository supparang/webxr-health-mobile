// === /herohealth/germ-detective/germ-detective.js ===
// Germ Detective — core runtime
// FULL PATCH v20260314-GD-CORE-MATCH-RUNPAGE
//
// Match with:
// /herohealth/germ-detective/germ-detective-vr.html
//
// Core loop:
// search -> investigate -> action -> report

export default function GameApp(opts = {}) {
  'use strict';

  const WIN = window;
  const DOC = document;

  const cfg = Object.assign({
    mountId: 'scene',
    timeSec: 180,
    seed: null,
    scene: 'classroom',
    difficulty: 'normal',
    view: 'pc',
    runMode: 'play',

    enableBuiltinUI: false,
    enableBuiltinHotspots: true,
    builtinTarget: null,
    useSceneRootIfPresent: true
  }, opts || {});

  // --------------------------------------------------
  // utils
  // --------------------------------------------------
  const now = () =>
    (WIN.performance && typeof WIN.performance.now === 'function')
      ? WIN.performance.now()
      : Date.now();

  function qs(id){ return DOC.getElementById(id); }

  function el(tag='div', cls=''){
    const n = DOC.createElement(tag);
    if(cls) n.className = cls;
    return n;
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
    emit('hha:event', { name, payload: payload || {} });
  }

  function emitFeatures(){
    emit('hha:features_1s', {
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
      rank: STATE.rank,
      running: STATE.running,
      paused: STATE.paused,
      view: cfg.view,
      runMode: cfg.runMode,
      difficulty: cfg.difficulty,
      metrics: Object.assign({}, STATE.metrics),
      resources: Object.assign({}, STATE.resources)
    });
  }

  // --------------------------------------------------
  // data
  // --------------------------------------------------
  const CASES = {
    classroom: [
      { name:'ลูกบิดประตู', critical:true,  risk:26, preferred:['uv','swab','clean'] },
      { name:'โต๊ะนักเรียน A', critical:false, risk:10, preferred:['uv','cam'] },
      { name:'ก๊อกน้ำ', critical:true, risk:24, preferred:['uv','swab','clean'] },
      { name:'ราวบันได', critical:true, risk:22, preferred:['uv','cam','clean'] },
      { name:'สวิตช์ไฟ', critical:false, risk:8, preferred:['uv','cam'] },
      { name:'รีโมตแอร์', critical:false, risk:10, preferred:['uv','cam'] }
    ],
    home: [
      { name:'ลูกบิดห้องนอน', critical:true, risk:22, preferred:['uv','swab','clean'] },
      { name:'รีโมตทีวี', critical:true, risk:24, preferred:['uv','cam','clean'] },
      { name:'ก๊อกน้ำล้างมือ', critical:true, risk:26, preferred:['uv','swab','clean'] },
      { name:'โต๊ะกินข้าว', critical:false, risk:12, preferred:['uv','cam'] },
      { name:'มือถือส่วนกลาง', critical:false, risk:11, preferred:['uv','cam'] }
    ],
    canteen: [
      { name:'ถาดอาหาร', critical:true, risk:22, preferred:['uv','cam','clean'] },
      { name:'ช้อนกลาง', critical:true, risk:28, preferred:['uv','swab','clean'] },
      { name:'ราวคิวรับอาหาร', critical:true, risk:20, preferred:['uv','cam','clean'] },
      { name:'โต๊ะรวม', critical:false, risk:12, preferred:['uv','cam'] },
      { name:'ก๊อกน้ำดื่ม', critical:false, risk:11, preferred:['uv','cam'] }
    ]
  };

  const POSITIONS = {
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
  // state
  // --------------------------------------------------
  const STATE = {
    running: false,
    paused: false,
    ended: false,

    startedAt: 0,
    timeLeft: Number(cfg.timeSec) || 180,
    timeTotal: Number(cfg.timeSec) || 180,

    phase: 'search',
    tool: 'uv',

    areaRisk: 100,
    targetRisk: 35,
    criticalTotal: 3,
    criticalFound: 0,
    investigatedCount: 0,
    cleanedCount: 0,
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
  // helpers
  // --------------------------------------------------
  function setTool(t){
    const tool = String(t || '').toLowerCase();
    if(!['uv','swab','cam','clean'].includes(tool)) return;
    STATE.tool = tool;
    emit('gd:toolchange', { tool });
    emitHHAEvent('tool_change', { tool });
  }

  function scoreDelta(v){
    STATE.score += Number(v || 0);
    if(STATE.score < 0) STATE.score = 0;
  }

  function lowerRisk(v){
    STATE.areaRisk = clamp(STATE.areaRisk - Number(v || 0), 0, 100);
  }

  function addEvidence(rec){
    const item = Object.assign({}, rec, {
      t: rec?.t || new Date().toISOString()
    });
    STATE.evidence.push(item);
    STATE.metrics.uniqueTargets = new Set(STATE.evidence.map(e => e.target)).size;
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

  function getBuiltinRoot(){
    if(cfg.builtinTarget && cfg.builtinTarget.nodeType === 1) return cfg.builtinTarget;
    if(cfg.useSceneRootIfPresent && WIN.__GD_SCENE_ROOT__ && WIN.__GD_SCENE_ROOT__.nodeType === 1){
      return WIN.__GD_SCENE_ROOT__;
    }
    return qs(cfg.mountId) || DOC.body;
  }

  function markSpotVisual(h){
    if(!h?.el) return;
    h.el.classList.toggle('is-sus', !!h.suspicious);
    h.el.classList.toggle('is-confirmed', !!h.investigated);
    h.el.classList.toggle('is-cleaned', !!h.cleaned);
  }

  function changePhase(next){
    if(STATE.phase === next) return;
    STATE.phase = next;
    emitHHAEvent('phase_change', { phase: next });
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

    if(
      STATE.phase === 'action' &&
      STATE.areaRisk <= STATE.targetRisk &&
      cleanedCritical >= Math.max(2, STATE.criticalTotal - 1)
    ){
      changePhase('report');
    }
  }

  // --------------------------------------------------
  // hotspots
  // --------------------------------------------------
  function createHotspots(){
    if(!cfg.enableBuiltinHotspots) return;

    const root = getBuiltinRoot();
    if(!root) return;

    root.querySelectorAll('.gd-spot').forEach(n => n.remove());
    STATE.hotspots.length = 0;

    const defs = CASES[cfg.scene] || CASES.classroom;
    const poses = POSITIONS[cfg.scene] || POSITIONS.classroom;

    defs.forEach((src, i)=>{
      const pos = poses[i] || { x: 20 + i*8, y: 20 + i*7 };

      const d = el('button','gd-spot');
      d.type = 'button';
      d.textContent = src.name;
      d.style.position = 'absolute';
      d.style.left = `calc(${pos.x}% - 42px)`;
      d.style.top  = `calc(${pos.y}% - 18px)`;
      d.style.zIndex = '10';
      d.style.padding = '10px 12px';
      d.style.borderRadius = '10px';
      d.style.border = '1px solid rgba(148,163,184,.18)';
      d.style.background = 'rgba(255,255,255,.04)';
      d.style.color = 'rgba(241,245,249,.96)';
      d.style.font = '800 12px/1 system-ui,-apple-system,"Noto Sans Thai",sans-serif';
      d.style.boxShadow = '0 10px 24px rgba(0,0,0,.16)';
      d.style.cursor = 'pointer';

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

  // --------------------------------------------------
  // interaction
  // --------------------------------------------------
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
          addEvidence({
            type:'scan',
            target:h.name,
            info:h.critical ? 'พบร่องรอยเสี่ยงสูง' : 'พบจุดน่าสงสัย',
            source: meta.source || 'pointer'
          });
        } else {
          scoreDelta(2);
        }
      } else {
        STATE.metrics.falsePositives++;
        scoreDelta(-2);
      }
    }

    else if(tool === 'swab'){
      STATE.metrics.swabCount++;
      h.stats.swab++;

      if(STATE.phase === 'search'){
        STATE.metrics.wrongTool++;
        scoreDelta(-3);
      } else if(h.suspicious && !h.investigated){
        h.investigated = true;
        STATE.investigatedCount++;
        scoreDelta(h.critical ? 26 : 10);
        addEvidence({
          type:'sample',
          target:h.name,
          info:h.critical ? 'ยืนยันแหล่งเสี่ยงหลัก' : 'เก็บตัวอย่างแล้ว',
          source: meta.source || 'pointer'
        });
      } else {
        STATE.metrics.falsePositives++;
        scoreDelta(-2);
      }
    }

    else if(tool === 'cam'){
      STATE.metrics.camCount++;
      h.stats.cam++;

      if(h.suspicious){
        if(!h.photographed){
          h.photographed = true;
          scoreDelta(h.critical ? 14 : 6);
          addEvidence({
            type:'photo',
            target:h.name,
            info:'บันทึกภาพหลักฐาน',
            source: meta.source || 'pointer'
          });
        } else {
          scoreDelta(1);
        }
      } else {
        STATE.metrics.falsePositives++;
        scoreDelta(-1);
      }
    }

    else if(tool === 'clean'){
      STATE.metrics.cleanCount++;
      h.stats.clean++;

      if(STATE.phase !== 'action' && STATE.phase !== 'report'){
        STATE.metrics.wrongTool++;
        scoreDelta(-3);
      } else if(h.investigated && !h.cleaned){
        h.cleaned = true;
        STATE.cleanedCount++;
        lowerRisk(h.critical ? h.risk : Math.ceil(h.risk * 0.6));
        scoreDelta(h.critical ? 28 : 12);
        addEvidence({
          type:'clean',
          target:h.name,
          info:h.critical ? 'ลดความเสี่ยงของจุดหลักแล้ว' : 'ทำความสะอาดแล้ว',
          source: meta.source || 'pointer'
        });
      } else if(h.cleaned){
        scoreDelta(-1);
      } else {
        STATE.metrics.wrongTool++;
        scoreDelta(-2);
      }
    }

    markSpotVisual(h);
    evaluateProgress();
  }

  // --------------------------------------------------
  // shoot support
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
    const d = ev?.detail || {};
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
    onHotspotInteract(hit.id, {
      source: d.source || 'shoot',
      via: 'hha:shoot'
    });
  }

  // --------------------------------------------------
  // scoring
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

  // --------------------------------------------------
  // report / end
  // --------------------------------------------------
  function submitReport(){
    if(STATE.ended) return null;

    if(STATE.phase !== 'report'){
      emitHHAEvent('report_blocked', {
        phase: STATE.phase,
        risk: STATE.areaRisk,
        criticalFound: STATE.criticalFound
      });
      return null;
    }

    STATE.reportSubmitted = true;
    const summary = buildSummary();

    addEvidence({
      type:'report',
      target:'Case Report',
      info:`Risk ${summary.areaRisk}% • Critical ${summary.criticalFound}/${summary.criticalTotal} • Rank ${summary.rank}`
    });

    emitHHAEvent('report_submitted', summary);
    end('report_submitted');

    return summary;
  }

  function end(reason='end'){
    if(STATE.ended) return null;

    STATE.ended = true;
    STATE.running = false;

    clearInterval(STATE._timerId);
    clearInterval(STATE._tickId);

    const payload = Object.assign(buildSummary(), { reason });
    emit('hha:end', payload);
    emitHHAEvent('session_end', payload);

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

  // --------------------------------------------------
  // loop
  // --------------------------------------------------
  function startTimer(){
    clearInterval(STATE._timerId);
    STATE.timeLeft = clamp(cfg.timeSec, 1, 3600);

    STATE._timerId = setInterval(()=>{
      if(!STATE.running || STATE.paused || STATE.ended) return;

      STATE.timeLeft = Math.max(0, STATE.timeLeft - 1);
      emitFeatures();

      if(STATE.timeLeft === 25){
        emitHHAEvent('time_warning', { timeLeft: STATE.timeLeft });
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
  // input wiring
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
      if(e.key === 'r' || e.key === 'R') submitReport();
      if(e.key === 'p' || e.key === 'P'){
        if(STATE.paused) resume(); else pause();
      }
    }, false);

    WIN.addEventListener('hha:shoot', onShoot, false);
  }

  // --------------------------------------------------
  // init
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

    STATE.running = true;
    STATE.paused = false;
    STATE.ended = false;
    STATE.startedAt = now();

    STATE.phase = 'search';
    STATE.tool = 'uv';
    STATE.areaRisk = 100;
    STATE.criticalFound = 0;
    STATE.investigatedCount = 0;
    STATE.cleanedCount = 0;
    STATE.reportSubmitted = false;
    STATE.score = 0;
    STATE.stars = 0;
    STATE.rank = 'D';
    STATE.evidence = [];
    STATE.hotspots = [];

    STATE.metrics = {
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
    };

    createHotspots();
    wireInput();
    setTool('uv');

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

    emitFeatures();
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