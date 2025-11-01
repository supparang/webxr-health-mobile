// === Hero Health Academy — game/modes/hydration.js (2025-11-01 ULTRA-SAFE, unified) ===
// โหมด: Hydration (รักษาค่า 45–65%)
// - คลิก 💧/🚰/🧊 เพิ่มค่าไฮเดรชัน, หลีกเลี่ยง 🥤/🧋/🍺/☕/🍷 ที่จะลดค่า
// - แสดงแถบ bar/label เมื่อมี #hydroWrap #hydroBar #hydroLabel
// - ไม่มี optional chaining / dynamic import, ทำงานเต็มจอ และเชื่อม bus.hit / bus.miss

export const name = 'hydration';

// --- Minimal FX guard (ไม่พังแม้ core/fx ไม่โหลด) ---
(function ensureFX(){
  if (!window.HHA_FX){
    window.HHA_FX = {
      add3DTilt: function(el){
        try{
          if (!el || !el.style) return;
          el.style.transform = 'translate(-50%,-50%) rotateX(6deg) rotateY(-4deg)';
          el.addEventListener('pointermove', function(e){
            try{
              var r = el.getBoundingClientRect();
              var cx = (e.clientX - (r.left + r.width/2)) / Math.max(1, r.width/2);
              var cy = (e.clientY - (r.top  + r.height/2)) / Math.max(1, r.height/2);
              el.style.transform = 'translate(-50%,-50%) rotateX(' + (-cy*10) + 'deg) rotateY(' + (cx*12) + 'deg)';
            }catch(_e){}
          }, false);
          el.addEventListener('pointerleave', function(){
            try{ el.style.transform = 'translate(-50%,-50%)'; }catch(_e){}
          }, false);
        }catch(_e){}
      },
      shatter3D: function(x, y){
        try{
          for (var i=0;i<10;i++){
            var p=document.createElement('div');
            p.textContent='✦';
            p.style.position='fixed';
            p.style.left = String(x)+'px';
            p.style.top  = String(y)+'px';
            p.style.transform='translate(-50%,-50%)';
            p.style.fontWeight='900';
            p.style.fontSize='16px';
            p.style.color='#bde7ff';
            p.style.textShadow='0 2px 8px rgba(0,0,0,.35)';
            p.style.transition='transform .6s, opacity .6s';
            p.style.opacity='1';
            p.style.zIndex='120';
            document.body.appendChild(p);
            (function(node){
              var dx=(Math.random()-.5)*60, dy=(Math.random()-.5)*40, sc=0.6+Math.random()*0.6;
              setTimeout(function(){
                try{
                  node.style.transform='translate(calc(-50% + '+dx+'px), calc(-50% + '+dy+'px)) scale('+sc+')';
                  node.style.opacity='0';
                }catch(_e){}
              }, 0);
              setTimeout(function(){ try{ node.parentNode && node.parentNode.removeChild(node); }catch(_e2){} }, 620);
            })(p);
          }
        }catch(_e){}
      }
    };
  }
})();

// --- Pools / Utils ---
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

