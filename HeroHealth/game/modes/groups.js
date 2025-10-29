// === Hero Health Academy — game/modes/groups.js (Hardened + Factory adapter; golden fix & safeties) ===
export const name = 'groups';

// Safe FX bootstrap
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt: ()=>{}, shatter3D: ()=>{} };
    (async () => {
      try { const m = await import('/webxr-health-mobile/HeroHealth/game/core/fx.js').catch(()=>null);
        if (m) Object.assign(window.HHA_FX, m);
      } catch {}
    })();
  }
})();

// Data
const GROUPS = {
  veggies:[{emoji:'🥦',th:'บรอกโคลี',en:'Broccoli'},{emoji:'🥕',th:'แครอท',en:'Carrot'},{emoji:'🌽',th:'ข้าวโพด',en:'Corn'},{emoji:'🥬',th:'ผักใบเขียว',en:'Leafy'}],
  protein:[{emoji:'🍗',th:'ไก่',en:'Chicken'},{emoji:'🐟',th:'ปลา',en:'Fish'},{emoji:'🥚',th:'ไข่',en:'Egg'},{emoji:'🥜',th:'ถั่ว',en:'Nuts'}],
  grains: [{emoji:'🍚',th:'ข้าว',en:'Rice'},{emoji:'🍞',th:'ขนมปัง',en:'Bread'},{emoji:'🍝',th:'พาสต้า',en:'Pasta'},{emoji:'🥣',th:'โอ๊ต',en:'Oats'}],
  fruit:  [{emoji:'🍎',th:'แอปเปิล',en:'Apple'},{emoji:'🍌',th:'กล้วย',en:'Banana'},{emoji:'🍇',th:'องุ่น',en:'Grapes'},{emoji:'🍍',th:'สับปะรด',en:'Pineapple'}],
  dairy:  [{emoji:'🥛',th:'นม',en:'Milk'},{emoji:'🧀',th:'ชีส',en:'Cheese'},{emoji:'🍦',th:'ไอศกรีม',en:'Ice cream'},{emoji:'🍧',th:'โฟรโย',en:'Froyo'}],
};
const GROUP_KEYS = Object.keys(GROUPS);
const QUOTA = { Easy:6, Normal:8, Hard:10 };
const TARGET_RATIO = 0.28;
const GOLDEN_CHANCE = 0.04;
const GOLDEN_COOLDOWN_SPAWNS = 6;
const GOLDEN_CAP_PER20 = 2;

let _hudRef=null,_lastState=null,_x2Until=0,_magnetNext=false;
let _spawnsInWindow=0,_goldenInWindow=0,_sinceGolden=GOLDEN_COOLDOWN_SPAWNS;
let _targetCooldownUntil=0;

function nowMs(){ return performance?.now?.()||Date.now(); }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function chooseNextTarget(prev){ let ng; do { ng = GROUP_KEYS[(Math.random()*GROUP_KEYS.length)|0]; } while (ng===prev); return ng; }
function labelOf(item,lang='TH'){ return (lang==='EN')?item.en:item.th; }
function toast(msg){ let el=document.getElementById('toast'); if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el);} el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),1000); }
function updateTargetHUD(state){
  const have=state?.ctx?.targetHave|0, need=state?.ctx?.targetNeed|0, gkey=state?.ctx?.targetGroup;
  try{ _hudRef?.setTarget?.(gkey,have,need);}catch{}
  const el=document.getElementById('targetBadge'); if(el){
    const nameTH=({veggies:'ผัก',protein:'โปรตีน',grains:'ธัญพืช',fruit:'ผลไม้',dairy:'นม'})[gkey]||gkey;
    el.textContent=`${nameTH} • ${have}/${need}`; const wrap=document.getElementById('targetWrap'); if(wrap) wrap.style.display='inline-flex';
  }
}

