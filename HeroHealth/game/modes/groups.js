// === Hero Health Academy — game/modes/groups.js (2025-11-01 ULTRA-SAFE, unified) ===
// โหมด: 5 Food Groups (ตาม “เป้าหมายหมวด” + โควตาเป็นรอบ ๆ)
// - ทำงานแบบเต็มจอ (ใช้ #spawnHost ถ้ามี ไม่งั้นสร้างเอง)
// - ไม่มี optional chaining / dynamic import
// - เชื่อม bus.hit / bus.miss เพื่อให้ main.js อัปเดตคะแนน/คอมโบได้
// - มี FX ปลอดภัย (add3DTilt / shatter3D) ผ่าน window.HHA_FX ถ้าพร้อม

export const name = 'groups';

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

// --- Data / utils ---
var GROUPS = {
  veggies:['🥦','🥕','🥬','🌽','🍅','🍆','🥒','🧅','🍄','🌶️'],
  protein:['🍗','🥩','🍳','🐟','🍤','🧆','🫘','🥜','🧀','🍣'],
  grains :['🍚','🍞','🥖','🍝','🍜','🥯','🥪','🥞','🫓','🌯'],
  fruits :['🍎','🍌','🍇','🍓','🍊','🍍','🍉','🍑','🍐','🥭'],
  dairy  :['🥛','🧀','🍦','🍨','🍧','🥛','🧀','🍨','🍦','🥛']
};
var KEYS = ['veggies','protein','grains','fruits','dairy'];

function rnd(arr){ return arr[(Math.random()*arr.length)|0]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function mapTH(k){ var M={veggies:'ผัก',protein:'โปรตีน',grains:'ธัญพืช',fruits:'ผลไม้',dairy:'นม'}; return M[k]||k; }

function setTargetHUD(group, have, need, lang){
  var wrap  = document.getElementById('targetWrap');
  var badge = document.getElementById('targetBadge');
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

// --- Factory API (main.js จะเรียก create().start/update/stop) ---
export function create(ctx){
  var engine = (ctx && ctx.engine) ? ctx.engine : {};
  var coach  = (ctx && ctx.coach)  ? ctx.coach  : {};

  var host=null, layer=null;
  var state = {
    running:false, items:[],
    lang:'TH', difficulty:'Normal',
    ctx:{ target:'veggies', need:8, have:0 },
    _spawnCd:0.22,
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
    if (!host){
      host = document.createElement('div');
      host.id = 'spawnHost';
      host.style.position='fixed';
      host.style.inset='0';
      host.style.pointerEvents='auto';
      host.style.zIndex='5';
      document.body.appendChild(host);
    }
    layer = document.getElementById('gameLayer'); if (!layer) layer = document.querySelector('.game-wrap');

    try { var L = localStorage.getItem('hha_lang'); state.lang = L ? String(L).toUpperCase() : 'TH'; }catch(_e){ state.lang='TH'; }
    try { var d = document.body.getAttribute('data-diff'); state.difficulty = d||'Normal'; }catch(_e){ state.difficulty='Normal'; }

    state.ctx.target = KEYS[(Math.random()*KEYS.length)|0];
    state.ctx.need   = quotaByDiff(state.difficulty);
    state.ctx.have   = 0;

    setTargetHUD(state.ctx.target, state.ctx.have, state.ctx.need, state.lang);
    state.running = true; state.items.length=0; state.stats={good:0,perfect:0,bad:0,miss:0};
    try{ coach && coach.onStart && coach.onStart(); }catch(_e){}

    toast(state.lang==='EN' ? ('🎯 Target: '+state.ctx.target) : ('🎯 เป้าหมาย: '+mapTH(state.ctx.target)));
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
    var isTarget = Math.random() < 0.30; // 30% ตามเป้า
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
      try{ engine.sfx && engine.sfx.play && engine.sfx.play(res==='perfect'?'sfx-perfect':'sfx-good'); }catch(_e){}
      try{ engine.fx && engine.fx.popText && engine.fx.popText('+'+(res==='perfect'?18:10)+(res==='perfect'?' ✨':''), {x:ui.x,y:ui.y,ms:720}); }catch(_e){}
      try{ Bus && Bus.hit && Bus.hit({ kind:res, points:(res==='perfect'?18:10), ui:ui, meta:meta }); }catch(_e){}
      state.stats[res] = (state.stats[res]||0)+1;

      if (state.ctx.have >= state.ctx.need){
        try{ engine.sfx && engine.sfx.play && engine.sfx.play('sfx-perfect'); }catch(_e){}
        var next = chooseNext(state.ctx.target);
        state.ctx.target = next; state.ctx.have = 0;
        setTargetHUD(state.ctx.target, 0, state.ctx.need, state.lang);
        toast(state.lang==='EN' ? ('🎯 New target: '+next) : ('🎯 เป้าหมายใหม่: '+mapTH(next)));
      }
    } else {
      res='bad';
      try{
        if (document.body && document.body.classList){
          document.body.classList.add('flash-danger');
          setTimeout(function(){ document.body.classList.remove('flash-danger'); },160);
        }
      }catch(_e){}
      try{ engine.sfx && engine.sfx.play && engine.sfx.play('sfx-bad'); }catch(_e){}
      try{ Bus && Bus.miss && Bus.miss({ meta:meta }); }catch(_e){}
      state.stats.bad++;
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
    var fs = 38;
    if (state.difficulty==='Easy') fs = 44;
    else if (state.difficulty==='Hard') fs = 32;

    b.style.fontSize = String(fs)+'px';
    b.style.left = String(x)+'px';
    b.style.top  = String(y)+'px';
    b.style.transform='translate(-50%,-50%)';
    b.style.filter='drop-shadow(0 3px 6px rgba(0,0,0,.45))';
    b.textContent = m.char;
    b.setAttribute('aria-label', m.aria);
    if (m.golden) b.style.filter='drop-shadow(0 0 10px rgba(255,215,0,.85))';

    try{ window.HHA_FX && window.HHA_FX.add3DTilt && window.HHA_FX.add3DTilt(b); }catch(_e){}

    var parent = host || document.getElementById('spawnHost') || document.body;
    parent.appendChild(b);

    var born = (typeof performance!=='undefined' && performance && performance.now) ? performance.now() : Date.now();
    state.items.push({ el:b, born:born, life:m.life, meta:m });

    b.addEventListener('click', function(ev){
      if (!state.running) return;
      ev.stopPropagation();
      var ui = { x: ev.clientX||0, y: ev.clientY||0 };
      var r  = onHit(m, ui, Bus);
      if (r!=='bad'){ try{ window.HHA_FX && window.HHA_FX.shatter3D && window.HHA_FX.shatter3D(ui.x, ui.y); }catch(_e){} }
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
      // ความเร็ว spawn แปรผันตามความยาก
      var base = 0.40;
      if (state.difficulty==='Easy') base = 0.46;
      else if (state.difficulty==='Hard') base = 0.34;
      state._spawnCd = clamp(base - bias + Math.random()*0.22, 0.24, 0.95);
    }

    // life timeout / cleanup
    var now=(typeof performance!=='undefined' && performance && performance.now)?performance.now():Date.now();
    var keep=[], i, it;
    for (i=0;i<state.items.length;i++){
      it=state.items[i];
      if (now - it.born > it.life){
        if (it.meta && it.meta.groupId===state.ctx.target){
          try{ Bus && Bus.miss && Bus.miss({ meta:{reason:'expire', group:it.meta.groupId} }); }catch(_e){}
          state.stats.miss++;
        }
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
