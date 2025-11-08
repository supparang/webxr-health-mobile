// === Good vs Junk — Missions + Coach + Shards + Fever + Powerups ===
import { Particles } from '../vr/particles.js';
import { MissionDeck } from '../vr/mission.js';
import { Coach } from '../vr/coach.js';

let running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
let spawnTimer=null, timeTimer=null, remain=0;

let FEVER=false, FEVER_COMBO_NEED=10;
let shieldUntil=0; const SHIELD_MS=6000;

// systems
let deck=null, coach=null;

// pools
const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];
const POWERUPS = ['⭐','💎','🛡️'];

// local emoji sprite (no global)
const spriteLocal=(emo,px=160)=>{ const k=emo+'@'+px; spriteLocal.cache=spriteLocal.cache||{};
  if(spriteLocal.cache[k]) return spriteLocal.cache[k];
  const c=document.createElement('canvas'); c.width=c.height=px;
  const ctx=c.getContext('2d'); ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(px*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.30)'; ctx.shadowBlur=px*0.07;
  ctx.fillText(emo,px/2,px/2);
  return (spriteLocal.cache[k]=c.toDataURL('image/png')); };

function emit(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})); }catch{} }
function now(){ return (typeof performance!=='undefined' && performance.now)? performance.now(): Date.now(); }
function hasShield(){ return now() < shieldUntil; }
function giveShield(ms=SHIELD_MS){ shieldUntil=Math.max(shieldUntil, now()) + ms; coach && coach.onPowerup('shield'); emit('hha:powerup',{type:'shield', until:shieldUntil}); }

// popup score text
function popupText(txt, x, y, color){
  const t=document.createElement('a-entity');
  t.setAttribute('troika-text',`value: ${txt}; color: ${color||'#fff'}; fontSize:0.09;`);
  t.setAttribute('position',`${x} ${y+0.05} -1.18`);
  host.appendChild(t);
  t.setAttribute('animation__rise',`property: position; to: ${x} ${y+0.32} -1.18; dur: 520; easing: ease-out`);
  t.setAttribute('animation__fade',`property: opacity; to: 0; dur: 520; easing: linear`);
  setTimeout(()=>{ try{t.remove();}catch{} },560);
}

// fever
function feverStart(){
  if(FEVER) return; FEVER=true;
  emit('hha:fever',{state:'start',level:100,active:true});
  coach && coach.onFeverStart();
}
function feverEnd(){
  if(!FEVER) return; FEVER=false;
  emit('hha:fever',{state:'end',level:0,active:false});
}

// quest helpers
function pushQuestText(){
  const cur = deck.getCurrent();
  const txt = cur ? cur.label : 'Mini Quest — ทั้งหมดผ่านแล้ว!';
  emit('hha:quest',{text:txt});
  coach && coach.onQuest(txt);
}
function progressQuestTick(){
  // แจ้งความคืบหน้าในรูปแบบพื้นฐานผ่าน HUD (ขึ้นอยู่กับ MissionDeck.prog/target)
  const cur = deck.getCurrent();
  if(!cur) return;
  const progList = deck.getProgress();
  const p = progList.find(x=>x.current) || null;
  if(p && typeof p.prog === 'number' && typeof p.target === 'number'){
    emit('hha:quest',{text:`${p.label} (${p.prog}/${p.target})`});
  }
}

function handlePenalty(px,py,pz,{miss=true, loseCombo=true, scoreLoss=15, text='-'+(15)}){
  if(hasShield()){
    Particles.burstShards(host, {x:px,y:py,z:pz}, {theme:'goodjunk', kind:'shield'});
    popupText('Shield!', px, py, '#c7f9cc');
    return;
  }
  if(loseCombo) combo=0;
  if(miss){ misses++; emit('hha:miss',{count:misses}); coach && coach.onMiss(misses); deck.onJunk(); }
  score=Math.max(0, score - scoreLoss);
  Particles.burstShards(host, {x:px,y:py,z:pz}, {theme:'goodjunk', kind:'bad'});
  popupText(text, px, py, '#ffb4b4');
  emit('hha:score',{score,combo});
}

