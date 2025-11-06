// === vr/mode-factory.js — Shared spawner + HUD + FX (2025-11-07) ===
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

const USE_EMOJI_SVG = (()=>{ try{ return (new URL(location.href)).searchParams.get('emoji')?.toLowerCase()==='svg'; }catch{ return false; }})();
const toCP = (s)=>{ const p=[]; for(const ch of s) p.push(ch.codePointAt(0).toString(16)); return p.join('-'); };
const twemojiURL = (ch)=>`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${toCP(ch)}.svg`;

// ---- helpers ----
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

// -------------- Factory boot --------------
/**
 * config = {
 *   name: 'goodjunk'|'groups'|'hydration'|'plate',
 *   pools: { good: string[], bad?: string[] },
 *   judge(hitChar, ctx) -> { good:boolean, scoreDelta:number, feverDelta?:number }
 *   ui: { questMainSel?: string }
 *   goldenRate?: number, goodRate?: number
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
    minDist  =0.36,
    slotCooldownMs=520,
    timeByDiff={ easy:45, normal:60, hard:75 },
    maxActiveByDiff={ easy:1, normal:2, hard:2 },
    budgetByDiff   ={ easy:1, normal:2, hard:2 },
    host:givenHost,
    duration:givenDuration,
    difficulty:givenDiff='normal',
    goal=40
  } = config;

  // DOM: HUD
  const hudTime  = $('#hudTime');
  const hudScore = $('#hudScore');
  const hudQuest = $(ui.questMainSel || '#tQmain');

  const setText = (el, txt)=>{ try{ el?.setAttribute('troika-text', `value: ${txt}`); }catch{} };
  const updateHUD = ()=>{ setText(hudTime,  `เวลา: ${Math.max(0,Math.ceil(remain/1000))}s`);
                          setText(hudScore, `คะแนน: ${score}  คอมโบ: x${combo}`); };

  // Host
  let host=givenHost;
  if(!host){ const wrap=$('a-scene')||document.body; const auto=document.createElement('a-entity'); auto.id='spawnHost'; auto.setAttribute('position','0 0 -1.2'); wrap.appendChild(auto); host=auto; }

  // SFX/FEVER
  const sfx=new SFX('../assets/audio/'); await sfx.unlock?.(); sfx.attachPageVisibilityAutoMute?.();
  const scene=$('a-scene')||document.body;
  const fever=new Fever(scene,null,{durationMs:10000});
  window.addEventListener('hha:fever',(e)=>{
    if(e?.detail?.state==='start'){ sfx.feverStart?.(); }
    if(e?.detail?.state==='end'){ sfx.feverEnd?.(); }
  });

  // MiniQuest (single line)
  const mq=new MiniQuest( { tQmain:hudQuest },
    { coach_start:$('#coach_start'), coach_good:$('#coach_good'), coach_warn:$('#coach_warn'),
      coach_fever:$('#coach_fever'), coach_quest:$('#coach_quest'), coach_clear:$('#coach_clear') } );
  mq.start(goal);
  const missions=new MissionDeck(); missions.draw3?.();

  // Time/Difficulty
  const difficulty = givenDiff;
  let durationSec = Number(givenDuration || timeByDiff[difficulty] || 60);
  let remain = durationSec * 1000; // ms
  setText(hudTime, `เวลา: ${durationSec}s`);

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

  // Combo decay + Timer HUD
  const comboDecay=setInterval(()=>{ if(!running) return; if(now()-lastGoodAt>2000 && combo>0){ combo--; updateHUD(); }},1000);
  const timerTick = setInterval(()=>{ if(!running) return; remain -= 1000; if(remain<=0){ endGame('timeout'); } updateHUD(); mq.second(); missions.second?.(); },1000);

  // Pause/Resume hooks
  let api=null;
  window.addEventListener('blur',  ()=>api?.pause?.());
  window.addEventListener('focus', ()=>api?.resume?.());
  document.addEventListener('visibilitychange',()=>document.hidden?api?.pause?.():api?.resume?.());

  // spawn
  function spawnOne(){
    if(!running) return;
    if(SPAWN_LOCK) return; SPAWN_LOCK=true;
    try{
      if(active.size>=MAX_ACTIVE || issuedThisSec>=BUDGET) return;

      const slot=takeFreeSlot(slots, busyCols, busyRows, slotCooldownMs);
      if(!slot) return;

      const tooClose=[...active].some(el=>{ try{ const p=el.getAttribute('position'); const dx=p.x-slot.x, dy=p.y-slot.y; return (dx*dx+dy*dy)<(minDist*minDist); }catch{ return false; }});
      if(tooClose){ releaseSlot(slots,slot); return; }

      busyCols.add(slot.col); busyRows.add(slot.row); issuedThisSec++;

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
      const killer=setTimeout(()=>{ // miss
        if(typeof judge==='function'){
          const res = judge(null, { type:'timeout', char, score, combo, streak, feverActive:fever.active });
          if(res?.good===false){ streak=0; combo=0; mq.junk(); }
        }else{ streak=0; combo=0; mq.junk(); }
        updateHUD();
        cleanup();
      }, ttl);

      const fire=(ev)=>{
        if(consumed) return; consumed=true;
        try{ ev?.stopPropagation?.(); ev?.preventDefault?.(); }catch{}
        clearTimeout(killer);

        let res = { good:true, scoreDelta:10, feverDelta:0 };
        if(typeof judge==='function') res = judge(char, { type:'hit', score, combo, streak, feverActive:fever.active });

        if(res.good){
          const plus = res.scoreDelta ?? 10;
          missionGood+=1; score+=plus; combo+=1; streak+=1; comboMax=Math.max(comboMax,combo); lastGoodAt=now();
          sfx.popGood?.();
          Particles.burst?.(host, {x:slot.x,y:slot.y,z:slot.z}, '#69f0ae');
          // popup +score
          try{
            const t=document.createElement('a-entity');
            t.setAttribute('troika-text',`value: +${plus}; color:#ffffff; fontSize:0.08; anchor:center`);
            t.setAttribute('position',`${slot.x} ${slot.y+0.05} ${slot.z+0.01}`);
            host.appendChild(t);
            t.setAttribute('animation__rise',`property: position; to: ${slot.x} ${slot.y+0.30} ${slot.z+0.01}; dur: 520; easing: ease-out`);
            t.setAttribute('animation__fade',`property: opacity; to: 0; dur: 520; easing: linear`);
            setTimeout(()=>t.remove(),560);
          }catch{}
          if(res.feverDelta) try{ fever.add(res.feverDelta); }catch{}
          mq.good({score,combo,streak,missionGood});
        }else{
          score=Math.max(0, score + (res.scoreDelta ?? -5));
          combo=0; streak=0; sfx.popBad?.(); Particles.smoke?.(host,{x:slot.x,y:slot.y,z:slot.z}); mq.junk();
        }

        // HUD + event
        updateHUD();
        try{ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); }catch{}
        if(missionGood>=goal){ mq.mission(missionGood); }

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

  // resolve overlaps periodically
  function resolveOverlaps(){
    const arr=[...active];
    for(let i=0;i<arr.length;i++){
      for(let j=i+1;j<arr.length;j++){
        const a=arr[i], b=arr[j];
        try{
          const pa=a.getAttribute('position'), pb=b.getAttribute('position');
          const dx=pb.x-pa.x, dy=pb.y-pa.y, d2=dx*dx+dy*dy;
          if(d2 < (minDist*minDist)){
            // ขยับ b ออก 1 ช่อง
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

  // main loop
  function loop(){
    clearTimeout(spawnTicker);
    const tick=()=>{ if(running && issuedThisSec<BUDGET) spawnOne();
      const cd=Math.max(380, spawnRateMs|0);
      spawnTicker=setTimeout(tick, cd);
    };
    tick();
  }
  loop(); setTimeout(()=>spawnOne(),240);

  function endGame(reason='stop'){
    if(!running) return; running=false;
    clearTimeout(spawnTicker); clearInterval(timerTick); clearInterval(budgetTimer);
    clearInterval(comboDecay); clearInterval(overlapSweeper);
    try{ fever.end(); }catch{} try{ sfx.playCoach?.('clear'); }catch{}
    try{ window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason,score,missionGood,goal,comboMax}})); }catch{}
  }

  const apiObj={ pause(){ if(!running) return; running=false; clearTimeout(spawnTicker); },
                 resume(){ if(running) return; running=true; loop(); },
                 stop(){ endGame('stop'); } };
  // ป้องกันชื่อซ้ำ
  try{ window.__HHA_API?.stop?.(); }catch{}
  window.__HHA_API = apiObj;
  return apiObj;
}