// legacy init/cleanup/tick for adapter compatibility
export function init(state={}, hud=null){
  _hudRef=hud; _lastState=state; state.ctx=state.ctx||{};
  state.lang=(state.lang||localStorage.getItem('hha_lang')||'TH').toUpperCase();
  state.ctx.targetGroup=chooseNextTarget(null); state.ctx.targetNeed=QUOTA[state.difficulty]||8; state.ctx.targetHave=0;
  _x2Until=0; _magnetNext=false; _spawnsInWindow=0; _goldenInWindow=0; _sinceGolden=GOLDEN_COOLDOWN_SPAWNS; _targetCooldownUntil=0;
  updateTargetHUD(state);
}
export function cleanup(){ _hudRef=null; _lastState=null; _x2Until=0; _magnetNext=false; _spawnsInWindow=0; _goldenInWindow=0; _sinceGolden=GOLDEN_COOLDOWN_SPAWNS; _targetCooldownUntil=0; }
export function tick(){ if(_x2Until && nowMs()>_x2Until) _x2Until=0; }

export function pickMeta(diff={}, state={}){
  let forceTarget=false; if(_magnetNext){ forceTarget=true; _magnetNext=false; }
  const targetGroup=state.ctx?.targetGroup||'veggies';
  const isTarget = forceTarget || (Math.random()<TARGET_RATIO);
  const groupId = isTarget ? targetGroup : (()=>{
    let k; do{ k=GROUP_KEYS[(Math.random()*GROUP_KEYS.length)|0]; }while(k===targetGroup); return k; })();
  const item = GROUPS[groupId][(Math.random()*GROUPS[groupId].length)|0];

  _spawnsInWindow++; if(_spawnsInWindow>=20){ _spawnsInWindow=0; _goldenInWindow=0; }
  let golden=false;
  if(isTarget && _sinceGolden>GOLDEN_COOLDOWN_SPAWNS && _goldenInWindow<GOLDEN_CAP_PER20){
    if(Math.random()<GOLDEN_CHANCE){ golden=true; _goldenInWindow++; _sinceGolden=0; }
    else { _sinceGolden++; }
  } else { _sinceGolden++; }

  const lifeBase = Number(diff.life)>0?Number(diff.life):3000;
  const life = clamp(lifeBase,700,4500);

  return { char:item.emoji, label:labelOf(item,state.lang), aria:item.en, groupId, good:(groupId===targetGroup), golden, life };
}

export function onHit(meta={}, sys={}, state={}, hud=null){
  let result='ok';
  if(meta.good){
    result = meta.golden ? 'perfect' : 'good';
    const add = meta.golden ? 2 : 1;
    state.ctx.targetHave = Math.min((state.ctx.targetHave|0)+add, state.ctx.targetNeed|0);
    if((state.ctx.targetHave|0) >= (state.ctx.targetNeed|0)){
      try{ sys.sfx?.play?.('sfx-perfect'); }catch{}
      const next=chooseNextTarget(state.ctx.targetGroup);
      state.ctx.targetGroup=next; state.ctx.targetNeed=QUOTA[state.difficulty]||8; state.ctx.targetHave=0;
      _targetCooldownUntil = nowMs()+1200;
      const nameTH=({veggies:'ผัก',protein:'โปรตีน',grains:'ธัญพืช',fruit:'ผลไม้',dairy:'นม'})[next]||next;
      toast('🎯 เป้าหมายใหม่: '+nameTH);
      const wrap=document.getElementById('targetWrap'); if(wrap){ wrap.classList.add('glow'); setTimeout(()=>wrap.classList.remove('glow'),950); }
    }
    updateTargetHUD(state);
  } else { result='bad'; }
  return result;
}

export const powers = {
  x2Target(){ _x2Until = nowMs()+8000; },
  freezeTarget(){ if(_lastState) _lastState.freezeUntil = nowMs()+3000; },
  magnetNext(){ _magnetNext = true; }
};
export function getPowerDurations(){ return { x2:8, freeze:3, magnet:2 }; }
export const fx = {
  onSpawn(el){ try{ (window?.HHA_FX?.add3DTilt||(()=>{}))(el); }catch{} },
  onHit(x,y){ try{ (window?.HHA_FX?.shatter3D||(()=>{}))(x,y); }catch{} }
};

