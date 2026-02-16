// === /herohealth/vr-brush/brush.fx.js ===
// BrushVR FX Overlay v20260216c
// Listens: brush:ai + hha:event + hha:start/end
// Shows: Laser sweep, Shock timing ring, Weak spot highlight, STOP banner

(function(){
  'use strict';
  const WIN = window, DOC = document;
  const $id = (id)=>DOC.getElementById(id);

  function ensureFX(){
    let fx = $id('br-fx');
    if(fx) return fx;

    fx = DOC.createElement('div');
    fx.id = 'br-fx';
    fx.innerHTML = `
      <div id="fx-stop" class="br-fx-stop" hidden>STOP</div>
      <div id="fx-banner" class="br-fx-banner" hidden></div>

      <div id="fx-laser" class="br-fx-laser" hidden>
        <div class="beam"></div>
        <div class="beam b2"></div>
      </div>

      <div id="fx-shock" class="br-fx-shock" hidden>
        <div class="ring"></div>
      </div>

      <div id="fx-weak" class="br-fx-weak" hidden>🎯 WEAK</div>
    `;
    DOC.body.appendChild(fx);
    return fx;
  }

  function show(el, ms){
    if(!el) return;
    el.hidden = false;
    el.classList.add('show');
    clearTimeout(el._t);
    if(ms){
      el._t = setTimeout(()=>hide(el), ms);
    }
  }
  function hide(el){
    if(!el) return;
    el.classList.remove('show');
    // allow transition
    clearTimeout(el._t2);
    el._t2 = setTimeout(()=>{ el.hidden = true; }, 180);
  }

  function banner(msg, ms=900){
    ensureFX();
    const el = $id('fx-banner');
    if(!el) return;
    el.textContent = msg;
    show(el, ms);
  }

  function stop(ms=650){
    ensureFX();
    const el = $id('fx-stop');
    show(el, ms);
  }

  function laser(ms=1400){
    ensureFX();
    const el = $id('fx-laser');
    show(el, ms);
  }

  function shockGate(open){
    ensureFX();
    const el = $id('fx-shock');
    if(!el) return;
    el.hidden = false;
    el.classList.toggle('gate-open', !!open);
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ el.hidden = true; el.classList.remove('show','gate-open'); }, 380);
  }

  function weak(on){
    ensureFX();
    const el = $id('fx-weak');
    if(on) show(el);
    else hide(el);
  }

  // brush:ai messages
  WIN.addEventListener('brush:ai', (ev)=>{
    const t = String(ev?.detail?.type||'').toLowerCase();

    if(t==='boss_start') banner('💎 BOSS INCOMING', 900);
    if(t==='boss_phase') banner(`🔥 PHASE ${ev.detail.phase||''}`, 800);

    if(t==='laser_warn'){ banner('⚠️ LASER WARNING', 700); stop(520); }
    if(t==='laser_on'){ laser(1400); stop(900); }

    if(t==='shock_on'){ banner('🎵 TIMING MODE', 900); }
    if(t==='shock_pulse'){ shockGate(true); }

    if(t==='finisher_on'){ banner('🏁 FINISHER!', 900); }
    if(t==='time_10s'){ banner('⏳ 10s!', 650); }
  });

  // hha:event signals (from engine)
  WIN.addEventListener('hha:event', (ev)=>{
    const type = String(ev?.detail?.type||'').toLowerCase();
    if(type==='boss_nohit_laser'){ stop(650); }
    if(type==='boss_nohit_shock'){ banner('🎵 WAIT GREEN', 650); }
    if(type==='nohit_telegraph'){ banner('⏱️ WAIT', 450); }

    // weak spot on/off hint via feature snapshots
    if(type==='feat'){
      const f = ev.detail?.f;
      // if you later include f.weak=1 you can auto-control here
    }
  });

  // optional: start/end cleanup
  WIN.addEventListener('hha:start', ()=>{ ensureFX(); weak(false); });
  WIN.addEventListener('hha:end', ()=>{ weak(false); });

})();