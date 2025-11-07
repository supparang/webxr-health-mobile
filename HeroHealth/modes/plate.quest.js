<script type="module">
// === Healthy Plate — SAFE (emoji sprites) ===
let running=false, host=null, score=0, combo=0, maxCombo=0, spawnTimer=null, misses=0;

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

const SETS = {
  veg:  ['🥦','🥕','🥬','🍅','🌽'],
  prot: ['🐟','🍗','🥚','🫘','🥜'],
  carb: ['🍚','🍞','🥖','🍝'],
  fruit:['🍎','🍊','🍌','🍇','🍓'],
  dairy:['🥛','🧀','🍦']
};
var keys = Object.keys(SETS);

// รอบหนึ่งต้องครบ 5 หมู่อย่างน้อยหมวดละ 1
function makeNeed(){
  var need={veg:1,prot:1,carb:1,fruit:1,dairy:1};
  return need;
}
function needCount(need){
  var n=0; for(var k in need){ if(need[k]>0) n+=need[k]; } return n;
}

function makeTarget(emoji, correct){
  var el=document.createElement('a-entity');

  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite(emoji,192));
  img.setAttribute('position', (Math.random()*1.6-0.8)+' '+(Math.random()*0.9+0.6)+' -1.2');
  img.setAttribute('width',0.42); img.setAttribute('height',0.42);
  el.appendChild(img);

  var glow=document.createElement('a-plane');
  glow.setAttribute('width',0.48); glow.setAttribute('height',0.48);
  glow.setAttribute('material','color:'+(correct?'#22c55e':'#ef4444')+'; opacity:0.22; transparent:true');
  glow.setAttribute('position','0 0 -0.01'); el.appendChild(glow);

  function destroy(){ if(el.parentNode) el.parentNode.removeChild(el); }
  img.addEventListener('click', function(){
    if(!running) return;
    destroy();
    if(correct){ score+=30+combo*2; combo+=1; if(combo>maxCombo)maxCombo=combo; }
    else{ combo=0; misses+=1; score=Math.max(0,score-15); emit('hha:miss'); }
    emit('hha:score',{score:score,combo:combo});
  });
  setTimeout(function(){ if(!el.parentNode) return; destroy(); combo=0; misses+=1; emit('hha:miss'); emit('hha:score',{score:score,combo:combo}); },1600);
  return el;
}

export async function boot(cfg){
  host = cfg && cfg.host ? cfg.host : document.querySelector('#spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running=true; score=0; combo=0; maxCombo=0; misses=0;

  var need = makeNeed();
  emit('hha:quest',{text:'Plate — จัดครบ 5 หมู่ (เหลือ: '+needCount(need)+')'});

  var remain=duration; emit('hha:time',{sec:remain});
  var t=setInterval(function(){ if(!running){clearInterval(t);return;} remain-=1; emit('hha:time',{sec:remain}); if(remain<=0){clearInterval(t); endGame();}},1000);

  function pickCorrectKey(){
    // เลือกหมวดที่ยัง “ขาด” ก่อน
    var cand=[]; for(var k in need){ if(need[k]>0) cand.push(k); }
    if(cand.length===0) cand=keys.slice();
    return cand[Math.floor(Math.random()*cand.length)];
  }

  function spawn(){
    var correct = Math.random()>0.35; // 65% ถูก
    var key = correct? pickCorrectKey() : keys[Math.floor(Math.random()*keys.length)];
    var emoji = SETS[key][Math.floor(Math.random()*SETS[key].length)];
    var el = makeTarget(emoji, correct);
    host.appendChild(el);

    if(correct && need[key]>0){ need[key]-=1; }
    emit('hha:quest',{text:'Plate — จัดครบ 5 หมู่ (เหลือ: '+needCount(need)+')'});

    var s=540; if(diff==='easy') s=680; if(diff==='hard') s=420;
    spawnTimer=setTimeout(function(){ if(running) spawn(); }, s);

    // ครบ 5 หมู่แล้ว เริ่มรอบใหม่ (ต้องครบอีก) พร้อมโบนัสเล็กน้อย
    if(needCount(need)===0){
      score+=50; need=makeNeed();
      emit('hha:score',{score:score,combo:combo});
      emit('hha:quest',{text:'Plate — รอบใหม่! (เหลือ: '+needCount(need)+')'});
    }
  }
  spawn();

  function endGame(){ running=false; clearTimeout(spawnTimer); emit('hha:end',{score:score,combo:maxCombo,misses:misses,title:'Healthy Plate'}); }

  return { stop(){ if(!running)return; running=false; clearTimeout(spawnTimer); emit('hha:end',{score:score,combo:maxCombo,misses:misses,title:'Healthy Plate'}); }, pause(){running=false;}, resume(){ if(!running){running=true; spawn();} } };
}
export default { boot };
</script>