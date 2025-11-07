// === vr/mode-factory.js — safe no-optional-chaining (2025-11-07) ===
import { Difficulty }   from './difficulty.js';
import { Emoji }        from './emoji-sprite.js';
import { Fever }        from './fever.js';
import { MiniQuest }    from './miniquest.js';
import { MissionDeck }  from './mission.js';
import * as FX          from './particles.js';
import { SFX }          from './sfx.js';

var Particles = (FX && FX.Particles) ? FX.Particles : FX;

function $(s){ return document.querySelector(s); }
function sample(a){ return a[Math.floor(Math.random()*a.length)]; }
function clamp(n,a,b){ return Math.max(a, Math.min(b,n)); }
function now(){ return performance.now ? performance.now() : Date.now(); }

var MIN_DIST_DEFAULT         = 0.36;
var SLOT_COOLDOWN_MS_DEFAULT = 520;
var MAX_ACTIVE_BY_DIFF_DEF   = { easy:1, normal:2, hard:2 };
var BUDGET_BY_DIFF_DEF       = { easy:1, normal:2, hard:2 };
var TIME_BY_DIFF_DEF         = { easy:45, normal:60, hard:75 };

function makeEmojiNode(char, opts){
  var scale = (opts && opts.scale) ? opts.scale : 0.58;
  // ใช้ a-text เพื่อความเสถียร
  var el = document.createElement('a-text');
  el.setAttribute('value', char);
  el.setAttribute('align', 'center');
  el.setAttribute('color', '#fff');
  el.setAttribute('scale', (2*scale)+' '+(2*scale)+' '+(2*scale));
  return el;
}

function buildSlots(yBase){
  var y0 = (typeof yBase==='number')? yBase : 0.42;
  var xs=[-0.95, 0.00, 0.95], ys=[ y0, y0+0.34 ];
  var slots=[], id=0, ci, ri;
  for(ci=0; ci<xs.length; ci++){
    for(ri=0; ri<ys.length; ri++){
      slots.push({ id:id++, col:ci, row:ri, x:xs[ci], y:ys[ri], z:-1.34, used:false, lastUsed:0 });
    }
  }
  return slots;
}
function takeFreeSlot(slots, busyCols, busyRows, cooldownMs){
  var t=now();
  var free=slots.filter(function(s){ return !s.used && (t - s.lastUsed >= cooldownMs) && !busyCols.has(s.col) && !busyRows.has(s.row); });
  if(!free.length) return null;
  var s=free[Math.floor(Math.random()*free.length)]; s.used=true; return s;
}
function releaseSlot(slots, slot){ if(slot){ slot.used=false; slot.lastUsed=now(); } }

