// === Hero Health Academy — game/modes/plate.js (quota-safe + penalties + clear HUD pills) ===
import { Progress } from '/webxr-health-mobile/HeroHealth/game/core/progression.js';

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

function langName(lang){
  return {
    TH: {veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม'},
    EN: {veggies:'Veggies', fruits:'Fruits', grains:'Grains', protein:'Protein', dairy:'Dairy'}
  }[lang||'TH'];
}

function makeQuotas(diffKey='Normal'){
  if (diffKey==='Easy')   return { veggies:4, fruits:3, grains:2, protein:2, dairy:1 }; // 12
  if (diffKey==='Hard')   return { veggies:6, fruits:4, grains:3, protein:3, dairy:1 }; // 17
  return                   { veggies:5, fruits:3, grains:2, protein:2, dairy:1 };       // 13
}

function pickTargetGroup(ctx){
  let best=null, bestNeed=-1;
  for (const g of GROUPS){
    const need = (ctx.need[g]||0) - (ctx.have[g]||0);
    if (need > bestNeed){ bestNeed = need; best = g; }
  }
  return bestNeed>0 ? best : null;
}

// อัปเดต HUD (#plateTracker)
function renderPlateHUD(state){
  const host = document.getElementById('platePills'); if (!host) return;
  const L = langName(state.lang);
  const pills = GROUPS.map(g=>{
    const have = state.ctx.have[g]||0;
    const need = state.ctx.need[g]||0;
    const done = have>=need && need>0;
    const barW = need>0 ? clamp((have/need)*100, 0, 100) : 0;
    return `<div class="pill ${done?'ok':''}" data-g="${g}">
      <b>${L[g]}</b>
      <span class="qty">${have}/${need}${done?' ✅':''}</span>
      <i style="width:${barW}%"></i>
    </div>`;
  }).join('');
  host.innerHTML = pills;
}

function flashLine(msg){
  const line = document.getElementById('missionLine'); if (!line) return;
  line.textContent = msg;
  line.style.display = 'block';
  setTimeout(()=>{ line.style.display='none'; }, 900);
}

// ---------- Public API ----------
export function init(state/*, hud*/, diff){
  const wrap = document.getElementById('plateTracker');
  if (wrap) wrap.style.display = 'block';
  const tgt = document.getElementById('targetWrap');
  if (tgt) tgt.style.display = 'none';

  state.ctx = state.ctx || {};
  state.ctx.need = makeQuotas(state.difficulty||'Normal');
  state.ctx.have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
  state.ctx.target = pickTargetGroup(state.ctx);

  // metrics for quests
  state.ctx.wrongGroup = 0;
  state.ctx.overfillCount = 0;
  state.ctx.targetHitsTotal = 0;

  renderPlateHUD(state);
}

export function cleanup(state){
  const wrap = document.getElementById('plateTracker');
  if (wrap) wrap.style.display = 'none';
}

export function pickMeta(diff, state){
  const ctx = state.ctx || {};
  const target = ctx.target || pickTargetGroup(ctx) || rnd(GROUPS);
  const isTargetPick = Math.random() < 0.72;
  const group = isTargetPick ? target : rnd(GROUPS);

  const char   = rnd(POOLS[group]);
  const golden = Math.random() < 0.08;

  return {
    id: `${group}_${Date.now().toString(36)}_${(Math.random()*999)|0}`,
    char,
    aria: group,
    label: group,
    groupId: group,
    good: group === target, // จะยืนยันอีกครั้งใน onHit
    golden,
    life: diff?.life ?? 3000,
  };
}

export function onHit(meta, systems, state/*, hud*/){
  const { score, sfx } = systems;
  const ctx = state.ctx;
  const g   = meta.groupId;
  const need = ctx.need[g]||0;
  const have = ctx.have[g]||0;

  // ผิดหมวด
  if (g !== ctx.target){
    ctx.wrongGroup = (ctx.wrongGroup||0) + 1;
    meta.good = false;
    try{ sfx.play('sfx-bad'); }catch{}
    return 'wrong'; // << ให้ main.js ลงโทษมากกว่า bad นิดหน่อย
  }

  // เกินโควตา → ลงโทษหนักกว่า bad
  if (need>0 && have>=need){
    ctx.overfillCount = (ctx.overfillCount||0) + 1;
    meta.good = false;
    try{ sfx.play('sfx-bad'); }catch{}
    return 'over'; // << บอก main.js เพื่อลดแต้ม/ตัดคอมโบ/แฟลชหน้าจอ
  }

  // ถูกหมวดและยังไม่เต็ม
  ctx.have[g] = have + 1;
  ctx.targetHitsTotal = (ctx.targetHitsTotal||0) + 1;
  const perfect = !!meta.golden || Math.random() < 0.18;

  renderPlateHUD(state);

  // เปลี่ยนเป้าหมายเมื่อครบหมวด
  if ((ctx.have[g]||0) >= (ctx.need[g]||0)){
    const next = pickTargetGroup(ctx);
    if (next && next !== ctx.target){
      ctx.target = next;
      flashLine(state.lang==='EN'
        ? `Next target: ${next}`
        : `เป้าหมายถัดไป: ${langName(state.lang)[next]||next}`);
    }
  }

  // จานครบหรือยัง
  if (isPlateComplete(ctx)){
    flashLine(state.lang==='EN' ? 'Plate Complete!' : 'จัดจานครบ!');
    try{ score.add?.(40); }catch{}
    try{ sfx.play('sfx-perfect'); }catch{}
    nextPlate(ctx, state.difficulty||'Normal');
    renderPlateHUD(state);
  }else{
    try{ sfx.play(perfect?'sfx-perfect':'sfx-good'); }catch{}
  }

  meta.good = true;
  return perfect ? 'perfect' : 'good';
}

export function tick(){}

// ---------- Internals ----------
function isPlateComplete(ctx){
  for (const g of GROUPS){
    const need = ctx.need[g]||0;
    const have = ctx.have[g]||0;
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
  ctx.target = pickTargetGroup(ctx);
}

import { add3DTilt, shatter3D } from '/webxr-health-mobile/HeroHealth/game/core/fx.js';
export const fx = {
  onSpawn(el){ add3DTilt(el); },
  onHit(x, y){ shatter3D(x, y); }
};
