// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (AI HUD + Big Pop)
// PATCH v20260304-BRUSH-BOOT-STABLE
// ✅ Tap-to-start unlock (mobile)
// ✅ Hooks brush:ai -> HUD (rate-limited)   (works with your existing mapper style)
// ✅ Does NOT auto-start game (player presses Start)
(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const num = (v,d)=>{ const n = Number(v); return isFinite(n)? n : d; };

  function buildCtx(){
    const view = String(qs('view', DOC.body.getAttribute('data-view')||'pc')||'pc').toLowerCase();
    const hub  = qs('hub','') || '';
    const seed = num(qs('seed', Date.now()), Date.now());
    const time = num(qs('time', 80), 80);
    const studyId = qs('studyId','') || '';
    const phase = qs('phase','') || '';
    const conditionGroup = qs('conditionGroup','') || '';
    return { view, hub, seed, time, studyId, phase, conditionGroup };
  }

  function ensureAIHud(){
    let wrap = DOC.getElementById('hud-ai');
    if(wrap) return wrap;

    wrap = DOC.createElement('section');
    wrap.id = 'hud-ai';
    wrap.style.position = 'fixed';
    wrap.style.left = '12px';
    wrap.style.bottom = '12px';
    wrap.style.zIndex = '59';
    wrap.style.width = 'min(440px, 92vw)';
    wrap.style.border = '1px solid rgba(148,163,184,.18)';
    wrap.style.borderRadius = '20px';
    wrap.style.padding = '10px 12px';
    wrap.style.background = 'rgba(2,6,23,.72)';
    wrap.style.backdropFilter = 'blur(10px)';
    wrap.style.webkitBackdropFilter = 'blur(10px)';
    wrap.style.boxShadow = '0 18px 60px rgba(0,0,0,.35)';
    wrap.style.pointerEvents = 'none';
    wrap.style.opacity = '0';
    wrap.style.transition = 'opacity .18s ease, transform .18s ease';
    wrap.style.transform = 'translateY(6px)';

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
        ยิงให้โดนก่อน แล้วค่อยเร่ง
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

  // rate-limit
  const RL = { last:0, minMs:260 };

  function onBrushAI(ev){
    const now = Date.now();
    if(now - RL.last < RL.minMs) return;
    RL.last = now;

    const d = ev?.detail || {};
    const type = String(d.type||'').toLowerCase();

    if(type==='risk'){
      const r = Math.round((Number(d.risk)||0)*100);
      setAI({
        emo: (d.band==='high' ? '⚠️' : d.band==='mid' ? '🟡' : '🟢'),
        title: `AI Risk ${r}%`,
        sub: `Stage ${d.stage||'?'} • combo ${d.combo||0} • missStreak ${d.missStreak||0}`,
        mini: d.tip || 'เล็งให้ชัวร์ก่อนยิง',
        tag: 'RISK',
        ms: 1600
      });
      return;
    }

    if(type==='miss_streak'){
      setAI({ emo:'😵', title:'พลาดติดกัน', sub:`miss streak = ${d.n||0}`, mini:'ช้าลงนิด แล้วค่อยยิง', tag:'WARN', ms:1600 });
      return;
    }

    if(type==='combo_hot'){
      setAI({ emo:'🔥', title:'คอมโบร้อนแรง!', sub:`combo = ${d.combo||0}`, mini:'รักษาคอมโบไว้!', tag:'GO', ms:1400 });
      return;
    }

    if(type==='stage'){
      setAI({ emo:'🧭', title:`Stage ${d.stage||'?'}`, sub:`clean ${Math.round(d.clean||0)}%`, mini:'ทำตามเป้าของสเตจให้ครบ', tag:'STAGE', ms:1500 });
      return;
    }

    if(type==='quiz'){
      setAI({ emo:'🧠', title:'Quiz', sub:`${d.state||''}`, mini:'ตอบให้ถูก รับโบนัส', tag:'C', ms:1500 });
      return;
    }

    if(type==='boss'){
      setAI({ emo:'💎', title:'Boss!', sub:`${d.state||''}`, mini:'เล็ง weakspot วงเหลือง 🎯', tag:'BOSS', ms:1500 });
      return;
    }

    if(type==='time'){
      setAI({ emo:'⏳', title:'ใกล้หมดเวลา!', sub:`เหลือ ~${d.left||10}s`, mini:'อย่าพลาด! ยิงให้โดน', tag:'TIME', ms:1400 });
      return;
    }
  }

  function boot(){
    const ctx = buildCtx();
    DOC.body.setAttribute('data-view', ctx.view);

    WIN.addEventListener('brush:ai', onBrushAI);

    // Tap start overlay
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');
    const go = ()=>{
      try{ tap.style.display='none'; }catch(_){}
      // game engine is self-init (menu shows)
      // nothing else needed
    };

    const ua = navigator.userAgent||'';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    if(tap && btn && isMobile){
      tap.style.display = 'grid';
      btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
      tap.addEventListener('click', (e)=>{ if(e.target===tap){ e.preventDefault(); go(); } }, {passive:false});
    }else{
      if(tap) tap.style.display='none';
    }
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot);
  }else{
    boot();
  }
})();