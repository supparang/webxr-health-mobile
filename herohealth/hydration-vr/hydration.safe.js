// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — PRODUCTION SAFE (Quest+Coach+Audio+UIFX + BOSS WAVE)
// ✅ play vs research strict
// ✅ quest director + coach director
// ✅ urgent tick + fever vignette/shake
// ✅ BOSS WAVE: last 15s -> must stay/return GREEN; out-of-green drain after grace (fair)
// ✅ emits: hha:score / quest:update / hha:coach / hha:time / hha:celebrate / hha:end
'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';
import { createHydrationQuest } from './hydration.quest.js';
import { createHydrationCoach } from './hydration.coach.js';
import { createHydrationAudio } from './hydration.audio.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const doc  = ROOT.document;

function $(id){ return doc ? doc.getElementById(id) : null; }
function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }
function pct01(x){ return Math.round(clamp(x,0,1)*100); }
function emit(name, detail){ try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{} }

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
    if (el.waterZone) el.waterZone.textContent = zone;
    if (el.waterZone2) el.waterZone2.textContent = zone;
    if (el.waterPct) el.waterPct.textContent = `${p}%`;
    if (el.waterPct2) el.waterPct2.textContent = `${p}%`;
    if (el.waterFill) el.waterFill.style.width = `${clamp(p,0,100)}%`;
  }
  function setFever(p){
    if (el.feverPct) el.feverPct.textContent = `${p}%`;
    if (el.feverFill) el.feverFill.style.width = `${clamp(p,0,100)}%`;
  }

  ROOT.addEventListener('hha:score', (ev)=>{
    const d = ev?.detail || {};
    if (el.score) el.score.textContent = String(d.score ?? 0);
    if (el.comboMax) el.comboMax.textContent = String(d.comboMax ?? 0);
    if (el.miss) el.miss.textContent = String(d.miss ?? 0);
    if (el.grade) el.grade.textContent = String(d.grade ?? 'C');
    if (d.waterZone) setWater(d.waterZone, d.waterPct ?? 50);
    if (d.feverPct != null) setFever(d.feverPct);
    if (d.shield != null && el.shield) el.shield.textContent = String(d.shield);
    if (d.progressPct != null && el.progFill && el.progText){
      el.progFill.style.width = `${clamp(d.progressPct,0,100)}%`;
      el.progText.textContent = `Progress to S (30%): ${Math.round(Number(d.progressPct||0))}%`;
    }
  });

  ROOT.addEventListener('hha:time', (ev)=>{
    const d = ev?.detail || {};
    if (el.time) el.time.textContent = String(d.sec ?? 0);
  });

  ROOT.addEventListener('quest:update', (ev)=>{
    const d = ev?.detail || {};
    if (el.qNum) el.qNum.textContent = String(d.questNum ?? 1);
    if (el.qText) el.qText.textContent = String(d.text ?? '');
    if (el.qSub) el.qSub.textContent = String(d.sub ?? '');
    if (el.qDone) el.qDone.textContent = String(d.done ?? '');
  });
}

