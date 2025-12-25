// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION SAFE (Play/Research strict policy)
// ✅ FIX: end/stop guard (ไม่ค้าง, ไม่ซ้ำ)
// ✅ Play vs Research:
//    - play: adaptive ON + storm + trick + powerups
//    - research: adaptive OFF + seeded RNG (if seed) + fixed cadence by diff
// ✅ Spawn: spread (spawnAroundCrosshair:false + spawnStrategy:'grid9')
// ✅ HUD fail-safe (ไม่พบ element ก็ไม่พัง)
// ✅ Emits events: hha:score / quest:update / hha:coach / hha:fever / hha:end / hha:time
'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

// ---------- helpers ----------
const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const doc  = ROOT.document;

function $(id){ return doc ? doc.getElementById(id) : null; }
function clamp(v, a, b){ v = Number(v)||0; return v<a?a : (v>b?b:v); }
function pct(v){ return Math.round(clamp(v,0,1)*100); }
function safeText(el, t){ if(el) el.textContent = String(t); }
function safeWidth(el, p){ if(el) el.style.width = String(clamp(p,0,100)) + '%'; }

function parseQS(){
  const qs = new URLSearchParams(ROOT.location.search || '');
  const diff = String(qs.get('diff') || 'normal').toLowerCase();
  const run  = String(qs.get('run')  || 'play').toLowerCase();
  const seed = String(qs.get('seed') || '').trim();
  const time = clamp(qs.get('time') || 90, 20, 180);
  const debug = (qs.get('debug') === '1' || qs.get('debug') === 'true');
  return {
    diff: (diff==='easy'||diff==='hard'||diff==='normal') ? diff : 'normal',
    run:  (run==='research') ? 'research' : 'play',
    seed,
    time,
    debug
  };
}

function emit(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

// ---------- minimal fatal overlay ----------
function fatal(msg, err){
  console.error('[HydrationVR] FATAL:', msg, err||'');
  if(!doc) return;
  let box = doc.getElementById('hhaFatal');
  if(!box){
    box = doc.createElement('div');
    box.id = 'hhaFatal';
    Object.assign(box.style, {
      position:'fixed', inset:'0', zIndex:'9999',
      background:'rgba(2,6,23,.92)', color:'#e5e7eb',
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'18px', fontFamily:'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
    });
    box.innerHTML = `
      <div style="max-width:680px;border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:16px;background:rgba(15,23,42,.55)">
        <div style="font-weight:900;font-size:18px;margin-bottom:8px">เข้าเกมไม่ได้</div>
        <div id="hhaFatalMsg" style="white-space:pre-wrap;color:rgba(229,231,235,.92);line-height:1.35"></div>
        <div style="margin-top:10px;color:rgba(148,163,184,.95);font-size:12px">Tip: ตรวจ path ของไฟล์ .js และล้าง cache (Hard reload)</div>
      </div>
    `;
    doc.body.appendChild(box);
  }
  const m = doc.getElementById('hhaFatalMsg');
  if(m) m.textContent = String(msg || 'Unknown error');
}

// ---------- HUD binder (local) ----------
function bindHud(){
  const el = {
    score: $('hha-score'),
    comboMax: $('hha-comboMax'),
    miss: $('hha-miss'),
    time: $('hha-time'),
    grade: $('hha-grade'),
    waterZone: $('hha-water-zone'),
    waterPct: $('hha-water-pct'),
    waterFill: $('hha-water-fill'),
    waterZone2: $('hha-water-zone2'),
    waterPct2: $('hha-water-pct2'),
    feverFill: $('hha-fever-fill'),
    feverPct: $('hha-fever-pct'),
    shield: $('hha-shield'),
    qNum: $('hha-quest-num'),
    qText: $('hha-quest-text'),
    qSub: $('hha-quest-sub'),
    qDone: $('hha-quest-done'),
    progFill: $('hha-progress-fill'),
    progText: $('hha-progress-text')
  };

  function setWater(zone, p){
    safeText(el.waterZone, zone);
    safeText(el.waterZone2, zone);
    safeText(el.waterPct,  `${p}%`);
    safeText(el.waterPct2, `${p}%`);
    safeWidth(el.waterFill, p);
  }
  function setFever(p){
    safeText(el.feverPct, `${p}%`);
    safeWidth(el.feverFill, p);
  }

  ROOT.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    safeText(el.score, d.score ?? 0);
    safeText(el.comboMax, d.comboMax ?? 0);
    safeText(el.miss, d.miss ?? 0);
    safeText(el.grade, d.grade ?? 'C');
    if (d.waterZone) setWater(d.waterZone, d.waterPct ?? 50);
    if (d.feverPct != null) setFever(d.feverPct);
    if (d.shield != null) safeText(el.shield, d.shield);
    if (d.progressPct != null){
      safeWidth(el.progFill, d.progressPct);
      safeText(el.progText, `Progress to S (30%): ${Math.round(d.progressPct)}%`);
    }
  });

  ROOT.addEventListener('hha:time', (ev)=>{
    const d = ev?.detail || {};
    safeText(el.time, d.sec ?? 0);
  });

  ROOT.addEventListener('quest:update', (ev)=>{
    const d = ev?.detail || {};
    safeText(el.qNum, d.questNum ?? 1);
    safeText(el.qText, d.text ?? 'Goal: 0/0 • Mini: 0/0');
    safeText(el.qSub, d.sub ?? '');
    safeText(el.qDone, d.done ?? '');
  });
}

