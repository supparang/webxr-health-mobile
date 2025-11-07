// === Hero Health — Healthy Plate (QUEST PROD) ===
export async function boot(config){
  var host = (config && config.host) || document.getElementById('spawnHost');
  var diff = (config && config.difficulty) || 'normal';
  var duration = (config && config.duration) || 60;

  // อาหาร 5 หมู่ + “หมวดพิเศษ” (เลือกทดแทนได้รอบละ 1)
  var CAT = {
    veg:['🥦','🥬','🥕','🍅','🍆'],
    fruit:['🍎','🍌','🍇','🍊','🍓'],
    grain:['🍞','🍚','🥖','🥨','🍙'],
    protein:['🐟','🍗','🥚','🧀','🥜'],
    dairy:['🥛','🧀','🍦','🥣']
  };
  var cats = Object.keys(CAT);

  // เป้าหมายต่อรอบ (เริ่ม 1/หมวด)
  var goalPer = {veg:1, fruit:1, grain:1, protein:1, dairy:1};

  var score=0, combo=0, maxCombo=0, timeLeft=duration, misses=0, running=true;
  var spawner=null, ticker=null, spawnMs=(diff==='easy')?950:(diff==='hard')?650:800;

  var needText = mkNeedText();
  emit('hha:quest',{text:'Plate — จัดครบ 5 หมู่: '+needText});

  function mkNeedText(){
    var t=[]; for(var k in goalPer){ if(goalPer[k]>0) t.push(nameTH(k)+' '+goalPer[k]); }
    return t.join(' / ');
  }
  function nameTH(k){
    if(k==='veg') return 'ผัก';
    if(k==='fruit') return 'ผลไม้';
    if(k==='grain') return 'ข้าวแป้ง';
    if(k==='protein') return 'โปรตีน';
    if(k==='dairy') return 'นม';
    return k;
  }
  function emit(name, detail){ try{ window.dispatchEvent(new CustomEvent(name,{detail:detail||{}})); }catch(e){} }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  function makeTarget(emoji, key){
    var el=document.createElement('a-entity');
    el.setAttribute('text','value:'+emoji+'; align:center; color:#fff; width:4');
    el.setAttribute('position',(Math.random()*1.6-0.8)+' '+(Math.random()*0.9+0.6)+' -1.2');
    el.setAttribute('scale','0.6 0.6 0.6');
    var glow=document.createElement('a-entity');
    glow.setAttribute('geometry','primitive:plane; width:0.42; height:0.42');
    glow.setAttribute('material','color:#22c55e; opacity:0.22');
    glow.setAttribute('position','0 0 -0.01');
    el.appendChild(glow);

    el.addEventListener('click', function(){
      if(!running) return;
      el.parentNode && el.parentNode.removeChild(el);

      if(goalPer[key]>0){
        goalPer[key]-=1;
        score += 30 + combo*3; combo+=1; if(combo>maxCombo) maxCombo=combo;
      }else{
        // กดเกินหมวด → โทษเบา ๆ
        combo=0; misses+=1; emit('hha:miss'); score = Math.max(0, score-12);
      }
      emit('hha:score',{score:score, combo:combo});

      // อัปเดตเควส
      var left = mkNeedText();
      if(left===''){ // ครบ 5 หมู่ → รีเซ็ตเป้าหมายรอบใหม่ (สุ่มจำนวน 1–2 ต่อหมวด)
        for(var k in goalPer){ goalPer[k] = 1 + ((Math.random()<0.33)?1:0); }
        left = mkNeedText();
        emit('hha:quest',{text:'รอบใหม่ — จัดให้ครบ: '+left});
      }else{
        emit('hha:quest',{text:'Plate — เหลือ: '+left});
      }

      fx(el);
    });

    // หมดเวลาเป้า
    setTimeout(function(){
      if(!el.parentNode) return;
      el.parentNode.removeChild(el);
      combo=0; misses+=1; emit('hha:miss');
      emit('hha:score',{score:score, combo:combo});
    }, 1600);

    return el;
  }

  function spawnOne(){
    if(!running) return;
    // เลือกสุ่มหมวด แต่ bias ไปหมวดที่ยังขาด
    var want=[];
    for(var k in goalPer){ if(goalPer[k]>0) want.push(k); }
    var key;
    if(want.length>0 && Math.random()<0.7){ key = want[(Math.random()*want.length)|0]; }
    else{ key = cats[(Math.random()*cats.length)|0]; }
    host.appendChild(makeTarget(pick(CAT[key]), key));
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
      e.setAttribute('text','value:💫; align:center; color:#fff; width:5');
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