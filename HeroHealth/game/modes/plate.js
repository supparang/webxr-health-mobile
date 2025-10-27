// === Hero Health Academy — modes/plate.js (hardened + easy mini-quests) ===
export const name = 'plate';

/* ------------------------------ Safe imports ------------------------------ */
// Progress (fallback: no-op)
let Progress = {
  runCtx: null,
  emit(){},
};
(async () => {
  try {
    const m = await import('../game/core/progression.js').catch(()=>null);
    if (m?.Progress) Progress = m.Progress;
  } catch {}
  if (!('runCtx' in Progress)) {
    try {
      const m2 = await import('/webxr-health-mobile/HeroHealth/game/core/progression.js').catch(()=>null);
      if (m2?.Progress) Progress = m2.Progress;
    } catch {}
  }
})();

// FX (fallback-safe)
let FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
(async () => {
  try {
    const m = await import('../game/core/fx.js').catch(()=>null);
    if (m) FX = { add3DTilt: m.add3DTilt||(()=>{}), shatter3D: m.shatter3D||(()=>{}) };
  } catch {}
  if (!FX.add3DTilt || !FX.shatter3D) {
    try {
      const m2 = await import('/webxr-health-mobile/HeroHealth/game/core/fx.js').catch(()=>null);
      if (m2) FX = { add3DTilt: m2.add3DTilt||(()=>{}), shatter3D: m2.shatter3D||(()=>{}) };
    } catch {}
  }
})();

/* ------------------------------ Item pools (20 each) ------------------------------ */
const VEGGIES = ['🥦','🥕','🥒','🌽','🍅','🍆','🥗','🥬','🥔','🧅','🧄','🍄','🌶️','🥒','🥕','🥦','🥬','🍅','🥔','🍄'];
const FRUITS  = ['🍎','🍌','🍓','🍇','🍉','🍍','🍑','🍊','🍐','🥭','🍒','🍋','🥝','🍈','🫐','🍎','🍌','🍊','🍇','🍍'];
const GRAINS  = ['🍞','🥖','🥨','🍚','🍙','🍘','🍜','🍝','🍛','🌯','🌮','🥞','🫓','🥪','🥯','🍞','🍚','🍝','🥖','🥨'];
const PROTEIN = ['🍗','🍖','🥩','🍳','🐟','🍤','🫘','🥜','🧆','🌭','🍣','🍢','🥓','🧆','🍗','🍳','🐟','🍤','🫘','🥩'];
const DAIRY   = ['🥛','🧀','🍨','🍦','🥛','🧀','🥛','🧀','🍧','🍦','🥛','🧀','🍨','🍦','🥛','🧀','🥛','🧀','🍧','🍦'];

const GROUPS = ['veggies','fruits','grains','protein','dairy'];
const POOLS  = { veggies:VEGGIES, fruits:FRUITS, grains:GRAINS, protein:PROTEIN, dairy:DAIRY };

/* ------------------------------ Helpers ------------------------------ */
const rnd   = (arr)=>arr[(Math.random()*arr.length)|0];
const clamp = (x,a,b)=>Math.max(a,Math.min(b,x));
function langName(lang){
  return (lang==='EN')
    ? {veggies:'Veggies', fruits:'Fruits', grains:'Grains', protein:'Protein', dairy:'Dairy'}
    : {veggies:'ผัก', fruits:'ผลไม้', grains:'ธัญพืช', protein:'โปรตีน', dairy:'นม'};
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
    if (need>bestNeed){ bestNeed=need; best=g; }
  }
  return bestNeed>0 ? best : null;
}

/* ------------------------------ HUD renderers (safe) ------------------------------ */
function renderPlateHUD(state){
  const host = document.getElementById('platePills'); if (!host) return;
  const L = langName((state.lang||'TH').toUpperCase());
  const pills = GROUPS.map(g=>{
    const have = state?.ctx?.have?.[g]||0;
    const need = state?.ctx?.need?.[g]||0;
    const done = need>0 && have>=need;
    const barW = need>0 ? clamp((have/need)*100, 0, 100) : 0;
    return `<div class="pill ${done?'ok':''}">
      <b>${L[g]}</b>
      <span>${have}/${need}</span>
      <i style="width:${barW}%"></i>
    </div>`;
  }).join('');
  host.innerHTML = pills;
}
function flashLine(msg){
  const line = document.getElementById('missionLine'); if (!line) return;
  line.textContent = msg; line.style.display='block';
  setTimeout(()=>{ line.style.display='none'; }, 900);
}

