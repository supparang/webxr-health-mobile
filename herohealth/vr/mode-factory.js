// === /herohealth/vr/mode-factory.js
// HeroHealth VR — Generic emoji target spawner + shared timer (hha:time)
// ใช้กับ GoodJunk / Groups / Hydration ได้เหมือนกัน
//
// boot({
//   difficulty: 'easy'|'normal'|'hard',
//   duration:   60,              // เวลาเล่น (วินาที)
//   pools:      { good:[..], bad:[..] },
//   goodRate:   0.6,             // โอกาสสุ่มเป้าดี
//   powerups:   ['⭐','💎',...],  // optional
//   powerRate:  0.1,
//   powerEvery: 7,               // ทุก ๆ N spawn มีสิทธิ์สุ่ม powerup
//   judge(char, ctx) -> {good, scoreDelta}
//   onExpire(ev)                 // เรียกเมื่อเป้าหมดเวลาแล้วไม่โดนตี
// });
//
// Dispatch events:
//   window.dispatchEvent(new CustomEvent('hha:time', { detail:{sec} }));
//     - sec = วินาทีที่เหลือ (เริ่มที่ duration → 0)

'use strict';

const DEFAULT_SPAWN_TABLE = {
  easy:   { interval: 1100, lifetime: 2400, maxActive: 5 },
  normal: { interval: 900,  lifetime: 2200, maxActive: 6 },
  hard:   { interval: 750,  lifetime: 2000, maxActive: 7 }
};

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

function normDiff(diff) {
  const d = String(diff || 'normal').toLowerCase();
  if (d === 'easy' || d === 'hard') return d;
  return 'normal';
}

// ---------- DOM helpers ----------

function ensureStyle() {
  if (document.getElementById('hha-factory-style')) return;
  const style = document.createElement('style');
  style.id = 'hha-factory-style';
  style.textContent = `
  .hha-target-layer{
    position:absolute;
    inset:0;
    pointer-events:none;
    overflow:hidden;
    z-index:9;
  }
  .hha-target-layer .hha-target{
    position:absolute;
    top:-8%;
    left:50%;
    transform:translate(-50%,-50%);
    pointer-events:auto;
    border:none;
    border-radius:999px;
    padding:6px 10px;
    font-size:28px;
    background:rgba(15,23,42,0.9);
    color:#fff;
    box-shadow:0 14px 30px rgba(15,23,42,0.9);
    cursor:pointer;
    transition:
      transform 1.8s linear,
      opacity 1.8s linear,
      box-shadow .15s ease-out;
  }
  .hha-target-layer .hha-target.good{
    box-shadow:0 14px 30px rgba(34,197,94,0.75);
  }
  .hha-target-layer .hha-target.bad{
    box-shadow:0 14px 30px rgba(239,68,68,0.7);
  }
  .hha-target-layer .hha-target.power{
    box-shadow:0 14px 30px rgba(234,179,8,0.9);
  }
  .hha-target-layer .hha-target.fall{
    transform:translate(-50%,110vh);
    opacity:0.1;
  }
  .hha-target-layer .hha-target.hit{
    transform:translate(-50%,-40%) scale(0.2);
    opacity:0;
    transition:
      transform .25s ease-out,
      opacity .25s ease-out;
  }
  `;
  document.head.appendChild(style);
}

function ensureLayer() {
  let layer = document.getElementById('hha-target-layer');
  if (layer) return layer;

  ensureStyle();

  // พยายามวางซ้อนใน .vr-shell ถ้ามี ไม่งั้นก็ทั้ง body
  const host = document.querySelector('.vr-shell') || document.body;
  const wrap = document.createElement('div');
  wrap.id = 'hha-target-layer';
  wrap.className = 'hha-target-layer';
  host.appendChild(wrap);
  return wrap;
}

// random จาก array
function pick(arr) {
  if (!arr || !arr.length) return null;
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
}

// ---------- main boot ----------

