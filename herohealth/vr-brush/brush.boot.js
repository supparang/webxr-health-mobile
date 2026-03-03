// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (AI HUD + Big Pop C)
// PATCH v20260303-brush-AI-PRED-EVENTS
// ✅ Tap-to-start unlock (mobile/vr)
// ✅ Boot ctx parse + passthrough hub/seed/time/view
// ✅ Listen brush:ai -> HUD AI panel + Big pop (rate-limited)
// ✅ Safe: no crash if HUD missing

(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const num = (v,d)=>{ const n = Number(v); return isFinite(n)? n : d; };

  // -------------------------
  // Context builder (HHA style)
  // -------------------------
  function buildCtx(){
    const view = String(qs('view', DOC.body.getAttribute('data-view')||'pc')||'pc').toLowerCase();
    const hub  = qs('hub','') || '';
    const seed = num(qs('seed', Date.now()), Date.now());
    const time = num(qs('time', 90), 90);
    const ai   = String(qs('ai','1')) !== '0';

    const studyId = qs('studyId','') || '';
    const phase = qs('phase','') || '';
    const conditionGroup = qs('conditionGroup','') || '';

    return { view, hub, seed, time, ai, studyId, phase, conditionGroup };
  }

  // -------------------------
  // Minimal HUD AI (creates DOM if not present)
  // -------------------------
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
        รักษาคอมโบ แล้วเล็งให้ชัวร์
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

  // -------------------------
  // Big pop (center toast)
  // -------------------------
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

  // -------------------------
  // AI Mapper: brush:ai -> UI messages
  // -------------------------
  function aiMsgFromEvent(ev){
    const d = ev?.detail || {};
    const t = String(d.type||'').toLowerCase();

    const mk = (emo,title,sub,mini,tag='TIP',ms=1600,big=null,bigMs=900)=>({emo,title,sub,mini,tag,ms,big,bigMs});

    // ---- NEW: risk signals ----
    if(t === 'risk_high_on'){
      return mk('🚨','เสี่ยงสูง!','พลาดติด ๆ / ความแม่นต่ำ','ช้าลงนิด เล็งให้โดนก่อน แล้วค่อยเร่ง','RISK',1600,'RISK!',800);
    }
    if(t === 'risk_mid_on'){
      return mk('⚠️','เริ่มเสี่ยง','ยังพอคุมได้','อย่ารัวเกินไป เล็งกลางเป้า','RISK',1300);
    }
    if(t === 'risk_drop'){
      return mk('✅','ดีขึ้นแล้ว!','ความเสี่ยงลดลง','รักษาจังหวะนี้ไว้','RISK',1200);
    }
    if(t === 'miss_streak'){
      return mk('😵','พลาดติดกัน','คอมโบตก','หยุด 0.5 วิ แล้วเล็งใหม่','AIM',1500,'RESET!',800);
    }
    if(t === 'combo_hot'){
      return mk('🔥','คอมโบกำลังมา!','เล่นดีมาก','รักษาคอมโบ แล้วเร่งสปีดได้','FLOW',1200);
    }

    // ---- Stage & Quiz ----
    if(t === 'stage_a'){
      return mk('🅰️','Stage A','Scan Sprint','กวาดให้ไว แต่ห้ามพลาดติด ๆ','ABC',1500,'A!',800);
    }
    if(t === 'stage_b'){
      return mk('🅱️','Stage B','Evidence Build','เก็บหลักฐานให้ครบ 3 แบบ','ABC',1600,'B!',800);
    }
    if(t === 'stage_c'){
      return mk('🅲','Stage C','Analyze & Decide','ตอบวิเคราะห์เพื่อรับโบนัส','ABC',1600,'C!',800);
    }
    if(t === 'quiz_open'){
      return mk('🧠','วิเคราะห์!','เลือกคำตอบที่ใช่','อ่านสั้น ๆ แล้วตอบเลย','QUIZ',1700,'QUIZ!',900);
    }
    if(t === 'quiz_correct'){
      return mk('🎉','ถูกต้อง!','ได้โบนัส','จำหลักการนี้ไว้','QUIZ',1400,'+BONUS',900);
    }
    if(t === 'quiz_wrong'){
      return mk('🤔','ยังไม่ใช่','ลองใหม่รอบหน้า','ดู Hint แล้วจำไว้','QUIZ',1400);
    }

    // ---- Boss ----
    if(t==='boss_start'){
      return mk('💎','บอสมาแล้ว!','ต้องยิงหลายครั้ง','โฟกัส Weakspot 🎯 จะเร็วขึ้น','BOSS',1700,'BOSS!',900);
    }
    if(t==='boss_break'){
      return mk('💥','บอสแตก!','เก่งมาก','ไปต่อได้เลย','BOSS',1200,'BREAK!',900);
    }

    // ---- Time ----
    if(t==='time_10s'){
      return mk('⏳','อีก 10 วิ!','ปิดเกมแบบแม่น ๆ','กันพลาด > รักษาคอมโบ','TIME',1200,'10s!',800);
    }

    return null;
  }

  function shouldBigPop(type){
    const t = String(type||'').toLowerCase();
    return (
      t==='risk_high_on' ||
      t==='miss_streak' ||
      t==='stage_a' || t==='stage_b' || t==='stage_c' ||
      t==='quiz_open' ||
      t==='boss_start' || t==='boss_break' ||
      t==='time_10s'
    );
  }

  const RL = { lastAny:0, lastBig:0, minAnyMs:260, minBigMs:850 };

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

  // -------------------------
  // Tap-to-start unlock then boot
  // -------------------------
  function boot(){
    const ctx = buildCtx();
    DOC.body.setAttribute('data-view', ctx.view);

    // hook AI events (only if ai enabled)
    if(ctx.ai) WIN.addEventListener('brush:ai', onBrushAI);

    if(WIN.BrushVR && typeof WIN.BrushVR.boot === 'function'){
      WIN.BrushVR.boot(ctx);
    }else{
      console.warn('[BrushVR] missing BrushVR.boot(ctx)');
    }
  }

  function needsTap(view){
    view = String(view||'').toLowerCase();
    return (view==='mobile' || view==='cvr' || view==='vr');
  }

  function setupTapStart(){
    const ctx = buildCtx();
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');

    if(!tap || !btn || !needsTap(ctx.view)){
      try{ if(tap) tap.style.display='none'; }catch(_){}
      boot();
      return;
    }

    tap.style.display = 'grid';
    tap.setAttribute('aria-hidden','false');

    const go = ()=>{
      try{ tap.style.display='none'; tap.setAttribute('aria-hidden','true'); }catch(_){}
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