// --- Factory for main.js ---
export function create(ctx){
  var engine = (ctx && ctx.engine) ? ctx.engine : {};
  var coach  = (ctx && ctx.coach)  ? ctx.coach  : {};

  var host=null, layer=null;
  var state = {
    running:false, items:[], _spawnCd:0.22,
    hyd: 50, // %
    lang:'TH', difficulty:'Normal',
    stats:{good:0,perfect:0,bad:0,miss:0}
  };

  function start(){
    stop();
    host  = document.getElementById('spawnHost');
    if (!host){
      host = document.createElement('div');
      host.id = 'spawnHost';
      host.style.position='fixed';
      host.style.inset='0';
      host.style.pointerEvents='auto';
      host.style.zIndex='5';
      document.body.appendChild(host);
    }
    layer = document.getElementById('gameLayer');
    if(!layer) layer=document.querySelector('.game-wrap');

    try{ var L=localStorage.getItem('hha_lang'); state.lang = L?String(L).toUpperCase():'TH'; }catch(_e){ state.lang='TH'; }
    try{ var d=document.body.getAttribute('data-diff'); state.difficulty=d||'Normal'; }catch(_e){ state.difficulty='Normal'; }

    state.running=true; state.items.length=0; state.hyd=50;
    setHydroUI(state.hyd);
    try{ if (coach && coach.onStart) coach.onStart(); }catch(_e){}
  }

  function stop(){
    state.running=false;
    try{
      for (var i=0;i<state.items.length;i++){
        var it=state.items[i];
        if (it && it.el && it.el.remove) it.el.remove();
      }
    }catch(_e){}
    state.items.length=0;
  }

  function pickMeta(){
    var isGood = Math.random() < 0.72; // น้ำดีโผล่มากกว่า
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
    try{
      if (engine.sfx && engine.sfx.play)
        engine.sfx.play(res==='bad'?'sfx-bad':(res==='perfect'?'sfx-perfect':'sfx-good'));
    }catch(_e){}
    try{
      if (engine.fx && engine.fx.popText)
        engine.fx.popText((delta>0?'+':'')+String(delta)+'%', {x:ui.x,y:ui.y,ms:720});
    }catch(_e){}

    if (res==='bad'){
      try{ if (Bus && Bus.miss) Bus.miss({meta:meta}); }catch(_e){}
    } else {
      try{ if (Bus && Bus.hit) Bus.hit({ kind:res, points:(res==='perfect'?20:10), ui:ui, meta:meta }); }catch(_e){}
      try{ if (window.HHA_FX && window.HHA_FX.shatter3D) window.HHA_FX.shatter3D(ui.x, ui.y); }catch(_e){}
    }

    // โค้ชเตือนเมื่อออกนอกช่วง 45–65
    if (state.hyd<45 || state.hyd>65){
      try{ if (coach && coach.onBad) coach.onBad(); }catch(_e){}
    } else {
      try{ if (coach && coach.onGood) coach.onGood(); }catch(_e){}
    }
    return res;
  }

  function spawnOne(rect, Bus){
    var m = pickMeta();
    var pad=30;

    // ใช้กรอบ layer ถ้ามี ไม่อย่างนั้นเต็มจอ
    var w = rect ? rect.width  : (host && host.clientWidth  ? host.clientWidth  : (window.innerWidth||640));
    var h = rect ? rect.height : (host && host.clientHeight ? host.clientHeight : (window.innerHeight||360));

    // กัน HUD ล่าง (power bar) ~120px
    var hSafe = Math.max(180, h - 120);

    var x = Math.round(pad + Math.random()*(Math.max(1,w)-pad*2));
    var y = Math.round(pad + Math.random()*(Math.max(1,hSafe)-pad*2));

    var b = document.createElement('button');
    b.className='spawn-emoji';
    b.type='button';
    b.style.position='absolute';
    b.style.border='0';
    b.style.background='transparent';

    // ขนาดตามความยาก
    var fs = 40;
    if (state.difficulty==='Easy') fs = 46;
    else if (state.difficulty==='Hard') fs = 34;

    b.style.fontSize = String(fs)+'px';
    b.style.left=String(x)+'px';
    b.style.top =String(y)+'px';
    b.style.transform='translate(-50%,-50%)';
    b.style.filter='drop-shadow(0 3px 6px rgba(0,0,0,.45))';
    b.textContent = m.char;
    b.setAttribute('aria-label', m.aria);
    if (m.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';

    try{ if (window.HHA_FX && window.HHA_FX.add3DTilt) window.HHA_FX.add3DTilt(b); }catch(_e){}

    var parent = host || document.getElementById('spawnHost') || document.body;
    parent.appendChild(b);

    var born = (typeof performance!=='undefined' && performance && performance.now) ? performance.now() : Date.now();
    state.items.push({el:b,born:born,life:m.life,meta:m});

    b.addEventListener('click', function(ev){
      if (!state.running) return;
      ev.stopPropagation();
      var ui={x:(ev.clientX||0), y:(ev.clientY||0)};
      var r=onHit(m, ui, Bus);
      try{ b.parentNode && b.parentNode.removeChild(b); }catch(_e2){}
      // remove from items
      var ii;
      for (ii=0; ii<state.items.length; ii++){ if (state.items[ii].el===b){ state.items.splice(ii,1); break; } }
    }, false);
  }

  function update(dt, Bus){
    if (!state.running) return;

    var layerEl = layer || document.getElementById('gameLayer') || document.querySelector('.game-wrap');
    var rect = null;
    try{ if (layerEl && layerEl.getBoundingClientRect) rect = layerEl.getBoundingClientRect(); }catch(_e){}
    if (!rect){
      rect = { width:(window.innerWidth||640), height:(window.innerHeight||360) };
    }

    // ช่วงท้ายเวลา spawn เร็วขึ้นเล็กน้อย (อ่านจาก #time ถ้ามี)
    var tEl=document.getElementById('time'), tLeft=0;
    try{
      if (tEl && tEl.textContent){
        var n=parseInt(tEl.textContent,10);
        if (isFinite(n)) tLeft = n;
      }
    }catch(_e){}
    var bias=(tLeft>0 && tLeft<=15)?0.12:0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      // ความเร็วสแปวน์แปรผันตามความยากเล็กน้อย
      var base = 0.42;
      if (state.difficulty==='Easy') base = 0.48;
      else if (state.difficulty==='Hard') base = 0.36;
      state._spawnCd = Math.max(0.24, base - bias + Math.random()*0.22);
    }

    // life timeout / cleanup
    var now=(typeof performance!=='undefined' && performance && performance.now)?performance.now():Date.now();
    var keep=[], i, it;
    for (i=0;i<state.items.length;i++){
      it=state.items[i];
      if (now - it.born > it.life){
        try{ it.el && it.el.parentNode && it.el.parentNode.removeChild(it.el); }catch(_e3){}
      } else keep.push(it);
    }
    state.items=keep;
  }

  function cleanup(){ stop(); }

  return { start:start, stop:stop, update:update, cleanup:cleanup };
}

// Default export for dynamic import style
export default { create, name };
