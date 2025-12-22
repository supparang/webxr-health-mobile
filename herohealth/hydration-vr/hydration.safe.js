// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — DOM/VR Hybrid (Bubble targets + Water zone + Goal/Mini + End summary)
// ✅ ใช้ mode-factory (spawnHost/boundsHost + exclusion + center-biased spawn)
// ✅ เป้า “ใสเหมือนฟองสบู่” + ขอบสีรุ้งชัด (แทบมองไม่เห็นตรงกลาง แต่ขอบสวย)
// ✅ Goals/Mini แบบที่คุย: อยู่ GREEN ให้มาก / จำกัดเวลา BLUE+RED / Combo / Perfect / NoJunk
// ✅ Tap ว่าง ๆ = ยิง Crosshair (เหมือน VR) ช่วยเล่นบนมือถือ
// ✅ จบเกมมีสรุป + ส่ง event ให้ HUD/particles ถ้ามี

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

// optional (ถ้ามีในโปรเจกต์)
import { ensureWaterGauge, setWaterGauge, zoneFrom } from '../vr/ui-water.js';

const ROOT = (typeof window !== 'undefined') ? window : globalThis;
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop() {}, burstAt() {}, celebrateQuestFX() {}, celebrateAllQuestsFX() {} };

function clamp(v, a, b){ v = Number(v)||0; return v < a ? a : (v > b ? b : v); }
function qs(name, fallback=null){
  try{
    const u = new URL(location.href);
    return u.searchParams.get(name) ?? fallback;
  }catch{ return fallback; }
}

function $(sel){ try{ return DOC.querySelector(sel); }catch{ return null; } }
function setText(el, t){ if (el) el.textContent = String(t); }

function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function zoneFromWaterLocal(w){
  // ให้ GREEN เป็น “โซนดี” ชัด ๆ
  // RED 0-29 | BLUE 30-54 | GREEN 55-100
  if (w < 30) return 'RED';
  if (w < 55) return 'BLUE';
  return 'GREEN';
}

function gradeFrom(score, goalsCleared, minisCleared, miss, greenSec, targetGreenSec){
  const gProg = clamp(greenSec / Math.max(1, targetGreenSec), 0, 1);
  let pct = (goalsCleared/2)*45 + (minisCleared/3)*35 + gProg*20;
  pct -= miss * 2.0;
  pct = clamp(pct, 0, 100);

  let grade = 'C';
  if (pct >= 95) grade = 'SSS';
  else if (pct >= 88) grade = 'SS';
  else if (pct >= 80) grade = 'S';
  else if (pct >= 70) grade = 'A';
  else if (pct >= 58) grade = 'B';
  else grade = 'C';

  return { grade, pct };
}

