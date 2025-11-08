// === Groups — SAFE (centered host y=1.0) ===
var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
var spawnTimer=null, endTimer=null;

var GROUPS = {
  veg: ['🥦','🥕','🥬','🍅'],
  fruit: ['🍎','🍓','🍌','🍊','🍇','🍐'],
  grain: ['🍞','🥖','🍚'],
  protein: ['🍗','🐟','🥚','🥜'],
  dairy: ['🥛','🧀','🍦']
};
var TARGET_ORDER = ['veg','fruit','grain','protein','dairy'];
var currentNeed = 'veg';

function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail})); }catch(e){} }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

function emojiSprite(emo, px){
  var key=emo+'@'+px; emojiSprite.cache=emojiSprite.cache||{};
  if(emojiSprite.cache[key]) return emojiSprite.cache[key];
  var c=document.createElement('canvas'); c.width=c.height=px;
  var x=c.getContext('2d'); x.textAlign='center'; x.textBaseline='middle';
  x.font=(px*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  x.shadowColor='rgba(0,0,0,.25)'; x.shadowBlur=px*0.06; x.fillText(emo,px/2,px/2);
  var url=c.toDataURL('image/png'); emojiSprite.cache[key]=url; return url;
}

function popupText(txt, lx, ly, color){
  try{
    var wx = lx, wy = 1.0 + ly, wz = -1.6 + 0.02;
    var t = document.createElement('a-entity');
    t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#ffffff')+'; fontSize:0.09; anchor:center;');
    t.setAttribute('position', wx+' '+(wy+0.05)+' '+wz);
    host.appendChild(t);
    t.setAttribute('animation__rise','property: position; to: '+wx+' '+(wy+0.32)+' '+wz+'; dur:520; easing:ease-out');
    t.setAttribute('animation__fade','property: opacity; to: 0; dur:520; easing:linear');
    setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },560);
  }catch(e){}
}

function makeTarget(emoji, group, diff){
  var wrap=document.createElement('a-entity');

  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  var px=(Math.random()*1.6 - 0.8);
  var py=(Math.random()*0.5 - 0.25);
  img.setAttribute('position', px+' '+py+' 0');
  img.setAttribute('width', 0.42);
  img.setAttribute('height',0.42);
  wrap.appendChild(img);

  var glow=document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:#38bdf8; opacity:0.15; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  wrap.appendChild(glow);

  function cleanup(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }

  img.classList.add('clickable');
  img.addEventListener('click', function(){
    if(!running) return;
    cleanup(); spawns++; hits++;
    if(group===currentNeed){
      var plus = 30 + combo*3;
      score += plus; combo += 1; if(combo>maxCombo) maxCombo=combo;
      popupText('+'+plus, px, py, '#bbf7d0');
      // เดินหน้าหมวดถัดไป
      var idx = TARGET_ORDER.indexOf(currentNeed);
      if(idx>=0 && idx < TARGET_ORDER.length-1) currentNeed = TARGET_ORDER[idx+1];
      emit('hha:quest', {text:'เลือกหมวด: '+currentNeed.toUpperCase()+' ✓'});
    }else{
      score = Math.max(0, score-10);
      combo = 0; misses += 1;
      popupText('-10', px, py, '#fecaca');
      emit('hha:miss', {count:misses});
    }
    emit('hha:score', {score:score, combo:combo});
  });

  var ttl=1700; if(diff==='easy') ttl=2000; else if(diff==='hard') ttl=1400;
  setTimeout(function(){
    if(!wrap.parentNode) return;
    cleanup(); spawns++;
    // ไม่ลงโทษหากหมดเวลา (ปล่อยผ่าน)
  }, ttl);

  return wrap;
}

