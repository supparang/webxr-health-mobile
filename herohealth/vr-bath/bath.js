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

const VIEW = String(qs('view','')).toLowerCase();      // 'cvr' for cardboard
const DIFF = String(qs('diff','normal')).toLowerCase(); // easy|normal|hard
const SEED = qs('seed', String(Date.now()));
const seedN = /^\d+$/.test(SEED) ? (Number(SEED)>>>0) : strSeed(SEED);
const rnd = mulberry32(seedN);

if (VIEW === 'cvr') DOC.body.classList.add('cvr');

const DIFFCFG = {
  easy:   { lockPx: 52, cd: 80,  ttlMul: 1.25, spawnMul: 1.15, hiddenNeedAdd: 0, bossMul: 0.85, fakeFoam: 0.10, meterUp: 0.85, meterDown: 1.15, maxActive: 7 },
  normal: { lockPx: 44, cd: 60,  ttlMul: 1.00, spawnMul: 1.00, hiddenNeedAdd: 0, bossMul: 1.00, fakeFoam: 0.18, meterUp: 1.00, meterDown: 1.00, maxActive: 7 },
  hard:   { lockPx: 36, cd: 50,  ttlMul: 0.86, spawnMul: 0.90, hiddenNeedAdd: 1, bossMul: 1.15, fakeFoam: 0.26, meterUp: 1.15, meterDown: 0.90, maxActive: 8 },
};
const CFG = DIFFCFG[DIFF] || DIFFCFG.normal;

const UI = {
  phasePill: byId('phasePill'),
  timePill:  byId('timePill'),
  cleanPill: byId('cleanPill'),
  comboPill: byId('comboPill'),
  missPill:  byId('missPill'),
  viewPill:  byId('viewPill'),
  questPill: byId('questPill'), // <-- add in HTML
  meterPill: byId('meterPill'), // <-- add in HTML

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
  { key:'behindEar',  label:'หลังหู',         front:{x:0.45,y:0.12}, back:{x:0.55,y:0.12} },
  { key:'neckBack',   label:'คอด้านหลัง',     front:{x:0.50,y:0.18}, back:{x:0.50,y:0.18} },
  { key:'armpit',     label:'รักแร้',         front:{x:0.34,y:0.30}, back:{x:0.66,y:0.30} },
  { key:'elbowFold',  label:'ข้อพับแขน',      front:{x:0.26,y:0.40}, back:{x:0.74,y:0.40} },
  { key:'behindKnee', label:'หลังเข่า',        front:{x:0.43,y:0.72}, back:{x:0.57,y:0.72} },
  { key:'toeGap',     label:'ซอกนิ้วเท้า',    front:{x:0.48,y:0.92}, back:{x:0.52,y:0.92} },
];

// base phases (will be modulated by spawnMul / meter stress)
const PHASES = [
  { id:'WET',   secs: 8,  type:'water',   spawnEvery: 360, goalHits: 10 },
  { id:'SOAP',  secs: 22, type:'foam',    spawnEvery: 460, goalHits: 14 },
  { id:'SCRUB', secs: 26, type:'hidden',  spawnEvery: 820, goalHits: 0  },
  { id:'RINSE', secs: 14, type:'residue', spawnEvery: 480, goalHits: 8  },
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

  wetHits:0,
  soapHits:0,
  residueHits:0,
  dryHits:0,

  hiddenPlan: [],
  hiddenNeed: {},
  hiddenCleared: {},

  oil: null,
  oilNeed: 0,

  // fun systems (ABC)
  meter: 0,                 // 0..100
  meterPeak: 0,
  meterLockUntil: 0,
  questText: '—',
  questDone: false,

  bossRush: false,
  bossRushUntil: 0,
  bossKills: 0,

  // bookkeeping
  active: new Map(),
  uid: 0,

  // anti spam
  lastShootAt: 0,
  shootCdMs: CFG.cd,

  // aim assist
  lockPx: Number(WIN.HHA_VRUI_CONFIG?.lockPx ?? CFG.lockPx),
  cvrStrict: Boolean(WIN.HHA_VRUI_CONFIG?.cvrStrict ?? (VIEW==='cvr')),

  // tricks
  fakeFoamRate: CFG.fakeFoam,
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

  STATE.meter = 0;
  STATE.meterPeak = 0;
  STATE.meterLockUntil = 0;
  STATE.questText = '—';
  STATE.questDone = false;
  STATE.bossRush = false;
  STATE.bossRushUntil = 0;
  STATE.bossKills = 0;

  STATE.active.clear();
  STATE.uid = 0;
  UI.targetLayer.innerHTML = '';
  updateHUD();

  // button state
  if (UI.btnStart){
    UI.btnStart.disabled = false;
    UI.btnStart.textContent = 'เริ่มเล่น';
  }
}

