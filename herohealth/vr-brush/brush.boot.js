// === /herohealth/vr-brush/brush.boot.js ===
// BrushVR BOOT — PRODUCTION (Tap-to-start + AI HUD listener)
// PATCH v20260303-brush-boot-ai
(function(){
  'use strict';
  const WIN = window, DOC = document;

  const qs = (k,d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch(_){ return d; } };

  function needsTap(view){
    view = String(view||'').toLowerCase();
    return (view === 'mobile' || view === 'cvr' || view === 'vr');
  }

  // --- Minimal AI HUD panel (optional; safe if missing CSS) ---
  function ensureAIHud(){
    let wrap = DOC.getElementById('hud-ai');
    if(wrap) return wrap;

    wrap = DOC.createElement('div');
    wrap.id = 'hud-ai';
    wrap.style.position='fixed';
    wrap.style.left='12px';
    wrap.style.bottom='12px';
    wrap.style.zIndex='59';
    wrap.style.width='min(420px,92vw)';
    wrap.style.pointerEvents='none';
    wrap.style.opacity='0';
    wrap.style.transform='translateY(6px)';
    wrap.style.transition='opacity .18s ease, transform .18s ease';
    wrap.style.border='1px solid rgba(148,163,184,.18)';
    wrap.style.borderRadius='18px';
    wrap.style.background='rgba(2,6,23,.72)';
    wrap.style.backdropFilter='blur(10px)';
    wrap.style.padding='10px 12px';
    wrap.style.boxShadow='0 18px 60px rgba(0,0,0,.35)';

    wrap.innerHTML = `
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div id="aiE" style="font-size:18px;line-height:1">🧠</div>
        <div style="min-width:0;flex:1">
          <div id="aiT" style="font-weight:1000">AI Prediction</div>
          <div id="aiS" style="margin-top:2px;color:rgba(229,231,235,.86);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">—</div>
          <div id="aiM" style="margin-top:6px;color:rgba(148,163,184,.95);font-weight:900;font-size:12px;line-height:1.35">—</div>
        </div>
        <div id="aiTag" style="font-size:11px;color:rgba(148,163,184,1);font-weight:1000">RISK</div>
      </div>
    `;
    DOC.body.appendChild(wrap);
    return wrap;
  }

  function showAI(msg){
    const w = ensureAIHud();
    const e = DOC.getElementById('aiE');
    const t = DOC.getElementById('aiT');
    const s = DOC.getElementById('aiS');
    const m = DOC.getElementById('aiM');
    const tag = DOC.getElementById('aiTag');

    if(e) e.textContent = msg.emo || '🧠';
    if(t) t.textContent = msg.title || 'AI Prediction';
    if(s) s.textContent = msg.sub || '';
    if(m) m.textContent = msg.mini || '';
    if(tag) tag.textContent = msg.tag || 'RISK';

    w.style.opacity='1';
    w.style.transform='translateY(0)';
    clearTimeout(showAI._t);
    showAI._t = setTimeout(()=>{
      w.style.opacity='0';
      w.style.transform='translateY(6px)';
    }, msg.ms || 1600);
  }

  // rate limit
  const RL = { last:0, min:260 };

  function onBrushAI(ev){
    const d = ev?.detail || {};
    const type = String(d.type||'').toLowerCase();
    const now = Date.now();
    if(now - RL.last < RL.min) return;
    RL.last = now;

    if(type==='risk'){
      const pct = Math.round((Number(d.risk)||0)*100);
      const band = String(d.band||'low').toUpperCase();
      showAI({
        emo: band==='HIGH' ? '🚨' : (band==='MID' ? '⚠️' : '✅'),
        title: `RISK ${pct}% • ${band}`,
        sub: d.tip || '—',
        mini: `stage=${d.stage||'?'} • combo=${d.combo||0} • missStreak=${d.missStreak||0}`,
        tag:'RISK',
        ms: 1700
      });
      return;
    }

    if(type==='miss_streak'){
      showAI({ emo:'😵', title:'พลาดติดกัน!', sub:`missStreak=${d.n||0}`, mini:'ช้าลงนิด เน้นยิงให้โดน', tag:'TIP', ms:1500 });
      return;
    }

    if(type==='combo_hot'){
      showAI({ emo:'🔥', title:'COMBO HOT!', sub:`combo=${d.combo||0}`, mini:'ดีมาก รักษาจังหวะ', tag:'BOOST', ms:1200 });
      return;
    }

    if(type==='stage'){
      showAI({ emo:'🎯', title:`STAGE ${d.stage||'?'}`, sub:'เป้าหมายเปลี่ยนแล้ว', mini:'เล่นตามภารกิจของสเตจ', tag:'STAGE', ms:1300 });
      return;
    }

    if(type==='quiz'){
      showAI({ emo:'🧩', title:'QUIZ', sub:`${d.state||''}`, mini:'ตอบเพื่อปิดเกมสเตจ C', tag:'C', ms:1300 });
      return;
    }

    if(type==='boss'){
      showAI({ emo:'💎', title:'BOSS', sub:`${d.state||''}`, mini:'หาจุดอ่อน 🎯 จะไวขึ้น', tag:'BOSS', ms:1400 });
      return;
    }

    if(type==='time'){
      showAI({ emo:'⏳', title:'TIME', sub:'ใกล้หมดเวลา!', mini:'กันพลาด > เร่งมั่ว', tag:'TIME', ms:1200 });
      return;
    }
  }

  function start(){
    // set view
    const view = String(qs('view', DOC.body.getAttribute('data-view')||'pc')||'pc').toLowerCase();
    DOC.body.setAttribute('data-view', view);

    // listen AI events from safe.js
    WIN.addEventListener('brush:ai', onBrushAI);
  }

  function init(){
    const view = String(qs('view', DOC.body.getAttribute('data-view')||'pc')||'pc').toLowerCase();
    DOC.body.setAttribute('data-view', view);

    const tap = DOC.getElementById('tapStart');
    const btn = DOC.getElementById('tapBtn');

    if(needsTap(view) && tap && btn){
      tap.style.display='grid';
      const go = ()=>{
        tap.style.display='none';
        start();
      };
      btn.addEventListener('click', (e)=>{ e.preventDefault(); go(); }, {passive:false});
      tap.addEventListener('click', (e)=>{ if(e.target===tap){ e.preventDefault(); go(); } }, {passive:false});
      return;
    }
    start();
  }

  if(DOC.readyState==='loading') DOC.addEventListener('DOMContentLoaded', init);
  else init();
})();