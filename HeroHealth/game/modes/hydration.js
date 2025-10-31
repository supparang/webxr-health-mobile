// === Hero Health Academy — game/modes/hydration.js (2025-10-31 ULTRA-SAFE) ===
// โหมด: Hydration (รักษาค่า 45–65%)
// - คลิก 💧/🥤 เพิ่ม-ลด ค่าไฮเดรชัน
// - แสดง bar/label เมื่อมี #hydroWrap #hydroBar #hydroLabel

export const name = 'hydration';

(function ensureFX(){
  if (!window.HHA_FX){
    window.HHA_FX = { add3DTilt:function(){}, shatter3D:function(){} };
  }
})();

var GOOD = ['💧','🚰','🧊'];
var BAD  = ['🥤','🧋','🍺','☕','🍷'];

function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }

function setHydroUI(p){
  var wrap = document.getElementById('hydroWrap');
  var bar  = document.getElementById('hydroBar');
  var lab  = document.getElementById('hydroLabel');
  if (wrap && wrap.style) wrap.style.display = 'block';
  if (bar  && bar.style)  bar.style.width = String(clamp(p,0,100)) + '%';
  if (lab) lab.textContent = String(p|0) + '%';
}

export function create(ctx){
  var engine = (ctx && ctx.engine) ? ctx.engine : {};
  var coach  = (ctx && ctx.coach)  ? ctx.coach  : {};

  var host=null, layer=null;
  var state = {
    running:false, items:[], _spawnCd:0,
    hyd: 50, // %
    lang:'TH', difficulty:'Normal',
    stats:{good:0,perfect:0,bad:0,miss:0}
  };

  function start(){
    stop();
    host  = document.getElementById('spawnHost');
    layer = document.getElementById('gameLayer'); if(!layer) layer=document.querySelector('.game-wrap');

    try{ var L=localStorage.getItem('hha_lang'); state.lang = L?L.toUpperCase():'TH'; }catch(e){ state.lang='TH'; }
    try{ var d=document.body.getAttribute('data-diff'); state.difficulty=d||'Normal'; }catch(e){ state.difficulty='Normal'; }

    state.running=true; state.items.length=0; state.hyd=50;
    setHydroUI(state.hyd);
    try{ if (coach && coach.onStart) coach.onStart(); }catch(e){}
  }

  function stop(){
    state.running=false;
    try{ for (var i=0;i<state.items.length;i++){ var it=state.items[i]; if (it && it.el && it.el.remove) it.el.remove(); } }catch(e){}
    state.items.length=0;
  }

  function pickMeta(){
    var isGood = Math.random() < 0.7; // น้ำดีโผล่มากกว่า
    var char   = rnd(isGood?GOOD:BAD);
    var life   = clamp(1600 + ((Math.random()*900)|0), 700, 4500);
    var golden = isGood && Math.random()<0.07;
    return { char:char, aria:(isGood?'GoodWater':'BadDrink'), isGood:isGood, golden:golden, life:life };
  }

  function onHit(meta, ui, Bus){
    var delta = 0;
    if (meta.isGood) delta = meta.golden ? +8 : +5;
    else             delta = -7;

    state.hyd = clamp(state.hyd + delta, 0, 100);
    setHydroUI(state.hyd);

    var res = meta.isGood ? (meta.golden ? 'perfect':'good') : 'bad';
    try{ if (engine.sfx && engine.sfx.play) engine.sfx.play(res==='bad'?'sfx-bad':(res==='perfect'?'sfx-perfect':'sfx-good')); }catch(e){}
    try{ if (engine.fx && engine.fx.popText) engine.fx.popText((delta>0?'+':'')+String(delta)+'%', {x:ui.x,y:ui.y,ms:720}); }catch(e){}

    if (res==='bad'){ try{ if (Bus && Bus.miss) Bus.miss({meta:meta}); }catch(e){} }
    else { try{ if (Bus && Bus.hit) Bus.hit({ kind:res, points:(res==='perfect'?20:10), ui:ui, meta:meta }); }catch(e){} }

    // โค้ชเตือนเมื่อออกนอกช่วง 45–65
    if (state.hyd<45 || state.hyd>65){ try{ if (coach && coach.onBad) coach.onBad(); }catch(e){} }
    else { try{ if (coach && coach.onGood) coach.onGood(); }catch(e){} }

    return res;
  }

  function spawnOne(rect, Bus){
    var m = pickMeta();
    var pad=30;
    var w = rect ? rect.width  : (host && host.clientWidth  ? host.clientWidth  : 640);
    var h = rect ? rect.height : (host && host.clientHeight ? host.clientHeight : 360);
    var x = Math.round(pad + Math.random()*(Math.max(1,w)-pad*2));
    var y = Math.round(pad + Math.random()*(Math.max(1,h)-pad*2));

    var b = document.createElement('button');
    b.className='spawn-emoji'; b.type='button';
    b.style.left=String(x)+'px'; b.style.top=String(y)+'px';
    b.textContent = m.char; b.setAttribute('aria-label', m.aria);
    if (m.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';
    try{ if (window.HHA_FX && window.HHA_FX.add3DTilt) window.HHA_FX.add3DTilt(b); }catch(e){}

    var parent = host || document.getElementById('spawnHost') || document.body;
    parent.appendChild(b);

    var born = (typeof performance!=='undefined' && performance && performance.now) ? performance.now() : Date.now();
    state.items.push({el:b,born:born,life:m.life,meta:m});

    b.addEventListener('click', function(ev){
      if (!state.running) return;
      ev.stopPropagation();
      var ui={x:ev.clientX||0,y:ev.clientY||0};
      var r=onHit(m, ui, (engine && engine.Bus)? engine.Bus : null);
      if (r!=='bad'){ try{ if (window.HHA_FX && window.HHA_FX.shatter3D) window.HHA_FX.shatter3D(ui.x, ui.y); }catch(e){} }
      try{ b.remove(); }catch(e){}
      for (var i=0;i<state.items.length;i++){ if (state.items[i].el===b){ state.items.splice(i,1); break; } }
    }, false);
  }

  function update(dt, Bus){
    if (!state.running) return;
    var layerEl = layer || document.getElementById('gameLayer') || document.querySelector('.game-wrap');
    var rect = { width:640, height:360 };
    try{ if (layerEl && layerEl.getBoundingClientRect) rect = layerEl.getBoundingClientRect(); }catch(e){}

    if (typeof state._spawnCd !== 'number') state._spawnCd = 0.22;
    var tEl=document.getElementById('time'), tLeft=0;
    try{ if (tEl && tEl.textContent){ var n=parseInt(tEl.textContent,10); if (isFinite(n)) tLeft=n; } }catch(e){}
    var bias=(tLeft>0 && tLeft<=15)?0.12:0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      state._spawnCd = Math.max(0.26, 0.42 - bias + Math.random()*0.22);
    }

    var now=(typeof performance!=='undefined' && performance && performance.now)?performance.now():Date.now();
    var keep=[]; for (var i=0;i<state.items.length;i++){
      var it=state.items[i];
      if (now - it.born > it.life){ try{ it.el.remove(); }catch(e){} }
      else keep.push(it);
    }
    state.items=keep;
  }

  function cleanup(){ stop(); }

  return { start:start, stop:stop, update:update, cleanup:cleanup };
}

export default { create:create, name:name };
