// === vr/mode-factory.js (Safe/Production) ===
// โรงงานสปอว์นเป้า + จัดการเวลา/คะแนน + อีเวนต์ HUD
// ไม่มี optional chaining เพื่อรองรับเบราว์เซอร์เก่า

function emit(type, detail){
  try{ window.dispatchEvent(new CustomEvent(type,{detail:detail||{}})); }catch(e){}
}

function now(){ return (typeof performance!=='undefined' && performance.now) ? performance.now() : Date.now(); }
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }
function rand(a,b){ return a + Math.random()*(b-a); }
function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

export async function boot(cfg){
  cfg = cfg || {};
  var host = cfg.host || document.querySelector('#spawnHost');
  var difficulty = String(cfg.difficulty||'normal');
  var duration = Number(cfg.duration||60);

  // พารามิเตอร์พื้นฐาน
  var slotW = 0.8, slotH = 0.5;           // กริดหน่วยในโลก A-Frame (ประมาณหน้า)
  var cols = 3, rows = 2;                  // ค่า default
  if(difficulty==='easy'){ cols=2; rows=2; }
  if(difficulty==='hard'){ cols=4; rows=3; }

  // state
  var running = true;
  var score = 0, combo = 0, comboMax = 0, streak = 0;
  var missCount = 0;
  var firstSpawned = false;
  var allowMiss = false;
  var active = new Set();

  // สร้างกริดตำแหน่ง
  function buildSlots(){
    var ss=[];
    for(var r=0;r<rows;r++){
      for(var c=0;c<cols;c++){
        var x = (c-(cols-1)/2)*slotW;
        var y = 1.0 + (rows-1-r)*0.35;           // ไล่ขึ้นบนเล็กน้อย
        var z = -1.2;
        ss.push({x:x,y:y,z:z, row:r, col:c, busy:false});
      }
    }
    return ss;
  }
  var slots = buildSlots();

  // pool อักขระ (ตัวอิโมจิ) — มาจากโหมด
  var pools = (cfg.pools || {});
  var GOOD = pools.good || ['🍎','🍓','🍇','🥦','🥕','🍊'];
  var BAD  = pools.bad  || ['🍔','🍟','🍕','🍩','🥤','🧋'];

  var goodRate = (typeof cfg.goodRate==='number') ? cfg.goodRate : 0.65;
  var goldenRate = (typeof cfg.goldenRate==='number') ? cfg.goldenRate : 0.05;
  var goal = (typeof cfg.goal==='number') ? cfg.goal : 9999;
  var judge = (typeof cfg.judge==='function') ? cfg.judge : null;

  // สุ่มช่องว่าง
  function takeSlot(){
    var free = slots.filter(function(s){ return !s.busy; });
    if(!free.length) return null;
    var p = free[(Math.random()*free.length)|0];
    p.busy=true; return p;
  }
  function freeSlot(s){ if(!s) return; s.busy=false; }

  // สร้างเอนทิตีเป้า
  function makeTarget(char, slot, ttl){
    var el = document.createElement('a-entity');
    el.setAttribute('text', {
      value: char, align: 'center', width: 6, color: '#fff'
    });
    el.setAttribute('position', slot.x+' '+slot.y+' '+slot.z);
    el.setAttribute('scale', '0.5 0.5 0.5');
    // glow เล็กน้อย
    el.setAttribute('material','color:#ffffff; opacity:1');

    // hit area (กล่องโปร่งใส)
    var hit = document.createElement('a-entity');
    hit.setAttribute('geometry', 'primitive: box; width: 0.45; height: 0.45; depth: 0.05');
    hit.setAttribute('material', 'transparent: true; opacity: 0');
    hit.setAttribute('position','0 0 0.01');

    // pointer/touch
    var fire = function(ev){
      if(!running) return;
      ev && ev.preventDefault && ev.preventDefault();
      // ตัด timeout ก่อน
      try{ clearTimeout(killer); }catch(e){}
      // ประเมิน
      var res = { good:true, scoreDelta:10, feverDelta:0 };
      if(judge) res = judge(char, { type:'hit', score:score, combo:combo, streak:streak });

      if(res.good){
        var plus = (typeof res.scoreDelta==='number') ? res.scoreDelta : 10;
        score += plus; combo += 1; streak += 1;
        if(combo>comboMax) comboMax=combo;
        emit('hha:score', {score:score, combo:combo});
      }else{
        missCount++; emit('hha:miss',{count:missCount});
        score = Math.max(0, score + (typeof res.scoreDelta==='number' ? res.scoreDelta : -5));
        combo = 0; streak = 0;
        emit('hha:score', {score:score, combo:combo});
      }

      cleanup();
    };
    hit.addEventListener('click', fire);
    hit.addEventListener('pointerdown', fire);
    el.appendChild(hit);

    // timeout = miss
    var killer = setTimeout(function(){
      if(!allowMiss){ cleanup(); return; }
      missCount++; emit('hha:miss',{count:missCount});
      var r = { good:false, scoreDelta:-5 };
      if(judge) r = judge(null, { type:'timeout', score:score, combo:combo, streak:streak });
      score = Math.max(0, score + (typeof r.scoreDelta==='number' ? r.scoreDelta : -5));
      combo=0; streak=0; emit('hha:score',{score:score, combo:combo});
      cleanup();
    }, ttl);

    function cleanup(){
      try{ if(el && el.parentNode) el.parentNode.removeChild(el); }catch(e){}
      try{ clearTimeout(killer); }catch(e){}
      active.delete(el); freeSlot(slot);
    }

    return el;
  }

  // spawn loop
  var spawnLock = false;
  function spawnOne(){
    if(!running) return;
    if(spawnLock) return; spawnLock=true;

    try{
      var slot = takeSlot();
      if(!slot){ return; }
      // ตัดสินใจ good/bad
      var isGood = Math.random() < goodRate;
      var char = isGood ? pick(GOOD) : pick(BAD);
      var ttl = (difficulty==='easy') ? 2000 : (difficulty==='hard' ? 1100 : 1500);

      // แจ้งว่าเริ่มสปอว์นจริง
      if(!firstSpawned){ firstSpawned=true; allowMiss=true; emit('hha:spawn',{}); }

      var el = makeTarget(char, slot, ttl);
      if(host && el){ host.appendChild(el); active.add(el); }
    } finally { spawnLock=false; }
  }

  // main loop
  var lastSpawn = 0;
  var spawnGap = (difficulty==='easy') ? 600 : (difficulty==='hard' ? 380 : 480);
  function loop(){
    if(!running) return;
    var t = now();
    if(t - lastSpawn > spawnGap){
      lastSpawn = t;
      spawnOne();
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ส่งเวลาเป็นวินาที
  var sec = duration|0;
  var timer = setInterval(function(){
    if(!running) return;
    emit('hha:time', {sec:sec});
    if(sec>0) sec--;
    else { endGame(); }
  },1000);

  function endGame(){
    if(!running) return;
    running=false;
    try{ clearInterval(timer); }catch(e){}
    // เก็บกวาด
    try{ active.forEach(function(el){ if(el && el.parentNode) el.parentNode.removeChild(el); }); }catch(e){}
    active.clear();
    emit('hha:end', { score:score, comboMax:comboMax, miss:missCount });
  }

  var api = {
    stop: function(){ endGame(); },
    pause: function(){ running=false; },
    resume: function(){ if(!running){ running=true; requestAnimationFrame(loop); } }
  };

  return api;
}

export default { boot };
```0