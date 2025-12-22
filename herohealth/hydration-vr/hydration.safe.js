// === /herohealth/hydration-vr/hydration.safe.js ===
// Hydration Quest VR — SAFE (A3.3 spread+hint)
// ✅ spread กว้างแบบ VR + มีลูกศรชี้เป้านอกจอ
// ✅ Storm Wave: spawn ถี่ขึ้นจริง + life sync
// ✅ miss / combo / perfect / junk hit

'use strict';

import { boot as factoryBoot } from '../vr/mode-factory.js';

const ROOT = (typeof window !== 'undefined' ? window : globalThis);
const DOC  = ROOT.document;

const Particles =
  (ROOT.GAME_MODULES && ROOT.GAME_MODULES.Particles) ||
  ROOT.Particles ||
  { scorePop() {}, burstAt() {}, celebrateQuestFX() {}, celebrateAllQuestsFX() {} };

function qs(name, fallback=null){
  try{
    const u = new URL(location.href);
    return u.searchParams.get(name) ?? fallback;
  }catch{
    return fallback;
  }
}
function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

function setText(id, txt){
  try{ const el = DOC.getElementById(id); if (el) el.textContent = String(txt); }catch{}
}
function setBar(idFill, pct){
  try{ const el = DOC.getElementById(idFill); if (el) el.style.width = `${clamp(pct,0,100)}%`; }catch{}
}
function blink(kind){
  const el = DOC.getElementById('hvr-screen-blink');
  if (!el) return;
  el.classList.remove('good','bad','perfect','on');
  el.classList.add(kind);
  void el.offsetWidth;
  el.classList.add('on');
  ROOT.setTimeout(()=>{ el.classList.remove('on'); }, 150);
}
function dispatch(name, detail){
  try{ ROOT.dispatchEvent(new CustomEvent(name, { detail })); }catch{}
}

function gradeFromScore(score){
  if (score >= 1800) return 'SSS';
  if (score >= 1200) return 'SS';
  if (score >= 800)  return 'S';
  if (score >= 480)  return 'A';
  if (score >= 220)  return 'B';
  return 'C';
}
function gradeProgressPct(score){
  const nextS = 800;
  return clamp((score / nextS) * 100, 0, 100);
}
function zoneFromWater(w){
  if (w < 35) return 'BLUE';
  if (w <= 70) return 'GREEN';
  return 'RED';
}
function updateWaterUI(w){
  const z = zoneFromWater(w);
  setText('hha-water-status', `${z} ${Math.round(w)}%`);
  const zoneText = DOC.getElementById('hha-water-zone-text');
  if (zoneText) zoneText.textContent = `ZONE ${z}`;
  setBar('hha-water-fill', w);

  const fill = DOC.getElementById('hha-water-fill');
  if (fill){
    if (z === 'GREEN') fill.style.background = 'linear-gradient(90deg,#22c55e,#4ade80)';
    else if (z === 'BLUE') fill.style.background = 'linear-gradient(90deg,#38bdf8,#60a5fa)';
    else fill.style.background = 'linear-gradient(90deg,#fb7185,#f97316)';
  }
  return z;
}

// ---------- Bubble decorator ----------
function decorateBubbleTarget(el, parts, data, meta){
  const { inner, icon } = parts || {};
  const size = meta && meta.size ? meta.size : 80;

  el.style.background = 'radial-gradient(circle at 30% 22%, rgba(255,255,255,.16), rgba(255,255,255,.04) 40%, rgba(0,0,0,.10) 100%)';
  el.style.boxShadow = '0 18px 40px rgba(0,0,0,.45)';

  const rim = DOC.createElement('div');
  rim.style.position = 'absolute';
  rim.style.inset = '0';
  rim.style.borderRadius = '999px';
  rim.style.opacity = '0.95';
  rim.style.background =
    'conic-gradient(from 30deg,' +
    'rgba(255,60,80,.85),' +
    'rgba(255,220,60,.85),' +
    'rgba(60,255,170,.85),' +
    'rgba(60,170,255,.85),' +
    'rgba(200,120,255,.85),' +
    'rgba(255,60,180,.85),' +
    'rgba(255,60,80,.85))';
  rim.style.webkitMask = 'radial-gradient(circle, transparent 64%, #000 66%)';
  rim.style.mask = 'radial-gradient(circle, transparent 64%, #000 66%)';
  rim.style.filter = 'blur(.2px) drop-shadow(0 0 14px rgba(120,220,255,.28))';

  const hi = DOC.createElement('div');
  hi.style.position = 'absolute';
  hi.style.left = '20%';
  hi.style.top  = '18%';
  hi.style.width = '34%';
  hi.style.height= '26%';
  hi.style.borderRadius = '999px';
  hi.style.background = 'radial-gradient(circle at 30% 30%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%)';
  hi.style.transform = 'rotate(-18deg)';
  hi.style.opacity = '0.9';
  hi.style.pointerEvents = 'none';

  if (inner){
    inner.style.background = 'radial-gradient(circle at 30% 25%, rgba(255,255,255,.08), rgba(15,23,42,.10))';
    inner.style.boxShadow = 'inset 0 10px 22px rgba(255,255,255,.10), inset 0 -10px 18px rgba(0,0,0,.18)';
  }
  if (icon){
    icon.style.fontSize = Math.round(size * 0.52) + 'px';
    icon.style.filter = 'drop-shadow(0 5px 6px rgba(0,0,0,.35))';
  }

  if (data.itemType === 'bad'){
    el.style.boxShadow = '0 22px 54px rgba(0,0,0,.60), 0 0 0 2px rgba(255,120,80,.30)';
  } else if (data.itemType === 'power'){
    el.style.boxShadow = '0 22px 54px rgba(0,0,0,.60), 0 0 0 2px rgba(250,204,21,.25)';
  } else if (data.itemType === 'fakeGood'){
    el.style.boxShadow = '0 22px 54px rgba(0,0,0,.60), 0 0 0 2px rgba(167,139,250,.24)';
  } else {
    el.style.boxShadow = '0 22px 54px rgba(0,0,0,.60), 0 0 0 2px rgba(80,255,170,.22)';
  }

  el.appendChild(rim);
  el.appendChild(hi);
}

