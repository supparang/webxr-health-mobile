// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION
// PATCH v20260302-brush-AB-BOOT
// ✅ Tap-to-start unlock (mobile/vr)
// ✅ ctx parse + passthrough hub/seed/time/view/diff/pid/studyId/phase/conditionGroup/log/ai/debug
// ✅ ai=1 enables AI Coach panel via brush:ai events (safe; no crash if missing)
(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d='')=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const num = (v,d)=>{ const n=Number(v); return Number.isFinite(n)?n:d; };
  const clamp = (v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  function autoView(){
    const v = String(qs('view','')).toLowerCase();
    if(v) return v;
    const ua = navigator.userAgent||'';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'mobile' : 'pc';
  }

  function buildCtx(){
    const view = String(qs('view', autoView())||'pc').toLowerCase();
    const hub  = String(qs('hub','../hub.html')||'../hub.html');
    const seed = num(qs('seed', Date.now()), Date.now());
    const time = clamp(qs('time', 80), 30, 120);
    const diff = String(qs('diff','normal')||'normal').toLowerCase();

    const pid = String(qs('pid','')||'').trim();
    const studyId = String(qs('studyId','')||'').trim();
    const phase = String(qs('phase','')||'').trim();
    const conditionGroup = String(qs('conditionGroup','')||'').trim();
    const log = String(qs('log', qs('api',''))||'').trim();

    const ai = (String(qs('ai','0'))==='1');
    const debug = (String(qs('debug','0'))==='1');

    return { view, hub, seed, time, diff, pid, studyId, phase, conditionGroup, log, ai, debug, run:String(qs('run','play')) };
  }

  // Simple AI HUD (optional)
  function ensureAIHud(){
    let wrap = DOC.getElementById('hud-ai');
    if(wrap) return wrap;

    wrap = DOC.createElement('section');
    wrap.id = 'hud-ai';
    wrap.style.position='fixed';
    wrap.style.left='12px';
    wrap.style.bottom='12px';
    wrap.style.zIndex='59';
    wrap.style.width='min(420px, 92vw)';
    wrap.style.border='1px solid rgba(148,163,184,.18)';
    wrap.style.borderRadius='20px';
    wrap.style.padding='10px 12px';
    wrap.style.background='rgba(2,6,23,.72)';
    wrap.style.backdropFilter='blur(10px)';
    wrap.style.boxShadow='0 18px 60px rgba(0,0,0,.35)';
    wrap.style.pointerEvents='none';
    wrap.style.opacity='0';
    wrap.style.transform='translateY(6px)';
    wrap.style.transition='opacity .18s ease, transform .18s ease';

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div id="ai-emo" style="font-size:18px">🧠</div>
        <div style="flex:1;min-width:0">
          <div id="ai-title" style="font-weight:1000">AI Coach</div>
          <div id="ai-sub" style="margin-top:2px;color:rgba(229,231,235,.80);font-weight:900;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">พร้อมช่วย!</div>
        </div>
        <div id="ai-tag" style="font-size:11px;color:rgba(148,163,184,1);font-weight:1000">TIP</div>
      </div>
      <div id="ai-mini" style="margin-top:8px;color:rgba(229,231,235,.86);font-weight:900;font-size:13px;line-height:1.45;">
        เล็งให้ชัวร์ก่อนยิง
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function setAI(msg){
    const w = ensureAIHud();
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
    w.style.opacity='1';
    w.style.transform='translateY(0)';
    clearTimeout(setAI._t);
    setAI._t = setTimeout(()=>{
      w.style.opacity='0';
      w.style.transform='translateY(6px)';
    }, msg.ms || 1600);
  }

  function onBrushAI(ev){
    const d = ev?.detail || {};
    setAI({
      emo: d.emo || '🧠',
      title: d.title || 'AI Coach',
      sub: d.sub || '',
      mini: d.mini || '',
      tag: d.tag || 'TIP',
      ms: d.ms || 1600
    });
  }

  function boot(){
    const ctx = buildCtx();

    // set view markers
    DOC.body.setAttribute('data-view', ctx.view);
    const wrap = DOC.getElementById('br-wrap');
    if(wrap) wrap.dataset.view = ctx.view;

    // show ctx tags
    const v = DOC.getElementById('br-ctx-view');
    const s = DOC.getElementById('br-ctx-seed');
    const t = DOC.getElementById('br-ctx-time');
    const d = DOC.getElementById('br-diffTag');
    const a = DOC.getElementById('br-aiTag');
    if(v) v.textContent = ctx.view;
    if(s) s.textContent = String((ctx.seed>>>0));
    if(t) t.textContent = `${ctx.time}s`;
    if(d) d.textContent = ctx.diff;
    if(a) a.textContent = ctx.ai ? 'on' : 'off';

    // AI HUD on/off
    if(ctx.ai){
      WIN.addEventListener('brush:ai', onBrushAI);
    }

    // start engine
    if(!WIN.HHA_BRUSH || typeof WIN.HHA_BRUSH.boot !== 'function'){
      console.warn('[BrushVR] missing HHA_BRUSH.boot()');
      return;
    }
    WIN.HHA_BRUSH.boot(ctx);
  }

  // Tap-to-start only for mobile/cvr/vr
  function needsTap(view){
    view = String(view||'').toLowerCase();
    return (view==='mobile' || view==='cvr' || view==='vr');
  }

  function setupTapStart(){
    const ctx = buildCtx();
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');

    if(!needsTap(ctx.view)){
      // hide overlay and boot immediately
      if(tap){ tap.style.display='none'; tap.setAttribute('aria-hidden','true'); }
      boot();
      return;
    }

    // show overlay
    if(tap){ tap.style.display='grid'; tap.setAttribute('aria-hidden','false'); }

    const go = ()=>{
      try{ tap.style.display='none'; tap.setAttribute('aria-hidden','true'); }catch(_){}
      boot();
    };

    if(btn){
      btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
    }
    if(tap){
      tap.addEventListener('click', (e)=>{ if(e.target===tap){ e.preventDefault(); go(); } }, {passive:false});
    }
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', setupTapStart, {once:true});
  }else{
    setupTapStart();
  }
})();