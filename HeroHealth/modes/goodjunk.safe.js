// === Good vs Junk — SAFE + Shards + MiniQuest + Fever pulse (no optional chaining) ===
import { MissionDeck } from '../vr/mission.js';
import { Particles }    from '../vr/particles.js';

var running=false, host=null, scene=null;
var score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
var spawnTimer=null, timeTimer=null, feverTimer=null;
var FEVER=false, FEVER_MS=10000, FEVER_NEED=8; // คอมโบถึง → เข้า FEVER

// Pools
var GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
var JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

// Mini-Quest
var deck=null;
function updateQuestHUD(){
  if(!deck) return;
  var prog = deck.getProgress();
  var idx=0, cur=null;
  for(var i=0;i<prog.length;i++){ if(prog[i].current){ idx=i; cur=prog[i]; break; } }
  var text='Mini Quest — สุ่ม 3/10: ';
  if(cur){
    var p = (cur.prog!=null? cur.prog : 0);
    var t = (cur.target!=null? cur.target : '?');
    text += (idx+1)+'/3 '+cur.label+' ('+p+'/'+t+')';
  }else{
    text += 'กำลังเริ่ม…';
  }
  try{ window.dispatchEvent(new CustomEvent('hha:quest',{detail:{text:text}})); }catch(e){}
}

// Emoji → canvas sprite dataURL (cache)
var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px || 160, key = emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c = document.createElement('canvas'); c.width=c.height=size;
  var ctx = c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(size*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.30)'; ctx.shadowBlur=size*0.08; ctx.shadowOffsetY=size*0.03;
  ctx.fillText(emo, size/2, size/2);
  __emojiCache[key] = c.toDataURL('image/png');
  return __emojiCache[key];
}
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail})); }catch(e){} }

// Fever
function feverStart(){
  if(FEVER) return;
  FEVER = true;
  emit('hha:fever',{state:'start',level:100,active:true});
  Particles.feverPulse(scene, true);
  clearTimeout(feverTimer);
  feverTimer = setTimeout(function(){ feverEnd(); }, FEVER_MS);
  if(deck) deck.onFeverStart();
  updateQuestHUD();
}
function feverEnd(){
  if(!FEVER) return;
  FEVER = false;
  emit('hha:fever',{state:'end',level:0,active:false});
  Particles.feverPulse(scene, false);
  clearTimeout(feverTimer); feverTimer=null;
}

// Popup score
function popupText(txt, x, y, col){
  var t = document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color: '+(col||'#fff')+'; fontSize:0.09;');
  t.setAttribute('position', x+' '+(y+0.06)+' -1.18');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.34)+' -1.18; dur: 520; easing: ease-out');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ try{ t.parentNode.removeChild(t); }catch(e){} }, 560);
}

