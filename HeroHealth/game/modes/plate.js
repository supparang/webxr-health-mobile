// === Hero Health Academy — game/modes/plate.js (2025-10-29, synced)
// - Relative imports -> ../core/*
// - Click-safe HUD, robust meta guard, fair lockout, multi-group accept
// - Overfill penalty, HUD bars, rarity-perfect, quest events, FX hooks
// - Factory adapter for main.js DOM-spawn flow

import { Progress } from '../core/progression.js';
import { Quests   } from '../core/quests.js';

export const name = 'plate';

// ---------- Safe FX bootstrap (avoid duplicate identifiers) ----------
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
    (async () => {
      try {
        const m = await import('../core/fx.js').catch(()=>null);
        if (m) Object.assign(window.HHA_FX, m);
      } catch {}
    })();
  }
})();

// ---------- Item pools (20 each) ----------
const VEGGIES = ['🥦','🥕','🥒','🌽','🍅','🍆','🥗','🥬','🥔','🧅','🧄','🍄','🌶️','🥒','🥕','🥦','🥬','🍅','🥔','🍄'];
const FRUITS  = ['🍎','🍌','🍓','🍇','🍉','🍍','🍑','🍊','🍐','🥭','🍒','🍋','🥝','🍈','🫐','🍎','🍌','🍊','🍇','🍍'];
const GRAINS  = ['🍞','🥖','🥨','🍚','🍙','🍘','🍜','🍝','🍛','🌯','🌮','🥞','🫓','🥪','🥯','🍞','🍚','🍝','🥖','🥨'];
const PROTEIN = ['🍗','🍖','🥩','🍳','🐟','🍤','🫘','🥜','🧆','🌭','🍣','🍢','🥓','🧆','🍗','🍳','🐟','🍤','🫘','🥩'];
const DAIRY   = ['🥛','🧀','🍨','🍦','🥛','🧀','🥛','🧀','🍧','🍦','🥛','🧀','🍨','🍦','🥛','🧀','🥛','🧀','🍧','🍦'];

const GROUPS = ['veggies','fruits','grains','protein','dairy'];
const POOLS  = { veggies:VEGGIES, fruits:FRUITS, grains:GRAINS, protein:PROTEIN, dairy:DAIRY };

// ---------- Helpers ----------
const rnd   = (arr)=>arr[(Math.random()*arr.length)|0];
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
const L = (lang)=>({
  TH:{veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม',
      plateDone:'จัดจานครบ!', overfill:'เกินโควตา!'},
  EN:{veggies:'Veggies', fruits:'Fruits', grains:'Grains', protein:'Protein', dairy:'Dairy',
      plateDone:'Plate Complete!', overfill:'Over quota!'}
})[(lang||'TH').toUpperCase()];

function makeQuotas(diffKey='Normal'){
  if (diffKey==='Easy')   return { veggies:4, fruits:3, grains:2, protein:2, dairy:1 }; // 12
  if (diffKey==='Hard')   return { veggies:6, fruits:4, grains:3, protein:3, dairy:1 }; // 17
  /* Normal */            return { veggies:5, fruits:3, grains:2, protein:2, dairy:1 }; // 13
}

function lackingGroups(ctx){
  const out = [];
  for (const g of GROUPS){
    const need = (ctx.need[g]||0), have = (ctx.have[g]||0);
    if (need>0 && have<need) out.push(g);
  }
  return out;
}

// ---------- HUD ----------
function renderPlateHUD(state){
  const host = document.getElementById('platePills'); if (!host) return;
  host.style.pointerEvents = 'none';
  const Lang = L(state.lang);
  const pills = GROUPS.map(g=>{
    const have = state.ctx.have[g]||0;
    const need = state.ctx.need[g]||0;
    const done = need>0 && have>=need;
    const barW = need>0 ? clamp((have/need)*100, 0, 100) : 0;
    return `<div class="pill ${done?'ok':''}">
      <b>${Lang[g]}</b>
      <span>${have}/${need}</span>
      <i style="width:${barW}%"></i>
    </div>`;
  }).join('');
  host.innerHTML = pills;
}

function flashLine(msg){
  const line = document.getElementById('missionLine'); if (!line) return;
  line.style.pointerEvents = 'none';
  line.textContent = msg;
  line.style.display = 'block';
  setTimeout(()=>{ line.style.display='none'; }, 950);
}

function toastRound(text){
  let el = document.getElementById('toast');
  if (!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.style.pointerEvents = 'none';
  el.textContent = text; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 900);
}

function clickSafeOverlays(){
  ['platePills','missionLine','toast','targetWrap','hudWrap','coachHUD','menuBar','resultModal']
    .forEach(id=>{ const el=document.getElementById(id); if(el) el.style.pointerEvents='none'; });
}

// ---------- Local state ----------
let _lockout = {};   // groupId -> until timestamp (ms)
let _plateRound = 1;

