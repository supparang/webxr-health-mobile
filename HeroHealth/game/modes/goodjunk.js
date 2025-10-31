// === Hero Health Academy — game/modes/goodjunk.js (2025-10-31 SAFE) ===
// โหมด: ดี vs ขยะ  (คลิก "ดี" ได้คะแนน/คอมโบ, คลิก "ขยะ" โดนโทษ)
// - รูปแบบ factory: export function create({engine,hud,coach})
// - ไม่ใช้ optional chaining, ไม่อ้าง DOM ตอน import
// - ใช้ #spawnHost ภายใน #gameLayer / .game-wrap
// - หมดอายุ: ถ้า "ดี" หมดอายุ => miss, ถ้า "ขยะ" หมดอายุ => ไม่ลงโทษ

export const name = 'goodjunk';

// ---- Safe FX bootstrap ------------------------------------------------------
(function ensureFX(){
  if (!window.HHA_FX) {
    window.HHA_FX = { add3DTilt:function(){}, shatter3D:function(){} };
    try {
      import('../core/fx.js').then(function(m){
        try { for (var k in m) window.HHA_FX[k] = m[k]; }catch(e){}
      }).catch(function(){});
    } catch(e){}
  }
})();

// ---- Pools ------------------------------------------------------------------
var GOOD = ['🥦','🥕','🍎','🍌','🥗','🐟','🥜','🍚','🍞','🥛','🍇','🍓','🍊','🍅','🥬','🥝','🍍','🍐','🍑','🫘'];
var JUNK = ['🍔','🍟','🌭','🍕','🍩','🍪','🍰','🧋','🥤','🍫','🍭','🧁','🥓','🥠','🍨','🍦','🧂','🧈','🍹','🍯'];

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }

function toast(msg){
  var el = document.getElementById('toast');
  if (!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function(){ try{ el.classList.remove('show'); }catch(e){} }, 900);
}

// ---- Factory ----------------------------------------------------------------
export function create(ctx){
  var engine = (ctx && ctx.engine) || {};
  var coach  = (ctx && ctx.coach)  || {};

  var host=null, layer=null;
  var state = {
    running:false,
    items:[],
    lang: ((localStorage.getItem('hha_lang')||'TH')+'').toUpperCase(),
    difficulty: (document.body.getAttribute('data-diff')||'Normal'),
    stats:{ good:0, perfect:0, bad:0, miss:0 },
    _spawnCd: 0
  };

  function start(){
    stop();
    host  = document.getElementById('spawnHost');
    layer = document.getElementById('gameLayer') || document.querySelector('.game-wrap');
    state.running = true;
    state.items.length = 0;
    state.stats = { good:0, perfect:0, bad:0, miss:0 };
    try{ if (coach && coach.onStart) coach.onStart(); }catch(e){}
    toast(state.lang==='EN' ? '🍃 Good vs Junk' : '🍃 ดี vs ขยะ');
  }

  function stop(){
    state.running = false;
    try{
      for (var i=0;i<state.items.length;i++){
        var it = state.items[i]; if (it && it.el && it.el.remove) it.el.remove();
      }
    }catch(e){}
    state.items.length = 0;
  }

  function pickMeta(){
    // 65% โอกาสเป็นของดี
    var isGood = Math.random() < 0.65;
    var char   = rnd(isGood ? GOOD : JUNK);
    var life   = clamp(1700 + ((Math.random()*800)|0), 700, 4500);
    // perfect โอกาสเล็กน้อย (หรือเร่งถ้าใกล้หมดเวลา)
    var perfectHint = Math.random() < 0.08;
    return { char:char, aria:(isGood?'Good':'Junk'), isGood:isGood, golden:perfectHint, life:life };
  }

  function onHit(meta, ui, Bus){
    var res = 'ok';
    if (meta.isGood){
      res = meta.golden ? 'perfect' : 'good';
      try{ if (engine && engine.sfx && engine.sfx.play) engine.sfx.play(res==='perfect'?'sfx-perfect':'sfx-good'); }catch(e){}
      var pts = res==='perfect'? 20 : 10;
      if (engine && engine.fx && engine.fx.popText){
        try{ engine.fx.popText('+'+pts+(res==='perfect'?' ✨':''), {x:ui.x,y:ui.y,ms:720}); }catch(e){}
      }
      if (Bus && Bus.hit) Bus.hit({ kind:res, points:pts, ui:ui, meta:meta });
      state.stats[res] = (state.stats[res]||0)+1;
      return res;
    } else {
      res='bad';
      var body = document.body;
      if (body && body.classList){ body.classList.add('flash-danger'); setTimeout(function(){ try{ body.classList.remove('flash-danger'); }catch(e){} }, 160); }
      try{ if (engine && engine.sfx && engine.sfx.play) engine.sfx.play('sfx-bad'); }catch(e){}
      if (Bus && Bus.miss) Bus.miss({ meta:meta });
      state.stats.bad++;
      return res;
    }
  }

  function spawnOne(rect, Bus){
    var m = pickMeta();
    var pad = 30;
    var w = rect ? rect.width  : (host && host.clientWidth  ? host.clientWidth  : 640);
    var h = rect ? rect.height : (host && host.clientHeight ? host.clientHeight : 360);
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

    var parent = host || document.getElementById('spawnHost') || document.body;
    parent.appendChild(b);

    var born = (performance && performance.now? performance.now() : Date.now());
    state.items.push({ el:b, born:born, life:m.life, meta:m });

    b.addEventListener('click', function(ev){
      if (!state.running) return;
      ev.stopPropagation();
      var ui = { x: ev.clientX||0, y: ev.clientY||0 };
      var res = onHit(m, ui, (engine && engine.Bus)? engine.Bus : null);
      if (res!=='bad'){
        try{ if (window.HHA_FX && window.HHA_FX.shatter3D) window.HHA_FX.shatter3D(ui.x, ui.y); }catch(e){}
      }
      try{ b.remove(); }catch(e){}
      for (var i=0;i<state.items.length;i++){
        if (state.items[i].el===b){ state.items.splice(i,1); break; }
      }
    }, false);
  }

  function update(dt, Bus){
    if (!state.running) return;

    var layerEl = layer || document.getElementById('gameLayer') || document.querySelector('.game-wrap');
    var rect = layerEl ? layerEl.getBoundingClientRect() : { width: 640, height: 360 };

    // spawn cadence (เร่งเล็กน้อยช่วงท้าย)
    if (typeof state._spawnCd !== 'number') state._spawnCd = 0.20;
    var timeLeftEl = document.getElementById('time');
    var timeLeft = 0;
    if (timeLeftEl && timeLeftEl.textContent) {
      var n = parseInt(timeLeftEl.textContent, 10);
      timeLeft = isFinite(n) ? n : 0;
    }
    var bias = timeLeft>0 && timeLeft<=15 ? 0.12 : 0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.40 - bias + Math.random()*0.22, 0.24, 0.95);
    }

    // expiry
    var now = performance && performance.now ? performance.now() : Date.now();
    var remain = [];
    for (var i=0;i<state.items.length;i++){
      var it = state.items[i];
      if (now - it.born > it.life){
        if (it.meta && it.meta.isGood && Bus && Bus.miss) Bus.miss({ meta:{ reason:'expire', good:true } });
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
