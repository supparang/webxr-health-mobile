// === modes/goodjunk.safe.js — Ultra clean: sparse & non-overlapping ===
import { Difficulty }   from '../vr/difficulty.js';
import { Emoji }        from '../vr/emoji-sprite.js';
import { Fever }        from '../vr/fever.js';
import { MiniQuest }    from '../vr/miniquest.js';
import { MissionDeck }  from '../vr/mission.js';
import * as FX          from '../vr/particles.js';
import { SFX }          from '../vr/sfx.js';

const Particles  = FX.Particles || FX;
const AdvancedFX = FX.AdvancedFX || {
  explode3D(host, pos, color='#69f0ae'){ try{ Particles.burst(host, pos, color); }catch{} },
  popupScore(host, pos, text='+10'){ try{
    const t=document.createElement('a-entity');
    t.setAttribute('troika-text',`value:${text};color:#fff;fontSize:0.08;anchor:center`);
    t.setAttribute('position',`${pos.x} ${pos.y} ${pos.z+0.01}`);
    host.appendChild(t);
    t.setAttribute('animation__rise',`property:position;to:${pos.x} ${pos.y+0.25} ${pos.z+0.01};dur:500;easing:ease-out`);
    t.setAttribute('animation__fade',`property:opacity;to:0;dur:520;easing:linear`);
    setTimeout(()=>t.remove(),560);
  }catch{} },
  shakeRig(){ try{
    const rig=document.querySelector('#rig'); if(!rig) return;
    rig.setAttribute('animation__s1','property:position;to:0 0 -0.02;dur:40;dir:alternate;easing:ease-in-out');
    rig.setAttribute('animation__s2','property:position;to:0 0 0;dur:40;delay:40;easing:ease-in-out');
    setTimeout(()=>{ rig.removeAttribute('animation__s1'); rig.removeAttribute('animation__s2'); },120);
  }catch{} }
};

const $=s=>document.querySelector(s);
const sample=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const now = ()=>performance.now();

// pools (20/20)
const GOOD=['🍎','🍏','🍇','🍓','🍍','🍉','🍐','🍊','🫐','🥝','🍋','🍒','🍈','🥭','🍑','🥗','🐟','🥜','🍚','🍞'];
const JUNK=['🍔','🍟','🍕','🌭','🍗','🥓','🍩','🍪','🧁','🍰','🍫','🍬','🍭','🥤','🧋','🍹','🍨','🍧','🍿','🥮'];

// session knobs: โปร่ง + ไม่ซ้อน
const TIME_BY_DIFF         ={ easy:45, normal:60, hard:75 };
const MAX_ACTIVE_BY_DIFF   ={ easy:1,  normal:2,  hard:2 };   // ↓
const SPAWN_BUDGET_PER_SEC ={ easy:1,  normal:2,  hard:2 };   // ↓
const MIN_DIST             = 0.22;                             // กันชนห้ามซ้อน (เมตร)
const SLOT_COOLDOWN_MS     = 300;                              // กันเกิดซ้ำตำแหน่งเดิมเร็วเกิน
const GOOD_RATE=0.70, GOLDEN_RATE=0.07;

// emoji/twemoji
const USE_EMOJI_SVG=(()=>{ try{return (new URL(location.href)).searchParams.get('emoji')?.toLowerCase()==='svg';}catch{return false;}})();
const toCP=s=>{const p=[];for(const ch of s)p.push(ch.codePointAt(0).toString(16));return p.join('-');};
const twemojiURL=ch=>`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${toCP(ch)}.svg`;
function makeEmojiNode(char,{scale=0.58}={}){
  if(!USE_EMOJI_SVG){
    if(typeof Emoji?.fromChar==='function') return Emoji.fromChar(char,{size:96,scale,glow:true,shadow:true});
    if(typeof Emoji?.create==='function'){ const type=GOOD.includes(char)?'GOOD':(JUNK.includes(char)?'JUNK':'STAR'); return Emoji.create({type,size:scale}); }
    const el=document.createElement('a-entity'); el.setAttribute('text',{value:char,align:'center',width:2.2*scale,color:'#fff'}); return el;
  }else{
    const img=document.createElement('a-image'); img.setAttribute('src',twemojiURL(char)); img.setAttribute('width',0.40*scale*2.0); img.setAttribute('height',0.40*scale*2.0); return img;
  }
}