function spawnLoop(diff){
  if(!running) return;
  // 60% เป็นหมวดที่ “ต้องการตอนนี้”, 40% เป็นหมวดอื่น
  var poolKey = Math.random()<0.6 ? currentNeed : pick(TARGET_ORDER);
  var list = GROUPS[poolKey]||GROUPS.veg;
  var emoji = pick(list);
  host.appendChild(makeTarget(emoji, poolKey, diff));

  var gap=560; if(diff==='easy') gap=700; if(diff==='hard') gap=420;
  spawnTimer=setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  try{ host.setAttribute('position','0 1.0 -1.6'); }catch(e){}
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  // เริ่มต้นให้ผู้เล่น “ต้องเลือกหมวดแรก: veg”
  currentNeed = 'veg';

  running=true; score=0; combo=0; maxCombo=0; misses=0; hits=0; spawns=0;
  emit('hha:score',{score:0, combo:0});
  emit('hha:quest',{text:'เลือกหมวด: VEG'});

  var remain=duration;
  emit('hha:time',{sec:remain});
  clearInterval(endTimer);
  endTimer=setInterval(function(){
    if(!running){ clearInterval(endTimer); return; }
    remain-=1; if(remain<0) remain=0;
    emit('hha:time',{sec:remain});
    if(remain<=0){ clearInterval(endTimer); endGame(); }
  },1000);

  spawnLoop(diff);

  function endGame(){
    running=false; clearTimeout(spawnTimer);
    emit('hha:end', {
      title:'Food Groups',
      difficulty: diff,
      duration: duration,
      score: score,
      combo: maxCombo,
      misses: misses,
      hits: hits,
      spawns: spawns,
      questsCleared: 0,
      questsTotal: 3
    });
  }

  return {
    stop:function(){ if(!running) return; endGame(); },
    pause:function(){ running=false; },
    resume:function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
// === Food Groups — SAFE (fix: target positioning & visibility) ===
var running=false, host=null;
var score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, endTimer=null;

var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px || 160, key = emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c = document.createElement('canvas'); c.width=c.height=size;
  var ctx = c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font=(size*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=size*0.06;
  ctx.fillText(emo, size/2, size/2);
  __emojiCache[key] = c.toDataURL('image/png');
  return __emojiCache[key];
}
function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail})); }catch(e){} }

var CATS = ['ผัก','โปรตีน','ธัญพืช','นม','ผลไม้'];
var POOL = {
  'ผัก'   : ['🥦','🥬','🥕','🍅','🌽','🧄','🧅','🥒'],
  'โปรตีน': ['🐟','🍗','🥚','🥩','🫘','🧀'],
  'ธัญพืช': ['🍞','🥖','🥨','🍚','🍜','🍝','🥯'],
  'นม'    : ['🥛','🧈','🍦','🍨'],
  'ผลไม้' : ['🍎','🍊','🍌','🍓','🍇','🍍','🥝','🍐','🍑','🍉']
};
var EMO2CAT=(function(){var m={},k,i,a;for(k in POOL){a=POOL[k];for(i=0;i<a.length;i++)m[a[i]]=k;}return m;})();

var roundNeed={}, roundDone={};
function rnd(n,a){ return Math.floor(Math.random()*(a-n+1))+n; }

function newRound(diff){
  roundNeed={}; roundDone={};
  var k=1; if(diff==='normal')k=2; if(diff==='hard')k=3;
  var cats=CATS.slice().sort(function(){return Math.random()-0.5;}).slice(0,k);
  for(var i=0;i<cats.length;i++){
    var need=1; if(diff==='normal')need=rnd(1,2); if(diff==='hard')need=rnd(2,3);
    roundNeed[cats[i]]=need; roundDone[cats[i]]=0;
  }
  updateQuestText();
}
function updateQuestText(){
  var parts=[],k;
  for(k in roundNeed){ var left=Math.max(0,roundNeed[k]-(roundDone[k]||0)); parts.push(k+' ×'+left); }
  emit('hha:quest',{text:'กลุ่มอาหาร — '+(parts.length?('Goal: '+parts.join(' , ')):'Goal: —')});
}
function isRoundCompleted(){ var k; for(k in roundNeed){ if((roundDone[k]||0)<roundNeed[k]) return false; } return true; }

function popupText(txt,x,y,color){
  var t=document.createElement('a-entity');
  t.setAttribute('troika-text','value: '+txt+'; color:'+(color||'#fff')+'; fontSize:0.09;');
  t.setAttribute('position',x+' '+(y+0.05)+' -1.18');
  host.appendChild(t);
  t.setAttribute('animation__rise','property: position; to: '+x+' '+(y+0.32)+' -1.18; dur:520; easing:ease-out');
  t.setAttribute('animation__fade','property: opacity; to: 0; dur:520; easing:linear');
  setTimeout(function(){ if(t.parentNode) t.parentNode.removeChild(t); },560);
}