// Target
function makeTarget(emoji, good, diff){
  var el = document.createElement('a-entity');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  // กลางจอ (ล่างนิด ๆ)
  var px = (Math.random()*1.6 - 0.8);
  var py = 0.90 + (Math.random()*0.40 - 0.20); // 0.7..1.1 (ระดับกลาง)
  var pz = -1.20;
  img.setAttribute('position', px+' '+py+' '+pz);
  img.setAttribute('width', 0.42);
  img.setAttribute('height',0.42);
  img.classList.add('clickable');

  // halo จาง ๆ
  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.50);
  glow.setAttribute('height',0.50);
  glow.setAttribute('position','0 0 -0.01');
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.16; transparent:true; side:double');

  el.appendChild(img); el.appendChild(glow);

  var clicked = false;

  function onHit(){
    if(!running || clicked) return;
    clicked = true;
    try{ el.parentNode.removeChild(el); }catch(e){}

    if(good){
      hits++;
      var base = 20 + combo*2;
      var plus = FEVER ? base*2 : base;
      score += plus;
      combo += 1; if(combo>maxCombo) maxCombo = combo;
      // shards
      Particles.burstShards(host, {x:px,y:py,z:pz}, {
        count: 12, color: '#8ee9a1', speed: (diff==='hard'?1.0:(diff==='easy'?0.6:0.8)), dur: (diff==='hard'?520:640)
      });
      popupText('+'+plus, px, py, '#ffffff');
      if(deck){ deck.onGood(); deck.updateScore(score); deck.updateCombo(combo); }
      // Fever trigger
      if(!FEVER && combo >= FEVER_NEED) feverStart();
    }else{
      // เลี่ยงขยะ: “ถ้าคลิก” ถือว่าพลาดจริง
      misses += 1;
      combo = 0;
      score = Math.max(0, score - 15);
      Particles.smoke(host,{x:px,y:py,z:pz});
      popupText('-15', px, py, '#ffb4b4');
      if(deck) deck.onJunk();
    }
    emit('hha:score', {score:score, combo:combo});
    updateQuestHUD();
  }

  img.addEventListener('click', onHit, {passive:false});
  img.addEventListener('touchstart', onHit, {passive:false});

  // อายุเป้า — ถ้า “เป็นขยะ” แล้วหมดอายุ: ไม่นับเป็นพลาด/ไม่รีคอมโบ (เลี่ยงขยะสำเร็จ)
  // ถ้า “ของดี” แล้วหมดอายุ: ถือว่าพลาด (บทลงโทษ)
  var ttl = 1600; if(diff==='easy') ttl=1900; else if(diff==='hard') ttl=1400;
  var killer = setTimeout(function(){
    if(!el.parentNode || clicked || !running) return;
    try{ el.parentNode.removeChild(el); }catch(e){}
    if(good){
      // บทลงโทษเมื่อไม่เก็บของดี
      misses += 1;
      combo = 0;
      score = Math.max(0, score - 10);
      Particles.smoke(host,{x:px,y:py,z:pz});
      popupText('-10', px, py, '#ffb4b4');
      if(deck) deck.onJunk();
      emit('hha:score', {score:score, combo:combo});
      updateQuestHUD();
    } else {
      // junk หมดอายุ → ไม่เป็นไร (เลี่ยงขยะ)
      if(deck) deck.onJunk(); // นับว่า "หลบ" 1 ครั้ง ตามนิยาม mission avoid
      updateQuestHUD();
    }
  }, ttl);

  return el;
}

function spawnLoop(diff){
  if(!running) return;
  var isGood = Math.random() > 0.35;   // 65% ของดี
  var emoji  = isGood ? GOOD[(Math.random()*GOOD.length)|0] : JUNK[(Math.random()*JUNK.length)|0];
  spawns++;
  host.appendChild(makeTarget(emoji, isGood, diff));

  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER) gap = Math.max(300, Math.round(gap*0.85));
  spawnTimer = setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ===== Boot =====
export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  scene = document.getElementById('scene') || document.body;
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running = true; score=0; combo=0; maxCombo=0; misses=0; hits=0; spawns=0;
  FEVER=false; clearTimeout(feverTimer); feverTimer=null;

  // Mini-Quest: สุ่ม 3 จาก 10
  deck = new MissionDeck();
  deck.draw3();
  updateQuestHUD();

  emit('hha:score', {score:0, combo:0});
  emit('hha:fever', {state:'change', level:0, active:false});
  var left = duration;
  emit('hha:time', {sec:left});

  // นับเวลา
  clearInterval(timeTimer);
  timeTimer = setInterval(function(){
    if(!running){ clearInterval(timeTimer); return; }
    left -= 1; if(left<0) left=0;
    emit('hha:time', {sec:left});
    deck.second();
    updateQuestHUD();
    if(left<=0){ clearInterval(timeTimer); endGame(); }
  }, 1000);

  // เริ่มสแปว์น
  spawnLoop(diff);

  function endGame(){
    running=false;
    clearTimeout(spawnTimer);
    feverEnd();

    var cleared = deck && deck.isCleared ? deck.isCleared() : false;
    emit('hha:end',{
      reason: 'timeout',
      title : 'Good vs Junk',
      mode  : 'goodjunk',
      difficulty: diff,
      score : score,
      comboMax: maxCombo,
      misses: misses,
      hits  : hits,
      spawns: spawns,
      questsCleared: cleared? 3 : (deck ? deck.currentIndex : 0),
      questsTotal: 3,
      duration: duration
    });
  }

  return {
    stop: function(){ if(!running) return; endGame(); },
    pause: function(){ running=false; },
    resume:function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}

export default { boot };
