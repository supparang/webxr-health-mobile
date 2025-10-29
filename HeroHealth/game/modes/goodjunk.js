// === Hero Health Academy — game/modes/goodjunk.js (DOM-spawn adapter) ===
export const name = 'goodjunk';

// Pools
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🍭','🧁','🥓','🍟','🍕','🍔','🥤','🍰','🍪'];

const GOLDEN_CHANCE = 0.06;     // ชิ้นทอง (โบนัส)
const LIFE_MS       = 1800;     // อายุพื้นฐานต่อชิ้น
const SPEED_MIN     = 90;       // px/s
const SPEED_MAX     = 220;

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function rnd(a,b){ return a + Math.random()*(b-a); }

// ช่วยทำเอฟเฟกต์เล็ก ๆ เมื่อกด
const FX = {
  popText(txt, {x,y}){
    try { window.HHA && window.HHA.fx && window.HHA.fx.popText?.(txt, {x,y}); } catch {}
  }
};

// ---------- Factory Adapter ----------
export function create({ engine, hud, coach }) {
  const layer = document.getElementById('gameLayer');
  const host  = document.getElementById('spawnHost');

  const state = {
    running:false,
    items: [], // {el, x, y, vx, vy, born, life, meta}
    stats: { good:0, perfect:0, bad:0, miss:0 },
    combo:0,
    diff: window.__HHA_DIFF || 'Normal',
    lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
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

  function pickMeta(){
    const isGood = Math.random() < 0.62; // อัตราส่วนดีต่อขยะ
    const char = isGood ? GOOD[(Math.random()*GOOD.length)|0]
                        : JUNK[(Math.random()*JUNK.length)|0];
    const golden = isGood && Math.random() < GOLDEN_CHANCE;
    const life = clamp(LIFE_MS + (isGood?0:-200), 900, 3200);
    return { char, good:isGood, golden, life };
  }

  function spawnOne(rect, Bus){
    const m = pickMeta();

    // สุ่มพิกัด “เกิด” แนวบน/ซ้าย/ขวา แล้ววิ่งเข้า “กึ่งกลางกรอบ”
    // เพื่อให้รู้สึกว่า “วิ่งออกมา”
    const edges = ['top','left','right'];
    const edge = edges[(Math.random()*edges.length)|0];

    let x, y, vx, vy;
    const cx = rect.width/2, cy = rect.height/2;

    if (edge === 'top'){
      x = rnd(40, rect.width-40);
      y = -20;
    } else if (edge === 'left'){
      x = -20;
      y = rnd(40, rect.height-40);
    } else {
      x = rect.width + 20;
      y = rnd(40, rect.height-40);
    }

    // วิ่งเข้าหาศูนย์กลาง + noise
    const tx = cx + rnd(-120, 120);
    const ty = cy + rnd(-90,  90);
    const dx = (tx - x), dy = (ty - y);
    const len = Math.max(1, Math.hypot(dx,dy));
    const spd = rnd(SPEED_MIN, SPEED_MAX);
    vx = dx/len * spd;
    vy = dy/len * spd;

    // สร้างปุ่ม
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spawn-emoji';
    // ใช้ left/top เป็น “กึ่งกลางปุ่ม” แล้ว translate(-50%, -50%) จาก CSS
    b.style.left = x + 'px';
    b.style.top  = y + 'px';
    b.textContent = m.char;
    if (m.golden) b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.85))';

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };

      if (m.good){
        // คะแนนพื้นฐาน + โบนัสดาวทอง
        const pts = m.golden ? 20 : 10;
        state.stats[m.golden?'perfect':'good']++;
        state.combo++;
        Bus?.hit?.({ kind: m.golden?'perfect':'good', points: pts, ui, meta:m });
        FX.popText(`+${pts}${m.golden?' ✨':''}`, ui);
      }else{
        // ผิด → รีเซ็ตคอมโบ + หน่วงสั้น ๆ
        state.stats.bad++; state.combo = 0;
        try {
          document.body.classList.add('flash-danger');
          setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        } catch {}
        Bus?.miss?.();
      }

      try { b.remove(); } catch {}
      const idx = state.items.findIndex(it=>it.el===b);
      if (idx>=0) state.items.splice(idx,1);
    }, {passive:false});

    host.appendChild(b);
    state.items.push({
      el:b, x, y, vx, vy, born: performance.now(), life: m.life, meta:m
    });
  }

  function update(dt, Bus){
    if (!state.running) return;
    const rect = layer.getBoundingClientRect();

    // cadence: spawn ตามเวลาที่เหลือ (ยิ่งใกล้หมด ยิ่งถี่)
    if (!state._cd) state._cd = 0.18;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft <= 15 ? 0.16 : 0.0;
    state._cd -= dt;
    if (state._cd <= 0){
      spawnOne(rect, Bus);
      state._cd = clamp(0.46 - bias + Math.random()*0.25, 0.28, 0.95);
    }

    // move + lifetime
    const now = performance.now();
    const gone = [];
    for (const it of state.items){
      it.x += it.vx * dt;
      it.y += it.vy * dt;

      // constrain inside view bounds (เล็กน้อย)
      const pad = 24;
      it.x = clamp(it.x, pad, rect.width - pad);
      it.y = clamp(it.y, pad, rect.height - pad);

      it.el.style.left = it.x + 'px';
      it.el.style.top  = it.y + 'px';

      if (now - it.born > it.life){
        // miss หากเป็นชิ้นดี
        if (it.meta.good){ Bus?.miss?.(); state.stats.miss++; }
        try { it.el.remove(); } catch {}
        gone.push(it);
      }
    }
    if (gone.length){
      state.items = state.items.filter(x=>!gone.includes(x));
    }
  }

  function cleanup(){
    stop();
  }

  return { start, stop, update, cleanup };
}
