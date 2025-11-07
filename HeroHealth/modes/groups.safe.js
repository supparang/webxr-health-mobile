// === Hero Health — Food Groups (SAFE PROD) ===
export async function boot(config){
  var host = (config && config.host) || document.getElementById('spawnHost');
  var diff = (config && config.difficulty) || 'normal';
  var duration = (config && config.duration) || 60;

  // หมวดหลัก (ตัวอย่างย่อ)
  var GROUPS = {
    veg: ['🥦','🥬','🥕','🍅','🍆'],
    protein: ['🐟','🍗','🥚','🧀','🥜'],
    grain: ['🍞','🍚','🥨','🥖','🍙'],
    fruit: ['🍎','🍌','🍇','🍊','🍓']
  };
  var keys = Object.keys(GROUPS);

  var score=0, combo=0, maxCombo=0, timeLeft=duration, misses=0, running=true;
  var spawner=null, ticker=null;
  var need = 2; // ต้องเลือกให้ถูกติดกัน n รายการ/รอบ
  var targetKey = keys[(Math.random()*keys.length)|0];
  var streakOK = 0;

  emit('hha:quest',{text:'Mini Quest — เลือกหมวด: '+label(targetKey)+' (ให้ถูก '+need+' ชิ้นติด)'});
  var spawnMs = (diff==='easy')?950:(diff==='hard')?650:780;

  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){} }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
  function label(key){
    if(key==='veg') return 'ผัก';
    if(key==='protein') return 'โปรตีน';
    if(key==='grain') return 'ข้าว/แป้ง';
    if(key==='fruit') return 'ผลไม้';
    return key;
  }

  function makeTarget(emoji, correct){
    var el=document.createElement('a-entity');
    el.setAttribute('text','value:'+emoji+'; align:center; color:#fff; width:4');
    el.setAttribute('position', (Math.random()*1.6-0.8)+' '+(Math.random()*0.9+0.6)+' -1.2');
    el.setAttribute('scale','0.6 0.6 0.6');
    var glow=document.createElement('a-entity');
    glow.setAttribute('geometry','primitive:plane; width:0.42; height:0.42');
    glow.setAttribute('material','color:'+(correct?'#60a5fa':'#ef4444')+'; opacity:0.22');
    glow.setAttribute('position','0 0 -0.01');
    el.appendChild(glow);

    el.addEventListener('click', function(){
      if(!running) return;
      el.parentNode && el.parentNode.removeChild(el);
      if(correct){
        streakOK += 1;
        score += 25 + combo*2; combo += 1; if(combo>maxCombo) maxCombo=combo;
        if(streakOK>=need){
          // เปลี่ยนหมวด/เพิ่มความท้าทาย
          streakOK=0; need = Math.min(need+1, 4);
          targetKey = keys[(Math.random()*keys.length)|0];
          emit('hha:quest',{text:'เป้าหมายใหม่ — '+label(targetKey)+' (ให้ถูก '+need+' ชิ้นติด)'});
        }
      }else{
        combo=0; streakOK=0; misses+=1; emit('hha:miss');
        score = Math.max(0, score-15);
      }
      emit('hha:score',{score:score, combo:combo});
      fx(el);
    });

    setTimeout(function(){
      if(!el.parentNode) return;
      el.parentNode.removeChild(el);
      combo=0; streakOK=0; misses+=1; emit('hha:miss');
      emit('hha:score',{score:score, combo:combo});
    }, 1600);

    return el;
  }

  function spawnOne(){
    if(!running) return;
    var correct = Math.random()<0.55;
    var key = correct? targetKey : keys[(Math.random()*keys.length)|0];
    var arr = GROUPS[key];
    var emoji = pick(arr);
    host.appendChild(makeTarget(emoji, correct && key===targetKey));
  }

  function startSpawn(){ spawner=setInterval(spawnOne, spawnMs); }
  function stopSpawn(){ if(spawner){ clearInterval(spawner); spawner=null; } }
  function startTimer(){
    emit('hha:time',{sec:timeLeft});
    ticker=setInterval(function(){
      if(!running) return;
      timeLeft-=1; emit('hha:time',{sec:timeLeft});
      if(timeLeft<=0) endGame();
    },1000);
  }
  function stopTimer(){ if(ticker){ clearInterval(ticker); ticker=null; } }

  function fx(srcEl){
    try{
      var e=document.createElement('a-entity');
      e.setAttribute('text','value:✨; align:center; color:#fff; width:5');
      e.setAttribute('position', srcEl.getAttribute('position'));
      host.appendChild(e);
      setTimeout(function(){ e.parentNode && e.parentNode.removeChild(e); }, 220);
    }catch(e){}
  }

  function endGame(){
    running=false; stopSpawn(); stopTimer();
    emit('hha:end',{score:score, combo:maxCombo, duration:duration, misses:misses});
  }

  startSpawn(); startTimer();
  return { stop:endGame, pause:function(){running=false;}, resume:function(){ if(!spawner) startSpawn(); if(!ticker) startTimer(); running=true; } };
}
export default { boot };