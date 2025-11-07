// === vr/mode-factory.js — Shared anti-overlap spawner & gameplay (SAFE no-global 'api') ===
import { Difficulty }   from './difficulty.js';
import { Emoji }        from './emoji-sprite.js';
import { Fever }        from './fever.js';
import { MiniQuest }    from './miniquest.js';
import { MissionDeck }  from './mission.js';
import * as FX          from './particles.js';
import { SFX }          from './sfx.js';

const Particles = FX.Particles || FX;

const $=s=>document.querySelector(s);
const sample=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const now=()=>performance.now();

// ------- Core constants (safe defaults) -------
const MIN_DIST_DEFAULT         = 0.36; // m
const SLOT_COOLDOWN_MS_DEFAULT = 520;  // ms
const MAX_ACTIVE_BY_DIFF_DEF   = { easy:1, normal:2, hard:2 };
const BUDGET_BY_DIFF_DEF       = { easy:1, normal:2, hard:2 };
const TIME_BY_DIFF_DEF         = { easy:45, normal:60, hard:75 };

// Twemoji fallback
const USE_EMOJI_SVG = (()=>{ try{ return (new URL(location.href)).searchParams.get('emoji')?.toLowerCase()==='svg'; }catch{ return false; }})();
const toCP = (s)=>{ const p=[]; for(const ch of s) p.push(ch.codePointAt(0).toString(16)); return p.join('-'); };
const twemojiURL = (ch)=>`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${toCP(ch)}.svg`;

function makeEmojiNode(char,{scale=0.58}={}){
  if(!USE_EMOJI_SVG){
    if(typeof Emoji?.fromChar==='function') return Emoji.fromChar(char,{size:96,scale,glow:true,shadow:true});
    if(typeof Emoji?.create==='function'){ return Emoji.create({type:'GOOD', size:scale}); }
    const el=document.createElement('a-entity'); el.setAttribute('text',{value:char,align:'center',width:2.2*scale,color:'#fff'}); return el;
  }else{
    const img=document.createElement('a-image'); img.setAttribute('src',twemojiURL(char));
    img.setAttribute('width',0.80*scale); img.setAttribute('height',0.80*scale); return img;
  }
}

function buildSlots(yBase=0.42){
  const xs=[-0.95, 0.00, 0.95];
  const ys=[ yBase, yBase+0.34 ];
  const slots=[]; let id=0;
  for(let ci=0; ci<xs.length; ci++){
    for(let ri=0; ri<ys.length; ri++){
      slots.push({ id:id++, col:ci, row:ri, x:xs[ci], y:ys[ri], z:-1.34, used:false, lastUsed:0 });
    }
  }
  return slots;
}
function takeFreeSlot(slots, busyCols, busyRows, cooldownMs){
  const t=now();
  const free=slots.filter(s=>!s.used && (t - s.lastUsed >= cooldownMs) && !busyCols.has(s.col) && !busyRows.has(s.row));
  if(!free.length) return null;
  const s=free[Math.floor(Math.random()*free.length)]; s.used=true; return s;
}
function releaseSlot(slots, slot){ if(slot){ slot.used=false; slot.lastUsed=now(); } }

/**
 * boot(config) — no global 'api' to avoid re-declare across reloads
 */