function updateHUD(){
  const phase = PHASES[STATE.phaseIdx]?.id ?? '—';
  const tLeft = STATE.running ? Math.max(0, Math.ceil((STATE.phaseEndsAt - now())/1000)) : 0;
  setPill(UI.phasePill, `PHASE: ${phase}${STATE.bossRush ? ' (BOSS!)' : ''}`);
  setPill(UI.timePill,  `TIME: ${tLeft}`);
  setPill(UI.comboPill, `COMBO: ${STATE.combo}`);
  setPill(UI.missPill,  `MISS: ${STATE.miss}`);
  setPill(UI.viewPill,  `VIEW: ${STATE.side.toUpperCase()} • ${DIFF.toUpperCase()}`);
  setPill(UI.cleanPill, `CLEAN: ${Math.round(STATE.cleanScore)}%`);
  setPill(UI.questPill, `QUEST: ${STATE.questText}${STATE.questDone ? ' ✅' : ''}`);
  setPill(UI.meterPill, `SWEAT: ${Math.round(STATE.meter)}%`);
}

function bodyRect(){
  return UI.bathLayer.getBoundingClientRect();
}

function toLocal(x,y){
  const r = bodyRect();
  return { lx: x - r.left, ly: y - r.top, w:r.width, h:r.height };
}

function spawnPoint(){
  const r = bodyRect();
  const pad = 26;

  // avoid bottom UI overlays a bit (works well across devices)
  // this is not perfect overlay-detection but prevents most collisions
  const topPad = pad + 8;
  const botPad = pad + 64;

  const x = r.left + pad + rnd() * (r.width  - pad*2);
  const y = r.top  + topPad + rnd() * (r.height - (topPad + botPad));
  return { x, y };
}

function kindClass(kind){
  if (kind==='water') return 't-water';
  if (kind==='foam') return 't-foam';
  if (kind==='fakefoam') return 't-foam is-fake';
  if (kind==='hidden') return 't-hidden';
  if (kind==='oil') return 't-oil';
  if (kind==='residue') return 't-residue';
  if (kind==='dry') return 't-dry';
  return '';
}

function makeTarget({ kind, x, y, ttlMs=1400, hitsToClear=1, zoneKey=null }){
  const id = `t${++STATE.uid}`;
  const local = toLocal(x,y);
  const el = DOC.createElement('div');
  el.className = `target ${kindClass(kind)}`;
  el.dataset.id = id;
  el.dataset.kind = kind;
  el.style.left = `${local.lx}px`;
  el.style.top  = `${local.ly}px`;

  const ring = DOC.createElement('div');
  ring.className = 'ring';
  el.appendChild(ring);

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
  return obj;
}

function removeTarget(id){
  const obj = STATE.active.get(id);
  if (!obj) return;
  try{ obj.el.remove(); }catch(e){}
  STATE.active.delete(id);
}

function addMeter(delta, reason=''){
  const t = now();
  if (t < STATE.meterLockUntil) return;
  STATE.meterLockUntil = t + 110;

  // scale up/down by diff
  const scaled = (delta >= 0) ? (delta * CFG.meterUp) : (delta * CFG.meterDown);

  STATE.meter = clamp(STATE.meter + scaled, 0, 100);
  STATE.meterPeak = Math.max(STATE.meterPeak, STATE.meter);

  emit('hha:event', { game:'bath', type:'meter', delta: scaled, meter: STATE.meter, reason, t });

  if (STATE.meter >= 100){
    // penalty burst (survival feel)
    STATE.miss += 1;
    STATE.combo = 0;
    STATE.meter = 70;
    emit('hha:coach', { game:'bath', msg:'SWEAT เต็ม! รีบเคลียร์จุดอับ/ล้างฟอง!', t });
  }
}

