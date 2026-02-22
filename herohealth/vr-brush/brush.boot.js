// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PATCH v20260222a
// ✅ Tap-to-start unlock (mobile/vr)
// ✅ Safe boot order + guard against double boot
// ✅ Context parse + passthrough
// ✅ AI HUD listener (optional)
// ✅ No auto-start / no auto-summary glitch

(function(){
  'use strict';

  const WIN = window, DOC = document;

  if (WIN.__BRUSH_BOOT_PATCHED__) return;
  WIN.__BRUSH_BOOT_PATCHED__ = true;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const num = (v,d)=>{ const n = Number(v); return Number.isFinite(n) ? n : d; };

  function getViewAuto(){
    const qv = String(qs('view','') || '').toLowerCase();
    if (qv) return qv;
    const ua = navigator.userAgent || '';
    const isMobile =
      /Android|iPhone|iPad|iPod/i.test(ua) ||
      (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
  }

  function buildCtx(){
    const view = getViewAuto();
    const hub  = qs('hub','') || '../hub.html';
    const seed = num(qs('seed', Date.now()), Date.now());
    const time = Math.max(30, Math.min(120, num(qs('time', 80), 80)));
    const diff = String(qs('diff','normal') || 'normal').toLowerCase();

    return {
      view,
      hub,
      seed,
      time,
      diff,
      run: String(qs('run','play') || 'play').toLowerCase(),
      pid: qs('pid','') || qs('participantId','') || '',
      studyId: qs('studyId','') || '',
      phase: qs('phase','') || '',
      conditionGroup: qs('conditionGroup','') || '',
      log: qs('log','') || ''
    };
  }

  // -------------------------
  // Minimal AI HUD (optional)
  // -------------------------
  function ensureAIHud(){
    let wrap = DOC.getElementById('hud-ai');
    if(wrap) return wrap;

    wrap = DOC.createElement('section');
    wrap.id = 'hud-ai';
    wrap.className = 'hudCard hudAI';
    Object.assign(wrap.style, {
      position: 'fixed',
      left: '12px',
      bottom: '12px',
      zIndex: '59',
      width: 'min(420px, 92vw)',
      border: '1px solid rgba(148,163,184,.18)',
      borderRadius: '20px',
      padding: '10px 12px',
      background: 'rgba(2,6,23,.72)',
      backdropFilter: 'blur(10px)',
      webkitBackdropFilter: 'blur(10px)',
      boxShadow: '0 18px 60px rgba(0,0,0,.35)',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity .18s ease, transform .18s ease',
      transform: 'translateY(6px)'
    });

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div id="ai-emo" style="font-size:18px;line-height:1;">🧠</div>
        <div style="flex:1;min-width:0">
          <div id="ai-title" style="font-weight:950;letter-spacing:.2px;">AI Coach</div>
          <div id="ai-sub" style="margin-top:2px;color:rgba(229,231,235,.82);font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">พร้อมช่วย!</div>
        </div>
        <div id="ai-tag" style="font-size:11px;color:rgba(148,163,184,1);font-weight:900;">TIP</div>
      </div>
      <div id="ai-mini" style="margin-top:8px;color:rgba(229,231,235,.86);font-size:13px;line-height:1.45;">
        ทำ PERFECT เพื่อคอมโบ + เติม FEVER
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function setAI(msg){
    const wrap = ensureAIHud();
    const emo = DOC.getElementById('ai-emo');
    const title = DOC.getElementById('ai-title');
    const sub = DOC.getElementById('ai-sub');
    const tag = DOC.getElementById('ai-tag');
    const mini = DOC.getElementById('ai-mini');
    if(emo) emo.textContent = msg.emo || '🧠';
    if(title) title.textContent = msg.title || 'AI Coach';
    if(sub) sub.textContent = msg.sub || '';
    if(tag) tag.textContent = msg.tag || 'TIP';
    if(mini) mini.textContent = msg.mini || '';
    wrap.style.opacity = '1';
    wrap.style.transform = 'translateY(0)';
    clearTimeout(setAI._t);
    setAI._t = setTimeout(()=>{
      wrap.style.opacity = '0';
      wrap.style.transform = 'translateY(6px)';
    }, msg.ms || 1600);
  }

  function bigPop(msg){
    let el = DOC.getElementById('ai-bigpop');
    if(!el){
      el = DOC.createElement('div');
      el.id = 'ai-bigpop';
      Object.assign(el.style, {
        position:'fixed',
        left:'50%',
        top:'50%',
        transform:'translate(-50%,-50%) scale(0.96)',
        zIndex:'60',
        padding:'12px 16px',
        borderRadius:'999px',
        border:'1px solid rgba(148,163,184,.22)',
        background:'rgba(2,6,23,.78)',
        color:'rgba(229,231,235,.95)',
        fontWeight:'950',
        letterSpacing:'.6px',
        boxShadow:'0 18px 60px rgba(0,0,0,.45)',
        backdropFilter:'blur(10px)',
        webkitBackdropFilter:'blur(10px)',
        pointerEvents:'none',
        opacity:'0',
        transition:'opacity .14s ease, transform .14s ease'
      });
      DOC.body.appendChild(el);
    }
    el.textContent = msg.big || msg.title || 'READY!';
    el.style.opacity='1';
    el.style.transform='translate(-50%,-50%) scale(1)';
    clearTimeout(bigPop._t);
    bigPop._t = setTimeout(()=>{
      el.style.opacity='0';
      el.style.transform='translate(-50%,-50%) scale(0.96)';
    }, msg.bigMs || 900);
  }

  function aiMsgFromEvent(ev){
    const d = ev?.detail || {};
    const t = String(d.type||'').toLowerCase();
    const mk = (emo,title,sub,mini,tag='TIP',ms=1600,big=null,bigMs=900)=>({emo,title,sub,mini,tag,ms,big,bigMs});

    switch(t){
      case 'boss_start':   return mk('🦠','บอสมาแล้ว!','โหมด BOSS เริ่ม','โฟกัส PERFECT + คุมคอมโบ','BOSS',1800,'BOSS!',900);
      case 'gate_on':      return mk('🛡️','GATE เปิด!','ต้องทำ PERFECT ติดกัน','อย่าพลาด—ช้าแต่แม่น','GATE',1900,'GATE!',900);
      case 'gate_break':   return mk('💥','เกราะแตก!','ตีบอสได้เต็มแรงแล้ว','รีบกวาด Weak Spot 🎯','GATE',1600,'BREAK!',900);
      case 'laser_on':     return mk('🚫','LASER SWEEP!','ห้ามตีช่วงนี้','นิ่งไว้ก่อน แล้วค่อยลุยต่อ','LASER',1500,'NO HIT!',900);
      case 'shock_on':     return mk('🎵','SHOCKWAVE!','ตีเฉพาะตอน “วงเขียว”','จับจังหวะให้แม่น','SHOCK',1700,'TIMING!',900);
      case 'finisher_on':  return mk('🏁','FINISHER!','โอกาสปิดเกม','ทำ PERFECT ให้ครบ','FIN',1900,'FINISH!',900);
      case 'time_10s':     return mk('⏳','อีก 10 วิ!','เร่งแบบแม่น ๆ','กันพลาด > รักษาคอมโบ','TIME',1200,'10s!',800);
      default: return null;
    }
  }

  function shouldBigPop(type){
    const t = String(type||'').toLowerCase();
    return ['boss_start','gate_on','gate_break','laser_on','shock_on','finisher_on','time_10s'].includes(t);
  }

  const RL = { lastAny:0, lastBig:0, minAnyMs:260, minBigMs:900 };

  function onBrushAI(ev){
    const type = ev?.detail?.type;
    const t = Date.now();
    if(t - RL.lastAny < RL.minAnyMs) return;
    RL.lastAny = t;

    const msg = aiMsgFromEvent(ev);
    if(!msg) return;

    setAI(msg);

    if(shouldBigPop(type)){
      if(t - RL.lastBig < RL.minBigMs) return;
      RL.lastBig = t;
      bigPop(msg);
    }
  }

  // -------------------------
  // Boot once
  // -------------------------
  let booted = false;
  function bootOnce(){
    if(booted) return;
    booted = true;

    const ctx = buildCtx();

    DOC.body.setAttribute('data-view', ctx.view);
    try { DOC.documentElement.dataset.view = ctx.view; } catch(_){}

    WIN.addEventListener('brush:ai', onBrushAI);

    // IMPORTANT: only boot if engine exists
    if (WIN.BrushVR && typeof WIN.BrushVR.boot === 'function'){
      WIN.BrushVR.boot(ctx);
    } else {
      console.warn('[BrushVR] missing BrushVR.boot(ctx)');
    }
  }

  function setupTapStart(){
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');

    // If no overlay, boot directly
    if(!tap || !btn){
      bootOnce();
      return;
    }

    // Show overlay only on coarse pointer or cvr/mobile view
    const mobileLike = (DOC.body.getAttribute('data-view') === 'cvr') ||
      (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);

    if (!mobileLike){
      tap.style.display = 'none';
      bootOnce();
      return;
    }

    tap.style.display = 'grid';

    const go = ()=>{
      try { tap.style.display='none'; } catch(_){}
      bootOnce();
    };

    btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); go(); }, { passive:false, once:true });
    tap.addEventListener('click', (e)=>{
      if(e.target === tap){
        e.preventDefault();
        e.stopPropagation();
        go();
      }
    }, { passive:false });
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', setupTapStart, { once:true });
  } else {
    setupTapStart();
  }
})();