function rareBoost(groupId, ctx){
  const rare = (groupId==='dairy' || groupId==='protein');
  const need = (ctx.need[groupId]||0), have = (ctx.have[groupId]||0);
  const gap = Math.max(0, need - have);
  return rare ? Math.min(0.18 + gap*0.03, 0.45)
              : Math.min(0.18 + gap*0.02, 0.35);
}

// ---------- Legacy API ----------
export function init(state={}, hud, diff){
  state.lang = (state.lang||localStorage.getItem('hha_lang')||'TH').toUpperCase();

  const wrap = document.getElementById('plateTracker'); if (wrap){ wrap.style.display = 'block'; wrap.style.pointerEvents='none'; }
  const tgt  = document.getElementById('targetWrap');   if (tgt) { tgt.style.display  = 'none';  tgt.style.pointerEvents='none'; }

  clickSafeOverlays();

  state.ctx = state.ctx || {};
  state.ctx.need = makeQuotas(state.difficulty||'Normal');
  state.ctx.have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
  state.ctx.overfillCount = 0;
  state.ctx.perfectPlates = 0;

  _plateRound = 1;
  _lockout = {};

  renderPlateHUD(state);
  toastRound(state.lang==='EN' ? ('🍽️ Plate ' + _plateRound) : ('🍽️ จานที่ ' + _plateRound));

  try{
    Progress.emit?.('run_start', {
      mode:'plate',
      difficulty: state.difficulty,
      missions: (Progress.runCtx?.missions||[])
    });
  }catch{}
}

export function cleanup(){
  const wrap = document.getElementById('plateTracker');
  if (wrap) wrap.style.display = 'none';
}

export function pickMeta(diff={}, state={}){
  const ctx = state.ctx || (state.ctx={need:makeQuotas(state.difficulty||'Normal'), have:{veggies:0,fruits:0,grains:0,protein:0,dairy:0}});
  const lack = lackingGroups(ctx);
  const isLackPick = Math.random() < 0.75 && lack.length>0;
  const group = isLackPick ? rnd(lack) : rnd(GROUPS);

  const char = rnd(POOLS[group]);
  const need = (ctx.need[group]||0), have = (ctx.have[group]||0);
  const withinQuota = need>0 && have<need;

  const golden = Math.random() < 0.08;
  const life   = clamp(Number(diff.life)>0? Number(diff.life): 3000, 700, 4500);

  return {
    id: `${group}_${Date.now().toString(36)}_${(Math.random()*999)|0}`,
    char,
    aria: group,
    label: group,
    groupId: group,
    good: withinQuota,
    golden,
    life
  };
}

export function onHit(meta={}, systems={}, state={}){
  if (!meta || !meta.groupId) return 'ok';

  const score = systems?.score;
  const sfx   = systems?.sfx;
  const Lang  = L(state.lang);
  const ctx   = state.ctx || (state.ctx={have:{},need:{}});

  const now = performance.now();

  if (_lockout[meta.groupId] && now < _lockout[meta.groupId]){
    document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 120);
    try{ sfx?.play?.('sfx-bad'); }catch{}
    return 'bad';
  }

  const need = (ctx.need[meta.groupId]||0);
  const have = (ctx.have[meta.groupId]||0);
  const withinQuota = need>0 && have<need;

  if (withinQuota){
    ctx.have[meta.groupId] = have + 1;

    const pBoost  = rareBoost(meta.groupId, ctx);
    const perfect = !!meta.golden || Math.random() < pBoost;

    renderPlateHUD(state);

    if (ctx.have[meta.groupId] >= ctx.need[meta.groupId]){
      const payload = { groupId: meta.groupId };
      Quests.event?.('group_full', payload);
      Quests.event?.('plate_group_full', payload);
      try { window.HHA?.groupFull?.(); } catch {}
    }

    if (isPlateComplete(ctx)){
      flashLine(Lang.plateDone);
      try{ score?.add?.(40); }catch{}
      try{ sfx?.play?.('sfx-perfect'); }catch{}
      try { window.HHA?.platePerfect?.(); } catch {}
      _plateRound++;
      nextPlate(ctx, state.difficulty||'Normal');
      renderPlateHUD(state);
      toastRound(state.lang==='EN' ? ('🍽️ Plate ' + _plateRound) : ('🍽️ จานที่ ' + _plateRound));
    }else{
      try{ sfx?.play?.(perfect?'sfx-perfect':'sfx-good'); }catch{}
    }
    return perfect ? 'perfect' : 'good';
  }

  // Over-quota → penalty + short lockout on that group
  ctx.overfillCount = (ctx.overfillCount||0) + 1;
  _lockout[meta.groupId] = now + 600;

  flashLine('⚠ ' + Lang.overfill);
  document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 180);
  try{ sfx?.play?.('sfx-bad'); }catch{}
  try { window.HHA?.plateOver?.(); } catch {}
  return 'bad';
}

