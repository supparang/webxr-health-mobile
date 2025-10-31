// === Hero Health Academy — game/modes/groups.js (2025-10-31 ULTRA-SAFE) ===
// โหมด: 5 Food Groups (ตามเป้าหมายหมวด + โควตา)
// - ไม่มี optional chaining / dynamic import
// - ใช้ create({engine,hud,coach}) แบบเดียวกับ main.js
// - ปลอดภัยถ้า HUD ไม่พร้อม (ไม่พัง)

export const name = 'groups';

(function ensureFX(){
  if (!window.HHA_FX){
    window.HHA_FX = { add3DTilt:function(){}, shatter3D:function(){} };
  }
})();

var GROUPS = {
  veggies:['🥦','🥕','🥬','🌽','🍅','🍆','🥒','🧅','🍄','🌶️'],
  protein:['🍗','🥩','🍳','🐟','🍤','🧆','🫘','🥜','🧀','🍣'],
  grains: ['🍚','🍞','🥖','🍝','🍜','🥯','🥪','🥞','🫓','🌯'],
  fruits: ['🍎','🍌','🍇','🍓','🍊','🍍','🍉','🍑','🍐','🥭'],
  dairy:  ['🥛','🧀','🍦','🍨','🍧','🥛','🧀','🍨','🍦','🥛']
};
var KEYS = ['veggies','protein','grains','fruits','dairy'];

function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }

function mapTH(k){
  var M = {veggies:'ผัก',protein:'โปรตีน',grains:'ธัญพืช',fruits:'ผลไม้',dairy:'นม'};
  return M[k]||k;
}
function setTargetHUD(group, have, need, lang){
  var wrap = document.getElementById('targetWrap');
  var badge= document.getElementById('targetBadge');
  if (wrap && wrap.style) wrap.style.display = 'inline-flex';
  if (badge) {
    var nm = (lang==='EN') ? group : mapTH(group);
    badge.textContent = nm + ' • ' + String(have||0) + '/' + String(need||0);
  }
}
function toast(msg){
  var el = document.getElementById('toast');
  if (!el){ el=document.createElement('div'); el.id='toast'; el.className='toast'; document.body.appendChild(el); }
  el.textContent = msg;
  if (el.classList) el.classList.add('show');
  setTimeout(function(){ try{ el.classList.remove('show'); }catch(e){} }, 900);
}

