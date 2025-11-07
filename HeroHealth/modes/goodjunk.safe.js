// === Good vs Junk — SAFE Visible + Fever + Popup ===
var running=false, host=null, score=0, combo=0, maxCombo=0, misses=0;
var spawnTimer=null, endTimer=null;

// simple event helper
function emit(n,d){ try{ window.dispatchEvent(new CustomEvent(n,{detail:d})); }catch(e){} }
function log(s){ emit('hha:log',{msg:s}); }

// Emoji → dataURL cache
var __emojiCache={};
function emojiSprite(emo, px){
  var size=px||160, key=emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c=document.createElement('canvas'); c.width=c.height=size;
  var g=c.getContext('2d');
  g.textAlign='center'; g.textBaseline='middle';
  g.font=(size*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  g.shadowColor='rgba(0,0,0,.28)'; g.shadowBlur=size*0.06;
  g.fillText(emo, size/2, size/2);
  __emojiCache[key]=c.toDataURL('image/png');
  return __emojiCache[key];
}

// pools
var GOOD=['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞','🍓','🍍','🥝','🍐'];
var JUNK=['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭','🍰','🍬'];

// fever
var FEVER=false, NEED=10, FEVER_MS=10000, feverTimer=null;
function feverStart(){ if(FEVER) return; FEVER=true; emit('hha:fever',{state:'start',ms:FEVER_MS});
  clearTimeout(feverTimer); feverTimer=setTimeout(function(){feverEnd();},FEVER_MS); }
function feverEnd(){ if(!FEVER) return; FEVER=false; emit('hha:fever',{state:'end'}); clearTimeout(feverTimer); feverTimer=null; }

// popup troika
function popup(txt,x,y,color){
  try{
    var t=document.createElement('a-entity');
    t.setAttribute('troika-text','value: '+txt+'; color: '+(color||'#fff')+'; fontSize:0.11;');
    t.setAttribute('position', x+' '+(y+0.18)+' 0.03');
    host.appendChild(t);
    t.setAttribute('animation__up','property: position; to: '+x+' '+(y+0.45)+' 0.03; dur:520; easing:ease-out');
    t.setAttribute('animation__fade','property: opacity; to: 0; dur:520; easing:linear');
    setTimeout(function(){ if(t && t.parentNode) t.parentNode.removeChild(t); }, 640);
  }catch(_){}
}

// target
function makeTarget(emoji, good, diff){
  var el=document.createElement('a-entity');

  // local pose inside host -> guaranteed in view
  var px=(Math.random()*1.8 - 0.9);
  var py=(Math.random()*1.0 - 0.2);
  var pz=(Math.random()*0.2 - 0.1);
  el.setAttribute('position', px+' '+py+' '+pz);

  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji,192));
  img.setAttribute('width',0.44); img.setAttribute('height',0.44);
  img.classList.add('clickable');
  el.appendChild(img);

  var glow=document.createElement('a-plane');
  glow.setAttribute('width',0.55); glow.setAttribute('height',0.55);
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.25; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  img.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return;
    destroy();
    if(good){
      var base=20+combo*2, plus=FEVER?base*2:base;
      score+=plus; combo++; if(combo>maxCombo) maxCombo=combo;
      if(!FEVER && combo>=NEED) feverStart();
      popup('+'+plus, px, py);
    }else{
      combo=0; misses++; score=Math.max(0, score-15);
      popup('-15', px, py, '#ffb4b4');
    }
    emit('hha:score',{score:score, combo:combo});
  });

  // TTL miss
  var ttl=1600; if(diff==='easy') ttl=1900; else if(diff==='hard') ttl=1400;
  setTimeout(function(){
    if(!el.parentNode) return;
    destroy(); misses++; combo=0; emit('hha:miss',{count:misses}); emit('hha:score',{score:score, combo:combo});
  }, ttl);

  return el;
}

function spawnLoop(diff){
  if(!running) return;
  var isGood=Math.random()>0.35;
  var emo=isGood?GOOD[(Math.random()*GOOD.length)|0]:JUNK[(Math.random()*JUNK.length)|0];
  host.appendChild(makeTarget(emo,isGood,diff));
  var gap=520; if(diff==='easy') gap=650; if(diff==='hard') gap=400;
  if(FEVER) gap=Math.max(300,(gap*0.85)|0);
  spawnTimer=setTimeout(function(){ spawnLoop(diff); }, gap);
}

// boot
export async function boot(cfg){
  try{
    host=(cfg&&cfg.host)?cfg.host:document.getElementById('spawnHost');
    var duration=(cfg&&cfg.duration)|0 || 60;
    var diff=(cfg&&cfg.difficulty)||'normal';

    // white debug dot 1.5s at host origin
    var dot=document.createElement('a-sphere');
    dot.setAttribute('radius',0.02); dot.setAttribute('color','#fff'); dot.setAttribute('position','0 0 0');
    host.appendChild(dot); setTimeout(function(){ if(dot.parentNode) dot.parentNode.removeChild(dot); }, 1500);

    running=true; score=0; combo=0; maxCombo=0; misses=0;
    FEVER=false; clearTimeout(feverTimer); feverTimer=null;

    emit('hha:score',{score:0, combo:0});
    emit('hha:quest',{text:'Mini Quest — เก็บของดีติดกัน '+NEED+' ชิ้น เพื่อเปิด FEVER!'});
    emit('hha:fever',{state:'end'});

    var remain=duration; emit('hha:time',{sec:remain});
    clearInterval(endTimer);
    endTimer=setInterval(function(){
      if(!running){ clearInterval(endTimer); return; }
      remain--; if(remain<0) remain=0;
      emit('hha:time',{sec:remain});
      if(remain<=0){ clearInterval(endTimer); endGame(); }
    }, 1000);

    // begin spawning after scene ready
    var scene=document.querySelector('a-scene');
    function begin(){ setTimeout(function(){ log('booted, spawn=ON'); spawnLoop(diff); }, 200); }
    if(scene){ if(scene.hasLoaded) begin(); else scene.addEventListener('loaded', begin, {once:true}); }
    else begin();

    function endGame(){
      running=false; clearTimeout(spawnTimer); feverEnd();
      emit('hha:end',{score:score, combo:maxCombo, misses:misses, title:'Good vs Junk'});
      log('ended: score='+score);
    }

    return {
      stop:function(){ if(!running) return; endGame(); },
      pause:function(){ running=false; },
      resume:function(){ if(!running){ running=true; spawnLoop(diff); } }
    };
  }catch(err){
    log('boot-error: '+(err && err.message?err.message:err));
    throw err;
  }
}
export default { boot };