// ------------------------------------------------------
// Bubble skin (decorateTarget for mode-factory)
// ------------------------------------------------------
function decorateBubble(el, parts, data, meta){
  const { inner, ring, icon, wiggle } = parts || {};
  const itemType = data && data.itemType;

  // base “almost invisible”
  el.style.background = 'transparent';
  el.style.boxShadow = 'none';

  // inner: แทบใส + เงานุ่ม + highlight
  if (inner){
    inner.style.background =
      'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.14), rgba(255,255,255,0.04) 42%, rgba(0,0,0,0.06) 70%, rgba(0,0,0,0.10) 100%)';
    inner.style.boxShadow =
      'inset 0 10px 18px rgba(255,255,255,0.10), inset 0 -12px 24px rgba(0,0,0,0.22)';
    inner.style.backdropFilter = 'blur(2px)';
  }

  // icon: ชัด แต่ยังนุ่ม
  if (icon){
    icon.style.filter = 'drop-shadow(0 6px 8px rgba(0,0,0,0.55))';
  }

  // ring: ขอบสีรุ้ง (iridescent) แบบฟองสบู่
  if (ring){
    ring.style.border = '0';
    ring.style.boxShadow = '0 0 22px rgba(255,255,255,0.10)';
    ring.style.width  = (meta.size * 1.02) + 'px';
    ring.style.height = (meta.size * 1.02) + 'px';

    // ใช้ background + mask ทำเป็น “ขอบวงแหวน”
    ring.style.background =
      'conic-gradient(from 210deg, rgba(255,0,128,.65), rgba(0,200,255,.65), rgba(120,255,120,.55), rgba(255,240,120,.55), rgba(255,140,80,.60), rgba(255,0,128,.65))';
    ring.style.webkitMask =
      'radial-gradient(circle at 50% 50%, transparent 62%, #000 66%, #000 100%)';
    ring.style.mask =
      'radial-gradient(circle at 50% 50%, transparent 62%, #000 66%, #000 100%)';
    ring.style.opacity = '0.95';
  }

  // เพิ่ม “ไฮไลต์จุด” เล็ก ๆ ให้เหมือนฟอง
  if (wiggle){
    wiggle.style.filter = 'drop-shadow(0 16px 28px rgba(0,0,0,0.35))';
  }

  // tint ตามชนิด (bad/power/fakeGood) แบบ “ขอบ” ไม่ทึบ
  if (itemType === 'bad'){
    if (ring) ring.style.opacity = '0.92';
    if (inner) inner.style.background =
      'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.10), rgba(255,255,255,0.03) 42%, rgba(255,80,80,0.10) 78%, rgba(0,0,0,0.12) 100%)';
  } else if (itemType === 'power'){
    if (inner) inner.style.background =
      'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.14), rgba(255,255,255,0.04) 42%, rgba(255,210,80,0.12) 78%, rgba(0,0,0,0.10) 100%)';
  } else if (itemType === 'fakeGood'){
    if (inner) inner.style.background =
      'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.14), rgba(255,255,255,0.04) 42%, rgba(170,120,255,0.10) 78%, rgba(0,0,0,0.10) 100%)';
  }
}

