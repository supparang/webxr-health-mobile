// === Hero Health — Hydration (QUEST PROD) ===
export async function boot(config){
  var host = (config && config.host) || document.getElementById('spawnHost');
  var diff = (config && config.difficulty) || 'normal';
  var duration = (config && config.duration) || 60;

  // โซนน้ำ: 0..100 → GREEN = 40..70, LOW < 40, HIGH > 70
  var H = {value:50}; // เริ่มกลางพอดี
  var score=0, combo=0, maxCombo=0, timeLeft=duration, misses=0, running=true;
  var spawner=null, ticker=null;

  // เควสบนแถบขวา
  emit('hha:quest',{text:'Hydration — Zone: LOW | GREEN 0/20s | Streak 0/10 | Recover HIGH→GREEN ≤3s'});

  var spawnMs = (diff==='easy')?1000:(diff==='hard')?700:850;

  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){} }

  function uiDrop(level, good){
    // หยดน้ำ/ขวด
    var el=document.createElement('a-entity');
    var icon = good?'💧':'🔥';
    el.setAttribute('text','value:'+icon+'; align:center; color:#fff; width:5');
    el.setAttribute('position', (Math.random()*1.4-0.7)+' '+(Math.random()*0.9+0.6)+' -1.2');
    el.setAttribute('scale','0.7 0.7 0.7');
    el.addEventListener('click', function(){
      if(!running) return;
      el.parentNode && el.parentNode.removeChild(el);

      // ปรับระดับน้ำ
      var delta = level;
      if(good){ H.value = Math.min(100, H.value + delta); }
      else{ H.value = Math.max(0, H.value - delta); }

      // ตัดสินคะแนนตามโซน
      if(H.value>=40 && H.value<=70){ // GREEN
        score += 15 + combo*2; combo+=1; if(combo>maxCombo) maxCombo=combo;
      }else if(H.value>70){ // HIGH → ได้คะแนนครึ่งเดียว
        score += 6; combo = Math.max(0, combo-1);
      }else{ // LOW → ลงโทษ
        misses+=1; emit('hha:miss'); combo=0; score = Math.max(0, score-10);
      }
      emit('hha:score',{score:score, combo:combo});

      // เอฟเฟกต์
      var fx=document.createElement('a-entity');
      fx.setAttribute('text','value:'+(good?'✨':'⚠️')+'; align:center; color:#fff; width:4');
      fx.setAttribute('position', el.getAttribute('position'));
      host.appendChild(fx);
      setTimeout(function(){ fx.parentNode && fx.parentNode.removeChild(fx); }, 240);
    });

    // หมดอายุ
    setTimeout(function(){
      if(!el.parentNode) return;
      el.parentNode.removeChild(el);
      misses+=1; emit('hha:miss'); combo=0; emit('hha:score',{score:score, combo:combo});
    }, 1600);

    // background glow
    var g=document.createElement('a-entity');
    g.setAttribute('geometry','primitive:plane; width:0.48; height:0.48');
    g.setAttribute('material','color:'+(good?'#38bdf8':'#ef4444')+'; opacity:0.22');
    g.setAttribute('position','0 0 -0.01');
    el.appendChild(g);

    return el;
  }

  function spawnOne(){
    if(!running) return;
    var good = Math.random()<0.6;
    var delta = good? (diff==='hard'?12:10) : (diff==='hard'?14:12);
    host.appendChild(uiDrop(delta, good));
  }

  function startSpawn(){ spawner=setInterval(spawnOne, spawnMs); }
  function stopSpawn(){ if(spawner){ clearInterval(spawner); spawner=null; } }

  function startTimer(){
    emit('hha:time',{sec:timeLeft});
    ticker=setInterval(function(){
      if(!running) return;
      timeLeft-=1; emit('hha:time',{sec:timeLeft});
      // drift ธรรมชาติ (น้ำลดเล็กน้อย)
      H.value = Math.max(0, H.value - 1);
      if(timeLeft<=0) endGame();
    },1000);
  }
  function stopTimer(){ if(ticker){ clearInterval(ticker); ticker=null; } }

  function endGame(){
    running=false; stopSpawn(); stopTimer();
    emit('hha:end',{score:score, combo:maxCombo, duration:duration, misses:misses});
  }

  startSpawn(); startTimer();
  return { stop:endGame, pause:function(){running=false;}, resume:function(){ if(!spawner) startSpawn(); if(!ticker) startTimer(); running=true; } };
}
export default { boot };