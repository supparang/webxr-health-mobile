// === /herohealth/vr-groups/effects-pack.js ===
// GroupsVR Effects Pack — PRODUCTION (SAFE)
// ✅ Listens: groups:hit (engine), groups:progress, quest:update
// ✅ Uses window.Particles.popText/burst when available
// ✅ Auto-retry until Particles ready
(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  WIN.GroupsVR = WIN.GroupsVR || {};

  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  const FX = {
    _inited:false,
    _layerEl:null,
    _armed:false,
    _tries:0,
    _maxTries:60,
    _waitIt:0,

    ready(){
      return !!(WIN.Particles && typeof WIN.Particles.popText === 'function');
    },

    pop(x,y,text,cls){
      try{
        if(!FX.ready()) return false;
        WIN.Particles.popText(Number(x)||0, Number(y)||0, String(text||''), cls||'ok');
        return true;
      }catch(_){ return false; }
    },

    burst(x,y,emoji){
      try{
        if(!FX.ready()) return false;
        if (typeof WIN.Particles.burst === 'function'){
          WIN.Particles.burst(Number(x)||0, Number(y)||0, { text:String(emoji||'✨') });
        }else{
          WIN.Particles.popText(Number(x)||0, Number(y)||0, String(emoji||'✨'), 'ok');
        }
        return true;
      }catch(_){ return false; }
    },

    init(opts){
      FX._layerEl = (opts && opts.layerEl) ? opts.layerEl : (DOC.getElementById('playLayer')||DOC.body);
      if(FX._inited) return true;
      FX._inited = true;

      // attach listeners once
      FX.attach();

      // start waiting for particles (retry)
      FX.armParticles();
      return true;
    },

    armParticles(){
      if(FX._armed) return;
      FX._armed = true;

      let t = 0;
      FX._waitIt = setInterval(()=>{
        t++;
        if(FX.ready()){
          clearInterval(FX._waitIt);
          FX._waitIt = 0;

          // optional sanity ping (only if ?selftest=1)
          try{
            const sp = new URL(location.href).searchParams;
            const selftest = String(sp.get('selftest')||'0');
            if(selftest==='1' || selftest==='true'){
              FX.pop(70, 110, 'FX READY', 'ok');
            }
          }catch(_){}
          return;
        }

        if(t >= FX._maxTries){
          clearInterval(FX._waitIt);
          FX._waitIt = 0;
        }
      }, 100);
    },

    attach(){
      // hit event from engine (the important one)
      WIN.addEventListener('groups:hit', (ev)=>{
        const d = ev.detail || {};
        const x = Number(d.x)||0;
        const y = Number(d.y)||0;
        const good = !!d.good;
        const miss = !!d.miss;

        // decide icon + class
        const icon =
          good ? '✅' :
          miss ? '❌' :
          '⚠️';

        const cls =
          good ? 'ok' :
          (String(d.kind||'')==='timeout_miss') ? 'warn' :
          'bad';

        // show FX (if ready)
        FX.pop(x, y, icon, cls);

        // small extra burst on big events
        if(good && String(d.kind||'')==='hit_good'){
          if (WIN.Particles && WIN.Particles.burst) FX.burst(x, y, '✨');
        }
      }, { passive:true });

      // storm/boss/switch banners -> burst top-mid
      WIN.addEventListener('groups:progress', (ev)=>{
        const d = ev.detail || {};
        const k = String(d.kind||'');
        const cx = Math.round((WIN.innerWidth||360) * 0.5);
        const cy = 140;

        if (k==='storm_on')  FX.burst(cx, cy, '🌪️');
        if (k==='storm_off') FX.burst(cx, cy, '✨');
        if (k==='boss_spawn')FX.burst(cx, cy, '👊');
        if (k==='boss_down') FX.burst(cx, cy, '💥');
        if (k==='perfect_switch') FX.burst(cx, cy, '🔄');
      }, { passive:true });

      // MINI urgent -> small warning
      WIN.addEventListener('quest:update', (ev)=>{
        const d = ev.detail || {};
        const left = Number(d.miniTimeLeftSec||0);
        if(left>0 && left<=3){
          const x = Math.round((WIN.innerWidth||360) * 0.82);
          const y = 140;
          FX.pop(x, y, '⏱️', 'warn');
        }
      }, { passive:true });
    }
  };

  WIN.GroupsVR.EffectsPack = FX;
})();