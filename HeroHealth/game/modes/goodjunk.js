// === Hero Health Academy — game/modes/goodjunk.js (2025-10-31 ULTRA-SAFE) ===
// โหมด: ดี vs ขยะ (Good vs Junk)
// - ไม่มี optional chaining
// - ไม่มี dynamic import
// - ไม่อ้าง DOM ตอน import (ทุกอย่างทำใน start/update เท่านั้น)
// - ให้ทั้ง named export (create/name) และ default export (compat)

export const name = 'goodjunk';

// FX fallback (ไม่โหลดไฟล์ใด ๆ เพิ่ม)
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = {
      add3DTilt: function(){},
      shatter3D: function(){}
    };
  }
})();

// --------- Pools ---------
var GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑','🫘'];
var JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🧁','🥓','🥠','🍨','🍦','🧂','🧈','🍹','🍯'];

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }

function ensureToast(){
  var el = document.getElementById('toast');
  if (!el){
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  return el;
}
function toast(msg){
  var el = ensureToast();
  el.textContent = msg;
  if (el.classList && el.classList.add) el.classList.add('show');
  setTimeout(function(){
    try { el.classList.remove('show'); } catch(e){}
  }, 900);
}

// --------- Factory ---------
export function create(ctx){
  var engine = (ctx && ctx.engine) ? ctx.engine : {};
  var coach  = (ctx && ctx.coach)  ? ctx.coach  : {};

  var host=null, layer=null;
  var state = {
    running:false,
    items:[],
    lang: 'TH',
    difficulty: 'Normal',
    stats:{ good:0, perfect:0, bad:0, miss:0 },
    _spawnCd: 0
  };

  function start(){
    stop(); // clear remains

    // resolve elements just-in-time
    host  = document.getElementById('spawnHost');
    layer = document.getElementById('gameLayer');
    if (!layer){
      // รองรับ index รุ่นก่อนที่ใช้ .game-wrap
      layer = document.querySelector('.game-wrap');
    }

    state.running = true;
    state.items.length = 0;
    state.stats = { good:0, perfect:0, bad:0, miss:0 };

    // lang/diff from body (มีหรือไม่มีก็ไม่ล้ม)
    try {
      var L = localStorage.getItem('hha_lang');
      if (L && typeof L === 'string') state.lang = L.toUpperCase();
      else state.lang = 'TH';
    } catch(e){ state.lang = 'TH'; }

    try {
      var d = document.body ? document.body.getAttribute('data-diff') : null;
      state.difficulty = d || 'Normal';
    } catch(e){ state.difficulty = 'Normal'; }

    try{ if (coach && coach.onStart) coach.onStart(); }catch(e){}
    toast(state.lang==='EN' ? '🍃 Good vs Junk' : '🍃 ดี vs ขยะ');
  }

  function stop(){
    state.running = false;
    try{
      for (var i=0;i<state.items.length;i++){
        var it = state.items[i];
        if (it && it.el && it.el.remove) it.el.remove();
      }
    }catch(e){}
    state.items.length = 0;
  }

  function pickMeta(){
    // 65% good
    var isGood = Math.random() < 0.65;
    var char   = rnd(isGood ? GOOD : JUNK);
    var life   = clamp(1600 + ((Math.random()*900)|0), 700, 4500);
    var perfectHint = Math.random() < 0.08;
    return { char:char, aria:(isGood?'Good':'Junk'), isGood:isGood, golden:perfectHint, life:life };
  }

  function onHit(meta, ui, Bus){
    var res;
    if (meta.isGood){
      res = meta.golden ? 'perfect' : 'good';
      try{ if (engine && engine.sfx && engine.sfx.play) engine.sfx.play(res==='perfect'?'sfx-perfect':'sfx-good'); }catch(e){}
      var pts = res==='perfect'? 20 : 10;
      try{
        if (engine && engine.fx && engine.fx.popText){
          engine.fx.popText('+'+pts+(res==='perfect'?' ✨':''), { x:ui.x, y:ui.y, ms:720 });
        }
      }catch(e){}
      try{ if (Bus && Bus.hit) Bus.hit({ kind:res, points:pts, ui:ui, meta:meta }); }catch(e){}
      state.stats[res] = (state.stats[res]||0)+1;
    } else {
      res = 'bad';
      try{
        var body = document.body;
        if (body && body.classList){ body.classList.add('flash-danger'); setTimeout(function(){ body.classList.remove('flash-danger'); }, 160); }
      }catch(e){}
      try{ if (engine && engine.sfx && engine.sfx.play) engine.sfx.play('sfx-bad'); }catch(e){}
      try{ if (Bus && Bus.miss) Bus.miss({ meta:meta }); }catch(e){}
      state.stats.bad++;
    }
    return res;
  }

  function spawnOne(rect, Bus){
    var m = pickMeta();
    var pad = 30;

    var w = 640, h = 360;
    if (rect && typeof rect.width === 'number') w = rect.width;
    else if (host && host.clientWidth) w = host.clientWidth;

    if (rect && typeof rect.height === 'number') h = rect.height;
    else if (host && host.clientHeight) h = host.clientHeight;

    var x = Math.round(pad + Math.random()*(Math.max(1,w) - pad*2));
    var y = Math.round(pad + Math.random()*(Math.max(1,h) - pad*2));

    var b = document.createElement('button');
    b.className = 'spawn-emoji';
    b.type = 'button';
    b.style.left = String(x)+'px';
    b.style.top  = String(y)+'px';
    b.textContent = m.char;
    b.setAttribute('aria-label', m.aria);
    if (m.golden) b.style.filter = 'drop-shadow(0 0 10px rgba(255,215,0,.85))';

    try{ if (window.HHA_FX && window.HHA_FX.add3DTilt) window.HHA_FX.add3DTilt(b); }catch(e){}

    // ป้องกัน host เป็น null
    var parent = host;
    if (!parent) parent = document.getElementById('spawnHost');
    if (!parent) parent = document.body;
    parent.appendChild(b);

    var born = (typeof performance !== 'undefined' && performance && performance.now) ? performance.now() : Date.now();
    state.items.push({ el:b, born:born, life:m.life, meta:m });

    b.addEventListener('click', function(ev){
      if (!state.running) return;
      ev.stopPropagation();
      var ui = { x: ev.clientX||0, y: ev.clientY||0 };
      var res = onHit(m, ui, (engine && engine.Bus) ? engine.Bus : null);
      if (res !== 'bad'){
        try{ if (window.HHA_FX && window.HHA_FX.shatter3D) window.HHA_FX.shatter3D(ui.x, ui.y); }catch(e){}
      }
      try{ b.remove(); }catch(e){}
      // remove from list
      var i, N = state.items.length;
      for (i=0;i<N;i++){ if (state.items[i].el === b){ state.items.splice(i,1); break; } }
    }, false);
  }

  function update(dt, Bus){
    if (!state.running) return;

    var layerEl = layer;
    if (!layerEl) layerEl = document.getElementById('gameLayer');
    if (!layerEl) layerEl = document.querySelector('.game-wrap');

    var rect = { width:640, height:360 };
    try{
      if (layerEl && layerEl.getBoundingClientRect) rect = layerEl.getBoundingClientRect();
    }catch(e){}

    // spawn cadence (เร่งเล็กน้อยช่วงท้ายเกม)
    if (typeof state._spawnCd !== 'number') state._spawnCd = 0.20;
    var timeLeft = 0;
    try{
      var timeEl = document.getElementById('time');
      if (timeEl && timeEl.textContent){
        var n = parseInt(timeEl.textContent, 10);
        if (isFinite(n)) timeLeft = n;
      }
    }catch(e){}
    var bias = (timeLeft>0 && timeLeft<=15) ? 0.12 : 0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.40 - bias + Math.random()*0.22, 0.24, 0.95);
    }

    // expiry check
    var now = (typeof performance !== 'undefined' && performance && performance.now) ? performance.now() : Date.now();
    var remain = [];
    var i, it;
    for (i=0;i<state.items.length;i++){
      it = state.items[i];
      if (now - it.born > it.life){
        try{
          if (it.meta && it.meta.isGood && Bus && Bus.miss) Bus.miss({ meta:{ reason:'expire', good:true } });
        }catch(e){}
        try{ it.el.remove(); }catch(e){}
      } else {
        remain.push(it);
      }
    }
    state.items = remain;
  }

  function cleanup(){ stop(); }

  return { start:start, stop:stop, update:update, cleanup:cleanup };
}

// default export (เพื่อความเข้ากันได้สูงสุด)
export default { create:create, name:name };