function expireTargets(){
  const t = now();
  for (const [id, obj] of STATE.active){
    if (t - obj.born >= obj.ttl){
      if (obj.kind === 'hidden' || obj.kind === 'oil'){
        STATE.miss++;
        STATE.combo = 0;
        addMeter(12, 'miss_important');
        emit('hha:event', { game:'bath', type:'miss', kind: obj.kind, zoneKey: obj.zoneKey, t });
      }
      removeTarget(id);
    }
  }
}

function aimAssistPick(x,y){
  const el = DOC.elementFromPoint(x,y);
  if (el && el.classList && el.classList.contains('target')) return el;

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

function recomputeClean(){
  const wet = clamp(STATE.wetHits / PHASES[0].goalHits, 0, 1);
  const soap = clamp(STATE.soapHits / PHASES[1].goalHits, 0, 1);

  const hiddenTotal = Math.max(1, STATE.hiddenPlan.length);
  const hiddenDone = STATE.hiddenPlan.filter(k=>STATE.hiddenCleared[k]).length;
  const scrub = clamp(hiddenDone / hiddenTotal, 0, 1);

  const rinse = clamp(STATE.residueHits / PHASES[3].goalHits, 0, 1);
  const dry = clamp(STATE.dryHits / 4, 0, 1);
  const rd = clamp((rinse*0.65 + dry*0.35), 0, 1);

  const missPenalty = clamp(STATE.miss * 0.04, 0, 0.25);

  STATE.cleanScore = clamp((wet*20 + soap*20 + scrub*40 + rd*20) * (1 - missPenalty), 0, 100);
}

function setQuest(text){
  STATE.questText = text || '—';
  STATE.questDone = false;
}

function completeQuest(){
  if (STATE.questDone) return;
  STATE.questDone = true;
  STATE.combo += 3;
  addMeter(-10, 'quest_bonus');
  emit('hha:event', { game:'bath', type:'quest_done', quest: STATE.questText, t: now() });
}

function checkQuest(){
  const phase = PHASES[STATE.phaseIdx]?.id;
  if (!phase || STATE.questDone) return;

  if (phase === 'WET'){
    if (STATE.wetHits >= 10) completeQuest();
  } else if (phase === 'SOAP'){
    if (STATE.soapHits >= 14) completeQuest();
  } else if (phase === 'SCRUB'){
    const hiddenDone = STATE.hiddenPlan.filter(k=>STATE.hiddenCleared[k]).length;
    if (hiddenDone >= 3 && STATE.combo >= 8) completeQuest();
  } else if (phase === 'RINSE'){
    if (STATE.residueHits >= 8 && STATE.dryHits >= 3) completeQuest();
  }
}

function awardByKind(kind, zoneKey){
  // boss rush kill counter
  if (STATE.bossRush && now() <= STATE.bossRushUntil){
    if (kind==='hidden' || kind==='oil') STATE.bossKills++;
  }

  if (kind==='water') STATE.wetHits++;
  if (kind==='foam') STATE.soapHits++;
  if (kind==='residue') STATE.residueHits++;
  if (kind==='dry') STATE.dryHits++;

  if (kind==='fakefoam'){
    // trick: no soap credit + meter rises
    addMeter(3, 'fakefoam');
    // coach (rate limited via meterLock)
    emit('hha:coach', { game:'bath', msg:'ฟองปลอม! มองหา “เงา/ประกาย” ของจุดอับนะ', t: now() });
  }

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

  // survival rewards
  if (kind==='hidden' || kind==='oil') addMeter(-4, 'clear_hidden');
  if (kind==='residue' || kind==='dry') addMeter(-2, 'cleanup');

  recomputeClean();
  checkQuest();
}

function handleShootAt(x,y, source='pointer'){
  const t = now();
  if (!STATE.running) return;

  if (t - STATE.lastShootAt < STATE.shootCdMs) return;
  STATE.lastShootAt = t;

  const hitEl = (STATE.cvrStrict || source==='hha:shoot') ? aimAssistPick(x,y) : DOC.elementFromPoint(x,y);

  if (!hitEl || !hitEl.dataset || !hitEl.dataset.id) {
    addMeter(1.2, 'shoot_miss');
    emit('hha:event', { game:'bath', type:'shoot', hit:false, source, x,y, t });
    return;
  }

  const id = hitEl.dataset.id;
  const obj = STATE.active.get(id);
  if (!obj) return;

  obj.hitCount++;
  hitEl.classList.remove('pop');
  void hitEl.offsetWidth;
  hitEl.classList.add('pop');

  const cleared = obj.hitCount >= obj.hitsToClear;

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

function pickHiddenPlan(){
  const keys = ZONES.map(z=>z.key);
  for (let i=keys.length-1;i>0;i--){
    const j = Math.floor(rnd()*(i+1));
    const tmp = keys[i]; keys[i]=keys[j]; keys[j]=tmp;
  }
  const plan = keys.slice(0,4);
  STATE.hiddenPlan = plan;

  for (const k of plan){
    const base = 2 + (rnd() < 0.35 ? 1 : 0) + (CFG.hiddenNeedAdd || 0);
    STATE.hiddenNeed[k] = clamp(base, 2, 4);
    STATE.hiddenCleared[k] = false;
  }

  STATE.oil = plan[Math.floor(rnd()*plan.length)];
  STATE.oilNeed = 3 + (DIFF==='hard' ? 1 : 0);
}

function zonePoint(zoneKey){
  const z = ZONES.find(x=>x.key===zoneKey);
  if (!z) return null;
  const p = (STATE.side==='front') ? z.front : z.back;
  const r = bodyRect();
  return { x: r.left + p.x * r.width, y: r.top + p.y * r.height };
}

function spawnForPhase(phase){
  // meter affects gameplay (survival)
  const stress = clamp(STATE.meter/100, 0, 1);
  const ttlStressMul = 1 - 0.18*stress; // stress ↑ ttl ↓
  const extraSpawnChance = 0.10 + 0.22*stress;

  const type = phase.type;

  // cap active to avoid clutter
  if (STATE.active.size >= (CFG.maxActive || 7)) return;

  const baseSpawn = phase.spawnEvery / (CFG.spawnMul || 1);
  const ttlBase = 1700 * (CFG.ttlMul || 1) * ttlStressMul;

  if (type==='water' || type==='residue'){
    const {x,y} = spawnPoint();
    makeTarget({ kind:type, x,y, ttlMs: ttlBase, hitsToClear: 1 });

    // occasional extra spawn when stressed (arcade pressure)
    if (rnd() < extraSpawnChance && STATE.active.size < (CFG.maxActive||7)){
      const p2 = spawnPoint();
      makeTarget({ kind:type, x:p2.x, y:p2.y, ttlMs: ttlBase*0.95, hitsToClear: 1 });
    }
    return;
  }

  if (type==='foam'){
    const {x,y} = spawnPoint();
    const isFake = rnd() < STATE.fakeFoamRate;
    makeTarget({ kind: isFake ? 'fakefoam' : 'foam', x,y, ttlMs: ttlBase, hitsToClear: 1 });

    if (rnd() < extraSpawnChance && STATE.active.size < (CFG.maxActive||7)){
      const p2 = spawnPoint();
      const fake2 = rnd() < (STATE.fakeFoamRate * 0.85);
      makeTarget({ kind: fake2 ? 'fakefoam' : 'foam', x:p2.x, y:p2.y, ttlMs: ttlBase*0.95, hitsToClear: 1 });
    }
    return;
  }

  if (type==='hidden'){
    const candidates = STATE.hiddenPlan.filter(k => !STATE.hiddenCleared[k]);
    if (!candidates.length) return;

    // oil appears more often when stressed
    const oilChance = 0.16 + 0.16*stress;

    if (STATE.oilNeed > 0 && rnd() < oilChance){
      const p = zonePoint(STATE.oil);
      if (p){
        makeTarget({
          kind:'oil',
          x:p.x, y:p.y,
          ttlMs: (2000 * (CFG.ttlMul||1) * ttlStressMul),
          hitsToClear: STATE.oilNeed,
          zoneKey: STATE.oil
        });
      }
      return;
    }

    const k = candidates[Math.floor(rnd()*candidates.length)];
    const p = zonePoint(k);
    if (!p) return;

    // telegraph event (think + fair)
    if (!phase._telegraphAt || now() - phase._telegraphAt > 800){
      phase._telegraphAt = now();
      emit('hha:event', { game:'bath', type:'telegraph', zoneKey: k, t: now() });
    }

    const need = STATE.hiddenNeed[k] ?? 2;
    makeTarget({
      kind:'hidden',
      x:p.x, y:p.y,
      ttlMs: (1750 * (CFG.ttlMul||1) * ttlStressMul),
      hitsToClear: Math.min(need, 4),
      zoneKey: k
    });

    // sometimes spawn a second during stress (arcade)
    if (rnd() < (0.22 + 0.28*stress) && STATE.active.size < (CFG.maxActive||7)){
      const k2 = candidates[Math.floor(rnd()*candidates.length)];
      const p2 = zonePoint(k2);
      if (p2){
        const need2 = STATE.hiddenNeed[k2] ?? 2;
        makeTarget({
          kind:'hidden',
          x:p2.x, y:p2.y,
          ttlMs: (1650 * (CFG.ttlMul||1) * ttlStressMul),
          hitsToClear: Math.min(need2, 4),
          zoneKey: k2
        });
      }
    }
    return;
  }
}

function spawnDryPack(){
  const keys = ['behindEar','armpit','behindKnee','toeGap'];
  for (const k of keys){
    const p = zonePoint(k);
    if (!p) continue;
    makeTarget({ kind:'dry', x:p.x, y:p.y, ttlMs: 2500 * (CFG.ttlMul||1), hitsToClear: 1, zoneKey: k });
  }
}

function startPhase(idx){
  STATE.phaseIdx = idx;
  const phase = PHASES[idx];
  STATE.phaseEndsAt = now() + phase.secs*1000;

  // clear phase internals
  phase._nextSpawnAt = 0;
  phase._rushSpawnAt = 0;
  phase._telegraphAt = 0;
  phase._hinted = false;

  STATE.bossRush = false;
  STATE.bossRushUntil = 0;
  STATE.bossKills = 0;

  // quests per phase
  if (phase.id==='WET')   setQuest('เปียกให้ครบ 10 ครั้ง');
  if (phase.id==='SOAP')  setQuest('ทำฟองจริงให้ครบ 14 ครั้ง');
  if (phase.id==='SCRUB') setQuest('เคลียร์จุดอับ 3 จุด + คอมโบ 8+');
  if (phase.id==='RINSE') setQuest('ล้างฟอง 8 + เช็ด 3');

  if (phase.id==='SCRUB' && STATE.hiddenPlan.length===0){
    pickHiddenPlan();
    emit('hha:coach', { game:'bath', msg:'เข้าสู่ SCRUB! ล่าจุดอับ: หลังหู/รักแร้/หลังเข่า/ซอกนิ้วเท้า', t: now() });
  }

  if (phase.id==='RINSE'){
    spawnDryPack();
    emit('hha:coach', { game:'bath', msg:'RINSE+DRY! ล้างฟองตกค้าง แล้วเช็ดให้แห้ง', t: now() });
  }

  updateHUD();
}

function endGame(){
  STATE.running = false;

  // boss bonus
  if (STATE.bossKills >= 4){
    STATE.cleanScore = clamp(STATE.cleanScore + 8, 0, 100);
    emit('hha:event', { game:'bath', type:'boss_bonus', bossKills: STATE.bossKills, t: now() });
  }

  updateHUD();

  const hiddenTotal = STATE.hiddenPlan.length || 4;
  const hiddenDone  = STATE.hiddenPlan.filter(k=>STATE.hiddenCleared[k]).length;

  const bossTxt = (STATE.bossKills >= 4) ? ` • BOSS KILLS ${STATE.bossKills} (BONUS!)` : ` • BOSS KILLS ${STATE.bossKills}`;
  UI.endSummary.textContent =
    `CLEAN ${Math.round(STATE.cleanScore)}% • HIT ${STATE.hits} • MISS ${STATE.miss} • Hidden ${hiddenDone}/${hiddenTotal}${bossTxt} • SWEAT PEAK ${Math.round(STATE.meterPeak)}%`;

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

  // button state
  if (UI.btnStart){
    UI.btnStart.disabled = false;
    UI.btnStart.textContent = 'เริ่มเล่น';
  }

  emit('hha:session_end', {
    game:'bath',
    seed: SEED,
    diff: DIFF,
    view: VIEW || 'normal',
    clean: Math.round(STATE.cleanScore),
    hits: STATE.hits,
    miss: STATE.miss,
    meterPeak: Math.round(STATE.meterPeak),
    bossKills: STATE.bossKills,
    hiddenDone,
    hiddenTotal,
    ts: Date.now()
  });
}

function tick(){
  if (!STATE.running) return;

  const t = now();
  const phase = PHASES[STATE.phaseIdx];
  const timeLeft = STATE.phaseEndsAt - t;

  // spawn scheduling
  if (!STATE.lastTick) STATE.lastTick = t;
  STATE.lastTick = t;

  // expire old targets
  expireTargets();

  // boss rush (arcade peak + survival)
  if (phase.id === 'SCRUB'){
    if (!STATE.bossRush && timeLeft <= 6000){
      STATE.bossRush = true;
      STATE.bossRushUntil = t + 6000;
      STATE.bossKills = 0;
      emit('hha:coach', { game:'bath', msg:'BOSS RUSH! 6 วิสุดท้าย เคลียร์ให้ไว!', t });
    }

    // near end hint
    if (timeLeft < 7000){
      const remaining = STATE.hiddenPlan.filter(k=>!STATE.hiddenCleared[k]);
      if (remaining.length && !phase._hinted){
        phase._hinted = true;
        const z = ZONES.find(x=>x.key===remaining[0]);
        emit('hha:coach', { game:'bath', msg:`ใกล้หมดเวลา! อย่าลืมจุดอับ: ${z?.label || 'จุดอับ'}`, t });
      }
    }
  }

  // base spawn interval (modulated)
  const baseEvery = (phase.spawnEvery / (CFG.spawnMul || 1));
  if (!phase._nextSpawnAt) phase._nextSpawnAt = t;

  // during boss rush: override with faster spawn (capped)
  if (STATE.bossRush && t <= STATE.bossRushUntil){
    if (!phase._rushSpawnAt) phase._rushSpawnAt = t;
    if (t >= phase._rushSpawnAt){
      if (STATE.active.size < (CFG.maxActive||7)) spawnForPhase(phase);
      if (STATE.active.size < (CFG.maxActive||7) && rnd() < 0.55) spawnForPhase(phase);

      const step = (360 / (CFG.bossMul || 1)) + rnd()*120;
      phase._rushSpawnAt = t + step;
    }
  } else {
    if (t >= phase._nextSpawnAt){
      if (STATE.active.size < (CFG.maxActive||7)) spawnForPhase(phase);
      phase._nextSpawnAt = t + baseEvery + (rnd()*160 - 80);
    }
  }

  // phase end?
  if (timeLeft <= 0){
    if (STATE.phaseIdx < PHASES.length - 1){
      startPhase(STATE.phaseIdx + 1);
    } else {
      endGame();
      return;
    }
  }

  checkQuest();
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
    const r = bodyRect();
    handleShootAt(r.left + r.width/2, r.top + r.height/2, 'key');
  }
}

/** hha:shoot from vr-ui.js */
function onHHAShoot(ev){
  if (!STATE.running) return;
  const d = ev.detail || {};
  if (Number.isFinite(d.x) && Number.isFinite(d.y)){
    handleShootAt(d.x, d.y, 'hha:shoot');
    return;
  }
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

  // button state during play
  if (UI.btnStart){
    UI.btnStart.disabled = true;
    UI.btnStart.textContent = 'กำลังเล่น...';
  }

  // start
  STATE.running = true;
  startPhase(0);

  emit('hha:session_start', {
    game:'bath',
    seed: SEED,
    diff: DIFF,
    view: VIEW || 'normal',
    side: STATE.side,
    ts: Date.now()
  });

  requestAnimationFrame(tick);
}

// ----------------- Wire UI -----------------
UI.btnHelp?.addEventListener('click', ()=> UI.panelHelp.classList.remove('hidden'));
UI.btnCloseHelp?.addEventListener('click', ()=> UI.panelHelp.classList.add('hidden'));

UI.btnStart?.addEventListener('click', startGame);
UI.btnReplay?.addEventListener('click', startGame);
UI.btnFlip?.addEventListener('click', flipView);

UI.btnBack?.addEventListener('click', ()=>{
  UI.panelEnd.classList.add('hidden');
});

UI.bathLayer?.addEventListener('mousedown', onPointerDown, { passive:true });
UI.bathLayer?.addEventListener('touchstart', onPointerDown, { passive:true });
WIN.addEventListener('keydown', onKeyDown);
WIN.addEventListener('hha:shoot', onHHAShoot);

// cVR strict: allow tap anywhere to shoot center
if (STATE.cvrStrict){
  UI.bathLayer?.addEventListener('click', ()=>{
    const r = bodyRect();
    handleShootAt(r.left + r.width/2, r.top + r.height/2, 'cvr-click');
  }, { passive:true });
}

// initial state
resetGame();