/* ------------------------------ Easy mini-quests ------------------------------ */
function applyEasyMiniQuests(lang='TH'){
  const pool = [
    { id:'pl_target8',  th:'วางถูกหมวดรวม 8 ชิ้น',   en:'Collect 8 target items',  need:8,  type:'count_target' },
    { id:'pl_veg2',     th:'ใส่ผัก 2 ส่วน',           en:'Add 2 veggie portions',   need:2,  type:'count_group', group:'veggies' },
    { id:'pl_combo6',   th:'ทำคอมโบถึง x6',          en:'Reach combo x6',          need:6,  type:'reach_combo' },
    { id:'pl_perfect2', th:'Perfect 2 ครั้ง',          en:'2 Perfects',              need:2,  type:'count_perfect' },
    { id:'pl_golden1',  th:'เก็บ Golden 1 ชิ้น',       en:'Hit 1 Golden',            need:1,  type:'count_golden' },
  ];
  try{
    const rc = Progress.runCtx;
    if (!rc || rc.mode!=='plate') return;
    const shuffled = pool.slice().sort(()=>Math.random()-0.5).slice(0,3)
      .map(m=>({ ...m, label:(lang==='EN'?m.en:m.th), prog:0, done:false }));
    rc.missions = shuffled;
    Progress.emit?.('run_start', { mode:'plate', difficulty: rc.difficulty, missions: shuffled });
  }catch{}
}

/* ------------------------------ Public API (main.js contract) ------------------------------ */
export function init(state={}, hud=null, diff={}){
  // HUD toggle
  try { const tgt = document.getElementById('targetWrap'); if (tgt) tgt.style.display='none'; } catch {}
  try { const wrap= document.getElementById('plateTracker'); if (wrap) wrap.style.display='block'; } catch {}

  // State
  state.ctx = state.ctx || {};
  const diffKey = state.difficulty || 'Normal';
  state.ctx.need   = makeQuotas(diffKey);
  state.ctx.have   = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
  state.ctx.target = pickTargetGroup(state.ctx);
  state.lang = (state.lang || localStorage.getItem('hha_lang') || 'TH').toUpperCase();

  renderPlateHUD(state);
  applyEasyMiniQuests(state.lang || 'TH');
}

export function cleanup(/*state*/){
  try { const wrap = document.getElementById('plateTracker'); if (wrap) wrap.style.display='none'; } catch {}
}

export function pickMeta(diff={}, state={}){
  const ctx = state.ctx || {};
  const target = ctx.target || pickTargetGroup(ctx) || rnd(GROUPS);

  // 70% ให้กลุ่มเป้าหมาย เพื่อทำโควตาทันเวลา
  const isTargetPick = Math.random() < 0.70;
  const group = isTargetPick ? target : rnd(GROUPS);

  const char = rnd(POOLS[group]);
  const golden = Math.random() < 0.08; // golden เอื้อให้ mini-quests สำเร็จได้จริง

  const lifeBase = Number(diff?.life) > 0 ? Number(diff.life) : 3000;
  const life = clamp(lifeBase, 700, 4500);

  return {
    id: `${group}_${Date.now().toString(36)}_${(Math.random()*999)|0}`,
    char,
    aria: group,
    label: group,
    groupId: group,
    good: group === target,   // นับ “ถูกหมวด” เมื่อเป็นกลุ่มเป้าหมาย
    golden,
    life
  };
}

export function onHit(meta={}, systems={}, state={}/*, hud*/){
  const score = systems?.score, sfx = systems?.sfx;
  const ctx = state.ctx || { need:{}, have:{} };

  if (meta.groupId === ctx.target){
    ctx.have[meta.groupId] = (ctx.have[meta.groupId]||0) + 1;

    // Golden = โอกาส Perfect (เพิ่มอีกเล็กน้อยให้สนุก)
    const perfect = !!meta.golden || Math.random() < 0.18;
    renderPlateHUD(state);

    if (isPlateComplete(ctx)){
      flashLine(state.lang==='EN' ? 'Plate Complete!' : 'จัดจานครบ!');
      try{ score?.add?.(40); }catch{}
      try{ sfx?.play?.('sfx-perfect'); }catch{}
      nextPlate(ctx, state.difficulty||'Normal');
      renderPlateHUD(state);
    }else{
      try{ sfx?.play?.(perfect?'sfx-perfect':'sfx-good'); }catch{}
    }

    // ให้ engine คิดคะแนนต่อ (combo/fever), และ Progress.event('hit') จะนับ:
    // - meta.good === true → count_target
    // - meta.groupId === 'veggies' → count_group: veggies
    // - meta.golden === true → count_golden
    return perfect ? 'perfect' : 'good';
  }

  try{ sfx?.play?.('sfx-bad'); }catch{}
  return 'bad';
}

export function tick(/*state, systems, hud*/){
  // ไม่มีกลไกเวลาเพิ่มเติมในโหมดนี้
}

/* ------------------------------ Internals ------------------------------ */
function isPlateComplete(ctx){
  for (const g of GROUPS){
    const need = ctx?.need?.[g]||0;
    const have = ctx?.have?.[g]||0;
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

/* ------------------------------ FX hooks ------------------------------ */
export const fx = {
  onSpawn(el/*, state*/){ try { FX.add3DTilt?.(el); } catch {} },
  onHit(x, y/*, meta, state*/){ try { FX.shatter3D?.(x, y); } catch {} }
};