// ---- grading/progress ----
function gradeFromScore(score, miss){
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
function progressToS(score){
  const s = clamp(Number(score)||0, 0, 340);
  return (s / 340) * 100;
}

// ---- view drag ----
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
    const t = e.target;
    if (t && (t.id==='btnStop' || t.id==='btnVR')) return;
    down=true; sx=e.clientX; sy=e.clientY; bx=ox; by=oy;
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

// ---- emoji pools ----
const EMOJI = {
  good: ['💧','🚰','🥛','🧊','🍉','🍊','🍇','🍏','🥥'],
  bad:  ['🥤','🧃','🧋','🍺','🍹','🥛‍🍫','🍶'],
  trick:['💧','🚰'],
  power:['🛡️','⭐','⚡']
};

export function bootHydration(){
  try{
    if(!doc) return;
    bindHud();

    const { diff, run, seed, time, debug } = parseQS();

    const hasRunParams = (new URLSearchParams(location.search)).has('run');
    const startOverlay = $('hvr-start');
    if (startOverlay) startOverlay.style.display = hasRunParams ? 'none' : 'flex';
    if (!hasRunParams) return;

    const isResearch = (run === 'research');

    // policy
    const allowAdaptive = !isResearch;
    const allowTrick    = !isResearch;
    const allowPower    = !isResearch;
    const allowStorm    = !isResearch;

    // fx modules (safe fallback)
    const Particles =
      (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
      ROOT.Particles || { scorePop(){}, burstAt(){}, celebrate(){} };

    // audio
    const audio = createHydrationAudio({ volume: isResearch ? 0.12 : 0.22 });

    // unlock audio on first user gesture
    const unlockOnce = async ()=>{
      try{ await audio.unlock(); }catch{}
      doc.removeEventListener('pointerdown', unlockOnce);
    };
    doc.addEventListener('pointerdown', unlockOnce, { passive:true });

    // quest+coach
    const quest = createHydrationQuest({ diff, run });
    const coach = createHydrationCoach({ run });

    // state
    let stopped=false, ended=false;

    const state = {
      run, diff, seed, time,
      score:0,
      combo:0,
      comboMax:0,
      miss:0,
      shield:0,
      fever:0,        // 0..1
      water:0.50,     // 0..1
      waterZone:'GREEN'
    };

    // ============================
    // BOSS WAVE (last 15 sec)
    // ============================
    const BOSS = {
      startAtSec: 15,        // เปิดบอสตอนเหลือ 15 วิ
      graceOutSec: 3,        // ออก GREEN ได้ฟรี 3 วิ ก่อนโดน drain
      drainPerSec: 6,        // drain คะแนนต่อวิเมื่ออยู่ LOW/HIGH เกิน grace
      feverPerSec: 0.035,    // เพิ่ม fever ต่อวิเมื่อโดน drain
      clearNeedGreenSec: (diff==='hard'? 10 : diff==='easy'? 8 : 9), // ต้องอยู่ GREEN สะสมให้ถึงเพื่อ "เคลียร์บอส"
      clearBonus: (diff==='hard'? 55 : diff==='easy'? 45 : 50)      // โบนัสเคลียร์บอส
    };

    const boss = {
      on:false,
      entered:false,
      cleared:false,
      outStreak:0,      // อยู่ LOW/HIGH ต่อเนื่องกี่วิ
      greenHold:0       // อยู่ GREEN สะสมกี่วิในช่วงบอส
    };

    function enterBoss(){
      if (boss.entered) return;
      boss.entered = true;
      boss.on = true;
      doc.body.classList.add('hha-boss');
      coach.say?.('🔥 BOSS WAVE! 15 วิท้าย — รักษาโซน GREEN ให้ได้!', 'happy', true);
      try{ audio.tick(true); }catch{}
      try{ Particles.celebrate?.('boss'); }catch{}
    }

    function leaveBoss(){
      boss.on = false;
      doc.body.classList.remove('hha-boss');
      doc.body.classList.remove('hha-boss-danger');
    }

    const look = attachDragLook();

    function setWaterZone(){
      const w = state.water;
      if (w >= 0.40 && w <= 0.62) state.waterZone = 'GREEN';
      else if (w < 0.40) state.waterZone = 'LOW';
      else state.waterZone = 'HIGH';
    }
    function bumpFever(d){ state.fever = clamp(state.fever + d, 0, 1); }
    function bumpWater(d){ state.water = clamp(state.water + d, 0, 1); setWaterZone(); }

    function setBodyFx(){
      const feverPct = pct01(state.fever);
      doc.body.classList.toggle('hha-fever', feverPct >= 55);
    }

    function applyScore(){
      const grade = gradeFromScore(state.score, state.miss);
      const prog  = progressToS(state.score);
      emit('hha:score', {
        score: state.score|0,
        comboMax: state.comboMax|0,
        miss: state.miss|0,
        grade,
        waterZone: state.waterZone,
        waterPct: pct01(state.water),
        feverPct: pct01(state.fever),
        shield: state.shield|0,
        progressPct: prog
      });
      setBodyFx();
    }

    function stopAll(){
      if (stopped) return;
      stopped=true;
      try{ factory?.stop?.(); }catch{}
      try{ look?.setEnabled?.(false); }catch{}
    }

    function endGame(){
      if (ended) return;
      ended=true;
      stopAll();
      leaveBoss();

      const grade = gradeFromScore(state.score, state.miss);
      const prog  = progressToS(state.score);
      emit('hha:end', {
        title:'จบเกมแล้ว! 💧',
        score: state.score|0,
        miss: state.miss|0,
        comboMax: state.comboMax|0,
        grade,
        progressPct: prog
      });
    }

    ROOT.addEventListener('hha:stop', endGame);

    // celebration listener -> fx+coach+audio
    ROOT.addEventListener('hha:celebrate', (ev)=>{
      const d = ev?.detail || {};
      try{ Particles.celebrate?.(d.kind || 'mini'); }catch{}
      try{ audio.celebrate(); }catch{}
      try{ coach.onQuest?.(d.kind || 'mini'); }catch{}
    });

    // start quest
    quest.start();
    setWaterZone();
    applyScore();

    // urgent timer tick + UI
    let lastTickSec = 999;
    function urgentFx(sec){
      const urgent = (sec <= 10 && sec > 0);
      doc.body.classList.toggle('hha-urgent', urgent);
      if (urgent && sec !== lastTickSec){
        lastTickSec = sec;
        try{ audio.tick(true); }catch{}
        if (sec <= 5){
          doc.body.classList.remove('hha-shake');
          void doc.body.offsetWidth;
          doc.body.classList.add('hha-shake');
        }
      }
      if (!urgent) lastTickSec = 999;
    }

    // storm interval multiplier
    function spawnIntervalMul(){
      if (!allowStorm) return 1;

      // fever 0..1 => 1..0.55
      const feverMul = clamp(1 - state.fever*0.45, 0.55, 1.0);

      // boss ทำให้ถี่ขึ้นอีกนิด (แต่ไม่บ้า)
      const bossMul = boss.on ? 0.78 : 1.0;

      return clamp(feverMul * bossMul, 0.45, 1.0);
    }

    // judge
    function judge(ch, ctx){
      const perfect = !!ctx.hitPerfect;
      const type = String(ctx.itemType||'good');
      const isTrap = (type === 'fakeGood');

      const hitX = Number(ctx.clientX ?? 0);
      const hitY = Number(ctx.clientY ?? 0);

      // ========= scoring tuning when boss =========
      const bossBonus = boss.on ? 2 : 0;      // good hit เพิ่มอีกนิดในบอส
      const bossPenalty = boss.on ? 3 : 0;    // bad hit โดนหนักขึ้น (ยุติธรรม: โดนเฉพาะตอน "โดนจริง")

      // powerups
      if (type === 'power'){
        if (ch === '🛡️') state.shield = clamp(state.shield + 1, 0, 5);
        else if (ch === '⚡'){
          state.fever = clamp(state.fever - 0.18, 0, 1);
          const toward = (0.52 - state.water) * 0.45;
          bumpWater(toward);
        } else {
          state.score += 25;
          bumpWater(+0.03);
        }

        state.combo = clamp(state.combo + 1, 0, 9999);
        state.comboMax = Math.max(state.comboMax, state.combo);

        try{ Particles.burstAt?.(hitX, hitY, 'POWER'); }catch{}
        try{ Particles.scorePop?.(hitX, hitY, '+', 1); }catch{}
        try{ audio.power(); }catch{}
        coach.onHit({ power:true });

        quest.onHit({ isGood:true, isPower:true, itemType:'power', perfect });
        applyScore();
        return { scoreDelta: 25, good:true, power:true };
      }

      // bad/trap
      if (!ctx.isGood || isTrap){
        // shield block => not MISS
        if (state.shield > 0){
          state.shield--;
          bumpFever(+0.02);
          state.combo = 0;

          try{ Particles.burstAt?.(hitX, hitY, 'BLOCK'); }catch{}
          try{ audio.tick(false); }catch{}
          coach.onHit({ blocked:true });

          quest.onHit({ isGood:false, isPower:false, itemType:type, blocked:true });
          applyScore();
          return { scoreDelta: 0, good:false, blocked:true };
        }

        const penalty = 12 + bossPenalty;
        state.score -= penalty;
        state.miss  += 1;
        state.combo = 0;

        // boss ทำให้ fever ดันแรงขึ้นนิด
        bumpFever(boss.on ? +0.14 : +0.12);

        // โดน bad แล้วน้ำจะไหลไป HIGH ง่ายขึ้น (กดดันให้กลับ GREEN)
        bumpWater(boss.on ? +0.10 : +0.08);

        doc.body.classList.remove('hha-shake');
        void doc.body.offsetWidth;
        doc.body.classList.add('hha-shake');

        try{ Particles.burstAt?.(hitX, hitY, 'BAD'); }catch{}
        try{ Particles.scorePop?.(hitX, hitY, `-${penalty}`, 0); }catch{}
        try{ audio.miss(); }catch{}
        coach.onHit({ bad:true });

        quest.onHit({ isGood:false, isPower:false, itemType:type, perfect, blocked:false });
        applyScore();
        return { scoreDelta: -penalty, good:false };
      }

      // good
      const base = (10 + bossBonus) + (perfect ? (boss.on ? 7 : 5) : 0);
      state.score += base;

      state.combo = clamp(state.combo + 1, 0, 9999);
      state.comboMax = Math.max(state.comboMax, state.combo);

      // good ดึงน้ำกลับ GREEN
      const pull = (0.52 - state.water) * (boss.on ? 0.28 : 0.22);
      bumpWater(pull + (boss.on ? 0.026 : 0.02));

      bumpFever(perfect ? (boss.on ? -0.04 : -0.03) : (boss.on ? -0.022 : -0.015));

      try{ Particles.burstAt?.(hitX, hitY, perfect ? 'PERFECT' : 'GOOD'); }catch{}
      try{ Particles.scorePop?.(hitX, hitY, `+${base}`, 1); }catch{}
      try{ audio.good(perfect); }catch{}
      coach.onHit({ good:true, perfect });

      quest.onHit({ isGood:true, isPower:false, itemType:'good', perfect });
      applyScore();
      return { scoreDelta: base, good:true, perfect };
    }

    function onExpire(info){
      // miss rule: good expired => miss, bad expired => no penalty
      const it = String(info?.itemType || '');
      const isGood = !!info?.isGood;
      const isTrap = (it === 'fakeGood');

      if (isGood && !isTrap){
        state.miss += 1;
        state.combo = 0;
        bumpFever(boss.on ? +0.06 : +0.05);
        bumpWater(boss.on ? -0.05 : -0.04);
        applyScore();
      }
    }

    // factory config
    const factoryCfg = {
      modeKey: 'hydration',
      difficulty: diff,
      duration: time,

      spawnHost:'#hvr-layer',
      boundsHost:'#hvr-bounds',
      spawnAroundCrosshair:false,
      spawnStrategy:'grid9',
      minSeparation:0.98,
      maxSpawnTries:18,

      pools:{ good:EMOJI.good, bad:EMOJI.bad, trick: allowTrick ? EMOJI.trick : [] },
      goodRate:0.64,

      powerups: allowPower ? EMOJI.power : [],
      powerRate: allowPower ? 0.12 : 0,
      powerEvery: allowPower ? 6 : 999,

      trickRate: allowTrick ? 0.10 : 0.0,

      allowAdaptive,
      seed: (isResearch && seed) ? seed : null,
      rng:null,

      spawnIntervalMul: (isResearch ? 1 : spawnIntervalMul),

      judge,
      onExpire
    };

    // start boot
    let factory = null;

    // ===== time loop side effects (boss+drain+coach) =====
    ROOT.addEventListener('hha:time', (ev)=>{
      const sec = Number(ev?.detail?.sec ?? 0);

      // enter boss at last 15 sec
      if (!boss.entered && sec <= BOSS.startAtSec && sec > 0) enterBoss();

      // urgent visuals
      urgentFx(sec);

      // quest tick
      quest.tick(sec, state.waterZone);

      // coach tick
      coach.onTick({ sec, zone: state.waterZone, feverPct: pct01(state.fever) });

      // tiny tick every 15 sec (non-urgent)
      if (!isResearch && sec > 0 && sec % 15 === 0){
        try{ audio.tick(false); }catch{}
      }

      // ===== BOSS LOGIC =====
      if (boss.on && sec > 0){
        if (state.waterZone === 'GREEN'){
          boss.outStreak = 0;
          doc.body.classList.remove('hha-boss-danger');

          if (!boss.cleared){
            boss.greenHold++;
            // เคลียร์บอสเมื่อสะสม GREEN ถึงเป้า
            if (boss.greenHold >= BOSS.clearNeedGreenSec){
              boss.cleared = true;
              state.score += BOSS.clearBonus;
              try{ Particles.celebrate?.('goal'); }catch{}
              try{ audio.celebrate(); }catch{}
              coach.say?.(`เคลียร์บอสแล้ว! +${BOSS.clearBonus} 🎉`, 'happy', true);
              // ส่งเป็น celebrate เพื่อให้ FX ชั้นรวมทำงาน
              emit('hha:celebrate', { kind:'goal', id:'boss' });
              applyScore();
            }
          }
        } else {
          boss.outStreak++;
          // เตือนก่อนโดน drain
          if (boss.outStreak === 1){
            coach.say?.('ออกนอก GREEN แล้ว! รีบกลับเข้า GREEN!', 'sad', true);
          }
          // danger overlay เมื่อใกล้โดน drain
          if (boss.outStreak >= Math.max(1, BOSS.graceOutSec - 1)){
            doc.body.classList.add('hha-boss-danger');
          }

          if (boss.outStreak > BOSS.graceOutSec){
            // FAIR DRAIN: โดนเฉพาะตอน "อยู่นอก GREEN เกิน grace" เท่านั้น
            state.score -= BOSS.drainPerSec;
            bumpFever(BOSS.feverPerSec);

            // shake เบาๆ ตอนโดน drain (ไม่ถี่เกิน)
            if (boss.outStreak % 2 === 0){
              doc.body.classList.remove('hha-shake');
              void doc.body.offsetWidth;
              doc.body.classList.add('hha-shake');
            }

            try{ audio.tick(true); }catch{}
            applyScore();
          }
        }
      }

      if (sec <= 0) endGame();
    });

    factoryBoot(factoryCfg).then((h)=>{
      factory = h;

      // tap anywhere => crosshair shoot
      doc.addEventListener('pointerdown', (e)=>{
        if (stopped || ended) return;
        const t = e.target;
        if (t && (t.id==='btnStop'||t.id==='btnVR'||t.id==='endReplay'||t.id==='endClose')) return;
        try{ h?.shootCrosshair?.(); }catch{}
      }, { passive:true });

    }).catch((err)=>{
      fatal('Failed to boot hydration.safe.js\n' + String(err?.message || err), err);
    });

    if (debug) console.log('[HydrationVR] boot', { diff, run, time, seed, factoryCfg, BOSS });

  }catch(err){
    fatal('Hydration.safe.js crashed\n' + String(err?.message || err), err);
  }
}

export default { bootHydration };