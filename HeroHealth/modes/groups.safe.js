<script type="module">
// === Food Groups — SAFE (emoji sprites) ===
let running=false, host=null, score=0, combo=0, maxCombo=0, misses=0, spawnTimer=null;

var __emojiCache={};
function emojiSprite(emo,px){
  var s=px||128,k=emo+'@'+s; if(__emojiCache[k])return __emojiCache[k];
  var c=document.createElement('canvas'); c.width=c.height=s;
  var x=c.getContext('2d'); x.textAlign='center'; x.textBaseline='middle';
  x.font=(s*0.75)+'px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif';
  x.shadowColor='rgba(0,0,0,0.25)'; x.shadowBlur=s*0.06; x.fillText(emo,s/2,s/2);
  return (__emojiCache[k]=c.toDataURL('image/png'));
}
function emit(n,d){ window.dispatchEvent(new CustomEvent(n,{detail:d})); }

const GROUPS = {
  veg:  { name:'ผัก',    list:['🥦','🥬','🥕','🍅','🌽'] },
  prot: { name:'โปรตีน', list:['🐟','🍗','🥚','🫘','🥜'] },
  carb: { name:'ข้าวแป้ง', list:['🍚','🍞','🥖','🍝','🥐'] },
  fruit:{ name:'ผลไม้',  list:['🍎','🍊','🍌','🍇','🍓'] },
  dairy:{ name:'นม/นมเปรี้ยว', list:['🥛','🧀','🍦'] }
};
var keys = Object.keys(GROUPS);

function makeTarget(emoji, correct){
  var el=document.createElement('a-entity');

  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji,192));
  img.setAttribute('position', (Math.random()*1.6-0.8)+' '+(Math.random()*0.9+0.6)+' -1.2');
  img.setAttribute('width',0.42); img.setAttribute('height',0.42);
  el.appendChild(img);

  var glow=document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:'+(correct?'#60a5fa':'#ef4444')+'; opacity:0.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01'); el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }

  img.addEventListener('click', function(){
    if(!running) return;
    destroy();
    if(correct){ score += 25 + combo*3; combo+=1; if(combo>maxCombo) maxCombo=combo; }
    else{ combo=0; misses+=1; score=Math.max(0,score-15); emit('hha:miss'); }
    emit('hha:score',{score:score, combo:combo});
  });

  setTimeout(function(){ if(!el.parentNode) return; destroy(); misses+=1; combo=0; emit('hha:miss'); emit('hha:score',{score:score,combo:combo}); },1700);

  return el;
}

export async function boot(cfg){
  host = cfg && cfg.host ? cfg.host : document.querySelector('#spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running=true; score=0; combo=0; maxCombo=0; misses=0;

  // เป้าหมายรอบ: ระบบจะสุ่ม "หมวดเป้าหมาย" แล้วสปอว์นทั้งถูก/ผิดปนกัน
  var targetKey = keys[Math.floor(Math.random()*keys.length)];
  emit('hha:quest',{text:'เลือกเฉพาะหมวด: '+GROUPS[targetKey].name});

  // เวลา
  var remain=duration; emit('hha:time',{sec:remain});
  var t=setInterval(function(){ if(!running){clearInterval(t);return;} remain-=1; emit('hha:time',{sec:remain}); if(remain<=0){clearInterval(t); endGame();}},1000);

  function endGame(){ running=false; clearTimeout(spawnTimer); emit('hha:end',{score:score,combo:maxCombo,misses:misses,title:'Food Groups'}); }

  function spawn(){
    var correct = Math.random()>0.4; // 60% ถูก
    var pool = correct? GROUPS[targetKey].list : GROUPS[keys[Math.floor(Math.random()*keys.length)]].list;
    var emoji = pool[Math.floor(Math.random()*pool.length)];
    host.appendChild(makeTarget(emoji, correct));
    var s=540; if(diff==='easy') s=680; if(diff==='hard') s=420;
    spawnTimer=setTimeout(function(){ if(running) spawn(); }, s);
  }
  spawn();

  return { stop(){ if(!running) return; running=false; clearTimeout(spawnTimer); emit('hha:end',{score:score,combo:maxCombo,misses:misses,title:'Food Groups'}); }, pause(){running=false;}, resume(){ if(!running){running=true; spawn();} } };
}
export default { boot };
</script>