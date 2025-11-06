// === vr/mode-factory.js — Production HUD+Fever+Anti-Overlap (2025-11-07) ===
import { Difficulty }   from './difficulty.js';
import { Emoji }        from './emoji-sprite.js';
import { Fever }        from './fever.js';
import { MiniQuest }    from './miniquest.js';
import { MissionDeck }  from './mission.js';
import * as FX          from './particles.js';
import { SFX }          from './sfx.js';

const Particles = FX.Particles || FX;

// ---------------- Helpers ----------------
const $ = s => document.querySelector(s);
const sample = a => a[Math.floor(Math.random() * a.length)];
const clamp  = (n,a,b)=>Math.max(a,Math.min(b,n));
const now    = ()=>performance.now();
const emit   = (name, detail)=>{ try{ window.dispatchEvent(new CustomEvent(name,{detail})); }catch{} };

// Twemoji fallback (if ?emoji=svg)
const USE_EMOJI_SVG = (()=>{ try{ return (new URL(location.href)).searchParams.get('emoji')?.toLowerCase()==='svg'; }catch{ return false; }})();
const toCP = (s)=>{ const p=[]; for(const ch of s) p.push(ch.codePointAt(0).toString(16)); return p.join('-'); };
const twemojiURL = (ch)=>`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${toCP(ch)}.svg`;

function makeEmojiNode(char,{scale=0.58}={}){
  if(!USE_EMOJI_SVG){
    if(typeof Emoji?.fromChar==='function') return Emoji.fromChar(char,{size:96,scale,glow:true,shadow:true});
    if(typeof Emoji?.create==='function')   return Emoji.create({type:'GOOD', size:scale});
    const el=document.createElement('a-entity'); el.setAttribute('text',{value:char,align:'center',width:2.2*scale,color:'#fff'});return el;
  }else{
    const img=document.createElement('a-image'); img.setAttribute('src',twemojiURL(char));
    img.setAttribute('width',0.80*scale); img.setAttribute('height',0.80*scale); return img;
  }
}

// ----- Slot grid (ล่าง-กลางจอ) + anti-overlap -----
function buildSlots(yBase=0.42){
  const xs=[-0.95, 0.00, 0.95];
  const ys=[ yBase, yBase+0.34 ];
  const slots=[]; let id=0;
  for(let ci=0; ci<xs.length; ci++)
    for(let ri=0; ri<ys.length; ri++)
      slots.push({ id:id++, col:ci, row:ri, x:xs[ci], y:ys[ri], z:-1.34, used:false, lastUsed:0 });
  return slots;
}
function takeFreeSlot(slots, busyCols, busyRows, cooldownMs){
  const t=now();
  const free=slots.filter(s=>!s.used && (t - s.lastUsed >= cooldownMs) && !busyCols.has(s.col) && !busyRows.has(s.row));
  if(!free.length) return null;
  const s=free[Math.floor(Math.random()*free.length)]; s.used=true; return s;
}
function releaseSlot(slots, slot){ if(slot){ slot.used=false; slot.lastUsed=now(); } }

// ------- Defaults -------
const MIN_DIST_DEFAULT         = 0.36; // m
const SLOT_COOLDOWN_MS_DEFAULT = 520;  // ms
const MAX_ACTIVE_BY_DIFF_DEF   = { easy:1, normal:2, hard:2 };
const BUDGET_BY_DIFF_DEF       = { easy:1, normal:2, hard:2 };
const TIME_BY_DIFF_DEF         = { easy:45, normal:60, hard:75 };

