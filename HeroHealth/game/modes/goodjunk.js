// === Hero Health Academy — game/modes/goodjunk.js
// DOM-spawn factory + legacy API bridge
// - เก็บของดี (GOOD) ให้คะแนน, ของขยะ (JUNK) ตัดคอมโบ/หัก
// - Golden ช่วย Perfect, มี anti-repeat ใกล้ตำแหน่งเดิม
// - Spawn ไวขึ้นช่วงท้ายเกม, ชีวิตไอเท็ม 1.6–2.2s
// - ยิง Bus.hit()/Bus.miss() → ScoreSystem/Mission/Quests ทำงานครบ

import { Quests } from '/webxr-health-mobile/HeroHealth/game/core/quests.js';

export const name = 'goodjunk';

const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍭','🍗🍟','🍫','🥓','🍜❗'];

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const rnd  =(arr)=>arr[(Math.random()*arr.length)|0];

function pickMeta(opts={}, lastPos={x:0,y:0}){
  const r = Math.random();
  const life = clamp((opts.life||1800) + (Math.random()*400-200), 1100, 2400);
  if (r < 0.66){
    return { id:'good', char: rnd(GOOD), aria:'Good food', good:true,  golden: Math.random()<0.10, life };
  }else{
    return { id:'junk', char: rnd(JUNK), aria:'Junk food', good:false, golden:false, life };
  }
}

/* ======================== Factory for main.js ======================== */
export function create({ engine, hud, coach }){
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false, items:[],
    lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    last:{x:0,y:0}, stats:{good:0,perfect:0,bad:0,miss:0}
  };

  function start(){
    stop();
    state.running = true;
    state.items.length = 0;
    coach?.onStart?.();
    hud?.say?.(state.lang==='TH'?'เก็บของดี เลี่ยงของขยะ!':'Collect good, avoid junk!', 1100);
  }

  function stop(){
    state.running = false;
    try { for(const it of state.items) it.el.remove(); } catch {}
    state.items.length = 0;
  }

  function update(dt, Bus){
    if (!state.running || !layer) return;

    const now = performance.now();
    const rect = layer.getBoundingClientRect();
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;

    if (!state._spawnCd) state._spawnCd = 0.16;
    state._spawnCd -= dt;

    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      // เร่งนิดๆ ช่วงท้าย
      const bias = timeLeft<=15 ? 0.12 : 0;
      state._spawnCd = clamp(0.38 - bias + Math.random()*0.22, 0.24, 0.9);
    }

    // หมดอายุ → miss เฉพาะชิ้นดี
    const gone=[];
    for (const it of state.items){
      if (now - it.born > it.meta.life){
        if (it.meta.good){ Bus?.miss?.({ meta:{mode:'goodjunk'} }); state.stats.miss++; }
        try{ it.el.remove(); }catch{}
        gone.push(it);
      }
    }
    if (gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(rect, Bus){
    const meta = pickMeta({ life: 1800 }, state.last);

    // ตำแหน่งแบบสุ่ม พร้อม anti-repeat ใกล้เดิม
    const pad=34;
    let x = Math.round(pad + Math.random()*(Math.max(1, rect.width)  - pad*2));
    let y = Math.round(pad + Math.random()*(Math.max(1, rect.height) - pad*2));
    if (Math.hypot(x-state.last.x, y-state.last.y) < 72){
      x = clamp(x + (Math.random()<.5?-80:80), pad, rect.width - pad);
      y = clamp(y + (Math.random()<.5?-60:60), pad, rect.height - pad);
    }
    state.last = { x, y };

    const b = document.createElement('button');
    b.className='spawn-emoji';
    b.type='button';
    b.style.left = x+'px';
    b.style.top  = y+'px';
    b.textContent = meta.char;
    b.setAttribute('aria-label', meta.aria);
    if (meta.golden) b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.9))';

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };

      if (meta.good){
        const perfect = !!meta.golden || Math.random()<0.18;
        const pts = perfect ? 16 : 10;
        engine?.fx?.popText?.(`+${pts}${perfect?' ✨':''}`, { x: ui.x, y: ui.y, ms: 700 });
        state.stats[perfect?'perfect':'good']++;
        Bus?.hit?.({ kind: perfect?'perfect':'good', points: pts, ui, meta:{ mode:'goodjunk', golden:meta.golden } });
        coach?.onGood?.();
        Quests.event?.('hit', { result: perfect?'perfect':'good', comboNow: 0, meta:{ mode:'goodjunk', golden:meta.golden } });
      }else{
        // ของขยะ → หักแบบนุ่ม และแจ้งระบบ
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        state.stats.bad++;
        Bus?.miss?.({ meta:{ mode:'goodjunk', junk:true } });
        coach?.onBad?.();
        Quests.event?.('hit', { result:'bad', comboNow: 0, meta:{ mode:'goodjunk', junk:true } });
      }

      try{ b.remove(); }catch{}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, born: performance.now(), meta });
  }

  function cleanup(){ stop(); }

  return { start, stop, update, onClick(){}, cleanup };
}

/* ===== Legacy stubs (ไม่ใช้ใน flow ใหม่ แต่เก็บไว้ให้เข้ากันได้) ===== */
export function init(){/* no-op */} 
export function pickMetaLegacy(){ return pickMeta(); }
export function onHit(){ return 'ok'; }
export function tick(){/* no-op */}
