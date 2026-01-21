// === /herohealth/vr/hha-fun-hydration.js ===
// Hydration Fun Layer — PRODUCTION (Kid-friendly, lightweight, DOM-only)
// ✅ Adds AI Risk chip (OK/CARE/DANGER) without editing HTML
// ✅ Golden Block FX (End Window block = highlight)
// ✅ Shot feedback (hit/miss gentle cues)

'use strict';

export function createHydrationFun(opts = {}){
  const WIN = (typeof window !== 'undefined') ? window : globalThis;
  const DOC = WIN.document;

  const emit = typeof opts.emit === 'function'
    ? opts.emit
    : ((name, detail)=>{ try{ WIN.dispatchEvent(new CustomEvent(name, { detail })); }catch(_){ } });

  const clamp=(v,a,b)=>{ v=Number(v)||0; return v<a?a:(v>b?b:v); };

  const S = {
    chip: null,
    lastLevel: '',
    lastPulseAt: 0,
    toastAt: 0
  };

  function ensureChip(){
    if (S.chip && S.chip.isConnected) return S.chip;
    const top = DOC.querySelector('.hud-top');
    if(!top) return null;

    const chip = DOC.createElement('div');
    chip.className = 'chip ai ok';
    chip.style.pointerEvents = 'none';
    chip.innerHTML = `AI <b id="aiRiskText">OK</b>`;
    top.appendChild(chip);

    // Inject minimal styles (only once)
    if(!DOC.getElementById('hha-ai-chip-style')){
      const st = DOC.createElement('style');
      st.id='hha-ai-chip-style';
      st.textContent = `
        .chip.ai b{ letter-spacing:.2px; }
        .chip.ai.ok b{ color: var(--accent); }
        .chip.ai.care b{ color: var(--warn); }
        .chip.ai.danger b{ color: var(--danger); }
        body.hha-golden #playfield{
          box-shadow: 0 0 0 2px rgba(34,197,94,.22) inset, 0 24px 90px rgba(34,197,94,.12);
          animation: hhaGoldenPulse .35s ease-in-out 6;
        }
        @keyframes hhaGoldenPulse{
          0%{ transform: translate(0,0) scale(1); }
          50%{ transform: translate(0,0) scale(1.008); }
          100%{ transform: translate(0,0) scale(1); }
        }
        .hha-toast{
          position:fixed;
          left:50%; top: calc(118px + var(--sat,0px));
          transform: translateX(-50%);
          z-index: 110;
          pointer-events:none;
          font: 950 14px/1.2 system-ui;
          padding:10px 12px;
          border-radius: 999px;
          border:1px solid rgba(148,163,184,.18);
          background: rgba(2,6,23,.70);
          color: rgba(229,231,235,.96);
          box-shadow: 0 18px 70px rgba(0,0,0,.45);
          backdrop-filter: blur(10px);
          opacity:0;
          animation: hhaToast .85s ease-out forwards;
        }
        @keyframes hhaToast{
          0%{ opacity:0; transform: translateX(-50%) translateY(-8px); }
          15%{ opacity:1; transform: translateX(-50%) translateY(0); }
          70%{ opacity:1; }
          100%{ opacity:0; transform: translateX(-50%) translateY(-10px); }
        }
      `;
      DOC.head.appendChild(st);
    }

    S.chip = chip;
    return chip;
  }

  function setChip(level){
    const chip = ensureChip();
    if(!chip) return;

    chip.classList.remove('ok','care','danger');
    chip.classList.add(level);

    const b = chip.querySelector('#aiRiskText');
    if(b) b.textContent = (level==='ok' ? 'OK' : level==='care' ? 'CARE' : 'DANGER');
  }

  function toast(msg){
    const t = performance.now();
    if (t - S.toastAt < 650) return; // anti-spam
    S.toastAt = t;

    const el = DOC.createElement('div');
    el.className = 'hha-toast';
    el.textContent = msg;
    DOC.body.appendChild(el);
    setTimeout(()=>{ try{ el.remove(); }catch(_){ } }, 900);
  }

  function pulseRisk(){
    const t = performance.now();
    if(t - S.lastPulseAt < 900) return;
    S.lastPulseAt = t;
    try{
      DOC.body.classList.add('hha-hitfx');
      setTimeout(()=>DOC.body.classList.remove('hha-hitfx'), 120);
    }catch(_){}
  }

  function onPredict(pack){
    if(!pack) return;

    const r = clamp(pack.risk ?? 0, 0, 1);
    const level = (r >= 0.72) ? 'danger' : (r >= 0.50) ? 'care' : 'ok';

    if(level !== S.lastLevel){
      S.lastLevel = level;
      setChip(level);

      // kid-friendly: toast only on upgrades
      if(level === 'care') toast('⚠️ ระวังหลุดโซน!');
      if(level === 'danger') toast('🔥 โฟกัส! ใกล้พลาดแล้ว');
    }

    if(level === 'danger') pulseRisk();
  }

  function onGoldenBlock(){
    try{
      DOC.body.classList.add('hha-golden');
      setTimeout(()=>DOC.body.classList.remove('hha-golden'), 1400);
    }catch(_){}
    toast('✨ GOLDEN BLOCK!');
    emit('hha:celebrate', { kind:'golden-block', at: Date.now() });
  }

  function onShotFeedback(hit){
    // gentle feedback without punishing
    if(hit) return;
    // miss toast is light + rate-limited by toast()
    toast('เล็งนิดนึง 😊');
  }

  return { onPredict, onGoldenBlock, onShotFeedback };
}