// ---- สร้างเป้า (ตำแหน่งแก้ใหม่: set ที่ entity แม่) ----
function makeTarget(emoji, diff){
  var cat=EMO2CAT[emoji]||'อื่นๆ';
  var el=document.createElement('a-entity');

  // ตำแหน่งของ "แม่" เพื่อให้ภาพอยู่ในเฟรมแน่นอน
  var px=(Math.random()*1.6-0.8);   // -0.8..0.8
  var py=(Math.random()*0.7+0.6);   // 0.6..1.3
  el.setAttribute('position', px+' '+py+' -1.2');

  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji,192));
  img.setAttribute('position','0 0 0');
  img.setAttribute('width',0.42);
  img.setAttribute('height',0.42);
  img.classList.add('clickable');
  el.appendChild(img);

  var glow=document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:#60a5fa; opacity:0.18; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click',function(){
    if(!running) return;
    var need=roundNeed[cat], done=roundDone[cat]||0;
    if(need && done<need){
      roundDone[cat]=done+1;
      var base=30+combo*3; score+=base; combo+=1; if(combo>maxCombo)maxCombo=combo;
      popupText('+'+base+' ('+cat+')',px,py,'#bff7bf'); updateQuestText();
      if(isRoundCompleted()){
        var bonus=80+combo*2; score+=bonus; popupText('BONUS +'+bonus,px,py+0.15,'#ffe08a'); newRound(diff);
      }
    }else{
      combo=0; misses+=1; score=Math.max(0,score-20); popupText('-20',px,py,'#ffb4b4');
    }
    emit('hha:score',{score:score,combo:combo}); emit('hha:miss',{count:misses});
    destroy();
  });

  // TTL (กันนับพลาดตอนหยุด)
  var ttl=1900; if(diff==='easy') ttl=2100; if(diff==='hard') ttl=1500;
  setTimeout(function(){
    if(!running) return;
    if(!el.parentNode) return;
    destroy(); misses+=1; combo=0;
    emit('hha:score',{score:score,combo:combo});
    emit('hha:miss',{count:misses});
  }, ttl);

  return el;
}

function spawnLoop(diff){
  if(!running) return;
  // เลือกหมวดเป้าออกถี่ขึ้น
  var pool=[],k,i,a,w;
  for(k in POOL){ a=POOL[k]; w=roundNeed[k]?2:1; for(i=0;i<a.length;i++){ for(var j=0;j<w;j++) pool.push(a[i]); } }
  var emoji=pool[Math.floor(Math.random()*pool.length)];
  host.appendChild(makeTarget(emoji,diff));

  var gap=540; if(diff==='easy') gap=680; if(diff==='hard') gap=430;
  spawnTimer=setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  if(!host){ console.warn('groups.safe: #spawnHost not found'); host=document.querySelector('a-scene')||document.body; }
  var duration=(cfg && cfg.duration)|0 || 60;
  var diff=(cfg && cfg.difficulty) || 'normal';

  // reset
  while(host.firstChild) host.removeChild(host.firstChild); // ล้างเป้าเก่า (กันซ้อนนอกเฟรม)
  running=true; score=0; combo=0; maxCombo=0; misses=0;
  emit('hha:score',{score:0,combo:0}); emit('hha:miss',{count:0});

  newRound(diff);

  var remain=duration;
  emit('hha:time',{sec:remain});
  clearInterval(endTimer);
  endTimer=setInterval(function(){
    if(!running){ clearInterval(endTimer); return; }
    remain-=1; if(remain<0) remain=0;
    emit('hha:time',{sec:remain});
    if(remain<=0){ clearInterval(endTimer); endGame(); }
  },1000);

  spawnLoop(diff);
  console.log('[groups.safe] started diff=',diff,'dur=',duration);

  function endGame(){
    running=false;
    try{ clearTimeout(spawnTimer); }catch(e){}
    emit('hha:end',{score:score,combo:maxCombo,misses:misses,title:'Food Groups'});
  }

  return {
    stop:function(){ if(!running) return; endGame(); },
    pause:function(){ running=false; },
    resume:function(){ if(!running){ running=true; spawnLoop(diff); } }
  };
}
export default { boot };