// -------- Boot factory --------
export async function boot(config){
  var name           = (config && config.name) || 'mode';
  var pools          = (config && config.pools) || { good:[], bad:[] };
  var judge          = config && config.judge;
  var ui             = (config && config.ui) || { questMainSel:'#tQmain' };
  var goldenRate     = (config && typeof config.goldenRate==='number') ? config.goldenRate : 0.07;
  var goodRate       = (config && typeof config.goodRate  ==='number') ? config.goodRate   : 0.70;
  var minDist        = (config && config.minDist) || MIN_DIST_DEFAULT;
  var slotCooldownMs = (config && config.slotCooldownMs) || SLOT_COOLDOWN_MS_DEFAULT;
  var timeByDiff     = (config && config.timeByDiff) || TIME_BY_DIFF_DEF;
  var maxActiveByDiff= (config && config.maxActiveByDiff) || MAX_ACTIVE_BY_DIFF_DEF;
  var budgetByDiff   = (config && config.budgetByDiff) || BUDGET_BY_DIFF_DEF;
  var givenHost      = config && config.host;
  var givenDuration  = config && config.duration;
  var givenDiff      = (config && config.difficulty) || 'normal';
  var goal           = (config && config.goal) || 40;

  var host = givenHost;
  if(!host){
    var wrap = $('a-scene') || document.body;
    var auto = document.createElement('a-entity'); auto.id='spawnHost';
    wrap.appendChild(auto); host = auto;
  }

  var sfx = new SFX('../assets/audio/');
  if (sfx && typeof sfx.unlock === 'function') sfx.unlock();
  if (sfx && typeof sfx.attachPageVisibilityAutoMute === 'function') sfx.attachPageVisibilityAutoMute();

  var scene = $('a-scene') || document.body;
  var fever = new Fever(scene, null, { durationMs:10000 });

  // MiniQuest
  var mq = new MiniQuest(
    { tQmain: $(ui.questMainSel || '#tQmain') },
    {
      coach_start: $('#coach_start'),
      coach_good : $('#coach_good'),
      coach_warn : $('#coach_warn'),
      coach_fever: $('#coach_fever'),
      coach_quest: $('#coach_quest'),
      coach_clear: $('#coach_clear')
    }
  );
  if (mq && typeof mq.start === 'function') mq.start(goal);
  var missions = new MissionDeck();
  if (missions && typeof missions.draw3 === 'function') missions.draw3();

  // เวลา/ความยาก
  var difficulty = givenDiff;
  var duration   = givenDuration || timeByDiff[difficulty] || 60;
  var hudTime = $('#hudTime');
  if (hudTime) hudTime.setAttribute('troika-text','value: เวลา: '+duration+'s');

  var diff = new Difficulty();
  var safe = { size:0.60, rate:520, life:2000 };
  var base = (diff && diff.config && diff.config[difficulty]) ? diff.config[difficulty]
           : (diff && diff.config && diff.config.normal) ? diff.config.normal
           : safe;
  var spawnRateMs = Number(base.rate)||safe.rate;
  var lifetimeMs  = Number(base.life)||safe.life;
  var sizeFactor  = Math.max(0.40, (Number(base.size)||0.60)*0.80);
  var hitWBase    = (difficulty==='easy'?0.50:(difficulty==='hard'?0.40:0.46));
  var hitW        = Math.min(hitWBase, minDist*0.80);

  // State
  var running=true, missionGood=0, score=0, combo=0, comboMax=0, streak=0, lastGoodAt=now();
  var MAX_ACTIVE = maxActiveByDiff[difficulty] != null ? maxActiveByDiff[difficulty] : 2;
  var BUDGET     = budgetByDiff[difficulty] != null ? budgetByDiff[difficulty] : 2;

  var active=new Set();
  var slots = buildSlots();
  var busyCols=new Set(), busyRows=new Set();
  var issuedThisSec=0, spawnTicker, SPAWN_LOCK=false;
  var budgetTimer=setInterval(function(){ issuedThisSec=0; },1000);

  // FPS adapt
  var frames=0, lastT=now();
  (function rafLoop(t){
    frames++;
    if (t-lastT>=1000){
      var fps=frames; frames=0; lastT=t;
      if (fps<40){ spawnRateMs=Math.min(spawnRateMs*1.15,900); MAX_ACTIVE=Math.max(1,Math.round(MAX_ACTIVE*0.9)); }
    }
    if (typeof requestAnimationFrame==='function') requestAnimationFrame(rafLoop);
  })( (performance && performance.now)? performance.now(): Date.now() );

  // Combo decay
  var comboDecay=setInterval(function(){
    if(!running) return;
    if(now()-lastGoodAt>2000 && combo>0){
      combo--;
      try{ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score:score,combo:combo}})); }catch(e){}
    }
  },1000);

  // Pause/Resume hooks
  var api = null;
  window.addEventListener('blur',  function(){ if(api && typeof api.pause  ==='function') api.pause();  });
  window.addEventListener('focus', function(){ if(api && typeof api.resume ==='function') api.resume(); });
  document.addEventListener('visibilitychange', function(){
    if (document.hidden){ if(api && typeof api.pause ==='function') api.pause(); }
    else { if(api && typeof api.resume==='function') api.resume(); }
  });

  function spawnOne(){
    if(!running) return;
    if(SPAWN_LOCK) return; SPAWN_LOCK=true;
    try{
      if(active.size>=MAX_ACTIVE || issuedThisSec>=BUDGET) return;

      var slot=takeFreeSlot(slots, busyCols, busyRows, slotCooldownMs);
      if(!slot) return;

      // 2D overlap check
      var tooClose=false;
      active.forEach(function(el){
        try{
          var p=el.getAttribute('position'); var dx=p.x-slot.x, dy=p.y-slot.y;
          if((dx*dx+dy*dy)<(minDist*minDist)) tooClose=true;
        }catch(e){}
      });
      if(tooClose){ releaseSlot(slots,slot); return; }

      // reserve
      busyCols.add(slot.col); busyRows.add(slot.row); issuedThisSec++;

      // pick
      var isGood = Math.random() < goodRate || !(pools && pools.bad && pools.bad.length);
      var char   = isGood ? sample(pools.good||[]) : sample((pools && pools.bad) || (pools && pools.good) || []);
      var isGold = isGood && Math.random() < goldenRate;

      var el=makeEmojiNode(char,{scale:clamp(sizeFactor,0.35,0.65)});
      el.setAttribute('position', slot.x+' '+slot.y+' '+slot.z);
      el.classList.add('hit','clickable'); el.__col=slot.col; el.__row=slot.row;

      if(isGold){
        el.setAttribute('scale','1.12 1.12 1.12');
        var halo=document.createElement('a-ring');
        halo.setAttribute('radius-inner','0.18'); halo.setAttribute('radius-outer','0.22');
        halo.setAttribute('position','0 0 0.001'); halo.setAttribute('material','color:#ffe066; opacity:0.85; shader:flat');
        el.appendChild(halo);
      }

      var hit=document.createElement('a-plane');
      hit.setAttribute('width',hitW); hit.setAttribute('height',hitW);
      hit.setAttribute('material','opacity:0; transparent:true; side:double');
      hit.classList.add('hit','clickable');
      el.appendChild(hit);

      active.add(el);

      var ttlMult=(difficulty==='easy')?1.8:(difficulty==='hard'?0.95:1.1);
      var ttl=Math.round(lifetimeMs*ttlMult*(1.05+Math.random()*0.35));
      if(active.size<=1) ttl=Math.max(ttl,2400);

      var consumed=false;
      var killer=setTimeout(function(){
        if (typeof judge==='function'){
          var res = judge(null, { type:'timeout', char:char, score:score, combo:combo, streak:streak, feverActive: (!!fever && fever.active===true) });
          if(res && res.good===false){ streak=0; combo=0; if(mq && typeof mq.junk==='function') mq.junk(); }
        }else{ streak=0; combo=0; if(mq && typeof mq.junk==='function') mq.junk(); }
        cleanup();
      }, ttl);

      function fire(ev){
        if(consumed) return; consumed=true;
        try{ if(ev && ev.stopPropagation) ev.stopPropagation(); if(ev && ev.preventDefault) ev.preventDefault(); }catch(e){}
        clearTimeout(killer);

        var res = { good:true, scoreDelta:10, feverDelta:0 };
        if (typeof judge==='function') res = judge(char, { type:'hit', score:score, combo:combo, streak:streak, feverActive:(!!fever && fever.active===true) });

        if (res && res.good){
          var plus = (typeof res.scoreDelta==='number') ? res.scoreDelta : 10;
          missionGood+=1; score+=plus; combo+=1; streak+=1; if(combo>comboMax) comboMax=combo; lastGoodAt=now();
          if (sfx && typeof sfx.popGood==='function') sfx.popGood();
          if (Particles && typeof Particles.burst==='function') Particles.burst(host, {x:slot.x,y:slot.y,z:slot.z}, '#69f0ae');

          try{
            var t=document.createElement('a-entity');
            t.setAttribute('troika-text','value: +'+plus+'; color:#fff; fontSize:0.08; anchor:center');
            t.setAttribute('position', slot.x+' '+(slot.y+0.05)+' '+(slot.z+0.01));
            host.appendChild(t);
            t.setAttribute('animation__rise','property: position; to: '+slot.x+' '+(slot.y+0.30)+' '+(slot.z+0.01)+'; dur: 520; easing: ease-out');
            t.setAttribute('animation__fade','property: opacity; to: 0; dur: 520; easing: linear');
            setTimeout(function(){ try{ t.remove(); }catch(e){} },560);
          }catch(e){}
          if(res && res.feverDelta && fever && typeof fever.add==='function') fever.add(res.feverDelta);
          if (mq && typeof mq.good==='function') mq.good({score:score,combo:combo,streak:streak,missionGood:missionGood});
        }else{
          score = Math.max(0, score + ((res && typeof res.scoreDelta==='number') ? res.scoreDelta : -5));
          combo=0; streak=0;
          if (sfx && typeof sfx.popBad==='function') sfx.popBad();
          if (Particles && typeof Particles.smoke==='function') Particles.smoke(host,{x:slot.x,y:slot.y,z:slot.z});
          if (mq && typeof mq.junk==='function') mq.junk();
        }
        try{ window.dispatchEvent(new CustomEvent('hha:score',{detail:{score:score,combo:combo}})); }catch(e){}
        if (missionGood>=goal && mq && typeof mq.mission==='function') mq.mission(missionGood);
        cleanup();
      }

      ['click','mousedown','touchstart','triggerdown'].forEach(function(evt){
        try{ hit.addEventListener(evt, fire, {passive:false}); }catch(e){}
        try{ el.addEventListener(evt,  fire, {passive:false}); }catch(e){}
      });

      host.appendChild(el);

      function cleanup(){
        try{ el.remove(); }catch(e){}
        active.delete(el);
        busyCols.delete(slot.col); busyRows.delete(slot.row);
        releaseSlot(slots,slot);
      }
    } finally { SPAWN_LOCK=false; }
  }

  // overlap sweeper
  function resolveOverlaps(){
    var arr=[]; active.forEach(function(a){ arr.push(a); });
    for (var i=0;i<arr.length;i++){
      for (var j=i+1;j<arr.length;j++){
        try{
          var pa=arr[i].getAttribute('position'), pb=arr[j].getAttribute('position');
          var dx=pb.x-pa.x, dy=pb.y-pa.y, d2=dx*dx+dy*dy;
          if(d2 < (minDist*minDist)){
            var dest=takeFreeSlot(slots, busyCols, busyRows, slotCooldownMs);
            if(dest){
              arr[j].setAttribute('position', dest.x+' '+dest.y+' '+dest.z);
              busyCols.add(dest.col); busyRows.add(dest.row);
              if(arr[j].__col!=null && arr[j].__row!=null){ busyCols.delete(arr[j].__col); busyRows.delete(arr[j].__row); }
              arr[j].__col=dest.col; arr[j].__row=dest.row;
            }else{
              try{ arr[j].remove(); }catch(e){} active.delete(arr[j]);
            }
          }
        }catch(e){}
      }
    }
  }
  var overlapSweeper=setInterval(function(){ if(running) resolveOverlaps(); },200);

  function loop(){
    clearTimeout(spawnTicker);
    function tick(){
      if(running && issuedThisSec<BUDGET) spawnOne();
      var cd=Math.max(380, (spawnRateMs|0));
      spawnTicker=setTimeout(tick, cd);
    }
    tick();
  }
  loop(); setTimeout(function(){ spawnOne(); },240);

  var secondTimer=setInterval(function(){
    if(!running) return;
    if (mq && typeof mq.second==='function') mq.second();
    if (missions && typeof missions.second==='function') missions.second();
  },1000);
  var endTimer=setTimeout(function(){ endGame('timeout'); }, duration*1000);

  window.addEventListener('hha:fever', function(e){
    var st = (e && e.detail) ? e.detail.state : '';
    if (st==='start'){ if (mq && typeof mq.fever==='function') mq.fever(); spawnRateMs=Math.round(spawnRateMs*0.85); }
    else { spawnRateMs = Number(base.rate)||520; }
  });

  function endGame(reason){
    if(!running) return; running=false;
    clearTimeout(spawnTicker); clearInterval(secondTimer); clearInterval(budgetTimer);
    clearInterval(comboDecay); clearInterval(overlapSweeper); clearTimeout(endTimer);
    try{ if(fever && typeof fever.end==='function') fever.end(); }catch(e){}
    try{ if(sfx && typeof sfx.playCoach==='function') sfx.playCoach('clear'); }catch(e){}
    try{ window.dispatchEvent(new CustomEvent('hha:end',{detail:{reason:reason,score:score,missionGood:missionGood,goal:goal,comboMax:comboMax}})); }catch(e){}
  }

  api = {
    pause: function(){ if(!running) return; running=false; clearTimeout(spawnTicker); },
    resume:function(){ if(running) return; running=true; loop(); },
    stop:  function(){ endGame('stop'); }
  };
  return api;
}
export default { boot };