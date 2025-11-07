// === Hero Health — Good vs Junk (SAFE PROD) ===
export async function boot(config){
  var host = (config && config.host) || document.getElementById('spawnHost');
  var diff = (config && config.difficulty) || 'normal';
  var duration = (config && config.duration) || 60;

  // ----- Pools -----
  var GOOD = ['🥦','🥕','🍎','🍌','🐟','🥗','🍇','🍊','🥛','🍚'];
  var JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🧋','🥤','🍰','🍫'];

  // ----- State -----
  var score=0, combo=0, maxCombo=0, timeLeft=duration, misses=0, running=true;
  var spawner = null, ticker = null;

  // HUD: เควส
  emit('hha:quest',{text:'Mini Quest — เก็บของดีติดกัน 8 ชิ้น'});

  // ความยาก → ความถี่และโทษพลาด
  var spawnMs = (diff==='easy')?900:(diff==='hard')?600:750;
  var penMiss = (diff==='easy')?2:(diff==='hard')?6:4;

  // ----- Utils -----
  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){} }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function makeTarget(emoji, good){
    var el = document.createElement('a-entity');
    // ใช้ a-text เพื่อโชว์อีโมจิ (รองรับ A-Frame)
    el.setAttribute('text', 'value:'+emoji+'; align:center; color:#fff; width:4');
    el.setAttribute('position', (Math.random()*1.6-0.8)+' '+(Math.random()*0.9+0.6)+' -1.2');
    el.setAttribute('scale', '0.6 0.6 0.6');
    // glow
    var glow = document.createElement('a-entity');
    glow.setAttribute('geometry','primitive:plane; width:0.42; height:0.42');
    glow.setAttribute('material','color:'+(good?'#22c55e':'#ef4444')+'; opacity:0.22');
    glow.setAttribute('position','0 0 -0.01');
    el.appendChild(glow);

    // click
    el.addEventListener('click', function(){
      if(!running) return;
      el.parentNode && el.parentNode.removeChild(el);
      if(good){
        score += 20 + combo*2;
        combo += 1; if(combo>maxCombo) maxCombo=combo;
      }else{
        combo = 0; // รีเซ็ตคอมโบ
        misses += 1; emit('hha:miss');
        score = Math.max(0, score - (10+penMiss));
      }
      emit('hha:score', {score:score, combo:combo});
      // เอฟเฟกต์แตกง่าย ๆ
      try{
        var fx = document.createElement('a-entity');
        fx.setAttribute('text','value:💥; align:center; color:#fff; width:6');
        fx.setAttribute('position', el.getAttribute('position'));
        host.appendChild(fx);
        setTimeout(function(){ fx.parentNode && fx.parentNode.removeChild(fx); }, 240);
      }catch(e){}
    });

    // auto-expire (นับพลาด)
    setTimeout(function(){
      if(!el.parentNode) return;
      el.parentNode.removeChild(el);
      misses += 1; emit('hha:miss');
      combo = 0;
      emit('hha:score',{score:score, combo:combo});
    }, 1500);

    return el;
  }

  // ----- Loops -----
  function spawnOne(){
    if(!running) return;
    var isGood = Math.random() < 0.65;
    var emoji = isGood? pick(GOOD): pick(JUNK);
    host.appendChild(makeTarget(emoji, isGood));
  }
  function startSpawn(){ spawner = setInterval(spawnOne, spawnMs); }
  function stopSpawn(){ if(spawner){ clearInterval(spawner); spawner=null; } }

  function startTimer(){
    emit('hha:time',{sec:timeLeft});
    ticker = setInterval(function(){
      if(!running) return;
      timeLeft -= 1;
      emit('hha:time',{sec:timeLeft});
      if(timeLeft<=0) endGame();
    }, 1000);
  }
  function stopTimer(){ if(ticker){ clearInterval(ticker); ticker=null; } }

  function endGame(){
    running=false; stopSpawn(); stopTimer();
    emit('hha:end',{score:score, combo:maxCombo, duration:duration, misses:misses});
  }

  // ----- Start -----
  startSpawn(); startTimer();
  return { stop:endGame, pause:function(){running=false;}, resume:function(){ if(!ticker) startTimer(); if(!spawner) startSpawn(); running=true; } };
}
export default { boot };