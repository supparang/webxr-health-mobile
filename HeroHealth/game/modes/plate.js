// === Hero Health Academy — game/modes/plate.js
// (multi-group accept + overfill penalty + HUD bars + rarity perfect
//  + over-quota lockout + group_full event + safe FX bootstrap)

import { Progress } from '/webxr-health-mobile/HeroHealth/game/core/progression.js';
import { Quests }   from '/webxr-health-mobile/HeroHealth/game/core/quests.js';

export const name = 'plate';

// ---------- Safe FX bootstrap (avoid duplicate identifiers) ----------
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
})[lang||'TH'];

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
  line.textContent = msg;
  line.style.display = 'block';
  setTimeout(()=>{ line.style.display='none'; }, 950);
}

function toastRound(text){
  let el = document.getElementById('toast');
  if (!el){ el = document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = text; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'), 900);
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

// ---------- Public API ----------
export function init(state={}, hud, diff){
  const wrap = document.getElementById('plateTracker'); if (wrap) wrap.style.display = 'block';
  const tgt  = document.getElementById('targetWrap');   if (tgt)  tgt.style.display  = 'none';

  state.ctx = state.ctx || {};
  state.ctx.need = makeQuotas(state.difficulty||'Normal');
  state.ctx.have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
  state.ctx.overfillCount = 0;
  state.ctx.perfectPlates = 0;

  _plateRound = 1;
  _lockout = {};

  renderPlateHUD(state);
  toastRound('🍽️ จานที่ ' + _plateRound);

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
  const ctx = state.ctx || {};
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
  const { score, sfx } = systems;
  const Lang = L(state.lang);
  const ctx = state.ctx || (state.ctx={have:{},need:{}});

  const now = performance.now();
  if (_lockout[meta.groupId] && now < _lockout[meta.groupId]){
    document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 180);
    try{ sfx?.play?.('sfx-bad'); }catch{}
    return 'bad';
  }

  const need = (ctx.need[meta.groupId]||0);
  const have = (ctx.have[meta.groupId]||0);
  const withinQuota = need>0 && have<need;

  if (withinQuota){
    ctx.have[meta.groupId] = have + 1;

    // rarity-aware perfect
    const pBoost  = rareBoost(meta.groupId, ctx);
    const perfect = !!meta.golden || Math.random() < pBoost;

    renderPlateHUD(state);

    // แจ้งว่ากลุ่มนี้ครบโควตาแล้ว
    if (ctx.have[meta.groupId] >= ctx.need[meta.groupId]){
      Quests.event?.('group_full', { groupId: meta.groupId });
    }

    if (isPlateComplete(ctx)){
      flashLine(Lang.plateDone);
      try{ score?.add?.(40); }catch{}
      try{ sfx?.play?.('sfx-perfect'); }catch{}
      _plateRound++;
      nextPlate(ctx, state.difficulty||'Normal');
      renderPlateHUD(state);
      toastRound('🍽️ จานที่ ' + _plateRound);
    }else{
      try{ sfx?.play?.(perfect?'sfx-perfect':'sfx-good'); }catch{}
    }
    return perfect ? 'perfect' : 'good';
  }

  // เกินโควตา → บทลงโทษ + lockout 600ms
  ctx.overfillCount = (ctx.overfillCount||0) + 1;
  _lockout[meta.groupId] = now + 600;

  flashLine('⚠ ' + Lang.overfill);
  document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'), 180);
  try{ sfx?.play?.('sfx-bad'); }catch{}
  return 'bad';
}

export function tick(){ /* plate ไม่มีการนับเวลาเฉพาะโหมด */ }

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
