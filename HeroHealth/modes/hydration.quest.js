<script type="module">
// === Hydration (Balance Meter) — SAFE ===
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

function waterDrop(){
  var img=document.createElement('a-image');
  img.setAttribute('src', emojiSprite('💧',192));
  img.setAttribute('position', (Math.random()*1.6-0.8)+' '+(Math.random()*0.9+0.6)+' -1.2');
  img.setAttribute('width',0.42); img.setAttribute('height',0.42);
  return img;
}

export async function boot(cfg){
  host = cfg && cfg.host ? cfg.host : document.querySelector('#spawnHost');
  var duration = (cfg && cfg.duration)|0 || 60;
  var diff = (cfg && cfg.difficulty) || 'normal';

  running=true; score=0; combo=0; maxCombo=0; misses=0;

  var hydration=0.5; // 0..1 (GREEN ~ 0.45..0.65)
  var remain=duration; emit('hha:time',{sec:remain});
  emit('hha:quest',{text:'Hydration — Zone: '+zoneText(hydration)+' | Streak 0/10 | Recover HIGH → GREEN ≤3s'});

  var t=setInterval(function(){ if(!running){clearInterval(t);return;} remain-=1; emit('hha:time',{sec:remain}); if(remain<=0){clearInterval(t); endGame();}},1000);

  function zoneText(v){ if(v<0.45) return 'LOW'; if(v>0.65) return 'HIGH'; return 'GREEN'; }

  function spawn(){
    var el = waterDrop();
    host.appendChild(el);
    el.addEventListener('click', function(){
      if(!running) return;
      // ดื่มน้ำ = hydration +; (สุ่มเล็กน้อย)
      hydration = Math.min(1, hydration + (0.08 + Math.random()*0.05));
      var z = zoneText(hydration);
      // ให้คะแนนตามโซน
      if(z==='GREEN'){ score+=15+combo; combo+=1; if(combo>maxCombo)maxCombo=combo; }
      else if(z==='HIGH'){ score+=5; combo+=1; if(combo>maxCombo)maxCombo=combo; }
      else { combo=0; score=Math.max(0,score-10); misses+=1; emit('hha:miss'); }
      emit('hha:score',{score:score,combo:combo});
      emit('hha:quest',{text:'Hydration — Zone: '+z+' | Streak '+combo+'/10 | Recover HIGH → GREEN ≤3s'});
      setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); },0);
    });

    // หมดอายุ = พลาด (ปล่อยให้ขาดน้ำ)
    setTimeout(function(){
      if(!el.parentNode) return;
      el.parentNode.removeChild(el);
      hydration = Math.max(0, hydration - 0.06);
      combo=0; misses+=1; emit('hha:miss');
      emit('hha:score',{score:score,combo:combo});
      emit('hha:quest',{text:'Hydration — Zone: '+zoneText(hydration)+' | Streak '+combo+'/10 | Recover HIGH → GREEN ≤3s'});
    }, 1400);

    var s=560; if(diff==='easy') s=680; if(diff==='hard') s=420;
    spawnTimer=setTimeout(function(){ if(running) spawn(); }, s);
  }
  spawn();

  function endGame(){ running=false; clearTimeout(spawnTimer); emit('hha:end',{score:score,combo:maxCombo,misses:misses,title:'Hydration'}); }

  return { stop(){ if(!running)return; running=false; clearTimeout(spawnTimer); emit('hha:end',{score:score,combo:maxCombo,misses:misses,title:'Hydration'}); }, pause(){running=false;}, resume(){ if(!running){running=true; spawn();} } };
}
export default { boot };
</script>