export function tick(){ /* plate: no special ticking */ }

// ---------- Internals ----------
function isPlateComplete(ctx){
  for (const g of GROUPS){
    const need = ctx.need[g]||0, have = ctx.have[g]||0;
    if (need>0 && have<need) return false;
  }
  return true;
}

function nextPlate(ctx, diffKey){
  const base = makeQuotas(diffKey);
  const bump = { Easy:0, Normal:1, Hard:1 }[diffKey] ?? 1;
  ctx.need = {
    veggies: base.veggies + bump,
    fruits:  base.fruits  + (bump?1:0),
    grains:  base.grains,
    protein: base.protein,
    dairy:   base.dairy
  };
  ctx.have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
  ctx.overfillCount = 0;
}

// ------- Shared FX hooks (tilt + shatter) -------
export const fx = {
  onSpawn(el/*, state*/){ try{ (window?.HHA_FX?.add3DTilt||(()=>{}))(el); }catch{} },
  onHit(x, y/*, meta, state*/){ try{ (window?.HHA_FX?.shatter3D||(()=>{}))(x, y); }catch{} }
};

/* =============================================================================
   Factory Adapter (for main.js DOM-spawn flow)
   - Creates & manages DOM buttons under #spawnHost
   - Uses pickMeta()/onHit() logic above; sends Bus.hit()/Bus.miss()
============================================================================= */
export function create({ engine, hud, coach }) {
  const host  = document.getElementById('spawnHost');
  const layer = document.getElementById('gameLayer');

  const state = {
    running:false,
    items:[],                 // { el, x, y, born, life, meta }
    difficulty: (window.__HHA_DIFF || 'Normal'),
    lang: (localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    ctx: { need: makeQuotas(window.__HHA_DIFF||'Normal'), have:{ veggies:0,fruits:0,grains:0,protein:0,dairy:0 }, overfillCount:0 },
    stats: { good:0, perfect:0, bad:0, miss:0 },
  };

  function start(){
    stop();
    state.running = true;
    state.items.length = 0;
    _lockout = {};
    init(state, hud, {}); // set HUD
    coach?.onStart?.();
  }

  function stop(){
    state.running = false;
    try { for (const it of state.items) it.el.remove(); } catch {}
    state.items.length = 0;
  }

  function update(dt, Bus){
    if (!state.running || !layer) return;

    const now = performance.now();
    const rect = layer.getBoundingClientRect();

    // Spawn cadence (slightly faster near end)
    if (!state._spawnCd) state._spawnCd = 0.20;
    const timeLeft = Number(document.getElementById('time')?.textContent||'0')|0;
    const bias = timeLeft <= 15 ? 0.14 : 0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.40 - bias + Math.random()*0.22, 0.26, 0.95);
    }

    // Lifetime expiry → treat as “miss” only if it was within quota (a good piece)
    const gone = [];
    for (const it of state.items){
      if (now - it.born > it.meta.life){
        if (it.meta.good){ Bus?.miss?.(); state.stats.miss++; }
        try { it.el.remove(); } catch {}
        gone.push(it);
      }
    }
    if (gone.length){
      state.items = state.items.filter(x=>!gone.includes(x));
    }
  }

  function spawnOne(rect, Bus){
    const meta = pickMeta({ life: 1900 }, state);
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
    if (meta.golden) b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.85))';

    try { (window?.HHA_FX?.add3DTilt||(()=>{}))(b); } catch {}

    b.addEventListener('click', (ev)=>{
      if (!state.running) return;
      ev.stopPropagation();
      const ui = { x: ev.clientX, y: ev.clientY };

      const res = onHit(meta, { score: engine?.score, sfx: engine?.sfx }, state);

      if (res === 'good' || res === 'perfect'){
        const pts = res === 'perfect' ? 20 : 10;
        engine?.fx?.popText?.(`+${pts}${res==='perfect'?' ✨':''}`, { x: ui.x, y: ui.y, ms: 720 });
        try { (window?.HHA_FX?.shatter3D||(()=>{}))(ui.x, ui.y); } catch {}
        state.stats[res]++; Bus?.hit?.({ kind: res, points: pts, ui, meta });
        coach?.onGood?.();
      } else if (res === 'bad'){
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 160);
        state.stats.bad++; Bus?.miss?.({ meta });
        coach?.onBad?.();
      }

      // remove clicked
      try { b.remove(); } catch {}
      const idx = state.items.findIndex(it=>it.el===b); if (idx>=0) state.items.splice(idx,1);
    }, { passive:false });

    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({ el:b, x, y, born: performance.now(), life: meta.life, meta });
  }

  function cleanup(){
    stop();
    try { cleanupLegacy(); } catch {}
  }
  function cleanupLegacy(){ try { cleanup(state); } catch {} }

  return { start, stop, update, onClick(){}, cleanup };
}
