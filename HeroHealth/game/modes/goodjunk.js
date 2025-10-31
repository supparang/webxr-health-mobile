// === Hero Health Academy — game/modes/goodjunk.js (2025-10-31 hardened) ===
// Fix: guard null host/layer, auto-create #gameLayer/#spawnHost if missing,
//      safe rect fallback, no clientWidth read on null, DOM-ready agnostic.

export const name = 'goodjunk';

// ---- Item pools ----
const GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
const JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🍭','🧈','🥓','🧃','🍮','🥟','🍨','🧇','🌮'];

const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const pick  = (arr)=>arr[(Math.random()*arr.length)|0];

// ---- Safe playfield helpers ----
function ensurePlayfield(){
  let layer = document.getElementById('gameLayer');
  if (!layer){
    layer = document.createElement('section');
    layer.id = 'gameLayer';
    layer.setAttribute('aria-label','playfield');
    layer.style.cssText = 'position:relative;inset:auto;min-height:360px;overflow:hidden';
    // ใส่ไว้ท้าย body เพื่อให้เล่นได้แม้ไม่มีใน index
    document.body.appendChild(layer);
  }
  let host = document.getElementById('spawnHost');
  if (!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.setAttribute('aria-live','polite');
    host.style.cssText = 'position:absolute;inset:0';
    layer.appendChild(host);
  }
  return { layer, host };
}

function rectOf(el){
  try{
    if (el && typeof el.getBoundingClientRect==='function') {
      const r = el.getBoundingClientRect();
      // กัน NaN จากบางเคส layout ยังไม่คำนวณ
      if (Number.isFinite(r.width) && Number.isFinite(r.height)) return r;
    }
  }catch{}
  // fallback ทั้งหน้าจอ
  return { left:0, top:0, width: innerWidth||800, height: innerHeight||600 };
}

// ---- Mode API (legacy-like) ----
export function init(state={}, hud){
  state.lang = (state.lang||localStorage.getItem('hha_lang')||'TH').toUpperCase();
  state.ctx  = state.ctx || {};
  state.stats= {good:0,perfect:0,bad:0,miss:0};
  const { layer } = ensurePlayfield();
  // โชว์ HUD ถ้ามี
  try{ document.getElementById('hudWrap')?.style && (document.getElementById('hudWrap').style.display='block'); }catch{}
  try{ hud?.setTarget?.(''); }catch{}
  // ให้เมนูปิดคลิกระหว่างเล่น
  try{ window.HHA?.setPlayfieldActive?.(true); }catch{}
}

export function cleanup(){
  const { host } = ensurePlayfield();
  try{ [...host.querySelectorAll('.spawn-emoji')].forEach(el=>el.remove()); }catch{}
}

export function tick(/*dt*/){ /* no-op for goodjunk */ }

// ---- Spawner meta ----
function pickMeta(diff={}, state={}){
  const isGood  = Math.random() < 0.66;
  const char    = isGood ? pick(GOOD) : pick(JUNK);
  const lifeMs  = clamp(Number(diff.life)>0? Number(diff.life): 2600, 700, 4500);
  const golden  = isGood && Math.random() < 0.08;
  return {
    char,
    aria: isGood ? 'good' : 'junk',
    label: isGood ? 'GOOD' : 'JUNK',
    good: isGood,
    golden,
    life: lifeMs
  };
}

// ---- Click handler ----
export function onHit(meta={}, systems={}, state={}){
  const sfx   = systems?.sfx;
  const score = systems?.score;

  if (!meta) return 'ok';
  if (meta.good){
    const perfect = !!meta.golden;
    try{ score?.add?.(perfect?18:10, { kind: perfect?'perfect':'good' }); }catch{}
    try{ sfx?.play?.(perfect?'sfx-perfect':'sfx-good'); }catch{}
    state.stats[perfect?'perfect':'good']++;
    return perfect ? 'perfect' : 'good';
  }else{
    try{ score?.addPenalty?.(8, { kind:'bad' }); }catch{}
    try{ sfx?.play?.('sfx-bad'); }catch{}
    state.stats.bad++;
    return 'bad';
  }
}

// ---- Factory adapter (used by main.js) ----
export function create({ engine, hud, coach }){
  const state = {
    running:false,
    items:[],
    lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    difficulty:(document.body.getAttribute('data-diff')||'Normal'),
    _spawnCd:0.22
  };

  function start(){
    stop(); // clear old
    init(state, hud);
    state.running = true;
    coach?.onStart?.();
  }

  function stop(){
    state.running = false;
    const { host } = ensurePlayfield();
    try{ [...host.querySelectorAll('.spawn-emoji')].forEach(el=>el.remove()); }catch{}
    state.items.length = 0;
  }

  function update(dt, Bus){
    if (!state.running) return;
    const { layer, host } = ensurePlayfield();
    const play = rectOf(layer);

    state._spawnCd -= dt;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft<=15 ? 0.12 : 0;

    if (state._spawnCd<=0){
      spawnOne(host, play, Bus);
      state._spawnCd = clamp(0.40 - bias + Math.random()*0.22, 0.26, 0.95);
    }

    // expiry
    const now = performance.now();
    const gone = [];
    for (const it of state.items){
      if (now - it.born > it.life){
        if (it.meta.good){ Bus?.miss?.({ meta:{ reason:'expire', isGood:true } }); state.stats.miss++; }
        try{ it.el.remove(); }catch{}
        gone.push(it);
      }
    }
    if (gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(host, playRect, Bus){
    const meta = pickMeta({ life: 2000 }, state);
    const pad = 30;
    const w = Math.max(2*pad+1, playRect.width||600);
    const h = Math.max(2*pad+1, playRect.height||400);
    const x = Math.round(pad + Math.random()*(w - 2*pad));
    const y = Math.round(pad + Math.random*?.() ? 0 : 0); // safety for odd engines
    const yy= Math.round(pad + Math.random()*(h - 2*pad));

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spawn-emoji';
    b.style.left = x + 'px';
    b.style.top  = yy + 'px';
    b.textContent = meta.char;
    b.setAttribute('aria-label', meta.aria);
    if (meta.golden) b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.85))';

    host.appendChild(b);
    const born = performance.now();
    state.items.push({ el:b, born, life: meta.life, meta });

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };

      const res = onHit(meta, { score: engine?.score, sfx: engine?.sfx }, state);
      if (res==='good' || res==='perfect'){
        const pts = res==='perfect'? 18 : 10;
        engine?.fx?.popText?.(`+${pts}${res==='perfect'?' ✨':''}`, { x: ui.x, y: ui.y, ms: 720 });
        state.stats[res]++; Bus?.hit?.({ kind: res, points: pts, ui, meta:{...meta, isGood:true} });
        coach?.onGood?.();
      } else if (res==='bad'){
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        state.stats.bad++; Bus?.miss?.({ meta:{...meta, isGood:false} });
        coach?.onBad?.();
      }

      try{ b.remove(); }catch{}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });
  }

  function cleanup(){ stop(); try{ cleanupLegacy(); }catch{} }
  function cleanupLegacy(){ try{ cleanup(state, hud); }catch{} }

  return { start, stop, update, cleanup };
}
