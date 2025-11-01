// === Hero Health Academy — game/modes/plate.js (2025-10-31 ULTRA-SAFE) ===
// โหมด: Healthy Plate (เติมให้ครบโควตาแต่ละหมวด)
// - แสดงแถบโควตาที่ #plateTracker #platePills เมื่อมี
// - ไม่มี optional chaining / dynamic import

export const name = 'plate';

(function ensureFX(){
  if (!window.HHA_FX){
    window.HHA_FX = { add3DTilt:function(){}, shatter3D:function(){} };
  }
})();

var GROUPS = ['veggies','fruits','grains','protein','dairy'];
var POOL = {
  veggies:['🥦','🥕','🥬','🌽','🍅','🍆','🥒','🧅','🍄','🌶️'],
  fruits :['🍎','🍌','🍇','🍓','🍊','🍍','🍉','🍑','🍐','🥭'],
  grains :['🍚','🍞','🥖','🍝','🍜','🥯','🥪','🥞','🫓','🌯'],
  protein:['🍗','🥩','🍳','🐟','🍤','🧆','🫘','🥜','🧀','🍣'],
  dairy  :['🥛','🧀','🍦','🍨','🍧','🥛','🧀','🍨','🍦','🥛']
};
// === modes/plate.js (เลือกส่วนประกอบจานสุขภาพ: ✅ / ❌)
export const name = 'plate';
const OK = ['🥗','🐟','🍚','🥛','🥦'];      // ชิ้นดี
const BAD= ['🍔','🍟','🍕','🍩','🧂'];      // ชิ้นไม่ดี
let host=null, alive=false, rate=0.85, age=0, life=1.6, diff='Normal';

export function start(cfg={}){
  host = document.getElementById('spawnHost') || (()=>{ const h=document.createElement('div'); h.id='spawnHost'; h.style.cssText='position:fixed;inset:0;pointer-events:auto;z-index:5;'; document.body.appendChild(h); return h; })();
  host.innerHTML=''; alive=true; age=0; diff=String(cfg.difficulty||'Normal');
  if (diff==='Easy'){ rate=1.0; life=1.9; } else if (diff==='Hard'){ rate=0.7; life=1.3; } else { rate=0.85; life=1.6; }
}

export function stop(){ alive=false; try{ host && (host.innerHTML=''); }catch{} }

function spawnOne(glyph, good, bus){
  const d=document.createElement('button'); d.className='spawn-emoji'; d.type='button'; d.textContent=glyph; d.dataset.good=good?'1':'0';
  Object.assign(d.style,{ position:'absolute', border:'0', background:'transparent', fontSize:(diff==='Easy'?'44px':(diff==='Hard'?'32px':'38px')), transform:'translate(-50%,-50%)',
    filter:'drop-shadow(0 3px 6px rgba(0,0,0,.45))' });
  const pad=40, W=innerWidth, H=innerHeight;
  const x = Math.floor(pad + Math.random()*(W - pad*2));
  const y = Math.floor(pad + Math.random()*(H - pad*2 - 120));
  d.style.left=x+'px'; d.style.top=y+'px';
  const killto=setTimeout(()=>{ try{ d.remove(); }catch{} bus?.miss?.(); }, Math.floor(life*1000));

  d.addEventListener('click',(ev)=>{
    clearTimeout(killto); try{d.remove();}catch{}
    if(good){ bus?.hit?.({ kind:'good', points:120, ui:{x:ev.clientX,y:ev.clientY} }); }
    else    { bus?.miss?.(); }
  }, { passive:true });

  host.appendChild(d);
}

export function update(dt, bus){
  if(!alive) return;
  age += dt;
  if (age >= rate){
    age -= rate;
    const good = Math.random() < 0.7;
    const glyph = good ? OK[(Math.random()*OK.length)|0] : BAD[(Math.random()*BAD.length)|0];
    spawnOne(glyph, good, bus);
  }
}

function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function L(lang){
  var TH={veggies:'ผัก',fruits:'ผลไม้',grains:'ธัญพืช',protein:'โปรตีน',dairy:'นม',done:'จัดจานครบ!'};
  var EN={veggies:'Veggies',fruits:'Fruits',grains:'Grains',protein:'Protein',dairy:'Dairy',done:'Plate Complete!'};
  return (lang==='EN')?EN:TH;
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
  var html='';
  for (var i=0;i<GROUPS.length;i++){
    var g=GROUPS[i]; var have=state.have[g]||0; var need=state.need[g]||0;
    var pct = need>0 ? clamp((have/need)*100, 0, 100) : 0;
    html += '<div class="pill '+(have>=need?'ok':'')+'"><b>'+lang[g]+'</b><span>'+have+'/'+need+
            '</span><i style="display:inline-block;height:6px;width:'+pct+'%;background:#2dd4bf;border-radius:999px;margin-left:6px"></i></div>';
  }
  host.innerHTML = html;
}