// ---------- game rules ----------
const EMOJI = {
  good: ['💧','🚰','🥛','🧊','🍉','🍊','🍇','🍏','🥥'],
  bad:  ['🥤','🧃','🧋','🍺','🍹','🥛‍🍫','🍶'],
  trick:['💧','🚰'],                 // จะถูกแต่งเป็น fakeGood (ล่อให้พลาด)
  power:['🛡️','⭐','⚡']             // shield / bonus / cleanse
};

function gradeFromScore(score, miss){
  // simple: miss เยอะลดเกรด
  const s = Number(score)||0;
  const m = Number(miss)||0;
  const eff = s - m*8;
  if (eff >= 520) return 'SSS';
  if (eff >= 420) return 'SS';
  if (eff >= 340) return 'S';
  if (eff >= 260) return 'A';
  if (eff >= 180) return 'B';
  return 'C';
}

function computeProgressToS(score){
  // คิดความคืบหน้าจาก 0..340 (S)
  const s = clamp(Number(score)||0, 0, 340);
  return (s / 340) * 100;
}

// ---------- view control (drag) ----------
function attachDragLook(){
  const bounds = $('hvr-bounds');
  const world  = $('hvr-world');
  if(!bounds || !world) return { reset(){}, setEnabled(){} };

  let ox=0, oy=0;
  let down=false, sx=0, sy=0, bx=0, by=0;
  let enabled=true;

  const maxX = () => Math.max(18, (bounds.clientWidth||1) * 0.10);
  const maxY = () => Math.max(18, (bounds.clientHeight||1) * 0.12);

  function apply(){
    const mx=maxX(), my=maxY();
    ox = clamp(ox, -mx, mx);
    oy = clamp(oy, -my, my);
    world.style.transform = `translate3d(${Math.round(ox)}px, ${Math.round(oy)}px, 0)`;
  }
  function reset(){ ox=0; oy=0; apply(); }
  function setEnabled(v){ enabled=!!v; }

  bounds.addEventListener('pointerdown', (e)=>{
    if(!enabled) return;
    // อย่าเริ่ม drag ถ้ากดปุ่ม
    const t = e.target;
    if (t && (t.id==='btnStop' || t.id==='btnVR')) return;
    down=true;
    sx=e.clientX; sy=e.clientY;
    bx=ox; by=oy;
  }, {passive:true});
  bounds.addEventListener('pointermove', (e)=>{
    if(!enabled || !down) return;
    const dx=e.clientX - sx;
    const dy=e.clientY - sy;
    ox = bx + dx*0.55;
    oy = by + dy*0.55;
    apply();
  }, {passive:true});
  bounds.addEventListener('pointerup', ()=>{ down=false; }, {passive:true});
  bounds.addEventListener('pointercancel', ()=>{ down=false; }, {passive:true});

  ROOT.addEventListener('hha:resetView', reset);
  return { reset, setEnabled };
}

