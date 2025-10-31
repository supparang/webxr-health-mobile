// === Hero Health Academy — game/modes/goodjunk.js (2025-10-31 safe build) ===
// - No optional chaining (รองรับ browser/WebView เก่า)
// - ไม่อ้าง DOM ตอนโหลดโมดูล (อ้างเฉพาะตอน create/start)
// - ใช้รูปแบบ factory { start, stop, update, cleanup } ให้เข้ากับ main.js
// - ป้องกัน element เป็น null และคำนวณพื้นที่ spawn อย่างปลอดภัย
// - ส่ง Bus.hit / Bus.miss เมื่อคลิก/หมดอายุ (เพื่อให้ HUD/Score ทำงาน)

export const name = 'goodjunk';

var GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🍆','🥬','🥝','🍍','🍐','🍑'];
var JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍬','🍭','🧈','🥓','🧃','🍮','🥟','🍨','🧇','🌮'];

function pick(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function ensurePlayfield(){
  var layer = document.getElementById('gameLayer');
  if(!layer){
    layer = document.createElement('section');
    layer.id = 'gameLayer';
    layer.style.position = 'relative';
    layer.style.minHeight = '360px';
    layer.style.overflow = 'hidden';
    document.body.appendChild(layer);
  }
  var host = document.getElementById('spawnHost');
  if(!host){
    host = document.createElement('div');
    host.id = 'spawnHost';
    host.style.position = 'absolute';
    host.style.inset = '0';
    layer.appendChild(host);
  }
  return { layer: layer, host: host };
}

function rectOf(el){
  if(el && el.getBoundingClientRect){
    var r = el.getBoundingClientRect();
    var w = (r.width|0), h = (r.height|0);
    if (w>0 && h>0) return { left:r.left, top:r.top, width:w, height:h };
  }
  // fallback (เช่นตอนยังไม่มี style)
  var vw = (document.documentElement && document.documentElement.clientWidth) ? document.documentElement.clientWidth : (window.innerWidth||800);
  var vh = (document.documentElement && document.documentElement.clientHeight)? document.documentElement.clientHeight: (window.innerHeight||600);
  return { left:0, top:0, width:vw, height:vh };
}

export function create(ctx){
  // ctx: { engine, hud, coach } (อาจว่างบางส่วนได้)
  var pf = ensurePlayfield();
  var host = pf.host;
  var layer = pf.layer;

  var state = {
    running: false,
    items: [],            // { el, born, life, good }
    spawnTimer: 0,
    loopId: 0
  };

  function spawnOne(){
    var area = rectOf(layer);
    var pad = 28;
    var x = Math.round(pad + Math.random() * Math.max(1, area.width  - pad*2));
    var y = Math.round(pad + Math.random() * Math.max(1, area.height - pad*2));

    var isGood = Math.random() < 0.62;
    var emoji = isGood ? pick(GOOD) : pick(JUNK);

    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'spawn-emoji';
    // หมายเหตุ: CSS มี transform translate(-50%,-50%) อยู่แล้ว
    b.style.left = String(x) + 'px';
    b.style.top  = String(y) + 'px';
    b.textContent = emoji;
    b.setAttribute('aria-label', isGood ? 'good' : 'junk');

    host.appendChild(b);

    var obj = {
      el: b,
      born: (performance && performance.now ? performance.now() : Date.now()),
      life: 1800 + Math.random()*900, // 1.8–2.7s
      good: isGood
    };
    state.items.push(obj);

    b.addEventListener('click', function(ev){
      if (!state.running) return;
      ev.stopPropagation();

      // basic SFX
      try {
        if (ctx && ctx.engine && ctx.engine.sfx) {
          if (isGood && ctx.engine.sfx.play) ctx.engine.sfx.play('sfx-good');
          else if (!isGood && ctx.engine.sfx.play) ctx.engine.sfx.play('sfx-bad');
        }
      } catch(_){}

      // แจ้ง Bus (ถ้ามี) ให้ระบบคะแนน/คอมโบ/ภารกิจทำงาน
      var ui = { x: ev.clientX||0, y: ev.clientY||0 };
      var bus = (ctx && ctx.engine && ctx.engine.Bus) ? ctx.engine.Bus : (ctx && ctx.Bus ? ctx.Bus : null);
      try{
        if (bus && bus.hit && isGood) bus.hit({ kind:'good', points:10, ui:ui, meta:{ good:true } });
        else if (bus && bus.miss && !isGood) bus.miss({ meta:{ good:false } });
      }catch(_){}

      // เอฟเฟกต์ danger flash ถ้าเป็นขยะ
      if (!isGood){
        try{
          document.body.classList.add('flash-danger');
          setTimeout(function(){ document.body.classList.remove('flash-danger'); }, 160);
        }catch(_){}
      }

      try{ b.remove(); }catch(_){}
      // remove จาก list
      for (var i=0;i<state.items.length;i++){
        if (state.items[i].el === b){ state.items.splice(i,1); break; }
      }
    });
  }

  function loop(){
    if (!state.running) return;

    // cadence spawn
    state.spawnTimer -= 16;
    if (state.spawnTimer <= 0){
      spawnOne();
      // เร็วขึ้นเล็กน้อยช่วงท้ายเวลา (ถ้ามี HUD#time)
      var tLeft = 0;
      var timeEl = document.getElementById('time');
      if (timeEl) {
        var v = parseInt(timeEl.textContent||'0',10);
        if (isFinite(v)) tLeft = v|0;
      }
      var bias = tLeft <= 15 ? 80 : 0;
      state.spawnTimer = 420 - Math.floor(Math.random()*120) - bias; // 300–420ms, ช่วงท้ายเร็วขึ้น
      state.spawnTimer = clamp(state.spawnTimer, 220, 900);
    }

    // expiry = นับเป็น miss เฉพาะชิ้นที่เป็น good (เพื่อความแฟร์)
    var now = (performance && performance.now ? performance.now() : Date.now());
    for (var j=state.items.length-1; j>=0; j--){
      var it = state.items[j];
      if (now - it.born > it.life){
        try{ it.el.remove(); }catch(_){}
        state.items.splice(j,1);
        if (it.good){
          var bus = (ctx && ctx.engine && ctx.engine.Bus) ? ctx.engine.Bus : (ctx && ctx.Bus ? ctx.Bus : null);
          try{ if (bus && bus.miss) bus.miss({ meta:{ reason:'expire', good:true } }); }catch(_){}
        }
      }
    }

    state.loopId = window.requestAnimationFrame(loop);
  }

  function start(){
    // ล้างเดิม
    stop();

    // เปิดการเล่น
    state.running = true;
    state.spawnTimer = 0;

    // แจ้งโค้ช/ระบบ
    try{ if (ctx && ctx.coach && ctx.coach.onStart) ctx.coach.onStart(); }catch(_){}

    // เริ่มลูป
    state.loopId = window.requestAnimationFrame(loop);
  }

  function stop(){
    state.running = false;
    if (state.loopId){ try{ window.cancelAnimationFrame(state.loopId); }catch(_){} state.loopId = 0; }
    // เคลียร์ปุ่มค้าง
    try{
      var all = host.getElementsByClassName('spawn-emoji');
      // HTMLCollection → live: ลบจากหัวท้าย
      while(all.length){ try{ all[0].remove(); }catch(_){ break; } }
    }catch(_){}
    state.items.length = 0;
  }

  function cleanup(){ stop(); }

  return { start: start, stop: stop, update: function(){}, cleanup: cleanup };
}
