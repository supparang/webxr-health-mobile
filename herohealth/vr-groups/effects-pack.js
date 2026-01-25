// === /herohealth/vr-groups/effects-pack.js ===
// Effects Pack — PRODUCTION
// ✅ Floating judge text (good/bad/miss/boss/perfect/storm)
// ✅ Lightweight screen flash classes (rely on CSS)
// ✅ Safe for PC/Mobile/VR/cVR

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if (!DOC) return;

  const NS = (WIN.GroupsVR = WIN.GroupsVR || {});
  const $ = (id)=>DOC.getElementById(id);

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function layer(){
    return $('playLayer') || DOC.body;
  }

  function addFloat(text, kind, x, y){
    const el = DOC.createElement('div');
    el.className = 'judgeFloat judge-' + String(kind||'neutral');
    el.textContent = String(text||'');

    const lx = clamp(x ?? (innerWidth*0.5), 10, innerWidth-10);
    const ly = clamp(y ?? (innerHeight*0.45), 10, innerHeight-10);

    el.style.left = lx + 'px';
    el.style.top  = ly + 'px';

    layer().appendChild(el);
    setTimeout(()=>{ try{ el.classList.add('out'); }catch(_){ } }, 20);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 700);
  }

  // inject minimal CSS (in case user forgets)
  (function inject(){
    const css = `
      .judgeFloat{
        position:absolute; z-index:30;
        transform: translate(-50%,-50%) translateZ(0);
        padding: 8px 10px;
        border-radius: 14px;
        font-weight: 1000;
        letter-spacing: .02em;
        border: 1px solid rgba(148,163,184,.18);
        background: rgba(2,6,23,.72);
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 80px rgba(0,0,0,.35);
        opacity: 0;
        will-change: transform, opacity;
        pointer-events:none;
      }
      .judgeFloat.out{
        animation: jf .66s ease-out forwards;
      }
      @keyframes jf{
        0%{ opacity:0; transform:translate(-50%,-50%) translateY(6px) scale(.98); }
        10%{ opacity:1; transform:translate(-50%,-50%) translateY(0) scale(1); }
        100%{ opacity:0; transform:translate(-50%,-50%) translateY(-22px) scale(1.02); }
      }
      .judge-good{ border-color: rgba(34,197,94,.45); }
      .judge-bad{ border-color: rgba(239,68,68,.45); }
      .judge-miss{ border-color: rgba(245,158,11,.45); }
      .judge-boss{ border-color: rgba(168,85,247,.45); }
      .judge-perfect{ border-color: rgba(34,211,238,.45); }
      .judge-storm{ border-color: rgba(245,158,11,.45); }
    `;
    const st = DOC.createElement('style');
    st.textContent = css;
    DOC.head.appendChild(st);
  })();

  WIN.addEventListener('hha:judge', (ev)=>{
    const d = ev.detail || {};
    addFloat(d.text || '', d.kind || 'neutral', d.x, d.y);
  }, {passive:true});

  // optional: small camera flash by body class (handled in css)
  function flash(cls, ms){
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>{ try{ DOC.body.classList.remove(cls); }catch(_){ } }, ms||180);
    }catch(_){}
  }

  WIN.addEventListener('groups:progress', (ev)=>{
    const d = ev.detail||{};
    if (d.kind==='storm_on') flash('fx-storm', 260);
    if (d.kind==='boss_spawn') flash('fx-boss', 260);
    if (d.kind==='perfect_switch') flash('fx-perfect', 240);
  }, {passive:true});

  NS.EffectsPack = { addFloat };

})();