export async function boot(cfg = {}) {
  const diff = normDiff(cfg.difficulty);
  let dur = Number(cfg.duration || 60);
  if (!Number.isFinite(dur) || dur <= 0) dur = 60;
  dur = clamp(dur, 20, 180);

  const pools    = cfg.pools    || {};
  const goods    = pools.good || [];
  const bads     = pools.bad  || [];
  const powerups = cfg.powerups || [];

  const goodRate   = typeof cfg.goodRate === 'number' ? clamp(cfg.goodRate, 0.1, 0.95) : 0.6;
  const powerRate  = typeof cfg.powerRate === 'number' ? clamp(cfg.powerRate, 0.0, 1.0) : 0.1;
  const powerEvery = cfg.powerEvery || 7;

  const table     = DEFAULT_SPAWN_TABLE[diff] || DEFAULT_SPAWN_TABLE.normal;
  const interval  = cfg.spawnInterval || table.interval;
  const lifetime  = cfg.itemLifetime  || table.lifetime;
  const maxActive = cfg.maxActive     || table.maxActive;

  const judge    = typeof cfg.judge    === 'function' ? cfg.judge    : null;
  const onExpire = typeof cfg.onExpire === 'function' ? cfg.onExpire : null;

  const layer = ensureLayer();

  let active = new Set();
  let totalSpawn = 0;
  let stopped = false;

  // ---------- timer (hha:time) ----------
  let remain = dur;
  function dispatchTime() {
    window.dispatchEvent(new CustomEvent('hha:time', {
      detail: { sec: remain }
    }));
  }
  dispatchTime(); // เรียกครั้งแรก

  const timerId = setInterval(() => {
    if (stopped) return;
    remain -= 1;
    if (remain < 0) remain = 0;
    dispatchTime();
    if (remain <= 0) {
      stopAll();
    }
  }, 1000);

  // ---------- spawn logic ----------

  function classifySpawn() {
    totalSpawn++;
    // โอกาส powerup
    if (powerups.length && powerEvery > 0 && totalSpawn % powerEvery === 0 && Math.random() < powerRate) {
      return { type:'power', char: pick(powerups) };
    }
    // ปกติ
    const r = Math.random();
    if (r < goodRate) return { type:'good', char: pick(goods) };
    return { type:'bad', char: pick(bads) };
  }

  function destroyTarget(el) {
    if (!el || !el.parentNode) return;
    active.delete(el);
    el.remove();
  }

  function spawnOne() {
    if (stopped) return;
    if (!goods.length && !bads.length && !powerups.length) return;
    if (active.size >= maxActive) return;

    const spec = classifySpawn();
    if (!spec.char) return;

    const el = document.createElement('button');
    el.className = `hha-target ${spec.type}`;
    el.textContent = spec.char;
    el.dataset.type = spec.type;

    // random horizontal pos
    const xPct = 10 + Math.random()*80;
    el.style.left = xPct + '%';

    // เก็บเวลา
    const bornAt = performance.now();

    // hit handler
    const onHit = (ev) => {
      ev.stopPropagation();
      if (stopped) return;
      if (!el.parentNode) return;

      clearTimeout(expireId);

      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width/2;
      const cy = rect.top  + rect.height/2;

      if (judge) {
        try {
          judge(spec.char, {
            clientX: cx,
            clientY: cy,
            cx, cy,
            type: spec.type
          });
        } catch (err) {
          console.error('judge error', err);
        }
      }

      el.classList.remove('fall');
      el.classList.add('hit');
      el.disabled = true;
      setTimeout(() => destroyTarget(el), 260);
    };
    el.addEventListener('click', onHit);

    layer.appendChild(el);
    active.add(el);

    // trigger fall animation next frame
    requestAnimationFrame(() => {
      el.classList.add('fall');
    });

    // expire timer
    const expireId = setTimeout(() => {
      if (!el.parentNode) return;
      active.delete(el);
      el.remove();

      if (onExpire && !stopped) {
        const now = performance.now();
        const age = now - bornAt;
        const isGood  = spec.type === 'good';
        const isPower = spec.type === 'power';
        try {
          onExpire({
            char: spec.char,
            type: spec.type,
            isGood,
            isPower,
            ageMs: age
          });
        } catch (err) {
          console.error('onExpire error', err);
        }
      }
    }, lifetime);
  }

  const spawnId = setInterval(() => {
    if (stopped) return;
    spawnOne();
  }, interval);

  function stopAll() {
    if (stopped) return;
    stopped = true;
    clearInterval(timerId);
    clearInterval(spawnId);
    active.forEach(el => destroyTarget(el));
    active.clear();
  }

  // คืน object เผื่อโหมดอื่นเรียกใช้งาน
  return {
    stop: stopAll,
    destroy: stopAll,
    getRemaining() { return remain; }
  };
}

export default { boot };
