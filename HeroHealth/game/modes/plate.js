// === Hero Health Academy — game/modes/plate.js (2025-10-31 ULTRA-SAFE, unified) ===
// โหมด: Healthy Plate (เติมให้ครบโควตาแต่ละหมวด)
// - แสดงแถบโควตาที่ #plateTracker #platePills เมื่อมี
// - ไม่มี optional chaining / dynamic import
// - รองรับ main.js แบบ factory: export default { create, name }

export const name = 'plate';

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
            var dx=(Math.random()-.5)*60, dy=(Math.random()-.5)*40, sc=0.6+Math.random()*0.6;
            (function(node,dx_,dy_,sc_){
              setTimeout(function(){
                try{
                  node.style.transform='translate(calc(-50% + '+dx_+'px), calc(-50% + '+dy_+'px)) scale('+sc_+')';
                  node.style.opacity='0';
                }catch(_e){}
              }, 0);
              setTimeout(function(){ try{ node.parentNode && node.parentNode.removeChild(node); }catch(_e2){} }, 620);
            })(p,dx,dy,sc);
          }
        }catch(_e){}
      }
    };
  }
})();

// --- Game Data ---
var GROUPS = ['veggies','fruits','grains','protein','dairy'];
var POOL = {
  veggies:['🥦','🥕','🥬','🌽','🍅','🍆','🥒','🧅','🍄','🌶️'],
  fruits :['🍎','🍌','🍇','🍓','🍊','🍍','🍉','🍑','🍐','🥭'],
  grains :['🍚','🍞','🥖','🍝','🍜','🥯','🥪','🥞','🫓','🌯'],
  protein:['🍗','🥩','🍳','🐟','🍤','🧆','🫘','🥜','🧀','🍣'],
  dairy  :['🥛','🧀','🍦','🍨','🍧','🥛','🧀','🍨','🍦','🥛']
};

// --- Utils ---
function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function L(lang){
  var TH={veggies:'ผัก',fruits:'ผลไม้',grains:'ธัญพืช',protein:'โปรตีน',dairy:'นม',done:'จัดจานครบ!'};
  var EN={veggies:'Veggies',fruits:'Fruits',grains:'Grains',protein:'Protein',dairy:'Dairy',done:'Plate Complete!'};
  return (String(lang).toUpperCase()==='EN')?EN:TH;
}
function quotas(d){
  if (d==='Easy') return {veggies:4,fruits:3,grains:2,protein:2,dairy:1};
  if (d==='Hard') return {veggies:6,fruits:4,grains:3,protein:3,dairy:1};
  return {veggies:5,fruits:3,grains:2,protein:2,dairy:1};
}
function renderHUD(state){
  var host = document.getElementById('platePills');
  var wrap = document.getElementById('plateTracker');
  if (wrap && wrap.style) wrap.style.display = 'block';
  if (!host) return;

  var lang = L(state.lang);
  var html='', i, g, have, need, pct;
  for (i=0;i<GROUPS.length;i++){
    g=GROUPS[i]; have=state.have[g]||0; need=state.need[g]||0;
    pct = need>0 ? clamp((have/need)*100, 0, 100) : 0;
    html += '<div class="pill '+(have>=need?'ok':'')+'">' +
              '<b>'+lang[g]+'</b>' +
              '<span>'+have+'/'+need+'</span>' +
              '<i style="display:inline-block;height:6px;width:'+pct+'%;background:#2dd4bf;border-radius:999px;margin-left:6px"></i>' +
            '</div>';
  }
  host.innerHTML = html;
}

