// === Healthy Plate — QUEST (centered host y=1.0) ===
var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, hits=0, spawns=0;
var spawnTimer=null, endTimer=null;

var SLOTS = ['veg','fruit','grain','protein','dairy'];
var POOLS = {
  veg:['🥦','🥕','🥬','🍅'], fruit:['🍎','🍓','🍌','🍊','🍇','🍐'],
  grain:['🍞','🥖','🍚'], protein:['🍗','🐟','🥚','🥜'], dairy:['🥛','🧀','🍦']
};
var need = [].concat(SLOTS); // รายการหมู่ที่ยังขาดในจานรอบนี้

function emit(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(e){} }
function pick(a){ return a[(Math.random()*a.length)|0]; }

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

function groupOf(emoji){
  for(var k in POOLS){ if(POOLS[k].indexOf(emoji)>-1) return k; }
  return null;
}

function nextNeed(){
  if(need.length===0) return null;
  return need[0]; // ต้องการคิวแรก
}

function makeTarget(emoji, diff){
  var wrap=document.createElement('a-entity');
  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  var px=(Math.random()*1.6 - 0.8);
  var py=(Math.random()*0.5 - 0.25);
  img.setAttribute('position', px+' '+py+' 0');
  img.setAttribute('width',0.42); img.setAttribute('height',0.42);
  wrap.appendChild(img);

  function cleanup(){ if(wrap.parentNode) wrap.parentNode.removeChild(wrap); }

  img.classList.add('clickable');
  img.addEventListener('click', function(){
    if(!running) return;
    cleanup(); spawns++; hits++;
    var g=groupOf(emoji);
    if(g && need.indexOf(g)>-1){
      // ถูกหมู่ → เอาออกจาก need
      need = need.filter(function(n){ return n!==g; });
      var plus = 35 + combo*3; score+=plus; combo+=1; if(combo>maxCombo) maxCombo=combo;
      popupText('+'+plus, px, py, '#bbf7d0');
      emit('hha:quest',{text:'Plate: ขาด '+(need.join(', ')||'ครบแล้ว!')});
      // ครบ 5 หมู่ → เริ่มรอบใหม่
      if(need.length===0){ need=[].concat(SLOTS); }
    }else{
      combo=0; misses+=1; score=Math.max(0, score-12);
      popupText('-12', px, py, '#fecaca');
      emit('hha:miss',{count:misses});
    }
    emit('hha:score',{score:score, combo:combo});
  });

  var ttl=1700; if(diff==='easy') ttl=2000; else if(diff==='hard') ttl=1400;
  setTimeout(function(){
    if(!wrap.parentNode) return;
    cleanup(); spawns++;
    // ปล่อยผ่านไม่ลงโทษ
  }, ttl);

  return wrap;
}

function spawnLoop(diff){
  if(!running) return;
  var want = nextNeed() || pick(SLOTS);
  var pool = POOLS[want] || POOLS.veg;
  var emoji = pick(pool);
  host.appendChild(makeTarget(emoji, diff));
  var gap=560; if(diff==='easy') gap=700; if(diff==='hard') gap=420;
  spawnTimer=setTimeout(function(){ spawnLoop(diff); }, gap);
}

export async function boot(cfg){
  host = (cfg && cfg.host) ? cfg.host : document.getElementById('spawnHost');
  try{ host.setAttribute('position','0 1.0 -1.6'); }catch(e){}
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  need=[].concat(SLOTS);
  running=true; score=0; combo=0; maxCombo=0; misses=0; hits=0; spawns=0;

  emit('hha:score',{score:0, combo:0});
  emit('hha:quest',{text:'Plate: เลือกหมวดให้ครบ 5 หมู่ (เริ่ม: VEG)'});  

  var remain=duration; emit('hha:time',{sec:remain});
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
    emit('hha:end',{
      title:'Healthy Plate',
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