export function create(ctx){
  var engine = (ctx && ctx.engine) ? ctx.engine : {};
  var coach  = (ctx && ctx.coach)  ? ctx.coach  : {};

  var host=null, layer=null;
  var state = {
    running:false, items:[],
    lang: 'TH',
    difficulty: 'Normal',
    ctx:{ target:'veggies', need:8, have:0 },
    _spawnCd:0,
    stats:{good:0,perfect:0,bad:0,miss:0}
  };

  function chooseNext(prev){
    var next = prev;
    while(next===prev){ next = KEYS[(Math.random()*KEYS.length)|0]; }
    return next;
  }
  function quotaByDiff(d){
    if (d==='Easy') return 6;
    if (d==='Hard') return 10;
    return 8;
  }

  function start(){
    stop();
    host  = document.getElementById('spawnHost');
    layer = document.getElementById('gameLayer'); if (!layer) layer = document.querySelector('.game-wrap');

    try {
      var L = localStorage.getItem('hha_lang'); state.lang = L ? L.toUpperCase() : 'TH';
    }catch(e){ state.lang='TH'; }
    try {
      var d = document.body.getAttribute('data-diff'); state.difficulty = d||'Normal';
    }catch(e){ state.difficulty='Normal'; }

    state.ctx.target = KEYS[(Math.random()*KEYS.length)|0];
    state.ctx.need   = quotaByDiff(state.difficulty);
    state.ctx.have   = 0;

    setTargetHUD(state.ctx.target, state.ctx.have, state.ctx.need, state.lang);
    state.running = true; state.items.length=0; state.stats={good:0,perfect:0,bad:0,miss:0};

    try{ if (coach && coach.onStart) coach.onStart(); }catch(e){}
    toast(state.lang==='EN' ? '🎯 Target: ' + state.ctx.target : '🎯 เป้าหมาย: ' + mapTH(state.ctx.target));
  }

  function stop(){
    state.running=false;
    try{ for(var i=0;i<state.items.length;i++){ var it=state.items[i]; if(it && it.el && it.el.remove) it.el.remove(); } }catch(e){}
    state.items.length=0;
  }

  function pickMeta(){
    var isTarget = Math.random() < 0.30; // 30% โผล่ตามเป้า
    var gid = isTarget ? state.ctx.target : (function(){
      var k = state.ctx.target;
      while(k===state.ctx.target){ k = KEYS[(Math.random()*KEYS.length)|0]; }
      return k;
    })();
    var ch = rnd(GROUPS[gid]);
    var life = clamp(1700 + ((Math.random()*900)|0), 700, 4500);
    var golden = isTarget && Math.random() < 0.06;
    return { char:ch, aria:gid, groupId:gid, isTarget:isTarget, golden:golden, life:life };
  }

  function onHit(meta, ui, Bus){
    var res='ok';
    if (meta.groupId === state.ctx.target){
      res = meta.golden ? 'perfect':'good';
      state.ctx.have = Math.min(state.ctx.have+1, state.ctx.need);
      setTargetHUD(state.ctx.target, state.ctx.have, state.ctx.need, state.lang);
      try{ if (engine.sfx && engine.sfx.play) engine.sfx.play(res==='perfect'?'sfx-perfect':'sfx-good'); }catch(e){}
      try{ if (engine.fx && engine.fx.popText) engine.fx.popText('+'+(res==='perfect'?18:10)+(res==='perfect'?' ✨':''), {x:ui.x,y:ui.y,ms:720}); }catch(e){}
      try{ if (Bus && Bus.hit) Bus.hit({ kind:res, points:(res==='perfect'?18:10), ui:ui, meta:meta }); }catch(e){}
      state.stats[res] = (state.stats[res]||0)+1;

      if (state.ctx.have >= state.ctx.need){
        try{ if (engine.sfx && engine.sfx.play) engine.sfx.play('sfx-perfect'); }catch(e){}
        var next = chooseNext(state.ctx.target);
        state.ctx.target = next; state.ctx.have = 0;
        setTargetHUD(state.ctx.target, 0, state.ctx.need, state.lang);
        toast(state.lang==='EN' ? '🎯 New target: ' + next : '🎯 เป้าหมายใหม่: ' + mapTH(next));
      }
    } else {
      res='bad';
      try{
        if (document.body && document.body.classList){ document.body.classList.add('flash-danger'); setTimeout(function(){ document.body.classList.remove('flash-danger'); },160); }
      }catch(e){}
      try{ if (engine.sfx && engine.sfx.play) engine.sfx.play('sfx-bad'); }catch(e){}
      try{ if (Bus && Bus.miss) Bus.miss({ meta:meta }); }catch(e){}
      state.stats.bad++;
    }
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
    b.style.left = String(x)+'px'; b.style.top = String(y)+'px';
    b.textContent = m.char; b.setAttribute('aria-label', m.aria);
    if (m.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';
    try{ if (window.HHA_FX && window.HHA_FX.add3DTilt) window.HHA_FX.add3DTilt(b); }catch(e){}

    var parent = host || document.getElementById('spawnHost') || document.body;
    parent.appendChild(b);

    var born = (typeof performance!=='undefined' && performance && performance.now) ? performance.now() : Date.now();
    state.items.push({ el:b, born:born, life:m.life, meta:m });

    b.addEventListener('click', function(ev){
      if (!state.running) return;
      ev.stopPropagation();
      var ui = { x: ev.clientX||0, y: ev.clientY||0 };
      var r  = onHit(m, ui, (engine && engine.Bus)? engine.Bus : null);
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
    var tEl = document.getElementById('time'); var tLeft = 0;
    try{ if (tEl && tEl.textContent){ var n=parseInt(tEl.textContent,10); if (isFinite(n)) tLeft=n; } }catch(e){}
    var bias = (tLeft>0 && tLeft<=15) ? 0.12 : 0;

    state._spawnCd -= dt;
    if (state._spawnCd <= 0){
      spawnOne(rect, Bus);
      state._spawnCd = clamp(0.40 - bias + Math.random()*0.22, 0.26, 0.95);
    }

    var now = (typeof performance!=='undefined' && performance && performance.now) ? performance.now() : Date.now();
    var keep=[]; for (var i=0;i<state.items.length;i++){
      var it=state.items[i];
      if (now - it.born > it.life){
        if (it.meta && it.meta.groupId===state.ctx.target){ try{ if (Bus && Bus.miss) Bus.miss({ meta:{reason:'expire', group:it.meta.groupId} }); }catch(e){} state.stats.miss++; }
        try{ it.el.remove(); }catch(e){}
      } else keep.push(it);
    }
    state.items = keep;
  }

  function cleanup(){ stop(); }

  return { start:start, stop:stop, update:update, cleanup:cleanup };
}

// default export
export default { create:create, name:name };
