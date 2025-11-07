// === Hydration Quest — SAFE build (no optional chaining) ===
// Path: /webxr-health-mobile/HeroHealth/modes/hydration.quest.js

var running=false, host=null;
var score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, timeTimer=null;

// ---------- helpers ----------
function emit(name, detail){
  try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){}
}

var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px || 160, key = emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c = document.createElement('canvas'); c.width=c.height=size;
  var ctx = c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(size*0.76)+'px system-ui, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.shadowColor='rgba(0,0,0,.25)'; ctx.shadowBlur=size*0.08;
  ctx.fillText(emo, size/2, size/2);
  __emojiCache[key] = c.toDataURL('image/png');
  return __emojiCache[key];
}

function popupText(txt, x, y, color){
  // ใช้ a-text (ไม่พึ่ง troika เพื่อตัดปัญหา THREE)
  var t = document.createElement('a-text');
  t.setAttribute('value', txt);
  t.setAttribute('color', color||'#fff');
  t.setAttribute('align','center');
  t.setAttribute('width','1.6');
  t.setAttribute('position', x+' '+(y+0.10)+' -1.18');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.38)+' -1.18; dur: 520; easing: easeOutCubic');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
  setTimeout(function(){ if(t && t.parentNode) t.parentNode.removeChild(t); }, 560);
}

// ---------- content pools ----------
var WATER = ['💧','🧊','🚰','🥤'];     // 💧หลัก
var BAD   = ['🥤','🍹','🧋','🍰','🍩']; // น้ำหวาน/ของหวาน

// Fever settings
var FEVER=false, FEVER_NEED=8, FEVER_MS=10000, feverTimer=null;
function feverStart(){
  if(FEVER) return;
  FEVER=true; emit('hha:fever',{state:'start', ms:FEVER_MS});
  clearTimeout(feverTimer);
  feverTimer=setTimeout(function(){ feverEnd(); }, FEVER_MS);
}
function feverEnd(){
  if(!FEVER) return;
  FEVER=false; emit('hha:fever',{state:'end'});
  clearTimeout(feverTimer); feverTimer=null;
}

// ---------- target factory ----------
function makeTarget(isGood, diff){
  var el  = document.createElement('a-entity');
  var emo = isGood ? WATER[Math.floor(Math.random()*WATER.length)]
                   : BAD[Math.floor(Math.random()*BAD.length)];

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emo, 200));
  var px = (Math.random()*1.8 - 0.9);   // -0.9..0.9
  var py = (Math.random()*0.9 + 1.1);   // 1.1..2.0 (ระดับใกล้หัว)
  img.setAttribute('position', px+' '+py+' -1.2');
  img.setAttribute('width', 0.44);
  img.setAttribute('height',0.44);
  img.classList.add('clickable');
  el.appendChild(img);

  var glow = document.createElement('a-plane');
  glow.setAttribute('width', 0.50);
  glow.setAttribute('height',0.50);
  glow.setAttribute('position','0 0 -0.01');
  glow.setAttribute('material','color:'+(isGood?'#22c55e':'#ef4444')+'; opacity:0.22; transparent:true;');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return;
    destroy();

    if(isGood){
      var base = 15 + combo*2;
      var add  = FEVER ? base*2 : base;
      score += add;
      combo += 1; if(combo>maxCombo) maxCombo=combo;
      if(!FEVER && combo>=FEVER_NEED) feverStart();
      popupText('+'+add, px, py, '#c6f6d5');
    }else{
      combo = 0; misses += 1;
      score = Math.max(0, score-10);
      popupText('-10', px, py, '#ffd0d0');
      emit('hha:miss',{count:misses});
    }
    emit('hha:score', {score:score, combo:combo});
  });

  var ttl = 1600; if(diff==='easy') ttl=1900; else if(diff==='hard') ttl=1400;
  setTimeout(function(){
    if(!el.parentNode) return;
    destroy(); misses += 1; combo=0;
    emit('hha:miss',{count:misses});
    emit('hha:score',{score:score, combo:combo});
  }, ttl);

  return el;
}

function spawnLoop(diff){
  if(!running) return;
  var good = Math.random()>0.40; // 60% น้ำดี
  host.appendChild(makeTarget(good, diff));
  var gap = 520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER) gap=Math.max(300, Math.round(gap*0.85));
  spawnTimer=setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ---------- main ----------
export async function boot(cfg){
  host = cfg && cfg.host ? cfg.host : document.getElementById('spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  // reset
  running=true; score=0; combo=0; maxCombo=0; misses=0;
  FEVER=false; clearTimeout(feverTimer); feverTimer=null;
  clearTimeout(spawnTimer); clearInterval(timeTimer);

  emit('hha:score',{score:0, combo:0});
  emit('hha:quest',{text:'Mini Quest — เก็บน้ำติดกัน '+FEVER_NEED+' ชิ้น เพื่อเปิด FEVER!'});
  emit('hha:fever',{state:'end'});

  // time loop (ฝั่งโหมดเป็นคนยิงเวลา)
  var remain = duration;
  emit('hha:time',{sec:remain});
  timeTimer=setInterval(function(){
    if(!running){ clearInterval(timeTimer); return; }
    remain -= 1; if(remain<0) remain=0;
    emit('hha:time',{sec:remain});
    if(remain<=0){
      clearInterval(timeTimer);
      endGame();
    }
  }, 1000);

  // spawn
  spawnLoop(diff);

  function endGame(){
    running=false;
    clearTimeout(sp