export async function boot(opts = {}){
  const difficulty = String(opts.difficulty || qs('diff','easy') || 'easy').toLowerCase();
  const duration   = Number(opts.duration || qs('time','90') || 90) || 90;

  let score = 0;
  let combo = 0;
  let comboMax = 0;
  let miss  = 0;

  let water = 50;
  let zone  = updateWaterUI(water);

  let secLeft = clamp(duration, 20, 180);

  let perfectCount = 0;
  const comboGoal = 8;
  const perfectGoal = 4;
  let miniDoneCombo = false;
  let miniDonePerfect = false;
  let miniDoneNoJunk = true;

  let stormUntil = 0;
  function nowMs(){ return (typeof performance !== 'undefined' ? performance.now() : Date.now()); }
  function isStorm(){ return nowMs() < stormUntil; }
  function startStorm(ms=3400){
    stormUntil = Math.max(stormUntil, nowMs() + ms);
    dispatch('hha:coach', { mood:'happy', text:'🌪️ Storm Wave! เป้าออกถี่ขึ้น!' });
  }

  function updateHUD(){
    setText('hha-score-main', score);
    setText('hha-combo-max', comboMax);
    setText('hha-miss', miss);

    const g = gradeFromScore(score);
    setText('hha-grade-badge', g);
    setText('hha-grade-progress-text', `Progress to S: ${Math.round(gradeProgressPct(score))}%`);
    setBar('hha-grade-progress-fill', gradeProgressPct(score));

    setText('hha-quest-goal', `Goal: อยู่ GREEN ให้นานที่สุด (ตอนนี้ ${Math.max(0, (zone==='GREEN')? (duration-secLeft) : 0)}s)`);
    setText('hha-quest-mini',
      `Mini: ${miniDonePerfect?'✅':'⬜'} Perfect ${perfectCount}/${perfectGoal}  ` +
      `${miniDoneCombo?'✅':'⬜'} Combo ${combo}/${comboGoal}  ` +
      `${miniDoneNoJunk?'✅':'❌'} NoJunk`
    );
  }

  updateHUD();
  dispatch('quest:update', { goal:'อยู่ GREEN ให้นานที่สุด', mini:'Perfect/Combo ลุ้น Storm Wave!' });
  dispatch('hha:coach', { mood:'neutral', text:'💧 แตะน้ำดีให้แม่น! ถ้าเป้าอยู่นอกจอจะมีลูกศรชี้ให้' });

  const pools = {
    good: ['💧','🫧','💦'],
    bad:  ['🍩','🍔','🍟','🧋','🍕'],
    trick: ['💧']
  };

  function judge(ch, ctx){
    const isBad = (ctx.itemType === 'bad');
    const isPower = (ctx.itemType === 'power');
    const isFake = (ctx.itemType === 'fakeGood');

    if (isBad){
      miss += 1;
      miniDoneNoJunk = false;
      combo = 0;
      water = clamp(water - 12, 0, 100);
      zone = updateWaterUI(water);
      blink('bad');

      try{ Particles.burstAt(ctx.clientX, ctx.clientY, { label:'JUNK', kind:'bad' }); }catch{}
      dispatch('hha:coach', { mood:'sad', text:'😵 โดน JUNK! น้ำลด รีบกลับ GREEN!' });
      dispatch('hha:score', { score, combo, miss, comboMax });
      updateHUD();
      return { scoreDelta: -12, good:false };
    }

    const perfect = !!ctx.hitPerfect;
    const base = perfect ? 18 : 12;

    score += base;
    combo += 1;
    comboMax = Math.max(comboMax, combo);

    water = clamp(water + (perfect ? 7 : 5), 0, 100);
    zone = updateWaterUI(water);

    if (perfect){
      perfectCount += 1;
      blink('perfect');
    } else {
      blink('good');
    }

    if (!miniDonePerfect && perfectCount >= perfectGoal){
      miniDonePerfect = true;
      try{ Particles.celebrateQuestFX && Particles.celebrateQuestFX('mini'); }catch{}
      dispatch('hha:coach', { mood:'happy', text:'✨ Perfect สำเร็จ!' });
      startStorm(3600);
    }
    if (!miniDoneCombo && combo >= comboGoal){
      miniDoneCombo = true;
      try{ Particles.celebrateQuestFX && Particles.celebrateQuestFX('mini'); }catch{}
      dispatch('hha:coach', { mood:'happy', text:'🔥 Combo สำเร็จ!' });
      startStorm(3600);
    }

    if (isPower){
      score += 35;
      water = clamp(water + 10, 0, 100);
      zone = updateWaterUI(water);
      dispatch('hha:coach', { mood:'happy', text:'⭐ Power! +คะแนน +น้ำ!' });
    }
    if (isFake){
      score -= 4;
      dispatch('hha:coach', { mood:'neutral', text:'🌀 อันนี้หลอกนะ! แต้มลดนิดนึง' });
    }

    try{ Particles.scorePop(ctx.clientX, ctx.clientY, base, perfect ? 'PERFECT' : 'GOOD'); }catch{}
    dispatch('hha:score', { score, combo, miss, comboMax });
    updateHUD();
    return { scoreDelta: base, good:true };
  }

  function onExpire(t){
    if (!t) return;
    if (t.itemType === 'good' || t.itemType === 'power' || t.itemType === 'fakeGood'){
      miss += 1;
      combo = 0;
      water = clamp(water - 2.5, 0, 100);
      zone = updateWaterUI(water);
      dispatch('hha:score', { score, combo, miss, comboMax });
      updateHUD();
    }
  }

  function spawnIntervalMul(){
    return isStorm() ? 0.55 : 1.0;
  }

  const api = await factoryBoot({
    modeKey: 'hydration',
    difficulty,
    duration,

    spawnHost:  '#hvr-playfield',
    boundsHost: '#hvr-playfield',
    excludeSelectors: ['.hud', '#hvr-end', '#hvr-error'],

    pools,
    goodRate: 0.62,

    powerups: ['🫧','💧','⭐'],
    powerRate: 0.12,
    powerEvery: 7,

    trickRate: 0.08,
    spawnIntervalMul,
    judge,
    onExpire,

    // ✅ A3.3
    spread: 0.52,     // กว้างแบบ VR (ปรับ 0.48–0.60 ได้)
    showHints: true,  // เปิดลูกศรชี้เป้านอกจอ

    decorateTarget: (el, parts, data, meta) => {
      decorateBubbleTarget(el, parts, data, meta);
    }
  });

  const onTime = (ev) => {
    const sec = ev && ev.detail ? Number(ev.detail.sec) : NaN;
    if (!Number.isFinite(sec)) return;
    secLeft = sec;
    if (secLeft <= 0) endGame();
    updateHUD();
  };
  ROOT.addEventListener('hha:time', onTime);

  function endGame(){
    try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
    try{ api && api.stop && api.stop(); }catch{}

    const grade = gradeFromScore(score);
    const summary = { mode:'hydration', score, miss, comboMax, waterEnd: Math.round(water), zoneEnd: zone, grade };
    dispatch('hha:end', summary);

    const endEl = DOC.getElementById('hvr-end');
    if (endEl){
      endEl.classList.add('on');
      endEl.innerHTML =
        `<div style="max-width:560px;width:100%;background:rgba(2,6,23,.72);border:1px solid rgba(148,163,184,.22);border-radius:22px;padding:16px 16px 14px;backdrop-filter:blur(10px);box-shadow:0 20px 60px rgba(0,0,0,.55);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
            <div style="font-weight:900;font-size:22px;">จบเกม 💧 Hydration</div>
            <div style="font-weight:900;border:1px solid rgba(148,163,184,.22);border-radius:999px;padding:6px 10px;">Grade ${grade}</div>
          </div>
          <div style="margin-top:10px;color:rgba(226,232,240,.92);line-height:1.6;">
            <div>คะแนน: <b>${score}</b> | Miss: <b>${miss}</b> | Combo Max: <b>${comboMax}</b></div>
            <div>Water End: <b>${Math.round(water)}%</b> (${zone})</div>
          </div>
          <div style="margin-top:12px;color:rgba(148,163,184,.9);font-size:12px;">รีเฟรชหน้าเพื่อเล่นใหม่</div>
        </div>`;
    }
  }

  return {
    stop(){
      try{ ROOT.removeEventListener('hha:time', onTime); }catch{}
      try{ api && api.stop && api.stop(); }catch{}
      try{ dispatch('hha:stop', {}); }catch{}
    }
  };
}

export default { boot };