/* Factory adapter */
export function create({ engine, hud, coach }) {
  const host=document.getElementById('spawnHost'); const layer=document.getElementById('gameLayer');
  const state={
    running:false, items:[], freezeUntil:0,
    difficulty:(window.__HHA_DIFF||document.body.getAttribute('data-diff')||'Normal'),
    lang:(localStorage.getItem('hha_lang')||'TH').toUpperCase(),
    ctx:{ targetGroup:'veggies', targetNeed: QUOTA[document.body.getAttribute('data-diff')||'Normal']||8, targetHave:0 },
    stats:{good:0,perfect:0,bad:0,miss:0}
  };
  _lastState=state; _hudRef=hud;

  function start(){ stop(); state.running=true; state.items.length=0; state.freezeUntil=0; state.stats={good:0,perfect:0,bad:0,miss:0}; init(state,hud,{}); coach?.onStart?.(); }
  function stop(){ state.running=false; try{ for(const it of state.items) it.el.remove(); }catch{} state.items.length=0; }
  function update(dt,Bus){
    if(!state.running||!layer) return;
    const now=performance.now(); const rect=layer.getBoundingClientRect();
    if(!state._spawnCd) state._spawnCd=0.18;
    const timeLeft=Number(document.getElementById('time')?.textContent||'0')|0;
    const speedBias = timeLeft<=15?0.18:0;
    state._spawnCd -= dt;
    if(now>=state.freezeUntil && state._spawnCd<=0){ spawnOne(rect,Bus); state._spawnCd=clamp(0.42 - speedBias + Math.random()*0.24, 0.28, 1.0); }
    const gone=[];
    for(const it of state.items){
      if(now - it.born > it.life){
        if(it.meta.good){ Bus?.miss?.(); state.stats.miss++; }
        try{ it.el.remove(); }catch{} gone.push(it);
      }
    }
    if(gone.length) state.items = state.items.filter(x=>!gone.includes(x));
  }

  function spawnOne(rect,Bus){
    const meta = pickMeta({ life:1600 }, state);
    const pad=30;
    const x=Math.round(pad + Math.random()*(Math.max(1,rect.width)-pad*2));
    const y=Math.round(pad + Math.random()*(Math.max(1,rect.height)-pad*2));
    const b=document.createElement('button'); b.className='spawn-emoji'; b.type='button';
    b.style.left=x+'px'; b.style.top=y+'px'; b.textContent=meta.char; b.setAttribute('aria-label', meta.aria);
    if(meta.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';
    try{ fx.onSpawn?.(b,state); }catch{}
    b.addEventListener('click',(ev)=>{
      if(!state.running) return; ev.stopPropagation();
      const ui={x:ev.clientX,y:ev.clientY};
      const res = onHit(meta, { sfx: Bus?.sfx }, state, hud);
      if(res==='good'||res==='perfect'){
        const pts = res==='perfect' ? 20 : 10;
        if(res==='perfect'){ coach?.onPerfect?.(); } else { coach?.onGood?.(); }
        engine?.fx?.popText?.(`+${pts}${res==='perfect'?' ✨':''}`,{x:ui.x,y:ui.y,ms:720});
        try{ fx.onHit?.(ui.x,ui.y,meta,state); }catch{}
        state.stats[res]++; Bus?.hit?.({kind:res,points:pts,ui,meta:{...meta,isTarget:meta.good}});
      } else if(res==='bad'){
        document.body.classList.add('flash-danger'); setTimeout(()=>document.body.classList.remove('flash-danger'),160);
        coach?.onBad?.(); state.stats.bad++; Bus?.miss?.({meta:{...meta,isTarget:meta.good}});
        state.freezeUntil = Math.max(state.freezeUntil, performance.now()+260);
      }
      try{ b.remove(); }catch{} const idx=state.items.findIndex(it=>it.el===b); if(idx>=0) state.items.splice(idx,1);
    },{passive:false});
    (host||document.getElementById('spawnHost'))?.appendChild?.(b);
    state.items.push({el:b,x,y,born:performance.now(),life:meta.life,meta});
  }
  function cleanup(){ stop(); try{ cleanupLegacy(); }catch{} }
  function cleanupLegacy(){ try{ cleanup(state,hud); }catch{} }
  return { start, stop, update, cleanup };
}
