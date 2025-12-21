// === /herohealth/plate/plate.safe.js ===
// HeroHealth — Balanced Plate VR (PRODUCTION)
// ✅ FIX: ไม่ import initCloudLogger จาก IIFE (ใช้ window.HHACloudLogger.init)
// ✅ GoodJunk-style "VR feel": drag-to-look (mouse/touch) + tap-anywhere = ยิง (tap-up) แต่ลากไม่ยิง
// ✅ ยิงด้วย gaze/fuse ได้ (cursor raycaster + click on entity)
// ✅ MISS = โดนขยะเท่านั้น (ของหายเองไม่เพิ่ม miss)
// ✅ Goal 2 + Mini chain 3 (พร้อม end summary + grade SSS/SS/S/A/B/C)
// ✅ FX: ใช้ Particles (IIFE) ถ้ามี — scorePop/burstAt/celebrate

'use strict';

// mode-factory เป็น optional ถ้าคุณมีอยู่แล้วก็ใช้ได้
let factoryBoot = null;
try {
  // eslint-disable-next-line import/no-unresolved
  ({ boot: factoryBoot } = await import('../vr/mode-factory.js'));
} catch (_) {
  factoryBoot = null;
}

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const doc = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop() {}, burstAt() {}, celebrate() {} };

// Cloud Logger (IIFE)
const CloudLogger = ROOT.HHACloudLogger || null;

// ----------------------- helpers -----------------------
function clamp(v, a, b) { v = +v || 0; return Math.max(a, Math.min(b, v)); }
function randi(a, b) { return (Math.random() * (b - a + 1) + a) | 0; }
function rand(a, b) { return Math.random() * (b - a) + a; }
function nowIso(){ return new Date().toISOString(); }
function qs(name, d=''){ try{ return new URL(location.href).searchParams.get(name) || d; }catch(_){ return d; } }
function boolQs(name){ return qs(name,'') === '1' || qs(name,'') === 'true'; }
function niceDiff(x){
  x = String(x||'normal').toLowerCase();
  if (x === 'easy') return 'Easy';
  if (x === 'hard') return 'Hard';
  return 'Normal';
}
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function setText(id, txt){
  const el = doc.getElementById(id);
  if (el) el.textContent = String(txt);
}
function show(id, on){
  const el = doc.getElementById(id);
  if (el) el.style.display = on ? '' : 'none';
}

function gradeFrom(score, miss){
  // ปรับได้ตามใจ: เน้น “ไม่พลาด” + คะแนน
  const s = (score|0);
  const m = (miss|0);
  if (s >= 5200 && m <= 0) return 'SSS';
  if (s >= 4200 && m <= 1) return 'SS';
  if (s >= 3400 && m <= 2) return 'S';
  if (s >= 2600) return 'A';
  if (s >= 1800) return 'B';
  return 'C';
}

// ----------------------- difficulty -----------------------
const DIFF_TABLE = {
  easy:   { spawnMs: 980,  maxActive: 4, junkRatio: 0.22, scale: 1.15, fallSpeed: 0.010, time: 70 },
  normal: { spawnMs: 820,  maxActive: 5, junkRatio: 0.28, scale: 1.00, fallSpeed: 0.012, time: 70 },
  hard:   { spawnMs: 660,  maxActive: 6, junkRatio: 0.34, scale: 0.88, fallSpeed: 0.014, time: 70 }
};

// ----------------------- assets -----------------------
const FOOD = [
  { id:1, emoji:'🥩', name:'หมู่ 1' },
  { id:2, emoji:'🍚', name:'หมู่ 2' },
  { id:3, emoji:'🥦', name:'หมู่ 3' },
  { id:4, emoji:'🍎', name:'หมู่ 4' },
  { id:5, emoji:'🥑', name:'หมู่ 5' }
];
const JUNK = [
  { emoji:'🍟', name:'ขยะ' },
  { emoji:'🍔', name:'ขยะ' },
  { emoji:'🍩', name:'ขยะ' },
  { emoji:'🧁', name:'ขยะ' },
  { emoji:'🥤', name:'ขยะ' }
];