// -------------- Factory boot --------------
/**
 * config = {
 *   name: 'goodjunk'|'groups'|'hydration'|'plate',
 *   pools: { good: string[], bad?: string[] },
 *   judge(hitChar, ctx) -> { good:boolean, scoreDelta:number, feverDelta?:number }
 *   ui: { questMainSel?: string }
 *   goldenRate?: number, goodRate?: number
 *   minDist?: number, slotCooldownMs?: number
 *   timeByDiff?: {easy,normal,hard}
 *   maxActiveByDiff?: {easy,normal,hard}, budgetByDiff?: {...}
 *   host, duration, difficulty, goal
 * }
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

  // MiniQuest + MissionDeck
  const mq=new MiniQuest( {}, { coach_start:$('#coach_start'), coach_good:$('#coach_good'),
                                coach_warn:$('#coach_warn'), coach_fever:$('#coach_fever'),
                                coach_quest:$('#coach_quest'), coach_clear:$('#coach_clear') } );
  mq.start(goal);
  const missions=new MissionDeck(); missions.draw3?.();

  // helper: ข้อความเควสที่ส่งให้ HUD
  function questLine(){
    try{
      const qs=mq.quests||[];
      const done=qs.filter(q=>q._done).length;
      const idx=Math.max(0, qs.findIndex(q=>!q._done));
      const cur=qs[idx>=0?idx:qs.length-1];
      if(!cur) return 'Mini Quest';
      const tgt=(cur.type==='mission')?1:cur.target;
      const prog=(cur.type==='mission')?(cur.prog?1:0):Math.min(cur.prog||0, tgt);
      return `Mini Quest (${Math.min(done+1,3)}/3) — ${cur.label}${cur.type==='mission'?'':` (${prog}/${tgt})`}`;
    }catch{ return 'Mini Quest'; }
  }
  emit('hha:quest', { text: questLine() });

  // Time/Difficulty
  const difficulty = givenDiff;
  let remain   = (givenDuration || timeByDiff[difficulty] || 60) * 1000;
  emit('hha:time', { remainSec: Math.ceil(remain/1000) });

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
  const comboDecay=setInterval(()=>{ if(!running) return; if(now()-lastGoodAt>2000 && combo>0){ combo--; emit('hha:score',{score,combo}); }},1000);

  // Fever banner watcher → HUD
  let feverPrev=false;
  const feverWatcher=setInterval(()=>{ 
    if(!running) return;
    if(!!fever.active !== feverPrev){
      feverPrev = !!fever.active;
      emit('hha:fever', { state: feverPrev ? 'start' : 'end' });
    }
  }, 200);

  // Pause/Resume hooks
  let api=null;
  window.addEventListener('blur',  ()=>api?.pause?.());
  window.addEventListener('focus', ()=>api?.resume?.());
  document.addEventListener('visibilitychange',()=>document.hidden?api?.pause?.():api?.resume?.());

  function spawnOne(){
    if(!running) return;
    if(SPAWN_LOCK) return; SPAWN_LOCK=true;
    try{
      if(active.size>=MAX_ACTIVE || issuedThisSec>=BUDGET) return;

      const slot=takeFreeSlot(slots, busyCols, busyRows, slotCooldownMs);
      if(!slot) return;

      // 2D overlap check (soft reject)
      const tooClose=[...active].some(el=>{ try{ const p=el.getAttribute('position'); const dx=p.x-slot.x, dy=p.y-slot.y; return (dx*dx+dy*dy)<(MIN_DIST_DEFAULT*MIN_DIST_DEFAULT); }catch{ return false; }});
      if(tooClose){ releaseSlot(slots,slot); return; }

      // reserve
      busyCols.add(slot.col); busyRows.add(slot.row); issuedThisSec++;

      // pick char
      const isGood = Math.random() < goodRate || !pools.bad?.length;
      const char   = isGood ? sample(pools.good) : sample(pools.bad||pools.good);
      const isGold = isGood && Math.random() < (goldenRate||0);

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
      const killer=setTimeout(()=>{ // timeout -> miss
        streak=0; combo=0; mq.junk();
        emit('hha:score',{score,combo});
        emit('hha:quest',{text:questLine()});
        cleanup();
      }, ttl);

      const fire=(ev)=>{
        if(consumed) return; consumed=true;
        try{ ev?.stopPropagation?.(); ev?.preventDefault?.(); }catch{}
        clearTimeout(killer);

        // judge result
        let res = { good:true, scoreDelta:10, feverDelta:0 };
        if(typeof judge==='function') res = judge(char, { type:'hit', score, combo, streak, feverActive:fever.active });

        if(res.good){
          const plus = res.scoreDelta ?? 10;
          missionGood+=1; score+=plus; combo+=1; streak+=1; comboMax=Math.max(comboMax,combo); lastGoodAt=now();
          sfx.popGood?.(); Particles.burst?.(host, {x:slot.x,y:slot.y,z:slot.z}, '#69f0ae');
          // score popup
          const t=document.createElement('a-entity');
          t.setAttribute('troika-text',`value: +${plus}; color:#fff; fontSize:0.08; anchor:center`);
          t.setAttribute('position',`${slot.x} ${slot.y+0.05} ${slot.z+0.01}`); host.appendChild(t);
          t.setAttribute('animation__rise',`property: position; to: ${slot.x} ${slot.y+0.30} ${slot.z+0.01}; dur: 520; easing: ease-out`);
          t.setAttribute('animation__fade',`property: opacity; to: 0; dur: 520; easing: linear`);
          setTimeout(()=>t.remove(),560);

          if(res.feverDelta) try{ fever.add(res.feverDelta); }catch{}
          mq.good({score,combo,streak,missionGood});
        }else{
          score=Math.max(0, score + (res.scoreDelta ?? -5));
          combo=0; streak=0; sfx.popBad?.(); Particles.smoke?.(host,{x:slot.x,y:slot.y,z:slot.z}); mq.junk();
        }
        emit('hha:score',{score,combo});
        emit('hha:quest',{text:questLine()});
        if(missionGood>=goal){ mq.mission(missionGood); emit('hha:quest',{text:questLine()}); }
        cleanup();
      };

      ['click','mousedown','touchstart','triggerdown'].forEach(evt=>{
        try{ hit.addEventListener(evt, fire, {passive:false}); }catch{}
        try{ el.addEventListener(evt,  fire, {passive:false}); }catch{}
      });

      host.appendChild(el);

      function cleanup(){
        try{ el.remove(); }catch{}
        active.delete(el);
        busyCols.delete(slot.col); busyRows.delete(slot.row);
        releaseSlot(slots,slot);
      }
    } finally { SPAWN_LOCK=false; }
  }

  // Sweeper: resolve overlaps every 200ms
  function resolveOverlaps(){
    const arr=[...active];
    for(let i=0;i<arr.length;i++){
      for(let j=i+1;j<arr.length;j++){
        const a=arr[i], b=arr[j];
        try{
          const pa=a.getAttribute('position'), pb=b.getAttribute('position');
          const dx=pb.x-pa.x, dy=pb.y-pa.y, d2=dx*dx+dy*dy;
          if(d2 < (MIN_DIST_DEFAULT*MIN_DIST_DEFAULT)){
            const dest=takeFreeSlot(slots, busyCols, busyRows, slotCooldownMs);
            if(dest){
              b.setAttribute('position',`${dest.x} ${dest.y} ${dest.z}`);
              busyCols.add(dest.col); busyRows.add(dest.row);
              if(b.__col!=null && b.__row!=null){ busyCols.delete(b.__col); busyRows.delete(b.__row); }
              b.__col=dest.col; b.__row=dest.row;
            }else{
              try{ b.remove(); }catch{} active.delete(b);
            }
          }
        }catch{}
      }
    }
  }
  const overlapSweeper=setInterval(()=>{ if(running) resolveOverlaps(); },200);

  // Spawn loop
  function loop(){
    clearTimeout(spawnTicker);
    const tick=()=>{ if(running && issuedThisSec<BUDGET) spawnOne(); const cd=Math.max(380, spawnRateMs|0); spawnTicker=setTimeout(tick, cd); };
    tick();
  }
  loop(); setTimeout(()=>spawnOne(),240);

  // Countdown timer → HUD
  const timerTick=setInterval(()=>{
    if(!running) return;
    remain -= 1000;
    emit('hha:time', { remainSec: Math.max(0, Math.ceil(remain/1000)) });
    mq.second(); missions.second?.();
    if(remain<=0) endGame('timeout');
  }, 1000);

  // Fever tuning (spawn speed)
  window.addEventListener('hha:fever',(e)=>{
    const s=e?.detail?.state;
    if(s==='start'){ spawnRateMs=Math.round(spawnRateMs*0.85); }
    if(s==='end'){   spawnRateMs = Number(base.rate)||520; }
  });

  function endGame(reason='stop'){
    if(!running) return; running=false;
    clearTimeout(spawnTicker); clearInterval(timerTick); clearInterval(budgetTimer);
    clearInterval(comboDecay); clearInterval(overlapSweeper); clearInterval(feverWatcher);
    try{ fever.end(); }catch{} try{ sfx.playCoach?.('clear'); }catch{}
    emit('hha:time',{remainSec:0}); emit('hha:fever',{state:'end'});
    try{ window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason,score,missionGood,goal,comboMax}})); }catch{}
  }

  const api={ 
    pause(){ if(!running) return; running=false; clearTimeout(spawnTicker); },
    resume(){ if(running) return; running=true; loop(); },
    stop(){ endGame('stop'); }
  };
  return api;
}
