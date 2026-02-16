// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (AI HUD + Big Pop C) v20260216c
// ✅ Tap-to-start unlock (mobile/vr)
// ✅ Boot ctx parse + passthrough hub/seed/time/view
// ✅ Listen brush:ai -> HUD AI panel + Big pop C (rate-limited)
// ✅ Safe: no crash if HUD missing

(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const num = (v,d)=>{ const n = Number(v); return isFinite(n)? n : d; };

  function buildCtx(){
    const view = String(qs('view', DOC.body.getAttribute('data-view')||'pc')||'pc').toLowerCase();
    const hub  = qs('hub','') || '';
    const seed = num(qs('seed', Date.now()), Date.now());
    const time = num(qs('time', 90), 90);
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
    wrap.className = 'hudCard hudAI';
    wrap.style.position = 'fixed';
    wrap.style.left = '12px';
    wrap.style.bottom = '12px';
    wrap.style.zIndex = '59';
    wrap.style.width = 'min(420px, 92vw)';
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
        ทำ PERFECT เพื่อคอมโบ + เติม Fever
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
      el.style.position='fixed';
      el.style.left='50%';
      el.style.top='50%';
      el.style.transform='translate(-50%,-50%) scale(0.96)';
      el.style.zIndex='60';
      el.style.padding='12px 16px';
      el.style.borderRadius='999px';
      el.style.border='1px solid rgba(148,163,184,.22)';
      el.style.background='rgba(2,6,23,.78)';
      el.style.color='rgba(229,231,235,.95)';
      el.style.fontWeight='950';
      el.style.letterSpacing='.6px';
      el.style.boxShadow='0 18px 60px rgba(0,0,0,.45)';
      el.style.backdropFilter='blur(10px)';
      el.style.webkitBackdropFilter='blur(10px)';
      el.style.pointerEvents='none';
      el.style.opacity='0';
      el.style.transition='opacity .14s ease, transform .14s ease';
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
      case 'boss_start':
        return mk('💎','บอสมาแล้ว!','โหมด BOSS เริ่ม',`HP = ${d.hp||'?'} / ${d.hpMax||'?'}`,'BOSS',1800,'BOSS!',900);
      case 'boss_phase':
        return mk('🔥',`บอส Phase ${d.phase||'?'}!`,`HP เหลือ ${d.hp||0}/${d.hpMax||0}`,'ตีให้แม่น รักษาคอมโบ','BOSS',1700);
      case 'time_10s':
        return mk('⏳','อีก 10 วิ!','เร่งแบบ “แม่น ๆ”','กันพลาด > รักษาคอมโบ','TIME',1200,'10s!',800);
      default:
        return null;
    }
  }

  function shouldBigPop(type){
    const t = String(type||'').toLowerCase();
    return (t==='boss_start' || t==='time_10s');
  }

  const RL = { lastAny:0, lastBig:0, minAnyMs:260, minBigMs:900 };

  function onBrushAI(ev){
    const d = ev?.detail || {};
    const type = d.type;
    const now = Date.now();

    if(now - RL.lastAny < RL.minAnyMs) return;
    RL.lastAny = now;

    const msg = aiMsgFromEvent(ev);
    if(!msg) return;

    setAI(msg);

    if(shouldBigPop(type)){
      if(now - RL.lastBig < RL.minBigMs) return;
      RL.lastBig = now;
      bigPop(msg);
    }
  }

  function boot(){
    const ctx = buildCtx();
    DOC.body.setAttribute('data-view', ctx.view);
    WIN.addEventListener('brush:ai', onBrushAI);

    // engine is standalone; safe.js runs itself
  }

  function setupTapStart(){
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');
    if(!tap || !btn){ boot(); return; }
    tap.style.display = 'grid';
    const go = ()=>{
      try{ tap.style.display='none'; }catch(_){}
      boot();
    };
    btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
    tap.addEventListener('click', (e)=>{ if(e.target===tap){ e.preventDefault(); go(); } }, {passive:false});
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', setupTapStart);
  }else{
    setupTapStart();
  }
})();