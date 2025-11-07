// === Hero Health — vr/miniquest.js ===
// Lightweight mini-quest engine (no optional chaining)

export function createMiniQuest(opts){
  var onUpdate = (opts && opts.onUpdate) || function(){};
  var onFinish = (opts && opts.onFinish) || function(){};
  var nowQuest = null, secLeft = 0, timer = null, started = false;

  // quest factory (ต้องคืน {title, sec, reset(), apply({good,bad}) -> done?})
  var makeList = (opts && opts.makeList) || function(){ return []; };
  var pool = makeList().slice(0);

  function pick(){
    if(pool.length===0) pool = makeList().slice(0);
    return pool.splice(Math.floor(Math.random()*pool.length),1)[0];
  }

  function startNext(){
    nowQuest = pick();
    secLeft = nowQuest.sec;
    if(nowQuest.reset) nowQuest.reset();
    started = true;
    onUpdate(text());
  }

  function text(){
    if(!nowQuest) return 'Mini Quest — เตรียมเริ่ม';
    var t = (nowQuest.title||'Mini Quest') + ' | เหลือ ' + secLeft + 's';
    if(nowQuest.statusText) t = nowQuest.statusText(secLeft);
    return t;
  }

  function applyHit(isGood){
    if(!started || !nowQuest) return;
    var done = false;
    try { done = nowQuest.apply({good:isGood, bad:!isGood})===true; } catch(e){}
    if(done){
      // เควสสำเร็จ → เริ่มเควสใหม่หลัง 1 วิ
      onUpdate(nowQuest.title + ' — สำเร็จ!');
      if(timer) clearInterval(timer);
      setTimeout(function(){ run(); }, 1000);
    }else{
      onUpdate(text());
    }
  }

  function tick(){
    if(!nowQuest) return;
    secLeft = Math.max(0, secLeft-1);
    if(secLeft<=0){
      onUpdate(nowQuest.title + ' — หมดเวลา');
      if(timer) clearInterval(timer);
      setTimeout(function(){ run(); }, 800);
    }else{
      onUpdate(text());
    }
  }

  function run(){
    startNext();
    if(timer) clearInterval(timer);
    timer = setInterval(tick, 1000);
  }

  function stop(){
    if(timer) clearInterval(timer);
    timer = null; nowQuest = null; started = false;
    onFinish();
  }

  return {
    run: run,
    stop: stop,
    hit: applyHit
  };
}