export async function boot(config={}){
  const {
    name='mode',
    pools={ good:[], bad:[] },
    judge,
    ui={ questMainSel:'#tQmain' },
    goldenRate=0.07,
    goodRate =0.70,
    minDist  =MIN_DIST_DEFAULT,
    slotCooldownMs=SLOT_COOLDOWN_MS_DEFAULT,
    timeByDiff=TIME_BY_DIFF_DEF,
    maxActiveByDiff=MAX_ACTIVE_BY_DIFF_DEF,
    budgetByDiff   =BUDGET_BY_DIFF_DEF,
    host:givenHost,
    duration:givenDuration,
    difficulty:givenDiff='normal',
    goal=40
  } = config;

  // Host safety
  let host=givenHost;
  if(!host){ const wrap=$('a-scene')||document.body; const auto=document.createElement('a-entity'); auto.id='spawnHost'; wrap.appendChild(auto); host=auto; }

  const sfx=new SFX('../assets/audio/'); await sfx.unlock?.(); sfx.attachPageVisibilityAutoMute?.();
  const scene=$('a-scene')||document.body;
  const fever=new Fever(scene,null,{durationMs:10000});

  // MiniQuest
  const mq=new MiniQuest( { tQmain:$(ui.questMainSel||'#tQmain') },
    { coach_start:$('#coach_start'), coach_good:$('#coach_good'), coach_warn:$('#coach_warn'),
      coach_fever:$('#coach_fever'), coach_quest:$('#coach_quest'), coach_clear:$('#coach_clear') } );
  mq.start(goal);
  const missions=new MissionDeck(); missions.draw3?.();

  // Time/Difficulty
  const difficulty = givenDiff;
  let duration = givenDuration || timeByDiff[difficulty] || 60;
  window.dispatchEvent(new CustomEvent('hha:time',{detail:{sec:duration}}));

  const diff=new Difficulty();
  const safe={ size:0.60, rate:520, life:2000 };
  const base=(diff?.config?.[difficulty]) || (diff?.config?.normal) || safe;
  let spawnRateMs = Number(base.rate) || safe.rate;
  let lifetimeMs  = Number(base.life) || safe.life;
  let sizeFactor  = Math.max(0.40, (Number(base.size)||0.60)*0.80);
  let hitWBase    = (difficulty==='easy'?0.50 : difficulty==='hard'?0.40 : 0.46);
  const hitW      = Math.min(hitWBase, minDist*0.80);

  // State
  let running=true, missionGood=0, score=0, combo=0, comboMax=0, streak=0, lastGoodAt=now();
  let MAX_ACTIVE = maxActiveByDiff[difficulty] ?? 2;
  const BUDGET   = budgetByDiff[difficulty] ?? 2;

  const active=new Set();
  const slots = buildSlots();
  const busyCols=new Set(), busyRows=new Set();
  let issuedThisSec=0, spawnTicker, SPAWN_LOCK=false;
  const budgetTimer=setInterval(()=>{ issuedThisSec=0; },1000);

  // FPS adapt
  let frames=0, lastT=now();
  (function raf(t){ frames++; if(t-lastT>=1000){ const fps=frames; frames=0; lastT=t; if(fps<40){ spawnRateMs=Math.min(spawnRateMs*1.15,900); MAX_ACTIVE=Math.max(1,Math.round(MAX_ACTIVE*0.9)); } } requestAnimationFrame(raf); })(performance.now());

  // Combo decay
  const comboDecay=setInterval(()=>{ if(!running) return; if(now()-lastGoodAt>2000 && combo>0){ combo--; try{ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); }catch{} }},1000);

  // Pause/Resume hooks
  const ctl = { paused:false };
  window.addEventListener('blur',  ()=>ctl.paused=true);
  window.addEventListener('focus', ()=>ctl.paused=false);
  document.addEventListener('visibilitychange',()=>{ ctl.paused=document.hidden; });

  function spawnOne(){
    if(!running || ctl.paused) return;
    if(SPAWN_LOCK) return; SPAWN_LOCK=true;
    try{
      if(active.size>=MAX_ACTIVE || issuedThisSec>=BUDGET) return;

      const slot=takeFreeSlot(slots, busyCols, busyRows, slotCooldownMs);
      if(!slot) return;

      // 2D overlap check
      const tooClose=[...active].some(el=>{ try{ const p=el.getAttribute('position'); const dx=p.x-slot.x, dy=p.y-slot.y; return (dx*dx+dy*dy)<(minDist*minDist); }catch{ return false; }});
      if(tooClose){ releaseSlot(slots,slot); return; }

      // reserve
      busyCols.add(slot.col); busyRows.add(slot.row); issuedThisSec++;

      // pick char
      const isGood = Math.random() < (config.goodRate ?? 0.70) || !pools.bad?.length;
      const char   = isGood ? sample(pools.good) : sample(pools.bad||pools.good);
      const isGold = isGood && Math.random() < (config.goldenRate ?? 0.07);

      const el=makeEmojiNode(char,{scale:clamp(sizeFactor,0.35,0.65)});
      el.setAttribute('position',`${slot.x} ${slot.y} ${slot.z}`);
      el.classList.add('hit','clickable'); el.__col=slot.col; el.__row=slot.row;

      if(isGold){
        el.setAttribute('scale','1.12 1.12 1.12');
        const halo=document.createElement('a-ring');
        halo.setAttribute('radius-inner','0.18'); halo.setAttribute('radius-outer','0.22');
        halo.setAttribute('position','0 0 0.001'); halo.setAttribute('material','color:#ffe066; opacity:0.85; shader:flat');
        el.appendChild(halo);
      }

      const hit=document.createElement('a-plane');
      hit.setAttribute('width',hitW); hit.setAttribute('height',hitW);
      hit.setAttribute('material','opacity:0; transparent:true; side:double');
      hit.classList.add('hit','clickable');
      el.appendChild(hit);

      active.add(el);

      const ttlMult=(difficulty==='easy')?1.8:(difficulty==='hard'?0.95:1.1);
      let ttl=Math.round(lifetimeMs*ttlMult*(1.05+Math.random()*0.35));
      if(active.size<=1) ttl=Math.max(ttl,2400);

      let consumed=false;
      const killer=setTimeout(()=>{ // miss
        if(typeof judge==='function'){
          const res = judge(null, { type:'timeout', char, score, combo, streak, feverActive:fever.active });
          if(res?.good===false){ streak=0; combo=0; mq.junk(); }
        }else{ streak=0; combo=0; mq.junk(); }
        cleanup();
      }, ttl);

      const fire=(ev)=>{
        if(consumed) return;