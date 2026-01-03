// === /herohealth/vr-groups/practice.js ===
// PACK 14: Practice UX (15s) — countdown + tips + start gate
// - Works with groups-vr.html practice chain (practiceActive/practiceDone)
// - Provides overlay + optional 2s "Ready" gate before real run
// - Emits: groups:practice {phase, leftSec}

(function(){
  'use strict';
  const DOC = document;
  const WIN = window;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }
  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function isCVR(){
    const cls = DOC.body.className || '';
    if (cls.includes('view-cvr')) return true;
    return String(qs('view','')||'').toLowerCase().includes('cvr');
  }

  function practiceSec(){
    const p = String(qs('practice','0')||'0');
    let sec = Number(p)||0;
    if (p==='1') sec = 15;
    sec = clamp(sec, 0, 30);
    if (!isCVR()) sec = 0;
    return sec;
  }

  function emit(name, detail){
    try{ WIN.dispatchEvent(new CustomEvent(name,{detail})); }catch(_){}
  }

  function ensure(){
    let el = DOC.getElementById('practiceOverlay');
    if (el) return el;

    el = DOC.createElement('div');
    el.id = 'practiceOverlay';
    el.style.cssText = `
      position:fixed; inset:0; z-index:110;
      display:none;
      align-items:center; justify-content:center;
      padding: 18px;
      pointer-events:none;
    `;

    el.innerHTML = `
      <div style="
        width:min(520px,100%);
        border-radius:26px;
        background: rgba(2,6,23,.76);
        border:1px solid rgba(148,163,184,.18);
        box-shadow: 0 24px 70px rgba(0,0,0,.55);
        backdrop-filter: blur(10px);
        padding: 16px;
        pointer-events:none;
      ">
        <div id="pTitle" style="font:1000 18px/1.2 system-ui;color:#e5e7eb;">
          🧪 PRACTICE
        </div>
        <div id="pSub" style="margin-top:8px;color:#94a3b8;font:900 13px/1.35 system-ui;">
          แตะจอเพื่อยิงจาก crosshair • เป้าจะขึ้นแบบฝึกก่อนเริ่มจริง
        </div>

        <div style="margin-top:12px;display:flex;align-items:center;gap:12px;">
          <div style="
            width:56px;height:56px;border-radius:18px;
            background: rgba(34,211,238,.12);
            border:1px solid rgba(34,211,238,.25);
            display:flex;align-items:center;justify-content:center;
            font:1000 22px/1 system-ui;color:#e5e7eb;
          "><span id="pLeft">15</span>s</div>

          <div style="flex:1 1 auto;">
            <div style="height:12px;border-radius:999px;overflow:hidden;background:rgba(148,163,184,.12);border:1px solid rgba(148,163,184,.14);">
              <div id="pFill" style="height:100%;width:0%;border-radius:999px;background:linear-gradient(90deg, rgba(34,211,238,.82), rgba(34,197,94,.82));"></div>
            </div>
            <div id="pHint" style="margin-top:8px;color:#e5e7eb;font:900 13px/1.25 system-ui;">
              เป้าถูก = +คะแนน • เป้าผิด/ขยะ = -แต้ม
            </div>
          </div>
        </div>

        <div id="pGate" style="margin-top:14px;display:none;color:#e5e7eb;font:1000 16px/1.1 system-ui;text-align:center;">
          🔥 READY…
        </div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  let active = false;
  let total = 0;

  function show(sec){
    const el = ensure();
    total = sec|0;
    active = true;
    el.style.display = 'flex';

    // coach nudge
    try{
      WIN.dispatchEvent(new CustomEvent('hha:coach',{
        detail:{ text:'PRACTICE 15s: แตะจอเพื่อยิงจาก crosshair ให้แม่นก่อนเริ่มจริง!', mood:'neutral' }
      }));
    }catch(_){}
  }

  function hide(){
    const el = DOC.getElementById('practiceOverlay');
    if (el) el.style.display = 'none';
    active = false;
  }

  // We detect practice state by reading HUD mode label updates (your html sets vMode)
  // If vMode becomes PRACTICE -> show overlay; if later RESEARCH/PLAY -> hide.
  function watchMode(){
    const vMode = DOC.getElementById('vMode');
    if (!vMode) return;

    let last = '';
    setInterval(()=>{
      const cur = String(vMode.textContent||'').trim().toUpperCase();
      if (cur === last) return;
      last = cur;

      if (cur === 'PRACTICE'){
        const sec = practiceSec();
        if (sec > 0) show(sec);
        emit('groups:practice', { phase:'start', sec });
      } else if (active && (cur === 'PLAY' || cur === 'RESEARCH')){
        hide();
        emit('groups:practice', { phase:'end' });
      }
    }, 140);
  }

  // Update bar from hha:time while PRACTICE (only when overlay visible)
  WIN.addEventListener('hha:time', (ev)=>{
    if (!active) return;
    const d = ev.detail||{};
    const left = Math.max(0, Math.round(Number(d.left ?? 0)));
    const elLeft = DOC.getElementById('pLeft');
    const elFill = DOC.getElementById('pFill');
    if (elLeft) elLeft.textContent = String(left);
    if (elFill){
      const pct = total>0 ? clamp(((total-left)/total)*100, 0, 100) : 0;
      elFill.style.width = Math.round(pct) + '%';
    }
    emit('groups:practice', { phase:'tick', leftSec:left });
  }, {passive:true});

  // 2s gate before real start (your html triggers real start after practice end)
  // We'll show READY… briefly when end overlay fires for practice chain
  let gateShown = false;
  WIN.addEventListener('hha:end', ()=>{
    if (!active) return;
    if (gateShown) return;
    gateShown = true;

    const gate = DOC.getElementById('pGate');
    if (gate){
      gate.style.display = 'block';
      gate.textContent = '🔥 READY…';
      setTimeout(()=>{ try{ gate.textContent='🚀 START!'; }catch{} }, 900);
    }
    setTimeout(()=>{ gateShown=false; }, 2200);
  }, {passive:true});

  function boot(){
    const sec = practiceSec();
    if (sec <= 0) return;
    watchMode();
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();

})();