export function create(ctx){
  var engine = (ctx && ctx.engine) ? ctx.engine : {};
  var coach  = (ctx && ctx.coach)  ? ctx.coach  : {};

  var host=null, layer=null;
  var state = {
    running:false, items:[], _spawnCd:0,
    lang:'TH', difficulty:'Normal',
    need:quotas('Normal'), have:{veggies:0,fruits:0,grains:0,protein:0,dairy:0},
    stats:{good:0,perfect:0,bad:0,miss:0}
  };

  function start(){
    stop();
    host  = document.getElementById('spawnHost');
    layer = document.getElementById('gameLayer'); if(!layer) layer=document.querySelector('.game-wrap');

    try{ var Ls=localStorage.getItem('hha_lang'); state.lang = Ls?Ls.toUpperCase():'TH'; }catch(e){ state.lang='TH'; }
    try{ var d=document.body.getAttribute('data-diff'); state.difficulty=d||'Normal'; }catch(e){ state.difficulty='Normal'; }
    state.need = quotas(state.difficulty);
    state.have = {veggies:0,fruits:0,grains:0,protein:0,dairy:0};

    renderHUD(state);

    state.running=true; state.items.length=0; state.stats={good:0,perfect:0,bad:0,miss:0};
    try{ if (coach && coach.onStart) coach.onStart(); }catch(e){}
  }

  function stop(){
    state.running=false;
    try{ for (var i=0;i<state.items.length;i++){ var it=state.items[i]; if (it && it.el && it.el.remove) it.el.remove(); } }catch(e){}
    state.items.length=0;
  }

  function lacking(){
    var out=[]; for (var i=0;i<GROUPS.length;i++){ var g=GROUPS[i]; if ((state.have[g]||0) < (state.need[g]||0)) out.push(g); }
    return out;
  }

  function pickMeta(){
    var lack = lacking();
    var g = lack.length>0 && Math.random()<0.75 ? lack[(Math.random()*lack.length)|0] : GROUPS[(Math.random()*GROUPS.length)|0];
    var ch = rnd(POOL[g]);
    var life = clamp(1700 + ((Math.random()*900)|0), 700, 4500);
    var golden = Math.random()<0.08;
    var within = (state.have[g]||0) < (state.need[g]||0);
    return { char:ch, aria:g, groupId:g, within:within, golden:golden, life:life };
  }

  function plateDone(){
    for (var i=0;i<GROUPS.length;i++){ var g=GROUPS[i]; if ((state.have[g]||0) < (state.need[g]||0)) return false; }
    return true;
  }

  function onHit(meta, ui, Bus){
    if (meta.within){
      state.have[meta.groupId] = (state.have[meta.groupId]||0) + 1;
      renderHUD(state);
      var res = meta.golden ? 'perfect':'good';
      try{ if (engine.sfx && engine.sfx.play) engine.sfx.play(res==='perfect'?'sfx-perfect':'sfx-good'); }catch(e){}
      try{ if (engine.fx && engine.fx.popText) engine.fx.popText('+'+(res==='perfect'?20:10)+(res==='perfect'?' ✨':''), {x:ui.x,y:ui.y,ms:720}); }catch(e){}
      try{ if (Bus && Bus.hit) Bus.hit({kind:res,points:(res==='perfect'?20:10),ui:ui,meta:meta}); }catch(e){}

      if (plateDone()){
        var line = document.getElementById('missionLine');
        if (line){ line.style.display='block'; line.textContent = (state.lang==='EN'?'🍽️ Plate Complete!':'🍽️ จัดจานครบ!'); setTimeout(function(){ line.style.display='none'; }, 900); }
        try{ if (engine.sfx && engine.sfx.play) engine.sfx.play('sfx-perfect'); }catch(e){}
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
        if (document.body && document.body.classList){ document.body.classList.add('flash-danger'); setTimeout(function(){ document.body.classList.remove('flash-danger'); }, 160); }
      }catch(e){}
      try{ if (engine.sfx && engine.sfx.play) engine.sfx.play('sfx-bad'); }catch(e){}
      try{ if (Bus && Bus.miss) Bus.miss({meta:meta}); }catch(e){}
      return 'bad';
    }
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

    if (typeof state._spawnCd !== 'number') state._spawnCd = 0.20;
    var tEl=document.getElementById('time'), tLeft=0;
    try{ if (tEl && tEl.textContent){ var n=parseInt(tEl.textContent,10); if (isFinite(n)) tLeft=n; } }catch(e){}
    var bias=(tLeft>0 && tLeft<=15)?0.12:0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.40 - bias + Math.random()*0.22, 0.26, 0.95);
    }

    var now=(typeof performance!=='undefined' && performance && performance.now)?performance.now():Date.now();
    var keep=[]; for (var i=0;i<state.items.length;i++){
      var it=state.items[i];
      if (now - it.born > it.life){
        // นับ miss เฉพาะของที่ยังขาดโควตาเท่านั้น
        if (it.meta && it.meta.within){ try{ if (Bus && Bus.miss) Bus.miss({meta:{reason:'expire',group:it.meta.groupId}}); }catch(e){} state.stats.miss++; }
        try{ it.el.remove(); }catch(e){}
      } else keep.push(it);
    }
    state.items=keep;
  }

  function cleanup(){ stop(); }

  return { start:start, stop:stop, update:update, cleanup:cleanup };
}

export default { create:create, name:name };
