// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (Tap-to-start + AI HUD bridge)
// PATCH v20260304a-BRUSH-BOOT-AIHUD
(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const num = (v,d)=>{ const n = Number(v); return Number.isFinite(n)? n : d; };

  function buildCtx(){
    const view = String(qs('view', DOC.body.getAttribute('data-view')||'')||'').toLowerCase();
    const hub  = qs('hub','') || '';
    const seed = num(qs('seed', Date.now()), Date.now());
    const time = num(qs('time', 80), 80);
    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const ai   = String(qs('ai','1')) !== '0';
    const pid  = String(qs('pid','')||'').trim();

    return {
      view: view || (/(Android|iPhone|iPad|iPod)/i.test(navigator.userAgent||'') ? 'cvr' : 'pc'),
      hub, seed, time, diff, ai, pid,
      studyId: qs('studyId','')||'',
      phase: qs('phase','')||'',
      conditionGroup: qs('conditionGroup','')||'',
      debug: num(qs('debug',0),0)===1
    };
  }

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
    wrap.style.webkitBackdropFilter='blur(10px)';
    wrap.style.boxShadow='0 18px 60px rgba(0,0,0,.35)';
    wrap.style.pointerEvents='none';
    wrap.style.opacity='0';
    wrap.style.transition='opacity .18s ease, transform .18s ease';
    wrap.style.transform='translateY(6px)';

    wrap.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div id="ai-emo" style="font-size:18px;line-height:1;">🧠</div>
        <div style="flex:1;min-width:0">
          <div id="ai-title" style="font-weight:950;letter-spacing:.2px;">AI Prediction</div>
          <div id="ai-sub" style="margin-top:2px;color:rgba(229,231,235,.82);font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">พร้อมช่วย!</div>
        </div>
        <div id="ai-tag" style="font-size:11px;color:rgba(148,163,184,1);font-weight:900;">TIP</div>
      </div>
      <div id="ai-mini" style="margin-top:8px;color:rgba(229,231,235,.86);font-size:13px;line-height:1.45;">—</div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function showAI(msg){
    const wrap = ensureAIHud();
    const emo = DOC.getElementById('ai-emo');
    const sub = DOC.getElementById('ai-sub');
    const tag = DOC.getElementById('ai-tag');
    const mini = DOC.getElementById('ai-mini');

    if(emo) emo.textContent = msg.emo || '🧠';
    if(sub) sub.textContent = msg.sub || '';
    if(tag) tag.textContent = msg.tag || 'TIP';
    if(mini) mini.textContent = msg.mini || '';

    wrap.style.opacity='1';
    wrap.style.transform='translateY(0)';
    clearTimeout(showAI._t);
    showAI._t = setTimeout(()=>{
      wrap.style.opacity='0';
      wrap.style.transform='translateY(6px)';
    }, msg.ms || 1600);
  }

  function onBrushAI(ev){
    const d = ev?.detail || {};
    const t = String(d.type||'').toLowerCase();

    if(t==='risk'){
      const pct = Math.round((Number(d.risk)||0)*100);
      const band = String(d.band||'low').toUpperCase();
      showAI({ emo:'🧠', sub:`RISK ${pct}% • ${band}`, mini: String(d.tip||'—'), tag:'PRED', ms:1700 });
      return;
    }
    if(t==='stage'){
      showAI({ emo:'🏁', sub:`STAGE ${d.stage||''}`, mini:`Clean ${Math.round(Number(d.clean)||0)}%`, tag:'STAGE', ms:1300 });
      return;
    }
    if(t==='miss_streak'){
      showAI({ emo:'😵', sub:`พลาดติดกัน ${d.n||0}`, mini:'ช้าลงนิด—เล็งให้ชัวร์', tag:'WARN', ms:1400 });
      return;
    }
    if(t==='combo_hot'){
      showAI({ emo:'🔥', sub:`COMBO ${d.combo||0}`, mini:'ดีมาก! รักษาคอมโบ', tag:'HOT', ms:1200 });
      return;
    }
    if(t==='boss'){
      showAI({ emo:'💎', sub:`BOSS ${d.state||''}`, mini:'ยิงจุดอ่อนวงเหลืองแรงกว่า', tag:'BOSS', ms:1500 });
      return;
    }
    if(t==='quiz'){
      showAI({ emo:'🧩', sub:`QUIZ ${d.state||''}`, mini:'ตอบวิเคราะห์เพื่อรับโบนัส', tag:'C', ms:1500 });
      return;
    }
    if(t==='time'){
      showAI({ emo:'⏳', sub:'อีก 10 วิ!', mini:'เร่งแบบแม่น ๆ', tag:'TIME', ms:1200 });
      return;
    }
  }

  function boot(){
    const ctx = buildCtx();
    DOC.body.setAttribute('data-view', ctx.view);
    WIN.addEventListener('brush:ai', onBrushAI);
    // engine is self-started by user click on #btnStart inside safe.js
  }

  function setupTapStart(){
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');

    const viewQ = String(qs('view','')||'').toLowerCase();
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||'');
    const showTap = isMobile || viewQ==='mobile' || viewQ==='cvr';

    if(!tap || !btn){
      boot(); return;
    }

    if(showTap){
      tap.style.display = 'grid';
      const go = ()=>{
        try{ tap.style.display='none'; }catch(_){}
        boot();
      };
      btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
      tap.addEventListener('click', (e)=>{ if(e.target===tap){ e.preventDefault(); go(); } }, {passive:false});
    }else{
      boot();
    }
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', setupTapStart);
  }else{
    setupTapStart();
  }
})();