// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (TapStart + AI HUD)
// PATCH v20260304-BRUSH-BOOT-AIHUD
(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function buildCtx(){
    const view = String(qs('view', DOC.body.getAttribute('data-view')||'pc')||'pc').toLowerCase();
    const hub  = qs('hub','') || '';
    const seed = Number(qs('seed', Date.now())) || Date.now();
    const time = Number(qs('time', 80)) || 80;

    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const pid  = String(qs('pid', qs('participantId','')||'')||'').trim();

    const studyId = qs('studyId','') || '';
    const phase = qs('phase','') || '';
    const conditionGroup = qs('conditionGroup','') || '';

    const ai = String(qs('ai','1')) !== '0';
    const debug = String(qs('debug','0')) === '1';

    return { view, hub, seed, time, diff, pid, studyId, phase, conditionGroup, ai, debug };
  }

  // ----- tiny AI coach toast -----
  let wrap=null, t0=0;
  function ensureAIHud(){
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
          <div id="ai-title" style="font-weight:950;letter-spacing:.2px;">AI Coach</div>
          <div id="ai-sub" style="margin-top:2px;color:rgba(229,231,235,.82);font-size:13px;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">พร้อมช่วย!</div>
        </div>
        <div id="ai-tag" style="font-size:11px;color:rgba(148,163,184,1);font-weight:900;">TIP</div>
      </div>
      <div id="ai-mini" style="margin-top:8px;color:rgba(229,231,235,.86);font-size:13px;line-height:1.45;">
        เล็งให้ชัวร์ก่อนยิง
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function showAI(emo,title,sub,mini,tag='TIP',ms=1500){
    const now = Date.now();
    if(now - t0 < 260) return; // rate limit
    t0 = now;
    const w = ensureAIHud();
    const a = (id)=>DOC.getElementById(id);
    if(a('ai-emo')) a('ai-emo').textContent = emo;
    if(a('ai-title')) a('ai-title').textContent = title;
    if(a('ai-sub')) a('ai-sub').textContent = sub;
    if(a('ai-tag')) a('ai-tag').textContent = tag;
    if(a('ai-mini')) a('ai-mini').textContent = mini;

    w.style.opacity='1';
    w.style.transform='translateY(0)';
    clearTimeout(showAI._t);
    showAI._t = setTimeout(()=>{
      w.style.opacity='0';
      w.style.transform='translateY(6px)';
    }, ms);
  }

  function onBrushAI(ev){
    const d = ev?.detail || {};
    const type = String(d.type||'').toLowerCase();

    if(type==='risk'){
      const pct = Math.round((Number(d.risk)||0)*100);
      const band = d.band || 'mid';
      const emo = band==='high' ? '⚠️' : band==='low' ? '✅' : '🧠';
      showAI(emo,'AI Risk',`ความเสี่ยง: ${pct}%`, String(d.tip||'เล็งให้ชัวร์ก่อนยิง'),'RISK',1500);
      return;
    }
    if(type==='stage'){
      showAI('🧩','เปลี่ยน Stage',`เข้า Stage ${d.stage||''}`, 'ทำตามภารกิจของ Stage นี้ให้ครบ','STAGE',1500);
      return;
    }
    if(type==='boss'){
      if(d.state==='start') showAI('💎','BOSS!',`บอสมาแล้ว`, 'ยิงจุดอ่อนวงเหลือง 🎯','BOSS',1700);
      if(d.state==='down')  showAI('🎉','บอสแตก!',`เยี่ยมมาก`, 'ไปต่อ Stage ถัดไป','BOSS',1500);
      return;
    }
    if(type==='miss_streak'){
      showAI('😵','พลาดติดกัน!',`พลาด ${d.n||''} ครั้ง`, 'ช้าลงนิด เน้นโดนก่อน','WARN',1500);
      return;
    }
    if(type==='combo_hot'){
      showAI('🔥','คอมโบร้อน!',`combo ${d.combo||''}`, 'รักษาจังหวะ แล้วเร่งสปีดได้','HOT',1400);
      return;
    }
    if(type==='time'){
      showAI('⏳','อีก 10 วิ!',`เร่งแบบแม่น`, 'กันพลาดก่อนเป็นอันดับ 1','TIME',1200);
      return;
    }
    if(type==='quiz'){
      if(d.state==='open') showAI('🧠','Quiz เปิด',`ตอบเพื่อปิดเกม`, 'เลือกคำตอบที่อธิบายเหตุผลได้','QUIZ',1600);
      if(d.state==='done') showAI(d.correct?'✅':'❌','Quiz จบ', d.correct?'ตอบถูก!':'ยังไม่ถูก', 'ไปต่อได้','QUIZ',1500);
      return;
    }
  }

  function boot(){
    const ctx = buildCtx();
    DOC.body.setAttribute('data-view', ctx.view);
    DOC.documentElement.dataset.view = ctx.view;

    WIN.addEventListener('brush:ai', onBrushAI);

    // engine already autoloads; nothing else needed
    if(ctx.debug) console.log('[BrushVR boot] ctx=', ctx);
  }

  function setupTapStart(){
    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');
    if(!tap || !btn){
      boot();
      return;
    }
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