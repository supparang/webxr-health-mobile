<script type="module">
// === Good vs Junk — SAFE (emoji sprites, no opt-chain) ===
let running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, stopTimer=null, spawnTimer=null;

// --- Emoji → sprite (dataURL) helper + cache ---
var __emojiCache = {};
function emojiSprite(emo, px){
  var size = px || 128, key = emo+'@'+size;
  if(__emojiCache[key]) return __emojiCache[key];
  var c = document.createElement('canvas'); c.width=c.height=size;
  var ctx = c.getContext('2d');
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font = (size*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  ctx.shadowColor='rgba(0,0,0,0.25)'; ctx.shadowBlur=size*0.06;
  ctx.fillText(emo, size/2, size/2);
  return (__emojiCache[key]=c.toDataURL('image/png'));
}

function emit(name, detail){ window.dispatchEvent(new CustomEvent(name,{detail:detail})); }

const GOOD = ['🥦','🥕','🍎','🐟','🥛','🍊','🍌','🍇','🥬','🍚','🥜','🍞'];
const JUNK = ['🍔','🍟','🍕','🍩','🍪','🧁','🥤','🧋','🍫','🌭'];

function makeTarget(emoji, good){
  var el = document.createElement('a-entity');

  var img = document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji, 192));
  img.setAttribute('position', (Math.random()*1.6-0.8)+' '+(Math.random()*0.9+0.6)+' -1.2');
  img.setAttribute('width', 0.42); img.setAttribute('height', 0.42);
  el.appendChild(img);

  var glow = document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01');
  el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return;
    destroy();
    if(good){
      score += 20 + combo*2; combo+=1; if(combo>maxCombo) maxCombo=combo;
    }else{
      combo=0; misses+=1; score = Math.max(0, score-15); emit('hha:miss');
    }
    emit('hha:score', {score:score, combo:combo});

    try{
      var fx = document.createElement('a-image');
      fx.setAttribute('src', emojiSprite('💥', 196));
      fx.setAttribute('position', img.getAttribute('position'));
      fx.setAttribute('width',0.5); fx.setAttribute('height',0.5);
      host.appendChild(fx); setTimeout(function(){ if(fx.parentNode) fx.parentNode.removeChild(fx); }, 220);
    }catch(e){}
  });

  setTimeout(function(){
    if(!el.parentNode) return;
    destroy(); misses+=1; combo=0; emit('hha:miss'); emit('hha:score',{score:score,combo:combo});
  }, 1500);

  return el;
}

function spawnOne(diff){
  var p = Math.random();
  var good = p>0.35; // ประมาณ 65% เป็นของดี
  var emoji = good? GOOD[Math.floor(Math.random()*GOOD.length)] : JUNK[Math.floor(Math.random()*JUNK.length)];
  host.appendChild(makeTarget(emoji, good));

  // ช่วง spawn ตามความยาก
  var s = 520; if(diff==='easy') s=650; if(diff==='hard') s=400;
  spawnTimer = setTimeout(function(){ if(running) spawnOne(diff); }, s);
}

export async function boot(cfg){
  host = cfg && cfg.host ? cfg.host : document.querySelector('#spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';
  running = true; score=0; combo=0; maxCombo=0; misses=0;

  // เมื่อเริ่ม ส่งสถานะเริ่มให้ HUD
  emit('hha:score', {score:0, combo:0});
  emit('hha:quest', {text:'Mini Quest — กำลังเริ่ม…'});
  // เวลา
  var remain = duration;
  emit('hha:time',{sec:remain});
  var t = setInterval(function(){
    if(!running){ clearInterval(t); return; }
    remain-=1; emit('hha:time',{sec:remain});
    if(remain<=0){ clearInterval(t); endGame(); }
  },1000);

  function endGame(){
    running=false;
    clearTimeout(spawnTimer);
    emit('hha:end',{ score:score, combo:maxCombo, misses:misses, title:'Good vs Junk' });
  }

  // เริ่ม spawn
  spawnOne(diff);

  // mini quest (ง่าย ๆ): เก็บของดีติดกัน 8 ชิ้น
  var streak=0, goal=8;
  window.addEventListener('hha:score', function(e){
    // ประเมินจากคอมโบ (ถ้าโดนขยะจะคอมโบขาด)
    streak = (e.detail && e.detail.combo)||0;
    if(streak>=goal) emit('hha:quest',{text:'Mini Quest — สำเร็จ! เก็บของดีติดกัน '+goal+' ชิ้น'});
    else emit('hha:quest',{text:'Mini Quest — เก็บของดีติดกัน '+goal+' ชิ้น'});
  });

  return {
    stop(){ if(!running) return; running=false; clearTimeout(spawnTimer); emit('hha:end',{score:score,combo:maxCombo,misses:misses,title:'Good vs Junk'}); },
    pause(){ running=false; },
    resume(){ if(!running){ running=true; spawnOne(diff);} }
  };
}
export default { boot };
</script>