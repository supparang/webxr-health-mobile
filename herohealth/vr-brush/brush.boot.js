// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (tap-to-start + ctx + AI HUD mapper)
// PATCH v20260304-BRUSH-BOOT
(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };
  const num = (v,d)=>{ const n = Number(v); return Number.isFinite(n)? n : d; };

  function fatal(msg){
    const box = DOC.getElementById('fatal');
    if(!box){ alert(msg); return; }
    box.textContent = msg;
    box.classList.remove('br-hidden');
  }
  WIN.addEventListener('error', (e)=>{
    fatal('JS ERROR:\n' + (e?.message||e) + '\n\n' + (e?.filename||'') + ':' + (e?.lineno||'') + ':' + (e?.colno||''));
  });
  WIN.addEventListener('unhandledrejection', (e)=>{
    fatal('PROMISE REJECTION:\n' + (e?.reason?.message || e?.reason || e));
  });

  function getViewAuto(){
    const v = String(qs('view','')||'').toLowerCase();
    if(v) return v;
    const ua = navigator.userAgent || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (WIN.matchMedia && WIN.matchMedia('(pointer:coarse)').matches);
    return isMobile ? 'cvr' : 'pc';
  }

  function buildCtx(){
    return {
      view: getViewAuto(),
      hub: qs('hub','../hub.html') || '../hub.html',
      run: qs('run','play') || 'play',
      diff: (qs('diff','normal')||'normal').toLowerCase(),
      time: num(qs('time',80), 80),
      seed: num(qs('seed', Date.now()), Date.now()),
      pid: qs('pid','') || '',
      studyId: qs('studyId','') || '',
      phase: qs('phase','') || '',
      conditionGroup: qs('conditionGroup','') || '',
      log: qs('log','') || qs('api','') || '',
      ai: String(qs('ai','1')) !== '0',
      debug: String(qs('debug','0')) === '1'
    };
  }

  // Prevent page scroll on mobile (extra hardening)
  function hardenNoScroll(){
    try{
      const body = DOC.body;
      body.style.overflow = 'hidden';
      body.style.touchAction = 'none';
      body.addEventListener('touchmove', (e)=>{ e.preventDefault(); }, { passive:false });
    }catch(_){}
  }

  // AI HUD mini overlay (optional)
  function ensureAiHud(){
    let wrap = DOC.getElementById('hud-ai');
    if(wrap) return wrap;

    wrap = DOC.createElement('section');
    wrap.id = 'hud-ai';
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
        รักษาคอมโบ แล้วค่อยเร่ง
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function showAI(msg){
    const wrap = ensureAiHud();
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
    clearTimeout(showAI._t);
    showAI._t = setTimeout(()=>{
      wrap.style.opacity = '0';
      wrap.style.transform = 'translateY(6px)';
    }, msg.ms || 1500);
  }

  function onBrushAI(ev){
    const d = ev?.detail || {};
    const type = String(d.type||'').toLowerCase();

    if(type === 'risk'){
      const risk = Math.round((Number(d.risk)||0)*100);
      const band = d.band || 'mid';
      showAI({
        emo: band==='high'?'⚠️':(band==='low'?'✅':'🧠'),
        title: 'AI Risk',
        sub: `ความเสี่ยงพลาด: ${risk}% (Stage ${d.stage||'-'})`,
        mini: d.tip || 'เล็งให้ชัวร์ก่อนยิง',
        tag: 'PRED',
        ms: 1400
      });
      return;
    }

    if(type === 'miss_streak'){
      showAI({ emo:'😵', title:'เริ่มพลาดติดกัน', sub:`พลาดติดกัน ${d.n||0} ครั้ง`, mini:'ช้าลงนิด แล้วเล็งก่อนยิง', tag:'WARN', ms:1600 });
      return;
    }

    if(type === 'combo_hot'){
      showAI({ emo:'🔥', title:'คอมโบกำลังมา!', sub:`Combo ${d.combo||0}`, mini:'รักษาจังหวะ PERFECT ต่อ!', tag:'HOT', ms:1300 });
      return;
    }

    if(type === 'stage'){
      showAI({ emo:'🧩', title:'เปลี่ยนด่าน', sub:`เข้าสู่ Stage ${d.stage||'?'}`, mini:'ทำตามเป้าด่านนี้ให้ครบ', tag:'STAGE', ms:1500 });
      return;
    }

    if(type === 'boss'){
      if((d.state||'')==='start'){
        showAI({ emo:'💎', title:'บอสมา!', sub:'คราบหนา + จุดอ่อน', mini:'เล็งวงเหลืองแล้วกดยิง', tag:'BOSS', ms:1600 });
      }
      return;
    }

    if(type === 'time'){
      showAI({ emo:'⏳', title:'อีก 10 วิ!', sub:'เร่งแบบแม่น ๆ', mini:'กันพลาด > รักษาคอมโบ', tag:'TIME', ms:1200 });
      return;
    }

    if(type === 'quiz'){
      if((d.state||'')==='open') showAI({ emo:'🧠', title:'Quiz เปิด', sub:'ตอบ 1 ข้อเพื่อปิดเกม', mini:'อ่านโจทย์แล้วเลือกเหตุผลที่ถูก', tag:'QUIZ', ms:1500 });
      return;
    }
  }

  function bindBackLinks(ctx){
    const a1 = DOC.getElementById('btnBack');
    const a2 = DOC.getElementById('btnBackHub2');
    const hubUrl = ctx.hub || '../hub.html';
    for(const a of [a1,a2]){
      if(!a) continue;
      try{
        const u = new URL(hubUrl, location.href);
        if(ctx.pid) u.searchParams.set('pid', ctx.pid);
        if(ctx.diff) u.searchParams.set('diff', ctx.diff);
        if(ctx.time) u.searchParams.set('time', String(ctx.time));
        if(ctx.seed) u.searchParams.set('seed', String(ctx.seed));
        if(ctx.view) u.searchParams.set('view', ctx.view);
        a.href = u.toString();
      }catch(_){
        a.href = hubUrl;
      }
    }
  }

  function setupTapStartAndBoot(){
    hardenNoScroll();

    const ctx = buildCtx();
    DOC.body.setAttribute('data-view', ctx.view);
    const wrap = DOC.getElementById('br-wrap');
    if(wrap) wrap.setAttribute('data-view', ctx.view);

    const v1 = DOC.getElementById('br-ctx-view'); if(v1) v1.textContent = ctx.view;
    const v2 = DOC.getElementById('br-ctx-seed'); if(v2) v2.textContent = String((ctx.seed>>>0));
    const v3 = DOC.getElementById('br-ctx-time'); if(v3) v3.textContent = `${ctx.time}s`;
    const v4 = DOC.getElementById('br-diffTag');  if(v4) v4.textContent = ctx.diff;
    const v5 = DOC.getElementById('br-aiTag');    if(v5) v5.textContent = ctx.ai ? '1' : '0';
    const m1 = DOC.getElementById('mDiff'); if(m1) m1.textContent = ctx.diff;
    const m2 = DOC.getElementById('mTime'); if(m2) m2.textContent = `${ctx.time}s`;

    bindBackLinks(ctx);

    WIN.addEventListener('brush:ai', onBrushAI);

    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');

    const doBoot = ()=>{
      try{ tap && (tap.style.display='none'); }catch(_){}
      if(WIN.BrushVR && typeof WIN.BrushVR.boot === 'function'){
        WIN.BrushVR.boot(ctx);
      }else{
        console.warn('[BrushVR] missing BrushVR.boot(ctx)');
      }
    };

    // show overlay on mobile/cvr
    const wantTap = (ctx.view === 'cvr' || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent||''));
    if(tap && btn && wantTap){
      tap.style.display = 'grid';
      btn.addEventListener('click', (e)=>{ e.preventDefault(); doBoot(); }, {passive:false});
      tap.addEventListener('click', (e)=>{ if(e.target===tap){ e.preventDefault(); doBoot(); } }, {passive:false});
    }else{
      doBoot();
    }
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', setupTapStartAndBoot);
  }else{
    setupTapStartAndBoot();
  }
})();