// ---------- main boot ----------
export function bootHydration(){
  try{
    if(!doc) return;
    bindHud();

    const { diff, run, seed, time, debug } = parseQS();

    // ถ้าไม่มี query เลย → แสดง start overlay (ให้ html ดูแล)
    const hasRunParams = (new URLSearchParams(location.search)).has('run');
    const startOverlay = $('hvr-start');
    if (startOverlay) startOverlay.style.display = hasRunParams ? 'none' : 'flex';
    if (!hasRunParams) return;

    const spawnHost  = '#hvr-layer';
    const boundsHost = '#hvr-bounds';

    // policy
    const isResearch = (run === 'research');
    const allowAdaptive = !isResearch;          // ✅ play only
    const allowTrick    = !isResearch;
    const allowPower    = !isResearch;
    const allowStorm    = !isResearch;

    // state
    let stopped = false;
    let ended   = false;

    const state = {
      run, diff, seed, time,
      score: 0,
      combo: 0,
      comboMax: 0,
      miss: 0,
      shield: 0,
      fever: 0,          // 0..1
      water: 0.50,       // 0..1 (GREEN sweet spot around 0.5)
      waterZone: 'GREEN',
      goalsDone: 0,
      minisDone: 0,
      questNum: 1
    };

    const look = attachDragLook();

    function setWaterZone(){
      const w = state.water;
      if (w >= 0.40 && w <= 0.62) state.waterZone = 'GREEN';
      else if (w < 0.40) state.waterZone = 'LOW';
      else state.waterZone = 'HIGH';
    }
    function bumpFever(delta){
      state.fever = clamp(state.fever + delta, 0, 1);
    }
    function bumpWater(delta){
      state.water = clamp(state.water + delta, 0, 1);
      setWaterZone();
    }

    function applyScore(){
      const g = gradeFromScore(state.score, state.miss);
      const prog = computeProgressToS(state.score);
      emit('hha:score', {
        score: state.score|0,
        comboMax: state.comboMax|0,
        miss: state.miss|0,
        grade: g,
        waterZone: state.waterZone,
        waterPct: pct(state.water),
        feverPct: pct(state.fever),
        shield: state.shield|0,
        progressPct: prog
      });
    }

    // simple quest text (เน้น 2 เรื่อง: รักษา GREEN + หลีกเลี่ยงเครื่องดื่มหวาน)
    function updateQuestUI(){
      const goalText = `Goal: รักษาโซน GREEN ให้ได้นานที่สุด`;
      const miniText = `Mini: หลีกเลี่ยง 🥤 / 🧋 (โดนแล้ว MISS)`;
      emit('quest:update', {
        questNum: state.questNum,
        text: `${goalText}`,
        sub: `Water Zone: ${state.waterZone}`,
        done: `Goals done: ${state.goalsDone} • Minis done: ${state.minisDone}`
      });
    }

    // ----- judge -----
    function judge(ch, ctx){
      // ctx: { isGood,isPower,itemType,hitPerfect,hitDistNorm,... }
      const perfect = !!ctx.hitPerfect;
      const type = String(ctx.itemType||'good');

      // fakeGood = trap (นับเป็น bad เมื่อโดน)
      const isTrap = (type === 'fakeGood');

      // powerups
      if (type === 'power'){
        if (ch === '🛡️'){
          state.shield = clamp(state.shield + 1, 0, 5);
        } else if (ch === '⚡'){
          // cleanse: ลด fever + ดันกลับเข้า GREEN
          state.fever = clamp(state.fever - 0.18, 0, 1);
          const toward = (0.52 - state.water) * 0.45;
          bumpWater(toward);
        } else {
          // ⭐ bonus
          state.score += 25;
          bumpWater(+0.03);
        }
        state.combo = clamp(state.combo + 1, 0, 9999);
        state.comboMax = Math.max(state.comboMax, state.combo);
        applyScore();
        updateQuestUI();
        return { scoreDelta: 25, good:true, power:true };
      }

      // bad / trap
      if (!ctx.isGood || isTrap){
        // shield block = ไม่เป็น MISS (ตามแนวคิด “บล็อกแล้วไม่นับ”)
        if (state.shield > 0){
          state.shield--;
          bumpFever(+0.02);
          state.combo = 0;
          applyScore();
          updateQuestUI();
          return { scoreDelta: 0, good:false, blocked:true };
        }

        state.score -= 12;
        state.miss  += 1;
        state.combo = 0;
        bumpFever(+0.12);
        bumpWater(+0.08); // เครื่องดื่มหวานทำให้ “HIGH” ง่ายขึ้น
        applyScore();
        updateQuestUI();
        return { scoreDelta: -12, good:false };
      }

      // good
      const base = 10 + (perfect ? 5 : 0);
      state.score += base;
      state.combo = clamp(state.combo + 1, 0, 9999);
      state.comboMax = Math.max(state.comboMax, state.combo);

      // good ช่วยดันกลับเข้า GREEN
      const pull = (0.52 - state.water) * 0.22;
      bumpWater(pull + 0.02);

      // เล่นดี fever ลดนิด
      bumpFever(perfect ? -0.03 : -0.015);

      applyScore();
      updateQuestUI();
      return { scoreDelta: base, good:true, perfect };
    }

    function onExpire(info){
      // MISS definition (สำหรับ hydration): good หมดอายุ = miss, bad หมดอายุไม่ลงโทษ
      const it = String(info?.itemType || '');
      const isGood = !!info?.isGood;
      const isTrap = (it === 'fakeGood');

      if (isGood && !isTrap){
        state.miss += 1;
        state.combo = 0;
        bumpFever(+0.05);
        // ปล่อยให้น้ำแกว่งไปโซน LOW นิด ๆ เมื่อพลาดน้ำดี
        bumpWater(-0.04);
        applyScore();
        updateQuestUI();
      }
    }

    // storm (ถี่ขึ้นเมื่อ fever สูง)
    function spawnIntervalMul(){
      if (!allowStorm) return 1;
      // fever 0..1 => mul 1..0.55
      const f = state.fever;
      return clamp(1 - f*0.45, 0.55, 1.0);
    }

    // init
    setWaterZone();
    applyScore();
    updateQuestUI();

    // ----- factory config -----
    const factoryCfg = {
      modeKey: 'hydration',
      difficulty: diff,
      duration: time,

      // ✅ spread (กันกองกลาง/เป็นเสา)
      spawnHost,
      boundsHost,
      spawnAroundCrosshair: false,
      spawnStrategy: 'grid9',
      minSeparation: 0.98,
      maxSpawnTries: 18,

      // pools
      pools: { good: EMOJI.good, bad: EMOJI.bad, trick: allowTrick ? EMOJI.trick : [] },
      goodRate: 0.64,

      powerups: allowPower ? EMOJI.power : [],
      powerRate: allowPower ? 0.12 : 0,
      powerEvery: allowPower ? 6 : 999,

      trickRate: allowTrick ? 0.10 : 0.0,

      // policy
      allowAdaptive,
      seed: (isResearch && seed) ? seed : null,  // ✅ research uses seed (ถ้าให้มา)
      rng: null,

      spawnIntervalMul: (isResearch ? 1 : spawnIntervalMul),

      judge,
      onExpire,

      // rhythm optional (off by default)
      rhythm: null
    };

    // boot factory
    let factory = null;

    // stop/end guard
    function stopAll(){
      if (stopped) return;
      stopped = true;
      try{ factory?.stop?.(); }catch{}
      try{ look?.setEnabled?.(false); }catch{}
    }

    function endGame(){
      if (ended) return;
      ended = true;
      stopAll();

      const grade = gradeFromScore(state.score, state.miss);
      const progressPct = computeProgressToS(state.score);

      emit('hha:end', {
        title: 'จบเกมแล้ว! 💧',
        score: state.score|0,
        miss: state.miss|0,
        comboMax: state.comboMax|0,
        grade,
        progressPct
      });
    }

    ROOT.addEventListener('hha:stop', endGame, { once:false });

    // time sync — เมื่อ time=0 ให้จบเอง
    ROOT.addEventListener('hha:time', (ev)=>{
      const sec = Number(ev?.detail?.sec ?? 0);
      if (sec <= 0) endGame();
    });

    // start
    factoryBoot(factoryCfg).then((h)=>{
      factory = h;
      // ยิงกลางจอ: tap ที่กึ่งกลาง (ง่าย ๆ)
      doc.addEventListener('pointerdown', (e)=>{
        if (stopped || ended) return;
        // อย่ายิงถ้ากดบนปุ่ม
        const t = e.target;
        if (t && (t.id==='btnStop' || t.id==='btnVR' || t.id==='endReplay' || t.id==='endClose')) return;
        // ยิงเฉพาะ tap ไม่ลาก
        // (ถ้าต้องการ “tap ยิงทุกครั้ง” ปรับได้)
        try{ h?.shootCrosshair?.(); }catch{}
      }, { passive:true });
    }).catch((err)=>{
      fatal('Failed to boot hydration.safe.js\n' + String(err?.message || err), err);
    });

    // debug log
    if (debug){
      console.log('[HydrationVR] boot', { diff, run, time, seed, factoryCfg });
    }

  }catch(err){
    fatal('Hydration.safe.js crashed\n' + String(err?.message || err), err);
  }
}

export default { bootHydration };