function makeTarget(emoji, kind, diff){
  const root=document.createElement('a-entity');

  const img=document.createElement('a-image');
  img.setAttribute('src', spriteLocal(emoji,192));
  const px = (Math.random()*1.0 - 0.5);       // ตำแหน่งกลางจอมากขึ้น
  const py = (Math.random()*0.46 + 0.52);
  const pz = -1.2;
  img.setAttribute('position', `${px} ${py} ${pz}`);
  img.setAttribute('width', 0.42);
  img.setAttribute('height',0.42);
  img.classList.add('clickable');
  root.appendChild(img);

  // glow (เล็กน้อย)
  const glow=document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  const glowColor = (kind==='good')   ? '#22c55e'
                    : (kind==='junk') ? '#ef4444'
                    : (kind==='star') ? '#fde047'
                    : (kind==='diamond') ? '#60a5fa'
                    : '#a7f3d0'; // shield
  glow.setAttribute('material',`color:${glowColor}; opacity:0.22; transparent:true`);
  glow.setAttribute('position','0 0 -0.01');
  root.appendChild(glow);

  const destroy=()=>{ try{ root.remove(); }catch{} };

  let clicked=false;
  function onHit(){
    if(clicked||!running) return; clicked=true;
    destroy();

    if(kind==='good'){
      const base = 20 + combo*2;
      const plus = FEVER ? base*2 : base;
      score += plus; hits++;
      combo += 1; if(combo>maxCombo) maxCombo = combo;
      deck.onGood(); deck.updateScore(score); deck.updateCombo(combo);
      if(!FEVER && combo >= FEVER_COMBO_NEED) feverStart();
      Particles.burstShards(host, {x:px,y:py,z:pz}, {theme:'goodjunk', kind:'good'});
      popupText('+'+plus, px, py, '#eaffff');
      emit('hha:score',{score,combo});
      coach && coach.onCombo(combo);

      // เควสต์ขยับหรือจบใบ?
      if(deck._autoAdvance && deck._autoAdvance()){
        coach && coach.onQuestDone();
        pushQuestText();
      }else{
        progressQuestTick();
      }

    }else if(kind==='junk'){
      handlePenalty(px,py,pz,{miss:true, loseCombo:true, scoreLoss:15, text:'-15'});

    }else if(kind==='star'){
      const plus = 60;
      score += plus; combo += 1; maxCombo = Math.max(maxCombo, combo); hits++;
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'goodjunk', kind:'star'});
      popupText('+STAR '+plus, px, py, '#fff3b0');
      emit('hha:score',{score,combo});
      deck.onStar(); deck.updateScore(score); deck.updateCombo(combo);
      coach && coach.onPowerup('star');
      progressQuestTick();

    }else if(kind==='diamond'){
      const plus = 120;
      score += plus; combo += 2; maxCombo = Math.max(maxCombo, combo); hits++;
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'goodjunk', kind:'diamond'});
      popupText('+DIAMOND '+plus, px, py, '#cfe8ff');
      emit('hha:score',{score,combo});
      deck.onDiamond(); deck.updateScore(score); deck.updateCombo(combo);
      coach && coach.onPowerup('diamond');
      if(!FEVER) feverStart();
      progressQuestTick();

    }else if(kind==='shield'){
      Particles.burstShards(host,{x:px,y:py,z:pz},{theme:'goodjunk', kind:'shield'});
      popupText('🛡️ SHIELD', px, py, '#c7f9cc');
      giveShield();
      progressQuestTick();
    }
  }

  img.addEventListener('click', onHit, {passive:false});
  img.addEventListener('touchstart', onHit, {passive:false});

  let ttl=1600; if(diff==='easy') ttl=1900; else if(diff==='hard') ttl=1400;
  setTimeout(function(){
    if(!root.parentNode || clicked || !running) return;
    destroy(); spawns++;
    // GOOD หมดอายุ = โทษ (นับ “หลีกเลี่ยงขยะ” จะอยู่ใน onJunk() ตอนโดนขยะ ไม่ใช่กรณีนี้)
    if(kind==='good'){
      handlePenalty(px,py,pz,{miss:true, loseCombo:true, scoreLoss:10, text:'-10'});
      // deck: ไม่มี onGood; ถือว่าเป็น miss อย่างเดียว
    }
    // JUNK / powerup หมดอายุ: ไม่ลงโทษ
  }, ttl);

  return root;
}

function spawnLoop(diff){
  if(!running) return;
  const r = Math.random();
  let kind, emoji;
  if(r < 0.10){ // powerup
    const p = POWERUPS[(Math.random()*POWERUPS.length)|0];
    emoji = p;
    kind = (p==='⭐')?'star':(p==='💎')?'diamond':'shield';
  }else if(r < 0.40){
    kind = 'junk'; emoji = JUNK[(Math.random()*JUNK.length)|0];
  }else{
    kind = 'good'; emoji = GOOD[(Math.random()*GOOD.length)|0];
  }

  host.appendChild(makeTarget(emoji, kind, diff));
  spawns++;

  let gap=520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER) gap=Math.max(300, Math.round(gap*0.85));
  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg={}){
  host = cfg.host || document.getElementById('spawnHost');
  const diff = String(cfg.difficulty||'normal');
  remain = (+cfg.duration||60);

  // systems
  deck = new MissionDeck();
  deck.draw3();
  coach = new Coach(); coach.onStart('Good vs Junk');

  running=true; score=0; combo=0; maxCombo=0; misses=0; hits=0; spawns=0; FEVER=false; shieldUntil=0;
  emit('hha:score',{score:0,combo:0});
  emit('hha:fever',{state:'change', level:0, active:false});
  emit('hha:time',{sec:remain});
  pushQuestText();   // โชว์ใบแรก

  clearInterval(timeTimer);
  timeTimer=setInterval(function(){
    if(!running) return;
    remain--; if(remain<0) remain=0;
    emit('hha:time',{sec:remain});
    coach && coach.onTime(remain);
    // deck second-tick (นับ noMissTime)
    deck.second();

    if(remain<=0){ endGame('timeout'); }
  },1000);

  spawnLoop(diff);

  function endGame(reason='done'){
    if(!running) return; running=false;
    try{ clearTimeout(spawnTimer); }catch{}
    try{ clearInterval(timeTimer); }catch{}
    feverEnd();

    const sum = deck.summary();
    emit('hha:end',{
      reason, score, combo:maxCombo, misses, hits, spawns,
      duration:(+cfg.duration||60), title:'Good vs Junk', difficulty: diff,
      questsCleared: (sum.cleared?3:sum.currentIndex), questsTotal:3
    });
  }

  return {
    stop(){ endGame('stop'); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnLoop(diff);} }
  };
}
export default { boot };