// --- Factory for main.js ---
export function create(ctx){
  var engine = (ctx && ctx.engine) ? ctx.engine : {};
  var coach  = (ctx && ctx.coach)  ? ctx.coach  : {};

  var host=null, layer=null;
  var state = {
    running:false, items:[], _spawnCd:0.20,
    lang:'TH', difficulty:'Normal',
    need:quotas('Normal'),
    have:{veggies:0,fruits:0,grains:0,protein:0,dairy:0},
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

    try{ var Ls=localStorage.getItem('hha_lang'); state.lang = Ls?String(Ls).toUpperCase():'TH'; }catch(_e){ state.lang='TH'; }
    try{ var d=document.body.getAttribute('data-diff'); state.difficulty=d||'Normal'; }catch(_e){ state.difficulty='Normal'; }
    state.need = quotas(state.difficulty);
    state.have = {veggies:0,fruits:0,grains:0,protein:0,dairy:0};

    renderHUD(state);

    state.running=true; state.items.length=0; state.stats={good:0,perfect:0,bad:0,miss:0};
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

  function lacking(){
    var out=[], i, g;
    for (i=0;i<GROUPS.length;i++){
      g=GROUPS[i];
      if ((state.have[g]||0) < (state.need[g]||0)) out.push(g);
    }
    return out;
  }

  function pickMeta(){
    var lack = lacking();
    var g = (lack.length>0 && Math.random()<0.75) ? lack[(Math.random()*lack.length)|0] : GROUPS[(Math.random()*GROUPS.length)|0];
    var ch = rnd(POOL[g]);
    var life = clamp(1700 + ((Math.random()*900)|0), 700, 4500);
    var golden = Math.random()<0.08;
    var within = (state.have[g]||0) < (state.need[g]||0);
    return { char:ch, aria:g, groupId:g, within:within, golden:golden, life:life };
  }

  function plateDone(){
    var i,g;
    for (i=0;i<GROUPS.length;i++){ g=GROUPS[i]; if ((state.have[g]||0) < (state.need[g]||0)) return false; }
    return true;
  }

  function onHit(meta, ui, Bus){
    if (meta.within){
      state.have[meta.groupId] = (state.have[meta.groupId]||0) + 1;
      renderHUD(state);

      var res = meta.golden ? 'perfect' : 'good';
      try{ if (engine.sfx && engine.sfx.play) engine.sfx.play(res==='perfect'?'sfx-perfect':'sfx-good'); }catch(_e){}
      try{ if (engine.fx && engine.fx.popText) engine.fx.popText('+'+(res==='perfect'?20:10)+(res==='perfect'?' ✨':''), {x:ui.x,y:ui.y,ms:720}); }catch(_e){}
      try{ if (Bus && Bus.hit) Bus.hit({kind:res,points:(res==='perfect'?20:10),ui:ui,meta:meta}); }catch(_e){}

      if (plateDone()){
        var line = document.getElementById('missionLine');
        if (line){
          line.style.display='block';
          line.textContent = (String(state.lang).toUpperCase()==='EN' ? '🍽️ Plate Complete!' : '🍽️ จัดจานครบ!');
          (function(el){ setTimeout(function(){ try{ el.style.display='none'; }catch(_e2){} }, 900); })(line);
        }
        try{ if (engine.sfx && engine.sfx.play) engine.sfx.play('sfx-perfect'); }catch(_e){}
        // รอบถัดไป: เพิ่มโควตาเล็กน้อย
        var base = quotas(state.difficulty);
        state.need = { veggies:base.veggies+1, fruits:base.fruits+1, grains:base.grains, protein:base.protein, dairy:base.dairy };
        state.have = { veggies:0, fruits:0, grains:0, protein:0, dairy:0 };
        renderHUD(state);
      }
      return res;
    } else {
      // overfill → โทษเบา ๆ
      try{
        if (document.body && document.body.classList){
          document.body.classList.add('flash-danger');
          setTimeout(function(){ document.body.classList.remove('flash-danger'); }, 160);
        }
      }catch(_e){}
      try{ if (engine.sfx && engine.sfx.play) engine.sfx.play('sfx-bad'); }catch(_e){}
      try{ if (Bus && Bus.miss) Bus.miss({meta:meta}); }catch(_e){}
      return 'bad';
    }
  }

  function spawnOne(rect, Bus){
    var m = pickMeta();
    var pad = 30;
    var w = rect ? rect.width  : (host && host.clientWidth  ? host.clientWidth  : window.innerWidth||640);
    var h = rect ? rect.height : (host && host.clientHeight ? host.clientHeight : window.innerHeight||360);
    // กันชน HUD ล่างเล็กน้อย (เผื่อ power bar)
    var hSafe = Math.max(180, h - 120);

    var x = Math.round(pad + Math.random()*(Math.max(1,w) - pad*2));
    var y = Math.round(pad + Math.random()*(Math.max(1,hSafe) - pad*2));

    var b = document.createElement('button');
    b.className='spawn-emoji';
    b.type='button';
    b.style.position='absolute';
    b.style.border='0';
    b.style.background='transparent';
    b.style.fontSize='40px';
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
      var r=onHit(m, ui, (engine && engine.Bus)? engine.Bus : Bus);
      if (r!=='bad'){
        try{ if (window.HHA_FX && window.HHA_FX.shatter3D) window.HHA_FX.shatter3D(ui.x, ui.y); }catch(_e){}
      }
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

    // ปรับ rate ให้เร็วขึ้นเล็กน้อยช่วงท้ายเวลา (อ่านจาก #time ถ้ามี)
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
      state._spawnCd = clamp(0.40 - bias + Math.random()*0.22, 0.26, 0.95);
    }

    // life timeout / miss
    var now=(typeof performance!=='undefined' && performance && performance.now)?performance.now():Date.now();
    var keep=[], i, it;
    for (i=0;i<state.items.length;i++){
      it=state.items[i];
      if (now - it.born > it.life){
        // นับ miss เฉพาะของที่ยังขาดโควตาเท่านั้น
        if (it.meta && it.meta.within){ try{ if (Bus && Bus.miss) Bus.miss({meta:{reason:'expire',group:it.meta.groupId}}); }catch(_e3){} }
        try{ it.el && it.el.parentNode && it.el.parentNode.removeChild(it.el); }catch(_e4){}
      } else keep.push(it);
    }
    state.items=keep;
  }

  function cleanup(){ stop(); }

  return { start:start, stop:stop, update:update, cleanup:cleanup };
}

// Default export for dynamic import style
export default { create, name };