// slots: 3 คอลัมน์ × 2 แถว, ล่าง-กลางจอ
function buildSlots(yBase=0.46){
  const xs=[-0.80, 0.00, 0.80];          // ห่างมาก
  const ys=[ yBase, yBase+0.26 ];        // แถวล่าง/กลาง
  const slots=[];
  let idx=0;
  for(let ci=0; ci<xs.length; ci++){
    for(let ri=0; ri<ys.length; ri++){
      const x=xs[ci], y=ys[ri], z=-(1.32+Math.random()*0.12);
      slots.push({ id:idx++, col:ci, row:ri, x,y,z, used:false, lastUsed:0 });
    }
  }
  return slots;
}
function takeFreeSlot(slots){
  const t=now();
  const free=slots.filter(s=>!s.used && (t - s.lastUsed >= SLOT_COOLDOWN_MS));
  if(!free.length) return null;
  const s=free[Math.floor(Math.random()*free.length)]; s.used=true; return s;
}
function releaseSlot(slots,slot){ if(slot){ slot.used=false; slot.lastUsed=now(); } }

export async function boot({ host, duration, difficulty='normal', goal=40 }={}){
  if(!host){ const wrap=$('a-scene')||document.body; const auto=document.createElement('a-entity'); auto.id='spawnHost'; wrap.appendChild(auto); host=auto; }

  const sfx=new SFX('../assets/audio/'); await sfx.unlock?.(); sfx.attachPageVisibilityAutoMute?.();
  window.addEventListener('hha:muteToggle', e => sfx.mute?.(!!(e.detail?.muted)));
  window.addEventListener('hha:volChange', e=>sfx.setVolume?.(Number(e.detail?.vol)||1));

  const scene=$('a-scene')||document.body;
  const fever=new Fever(scene,null,{durationMs:10000});

  const mq=new MiniQuest({tQmain:$('#tQmain')},{
    coach_start:$('#coach_start'),coach_good:$('#coach_good'),coach_warn:$('#coach_warn'),
    coach_fever:$('#coach_fever'),coach_quest:$('#coach_quest'),coach_clear:$('#coach_clear')
  }); mq.start(goal);

  const missions=new MissionDeck(); missions.draw3?.();

  if(!duration||duration<=0) duration=TIME_BY_DIFF[difficulty]||60;
  $('#hudTime')?.setAttribute('troika-text','value',`เวลา: ${duration}s`);

  const diff=new Difficulty();
  const safeCfg={size:0.60,rate:520,life:2000};
  const baseCfg=(diff?.config?.[difficulty])||(diff?.config?.normal)||safeCfg;
  let spawnRateMs=Number(baseCfg.rate)||safeCfg.rate;
  let lifetimeMs =Number(baseCfg.life)||safeCfg.life;
  let sizeFactor =Math.max(0.40,(Number(baseCfg.size)||0.60)*0.80);  // ↓ เล็กลง ~20%
  const hitW = (difficulty==='easy'?0.50 : difficulty==='hard'?0.40 : 0.46);

  let running=true, missionGood=0, score=0, combo=0, comboMax=0, streak=0, lastGoodAt=now();
  const MAX_ACTIVE_INIT=MAX_ACTIVE_BY_DIFF[difficulty]??2;
  let MAX_ACTIVE=MAX_ACTIVE_INIT;
  const BUDGET=SPAWN_BUDGET_PER_SEC[difficulty]??2;

  const active=new Set();          // a-entity
  const slots =buildSlots();
  let issuedThisSec=0, spawnTicker;
  const budgetTimer=setInterval(()=>{ issuedThisSec=0; },1000);

  // column cap: ไม่ให้คอลัมน์เดียวมีมากกว่า 1 เป้า
  const columnLoad=()=>{ const m=new Map(); active.forEach(el=>{ m.set(el.__col,(m.get(el.__col)||0)+1); }); return m; };

  // FPS adapt (เบา ๆ)
  let frames=0, lastT=now();
  function raf(t){ frames++; if(t-lastT>=1000){const fps=frames; frames=0; lastT=t; if(fps<40){ spawnRateMs=Math.min(spawnRateMs*1.15,900); MAX_ACTIVE=Math.max(1,Math.round(MAX_ACTIVE*0.9)); }} requestAnimationFrame(raf); }
  requestAnimationFrame(raf);

  const comboDecay=setInterval(()=>{ if(!running) return; if(now()-lastGoodAt>2000 && combo>0){ combo--; try{window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}}));}catch{} } },1000);

  let api=null;
  window.addEventListener('blur', ()=>api?.pause?.());
  window.addEventListener('focus',()=>api?.resume?.());
  document.addEventListener('visibilitychange',()=>document.hidden?api?.pause?.():api?.resume?.());

  function renderQuest(){ try{
    const list=mq.quests||[]; const curI=list.findIndex(q=>!q._done); const cur=curI>=0?list[curI]:list[list.length-1];
    $('#tQTitle')?.setAttribute('troika-text',`value: Mini Quest (${Math.min((curI>=0?curI:2)+1,3)}/3)`);
    if(cur){ const tgt=(cur.type==='mission'?1:cur.target||0); const prog=(cur.type==='mission'?(cur.prog||0):Math.min(cur.prog||0,tgt));
      $('#tQmain')?.setAttribute('troika-text',`value: ${(cur._done?'✅ ':'⬜ ')}${cur.label}${cur.type!=='mission'?` (${prog}/${tgt})`:''}`); }
  }catch{} }

  function spawnOne(){
    if(!running) return;
    if(active.size>=MAX_ACTIVE || issuedThisSec>=BUDGET) return;

    const slot=takeFreeSlot(slots); if(!slot) return;

    // limit per-column
    const load=columnLoad(); if((load.get(slot.col)||0)>=1){ releaseSlot(slots,slot); return; }

    // strict anti-overlap (3D distance)
    const near=[...active].some(el=>{
      try{
        const p=el.getAttribute('position'); const dx=p.x-slot.x, dy=p.y-slot.y, dz=(p.z-slot.z);
        return (dx*dx+dy*dy+dz*dz) < (MIN_DIST*MIN_DIST);
      }catch{ return false; }
    });
    if(near){ releaseSlot(slots,slot); return; }

    issuedThisSec++;

    const isGood=Math.random()<GOOD_RATE;
    const char=isGood?sample(GOOD):sample(JUNK);
    const isGold=isGood && Math.random()<GOLDEN_RATE;

    const el=makeEmojiNode(char,{scale:clamp(sizeFactor,0.35,0.65)}); // max 0.65
    const zJ=slot.z; // ไม่ขยับ z เพื่อกันซ้อนลึก
    el.setAttribute('position',`${slot.x} ${slot.y} ${zJ}`);
    el.classList.add('hit','clickable');
    el.__col=slot.col;

    if(isGold){
      el.setAttribute('scale','1.12 1.12 1.12');
      const halo=document.createElement('a-ring');
      halo.setAttribute('radius-inner','0.18'); halo.setAttribute('radius-outer','0.22');
      halo.setAttribute('position','0 0 0.001'); halo.setAttribute('material','color:#ffe066; opacity:0.85; shader:flat');
      el.appendChild(halo);
    }

    // transparent hitbox
    const hit=document.createElement('a-plane');
    hit.setAttribute('width',hitW); hit.setAttribute('height',hitW);
    hit.setAttribute('material','opacity:0; transparent:true; side:double');
    hit.classList.add('hit','clickable'); el.appendChild(hit);

    active.add(el);

    const ttlMult=(difficulty==='easy')?1.8:(difficulty==='hard'?0.95:1.1);
    let ttl=Math.round(lifetimeMs*ttlMult*(1.05+Math.random()*0.35));
    if(active.size<=1) ttl=Math.max(ttl,2400);

    let consumed=false;
    const killer=setTimeout(()=>{ if(GOOD.includes(char)){ streak=0; combo=0; mq.junk(); missions.onJunk?.(); } cleanup(); }, ttl);

    const fire=(ev)=>{ if(consumed) return; consumed=true; try{ev?.stopPropagation?.();ev?.preventDefault?.();}catch{} clearTimeout(killer); onHit({el,char,pos:{x:slot.x,y:slot.y,z:zJ},isGold}); cleanup(); };
    ['click','mousedown','touchstart','triggerdown'].forEach(evt=>{ try{hit.addEventListener(evt,fire,{passive:false});}catch{} try{el.addEventListener(evt,fire,{passive:false});}catch{} });

    host.appendChild(el);

    function cleanup(){ try{el.remove();}catch{} active.delete(el); releaseSlot(slots,slot); }
  }

  function loop(){
    clearTimeout(spawnTicker);
    const tick=()=>{ if(running && active.size<MAX_ACTIVE && issuedThisSec<BUDGET) spawnOne(); const cd=Math.max(350,spawnRateMs|0); spawnTicker=setTimeout(tick,cd); };
    tick();
  }
  function prime(){ setTimeout(()=>spawnOne(),220); }

  loop(); prime();
  console.log('[goodjunk] sparse mode', {MAX_ACTIVE, BUDGET, MIN_DIST});

  function onHit({el,char,pos,isGold=false}){
    const isGood=GOOD.includes(char);
    if(isGood){
      const gain=(fever.active?2:1)*(isGold?2:1), plus=10*gain;
      missionGood+=1; score+=plus; combo+=1; streak+=1; comboMax=Math.max(comboMax,combo); lastGoodAt=now();
      sfx.popGood?.(); AdvancedFX.explode3D(host,pos,isGold?'#ffe066':'#69f0ae'); AdvancedFX.popupScore(host,{x:pos.x,y:pos.y+0.05,z:pos.z},`+${plus}${isGold?' ⭐':''}`); AdvancedFX.shakeRig();
      if(streak%6===0){ try{fever.add(8);}catch{} }
      mq.good({score,combo,streak,missionGood}); missions.onGood?.(); missions.updateScore?.(score); missions.updateCombo?.(combo); renderQuest();
      if(missionGood>=goal){ mq.mission(missionGood); if(missionGood===goal){ try{sfx.star?.();}catch{} try{Particles.spark(host,{x:0,y:1.6,z:-1.4},'#ffe066');}catch{} } }
    }else{
      score=Math.max(0,score-5); combo=0; streak=0; sfx.popBad?.(); Particles.smoke?.(host,pos); mq.junk(); missions.onJunk?.(); renderQuest();
    }
    try{ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score,combo}})); }catch{}
  }

  const secondTimer=setInterval(()=>{ if(running){ mq.second(); missions.second?.(); renderQuest(); } },1000);
  const endTimer=setTimeout(()=>endGame('timeout'), duration*1000);

  window.addEventListener('hha:fever',e=>{
    if(e?.detail?.state==='start'){ try{mq.fever(); missions.onFeverStart?.();}catch{} spawnRateMs=Math.round(spawnRateMs*0.85); }
    else { const base=Number(baseCfg.rate)||520; spawnRateMs=base; }
  });

  function endGame(reason='stop'){
    if(!running) return; running=false;
    clearTimeout(spawnTicker); clearInterval(secondTimer); clearInterval(budgetTimer); clearInterval(comboDecay); clearTimeout(endTimer);
    try{fever.end();}catch{} try{sfx.playCoach?.('clear');}catch{}
    try{ window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason,score,missionGood,goal,comboMax}})); }catch{}
  }

  api={ pause(){ if(!running) return; running=false; clearTimeout(spawnTicker); },
        resume(){ if(running) return; running=true; loop(); },
        stop(){ endGame('stop'); } };
  return api;
}