function emojiDataUrl(emoji, size=200){
  // สร้าง SVG เป็น data-url ให้ a-image ใช้ได้
  const svg =
`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <rect width="100%" height="100%" rx="${Math.round(size*0.18)}" ry="${Math.round(size*0.18)}" fill="rgba(0,0,0,0)"/>
  <text x="50%" y="56%" text-anchor="middle" dominant-baseline="middle"
        font-size="${Math.round(size*0.78)}" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, system-ui">
    ${emoji}
  </text>
</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// ----------------------- main -----------------------
(function main(){
  const debug = boolQs('debug');
  const diffKey = String(qs('diff','normal')).toLowerCase();
  const diff = DIFF_TABLE[diffKey] ? diffKey : 'normal';
  const D = DIFF_TABLE[diff];

  const isResearch = String(qs('mode','play')).toLowerCase() === 'research';
  const timeTotal = Math.max(25, (parseInt(qs('time',''),10) || D.time));

  // UI labels
  setText('hudMode', isResearch ? 'Research' : 'Play');
  setText('hudDiff', niceDiff(diff));
  setText('hudTime', timeTotal);

  // init CloudLogger (IIFE)
  try {
    if (CloudLogger && typeof CloudLogger.init === 'function') {
      CloudLogger.init({
        endpoint: (qs('log','') || (sessionStorage.getItem('HHA_LOGGER_ENDPOINT')||'')),
        debug
      });
    }
  } catch(_) {}

  const sceneEl = doc.querySelector('a-scene');
  const rig = doc.getElementById('rig');
  const cam = doc.getElementById('cam');
  const worldTargets = doc.getElementById('worldTargets');

  if (!sceneEl || !rig || !cam || !worldTargets) {
    console.error('[PlateVR] Missing scene/rig/cam/worldTargets');
    return;
  }

  // THREE references (A-Frame exposes THREE)
  const THREE = ROOT.THREE;
  if (!THREE) {
    console.error('[PlateVR] THREE not found');
    return;
  }

  // ----------------------- state -----------------------
  const S = {
    started:false,
    paused:false,
    ended:false,

    t: timeTotal,
    timeTotal,

    score:0,
    combo:0,
    comboMax:0,
    miss:0,
    perfect:0,

    fever:0,         // 0..100
    feverMax:100,

    // plate progress
    gCount:[0,0,0,0,0],    // index 0..4
    plates:0,

    // quests summary
    goalsCleared:0,
    minisCleared:0,
    questsCleared:0,

    // goal tracking
    goals: [],
    goalIndex: 0,
    goalActive: null,

    // mini chain
    minis: [],
    miniIndex: 0,
    miniActive: null,
    miniT: 0,
    miniNoJunk: true,

    // spawn
    spawnTimer:null,
    tickTimer:null,
    targets: new Map(),      // id -> {el, mesh, type, groupId, born}
    nextId:1,

    // input drag-look
    drag: {
      active:false,
      moved:false,
      id:null,
      sx:0, sy:0,
      lx:0, ly:0,
      accum:0,
      yaw:0,
      pitch:0,
      sens: 0.12,        // ปรับได้: ยิ่งมากยิ่งไว
      pitchMin:-70,
      pitchMax: 70
    },

    // audio tick
    beepCtx:null,
    beepOsc:null,
    beepGain:null,

    // logging
    sessionId: ('PLT-' + Math.random().toString(16).slice(2) + '-' + Date.now()),
    startedAtIso: null
  };

  // ----------------------- quests defs -----------------------
  function buildGoals(){
    // 2 goals ต่อรอบ
    const g1 = {
      id:'g1',
      label:'ทำจานสุขภาพให้ครบ 2 จาน 🍽️🍽️',
      hint:'เก็บให้ครบ 5 หมู่ แล้วเริ่มจานใหม่',
      targetByDiff:{ easy:2, normal:2, hard:3 },
      eval:()=> S.plates,
      pass:(v,t)=> v>=t
    };
    const g2 = {
      id:'g2',
      label:'ทำคะแนนให้ถึงเป้า ⭐',
      hint:'คอมโบสูง = คะแนนพุ่ง!',
      targetByDiff:{ easy:2200, normal:2600, hard:3200 },
      eval:()=> S.score,
      pass:(v,t)=> v>=t
    };
    return [g1, g2];
  }

  function buildMinis(){
    // 3 minis ต่อเนื่อง (ให้ฟีล “ท้าทาย” แบบ GoodJunk)
    return [
      {
        id:'m1',
        label:'Plate Rush ⚡',
        hint:'ทำ “ครบ 5 หมู่” ภายใน 8 วิ และห้ามโดนขยะ!',
        secondsByDiff:{ easy:9, normal:8, hard:7 },
        start:()=>{
          S.miniT = (this.secondsByDiff?.[diff] ?? 8);
          S.miniNoJunk = true;
          // รีเซ็ตจานเพื่อให้เริ่มใหม่ชัด ๆ
          S.gCount = [0,0,0,0,0];
          updatePlateHud();
          startRushWarningFX(false);
        },
        eval:()=> ({
          have: countHaveGroups(),
          t: S.miniT,
          okNoJunk: S.miniNoJunk
        }),
        pass:(st)=> (st.have>=5 && st.okNoJunk===true && st.t>=0)
      },
      {
        id:'m2',
        label:'Perfect Streak 🌟',
        hint:'เก็บของดีติดกัน 7 ครั้ง (ห้ามโดนขยะ)',
        targetByDiff:{ easy:6, normal:7, hard:8 },
        _streak:0,
        start:function(){ this._streak = 0; },
        onGood:function(){ this._streak++; },
        onJunk:function(){ this._streak = 0; },
        eval:function(){ return this._streak; },
        pass:(v,t)=> v>=t
      },
      {
        id:'m3',
        label:'No Junk Zone 🛡️',
        hint:'เอาตัวรอด 12 วิโดยไม่โดนขยะ',
        secondsByDiff:{ easy:12, normal:12, hard:14 },
        start:function(){ S.miniT = (this.secondsByDiff?.[diff] ?? 12); S.miniNoJunk = true; },
        eval:()=> ({ t:S.miniT, okNoJunk:S.miniNoJunk }),
        pass:(st)=> (st.t<=0 && st.okNoJunk===true)
      }
    ];
  }

  // ----------------------- HUD update -----------------------
  function countHaveGroups(){
    let n=0;
    for (let i=0;i<5;i++) if ((S.gCount[i]|0)>0) n++;
    return n;
  }

  function updatePlateHud(){
    setText('hudGroupsHave', `${countHaveGroups()}/5`);
  }

  function updateFeverHud(){
    const pct = clamp((S.fever / S.feverMax) * 100, 0, 100);
    const bar = doc.getElementById('hudFever');
    if (bar) bar.style.width = pct.toFixed(0) + '%';
    setText('hudFeverPct', pct.toFixed(0) + '%');
  }

  function updateCoreHud(){
    setText('hudTime', Math.max(0, S.t|0));
    setText('hudScore', S.score|0);
    setText('hudCombo', S.combo|0);
    setText('hudMiss', S.miss|0);
    setText('hudPerfectCount', S.perfect|0);
    setText('hudGrade', gradeFrom(S.score, S.miss));
    updateFeverHud();
    updatePlateHud();
  }

  function setQuestLine(){
    const g = S.goalActive;
    if (!g){
      setText('hudGoalLine', '…');
      return;
    }
    const tgt = (g.targetByDiff && g.targetByDiff[diff]) || g.target || 0;
    const v = g.eval ? g.eval() : 0;
    setText('hudGoalLine', `${g.label}  (${v}/${tgt})`);
  }

  function setMiniLine(){
    const m = S.miniActive;
    if (!m){
      setText('hudMiniLine', '…');
      setText('hudMiniHint', '…');
      startRushWarningFX(false);
      return;
    }
    const hint = m.hint || '';
    let line = m.label || 'MINI';
    // ถ้า mini ใช้เวลา แสดงด้วย
    if (m.id === 'm1' || m.id === 'm3') line += `  ⏳ ${Math.max(0, (S.miniT|0))}s`;
    setText('hudMiniLine', line);
    setText('hudMiniHint', hint);
  }

  // ----------------------- FX: rush warning -----------------------
  function ensureBeep(){
    if (S.beepCtx) return;
    try{
      const AC = ROOT.AudioContext || ROOT.webkitAudioContext;
      if (!AC) return;
      S.beepCtx = new AC();
      S.beepGain = S.beepCtx.createGain();
      S.beepGain.gain.value = 0.0001;
      S.beepGain.connect(S.beepCtx.destination);
      S.beepOsc = S.beepCtx.createOscillator();
      S.beepOsc.type = 'square';
      S.beepOsc.frequency.value = 880;
      S.beepOsc.connect(S.beepGain);
      S.beepOsc.start();
    }catch(_){}
  }

  function beepTick(){
    ensureBeep();
    if (!S.beepCtx || !S.beepGain) return;
    try{
      if (S.beepCtx.state === 'suspended') S.beepCtx.resume();
      S.beepGain.gain.setTargetAtTime(0.05, S.beepCtx.currentTime, 0.01);
      S.beepGain.gain.setTargetAtTime(0.0001, S.beepCtx.currentTime + 0.06, 0.02);
    }catch(_){}
  }

  function startRushWarningFX(on){
    doc.body.classList.toggle('plate-rush-warn', !!on);
    // สั่นเบา ๆ ด้วย CSS ผ่าน inline keyframes
    const hudTop = doc.getElementById('hudTop');
    const hudLeft = doc.getElementById('hudLeft');
    if (hudTop) hudTop.style.animation = on ? 'plateShake 0.18s infinite' : '';
    if (hudLeft) hudLeft.style.animation = on ? 'plateShake 0.18s infinite' : '';
  }

  // inject warning CSS once
  (function injectWarnCSS(){
    const st = doc.createElement('style');
    st.textContent = `
      @keyframes plateShake{
        0%{ transform:translate(0,0); }
        25%{ transform:translate(1px,-1px); }
        50%{ transform:translate(-1px,1px); }
        75%{ transform:translate(1px,1px); }
        100%{ transform:translate(0,0); }
      }
      body.plate-rush-warn #questPanel, body.plate-rush-warn #miniPanel{
        outline:2px solid rgba(250,204,21,.55);
        box-shadow:0 0 0 4px rgba(250,204,21,.12), 0 18px 40px rgba(0,0,0,.35);
      }
    `;
    doc.head.appendChild(st);
  })();

  // ----------------------- world targets -----------------------
  function spawnTarget(){
    if (S.paused || S.ended) return;

    // max active
    if (S.targets.size >= D.maxActive) return;

    // pick type
    const isJunk = Math.random() < D.junkRatio;
    let type = isJunk ? 'junk' : 'good';
    let emoji, groupId = 0;

    if (type === 'good') {
      const g = pick(FOOD);
      emoji = g.emoji;
      groupId = g.id;
    } else {
      const j = pick(JUNK);
      emoji = j.emoji;
    }

    // position (in front of camera) — กระจายให้รู้สึก “เป้าลอยรอบตัว”
    const z = -rand(2.2, 3.3);
    const x = rand(-1.25, 1.25);
    const y = rand(0.15, 1.65);

    const el = doc.createElement('a-image');
    const id = String(S.nextId++);
    el.setAttribute('id', 'pt-' + id);
    el.classList.add('plateTarget');
    el.setAttribute('src', emojiDataUrl(emoji, 220));
    el.setAttribute('position', `${x} ${y} ${z}`);
    el.setAttribute('scale', `${0.62*D.scale} ${0.62*D.scale} ${0.62*D.scale}`);
    el.setAttribute('transparent', 'true');
    el.setAttribute('alpha-test', '0.02');
    el.setAttribute('look-at', '#cam'); // หันหาเราตลอด = เหมือน GoodJunk “โผล่แล้วโดน”
    el.setAttribute('material', 'shader:flat; opacity:1');

    // ให้ cursor click โดน
    el.addEventListener('click', () => hitTarget(id));

    worldTargets.appendChild(el);

    // เก็บ mesh หลังมันพร้อม
    el.addEventListener('loaded', () => {
      const mesh = el.getObject3D('mesh');
      if (mesh) {
        S.targets.set(id, { el, mesh, type, groupId, born: performance.now() });
      } else {
        S.targets.set(id, { el, mesh: null, type, groupId, born: performance.now() });
      }
    });

    // auto lifetime (โผล่แล้วหายไป)
    const lifeMs = randi(950, 1450);
    setTimeout(() => {
      if (S.targets.has(id)) {
        removeTarget(id, false); // หายเอง ไม่ miss
      }
    }, lifeMs);
  }

  function removeTarget(id, isHit){
    const t = S.targets.get(id);
    if (!t) return;
    S.targets.delete(id);
    try { t.el.parentNode && t.el.parentNode.removeChild(t.el); } catch(_) {}
    if (isHit) {
      // burst center-ish
      Particles.burstAt(randi(60, 340), randi(80, 420), t.type === 'junk' ? 'BAD' : 'GOOD');
    }
  }

  // ----------------------- hit / scoring -----------------------
  function addScore(base){
    const comboBonus = Math.min(12, S.combo);
    const add = (base + comboBonus * 6) | 0;
    S.score += add;
    Particles.scorePop(`+${add}`, randi(90, 320), randi(80, 420));
  }

  function addFever(d){
    S.fever = clamp(S.fever + (d|0), 0, S.feverMax);
  }

  function onGoodHit(groupId){
    S.combo++;
    S.comboMax = Math.max(S.comboMax, S.combo);

    // perfect: ถ้าคอมโบสูงๆ/ไม่พลาดสะสม
    if (S.combo % 5 === 0) S.perfect++;

    addScore(70);
    addFever(6);

    if (groupId >= 1 && groupId <= 5) {
      S.gCount[groupId-1] = (S.gCount[groupId-1]|0) + 1;
    }

    // mini hooks
    const m = S.miniActive;
    if (m && typeof m.onGood === 'function') {
      try { m.onGood(); } catch(_) {}
    }

    // plate complete?
    if (countHaveGroups() >= 5) {
      S.plates++;
      // celebrate
      Particles.celebrate && Particles.celebrate('plate');
      // reset plate
      S.gCount = [0,0,0,0,0];
      updatePlateHud();
      // log event
      logEvent('plate_complete', { plates: S.plates });
    }
  }

  function onJunkHit(){
    // MISS = โดนขยะเท่านั้น
    S.miss++;
    S.combo = 0;
    addFever(-14);

    // mini no-junk fail
    S.miniNoJunk = false;
    const m = S.miniActive;
    if (m && typeof m.onJunk === 'function') {
      try { m.onJunk(); } catch(_) {}
    }

    Particles.scorePop('MISS', randi(90, 320), randi(80, 420));
    Particles.burstAt(randi(80, 320), randi(100, 420), 'BAD');
  }

  function hitTarget(id){
    if (S.paused || S.ended) return;
    const t = S.targets.get(id);
    if (!t) return;

    removeTarget(id, true);

    if (t.type === 'junk') onJunkHit();
    else onGoodHit(t.groupId);

    // update quests after hit
    tickQuests();
    updateCoreHud();
  }

  // ----------------------- raycast fire (tap-anywhere) -----------------------
  const raycaster = new THREE.Raycaster();
  const origin = new THREE.Vector3();
  const dir = new THREE.Vector3();

  function fireRay(){
    if (S.paused || S.ended) return;

    const camObj = cam.object3D;
    camObj.getWorldPosition(origin);
    dir.set(0,0,-1).applyQuaternion(camObj.getWorldQuaternion(new THREE.Quaternion())).normalize();

    raycaster.set(origin, dir);

    // collect meshes
    const meshes = [];
    const idByMesh = new Map();
    for (const [id, t] of S.targets.entries()){
      const mesh = t.el.getObject3D('mesh');
      if (mesh){
        meshes.push(mesh);
        idByMesh.set(mesh, id);
      }
    }
    if (!meshes.length) return;

    const hits = raycaster.intersectObjects(meshes, true);
    if (!hits || !hits.length) return;

    // หา entity ที่เราจดไว้ (walk up parent chain)
    let obj = hits[0].object;
    while (obj && !idByMesh.has(obj) && obj.parent) obj = obj.parent;
    const id = idByMesh.get(obj) || null;
    if (id) hitTarget(id);
  }

  // ----------------------- GoodJunk-style drag look -----------------------
  function applyLook(deltaX, deltaY){
    // yaw on rig, pitch on cam
    const d = S.drag;
    d.yaw += (deltaX * d.sens);
    d.pitch += (deltaY * d.sens);

    d.pitch = clamp(d.pitch, d.pitchMin, d.pitchMax);

    // degrees -> setAttribute rotation (A-Frame uses degrees)
    rig.setAttribute('rotation', `0 ${d.yaw.toFixed(3)} 0`);
    cam.setAttribute('rotation', `${(-d.pitch).toFixed(3)} 0 0`);
  }

  function bindDragLook(){
    const d = S.drag;
    const TAP_MOVE_THRESHOLD = 8;

    function onDown(e){
      if (S.paused || S.ended) return;
      // ignore clicks on buttons
      const t = e.target;
      if (t && (t.closest && t.closest('button'))) return;

      d.active = true;
      d.moved = false;
      d.accum = 0;
      d.id = e.pointerId;
      d.sx = d.lx = e.clientX;
      d.sy = d.ly = e.clientY;

      try { doc.body.setPointerCapture && doc.body.setPointerCapture(e.pointerId); } catch(_) {}
    }

    function onMove(e){
      if (!d.active) return;
      if (d.id != null && e.pointerId !== d.id) return;

      const dx = (e.clientX - d.lx);
      const dy = (e.clientY - d.ly);
      d.lx = e.clientX;
      d.ly = e.clientY;

      d.accum += Math.abs(dx) + Math.abs(dy);
      if (d.accum > TAP_MOVE_THRESHOLD) d.moved = true;

      // apply look only when moved a bit (กันสั่น)
      applyLook(dx, dy);
    }

    function onUp(e){
      if (!d.active) return;
      if (d.id != null && e.pointerId !== d.id) return;

      d.active = false;

      // ถ้าไม่ได้ลากจริง -> ถือว่าเป็น "tap" ยิง
      if (!d.moved) {
        fireRay();
      }

      d.id = null;
      d.moved = false;
      d.accum = 0;
    }

    // pointer events ครอบคลุม mouse+touch
    doc.addEventListener('pointerdown', onDown, { passive:true });
    doc.addEventListener('pointermove', onMove, { passive:true });
    doc.addEventListener('pointerup', onUp, { passive:true });
    doc.addEventListener('pointercancel', onUp, { passive:true });
  }

  // ----------------------- quests runner -----------------------
  function startGoals(){
    S.goals = buildGoals();
    S.goalIndex = 0;
    S.goalActive = S.goals[S.goalIndex] || null;
    setQuestLine();
  }

  function startMinis(){
    S.minis = buildMinis();
    S.miniIndex = 0;
    S.miniActive = S.minis[S.miniIndex] || null;
    if (S.miniActive && typeof S.miniActive.start === 'function') {
      try { S.miniActive.start(); } catch(_) {}
    }
    setMiniLine();
  }

  function nextGoal(){
    S.goalsCleared++;
    S.questsCleared++;
    Particles.celebrate && Particles.celebrate('goal');
    S.goalIndex++;
    S.goalActive = S.goals[S.goalIndex] || null;
    setQuestLine();
    if (!S.goalActive) {
      // all goals done
      endGame(true);
    }
  }

  function nextMini(){
    S.minisCleared++;
    S.questsCleared++;
    Particles.celebrate && Particles.celebrate('mini');
    S.miniIndex++;
    S.miniActive = S.minis[S.miniIndex] || null;
    if (S.miniActive && typeof S.miniActive.start === 'function') {
      try { S.miniActive.start(); } catch(_) {}
    }
    setMiniLine();
  }

  function tickQuests(){
    // goal check
    const g = S.goalActive;
    if (g){
      const tgt = (g.targetByDiff && g.targetByDiff[diff]) || g.target || 0;
      const v = g.eval ? g.eval() : 0;
      setQuestLine();
      if (g.pass && g.pass(v, tgt)) {
        nextGoal();
      }
    }

    // mini check
    const m = S.miniActive;
    if (m){
      let ok = false;
      if (m.id === 'm1' || m.id === 'm3') {
        const st = m.eval ? m.eval() : {};
        ok = m.pass ? m.pass(st) : false;
      } else {
        const tgt = (m.targetByDiff && m.targetByDiff[diff]) || m.target || 0;
        const v = m.eval ? (typeof m.eval === 'function' ? m.eval() : 0) : 0;
        ok = m.pass ? m.pass(v, tgt) : false;
      }
      setMiniLine();
      if (ok) nextMini();
    }
  }

  // ----------------------- time tick -----------------------
  function tick(){
    if (!S.started || S.paused || S.ended) return;

    S.t -= 1;
    if (S.t < 0) S.t = 0;

    // mini timers
    if (S.miniActive && (S.miniActive.id === 'm1' || S.miniActive.id === 'm3')) {
      S.miniT -= 1;

      // Rush warning: เหลือ <=3 วิ
      if (S.miniActive.id === 'm1') {
        const warn = (S.miniT <= 3 && S.miniT >= 0);
        startRushWarningFX(warn);
        if (warn) beepTick();
        if (S.miniT < 0) startRushWarningFX(false);
      }
      setMiniLine();

      // mini m3 (No Junk Zone) ผ่านเมื่อ time<=0 และยังไม่โดน junk
      if (S.miniActive.id === 'm3') {
        tickQuests();
      }

      // mini m1 (Plate Rush) ถ้าเวลาหมด -> fail แล้วเดินต่อ
      if (S.miniActive.id === 'm1' && S.miniT < 0) {
        startRushWarningFX(false);
        // fail -> ไป mini ถัดไปทันที (เพื่อ flow สนุก)
        nextMini();
      }
    }

    // update HUD
    updateCoreHud();
    tickQuests();

    if (S.t <= 0) endGame(false);
  }

  // ----------------------- logging -----------------------
  function logSessionStart(){
    if (!CloudLogger) return;
    S.startedAtIso = nowIso();
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:log_session', {
        detail:{
          sessionId: S.sessionId,
          game: 'PlateVR',
          mode: isResearch ? 'research' : 'play',
          difficulty: diff,
          startIso: S.startedAtIso,
          timeTotal: S.timeTotal,
          ua: navigator.userAgent
        }
      }));
    }catch(_){}
  }

  function logEvent(name, data){
    if (!CloudLogger) return;
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:log_event', {
        detail:{
          sessionId: S.sessionId,
          game: 'PlateVR',
          name,
          tLeft: S.t,
          score: S.score,
          combo: S.combo,
          miss: S.miss,
          plates: S.plates,
          goalsCleared: S.goalsCleared,
          minisCleared: S.minisCleared,
          data: data || {}
        }
      }));
    }catch(_){}
  }

  function logSessionEnd(success){
    if (!CloudLogger) return;
    try{
      ROOT.dispatchEvent(new CustomEvent('hha:log_session', {
        detail:{
          sessionId: S.sessionId,
          game: 'PlateVR',
          mode: isResearch ? 'research' : 'play',
          difficulty: diff,
          endIso: nowIso(),
          success: !!success,
          score: S.score,
          miss: S.miss,
          comboMax: S.comboMax,
          perfect: S.perfect,
          plates: S.plates,
          goalsCleared: S.goalsCleared,
          minisCleared: S.minisCleared,
          grade: gradeFrom(S.score, S.miss)
        }
      }));
    }catch(_){}
  }

  // ----------------------- end modal -----------------------
  function endGame(success){
    if (S.ended) return;
    S.ended = true;

    clearInterval(S.tickTimer);
    clearInterval(S.spawnTimer);

    show('hudPaused', false);
    updateCoreHud();

    const grade = gradeFrom(S.score, S.miss);
    setText('rMode', isResearch ? 'Research' : 'Play');
    setText('rGrade', grade);
    setText('rScore', S.score|0);
    setText('rMaxCombo', S.comboMax|0);
    setText('rMiss', S.miss|0);
    setText('rPerfect', S.perfect|0);

    setText('rGoals', `${S.goalsCleared}/2`);
    setText('rMinis', `${S.minisCleared}/3`);
    setText('rG1', (S.gCount[0]|0));
    setText('rG2', (S.gCount[1]|0));
    setText('rG3', (S.gCount[2]|0));
    setText('rG4', (S.gCount[3]|0));
    setText('rG5', (S.gCount[4]|0));
    setText('rGTotal', (S.gCount.reduce((a,b)=>a+(b|0),0)));

    show('resultBackdrop', true);

    Particles.celebrate && Particles.celebrate(success ? 'win' : 'end');

    logEvent('end', { success: !!success, grade });
    logSessionEnd(success);

    // flush logger best-effort
    try { CloudLogger && CloudLogger.flushNow && CloudLogger.flushNow(true); } catch(_) {}
  }

  // ----------------------- buttons -----------------------
  function bindUI(){
    const btnVR = doc.getElementById('btnEnterVR');
    const btnPause = doc.getElementById('btnPause');
    const btnRestart = doc.getElementById('btnRestart');
    const btnAgain = doc.getElementById('btnPlayAgain');

    if (btnVR) {
      btnVR.addEventListener('click', async () => {
        try { await sceneEl.enterVR(); } catch(_) {}
      });
    }
    if (btnPause) {
      btnPause.addEventListener('click', () => {
        if (S.ended) return;
        S.paused = !S.paused;
        show('hudPaused', S.paused);
        logEvent(S.paused ? 'pause' : 'resume', {});
      });
    }
    if (btnRestart) {
      btnRestart.addEventListener('click', () => {
        location.reload();
      });
    }
    if (btnAgain) {
      btnAgain.addEventListener('click', () => {
        location.reload();
      });
    }
  }

  // ----------------------- start -----------------------
  function start(){
    if (S.started) return;
    S.started = true;
    S.paused = false;
    S.ended = false;

    // quests
    startGoals();
    startMinis();

    updateCoreHud();
    bindUI();

    // input
    bindDragLook();

    // timers
    S.tickTimer = setInterval(tick, 1000);
    S.spawnTimer = setInterval(spawnTarget, D.spawnMs);

    // start log
    logSessionStart();
    logEvent('start', { timeTotal: S.timeTotal });

    // initial spawn burst
    for (let i=0;i<Math.min(3, D.maxActive);i++) spawnTarget();
  }

  // start immediately (เหมือน GoodJunk: เข้าแล้วเล่นได้เลย)
  start();

  // expose debug
  if (debug) ROOT.__PlateVR = { S, spawnTarget, fireRay };

})();
