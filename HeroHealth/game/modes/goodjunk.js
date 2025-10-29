// === Hero Health Academy — game/modes/goodjunk.js (Hardened + Factory adapter; DOM-spawn + FX) ===
// Good vs Junk
// • คลิก “ของดี” (GOOD) เพื่อทำคะแนน / คอมโบ, หลีกเลี่ยง “ขยะ” (JUNK)
// • Golden item ให้คะแนนมากขึ้น + เอฟเฟกต์แตกกระจาย
// • DOM-first spawn (ปุ่มอยู่ใน #gameLayer/#spawnHost) เข้ากับ main.js (factory style)

export const name = 'goodjunk';

// ---------- Safe FX bootstrap (ป้องกันกรณียังโหลด fx.js ไม่ทัน) ----------
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
    (async () => {
      try {
        const m = await import('/webxr-health-mobile/HeroHealth/game/core/fx.js').catch(()=>null);
        if (m) Object.assign(window.HHA_FX, m);
      } catch {}
    })();
  }
})();

// ---------- เนื้อหา ----------
const GOOD = [
  '🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'
];
const JUNK = [
  '🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🍬','🧂','🥓','🧈','🍨'
];

// ---------- ค่าควบคุม ----------
const LIFE = { Easy: 1900, Normal: 1600, Hard: 1300 }; // อายุชิ้นพื้นฐาน (ms)
const SPAWN_BASE = 0.42;   // ช่วงสปอว์นฐาน (น้อย = ถี่)
const SPAWN_JITTER = 0.24; // แกว่งสุ่ม
const SPEEDUP_T15 = 0.18;  // เร่งเมื่อเวลาเหลือ ≤ 15s
const R_GOOD = 0.64;       // สัดส่วนโอกาสเกิดของดี
const GOLDEN_CHANCE = 0.07;
const COMBO_STEP = 5;      // ทุก ๆ 5 ชิ้น = โค้ชเชียร์

// Utilities
const clamp = (n,a,b)=>Math.max(a, Math.min(b,n));
const choice = (arr)=>arr[(Math.random()*arr.length)|0];

// ---------- Legacy-like接口 (ให้ main.js แบบเดิมเรียกได้ ถ้าจำเป็น) ----------
export function pickMeta(diff={}, state={}){
  const diffName = state?.difficulty || 'Normal';
  const lifeBase = Number(diff.life) > 0 ? Number(diff.life) : (LIFE[diffName] || 1600);

  const isGood = Math.random() < R_GOOD;
  const char   = isGood ? choice(GOOD) : choice(JUNK);

  // Golden เฉพาะของดี
  const golden = isGood && Math.random() < GOLDEN_CHANCE;
  const life = clamp(lifeBase + (golden? 180 : 0), 700, 4500);

  return {
    char,
    label: isGood ? 'GOOD' : 'JUNK',
    aria:  isGood ? 'Healthy food' : 'Junk food',
    good:  isGood,
    golden,
    life
  };
}

export function onHit(meta={}, sys={}, state={}, hud=null){
  // คืนผลลัพธ์ให้ main ตัดสินคะแนน/เอฟเฟกต์ต่อ
  return meta.good ? (meta.golden ? 'perfect' : 'good') : 'bad';
}

export function init(state={}, hud=null){
  // no-op สำหรับโหมดนี้ (ไม่มี HUD เป้า), แต่คง signature ไว้
  state.ctx = state.ctx || {};
}
export function cleanup(){ /* noop */ }
export function tick(){ /* noop */ }

// ---------- Factory Adapter (DOM-spawn) ----------
export function create({ engine, hud, coach }) {
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running: false,
    items: [],                   // { el, x, y, born, life, meta }
    difficulty: (window.__HHA_DIFF || 'Normal'),
    lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    stats: { good:0, perfect:0, bad:0, miss:0 },
    combo: 0
  };

  function start(){
    stop();
    state.running = true;
    state.items.length = 0;
    state.stats = { good:0, perfect:0, bad:0, miss:0 };
    state.combo = 0;
    coach?.onStart?.();
  }

  function stop(){
    state.running = false;
    try { for (const it of state.items) it.el.remove(); } catch {}
    state.items.length = 0;
  }

  function update(dt, Bus){
    if (!state.running || !layer) return;

    const rect = layer.getBoundingClientRect();
    const now  = performance.now();

    if (!state._spawnCd) state._spawnCd = 0.20;
    // เร่งขึ้นเมื่อเวลาเหลือน้อย
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const speedBias = timeLeft <= 15 ? SPEEDUP_T15 : 0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      const base = SPAWN_BASE - speedBias;
      state._spawnCd = clamp(base + Math.random()*SPAWN_JITTER, 0.22, 1.0);
    }

    // อายุชิ้น
    const gone = [];
    for (const it of state.items){
      if (now - it.born > it.life){
        // timeout → ถือว่า miss เฉพาะกรณีของดี หลุดคลิก
        if (it.meta.good){ Bus?.miss?.(); state.stats.miss++; state.combo = 0; }
        try { it.el.remove(); } catch {}
        gone.push(it);
      }
    }
    if (gone.length){
      state.items = state.items.filter(x=>!gone.includes(x));
    }
  }

  function spawnOne(rect, Bus){
    const meta = pickMeta({ life: LIFE[state.difficulty] }, state);
    const pad = 30;
    const x = Math.round(pad + Math.random()*(Math.max(1, rect.width)  - pad*2));
    const y = Math.round(pad + Math.random()*(Math.max(1, rect.height) - pad*2));

    const b = document.createElement('button');
    b.className = 'spawn-emoji';
    b.type = 'button';
    b.style.left = x + 'px';
    b.style.top  = y + 'px';
    b.textContent = meta.char;
    b.setAttribute('aria-label', meta.aria);

    if (meta.golden) b.style.filter = 'drop-shadow(0 0 12px rgba(255,215,0,.9))';

    // FX tilt บนปุ่ม
    try { (window?.HHA_FX?.add3DTilt || (()=>{}))(b); } catch {}

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };

      const res = onHit(meta, { sfx: Bus?.sfx }, state, hud);
      if (res === 'good' || res === 'perfect'){
        // คะแนนพื้นฐาน + โบนัส Golden
        const pts = res === 'perfect' ? 20 : 10;
        state.combo++;
        if (state.combo % COMBO_STEP === 0) coach?.onCombo?.(state.combo);

        if (res === 'perfect'){ coach?.onPerfect?.(); } else { coach?.onGood?.(); }
        engine?.fx?.popText?.(`+${pts}${res==='perfect'?' ✨':''}`, { x: ui.x, y: ui.y, ms: 720 });
        (window?.HHA_FX?.shatter3D || engine?.fx?.spawnShards || (()=>{}))(ui.x, ui.y, { count: res==='perfect'? 60 : 34 });

        state.stats[res]++; Bus?.hit?.({ kind: res, points: pts, ui, meta: { ...meta } });
      } else {
        // คลิกโดนของขยะ → โค้ชเตือน + หน้าจอ flash เบา ๆ + รีเซ็ตคอมโบ
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        coach?.onBad?.(); state.stats.bad++; state.combo = 0;
        Bus?.miss?.({ meta });
      }

      // เอาออกจากฉาก
      try { b.remove(); } catch {}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });

    (host || document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, x, y, born: performance.now(), life: meta.life, meta });
  }

  function cleanup(){
    stop();
    try { cleanupLegacy(); } catch {}
  }
  function cleanupLegacy(){ try { cleanup(state, hud); } catch {} }

  return { start, stop, update, onClick(){}, cleanup };
}