// ------------------------------------------------------
// boot()
// ------------------------------------------------------
export async function boot(opts = {}){
  const diff = String(opts.difficulty || qs('diff','easy') || 'easy').toLowerCase();
  const duration = clamp(Number(opts.duration ?? qs('time','90') ?? 90), 20, 180);

  const playfield = $('#hvr-playfield') || $('#hvr-wrap') || DOC.body;

  // UI refs
  const elZoneText = $('#hha-water-zone-text');
  const elWaterSt  = $('#hha-water-status');
  const elFill     = $('#hha-water-fill');

  const elScore    = $('#hha-score-main');
  const elComboMax = $('#hha-combo-max');
  const elMiss     = $('#hha-miss');

  const elGoalTxt  = $('#hha-quest-goal');
  const elMiniTxt  = $('#hha-quest-mini');
  const elGoalCnt  = $('#hha-goal-count');
  const elMiniCnt  = $('#hha-mini-count');

  const elGradeBadge = $('#hha-grade-badge');
  const elGradeFill  = $('#hha-grade-progress-fill');
  const elGradeTxt   = $('#hha-grade-progress-text');

  const blink = $('#hvr-screen-blink');
  const endBox = $('#hvr-end');

  // init water gauge (if module exists)
  try{ ensureWaterGauge && ensureWaterGauge(); }catch{}

  // difficulty tuning
  const T = {
    easy:   { greenTarget: 14, badMax: 36, waterDrain: 0.35, goodUp: 8.2, badDown: 12.0, fakeDown: 7.0, powerUp: 12.0 },
    normal: { greenTarget: 16, badMax: 32, waterDrain: 0.40, goodUp: 8.0, badDown: 13.0, fakeDown: 7.5, powerUp: 12.5 },
    hard:   { greenTarget: 18, badMax: 28, waterDrain: 0.46, goodUp: 7.6, badDown: 14.0, fakeDown: 8.2, powerUp: 13.5 }
  }[diff] || { greenTarget: 16, badMax: 32, waterDrain: 0.40, goodUp: 8.0, badDown: 13.0, fakeDown: 7.5, powerUp: 12.5 };

  // pools
  const GOOD = ['💧','🫧','🚰','🥛'];
  const BAD  = ['🥤','🍩','🍟','🍔'];
  const POWER = ['⭐','🛡️','⚡'];

  // state
  let stopped = false;
  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let miss = 0;

  let water = 50; // 0..100
  let zone = zoneFromWaterLocal(water);

  let secGreen = 0;
  let secBad   = 0; // BLUE+RED รวม
  let secTotal = 0;

  let perfectCount = 0;
  let junkHits = 0;

  let goalsCleared = 0;
  let minisCleared = 0;
  let goal1Done = false;
  let goal2Done = false;

  let miniComboDone = false;
  let miniPerfectDone = false;
  let miniNoJunkDone = false;

  // storm wave
  let stormUntilTs = 0;
  function now(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
  function spawnMul(){
    const t = now();
    if (t < stormUntilTs) return 0.65; // ถี่ขึ้น
    // แรงกระตุ้นตามโซน
    if (zone === 'RED') return 0.78;
    if (zone === 'BLUE') return 0.92;
    return 1.00;
  }
  function triggerStorm(ms=4200){
    stormUntilTs = Math.max(stormUntilTs, now() + ms);
  }

  function setBlink(type){
    if (!blink) return;
    blink.classList.remove('on','good','bad','perfect');
    if (type) blink.classList.add('on', type);
    ROOT.setTimeout(()=> blink.classList.remove('on'), 120);
  }

  function updateWaterUI(){
    zone = zoneFromWaterLocal(water);

    if (elZoneText) elZoneText.textContent = 'ZONE ' + zone;
    if (elWaterSt) elWaterSt.textContent = `${zone} ${Math.round(water)}%`;
    if (elFill) elFill.style.width = clamp(water,0,100) + '%';

    // ui-water.js (ถ้ามี)
    try{
      if (setWaterGauge) setWaterGauge(water);
    }catch{}

    dispatch('hha:water', { water, zone });
  }

  function updateHUD(){
    setText(elScore, score);
    setText(elComboMax, comboMax);
    setText(elMiss, miss);

    setText(elGoalCnt, goalsCleared);
    setText(elMiniCnt, minisCleared);

    const g = gradeFrom(score, goalsCleared, minisCleared, miss, secGreen, T.greenTarget);
    setText(elGradeBadge, g.grade);

    if (elGradeFill) elGradeFill.style.width = clamp(g.pct,0,100) + '%';
    if (elGradeTxt) elGradeTxt.textContent = `Progress to S: ${Math.round(clamp(g.pct,0,100))}%`;

    dispatch('hha:score', { score, combo, comboMax, miss, grade: g.grade, gradePct: g.pct });
    dispatch('hha:stat', {
      score, combo, comboMax, miss,
      water, zone,
      secGreen, secBad, secTotal,
      perfectCount, junkHits,
      goalsCleared, minisCleared
    });
  }

  function updateQuestText(){
    // Goal lines (แบบที่คุณโชว์ในภาพ)
    // Goal1: อยู่ GREEN >= target sec
    // Goal2: BLUE+RED รวมไม่เกิน badMax sec (ตัดสินตอนจบ)
    const g1 = `⏳ อยู่ GREEN ≥ ${T.greenTarget}s (ตอนนี้ ${secGreen}s/${T.greenTarget}) ${goal1Done ? '✅' : '⏳'}`;
    const g2 = `⛔ อยู่ BLUE/RED รวมไม่เกิน ${T.badMax}s (bad ${secBad}/${T.badMax}) ${goal2Done ? '✅' : '⏳'}`;
    if (elGoalTxt) elGoalTxt.textContent = `Goal: ${g1} · ${g2}`;

    // Minis
    const m1 = `✅ Combo ${comboMax}/8 ${miniComboDone ? '✅' : ''}`.trim();
    const m2 = `✅ Perfect ${perfectCount}/4 ${miniPerfectDone ? '✅' : ''}`.trim();
    const m3 = `✅ NoJunk ${junkHits}/0 ${miniNoJunkDone ? '✅' : ''}`.trim();
    if (elMiniTxt) elMiniTxt.textContent = `Mini: ${m1} · ${m2} · ${m3}`;

    dispatch('quest:update', {
      goalText: (elGoalTxt ? elGoalTxt.textContent : ''),
      miniText: (elMiniTxt ? elMiniTxt.textContent : ''),
      goalsCleared, minisCleared,
      goalTotal: 2, miniTotal: 3
    });
  }

  function celebrate(kind){
    // particles.js patched version มักฟัง hha:celebrate
    dispatch('hha:celebrate', { kind, mode:'hydration' });
    try{
      if (Particles && typeof Particles.celebrateQuestFX === 'function') Particles.celebrateQuestFX(kind);
    }catch{}
  }

  function checkGoalsMinis(){
    // Goal1: green time reached
    if (!goal1Done && secGreen >= T.greenTarget){
      goal1Done = true;
      goalsCleared = Math.min(2, goalsCleared + 1);
      celebrate('goal');
    }

    // Mini combo
    if (!miniComboDone && comboMax >= 8){
      miniComboDone = true;
      minisCleared = Math.min(3, minisCleared + 1);
      celebrate('mini');
      triggerStorm(4800);
    }

    // Mini perfect
    if (!miniPerfectDone && perfectCount >= 4){
      miniPerfectDone = true;
      minisCleared = Math.min(3, minisCleared + 1);
      celebrate('mini');
      triggerStorm(4200);
    }

    // Mini no-junk (ตัดสินตอนจบ แต่ถ้าโดน junk แล้วก็ “ตก” ทันที)
    if (!miniNoJunkDone && junkHits === 0 && secTotal > 6){
      // ยังไม่ให้ผ่านจนจบเกม แต่แสดงว่า “ยังไม่พัง”
    }
  }

  function finalizeAtEnd(){
    if (goal2Done) return; // กันเรียกซ้ำ
    goal2Done = (secBad <= T.badMax);
    if (goal2Done) goalsCleared = Math.min(2, goalsCleared + 1);

    if (!miniNoJunkDone && junkHits === 0){
      miniNoJunkDone = true;
      minisCleared = Math.min(3, minisCleared + 1);
    }

    const g = gradeFrom(score, goalsCleared, minisCleared, miss, secGreen, T.greenTarget);

    updateQuestText();
    updateHUD();

    if (endBox){
      const html = `
        <div style="max-width:560px;width:100%;background:rgba(2,6,23,.74);border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:16px 16px 14px;box-shadow:0 24px 70px rgba(0,0,0,.6);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="font-weight:900;font-size:20px;">Hydration — Summary</div>
            <div style="border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.55);border-radius:999px;padding:6px 10px;font-weight:900;letter-spacing:.06em;">
              Grade <span>${g.grade}</span>
            </div>
          </div>
          <div style="margin-top:10px;color:rgba(226,232,240,.85);font-size:13px;line-height:1.55;">
            <div>Score: <b>${score}</b> · ComboMax: <b>${comboMax}</b> · Miss: <b>${miss}</b></div>
            <div>GREEN time: <b>${secGreen}s</b> · BLUE/RED time: <b>${secBad}s</b></div>
            <div>Perfect: <b>${perfectCount}</b> · Junk hits: <b>${junkHits}</b></div>
            <div>Goals: <b>${goalsCleared}/2</b> · Minis: <b>${minisCleared}/3</b></div>
          </div>
          <div style="margin-top:12px;height:10px;background:#0b1220;border:1px solid rgba(148,163,184,.18);border-radius:999px;overflow:hidden;">
            <div style="height:100%;width:${clamp(g.pct,0,100)}%;background:linear-gradient(90deg,#22c55e,#60a5fa);"></div>
          </div>
          <div style="margin-top:10px;display:flex;gap:10px;justify-content:flex-end;">
            <button id="hvr-restart" style="pointer-events:auto;border:1px solid rgba(148,163,184,.22);background:rgba(2,6,23,.55);color:#e5e7eb;border-radius:14px;padding:10px 12px;font-weight:900;">
              เล่นอีกครั้ง
            </button>
          </div>
        </div>
      `;
      endBox.innerHTML = html;
      endBox.classList.add('on');

      const btn = $('#hvr-restart');
      if (btn){
        btn.onclick = () => { location.reload(); };
      }
    }

    dispatch('hha:end', {
      mode:'hydration',
      difficulty: diff,
      duration,
      score, comboMax, miss,
      water, zone,
      secGreen, secBad, secTotal,
      perfectCount, junkHits,
      goalsCleared, minisCleared,
      grade: g.grade,
      gradePct: g.pct
    });

    // ถ้าเคลียร์หมด
    if (goalsCleared >= 2 && minisCleared >= 3){
      try{
        if (Particles && typeof Particles.celebrateAllQuestsFX === 'function') Particles.celebrateAllQuestsFX();
      }catch{}
      dispatch('hha:celebrate', { kind:'all', mode:'hydration' });
    }
  }

  // ------------------------------
  // judge callback for mode-factory
  // ------------------------------
  function judge(ch, ctx){
    // ctx: {isGood,isPower,itemType,hitPerfect,hitDistNorm,targetRect}
    const itemType = ctx && ctx.itemType;
    const isPower  = !!(ctx && ctx.isPower);
    const perfect  = !!(ctx && ctx.hitPerfect);

    let scoreDelta = 0;

    if (itemType === 'bad'){
      junkHits++;
      miss++;
      combo = 0;
      scoreDelta = -60;

      water -= T.badDown * (perfect ? 0.85 : 1.0);
      setBlink('bad');

      try{
        Particles && Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'BAD');
        Particles && Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, 'JUNK!', -60);
      }catch{}

    } else if (itemType === 'fakeGood'){
      // หลอกตา: ไม่แรงเท่า junk แต่ “เสียเปรียบ”
      miss++;
      combo = Math.max(0, Math.floor(combo * 0.5));
      scoreDelta = -20;

      water -= T.fakeDown * (perfect ? 0.90 : 1.0);
      setBlink('bad');

      try{
        Particles && Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, 'TRAP');
        Particles && Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, 'TRICK!', -20);
      }catch{}

    } else {
      // good / power
      combo++;
      comboMax = Math.max(comboMax, combo);

      const base = 100 + Math.min(60, combo * 3);
      const pBonus = perfect ? 40 : 0;
      const powerBonus = isPower ? 45 : 0;

      scoreDelta = base + pBonus + powerBonus;
      score += scoreDelta;

      if (perfect) perfectCount++;

      water += (isPower ? T.powerUp : T.goodUp) * (perfect ? 1.15 : 1.0);
      setBlink(perfect ? 'perfect' : 'good');

      try{
        Particles && Particles.burstAt && Particles.burstAt(ctx.clientX, ctx.clientY, perfect ? 'PERFECT' : 'GOOD');
        Particles && Particles.scorePop && Particles.scorePop(ctx.clientX, ctx.clientY, perfect ? 'PERFECT!' : 'GOOD!', scoreDelta);
      }catch{}

      // storm trigger จากฟีล “ล้น”
      if (combo >= 6 && perfect) triggerStorm(3600);
    }

    water = clamp(water, 0, 100);
    updateWaterUI();
    updateHUD();

    checkGoalsMinis();
    updateQuestText();

    // ส่งกลับให้ mode-factory ใช้ประเมิน hit-rate adaptive
    return { scoreDelta, good: (itemType !== 'bad' && itemType !== 'fakeGood') };
  }

  function onExpire(info){
    // หมดอายุถือเป็น miss เบา ๆ เฉพาะ good/power (พลาดเป้าดี)
    if (!info) return;
    if (info.itemType === 'bad') return; // junk หายไปเองไม่ลงโทษ
    miss++;
    combo = 0;
    score = Math.max(0, score - 8);

    // น้ำค่อย ๆ ไหลลงตามเวลา/พลาด
    water = clamp(water - 1.2, 0, 100);

    updateWaterUI();
    updateHUD();
    updateQuestText();
  }

  // init UI state
  updateWaterUI();
  updateHUD();
  updateQuestText();

  // ------------------------------
  // start factory engine
  // ------------------------------
  const engine = await factoryBoot({
    modeKey: 'hydration',
    difficulty: diff,
    duration,

    spawnHost: '#hvr-playfield',
    boundsHost: '#hvr-wrap',                // ✅ bounds คงที่ (ไม่เพี้ยนบนมือถือ)
    excludeSelectors: ['.hud', '#hvr-end', '#hvr-screen-blink'],

    pools: { good: GOOD, bad: BAD, trick: ['🫧','💧'] },
    goodRate: diff === 'hard' ? 0.58 : (diff === 'normal' ? 0.62 : 0.68),

    powerups: POWER,
    powerRate: diff === 'hard' ? 0.12 : 0.10,
    powerEvery: 7,

    allowAdaptive: true,
    rhythm: { enabled:true, bpm: (diff==='hard'?126:(diff==='normal'?118:108)) },
    trickRate: diff === 'hard' ? 0.12 : 0.08,

    // ✅ สำคัญ: “เจอง่ายขึ้น” แต่ไม่ล็อกกลาง
    centerBias: 0.80,
    centerRadiusFrac: 0.26,
    centerYFrac: 0.56,
    antiRepeatPx: 140,

    spawnIntervalMul: () => spawnMul(),
    decorateTarget: decorateBubble,

    judge,
    onExpire
  });

  // ------------------------------
  // time tick from factory (hha:time)
  // ------------------------------
  function onTime(ev){
    if (stopped) return;
    const sec = Number(ev && ev.detail && ev.detail.sec);
    if (!Number.isFinite(sec)) return;

    // sec คือ "เหลือ" — เราเก็บ total ผ่านไป
    secTotal = Math.max(0, duration - sec);

    // drain per second (เล็ก ๆ)
    // ทำให้ “แช่ GREEN” ต้องขยันยิงดี
    if (secTotal > 0){
      water = clamp(water - T.waterDrain, 0, 100);
    }

    const z = zoneFromWaterLocal(water);
    if (z === 'GREEN') secGreen++;
    else secBad++;

    updateWaterUI();

    // อัปเดต quest/goal ต่อวินาที
    checkGoalsMinis();
    updateQuestText();
    updateHUD();

    if (sec <= 0){
      finalizeAtEnd();
    }
  }
  ROOT.addEventListener('hha:time', onTime);

  // ------------------------------
  // Tap empty = crosshair shoot (เหมือน VR)
  // ------------------------------
  function onTap(ev){
    if (stopped) return;
    const t = ev && ev.target;
    // ถ้ากดโดนเป้า ให้ปล่อยให้เป้าจัดการ
    if (t && t.closest && t.closest('.hvr-target')) return;

    // ยิงกลางจอ
    try{
      if (engine && typeof engine.shootCrosshair === 'function'){
        const ok = engine.shootCrosshair();
        if (ok) return;
      }
    }catch{}
  }
  if (playfield){
    playfield.addEventListener('pointerdown', onTap, { passive:true });
  }

  // stop handler
  function stop(){
    if (stopped) return;
    stopped = true;

    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
    try{ playfield && playfield.removeEventListener('pointerdown', onTap); }catch{}

    try{ engine && engine.stop && engine.stop(); }catch{}
    try{ dispatch('hha:stop', { mode:'hydration' }); }catch{}
  }

  return { stop };
}

export default { boot };