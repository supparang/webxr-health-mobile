'use strict';

const DOC = document;
const WIN = window;

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const qs = (k, def=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; } };
const now = ()=> performance.now();
const byId = (id)=> DOC.getElementById(id);

function emit(name, detail){
  try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(e){}
}

/** deterministic RNG (mulberry32) */
function mulberry32(seed){
  let t = seed >>> 0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function strSeed(s){
  s = String(s ?? '');
  let h = 2166136261;
  for (let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const VIEW = String(qs('view','')).toLowerCase();   // 'cvr' for cardboard
const SEED = qs('seed', String(Date.now()));
const seedN = /^\d+$/.test(SEED) ? (Number(SEED)>>>0) : strSeed(SEED);
const rnd = mulberry32(seedN);

if (VIEW === 'cvr') DOC.body.classList.add('cvr');

const UI = {
  phasePill: byId('phasePill'),
  timePill:  byId('timePill'),
  cleanPill: byId('cleanPill'),
  comboPill: byId('comboPill'),
  missPill:  byId('missPill'),
  viewPill:  byId('viewPill'),
  btnStart:  byId('btnStart'),
  btnFlip:   byId('btnFlip'),
  btnHelp:   byId('btnHelp'),
  panelHelp: byId('panelHelp'),
  btnCloseHelp: byId('btnCloseHelp'),
  panelEnd:  byId('panelEnd'),
  endSummary: byId('endSummary'),
  heatmap: byId('heatmap'),
  btnReplay: byId('btnReplay'),
  btnBack: byId('btnBack'),
  bathLayer: byId('bath-layer'),
  bodyWrap: byId('body-wrap'),
  targetLayer: byId('target-layer'),
};

const ZONES = [
  { key:'behindEar',  label:'หลังหู',         // hidden
    front: {x:0.45,y:0.12}, back:{x:0.55,y:0.12} },
  { key:'neckBack',   label:'คอด้านหลัง',     // hidden
    front: {x:0.50,y:0.18}, back:{x:0.50,y:0.18} },
  { key:'armpit',     label:'รักแร้',         // hidden
    front: {x:0.34,y:0.30}, back:{x:0.66,y:0.30} },
  { key:'elbowFold',  label:'ข้อพับแขน',      // hidden
    front: {x:0.26,y:0.40}, back:{x:0.74,y:0.40} },
  { key:'behindKnee', label:'หลังเข่า',        // hidden
    front: {x:0.43,y:0.72}, back:{x:0.57,y:0.72} },
  { key:'toeGap',     label:'ซอกนิ้วเท้า',    // hidden
    front: {x:0.48,y:0.92}, back:{x:0.52,y:0.92} },
];

// phases timing (seconds)
const PHASES = [
  { id:'WET',   secs: 8,  type:'water',   spawnEvery: 420,  goalHits: 10 },
  { id:'SOAP',  secs: 24, type:'foam',    spawnEvery: 520,  goalHits: 14 },
  { id:'SCRUB', secs: 26, type:'hidden',  spawnEvery: 900,  goalHits: 0  }, // goal via hidden cleared
  { id:'RINSE', secs: 14, type:'residue', spawnEvery: 520,  goalHits: 8  }, // + dry targets
];

const STATE = {
  running:false,
  side:'front', // front/back
  phaseIdx: -1,
  phaseEndsAt: 0,
  lastTick: 0,

  // scoring
  combo:0,
  miss:0,
  hits:0,
  cleanScore:0, // 0..100

  // coverage buckets (simple)
  wetHits:0,
  soapHits:0,
  residueHits:0,
  dryHits:0,

  // hidden spots
  hiddenPlan: [], // chosen zones keys for this run
  hiddenNeed: {}, // key -> remaining hits
  hiddenCleared: {},

  oil: null, // oil target key, needs hits
  oilNeed: 0,

  // bookkeeping
  active: new Map(), // id -> obj
  uid: 0,

  // anti spam
  lastShootAt: 0,
  shootCdMs: 60,

  // aim assist
  lockPx: Number(WIN.HHA_VRUI_CONFIG?.lockPx ?? 44),
  cvrStrict: Boolean(WIN.HHA_VRUI_CONFIG?.cvrStrict ?? (VIEW==='cvr')),
};

function setPill(el, txt){ if(el) el.textContent = txt; }

function resetGame(){
  STATE.running = false;
  STATE.phaseIdx = -1;
  STATE.phaseEndsAt = 0;
  STATE.combo = 0;
  STATE.miss = 0;
  STATE.hits = 0;
  STATE.cleanScore = 0;
  STATE.wetHits = 0;
  STATE.soapHits = 0;
  STATE.residueHits = 0;
  STATE.dryHits = 0;
  STATE.hiddenPlan = [];
  STATE.hiddenNeed = {};
  STATE.hiddenCleared = {};
  STATE.oil = null;
  STATE.oilNeed = 0;
  STATE.active.clear();
  STATE.uid = 0;
  UI.targetLayer.innerHTML = '';
  updateHUD();
}

function updateHUD(){
  const phase = PHASES[STATE.phaseIdx]?.id ?? '—';
  const tLeft = STATE.running ? Math.max(0, Math.ceil((STATE.phaseEndsAt - now())/1000)) : 0;
  setPill(UI.phasePill, `PHASE: ${phase}`);
  setPill(UI.timePill,  `TIME: ${tLeft}`);
  setPill(UI.comboPill, `COMBO: ${STATE.combo}`);
  setPill(UI.missPill,  `MISS: ${STATE.miss}`);
  setPill(UI.viewPill,  `VIEW: ${STATE.side.toUpperCase()}`);
  setPill(UI.cleanPill, `CLEAN: ${Math.round(STATE.cleanScore)}%`);
}

function bodyRect(){
  // playable area = bath-layer inner rect, keep hud-safe by padding already
  return UI.bathLayer.getBoundingClientRect();
}

function spawnPoint(){
  const r = bodyRect();
  // safe padding so targets don't touch edges
  const pad = 26;
  const x = r.left + pad + rnd() * (r.width  - pad*2);
  const y = r.top  + pad + rnd() * (r.height - pad*2);
  return { x, y };
}

function toLocal(x,y){
  const r = bodyRect();
  return { lx: x - r.left, ly: y - r.top, w:r.width, h:r.height };
}

function makeTarget({ kind, x, y, ttlMs=1400, hitsToClear=1, zoneKey=null }){
  const r = bodyRect();
  const id = `t${++STATE.uid}`;
  const local = toLocal(x,y);
  const el = DOC.createElement('div');
  el.className = `target ${kindClass(kind)}`;
  el.dataset.id = id;
  el.dataset.kind = kind;
  el.style.left = `${local.lx}px`;
  el.style.top  = `${local.ly}px`;

  // visual
  const ring = DOC.createElement('div');
  ring.className = 'ring';
  el.appendChild(ring);

  // cVR strict: prevent pointer direct click on targets
  if (STATE.cvrStrict) el.style.pointerEvents = 'none';

  UI.targetLayer.appendChild(el);

  const obj = {
    id, kind, el,
    born: now(),
    ttl: ttlMs,
    hitsToClear,
    zoneKey,
    hitCount: 0,
  };
  STATE.active.set(id, obj);

  // expiry timer handled in tick
  return obj;
}

function kindClass(kind){
  if (kind==='water') return 't-water';
  if (kind==='foam') return 't-foam';
  if (kind==='hidden') return 't-hidden';
  if (kind==='oil') return 't-oil';
  if (kind==='residue') return 't-residue';
  if (kind==='dry') return 't-dry';
  return '';
}

function removeTarget(id){
  const obj = STATE.active.get(id);
  if (!obj) return;
  try{ obj.el.remove(); }catch(e){}
  STATE.active.delete(id);
}

function expireTargets(){
  const t = now();
  for (const [id, obj] of STATE.active){
    if (t - obj.born >= obj.ttl){
      // count miss only for important targets
      if (obj.kind === 'hidden' || obj.kind === 'oil') {
        STATE.miss++;
        STATE.combo = 0;
        emit('hha:event', { game:'bath', type:'miss', kind: obj.kind, zoneKey: obj.zoneKey, t });
      }
      removeTarget(id);
    }
  }
}

function aimAssistPick(x,y){
  // pick element under point OR nearest target within lockPx
  const el = DOC.elementFromPoint(x,y);
  if (el && el.classList && el.classList.contains('target')) return el;

  // nearest within lock radius
  let best = null;
  let bestD = Infinity;
  for (const obj of STATE.active.values()){
    const r = obj.el.getBoundingClientRect();
    const cx = r.left + r.width/2;
    const cy = r.top  + r.height/2;
    const dx = cx - x, dy = cy - y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < bestD){
      bestD = d;
      best = obj.el;
    }
  }
  if (best && bestD <= STATE.lockPx) return best;
  return null;
}

function handleShootAt(x,y, source='pointer'){
  const t = now();
  if (!STATE.running) return;

  // simple cooldown
  if (t - STATE.lastShootAt < STATE.shootCdMs) return;
  STATE.lastShootAt = t;

  // cVR strict uses aim assist (center shots)
  const hitEl = (STATE.cvrStrict || source==='hha:shoot') ? aimAssistPick(x,y) : DOC.elementFromPoint(x,y);
  if (!hitEl || !hitEl.dataset || !hitEl.dataset.id) {
    emit('hha:event', { game:'bath', type:'shoot', hit:false, source, x,y, t });
    return;
  }

  const id = hitEl.dataset.id;
  const obj = STATE.active.get(id);
  if (!obj) return;

  obj.hitCount++;
  hitEl.classList.remove('pop'); // retrigger
  void hitEl.offsetWidth;
  hitEl.classList.add('pop');

  const cleared = obj.hitCount >= obj.hitsToClear;

  // score updates
  if (cleared){
    STATE.hits++;
    STATE.combo++;
    awardByKind(obj.kind, obj.zoneKey);
    emit('hha:event', { game:'bath', type:'hit', kind: obj.kind, zoneKey: obj.zoneKey, combo: STATE.combo, source, x,y, t });
    removeTarget(id);
  } else {
    emit('hha:event', { game:'bath', type:'hit_partial', kind: obj.kind, zoneKey: obj.zoneKey, remaining: (obj.hitsToClear-obj.hitCount), source, x,y, t });
  }

  updateHUD();
}

function awardByKind(kind, zoneKey){
  if (kind==='water') STATE.wetHits++;
  if (kind==='foam') STATE.soapHits++;
  if (kind==='residue') STATE.residueHits++;
  if (kind==='dry') STATE.dryHits++;

  if (kind==='hidden' && zoneKey){
    const left = Math.max(0, (STATE.hiddenNeed[zoneKey] ?? 0) - 1);
    STATE.hiddenNeed[zoneKey] = left;
    if (left <= 0){
      STATE.hiddenCleared[zoneKey] = true;
    }
  }
  if (kind==='oil'){
    STATE.oilNeed = Math.max(0, STATE.oilNeed - 1);
  }

  recomputeClean();
}

function recomputeClean(){
  // simple scoring blend:
  // wet 20, soap 20, scrub hidden 40, rinse+dry 20
  const wet = clamp(STATE.wetHits / PHASES[0].goalHits, 0, 1);
  const soap = clamp(STATE.soapHits / PHASES[1].goalHits, 0, 1);

  const hiddenTotal = Math.max(1, STATE.hiddenPlan.length);
  const hiddenDone = STATE.hiddenPlan.filter(k=>STATE.hiddenCleared[k]).length;
  const scrub = clamp(hiddenDone / hiddenTotal, 0, 1);

  const rinse = clamp(STATE.residueHits / PHASES[3].goalHits, 0, 1);
  const dry = clamp(STATE.dryHits / 4, 0, 1); // 4 dry targets per run
  const rd = clamp((rinse*0.65 + dry*0.35), 0, 1);

  // penalize misses lightly
  const missPenalty = clamp(STATE.miss * 0.04, 0, 0.25);

  STATE.cleanScore = clamp((wet*20 + soap*20 + scrub*40 + rd*20) * (1 - missPenalty), 0, 100);
}

function pickHiddenPlan(){
  // deterministic: choose 4 hidden spots out of 6
  const keys = ZONES.map(z=>z.key);
  // shuffle deterministic
  for (let i=keys.length-1;i>0;i--){
    const j = Math.floor(rnd()*(i+1));
    const tmp = keys[i]; keys[i]=keys[j]; keys[j]=tmp;
  }
  const plan = keys.slice(0,4);
  STATE.hiddenPlan = plan;
  for (const k of plan){
    // each hidden needs 2-3 hits
    STATE.hiddenNeed[k] = 2 + (rnd() < 0.35 ? 1 : 0);
    STATE.hiddenCleared[k] = false;
  }
  // oil slick boss picks 1 of plan, needs 3 hits
  STATE.oil = plan[Math.floor(rnd()*plan.length)];
  STATE.oilNeed = 3;
}

function zonePoint(zoneKey){
  const z = ZONES.find(x=>x.key===zoneKey);
  if (!z) return null;
  const p = (STATE.side==='front') ? z.front : z.back;
  const r = bodyRect();
  return { x: r.left + p.x * r.width, y: r.top + p.y * r.height };
}

function spawnForPhase(phase){
  // spawn based on phase type
  const type = phase.type;

  if (type==='water' || type==='foam' || type==='residue'){
    const {x,y} = spawnPoint();
    makeTarget({ kind:type, x,y, ttlMs: 1700, hitsToClear: 1 });
    return;
  }

  if (type==='hidden'){
    // hidden spots spawn at their zone points
    // choose a zone not yet cleared, weighted to those with remaining hits
    const candidates = STATE.hiddenPlan.filter(k => !STATE.hiddenCleared[k]);
    if (!candidates.length) return;

    // occasionally spawn oil slick
    if (STATE.oilNeed > 0 && rnd() < 0.18){
      const p = zonePoint(STATE.oil);
      if (p) makeTarget({ kind:'oil', x:p.x, y:p.y, ttlMs: 1600, hitsToClear: 3, zoneKey: STATE.oil });
      return;
    }

    const k = candidates[Math.floor(rnd()*candidates.length)];
    const p = zonePoint(k);
    if (!p) return;

    const need = STATE.hiddenNeed[k] ?? 2;
    makeTarget({ kind:'hidden', x:p.x, y:p.y, ttlMs: 1400, hitsToClear: Math.min(need, 3), zoneKey: k });
    return;
  }
}

function spawnDryPack(){
  // 4 dry targets at fixed-ish body points
  const keys = ['behindEar','armpit','behindKnee','toeGap'];
  for (const k of keys){
    const p = zonePoint(k);
    if (!p) continue;
    makeTarget({ kind:'dry', x:p.x, y:p.y, ttlMs: 2500, hitsToClear: 1, zoneKey: k });
  }
}

function startPhase(idx){
  STATE.phaseIdx = idx;
  const phase = PHASES[idx];
  STATE.phaseEndsAt = now() + phase.secs*1000;

  // phase-specific setup
  if (phase.id==='SCRUB' && STATE.hiddenPlan.length===0){
    pickHiddenPlan();
    // coach hint initial
    emit('hha:coach', { game:'bath', msg:'ตามล่าจุดอับ! หลังหู/รักแร้/หลังเข่า/ซอกนิ้วเท้า', t: now() });
  }
  if (phase.id==='RINSE'){
    // also spawn dry pack once at phase start
    spawnDryPack();
  }

  updateHUD();
}

function endGame(){
  STATE.running = false;
  updateHUD();

  // build summary
  const hiddenTotal = STATE.hiddenPlan.length || 4;
  const hiddenDone  = STATE.hiddenPlan.filter(k=>STATE.hiddenCleared[k]).length;
  const missedKeys  = STATE.hiddenPlan.filter(k=>!STATE.hiddenCleared[k]);

  UI.endSummary.textContent =
    `CLEAN ${Math.round(STATE.cleanScore)}% • HIT ${STATE.hits} • MISS ${STATE.miss} • Hidden ${hiddenDone}/${hiddenTotal}`;

  // heatmap-style list
  UI.heatmap.innerHTML = '';
  for (const z of ZONES){
    const ok = STATE.hiddenPlan.includes(z.key) ? !!STATE.hiddenCleared[z.key] : true;
    const div = DOC.createElement('div');
    div.className = 'hm';
    const left = DOC.createElement('div');
    left.textContent = z.label;
    const right = DOC.createElement('small');
    right.textContent = ok ? 'OK' : 'พลาด';
    right.style.color = ok ? 'var(--good)' : 'var(--bad)';
    div.appendChild(left);
    div.appendChild(right);
    UI.heatmap.appendChild(div);
  }

  UI.panelEnd.classList.remove('hidden');

  emit('hha:session_end', {
    game:'bath',
    seed: SEED,
    view: VIEW || 'normal',
    clean: Math.round(STATE.cleanScore),
    hits: STATE.hits,
    miss: STATE.miss,
    hiddenDone: STATE.hiddenPlan.filter(k=>STATE.hiddenCleared[k]).length,
    hiddenTotal: STATE.hiddenPlan.length,
    ts: Date.now()
  });
}

function tick(){
  if (!STATE.running) return;

  const t = now();
  const phase = PHASES[STATE.phaseIdx];
  const timeLeft = STATE.phaseEndsAt - t;

  // spawn
  if (!STATE.lastTick) STATE.lastTick = t;
  const dt = t - STATE.lastTick;
  STATE.lastTick = t;

  // periodic spawns
  if (!phase._nextSpawnAt) phase._nextSpawnAt = t;
  if (t >= phase._nextSpawnAt){
    spawnForPhase(phase);
    phase._nextSpawnAt = t + phase.spawnEvery + (rnd()*140 - 70);
  }

  // expire targets
  expireTargets();

  // coach prediction (simple)
  if (phase.id === 'SCRUB'){
    // if near end and some hidden still not cleared => coach
    if (timeLeft < 7000){
      const remaining = STATE.hiddenPlan.filter(k=>!STATE.hiddenCleared[k]);
      if (remaining.length){
        // one hint only near end
        if (!phase._hinted){
          phase._hinted = true;
          const k = remaining[0];
          const z = ZONES.find(x=>x.key===k);
          emit('hha:coach', { game:'bath', msg:`ใกล้หมดเวลา! อย่าลืมจุดอับ: ${z?.label || 'จุดอับ'}`, t });
        }
      }
    }
  }

  // phase end?
  if (timeLeft <= 0){
    // reset phase-specific timers
    if (phase) {
      phase._nextSpawnAt = 0;
      phase._hinted = false;
    }

    // move to next
    if (STATE.phaseIdx < PHASES.length - 1){
      startPhase(STATE.phaseIdx + 1);
    } else {
      endGame();
      return;
    }
  }

  updateHUD();
  requestAnimationFrame(tick);
}

/** pointer input */
function onPointerDown(ev){
  if (!STATE.running) return;
  const x = (ev.touches && ev.touches[0]) ? ev.touches[0].clientX : ev.clientX;
  const y = (ev.touches && ev.touches[0]) ? ev.touches[0].clientY : ev.clientY;
  handleShootAt(x,y,'pointer');
}
function onKeyDown(ev){
  if (ev.code === 'Space'){
    // shoot at center
    const r = bodyRect();
    handleShootAt(r.left + r.width/2, r.top + r.height/2, 'key');
  }
}

/** hha:shoot from vr-ui.js */
function onHHAShoot(ev){
  if (!STATE.running) return;
  const d = ev.detail || {};
  // accept either absolute x/y or normalized
  if (Number.isFinite(d.x) && Number.isFinite(d.y)){
    handleShootAt(d.x, d.y, 'hha:shoot');
    return;
  }
  // fallback: center
  const r = bodyRect();
  handleShootAt(r.left + r.width/2, r.top + r.height/2, 'hha:shoot');
}

/** flip body view */
function flipView(){
  STATE.side = (STATE.side === 'front') ? 'back' : 'front';
  updateHUD();
  emit('hha:event', { game:'bath', type:'flip', side: STATE.side, t: now() });
}

/** start game */
function startGame(){
  resetGame();
  UI.panelEnd.classList.add('hidden');

  // reset phase internal fields
  for (const p of PHASES){
    p._nextSpawnAt = 0;
    p._hinted = false;
  }

  // small remember mini-quiz (fast): show help panel once if first time
  STATE.running = true;
  startPhase(0);

  emit('hha:session_start', {
    game:'bath',
    seed: SEED,
    view: VIEW || 'normal',
    side: STATE.side,
    ts: Date.now()
  });

  requestAnimationFrame(tick);
}

// ----------------- Wire UI -----------------
UI.btnHelp.addEventListener('click', ()=> UI.panelHelp.classList.remove('hidden'));
UI.btnCloseHelp.addEventListener('click', ()=> UI.panelHelp.classList.add('hidden'));

UI.btnStart.addEventListener('click', startGame);
UI.btnReplay.addEventListener('click', startGame);
UI.btnFlip.addEventListener('click', flipView);

UI.btnBack.addEventListener('click', ()=>{
  // simple back: hide end panel
  UI.panelEnd.classList.add('hidden');
});

UI.bathLayer.addEventListener('mousedown', onPointerDown, { passive:true });
UI.bathLayer.addEventListener('touchstart', onPointerDown, { passive:true });
WIN.addEventListener('keydown', onKeyDown);

WIN.addEventListener('hha:shoot', onHHAShoot);

// If cVR strict, disable pointer interaction on targets already.
// But still allow click anywhere to shoot (use center aim assist)
if (STATE.cvrStrict){
  UI.bathLayer.addEventListener('click', ()=>{
    const r = bodyRect();
    handleShootAt(r.left + r.width/2, r.top + r.height/2, 'cvr-click');
  }, { passive:true });
}

// initial state
resetGame();