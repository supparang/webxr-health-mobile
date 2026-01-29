// === /herohealth/vr-groups/effects-pack.js ===
// GroupsVR Effects Pack — PRODUCTION (SAFE + Fallback)
// ✅ Works with window.Particles if available
// ✅ Fallback DOM FX if Particles not loaded
// ✅ API: window.GroupsVR.EffectsPack.{hit,miss,combo,storm,boss,swap,celebrate,toast,flash}
// ✅ Auto-hooks common events (non-breaking)
// Notes: engine MAY call EffectsPack.* directly (recommended)

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  WIN.GroupsVR = WIN.GroupsVR || {};
  if (WIN.GroupsVR.EffectsPack) return; // avoid double load

  // --------------------------
  // Utils
  // --------------------------
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));
  const nowMs = ()=>{ try{ return performance.now(); }catch(_){ return Date.now(); } };

  function safeText(s){ return String(s==null?'':s); }

  function getRectCenter(el){
    try{
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width/2, y: r.top + r.height/2 };
    }catch(_){
      return { x: WIN.innerWidth*0.5, y: WIN.innerHeight*0.5 };
    }
  }

  // --------------------------
  // DOM FX Fallback Layer
  // --------------------------
  let layer = null;
  function ensureLayer(){
    if (layer && layer.isConnected) return layer;
    layer = DOC.getElementById('groups-fx');
    if (!layer){
      layer = DOC.createElement('div');
      layer.id = 'groups-fx';
      layer.style.position = 'fixed';
      layer.style.left = '0';
      layer.style.top = '0';
      layer.style.right = '0';
      layer.style.bottom = '0';
      layer.style.pointerEvents = 'none';
      layer.style.zIndex = '9998';
      layer.style.overflow = 'hidden';
      DOC.body.appendChild(layer);

      const css = DOC.createElement('style');
      css.textContent = `
        #groups-fx .fxText{
          position:absolute;
          transform:translate(-50%,-50%);
          font: 900 15px/1.1 system-ui,-apple-system,"Noto Sans Thai",sans-serif;
          letter-spacing:.2px;
          padding: 8px 10px;
          border-radius: 999px;
          border: 1px solid rgba(148,163,184,.22);
          background: rgba(2,6,23,.78);
          color: rgba(229,231,235,.94);
          box-shadow: 0 18px 60px rgba(0,0,0,.28);
          backdrop-filter: blur(10px);
          opacity: 0;
          animation: fxPop 620ms ease-out forwards;
          will-change: transform, opacity;
        }
        #groups-fx .fxText.good{ border-color: rgba(34,197,94,.35); }
        #groups-fx .fxText.bad { border-color: rgba(239,68,68,.35); }
        #groups-fx .fxText.warn{ border-color: rgba(245,158,11,.40); }
        #groups-fx .fxText.neu { border-color: rgba(59,130,246,.32); }

        #groups-fx .fxRing{
          position:absolute;
          width: 18px; height: 18px;
          border-radius: 999px;
          border: 2px solid rgba(229,231,235,.55);
          transform: translate(-50%,-50%) scale(.5);
          opacity: 0;
          animation: fxRing 520ms ease-out forwards;
          will-change: transform, opacity;
        }
        #groups-fx .fxRing.good{ border-color: rgba(34,197,94,.65); }
        #groups-fx .fxRing.bad { border-color: rgba(239,68,68,.65); }
        #groups-fx .fxRing.warn{ border-color: rgba(245,158,11,.70); }
        #groups-fx .fxRing.neu { border-color: rgba(59,130,246,.60); }

        #groups-fx .fxFlash{
          position:fixed; inset:0;
          background: rgba(255,255,255,.08);
          opacity: 0;
          animation: fxFlash 260ms ease-out forwards;
        }

        @keyframes fxPop{
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(.85); }
          18%  { opacity: 1; transform: translate(-50%,-52%) scale(1.03); }
          100% { opacity: 0; transform: translate(-50%,-72%) scale(.98); }
        }
        @keyframes fxRing{
          0%   { opacity: 0; transform: translate(-50%,-50%) scale(.6); }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(3.2); }
        }
        @keyframes fxFlash{
          0% { opacity: 0; }
          25%{ opacity: 1; }
          100%{ opacity: 0; }
        }
      `;
      DOC.head.appendChild(css);
    }
    return layer;
  }

  function domText(x,y,text,cls){
    const L = ensureLayer();
    const el = DOC.createElement('div');
    el.className = `fxText ${cls||'neu'}`;
    el.textContent = safeText(text);
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    L.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 900);
  }

  function domRing(x,y,cls){
    const L = ensureLayer();
    const el = DOC.createElement('div');
    el.className = `fxRing ${cls||'neu'}`;
    el.style.left = (x|0) + 'px';
    el.style.top  = (y|0) + 'px';
    L.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 750);
  }

  function domFlash(){
    const L = ensureLayer();
    const el = DOC.createElement('div');
    el.className = 'fxFlash';
    L.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){} }, 400);
  }

  // --------------------------
  // Particles wrapper
  // --------------------------
  function hasParticles(){
    return !!(WIN.Particles && typeof WIN.Particles.popText === 'function');
  }

  function pText(x,y,text,cls){
    if (hasParticles()){
      try{ WIN.Particles.popText(x,y, safeText(text), cls||''); return true; }catch(_){}
    }
    domText(x,y,text,cls||'neu'); return false;
  }

  function pBurst(x,y,opts){
    if (WIN.Particles && typeof WIN.Particles.burst === 'function'){
      try{ WIN.Particles.burst(x,y, opts||{}); return true; }catch(_){}
    }
    // fallback: ring only
    domRing(x,y,(opts && opts.cls) ? opts.cls : 'neu'); return false;
  }

  // --------------------------
  // Throttle (prevent spam)
  // --------------------------
  const TH = {
    hit:   { t:0, ms: 70 },
    miss:  { t:0, ms: 90 },
    combo: { t:0, ms: 160 },
    toast: { t:0, ms: 220 },
    flash: { t:0, ms: 240 },
  };
  function allow(key){
    const o = TH[key] || {t:0,ms:120};
    const t = nowMs();
    if (t - o.t < o.ms) return false;
    o.t = t;
    TH[key] = o;
    return true;
  }

  // --------------------------
  // FX API
  // --------------------------
  function toast(text, tone='neu', anchorEl=null){
    if (!allow('toast')) return;
    const pos = anchorEl ? getRectCenter(anchorEl) : { x: WIN.innerWidth*0.5, y: WIN.innerHeight*0.25 };
    pText(pos.x, pos.y, text, tone);
  }

  function hit(x,y, kind='good', points=0){
    if (!allow('hit')) return;
    const cls = (kind==='good') ? 'good' : (kind==='bad' ? 'bad' : 'neu');
    const msg = (kind==='good')
      ? (points ? `✅ +${points}` : '✅ NICE!')
      : (kind==='bad')
        ? (points ? `⛔ ${points}` : '⛔ WRONG')
        : '🎯 HIT';
    pBurst(x,y,{ cls, text: msg });
    pText(x,y, msg, cls);
  }

  function miss(x,y){
    if (!allow('miss')) return;
    pBurst(x,y,{ cls:'bad', text:'❌ MISS' });
    pText(x,y, '❌ MISS', 'bad');
  }

  function combo(x,y, n){
    if (!allow('combo')) return;
    const k = Number(n)||0;
    if (k < 3) return;
    pText(x,y, `🔥 COMBO x${k}`, 'good');
    pBurst(x,y,{ cls:'good' });
  }

  function swap(groupName){
    toast('🔄 สลับหมู่: ' + safeText(groupName||''), 'neu');
  }

  function storm(on){
    toast(on ? '🌪️ STORM! เป้าถี่ขึ้น' : '✨ พายุจบ! กลับสู่ปกติ', on ? 'warn' : 'good');
    if (allow('flash')) domFlash();
  }

  function boss(kind){
    if (kind === 'spawn') toast('👊 BOSS มาแล้ว!', 'warn');
    if (kind === 'down')  toast('💥 BOSS แตก!', 'good');
    if (allow('flash')) domFlash();
  }

  function celebrate(){
    toast('🎉 GREAT JOB!', 'good');
    if (allow('flash')) domFlash();
    // extra burst around center
    const cx = WIN.innerWidth*0.5, cy = WIN.innerHeight*0.38;
    pBurst(cx,cy,{ cls:'good' });
    pBurst(cx-90,cy+40,{ cls:'good' });
    pBurst(cx+90,cy+40,{ cls:'good' });
  }

  function flash(){
    if (!allow('flash')) return;
    domFlash();
  }

  // --------------------------
  // Auto-hook events (SAFE)
  // --------------------------
  function hook(){
    // Hit/Miss (if engine dispatches)
    WIN.addEventListener('groups:hit', (ev)=>{
      const d = ev.detail||{};
      const x = Number(d.x ?? d.px ?? WIN.innerWidth*0.5);
      const y = Number(d.y ?? d.py ?? WIN.innerHeight*0.5);
      hit(x,y, d.kind||'good', d.points||0);
      if (d.combo) combo(x,y, d.combo);
    }, { passive:true });

    WIN.addEventListener('groups:miss', (ev)=>{
      const d = ev.detail||{};
      const x = Number(d.x ?? d.px ?? WIN.innerWidth*0.5);
      const y = Number(d.y ?? d.py ?? WIN.innerHeight*0.5);
      miss(x,y);
    }, { passive:true });

    // Progress signals (storm/boss/switch) — match what groups-vr.html already listens to
    WIN.addEventListener('groups:progress', (ev)=>{
      const d = ev.detail||{};
      const k = String(d.kind||'');
      if (k === 'storm_on') storm(true);
      if (k === 'storm_off') storm(false);
      if (k === 'boss_spawn') boss('spawn');
      if (k === 'boss_down') boss('down');
      if (k === 'perfect_switch') swap(d.groupName || d.group || '');
    }, { passive:true });

    // Celebrate (end / quest)
    WIN.addEventListener('hha:celebrate', ()=> celebrate(), { passive:true });

    // Optional: when quest update changes group (if engine includes)
    WIN.addEventListener('quest:update', (ev)=>{
      const d = ev.detail||{};
      // If engine provides "groupChanged" or "groupKey" we can gently toast once (low spam)
      if (d.groupChanged || d._groupChanged){
        toast('หมู่ตอนนี้: ' + safeText(d.groupName||''), 'good');
      }
    }, { passive:true });
  }

  // --------------------------
  // Public API
  // --------------------------
  WIN.GroupsVR.EffectsPack = {
    toast,
    hit,
    miss,
    combo,
    swap,
    storm,
    boss,
    celebrate,
    flash,
    _hasParticles: hasParticles
  };

  // Boot
  hook();

  // Self-report (optional)
  try{
    WIN.dispatchEvent(new CustomEvent('groups:fx_ready', {
      detail:{ particles: hasParticles() ? 1 : 0 }
    }));
  }catch(_){}

})();