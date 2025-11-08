// === Good vs Junk — SAFE SPAWN + FEVER + WATCHDOG (no optional chaining) ===
var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, timeTimer=null, feverTimer=null, watchdogT=null;

// ---- Emoji → dataURL cache ----
var __emojiCache={};
function emojiSprite(emo, px){
  var size=px||192, key=emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c=document.createElement('canvas'); c.width=c.height=size;
  var ctx=c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(size*0.78)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.28)'; ctx.shadowBlur=size*0.06;
  ctx.fillText(emo, size/2, size/2);
  __emojiCache[key]=c.toDataURL('image/png');
  return __emojiCache[key];
}
function emit(name,detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail})); }catch(_e){} }

// ---- Pools ----
var GOOD=['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
var JUNK=['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

// ---- Fever ----
var FEVER=false, FEVER_NEED=10, FEVER_MS=10000;
function feverStart(){ if(FEVER) return; FEVER=true; emit('hha:fever',{state:'start',ms:FEVER_MS});
  clearTimeout(feverTimer); feverTimer=setTimeout(function(){ feverEnd(); }, FEVER_MS); }
function feverEnd(){ if(!FEVER) return; FEVER=false; emit('hha:fever',{state:'end'});
  clearTimeout(feverTimer); feverTimer=null; }

// ---- Popup score (Troika) ----
function popupText(txt,x,y,color){
  try{
    var t=document.createElement('a-entity');
    t.setAttribute('troika-text','value:'+txt+'; color:'+ (color||'#fff') +'; fontSize:0.1;');
    t.setAttribute('position', x+' '+(y+0.06)+' -1.18');
    host.appendChild(t);
    t.setAttribute('animation__rise','property: position; to:'+x+' '+(y+0.34)+' -1.18; dur:560; easing:ease-out');
    t.setAttribute('animation__fade','property: opacity; to:0; dur:560; easing:linear');
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); }, 620);
  }catch(_e){}
}

// ---- One target ----
function makeTarget(emoji, good, diff){
  var wrap=document.createElement('a-entity');

  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  // ตำแหน่งให้อยู่ในเฟรมแน่ ๆ
  var px=(Math.random()*1.6 - 0.8);  // -0.8..0.8
  var py=(Math.random()*0.6 + 1.2);  // 1.2..1.8 (ระดับหน้าอก-หัวไหล่)
  img.setAttribute('position', px+' '+py+' -1.2');
  img.setAttribute('width', 0.42);
  img.setAttribute('height',0.42);
  img.classList.add('clickable');
  wrap.appendChild(img);

  var glow=document.createElement('a-plane');
  glow.setAttribute('width',0.5); glow.setAttribute('height',0.5);
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.20; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  wrap.appendChild(glow);

  function destroy(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }

  function onHit(){
    if(!running) return;
    destroy();
    if(good){
      var base=20 + combo*2;
      var plus= FEVER? base*2 : base;
      score+=plus; combo+=1; if(combo>maxCombo) maxCombo=combo;
      if(!FEVER && combo>=FEVER_NEED) feverStart();
      popupText('+'+plus, px, py, '#b9f2ff');
    }else{
      combo=0; misses+=1; score=Math.max(0, score-15);
      popupText('-15', px, py, '#ffb4b4');
    }
    emit('hha:score',{score:score, combo:combo});
  }

  // รองรับทั้ง cursor click และ touch/mouse เผื่อบางอุปกรณ์
  img.addEventListener('click', onHit);
  img.addEventListener('mousedown', onHit);
  img.addEventListener('touchstart', function(e){ e.preventDefault(); onHit(); }, {passive:false});

  // TTL → นับพลาด
  var ttl=1600; if(diff==='easy') ttl=1900; else if(diff==='hard') ttl=1350;
  setTimeout(function(){
    if(!wrap.parentNode) return;
    destroy(); misses+=1; combo=0;
    emit('hha:miss',{count:misses}); emit('hha:score',{score:score, combo:combo});
  }, ttl);

  return wrap;
}

// ---- Spawn loop ----
function spawnLoop(diff){
  if(!running) return;
  var goodPick = Math.random()>0.35;
  var emo = goodPick ? GOOD[Math.floor(Math.random()*GOOD.length)]
                     : JUNK[Math.floor(Math.random()*JUNK.length)];
  try{ host.appendChild( makeTarget(emo, goodPick, diff) ); }catch(_e){}

  var gap=520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER) gap=Math.max(300, Math.round(gap*0.85));
  spawnTimer=setTimeout(function(){ spawnLoop(diff); }, gap);
}

// ---- Exported boot ----
export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  if(!host){
    host=document.createElement('a-entity'); host.id='spawnHost';
    host.setAttribute('position','0 1.6 -1.6'); document.querySelector('a-scene').appendChild(host);
  }

  var diff=(cfg && cfg.difficulty) || 'normal';
  var duration=(cfg && cfg.duration)|0 || 60;

  running=true; score=0; combo=0; maxCombo=0; misses=0; FEVER=false;
  clearTimeout(feverTimer); clearTimeout(spawnTimer); clearInterval(timeTimer); clearTimeout(watchdogT);
  feverTimer=spawnTimer=watchdogT=null;

  emit('hha:score',{score:0, combo:0});
  emit('hha:quest',{text:'Mini Quest — เก็บของดีติดกัน '+FEVER_NEED+' ชิ้น เพื่อเปิด FEVER!'});
  emit('hha:fever',{state:'end'});

  // เวลา
  var remain=duration; emit('hha:time',{sec:remain});
  timeTimer=setInterval(function(){
    if(!running){ clearInterval(timeTimer); return; }
    remain-=1; if(remain<0) remain=0;
    emit('hha:time',{sec:remain});
    if(remain<=0){ endGame(); }
  },1000);

  // เริ่ม spawn + watchdog กัน “ไม่ยอมเกิด”
  spawnLoop(diff);
  watchdogT=setTimeout(function(){
    // ถ้า 700ms แล้ว host ยังว่าง → spawn บังคับ 1 ลูก
    try{
      var empty = !host || !host.children || host.children.length===0;
      if(empty){ host.appendChild( makeTarget(GOOD[0], true, diff) ); }
    }catch(_e){}
  },700);

  function endGame(){
    if(!running) return;
    running=false;
    clearInterval(timeTimer); clearTimeout(spawnTimer); clearTimeout(feverTimer); clearTimeout(watchdogT);
    feverEnd();
    emit('hha:end',{score:score, combo:maxCombo, misses:misses, title:'Good vs Junk'});
  }

  return {
    stop: function(){ endGame(); },
    pause: function(){ running=false; },
    resume:function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}

export default { boot };
